/**
 * WorkTree X Feature: Task Service
 * Task business operations, domain mapping, mutation generation guards,
 * and canonical task_rollups projection.
 */

import { TaskRepository, STATUS_MAP, PRIORITY_MAP } from '../../../lib/supabase/repositories.js';
import { appState } from '../../../app/state.js';

// Per-task mutation version tracker to prevent out-of-order stale async writes
const taskMutationVersions = new Map();


export const DB_STATUS_TO_UI = {
  todo: 'Chưa làm',
  in_progress: 'Đang làm',
  review: 'Chờ duyệt',
  done: 'Hoàn thành'
};

export const DB_PRIORITY_TO_UI = {
  urgent: 'Khẩn cấp',
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp'
};

/**
 * Maps a canonical task_rollups row to the UI projection model
 */
export function mapCloudTaskToUI(t) {
  if (!t) return null;
  const uiStatus = DB_STATUS_TO_UI[t.status] || STATUS_MAP.dbToUi[t.status] || 'Chưa làm';
  const uiPriority = DB_PRIORITY_TO_UI[t.priority] || PRIORITY_MAP.dbToUi[t.priority] || 'Trung bình';
  const totalChecks = t.checklist_total || 0;
  const doneChecks = t.checklist_done || 0;

  return {
    id: t.id,
    node: t.node_id,
    title: t.title || '',
    owner: t.primary_assignee_id || null,
    status: uiStatus,
    priority: uiPriority,
    start: t.start_date || '',
    due: t.due_date || '',
    estimate: (t.estimate_minutes || 0) / 60,
    actual: (t.actual_minutes || 0) / 60,
    progress: t.status === 'done' ? 100 : (t.progress || 0),
    desc: t.description || '',
    tags: Array.isArray(t.tags) ? t.tags : [],
    dependency: t.is_blocked ? 'Chờ phụ thuộc' : 'Không có',
    dependencies: [],
    checklist: Array.from({ length: totalChecks }, (_, i) => [
      `Mục ${i + 1}`,
      i < doneChecks
    ]),
    comments: [],
    logs: [],
    favorite: false,
    autoProgress: t.auto_progress === true,
    is_blocked: t.is_blocked === true,
    checklist_total: totalChecks,
    checklist_done: doneChecks,
    createdAt: t.created_at || '',
    updatedAt: t.updated_at || ''
  };
}

/**
 * Translates Supabase / Postgres error to user-friendly Vietnamese text
 */
export function formatTaskErrorMessage(error) {
  if (!error) return 'Đã xảy ra lỗi không xác định.';
  const msg = error.message || String(error);

  if (error.code === '42501' || msg.includes('permission denied') || msg.includes('violates row-level security')) {
    return 'Bạn không có quyền thực hiện thao tác này.';
  }
  if (msg.includes('Cannot move a task to another organization')) {
    return 'Không thể chuyển công việc sang tổ chức khác.';
  }
  if (msg.includes('Task creator and creation time are immutable')) {
    return 'Người tạo và thời gian tạo công việc không thể thay đổi.';
  }
  if (msg.includes('Task start date cannot be after due date')) {
    return 'Ngày bắt đầu không được sau hạn hoàn thành.';
  }
  if (msg.includes('Assignee does not exist or is inactive')) {
    return 'Người phụ trách không hợp lệ hoặc đã ngưng hoạt động.';
  }
  if (msg.includes('No active membership in organization')) {
    return 'Bạn không có tư cách thành viên hợp lệ trong tổ chức này.';
  }
  if (msg.includes('Not allowed to create tasks in this scope')) {
    return 'Bạn không có quyền tạo công việc trong đơn vị này.';
  }
  if (msg.includes('Manager cannot assign outside granted scope')) {
    return 'Quản lý không được giao việc cho nhân sự ngoài phạm vi phân quyền.';
  }
  if (msg.includes('Member cannot update this task')) {
    return 'Nhân viên chỉ có thể cập nhật công việc được giao cho chính mình trong phạm vi phụ trách.';
  }
  if (msg.includes('Member can only update status/progress on the task row')) {
    return 'Nhân viên chỉ có quyền cập nhật trạng thái hoặc tiến độ công việc.';
  }
  if (msg.includes('Manager cannot move/update task outside granted scope')) {
    return 'Quản lý không thể chuyển công việc ra ngoài phạm vi phụ trách.';
  }
  if (msg.includes('Role is read-only')) {
    return 'Vai trò của bạn chỉ có quyền xem, không được chỉnh sửa.';
  }
  if (msg.includes('Cannot complete an auto-progress task while checklist items are still open')) {
    return 'Checklist chưa hoàn tất. Vui lòng hoàn tất checklist trước khi đánh dấu hoàn thành.';
  }
  if (msg.includes('Cannot complete a task while dependencies are still open')) {
    return 'Không thể hoàn thành công việc khi còn công việc phụ thuộc chưa hoàn tất.';
  }
  if (error.code === 'CONCURRENCY_CONFLICT' || msg.includes('Dữ liệu đã được thay đổi ở nơi khác')) {
    return 'Dữ liệu đã được thay đổi ở nơi khác. Đã tải lại phiên bản mới nhất.';
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Network request failed')) {
    return 'Không thể kết nối máy chủ. Vui lòng kiểm tra đường truyền.';
  }
  return msg;
}

