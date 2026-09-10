/**
 * WorkTree X Feature: Notification Service
 * Handles Cloud Notification Center queries, mark-as-read, preferences, and manual reminders.
 */

import { getSupabase } from '../../../lib/supabase/client.js';

export const NotificationService = {
  /**
   * Lấy danh sách thông báo của người dùng hiện tại trong tổ chức (hoặc toàn bộ).
   * RLS: Chỉ đọc được bản ghi có user_id = auth.uid() và thuộc tổ chức mà user là thành viên.
   */
  async getNotifications(orgId = null, { limit = 30, unreadOnly = false } = {}) {
    const sb = await getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return [];

    let query = sb
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (orgId) {
      query = query.eq('organization_id', orgId);
    }
    if (unreadOnly) {
      query = query.is('read_at', null);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Đếm số lượng thông báo chưa đọc.
   */
  async getUnreadCount(orgId = null) {
    const sb = await getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return 0;

    let query = sb
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null);

    if (orgId) {
      query = query.eq('organization_id', orgId);
    }

    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  },

  /**
   * Đánh dấu 1 thông báo là đã đọc.
   */
  async markAsRead(notificationId) {
    if (!notificationId) return null;
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('notifications')
      .update({
        read_at: new Date().toISOString(),
        status: 'read'
      })
      .eq('id', notificationId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Đánh dấu toàn bộ thông báo của tổ chức hiện tại là đã đọc.
   */
  async markAllAsRead(orgId = null) {
    const sb = await getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    let query = sb
      .from('notifications')
      .update({
        read_at: new Date().toISOString(),
        status: 'read'
      })
      .eq('user_id', user.id)
      .is('read_at', null);

    if (orgId) {
      query = query.eq('organization_id', orgId);
    }

    const { error } = await query;
    if (error) throw error;
  },

  /**
   * Xóa một thông báo cá nhân.
   */
  async deleteNotification(notificationId) {
    if (!notificationId) return;
    const sb = await getSupabase();
    const { error } = await sb
      .from('notifications')
      .delete()
      .eq('id', notificationId);
    if (error) throw error;
  },

  /**
   * Lấy cấu hình thông báo cá nhân (notification_preferences).
   */
  async getPreferences() {
    const sb = await getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;

    const { data, error } = await sb
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    return data || {
      user_id: user.id,
      in_app_enabled: true,
      push_enabled: true,
      email_enabled: false,
      notify_on_assignment: true,
      notify_on_comment: true,
      notify_on_due_soon: true,
      notify_on_overdue: true,
      notify_on_mention: true,
      quiet_hours_enabled: false,
      quiet_hours_start: 22,
      quiet_hours_end: 7,
      timezone: 'Asia/Ho_Chi_Minh'
    };
  },

  /**
   * Cập nhật cấu hình thông báo cá nhân.
   */
  async updatePreferences(updates = {}) {
    const sb = await getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) throw new Error('User must be logged in to update preferences');

    const payload = {
      user_id: user.id,
      ...updates,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await sb
      .from('notification_preferences')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Tạo lịch nhắc việc thủ công (scheduled reminder).
   * Tự động kích hoạt trigger enqueue_manual_reminder() vào hàng đợi notification_jobs.
   */
  async createManualReminder(orgId, { recipientUserId, title, scheduledFor, taskId = null, metadata = {} } = {}) {
    if (!orgId || !recipientUserId || !title || !scheduledFor) {
      throw new Error('Missing required fields for manual reminder');
    }

    const sb = await getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) throw new Error('Must be logged in');

    const { data, error } = await sb
      .from('manual_reminders')
      .insert({
        organization_id: orgId,
        creator_user_id: user.id,
        recipient_user_id: recipientUserId,
        task_id: taskId,
        title: title.trim(),
        scheduled_for: new Date(scheduledFor).toISOString(),
        metadata
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Hủy một nhắc việc thủ công chưa gửi.
   */
  async cancelManualReminder(reminderId) {
    if (!reminderId) return;
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('manual_reminders')
      .update({ status: 'cancelled' })
      .eq('id', reminderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
