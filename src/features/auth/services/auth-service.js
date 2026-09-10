/**
 * WorkTree X Feature: Auth Service
 * Authoritative Supabase GoTrue authentication and session management.
 * Contract: Strictly uses publishable key in browser. No secret keys.
 */

import { getSupabase } from '../../../lib/supabase/client.js';

export const AuthService = {
  /**
   * Đăng ký tài khoản người dùng mới qua Supabase Auth.
   * Chú ý: Role được cấp qua organization onboarding hoặc invitation,
   * không bao giờ nhận role admin/owner từ phía browser.
   * @param {string} email
   * @param {string} password
   * @param {Object|string} metadata - { fullName } hoặc chuỗi họ tên
   */
  async signUp(email, password, metadata = {}) {
    const sb = await getSupabase();
    const fullName = typeof metadata === 'string'
      ? metadata
      : (metadata.fullName || metadata.full_name || '');

    const { data, error } = await sb.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: fullName.trim()
        }
      }
    });

    if (error) throw error;
    return data;
  },

  /**
   * Gửi lại email xác nhận đăng ký tài khoản.
   * @param {string} email
   */
  async resendConfirmationEmail(email) {
    const sb = await getSupabase();
    const { data, error } = await sb.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase()
    });
    if (error) throw error;
    return data;
  },

  /**
   * Đăng nhập bằng Email và Mật khẩu qua Supabase Auth.
   * @param {string} email
   * @param {string} password
   */
  async signIn(email, password) {
    const sb = await getSupabase();
    const { data, error } = await sb.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });

    if (error) throw error;
    return data;
  },

  /**
   * Đăng xuất phiên làm việc hiện tại và hủy session.
   */
  async signOut() {
    const sb = await getSupabase();
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  },

  /**
   * Lấy session Supabase hiện tại từ client SDK storage.
   * @returns {Promise<Object|null>} session
   */
  async getSession() {
    const sb = await getSupabase();
    const { data: { session }, error } = await sb.auth.getSession();
    if (error) throw error;
    return session;
  },

  /**
   * Lấy thông tin user hiện tại từ token xác thực.
   * @returns {Promise<Object|null>} user
   */
  async getUser() {
    const sb = await getSupabase();
    const { data: { user }, error } = await sb.auth.getUser();
    if (error) return null;
    return user;
  },

  /**
   * Alias tương thích ngược cho getUser()
   */
  async getCurrentUser() {
    return this.getUser();
  },

  /**
   * Yêu cầu gửi email liên kết khôi phục mật khẩu.
   * @param {string} email
   * @param {string} [redirectTo]
   */
  async resetPassword(email, redirectTo = null) {
    const sb = await getSupabase();
    const targetUrl = redirectTo || (
      typeof window !== 'undefined'
        ? window.location.origin + window.location.pathname
        : ''
    );

    const { data, error } = await sb.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      targetUrl ? { redirectTo: targetUrl } : undefined
    );

    if (error) throw error;
    return data;
  },

  /**
   * Cập nhật mật khẩu mới cho user đang đăng nhập / trong flow password recovery.
   * @param {string} newPassword
   */
  async updatePassword(newPassword) {
    const sb = await getSupabase();
    const { data, error } = await sb.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;
    return data;
  },

  /**
   * Đăng ký lắng nghe sự kiện thay đổi trạng thái xác thực.
   * Các sự kiện: SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED, PASSWORD_RECOVERY
   * @param {Function} callback (event, session)
   * @returns {Promise<{ data: { subscription: Object } }>}
   */
  async onAuthStateChange(callback) {
    const sb = await getSupabase();
    return sb.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  },

  /**
   * Tải hồ sơ người dùng từ bảng public.profiles theo auth.uid().
   * Tuân thủ RLS policy: profiles_select_own.
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  async getProfile(userId) {
    if (!userId) return null;
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('profiles')
      .select('id, display_name, avatar_path, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Lỗi khi tải profile từ Supabase:', error.message);
      return null;
    }
    return data ? { ...data, avatar_url: data.avatar_path } : null;
  },

  /**
   * Tải danh sách các tổ chức (organizations) mà người dùng hiện tại là thành viên.
   * Tuân thủ RLS: members_select_self_or_admin.
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async getUserOrganizations(userId) {
    if (!userId) return [];
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('organization_members')
      .select(`
        organization_id,
        role,
        employee_id,
        status,
        organizations (
          id,
          name,
          slug,
          timezone,
          status,
          root_node_id
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) {
      console.warn('Lỗi khi tải memberships từ Supabase:', error.message);
      return [];
    }

    return (data || []).map(m => ({
      membershipId: `${m.organization_id}_${userId}`,
      organizationId: m.organization_id,
      role: m.role,
      employeeId: m.employee_id,
      organization: m.organizations
    }));
  },

  /**
   * Định dạng lỗi Supabase Auth sang tiếng Việt thân thiện,
   * tránh làm lộ thông tin nhạy cảm nội bộ hệ thống.
   * @param {Error|Object} error
   * @returns {string}
   */
  formatAuthError(error) {
    if (!error) return 'Đã xảy ra lỗi. Vui lòng thử lại.';
    const msg = (error.message || '').toLowerCase();

    if (msg.includes('invalid login credentials') || msg.includes('invalid_grant')) {
      return 'Email hoặc mật khẩu không chính xác.';
    }
    if (msg.includes('email not confirmed')) {
      return 'Email chưa được xác nhận. Vui lòng kiểm tra hộp thư đến của bạn.';
    }
    if (msg.includes('user already registered') || msg.includes('already registered')) {
      return 'Email này đã được đăng ký. Vui lòng chọn "Đăng nhập" hoặc sử dụng email khác.';
    }
    if (msg.includes('password should be at least')) {
      return 'Mật khẩu cần tối thiểu 6 ký tự.';
    }
    if (msg.includes('rate limit') || msg.includes('too many requests')) {
      return 'Quá nhiều yêu cầu trong thời gian ngắn. Vui lòng thử lại sau ít phút.';
    }
    if (msg.includes('network') || msg.includes('failed to fetch')) {
      return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.';
    }
    if (msg.includes('session expired') || msg.includes('jwt expired')) {
      return 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.';
    }

    return error.message || 'Thao tác xác thực không thành công. Vui lòng thử lại.';
  }
};