export const TaskService = {
  async loadTasks(organizationId, filter = {}) {
    return await TaskRepository.getTasks(organizationId, filter);
  },

  /**
   * Tạo công việc mới trên Cloud Supabase
   */
  async createTask({
    organizationId,
    nodeId,
    title,
    description = '',
    priority = 'medium',
    primaryAssigneeId = null,
    dueDate = null,
    startDate = null,
    estimateMinutes = 0,
    tags = []
  }) {
    const activeOrg = appState.activeOrganizationId;
    const targetOrg = organizationId || activeOrg;
    if (!targetOrg) {
      throw new Error('Chưa chọn không gian làm việc (active organization).');
    }

    try {
      const created = await TaskRepository.createTask({
        organizationId: targetOrg,
        nodeId,
        title,
        description,
        priority,
        primaryAssigneeId,
        dueDate: dueDate || null,
        startDate: startDate || null,
        estimateMinutes: Math.round(Number(estimateMinutes) || 0),
        tags: Array.isArray(tags) ? tags : []
      });

      // Tenant Race Guard: If workspace switched mid-flight, discard
      if (appState.activeOrganizationId !== targetOrg) {
        console.warn('[TaskService] Workspace switched during createTask. Discarding local commit.');
        return null;
      }

      // Refetch canonical row from task_rollups view
      const canonical = await TaskRepository.getTaskById(created.id);
      return mapCloudTaskToUI(canonical || created);
    } catch (err) {
      console.error('[TaskService.createTask error]', err);
      throw new Error(formatTaskErrorMessage(err));
    }
  },

  /**
   * Cập nhật công việc trên Cloud Supabase (minimal PATCH)
   */
  async updateTask(taskId, updates = {}, expectedUpdatedAt = null) {
    if (!taskId) throw new Error('Thiếu taskId để cập nhật.');
    const activeOrg = appState.activeOrganizationId;

    try {
      const updated = await TaskRepository.updateTask(taskId, updates, expectedUpdatedAt);

      if (appState.activeOrganizationId !== activeOrg) {
        console.warn('[TaskService] Workspace switched during updateTask. Discarding local commit.');
        return null;
      }

      // Refetch canonical rollup row
      const canonical = await TaskRepository.getTaskById(taskId);
      return mapCloudTaskToUI(canonical || updated);
    } catch (err) {
      console.error('[TaskService.updateTask error]', err);
      throw new Error(formatTaskErrorMessage(err));
    }
  },

  /**
   * Cập nhật trạng thái công việc kèm theo generation counter guard
   */
  async updateStatus(taskId, status) {
    if (!taskId) throw new Error('Thiếu taskId để đổi trạng thái.');
    const activeOrg = appState.activeOrganizationId;

    // Track mutation generation for this specific task
    const nextVersion = (taskMutationVersions.get(taskId) || 0) + 1;
    taskMutationVersions.set(taskId, nextVersion);

    try {
      const updated = await TaskRepository.updateTaskStatus(taskId, status);

      // Check if another rapid status change occurred while this request was in flight
      if (taskMutationVersions.get(taskId) !== nextVersion) {
        console.info(`[TaskService] Bỏ qua kết quả cũ cho task ${taskId} (version ${nextVersion} vs current ${taskMutationVersions.get(taskId)})`);
        return { isLatest: false, task: null };
      }

      // Check active workspace
      if (appState.activeOrganizationId !== activeOrg) {
        console.warn('[TaskService] Workspace switched during updateStatus. Discarding local commit.');
        return { isLatest: false, task: null };
      }

      const canonical = await TaskRepository.getTaskById(taskId);
      const mapped = mapCloudTaskToUI(canonical || updated);
      return { isLatest: true, task: mapped };
    } catch (err) {
      console.error('[TaskService.updateStatus error]', err);
      throw new Error(formatTaskErrorMessage(err));
    }
  },

  /**
   * Lưu trữ (soft-archive) công việc
   */
  async archiveTask(taskId) {
    if (!taskId) throw new Error('Thiếu taskId để lưu trữ.');
    const activeOrg = appState.activeOrganizationId;

    try {
      await TaskRepository.archiveTask(taskId);

      if (appState.activeOrganizationId !== activeOrg) {
        console.warn('[TaskService] Workspace switched during archiveTask.');
        return false;
      }
      return true;
    } catch (err) {
      console.error('[TaskService.archiveTask error]', err);
      throw new Error(formatTaskErrorMessage(err));
    }
  }
};
