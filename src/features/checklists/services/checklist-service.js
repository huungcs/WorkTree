/**
 * WorkTree X Feature: Checklist Service
 * Authoritative cloud operations for task checklist items.
 * Handles validation, double-submit protection, and auto-progress rollup sync.
 */

import { ChecklistRepository, TaskRepository } from '../../../lib/supabase/repositories.js';
import { appState } from '../../../app/state.js';

const submittingItems = new Set();

export function formatChecklistErrorMessage(error) {
  if (!error) return 'Đã xảy ra lỗi không xác định.';
  const msg = error.message || String(error);

  if (error.code === '42501' || msg.includes('permission denied') || msg.includes('violates row-level security')) {
    return 'Bạn không có quyền chỉnh sửa checklist của công việc này.';
  }
  if (msg.includes('checklist_content_len') || msg.includes('Tối đa 400')) {
    return 'Nội dung checklist phải từ 1 đến 400 ký tự.';
  }
  if (msg.includes('Cannot complete an auto-progress task while checklist items are still open')) {
    return 'Không thể đóng việc tự động tính tiến độ khi còn mục checklist chưa xong.';
  }
  return msg;
}

export const ChecklistService = {
  async getItems(taskId, organizationId = null) {
    if (!taskId) return [];
    const orgId = organizationId || appState.activeOrganizationId;
    return await ChecklistRepository.getChecklistItems(taskId, orgId);
  },

  async addItem({ taskId, content, sortOrder = 0, organizationId = null }) {
    if (!taskId) throw new Error('Thiếu taskId.');
    const orgId = organizationId || appState.activeOrganizationId;
    if (!orgId) throw new Error('Thiếu activeOrganizationId.');

    const trimmed = (content || '').trim();
    if (!trimmed) throw new Error('Nội dung checklist không được để trống.');
    if (trimmed.length > 400) throw new Error('Nội dung checklist tối đa 400 ký tự.');

    const lockKey = `${taskId}:${trimmed}`;
    if (submittingItems.has(lockKey)) {
      throw new Error('Đang thêm mục checklist, vui lòng đợi...');
    }
    submittingItems.add(lockKey);

    try {
      const created = await ChecklistRepository.addChecklistItem({
        organizationId: orgId,
        taskId,
        content: trimmed,
        sortOrder
      });

      // Refetch task_rollups row to update checklist_total and progress in memory
      await this.syncTaskRollup(taskId, orgId);
      return created;
    } catch (err) {
      throw new Error(formatChecklistErrorMessage(err));
    } finally {
      submittingItems.delete(lockKey);
    }
  },

  async toggleItem({ itemId, taskId, isDone, organizationId = null }) {
    if (!itemId) throw new Error('Thiếu itemId.');
    const orgId = organizationId || appState.activeOrganizationId;

    try {
      const updated = await ChecklistRepository.toggleChecklistItem(itemId, isDone);
      if (taskId) {
        await this.syncTaskRollup(taskId, orgId);
      }
      return updated;
    } catch (err) {
      throw new Error(formatChecklistErrorMessage(err));
    }
  },

  async deleteItem({ itemId, taskId, organizationId = null }) {
    if (!itemId) throw new Error('Thiếu itemId.');
    const orgId = organizationId || appState.activeOrganizationId;

    try {
      const res = await ChecklistRepository.deleteChecklistItem(itemId);
      if (taskId) {
        await this.syncTaskRollup(taskId, orgId);
      }
      return res;
    } catch (err) {
      throw new Error(formatChecklistErrorMessage(err));
    }
  },

  /**
   * Refetches single task_rollups row from cloud to keep client task state strictly consistent
   */
  async syncTaskRollup(taskId, organizationId = null) {
    if (!taskId) return null;
    const orgId = organizationId || appState.activeOrganizationId;
    try {
      const rollup = await TaskRepository.getTaskById(taskId, orgId);
      if (rollup && typeof window !== 'undefined' && window.data?.tasks) {
        const local = window.data.tasks.find(t => t.id === taskId);
        if (local) {
          local.progress = rollup.status === 'done' ? 100 : (rollup.progress || 0);
          local.actual = (rollup.actual_minutes || 0) / 60;
          local.checklist_total = rollup.checklist_total || 0;
          local.checklist_done = rollup.checklist_done || 0;
          local.is_blocked = rollup.is_blocked === true;
          local.dependency = local.is_blocked ? 'Chờ phụ thuộc' : 'Không có';
          if (typeof window.rebuild === 'function') window.rebuild();
        }
      }
      return rollup;
    } catch (err) {
      console.warn('syncTaskRollup warning:', err.message);
      return null;
    }
  }
};
