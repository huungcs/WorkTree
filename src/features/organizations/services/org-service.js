/**
 * WorkTree X Feature: Organization Service
 * Multi-tenant organization manager.
 * Invariant: Authoritative role strictly from organization_members, RLS enforced.
 */

import { OrganizationRepository } from '../../../lib/supabase/repositories.js';

export const ROLE_LABELS = {
  owner: 'Chủ sở hữu',
  admin: 'Quản trị viên',
  manager: 'Quản lý',
  member: 'Nhân viên',
  viewer: 'Chỉ xem'
};

export const OrgService = {
  /**
   * Lấy danh sách các organization mà user hiện tại tham gia
   */
  async listUserOrganizations() {
    const memberships = await OrganizationRepository.getUserMemberships();
    return memberships.map(m => ({
      organizationId: m.organizationId,
      name: m.organization?.name || 'Không tên',
      slug: m.organization?.slug || '',
      timezone: m.organization?.timezone || 'Asia/Ho_Chi_Minh',
      status: m.status,
      role: m.role,
      roleLabel: ROLE_LABELS[m.role] || m.role,
      employeeId: m.employeeId,
      rootNodeId: m.organization?.root_node_id
    }));
  },

  /**
   * Lấy membership và role của user trong một organization cụ thể
   */
  async getMembership(organizationId) {
    if (!organizationId) return null;
    const m = await OrganizationRepository.getMembership(organizationId);
    if (!m) return null;
    return {
      membershipId: m.id,
      organizationId: m.organization_id,
      role: m.role,
      roleLabel: ROLE_LABELS[m.role] || m.role,
      status: m.status,
      employeeId: m.employee_id
    };
  },

  /**
   * Tạo organization mới qua canonical RPC create_organization
   * RPC tự động thiết lập: organization, root company node, owner employee, owner membership.
   */
  async createNewOrganization(name, slug, timezone = 'Asia/Ho_Chi_Minh') {
    const trimmedName = (name || '').trim();
    const cleanSlug = (slug || '').trim().toLowerCase();

    // Validation
    if (trimmedName.length < 2 || trimmedName.length > 180) {
      throw new Error('Tên công ty phải từ 2 đến 180 ký tự.');
    }

    const slugRegex = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;
    if (!slugRegex.test(cleanSlug)) {
      throw new Error('Đường dẫn workspace (slug) không hợp lệ. Chỉ chấp nhận chữ thường (a-z), số (0-9) và dấu gạch nối (-), từ 3 đến 64 ký tự, không bắt đầu/kết thúc bằng dấu gạch nối.');
    }

    try {
      const orgId = await OrganizationRepository.createOrganization(trimmedName, cleanSlug, timezone);
      
      // Reload membership từ database để đảm bảo creator đã là owner
      const membership = await this.getMembership(orgId);

      return {
        organizationId: orgId,
        name: trimmedName,
        slug: cleanSlug,
        timezone,
        role: membership?.role || 'owner',
        status: membership?.status || 'active'
      };
    } catch (err) {
      const errMsg = err.message || '';
      if (errMsg.includes('23505') || errMsg.includes('duplicate key') || errMsg.includes('slug')) {
        throw new Error('Đường dẫn workspace này đã được sử dụng. Vui lòng chọn đường dẫn khác.');
      }
      if (errMsg.includes('Invalid organization name')) {
        throw new Error('Tên công ty không hợp lệ (2 - 180 ký tự).');
      }
      if (errMsg.includes('Invalid organization slug')) {
        throw new Error('Đường dẫn workspace không hợp lệ.');
      }
      if (errMsg.includes('Authentication required')) {
        throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      }
      throw err;
    }
  },

  /**
   * Tiện ích chuyển đổi chuỗi tên thành slug hợp lệ
   */
  slugify(text) {
    return (text || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }
};
