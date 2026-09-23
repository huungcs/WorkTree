/**
 * WorkTree X Feature: Comment Service
 * Authoritative cloud operations for task comments.
 * Handles validation, double-submit protection, and user profile display.
 */

import { CommentRepository, TaskRepository } from '../../../lib/supabase/repositories.js';
import { appState } from '../../../app/state.js';
import { ZaloBotService } from '../../integrations/index.js';

const submittingComments = new Set();

/**
 * Resolve the only valid Zalo recipient for a task comment.
 *
 * Comment notifications follow the same recipient contract as the database
 * notification trigger: only the task's primary assignee may be notified.
 * Never broaden recipients from the employee directory because that directory
 * can contain people from other departments visible to the current member.
 */
export function resolveCommentZaloRecipients({ assigneeId, currentEmployeeId, employees = [] } = {}) {
  if (!assigneeId || assigneeId === currentEmployeeId) return [];

  const assignee = employees.find(employee => employee.id === assigneeId);
  if (!assignee?.zalo_chat_id) return [];

  return [assignee.zalo_chat_id];
}

export function formatCommentErrorMessage(error) {
  if (!error) return 'Đã xảy ra lỗi không xác định.';
  const msg = error.message || String(error);

  if (error.code === '42501' || msg.includes('permission denied') || msg.includes('violates row-level security')) {
    return 'Bạn không có quyền bình luận trên công việc này.';
  }
  if (msg.includes('comments_body_len') || msg.includes('Tối đa 5000') || msg.includes('Tối đa 5.000')) {
    return 'Nội dung bình luận phải từ 1 đến 5.000 ký tự.';
  }
  if (msg.includes('không được để trống')) {
    return 'Nội dung bình luận không được để trống.';
  }
  return msg;
}

export const CommentService = {
  async getComments(taskId, organizationId = null) {
    if (!taskId) return [];
    const orgId = organizationId || appState.activeOrganizationId;
    return await CommentRepository.getComments(taskId, orgId);
  },

  async addComment({ taskId, body, organizationId = null }) {
    if (!taskId) throw new Error('Thiếu taskId.');
    const orgId = organizationId || appState.activeOrganizationId;
    if (!orgId) throw new Error('Thiếu activeOrganizationId.');

    const trimmed = (body || '').trim();
    if (!trimmed) throw new Error('Nội dung bình luận không được để trống.');
    if (trimmed.length > 5000) throw new Error('Nội dung bình luận tối đa 5.000 ký tự.');

    const lockKey = `${taskId}:${trimmed.slice(0, 50)}`;
    if (submittingComments.has(lockKey)) {
      throw new Error('Đang gửi bình luận, vui lòng đợi...');
    }
    submittingComments.add(lockKey);

    try {
      const result = await CommentRepository.addComment({
        organizationId: orgId,
        taskId,
        body: trimmed
      });

      // Asynchronously notify assigned employee via Zalo Bot if linked
      (async () => {
        try {
          const task = (appState.tasks || []).find(t => t.id === taskId) ||
            await TaskRepository.getTaskById(taskId).catch(() => null);

          const assigneeId = task?.primary_assignee_id || task?.primaryAssigneeId || task?.owner || task?.assigneeId;
          const currentEmployeeId = appState.activeMembership?.employeeId;

          const employees = (appState.employees && appState.employees.length) ? appState.employees : (typeof window !== 'undefined' && window.cloudEmployees ? window.cloudEmployees : []);
          const chatIdsToNotify = resolveCommentZaloRecipients({
            assigneeId,
            currentEmployeeId,
            employees
          });

          if (chatIdsToNotify.length > 0) {
            const targetNodeId = task.node_id || task.nodeId || task.node;
            const node = (appState.nodes || []).find(n => n.id === targetNodeId);
            const nodeName = node ? node.name : 'Toàn công ty';
            const authorName = appState.user?.user_metadata?.full_name || appState.user?.email || 'Thành viên nhóm';

            for (const cid of chatIdsToNotify) {
              await ZaloBotService.sendCommentNotification({
                zaloChatId: cid,
                taskTitle: task.title || 'Công việc trên WorkTree X',
                nodeName,
                authorName,
                commentBody: trimmed,
                taskId
              });
            }
            console.info(`[ZaloBot] Đã gửi thông báo bình luận mới đến ${chatIdsToNotify.length} tài khoản Zalo`);
          }
        } catch (zaloErr) {
          console.warn('[ZaloBot] Gửi thông báo bình luận qua Zalo thất bại:', zaloErr);
        }
      })();

      return result;
    } catch (err) {
      throw new Error(formatCommentErrorMessage(err));
    } finally {
      submittingComments.delete(lockKey);
    }
  },

  async deleteComment(commentId) {
    if (!commentId) throw new Error('Thiếu mã bình luận để xóa.');
    try {
      return await CommentRepository.deleteComment(commentId);
    } catch (err) {
      throw new Error(formatCommentErrorMessage(err));
    }
  },

  async updateComment(commentId, body) {
    if (!commentId) throw new Error('Thiếu mã bình luận để sửa.');
    try {
      return await CommentRepository.updateComment(commentId, body);
    } catch (err) {
      throw new Error(formatCommentErrorMessage(err));
    }
  }
};
