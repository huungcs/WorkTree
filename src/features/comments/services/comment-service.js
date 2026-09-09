/**
 * WorkTree X Feature: Comment Service
 * Authoritative cloud operations for task comments.
 * Handles validation, double-submit protection, and user profile display.
 */

import { CommentRepository } from '../../../lib/supabase/repositories.js';
import { appState } from '../../../app/state.js';

const submittingComments = new Set();

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
      return await CommentRepository.addComment({
        organizationId: orgId,
        taskId,
        body: trimmed
      });
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
