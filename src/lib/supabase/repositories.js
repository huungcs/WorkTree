/**
 * WorkTree X — Multi-Tenant Supabase Repositories
 * Adheres strictly to the database schema in 20260909000000_worktree_multi_tenant_complete.sql.
 * Invariants: Multi-tenant organization_id scoping, RLS compliance, canonical column names.
 */

import { getSupabase } from './client.js';

// ============================================================================
// ENUM & LABEL MAPPINGS (Database English <-> UI Tiếng Việt)
// ============================================================================

export const STATUS_MAP = {
  dbToUi: {
    todo: 'Chưa làm',
    in_progress: 'Đang làm',
    review: 'Chờ duyệt',
    done: 'Hoàn thành'
  },
  uiToDb: {
    'Chưa làm': 'todo',
    'Đang làm': 'in_progress',
    'Chờ duyệt': 'review',
    'Hoàn thành': 'done'
  }
};

export const PRIORITY_MAP = {
  dbToUi: {
    urgent: 'Khẩn cấp',
    high: 'Cao',
    medium: 'Trung bình',
    low: 'Thấp'
  },
  uiToDb: {
    'Khẩn cấp': 'urgent',
    'Cao': 'high',
    'Trung bình': 'medium',
    'Thấp': 'low'
  }
};

export const ROLE_MAP = {
  dbToUi: {
    owner: 'Chủ sở hữu',
    admin: 'Quản trị viên',
    manager: 'Quản lý',
    member: 'Nhân viên',
    viewer: 'Chỉ xem'
  },
  uiToDb: {
    'Chủ sở hữu': 'owner',
    'Quản trị viên': 'admin',
    'Quản lý': 'manager',
    'Nhân viên': 'member',
    'Chỉ xem': 'viewer'
  }
};

export const NODE_TYPE_MAP = {
  dbToUi: {
    company: 'Công ty',
    department: 'Phòng ban',
    project: 'Dự án',
    team: 'Nhóm',
    folder: 'Thư mục'
  },
  uiToDb: {
    'Công ty': 'company',
    'Phòng ban': 'department',
    'Dự án': 'project',
    'Nhóm': 'team',
    'Thư mục': 'folder'
  }
};

// ============================================================================
// 1. ORGANIZATION REPOSITORY (Table: public.organizations)
// ============================================================================

