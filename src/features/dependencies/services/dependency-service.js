/**
 * WorkTree X Feature: Dependency Service
 * Authoritative cloud operations for task dependencies.
 * Handles cycle prevention, self-dependency blocks, and rollup is_blocked sync.
 */

import { DependencyRepository, TaskRepository } from '../../../lib/supabase/repositories.js';
import { appState } from '../../../app/state.js';

export function formatDependencyErrorMessage(error) {
  if (!error) return 'Đã xảy ra lỗi không xác định.';
  const msg = error.message || String(error);

  if (error.code === '42501' || msg.includes('permission denied') || msg.includes('violates row-level security')) {
    return 'Bạn không có quyền quản lý quan hệ phụ thuộc của công việc này.';
  }
  if (msg.includes('A task cannot depend on itself') || msg.includes('task_dependencies_not_self')) {
    return 'Công việc không thể phụ thuộc vào chính nó.';
  }
  if (msg.includes('Dependency would create a cycle')) {
    return 'Không thể thêm vì sẽ tạo chu trình phụ thuộc tuần hoàn (vòng lặp A -> B -> A).';
  }
  if (msg.includes('foreign key') || msg.includes('task_dependencies_dep_fk') || msg.includes('task_dependencies_task_fk')) {
    return 'Công việc được liên kết không tồn tại hoặc thuộc không gian làm việc khác.';
  }
  if (msg.includes('duplicate key') || msg.includes('task_dependencies_pkey')) {
    return 'Liên kết phụ thuộc này đã tồn tại.';
  }
  return msg;
}

export const DependencyService = {
  async getDependencies(taskId, organizationId = null) {
    if (!taskId) return [];
    const orgId = organizationId || appState.activeOrganizationId;
    return await DependencyRepository.getDependencies(taskId, orgId);
  },

  async addDependency({ taskId, dependsOnTaskId, organizationId = null }) {
    if (!taskId || !dependsOnTaskId) {
      throw new Error('Thiếu thông tin liên kết phụ thuộc.');
    }
    if (taskId === dependsOnTaskId) {
      throw new Error('Công việc không thể phụ thuộc vào chính nó.');
    }
    const orgId = organizationId || appState.activeOrganizationId;
    if (!orgId) throw new Error('Thiếu activeOrganizationId.');

    try {
      const created = await DependencyRepository.addDependency({
        organizationId: orgId,
        taskId,
        dependsOnTaskId
      });

      // Synchronize task rollup to update is_blocked
      await this.syncTaskRollup(taskId, orgId);
      return created;
    } catch (err) {
      throw new Error(formatDependencyErrorMessage(err));
    }
  },

  async deleteDependency({ taskId, dependsOnTaskId, organizationId = null }) {
    if (!taskId || !dependsOnTaskId) {
      throw new Error('Thiếu thông tin liên kết phụ thuộc.');
    }
    const orgId = organizationId || appState.activeOrganizationId;

    try {
      const res = await DependencyRepository.deleteDependency({
        organizationId: orgId,
        taskId,
        dependsOnTaskId
      });

      // Synchronize task rollup to update is_blocked
      await this.syncTaskRollup(taskId, orgId);
      return res;
    } catch (err) {
      throw new Error(formatDependencyErrorMessage(err));
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
          local.is_blocked = rollup.is_blocked === true;
          local.dependency = local.is_blocked ? 'Chờ phụ thuộc' : 'Không có';
          if (typeof window.rebuild === 'function') window.rebuild();
        }
      }
      return rollup;
    } catch (err) {
      console.warn('syncTaskRollup dependency warning:', err.message);
      return null;
    }
  }
};
