/**
 * WorkTree X Feature: Time Entry Service
 * Authoritative cloud operations for task time entries.
 * Handles integer minute conversion, double-submit protection, and actual_minutes rollup sync.
 */

import { TimeEntryRepository, TaskRepository } from '../../../lib/supabase/repositories.js';
import { appState } from '../../../app/state.js';

const submittingTimeEntries = new Set();

export function formatTimeEntryErrorMessage(error) {
  if (!error) return 'Đã xảy ra lỗi không xác định.';
  const msg = error.message || String(error);

  if (error.code === '42501' || msg.includes('permission denied') || msg.includes('violates row-level security')) {
    return 'Bạn không có quyền ghi thời gian cho công việc này.';
  }
  if (msg.includes('time_entries_minutes_check') || msg.includes('lớn hơn 0 phút')) {
    return 'Thời gian ghi phải lớn hơn 0 phút và không vượt quá 7 ngày.';
  }
  if (msg.includes('time_entries_note_len') || msg.includes('500 ký tự')) {
    return 'Ghi chú thời gian tối đa 500 ký tự.';
  }
  if (msg.includes('Time-entry user is not an active member')) {
    return 'Người chấm công không phải thành viên hoạt động trong tổ chức này.';
  }
  return msg;
}

export const TimeEntryService = {
  async getTimeEntries(taskId, organizationId = null) {
    if (!taskId) return [];
    const orgId = organizationId || appState.activeOrganizationId;
    return await TimeEntryRepository.getTimeEntries(taskId, orgId);
  },

  async logTime({
    taskId,
    minutes = null,
    hours = null,
    note = '',
    startedAt = null,
    endedAt = null,
    organizationId = null
  }) {
    if (!taskId) throw new Error('Thiếu taskId.');
    const orgId = organizationId || appState.activeOrganizationId;
    if (!orgId) throw new Error('Thiếu activeOrganizationId.');

    // Normalize hours to integer minutes if hours provided
    let intMinutes = 0;
    if (minutes !== null && minutes !== undefined) {
      intMinutes = Math.round(Number(minutes));
    } else if (hours !== null && hours !== undefined) {
      intMinutes = Math.round(Number(hours) * 60);
    }

    if (!Number.isInteger(intMinutes) || intMinutes <= 0) {
      throw new Error('Thời gian thực hiện phải lớn hơn 0 phút.');
    }
    if (intMinutes > 10080) {
      throw new Error('Thời gian thực hiện không được vượt quá 10.080 phút (7 ngày).');
    }

    const lockKey = `${taskId}:${intMinutes}:${startedAt || Date.now()}`;
    if (submittingTimeEntries.has(lockKey)) {
      throw new Error('Đang lưu bản ghi thời gian, vui lòng đợi...');
    }
    submittingTimeEntries.add(lockKey);

    try {
      const created = await TimeEntryRepository.logTime({
        organizationId: orgId,
        taskId,
        minutes: intMinutes,
        note: (note || '').trim().slice(0, 500),
        startedAt,
        endedAt
      });

      // Synchronize task rollup to authoritatively update actual_minutes from DB
      await this.syncTaskRollup(taskId, orgId);
      return created;
    } catch (err) {
      throw new Error(formatTimeEntryErrorMessage(err));
    } finally {
      submittingTimeEntries.delete(lockKey);
    }
  },

  async deleteTimeEntry(entryId, taskId = null, organizationId = null) {
    if (!entryId) throw new Error('Thiếu mã bản ghi thời gian để xóa.');
    const orgId = organizationId || appState.activeOrganizationId;

    try {
      const res = await TimeEntryRepository.deleteTimeEntry(entryId);
      if (taskId) {
        await this.syncTaskRollup(taskId, orgId);
      }
      return res;
    } catch (err) {
      throw new Error(formatTimeEntryErrorMessage(err));
    }
  },

  async syncTaskRollup(taskId, organizationId = null) {
    if (!taskId) return null;
    const orgId = organizationId || appState.activeOrganizationId;
    try {
      const rollup = await TaskRepository.getTaskById(taskId, orgId);
      if (rollup && typeof window !== 'undefined' && window.data?.tasks) {
        const local = window.data.tasks.find(t => t.id === taskId);
        if (local) {
          local.actual = (rollup.actual_minutes || 0) / 60;
          if (typeof window.rebuild === 'function') window.rebuild();
        }
      }
      return rollup;
    } catch (err) {
      console.warn('syncTaskRollup time entry warning:', err.message);
      return null;
    }
  }
};