export const OrganizationRepository = {
  async getOrganizations() {
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('organizations')
      .select('id, name, slug, timezone, status, root_node_id, created_at, updated_at')
      .order('name');
    if (error) throw error;
    return data || [];
  },

  async getOrganizationById(organizationId) {
    if (!organizationId) return null;
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async createOrganization(name, slug, timezone = 'Asia/Ho_Chi_Minh') {
    const sb = await getSupabase();
    const { data, error } = await sb.rpc('create_organization', {
      p_name: name,
      p_slug: slug,
      p_timezone: timezone
    });
    if (error) throw error;
    return data;
  },

  async getUserMemberships() {
    const sb = await getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return [];
    const { data, error } = await sb
      .from('organization_members')
      .select(`
        id,
        role,
        status,
        employee_id,
        organization_id,
        organizations (
          id,
          name,
          slug,
          timezone,
          status,
          root_node_id
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'active');
    if (error) throw error;
    return (data || []).map(m => ({
      membershipId: m.id,
      role: m.role,
      status: m.status,
      employeeId: m.employee_id,
      organizationId: m.organization_id,
      organization: m.organizations
    }));
  },

  async getMembership(organizationId) {
    if (!organizationId) return null;
    const sb = await getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;
    const { data, error } = await sb
      .from('organization_members')
      .select('id, role, status, employee_id, organization_id')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (error) throw error;
    return data;
  }
};

// ============================================================================
// 2. NODE REPOSITORY (Table: public.organization_nodes)
// Schema: id, organization_id, parent_id, type, name, description,
//         capacity_hours_week, sort_order, archived_at, created_at, updated_at
// ============================================================================

export const NodeRepository = {
  async getNodes(organizationId) {
    if (!organizationId) return [];
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('organization_nodes')
      .select('id, organization_id, parent_id, type, name, description, capacity_hours_week, sort_order, created_at, updated_at')
      .eq('organization_id', organizationId)
      .is('archived_at', null)
      .order('sort_order', { ascending: true });
    if (error) throw error;

    // Explicit domain mapping: Expose canonical 'type' plus backwards-compatible 'node_type'
    return (data || []).map(n => ({
      ...n,
      node_type: n.type,
      uiType: NODE_TYPE_MAP.dbToUi[n.type] || n.type
    }));
  },

  async createNode({
    organizationId,
    parentId = null,
    name,
    type = 'folder',
    nodeType = null,
    description = '',
    capacityHoursWeek = 40,
    sortOrder = 0
  }) {
    const sb = await getSupabase();
    const resolvedType = type || nodeType || 'folder';
    if (resolvedType === 'company') {
      throw new Error('Không thể tạo thêm đơn vị cấp công ty gốc.');
    }
    if (resolvedType === 'person') {
      throw new Error('Nhân sự không thuộc cây tổ chức (Invariant B). Hãy thêm vào bảng nhân sự.');
    }

    const { data, error } = await sb
      .from('organization_nodes')
      .insert({
        organization_id: organizationId,
        parent_id: parentId,
        type: resolvedType,
        name,
        description,
        capacity_hours_week: capacityHoursWeek,
        sort_order: sortOrder
      })
      .select()
      .single();

    if (error) throw error;
    return {
      ...data,
      node_type: data.type,
      uiType: NODE_TYPE_MAP.dbToUi[data.type] || data.type
    };
  },

  async updateNode(nodeId, updates = {}) {
    if (!nodeId) throw new Error('Missing nodeId for updateNode');
    const sb = await getSupabase();

    const payload = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.type !== undefined || updates.node_type !== undefined) {
      const resolvedType = updates.type || updates.node_type;
      if (resolvedType === 'person') {
        throw new Error('Nhân sự không thuộc cây tổ chức (Invariant B).');
      }
      payload.type = resolvedType;
    }
    if (updates.sort_order !== undefined || updates.sortOrder !== undefined) {
      payload.sort_order = updates.sort_order ?? updates.sortOrder;
    }
    if (updates.capacity_hours_week !== undefined || updates.capacityHoursWeek !== undefined) {
      payload.capacity_hours_week = updates.capacity_hours_week ?? updates.capacityHoursWeek;
    }
    if (updates.parent_id !== undefined) payload.parent_id = updates.parent_id;

    const { data, error } = await sb
      .from('organization_nodes')
      .update(payload)
      .eq('id', nodeId)
      .select()
      .single();

    if (error) throw error;
    return {
      ...data,
      node_type: data.type,
      uiType: NODE_TYPE_MAP.dbToUi[data.type] || data.type
    };
  },

  async archiveNode(nodeId) {
    if (!nodeId) throw new Error('Missing nodeId for archiveNode');
    const sb = await getSupabase();

    // Invariant: cannot archive root node
    const { data: existing, error: fetchErr } = await sb
      .from('organization_nodes')
      .select('parent_id')
      .eq('id', nodeId)
      .single();
    if (fetchErr) throw fetchErr;
    if (!existing || existing.parent_id === null) {
      throw new Error('Không thể lưu trữ hoặc xóa đơn vị công ty gốc.');
    }

    const { data, error } = await sb
      .from('organization_nodes')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', nodeId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============================================================================
// 3. EMPLOYEE REPOSITORY (Table: public.employees)
// Schema: id, organization_id, full_name, email, employee_code, job_title,
//         home_node_id, employment_status, created_by, created_at, updated_at
// ============================================================================

export const EmployeeRepository = {
  async getEmployees(organizationId) {
    if (!organizationId) return [];
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('employees')
      .select('id, organization_id, full_name, email, employee_code, job_title, home_node_id, employment_status, created_at, updated_at')
      .eq('organization_id', organizationId)
      .eq('employment_status', 'active')
      .order('full_name');
    if (error) throw error;

    // Explicit domain mapping: expose canonical fields and legacy aliases
    return (data || []).map(emp => ({
      ...emp,
      name: emp.full_name,
      department_id: emp.home_node_id,
      is_active: emp.employment_status === 'active'
    }));
  },

  async getEmployeesWithAccountStatus(organizationId) {
    if (!organizationId) return [];
    const sb = await getSupabase();

    // 1. Fetch employees
    const employeesPromise = this.getEmployees(organizationId);

    // 2. Fetch active members
    const membersPromise = sb
      .from('organization_members')
      .select('id, user_id, employee_id, role, status')
      .eq('organization_id', organizationId)
      .eq('status', 'active');

    // 3. Fetch pending invitations
    const invitationsPromise = sb
      .from('invitations')
      .select('id, email, employee_id, role, status, expires_at')
      .eq('organization_id', organizationId)
      .eq('status', 'pending');

    const [employees, { data: members, error: memErr }, { data: invitations, error: invErr }] = await Promise.all([
      employeesPromise,
      membersPromise,
      invitationsPromise
    ]);

    if (memErr) console.warn('Could not fetch members for account status:', memErr);
    if (invErr) console.warn('Could not fetch invitations for account status:', invErr);

    const membersByEmployeeId = new Map();
    (members || []).forEach(m => {
      if (m.employee_id) membersByEmployeeId.set(m.employee_id, m);
    });

    const invitationsByEmployeeId = new Map();
    const invitationsByEmail = new Map();
    (invitations || []).forEach(inv => {
      if (inv.employee_id) invitationsByEmployeeId.set(inv.employee_id, inv);
      if (inv.email) invitationsByEmail.set(inv.email.toLowerCase(), inv);
    });

    return employees.map(emp => {
      const member = membersByEmployeeId.get(emp.id);
      const invitation = invitationsByEmployeeId.get(emp.id) || (emp.email ? invitationsByEmail.get(emp.email.toLowerCase()) : null);

      let accountStatus = 'uninvited';
      let role = null;
      let accountEmail = emp.email || null;

      if (member) {
        accountStatus = 'linked';
        role = member.role;
      } else if (invitation) {
        accountStatus = 'pending';
        role = invitation.role;
        accountEmail = invitation.email || accountEmail;
      }

      return {
        ...emp,
        accountStatus,
        role: role || 'member',
        accountEmail,
        membership: member || null,
        invitation: invitation || null
      };
    });
  },

  async createEmployee({
    organizationId,
    fullName,
    email = null,
    employeeCode = null,
    jobTitle = null,
    homeNodeId = null
  }) {
    if (!organizationId) throw new Error('Missing organizationId for createEmployee');
    if (!fullName || !fullName.trim()) throw new Error('Họ và tên nhân viên là bắt buộc');
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('employees')
      .insert({
        organization_id: organizationId,
        full_name: fullName.trim(),
        email: email && email.trim() ? email.trim().toLowerCase() : null,
        employee_code: employeeCode && employeeCode.trim() ? employeeCode.trim() : null,
        job_title: jobTitle && jobTitle.trim() ? jobTitle.trim() : null,
        home_node_id: homeNodeId,
        employment_status: 'active'
      })
      .select()
      .single();
    if (error) throw error;
    return {
      ...data,
      name: data.full_name,
      department_id: data.home_node_id,
      is_active: data.employment_status === 'active'
    };
  },

  async updateEmployee(employeeId, updates = {}) {
    if (!employeeId) throw new Error('Missing employeeId for updateEmployee');
    const sb = await getSupabase();

    const payload = {};
    if (updates.full_name !== undefined) payload.full_name = updates.full_name;
    if (updates.email !== undefined) payload.email = updates.email ? updates.email.toLowerCase() : null;
    if (updates.employee_code !== undefined) payload.employee_code = updates.employee_code;
    if (updates.job_title !== undefined) payload.job_title = updates.job_title;
    if (updates.home_node_id !== undefined || updates.department_id !== undefined) {
      payload.home_node_id = updates.home_node_id ?? updates.department_id;
    }
    if (updates.employment_status !== undefined) payload.employment_status = updates.employment_status;

    const { data, error } = await sb
      .from('employees')
      .update(payload)
      .eq('id', employeeId)
      .select()
      .single();
    if (error) throw error;
    return {
      ...data,
      name: data.full_name,
      department_id: data.home_node_id,
      is_active: data.employment_status === 'active'
    };
  }
};

// ============================================================================
// 3b. INVITATION REPOSITORY (Table: public.invitations / RPC: create_invitation, accept_invitation)
// Schema: id, organization_id, email, employee_id, role, scope_node_ids,
//         token_hash, status, invited_by, accepted_by, expires_at, accepted_at, created_at
// ============================================================================

export const InvitationRepository = {
  async getInvitations(organizationId) {
    if (!organizationId) return [];
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('invitations')
      .select('id, organization_id, email, employee_id, role, scope_node_ids, status, expires_at, created_at')
      .eq('organization_id', organizationId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createInvitation({
    organizationId,
    email,
    fullName,
    homeNodeId,
    role = 'member',
    scopeNodeIds = [],
    employeeId = null
  }) {
    if (!organizationId) throw new Error('Missing organizationId for createInvitation');
    if (!email || !email.trim()) throw new Error('Email đăng nhập là bắt buộc');
    if (!homeNodeId) throw new Error('Phòng ban trực thuộc là bắt buộc');
    if (role === 'owner') throw new Error('Vai trò Chủ sở hữu không thể cấp từ lời mời');

    const sb = await getSupabase();
    const { data, error } = await sb.rpc('create_invitation', {
      p_organization_id: organizationId,
      p_email: email.trim().toLowerCase(),
      p_full_name: fullName || '',
      p_home_node_id: homeNodeId,
      p_role: role,
      p_scope_node_ids: scopeNodeIds || [],
      p_employee_id: employeeId || null
    });
    if (error) throw error;
    return data; // returns invite token
  },

  async acceptInvitation(token) {
    if (!token) throw new Error('Missing invitation token');
    const sb = await getSupabase();
    const { data, error } = await sb.rpc('accept_invitation', {
      p_token: token
    });
    if (error) throw error;
    return data; // returns organization_id
  }
};

// ============================================================================
// 4. TASK REPOSITORY (Table: public.tasks & View: public.task_rollups)
// Schema: id, organization_id, node_id, primary_assignee_id, title, description,
//         status, priority, start_date, due_date, estimate_minutes, progress,
//         auto_progress, tags, completed_at, archived_at, created_by, created_at, updated_at
// ============================================================================

export const TaskRepository = {
  async getTasks(organizationId, {
    nodeId = null,
    status = null,
    search = '',
    primaryAssigneeId = null,
    assigneeId = null
  } = {}) {
    if (!organizationId) return [];
    const sb = await getSupabase();
    let query = sb
      .from('task_rollups')
      .select('*')
      .eq('organization_id', organizationId)
      .is('archived_at', null);

    if (nodeId) {
      query = query.eq('node_id', nodeId);
    }
    if (status) {
      const dbStatus = STATUS_MAP.uiToDb[status] || status;
      query = query.eq('status', dbStatus);
    }
    const targetAssigneeId = primaryAssigneeId || assigneeId;
    if (targetAssigneeId) {
      query = query.eq('primary_assignee_id', targetAssigneeId);
    }
    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    // Explicit domain mapping
    return (data || []).map(t => ({
      ...t,
      assignee_id: t.primary_assignee_id,
      assigneeId: t.primary_assignee_id,
      dueDate: t.due_date,
      startDate: t.start_date,
      estimateMinutes: t.estimate_minutes,
      actualMinutes: t.actual_minutes,
      uiStatus: STATUS_MAP.dbToUi[t.status] || t.status,
      uiPriority: PRIORITY_MAP.dbToUi[t.priority] || t.priority
    }));
  },

  async createTask({
    organizationId,
    nodeId,
    title,
    description = '',
    priority = 'medium',
    primaryAssigneeId = null,
    assigneeId = null,
    dueDate = null,
    startDate = null,
    estimateMinutes = 0,
    tags = []
  }) {
    const sb = await getSupabase();
    const dbPriority = PRIORITY_MAP.uiToDb[priority] || priority;
    const resolvedAssigneeId = primaryAssigneeId || assigneeId || null;

    const { data, error } = await sb
      .from('tasks')
      .insert({
        organization_id: organizationId,
        node_id: nodeId,
        title,
        description,
        priority: dbPriority,
        primary_assignee_id: resolvedAssigneeId,
        due_date: dueDate,
        start_date: startDate,
        estimate_minutes: estimateMinutes,
        tags: tags || [],
        status: 'todo'
      })
      .select()
      .single();

    if (error) throw error;
    return {
      ...data,
      assignee_id: data.primary_assignee_id,
      assigneeId: data.primary_assignee_id,
      dueDate: data.due_date,
      startDate: data.start_date,
      uiStatus: STATUS_MAP.dbToUi[data.status] || data.status,
      uiPriority: PRIORITY_MAP.dbToUi[data.priority] || data.priority
    };
  },

  async getTaskById(taskId) {
    if (!taskId) return null;
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('task_rollups')
      .select('*')
      .eq('id', taskId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      ...data,
      assignee_id: data.primary_assignee_id,
      assigneeId: data.primary_assignee_id,
      dueDate: data.due_date,
      startDate: data.start_date,
      estimateMinutes: data.estimate_minutes,
      actualMinutes: data.actual_minutes,
      uiStatus: STATUS_MAP.dbToUi[data.status] || data.status,
      uiPriority: PRIORITY_MAP.dbToUi[data.priority] || data.priority
    };
  },

  async updateTask(taskId, updates = {}, expectedUpdatedAt = null) {
    if (!taskId) throw new Error('Missing taskId for updateTask');
    const sb = await getSupabase();

    const payload = {};
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.status !== undefined) {
      const dbStatus = STATUS_MAP.uiToDb[updates.status] || updates.status;
      payload.status = dbStatus;
      if (dbStatus === 'done') {
        payload.completed_at = new Date().toISOString();
      } else {
        payload.completed_at = null;
      }
    }
    if (updates.priority !== undefined) {
      payload.priority = PRIORITY_MAP.uiToDb[updates.priority] || updates.priority;
    }
    if (updates.primary_assignee_id !== undefined || updates.primaryAssigneeId !== undefined || updates.assigneeId !== undefined || updates.assignee_id !== undefined) {
      payload.primary_assignee_id = updates.primary_assignee_id ?? updates.primaryAssigneeId ?? updates.assigneeId ?? updates.assignee_id;
    }
    if (updates.due_date !== undefined || updates.dueDate !== undefined) {
      payload.due_date = updates.due_date ?? updates.dueDate;
    }
    if (updates.start_date !== undefined || updates.startDate !== undefined) {
      payload.start_date = updates.start_date ?? updates.startDate;
    }
    if (updates.progress !== undefined) payload.progress = updates.progress;
    if (updates.estimate_minutes !== undefined || updates.estimateMinutes !== undefined) {
      payload.estimate_minutes = updates.estimate_minutes ?? updates.estimateMinutes;
    }
    if (updates.tags !== undefined) payload.tags = updates.tags;
    if (updates.node_id !== undefined || updates.nodeId !== undefined) {
      payload.node_id = updates.node_id ?? updates.nodeId;
    }
    if (updates.archived_at !== undefined) payload.archived_at = updates.archived_at;

    let query = sb.from('tasks').update(payload).eq('id', taskId);
    if (expectedUpdatedAt) {
      query = query.eq('updated_at', expectedUpdatedAt);
    }
    const { data, error } = await query.select().maybeSingle();

    if (error) throw error;
    if (expectedUpdatedAt && !data) {
      const conflictErr = new Error('Dữ liệu đã được thay đổi ở nơi khác. Đã tải lại phiên bản mới nhất.');
      conflictErr.code = 'CONCURRENCY_CONFLICT';
      throw conflictErr;
    }

    return {
      ...data,
      assignee_id: data?.primary_assignee_id,
      assigneeId: data?.primary_assignee_id,
      dueDate: data?.due_date,
      startDate: data?.start_date,
      uiStatus: STATUS_MAP.dbToUi[data?.status] || data?.status,
      uiPriority: PRIORITY_MAP.dbToUi[data?.priority] || data?.priority
    };
  },

  async updateTaskStatus(taskId, status) {
    if (!taskId) throw new Error('Missing taskId for updateTaskStatus');
    const sb = await getSupabase();
    const dbStatus = STATUS_MAP.uiToDb[status] || status;
    const completedAt = dbStatus === 'done' ? new Date().toISOString() : null;

    const { data, error } = await sb
      .from('tasks')
      .update({
        status: dbStatus,
        completed_at: completedAt
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;
    return {
      ...data,
      assignee_id: data.primary_assignee_id,
      assigneeId: data.primary_assignee_id,
      uiStatus: STATUS_MAP.dbToUi[data.status] || data.status,
      uiPriority: PRIORITY_MAP.dbToUi[data.priority] || data.priority
    };
  },

  async archiveTask(taskId) {
    if (!taskId) throw new Error('Missing taskId for archiveTask');
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('tasks')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

// ============================================================================
// 5. USER PINS REPOSITORY (Table: public.user_pins)
// Schema: id, organization_id, user_id, node_id, task_id, position, is_urgent,
//         created_at, updated_at
// Constraint: user_pins_exactly_one_target check ((node_id is null) <> (task_id is null))
// ============================================================================
// 5. USER PINS REPOSITORY (Table: public.user_pins)
// Schema: id, organization_id, user_id, node_id, task_id, position, is_urgent,
//         created_at, updated_at
// Constraint: user_pins_exactly_one_target check ((node_id is null) <> (task_id is null))
// ============================================================================

export const PinRepository = {
  async getUserPins(organizationId) {
    if (!organizationId) return [];
    const sb = await getSupabase();
    const { data: userRes } = await sb.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) return [];

    const { data, error } = await sb
      .from('user_pins')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .order('position', { ascending: true });
    if (error) throw error;

    // Explicit domain mapping: targetType, targetId, sort_order, urgent
    return (data || []).map(p => ({
      id: p.id,
      pinId: p.id,
      organization_id: p.organization_id,
      user_id: p.user_id,
      node_id: p.node_id,
      task_id: p.task_id,
      kind: p.task_id ? 'task' : 'node',
      targetType: p.task_id ? 'task' : 'node',
      targetId: p.task_id || p.node_id,
      position: p.position,
      sort_order: p.position,
      sortOrder: p.position,
      urgent: Boolean(p.is_urgent),
      is_urgent: Boolean(p.is_urgent),
      created_at: p.created_at,
      updated_at: p.updated_at
    }));
  },

  async togglePin({
    organizationId,
    nodeId = null,
    taskId = null,
    targetType = null,
    kind = null,
    targetId = null,
    isUrgent = false
  }) {
    const sb = await getSupabase();
    const { data: userRes } = await sb.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) throw new Error('Yêu cầu đăng nhập để ghim.');

    // Normalize target
    const effectiveType = targetType || kind;
    let resolvedNodeId = nodeId;
    let resolvedTaskId = taskId;
    if (!resolvedNodeId && !resolvedTaskId && effectiveType && targetId) {
      if (effectiveType === 'task') {
        resolvedTaskId = targetId;
      } else {
        resolvedNodeId = targetId;
      }
    }

    if ((resolvedNodeId == null) === (resolvedTaskId == null)) {
      throw new Error('Ghim phải trỏ tới chính xác một Node hoặc một Task.');
    }

    // Check existing pin
    let checkQuery = sb
      .from('user_pins')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', userId);

    if (resolvedTaskId) {
      checkQuery = checkQuery.eq('task_id', resolvedTaskId);
    } else {
      checkQuery = checkQuery.eq('node_id', resolvedNodeId);
    }

    const { data: existing, error: checkErr } = await checkQuery.maybeSingle();
    if (checkErr) throw checkErr;

    if (existing) {
      const { error: delErr } = await sb.from('user_pins').delete().eq('id', existing.id);
      if (delErr) throw delErr;
      return { pinned: false, id: existing.id };
    } else {
      // Product limit check: max 100 pins per user in this organization
      const { count, error: countErr } = await sb
        .from('user_pins')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('user_id', userId);
      if (countErr) throw countErr;
      if (count != null && count >= 100) {
        throw new Error('Đã đạt giới hạn tối đa 100 ghim cho mỗi tài khoản.');
      }

      const { data, error } = await sb
        .from('user_pins')
        .insert({
          organization_id: organizationId,
          user_id: userId,
          node_id: resolvedNodeId || null,
          task_id: resolvedTaskId || null,
          position: (count || 0),
          is_urgent: Boolean(isUrgent)
        })
        .select()
        .single();
      if (error) throw error;
      return {
        pinned: true,
        pin: {
          id: data.id,
          pinId: data.id,
          organization_id: data.organization_id,
          user_id: data.user_id,
          node_id: data.node_id,
          task_id: data.task_id,
          kind: data.task_id ? 'task' : 'node',
          targetType: data.task_id ? 'task' : 'node',
          targetId: data.task_id || data.node_id,
          position: data.position,
          sort_order: data.position,
          sortOrder: data.position,
          urgent: Boolean(data.is_urgent),
          is_urgent: Boolean(data.is_urgent),
          created_at: data.created_at,
          updated_at: data.updated_at
        }
      };
    }
  },

  async setPinUrgent({ organizationId, targetType, kind, targetId, pinId, isUrgent }) {
    const sb = await getSupabase();
    const { data: userRes } = await sb.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) throw new Error('Yêu cầu đăng nhập.');

    if (pinId) {
      const { data, error } = await sb
        .from('user_pins')
        .update({ is_urgent: Boolean(isUrgent), updated_at: new Date().toISOString() })
        .eq('id', pinId)
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .select();
      if (error) throw error;
      return data || [];
    }

    const effectiveType = targetType || kind;
    if (!organizationId || !effectiveType || !targetId) {
      throw new Error('Thiếu tham số bắt buộc để đổi trạng thái khẩn cấp.');
    }

    let query = sb
      .from('user_pins')
      .update({ is_urgent: Boolean(isUrgent), updated_at: new Date().toISOString() })
      .eq('organization_id', organizationId)
      .eq('user_id', userId);

    if (effectiveType === 'task') {
      query = query.eq('task_id', targetId);
    } else {
      query = query.eq('node_id', targetId);
    }

    const { data, error } = await query.select();
    if (error) throw error;
    return data || [];
  },

  async reorderPins({ organizationId, pinIdsInOrder, orderedPinIds }) {
    const ids = pinIdsInOrder || orderedPinIds;
    if (!organizationId || !Array.isArray(ids)) return;
    const sb = await getSupabase();
    const { data: userRes } = await sb.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) throw new Error('Yêu cầu đăng nhập.');

    const updates = ids.map((pinId, index) =>
      sb
        .from('user_pins')
        .update({ position: index, updated_at: new Date().toISOString() })
        .eq('id', pinId)
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
    );
    await Promise.all(updates);
    return { success: true };
  },

  async deletePin({ organizationId, pinId }) {
    if (!pinId) throw new Error('Thiếu pinId.');
    const sb = await getSupabase();
    const { data: userRes } = await sb.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) throw new Error('Yêu cầu đăng nhập.');

    let query = sb.from('user_pins').delete().eq('id', pinId).eq('user_id', userId);
    if (organizationId) query = query.eq('organization_id', organizationId);
    const { error } = await query;
    if (error) throw error;
    return { success: true };
  }
};

// ============================================================================
// 5.1 TASK STARS REPOSITORY (Table: public.task_stars)
// Schema: organization_id, task_id, user_id, created_at
// Primary Key: (task_id, user_id)
// ============================================================================

export const StarRepository = {
  async getStarredTaskIds(organizationId) {
    if (!organizationId) return [];
    const sb = await getSupabase();
    const { data: userRes } = await sb.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) return [];

    const { data, error } = await sb
      .from('task_stars')
      .select('task_id')
      .eq('organization_id', organizationId)
      .eq('user_id', userId);
    if (error) throw error;
    return (data || []).map(r => r.task_id);
  },

  async toggleStar({ organizationId, taskId }) {
    if (!organizationId || !taskId) {
      throw new Error('Thiếu organizationId hoặc taskId.');
    }
    const sb = await getSupabase();
    const { data: userRes } = await sb.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) throw new Error('Yêu cầu đăng nhập để đánh dấu sao.');

    const { data: existing, error: checkErr } = await sb
      .from('task_stars')
      .select('task_id')
      .eq('organization_id', organizationId)
      .eq('task_id', taskId)
      .eq('user_id', userId)
      .maybeSingle();
    if (checkErr) throw checkErr;

    if (existing) {
      const { error: delErr } = await sb
        .from('task_stars')
        .delete()
        .eq('organization_id', organizationId)
        .eq('task_id', taskId)
        .eq('user_id', userId);
      if (delErr) throw delErr;
      return { starred: false, taskId };
    } else {
      const { error: insErr } = await sb
        .from('task_stars')
        .insert({
          organization_id: organizationId,
          task_id: taskId,
          user_id: userId
        });
      if (insErr) throw insErr;
      return { starred: true, taskId };
    }
  }
};

// ============================================================================
// 6. SAVED VIEWS REPOSITORY (Table: public.saved_views)
// Schema: id, organization_id, user_id, name, view_type, selected_node_id,
//         filters, sort_key, include_children, created_at, updated_at
// ============================================================================

export function mapCloudSavedView(v) {
  if (!v) return null;
  return {
    id: v.id,
    name: v.name,
    selected: v.selected_node_id,
    selected_node_id: v.selected_node_id,
    view: v.view_type || 'overview',
    view_type: v.view_type || 'overview',
    filters: v.filters || {},
    sort: v.sort_key || 'smart',
    sort_key: v.sort_key || 'smart',
    includeChildren: v.include_children !== false,
    include_children: v.include_children !== false,
    organization_id: v.organization_id,
    user_id: v.user_id,
    created_at: v.created_at,
    updated_at: v.updated_at
  };
}

export const SavedViewRepository = {
  async getSavedViews(organizationId) {
    if (!organizationId) return [];
    const sb = await getSupabase();
    const { data: userRes } = await sb.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) return [];

    const { data, error } = await sb
      .from('saved_views')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapCloudSavedView);
  },

  async createSavedView({
    organizationId,
    name,
    viewType = 'overview',
    selectedNodeId = null,
    filters = {},
    sortKey = 'smart',
    sortBy = null,
    includeChildren = true
  }) {
    const trimmedName = (name || '').trim();
    if (!trimmedName) throw new Error('Tên góc nhìn không được để trống.');
    if (trimmedName.length > 120) throw new Error('Tên góc nhìn tối đa 120 ký tự.');

    const sb = await getSupabase();
    const { data: userRes } = await sb.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) throw new Error('Yêu cầu đăng nhập để lưu chế độ xem.');

    // Limit check: max 20 saved views per user in this org
    const { count, error: countErr } = await sb
      .from('saved_views')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('user_id', userId);
    if (countErr) throw countErr;
    if (count != null && count >= 20) {
      throw new Error('Đã có 20 góc nhìn. Xóa một góc nhìn cũ trước khi tạo mới.');
    }

    const { data, error } = await sb
      .from('saved_views')
      .insert({
        organization_id: organizationId,
        user_id: userId,
        name: trimmedName,
        view_type: viewType,
        selected_node_id: selectedNodeId || null,
        filters: filters || {},
        sort_key: sortKey || sortBy || 'smart',
        include_children: includeChildren
      })
      .select()
      .single();
    if (error) throw error;
    return mapCloudSavedView(data);
  },

  async updateSavedView(viewId, patch = {}) {
    if (!viewId) throw new Error('Thiếu viewId.');
    const sb = await getSupabase();
    const { data: userRes } = await sb.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) throw new Error('Yêu cầu đăng nhập.');

    const updatePayload = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) updatePayload.name = patch.name.trim();
    if (patch.viewType !== undefined) updatePayload.view_type = patch.viewType;
    if (patch.selectedNodeId !== undefined) updatePayload.selected_node_id = patch.selectedNodeId;
    if (patch.filters !== undefined) updatePayload.filters = patch.filters;
    if (patch.sortKey !== undefined || patch.sortBy !== undefined) {
      updatePayload.sort_key = patch.sortKey !== undefined ? patch.sortKey : patch.sortBy;
    }
    if (patch.includeChildren !== undefined) updatePayload.include_children = patch.includeChildren;

    const { data, error } = await sb
      .from('saved_views')
      .update(updatePayload)
      .eq('id', viewId)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return mapCloudSavedView(data);
  },

  async deleteSavedView(viewIdOrPayload) {
    const viewId = typeof viewIdOrPayload === 'object' && viewIdOrPayload !== null
      ? (viewIdOrPayload.viewId || viewIdOrPayload.id)
      : viewIdOrPayload;
    if (!viewId) throw new Error('Missing viewId for deleteSavedView');
    const sb = await getSupabase();
    const { data: userRes } = await sb.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) throw new Error('Yêu cầu đăng nhập.');

    const { error } = await sb
      .from('saved_views')
      .delete()
      .eq('id', viewId)
      .eq('user_id', userId);
    if (error) throw error;
    return { success: true };
  }
};

// ============================================================================
// ============================================================================
// 7. TASK COMMENTS REPOSITORY (Table: public.task_comments)
// Schema: id, organization_id, task_id, author_user_id, body, edited_at, created_at
// ============================================================================

export const CommentRepository = {
  async getComments(taskId, organizationId = null) {
    if (!taskId) return [];
    const sb = await getSupabase();
    let query = sb
      .from('task_comments')
      .select('*')
      .eq('task_id', taskId);
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async addComment({ organizationId, taskId, body }) {
    if (!organizationId || !taskId) {
      throw new Error('Thiếu organizationId hoặc taskId.');
    }
    const trimmed = (body || '').trim();
    if (!trimmed) {
      throw new Error('Nội dung bình luận không được để trống.');
    }
    if (trimmed.length > 5000) {
      throw new Error('Nội dung bình luận tối đa 5.000 ký tự.');
    }

    const sb = await getSupabase();
    const { data: userRes } = await sb.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) throw new Error('Yêu cầu đăng nhập để bình luận.');

    const { data, error } = await sb
      .from('task_comments')
      .insert({
        organization_id: organizationId,
        task_id: taskId,
        author_user_id: userId,
        body: trimmed
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteComment(commentId) {
    if (!commentId) throw new Error('Thiếu mã bình luận để xóa.');
    const sb = await getSupabase();
    const { error } = await sb
      .from('task_comments')
      .delete()
      .eq('id', commentId);
    if (error) throw error;
    return { success: true };
  },

  async updateComment(commentId, body) {
    if (!commentId) throw new Error('Thiếu mã bình luận để sửa.');
    const trimmed = (body || '').trim();
    if (!trimmed) throw new Error('Nội dung bình luận không được để trống.');
    if (trimmed.length > 5000) throw new Error('Nội dung bình luận tối đa 5.000 ký tự.');

    const sb = await getSupabase();
    const { data, error } = await sb
      .from('task_comments')
      .update({ body: trimmed, edited_at: new Date().toISOString() })
      .eq('id', commentId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============================================================================
// 8. TASK TIME ENTRIES REPOSITORY (Table: public.task_time_entries)
// Schema: id, organization_id, task_id, user_id, minutes, note, started_at, ended_at, created_at
// ============================================================================

export const TimeEntryRepository = {
  async getTimeEntries(taskId, organizationId = null) {
    if (!taskId) return [];
    const sb = await getSupabase();
    let query = sb
      .from('task_time_entries')
      .select('*')
      .eq('task_id', taskId);
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async logTime({
    organizationId,
    taskId,
    minutes,
    note = '',
    startedAt = null,
    endedAt = null
  }) {
    if (!organizationId || !taskId) {
      throw new Error('Thiếu organizationId hoặc taskId.');
    }
    const intMinutes = Math.round(Number(minutes));
    if (!Number.isInteger(intMinutes) || intMinutes <= 0) {
      throw new Error('Thời gian thực hiện phải lớn hơn 0 phút.');
    }
    if (intMinutes > 10080) {
      throw new Error('Thời gian thực hiện không được vượt quá 10.080 phút (7 ngày).');
    }

    const sb = await getSupabase();
    const { data: userRes } = await sb.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) throw new Error('Yêu cầu đăng nhập để chấm công.');

    const { data, error } = await sb
      .from('task_time_entries')
      .insert({
        organization_id: organizationId,
        task_id: taskId,
        user_id: userId,
        minutes: intMinutes,
        note: (note || '').slice(0, 500),
        started_at: startedAt,
        ended_at: endedAt
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteTimeEntry(entryId) {
    if (!entryId) throw new Error('Thiếu mã bản ghi thời gian để xóa.');
    const sb = await getSupabase();
    const { error } = await sb
      .from('task_time_entries')
      .delete()
      .eq('id', entryId);
    if (error) throw error;
    return { success: true };
  }
};

// ============================================================================
// 9. TASK CHECKLIST REPOSITORY (Table: public.task_checklist_items)
// Schema: id, organization_id, task_id, content, is_done, sort_order,
//         completed_by, completed_at, created_by, created_at, updated_at
// ============================================================================

export const ChecklistRepository = {
  async getChecklistItems(taskId, organizationId = null) {
    if (!taskId) return [];
    const sb = await getSupabase();
    let query = sb
      .from('task_checklist_items')
      .select('*')
      .eq('task_id', taskId);
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query.order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async addChecklistItem({ organizationId, taskId, content, sortOrder = 0 }) {
    if (!organizationId || !taskId) {
      throw new Error('Thiếu organizationId hoặc taskId.');
    }
    const trimmed = (content || '').trim();
    if (!trimmed) {
      throw new Error('Nội dung checklist không được để trống.');
    }
    if (trimmed.length > 400) {
      throw new Error('Nội dung checklist tối đa 400 ký tự.');
    }

    const sb = await getSupabase();
    const { data, error } = await sb
      .from('task_checklist_items')
      .insert({
        organization_id: organizationId,
        task_id: taskId,
        content: trimmed,
        sort_order: sortOrder,
        is_done: false
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async toggleChecklistItem(itemId, isDone) {
    if (!itemId) throw new Error('Thiếu itemId cho toggleChecklistItem.');
    const sb = await getSupabase();
    const { data: userRes } = await sb.auth.getUser();
    const userId = userRes?.user?.id;

    const { data, error } = await sb
      .from('task_checklist_items')
      .update({
        is_done: Boolean(isDone),
        completed_at: isDone ? new Date().toISOString() : null,
        completed_by: isDone ? userId : null
      })
      .eq('id', itemId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteChecklistItem(itemId) {
    if (!itemId) throw new Error('Thiếu itemId cho deleteChecklistItem.');
    const sb = await getSupabase();
    const { error } = await sb
      .from('task_checklist_items')
      .delete()
      .eq('id', itemId);
    if (error) throw error;
    return { success: true };
  },

  async updateChecklistItem(itemId, updates = {}) {
    if (!itemId) throw new Error('Thiếu itemId cho updateChecklistItem.');
    const sb = await getSupabase();
    const payload = {};
    if (updates.content !== undefined) {
      const trimmed = updates.content.trim();
      if (!trimmed) throw new Error('Nội dung checklist không được để trống.');
      if (trimmed.length > 400) throw new Error('Nội dung checklist tối đa 400 ký tự.');
      payload.content = trimmed;
    }
    if (updates.sort_order !== undefined || updates.sortOrder !== undefined) {
      payload.sort_order = updates.sort_order ?? updates.sortOrder;
    }

    const { data, error } = await sb
      .from('task_checklist_items')
      .update(payload)
      .eq('id', itemId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============================================================================
// 9B. TASK DEPENDENCIES REPOSITORY (Table: public.task_dependencies)
// Schema: organization_id, task_id, depends_on_task_id, created_by, created_at
// ============================================================================

export const DependencyRepository = {
  async getDependencies(taskId, organizationId = null) {
    if (!taskId) return [];
    const sb = await getSupabase();
    let query = sb
      .from('task_dependencies')
      .select('organization_id, task_id, depends_on_task_id, created_by, created_at')
      .eq('task_id', taskId);
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async addDependency({ organizationId, taskId, dependsOnTaskId }) {
    if (!organizationId || !taskId || !dependsOnTaskId) {
      throw new Error('Thiếu thông tin liên kết phụ thuộc.');
    }
    if (taskId === dependsOnTaskId) {
      throw new Error('Công việc không thể phụ thuộc vào chính nó.');
    }
    const sb = await getSupabase();
    const { data: userRes } = await sb.auth.getUser();
    const userId = userRes?.user?.id;

    const { data, error } = await sb
      .from('task_dependencies')
      .insert({
        organization_id: organizationId,
        task_id: taskId,
        depends_on_task_id: dependsOnTaskId,
        created_by: userId || null
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteDependency({ organizationId, taskId, dependsOnTaskId }) {
    if (!taskId || !dependsOnTaskId) {
      throw new Error('Thiếu thông tin để hủy phụ thuộc.');
    }
    const sb = await getSupabase();
    let query = sb
      .from('task_dependencies')
      .delete()
      .eq('task_id', taskId)
      .eq('depends_on_task_id', dependsOnTaskId);
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { error } = await query;
    if (error) throw error;
    return { success: true };
  }
};

// ============================================================================
// 10. NOTIFICATIONS REPOSITORY (Table: public.notifications)
// Schema: id, organization_id, user_id, kind, title, body, task_id, metadata, read_at, created_at
// ============================================================================

export const NotificationRepository = {
  async getNotifications(organizationId) {
    if (!organizationId) return [];
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('notifications')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async markAsRead(notificationId) {
    if (!notificationId) return null;
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============================================================================
// 11. BILLING REPOSITORY (Table: public.organization_subscriptions)
// Schema: organization_id, plan, status, seat_limit, storage_bytes_limit,
//         external_customer_id, external_subscription_id, current_period_end, created_at, updated_at
// ============================================================================

export const BillingRepository = {
  async getSubscription(organizationId) {
    if (!organizationId) return null;
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('organization_subscriptions')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
};

// ============================================================================
// 12. ATTACHMENT REPOSITORY (Table: public.task_attachments & Bucket: worktree-files)
// Schema: id, organization_id, task_id, storage_path, original_name, mime_type, size_bytes, uploaded_by, created_at
// ============================================================================

export const CANONICAL_STORAGE_BUCKET = 'worktree-files';
export const STORAGE_MAX_FILE_SIZE = 52428800; // 50 MB

export const AttachmentRepository = {
  /**
   * Lấy danh sách attachment metadata của một task
   */
  async getAttachments(taskId, organizationId = null) {
    if (!taskId) return [];
    const sb = await getSupabase();
    let query = sb
      .from('task_attachments')
      .select('id, organization_id, task_id, storage_path, original_name, mime_type, size_bytes, uploaded_by, created_at')
      .eq('task_id', taskId);
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  /**
   * Upload binary object lên Supabase Storage bucket 'worktree-files'
   * Upsert = false bắt buộc
   */
  async uploadStorageObject(storagePath, fileBody, options = {}) {
    if (!storagePath || !fileBody) {
      throw new Error('Thiếu đường dẫn hoặc nội dung tệp để tải lên.');
    }
    const sb = await getSupabase();
    const { data, error } = await sb.storage
      .from(CANONICAL_STORAGE_BUCKET)
      .upload(storagePath, fileBody, {
        upsert: false,
        contentType: options.contentType || 'application/octet-stream',
        ...options
      });
    if (error) throw error;
    return data;
  },

  /**
   * Lưu attachment metadata vào public.task_attachments
   */
  async insertMetadata({ organizationId, taskId, storagePath, originalName, mimeType = null, sizeBytes = null, uploadedBy = null }) {
    if (!organizationId || !taskId || !storagePath || !originalName) {
      throw new Error('Thiếu thông tin bắt buộc để lưu metadata tệp đính kèm.');
    }
    const sb = await getSupabase();
    const payload = {
      organization_id: organizationId,
      task_id: taskId,
      storage_path: storagePath,
      original_name: originalName,
      mime_type: mimeType || null,
      size_bytes: sizeBytes != null ? Number(sizeBytes) : null
    };
    if (uploadedBy) {
      payload.uploaded_by = uploadedBy;
    }
    const { data, error } = await sb
      .from('task_attachments')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Xóa storage object khỏi bucket 'worktree-files'
   */
  async deleteStorageObject(storagePath) {
    if (!storagePath) return { success: true };
    const sb = await getSupabase();
    const { data, error } = await sb.storage
      .from(CANONICAL_STORAGE_BUCKET)
      .remove([storagePath]);
    if (error) throw error;
    return data;
  },

  /**
   * Xóa metadata row khỏi public.task_attachments
   */
  async deleteMetadata(attachmentId, organizationId = null) {
    if (!attachmentId) throw new Error('Thiếu attachmentId.');
    const sb = await getSupabase();
    let query = sb
      .from('task_attachments')
      .delete()
      .eq('id', attachmentId);
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { error } = await query;
    if (error) throw error;
    return { success: true };
  },

  /**
   * Download binary object từ bucket 'worktree-files'
   * Trả về Blob
   */
  async downloadStorageObject(storagePath) {
    if (!storagePath) throw new Error('Thiếu đường dẫn tệp.');
    const sb = await getSupabase();
    const { data, error } = await sb.storage
      .from(CANONICAL_STORAGE_BUCKET)
      .download(storagePath);
    if (error) throw error;
    return data; // Blob
  }
};

