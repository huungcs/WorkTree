/**
 * WorkTree X Feature: Employee Service
 * Handles employee directory queries, creation, and invitation orchestration.
 */

import { EmployeeRepository, InvitationRepository, OrganizationRepository } from '../../../lib/supabase/repositories.js';

export const EmployeeService = {
  async loadEmployees(organizationId) {
    return await EmployeeRepository.getEmployees(organizationId);
  },

  async loadEmployeesWithAccountStatus(organizationId) {
    return await EmployeeRepository.getEmployeesWithAccountStatus(organizationId);
  },

  /**
   * Canonical flow to create an employee, with optional WorkTree user invitation.
   * If invite is false, strictly creates Employee row in public.employees.
   * If invite is true, creates Employee row first, then calls create_invitation RPC with employeeId.
   */
  async createEmployee({
    organizationId,
    fullName,
    email = null,
    employeeCode = null,
    jobTitle = null,
    homeNodeId = null,
    invite = false,
    role = 'member',
    scopeNodeIds = []
  }) {
    if (!organizationId) throw new Error('Missing active organizationId');
    if (!fullName || !fullName.trim()) throw new Error('Họ và tên nhân viên là bắt buộc');
    if (!homeNodeId) throw new Error('Phòng ban trực thuộc là bắt buộc');

    const cleanEmail = email && email.trim() ? email.trim().toLowerCase() : null;
    if (invite) {
      if (!cleanEmail) throw new Error('Email đăng nhập là bắt buộc khi mời sử dụng WorkTree');
      const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
      if (!emailRegex.test(cleanEmail)) throw new Error('Định dạng email không hợp lệ');
      if (role === 'owner') throw new Error('Vai trò Chủ sở hữu không thể cấp từ form thêm nhân viên');
      if (!['admin', 'manager', 'member', 'viewer'].includes(role)) {
        throw new Error('Vai trò không hợp lệ');
      }
    }

    // 1. Insert public.employees
    const employee = await EmployeeRepository.createEmployee({
      organizationId,
      fullName: fullName.trim(),
      email: cleanEmail,
      employeeCode: employeeCode && employeeCode.trim() ? employeeCode.trim() : null,
      jobTitle: jobTitle && jobTitle.trim() ? jobTitle.trim() : null,
      homeNodeId
    });

    let token = null;
    let invitationError = null;

    // 2. If invitation requested, dispatch invitation linked directly to employee.id
    if (invite) {
      try {
        const scopes = role === 'admin' ? [] : (Array.isArray(scopeNodeIds) && scopeNodeIds.length ? scopeNodeIds : [homeNodeId]);
        token = await InvitationRepository.createInvitation({
          organizationId,
          email: cleanEmail,
          fullName: employee.full_name,
          homeNodeId,
          role,
          scopeNodeIds: scopes,
          employeeId: employee.id
        });
      } catch (err) {
        // Error atomicity: employee row is retained; report partial success
        console.error('Lỗi khi gửi lời mời cho nhân viên mới:', err);
        invitationError = err.message || 'Lỗi gửi lời mời';
      }
    }

    return {
      employee,
      token,
      invitationError
    };
  },

  /**
   * Invite an existing employee who has no active membership yet.
   */
  async inviteExistingEmployee({
    organizationId,
    employeeId,
    email,
    fullName,
    homeNodeId,
    role = 'member',
    scopeNodeIds = []
  }) {
    if (!organizationId) throw new Error('Missing active organizationId');
    if (!employeeId) throw new Error('Missing employeeId');
    if (!email || !email.trim()) throw new Error('Email đăng nhập là bắt buộc');
    if (role === 'owner') throw new Error('Vai trò Chủ sở hữu không thể cấp từ form mời');

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!emailRegex.test(cleanEmail)) throw new Error('Định dạng email không hợp lệ');

    const scopes = role === 'admin' ? [] : (Array.isArray(scopeNodeIds) && scopeNodeIds.length ? scopeNodeIds : (homeNodeId ? [homeNodeId] : []));

    const token = await InvitationRepository.createInvitation({
      organizationId,
      email: cleanEmail,
      fullName: fullName || '',
      homeNodeId,
      role,
      scopeNodeIds: scopes,
      employeeId
    });

    return token;
  },

  /**
   * Suspend an employee account and personnel status.
   */
  async suspendAccount({ organizationId, employeeId, membershipId }) {
    if (!organizationId) throw new Error('Missing organizationId');
    if (membershipId) {
      await OrganizationRepository.setMemberStatus(membershipId, 'suspended');
    }
    if (employeeId) {
      await EmployeeRepository.updateEmployee(employeeId, { employment_status: 'suspended' });
    }
    return true;
  },

  /**
   * Reactivate a suspended employee account.
   */
  async reactivateAccount({ organizationId, employeeId, membershipId }) {
    if (!organizationId) throw new Error('Missing organizationId');
    if (membershipId) {
      await OrganizationRepository.setMemberStatus(membershipId, 'active');
    }
    if (employeeId) {
      await EmployeeRepository.updateEmployee(employeeId, { employment_status: 'active' });
    }
    return true;
  },

  /**
   * Revoke a pending invitation.
   */
  async revokeInvitation({ organizationId, employeeId, invitationId }) {
    if (!organizationId) throw new Error('Missing organizationId');
    if (invitationId) {
      await InvitationRepository.revokeInvitation(invitationId);
    } else if (employeeId) {
      await InvitationRepository.revokeEmployeeInvitation(organizationId, employeeId);
    }
    return true;
  }
};
