/**
 * WorkTree X Feature: Platform Super-Admin Service
 * Communicates with trusted /api/platform-admin endpoint using Supabase JWT.
 * Never leaks service keys or bypasses security policies on client.
 */

import { getSupabase } from '../../../lib/supabase/client.js';

export const PlatformAdminService = {
  /**
   * Lấy access token từ phiên đăng nhập hiện hành của Supabase
   */
  async getAccessToken() {
    try {
      const sb = await getSupabase();
      const { data: { session } } = await sb.auth.getSession();
      return session?.access_token || null;
    } catch (e) {
      console.warn('[PlatformAdminService] Không thể lấy token phiên:', e);
      return null;
    }
  },

  /**
   * Gửi request xác thực đến endpoint /api/platform-admin
   */
  async request(endpoint = '', options = {}) {
    const token = await this.getAccessToken();
    if (!token) {
      throw new Error('Yêu cầu đăng nhập để truy cập Platform Admin');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    };

    const url = endpoint.startsWith('http') ? endpoint : `/api/platform-admin${endpoint}`;

    const res = await fetch(url, {
      ...options,
      headers
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `Yêu cầu thất bại với mã lỗi HTTP ${res.status}`);
    }

    return data;
  },

  /**
   * Kiểm tra xem tài khoản hiện tại có quyền Super-Admin hay không
   */
  async checkIsPlatformAdmin() {
    try {
      const data = await this.request('?action=check');
      return Boolean(data.isPlatformAdmin);
    } catch (e) {
      return false;
    }
  },

  /**
   * Lấy dữ liệu KPI tổng quan nền tảng
   */
  async getOverview() {
    const data = await this.request('?action=overview');
    return data.metrics;
  },

  /**
   * Lấy danh sách doanh nghiệp (tenants)
   */
  async getOrganizations({ search = '', status = '', plan = '' } = {}) {
    const params = new URLSearchParams({ action: 'organizations' });
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    if (plan) params.append('plan', plan);

    const data = await this.request(`?${params.toString()}`);
    return data.organizations || [];
  },

  /**
   * Lấy chi tiết toàn diện của một doanh nghiệp (cho Detail Drawer)
   */
  async getTenantDetail(organizationId) {
    if (!organizationId) throw new Error('Missing organizationId');
    const data = await this.request(`?action=tenant-detail&organizationId=${encodeURIComponent(organizationId)}`);
    return data.tenant;
  },

  /**
   * Lấy danh bạ người dùng toàn hệ thống
   */
  async getUsers({ search = '', role = '', status = '' } = {}) {
    const params = new URLSearchParams({ action: 'users' });
    if (search) params.append('search', search);
    if (role) params.append('role', role);
    if (status) params.append('status', status);

    const data = await this.request(`?${params.toString()}`);
    return data.users || [];
  },

  /**
   * Tạm khóa một doanh nghiệp kèm lý do bắt buộc & lưu Security Audit Log
   */
  async suspendTenant(organizationId, reason) {
    if (!organizationId) throw new Error('Thiếu organizationId');
    if (!reason || !reason.trim()) throw new Error('Bắt buộc phải nhập lý do khóa doanh nghiệp');

    const data = await this.request('', {
      method: 'POST',
      body: JSON.stringify({
        action: 'suspend-tenant',
        organizationId,
        reason: reason.trim()
      })
    });
    return data;
  },

  /**
   * Mở khóa một doanh nghiệp đã bị tạm khóa
   */
  async unsuspendTenant(organizationId, reason = 'Phục hồi hoạt động bởi Platform Admin') {
    if (!organizationId) throw new Error('Thiếu organizationId');

    const data = await this.request('', {
      method: 'POST',
      body: JSON.stringify({
        action: 'unsuspend-tenant',
        organizationId,
        reason: String(reason).trim()
      })
    });
    return data;
  },

  /**
   * Cập nhật gói dịch vụ & giới hạn seats cho một doanh nghiệp
   */
  async updateSubscription(organizationId, { plan, seatLimit, status }) {
    const data = await this.request('', {
      method: 'POST',
      body: JSON.stringify({
        action: 'update-subscription',
        organizationId,
        plan,
        seatLimit,
        status
      })
    });
    return data;
  },

  /**
   * Lấy danh sách vi phạm / cảnh báo
   */
  async getViolations() {
    const data = await this.request('?action=violations');
    return data.violations || [];
  },

  /**
   * Lấy nhật ký audit toàn hệ thống
   */
  async getAuditLogs() {
    const data = await this.request('?action=audit-logs');
    return data.logs || [];
  },

  /**
   * Lấy danh sách Platform Super-Admins
   */
  async getPlatformAdmins() {
    const data = await this.request('?action=admins');
    return data.admins || [];
  },

  /**
   * Lấy cấu hình nền tảng
   */
  async getSettings() {
    const data = await this.request('?action=settings');
    return data.settings;
  }
};
