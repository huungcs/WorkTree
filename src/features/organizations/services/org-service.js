/**
 * WorkTree X Feature: Organization Service
 * Multi-tenant organization manager.
 * Invariant: Authoritative role strictly from organization_members, RLS enforced.
 */

import { OrganizationRepository } from '../../../lib/supabase/repositories.js';

function generateSlugSuffix() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return suffix;
}

function isDuplicateSlugError(err) {
  const errMsg = (err?.message || '').toLowerCase();
  if (errMsg.includes('invalid organization slug') || errMsg.includes('invalid organization name')) {
    return false;
  }
  return err?.code === '23505'
    || errMsg.includes('23505')
    || errMsg.includes('duplicate key')
    || errMsg.includes('organizations_slug_key')
    || errMsg.includes('already exists')
    || errMsg.includes('đã được sử dụng')
    || errMsg.includes('đã tồn tại');
}

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
      membershipId: m.membershipId,
      organizationId: m.organizationId,
      name: m.organization?.name || 'Không tên',
      slug: m.organization?.slug || '',
      timezone: m.organization?.timezone || 'Asia/Ho_Chi_Minh',
      status: m.status,
      role: m.role,
      roleLabel: ROLE_LABELS[m.role] || m.role,
      employeeId: m.employeeId,
      rootNodeId: m.organization?.root_node_id,
      scopes: m.scopes || []
    }));
  },

  /**
   * Lấy membership và role của user trong một organization cụ thể
   */
  async getMembership(organizationId, repository = OrganizationRepository) {
    if (!organizationId || !repository?.getMembership) return null;
    const m = await repository.getMembership(organizationId);
    if (!m) return null;
    return {
      membershipId: m.id || m.membershipId,
      organizationId: m.organization_id || m.organizationId,
      role: m.role,
      roleLabel: ROLE_LABELS[m.role] || m.role,
      status: m.status,
      employeeId: m.employee_id || m.employeeId,
      scopes: m.scopes || []
    };
  },

  /**
   * Tạo organization mới qua canonical RPC create_organization
   * RPC tự động thiết lập: organization, root company node, owner employee, owner membership.
   */
  async createNewOrganization(name, slug, timezone = 'Asia/Ho_Chi_Minh', options = {}) {
    const { autoResolveSlugCollision = false, repository = OrganizationRepository } = options || {};
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

    const maxRetries = autoResolveSlugCollision ? 3 : 0;
    const baseSlug = cleanSlug.replace(/-+$/g, '').slice(0, 55);
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const candidateSlug = attempt === 0 ? cleanSlug : `${baseSlug}-${generateSlugSuffix()}`;
      try {
        const orgId = await repository.createOrganization(trimmedName, candidateSlug, timezone);

        // Reload membership từ database để đảm bảo creator đã là owner
        const membership = await this.getMembership(orgId, repository);

        return {
          organizationId: orgId,
          name: trimmedName,
          slug: candidateSlug,
          timezone,
          role: membership?.role || 'owner',
          status: membership?.status || 'active'
        };
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries && isDuplicateSlugError(err)) {
          continue;
        }
        const errMsg = err?.message || '';
        if (errMsg.includes('Invalid organization name')) {
          throw new Error('Tên công ty không hợp lệ (2 - 180 ký tự).');
        }
        if (errMsg.includes('Invalid organization slug')) {
          throw new Error('Đường dẫn workspace không hợp lệ.');
        }
        if (errMsg.includes('Authentication required')) {
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        if (isDuplicateSlugError(err) || errMsg.includes('slug')) {
          throw new Error('Đường dẫn workspace này đã được sử dụng. Vui lòng chọn đường dẫn khác.');
        }
        throw err;
      }
    }

    throw lastError || new Error('Đường dẫn workspace này đã được sử dụng. Vui lòng chọn đường dẫn khác.');
  },

  /**
   * Tiện ích chuyển đổi chuỗi tên thành slug hợp lệ
   */
  slugify(text) {
    const cleaned = (text || '')
      .toString()
      .replace(/[đĐ]/g, 'd')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/g, '');

    if (!cleaned) return '';
    if (cleaned.length < 3) {
      return `${cleaned}-org`;
    }
    return cleaned;
  }
};
