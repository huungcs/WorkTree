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
      payload.type = updates.type || updates.node_type;
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
      department_id: emp.home_node_id,
      is_active: emp.employment_status === 'active'
    }));
  },

  async createEmployee({
    organizationId,
    fullName,
    email = null,
    employeeCode = null,
    jobTitle = null,
    homeNodeId = null
  }) {
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('employees')
      .insert({
        organization_id: organizationId,
        full_name: fullName,
        email: email ? email.toLowerCase() : null,
        employee_code: employeeCode,
        job_title: jobTitle,
        home_node_id: homeNodeId,
        employment_status: 'active'
      })
      .select()
      .single();
    if (error) throw error;
    return {
      ...data,
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
      department_id: data.home_node_id,
      is_active: data.employment_status === 'active'
    };
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

  async updateTask(taskId, updates = {}) {
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

    const { data, error } = await sb
      .from('tasks')
      .update(payload)
      .eq('id', taskId)
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

export const PinRepository = {
  async getUserPins(organizationId) {
    if (!organizationId) return [];
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('user_pins')
      .select('*')
      .eq('organization_id', organizationId)
      .order('position', { ascending: true });
    if (error) throw error;

    // Explicit domain mapping: targetType, targetId, sort_order
    return (data || []).map(p => ({
      ...p,
      targetType: p.task_id ? 'task' : 'node',
      targetId: p.task_id || p.node_id,
      sort_order: p.position,
      sortOrder: p.position
    }));
  },

  async togglePin({
    organizationId,
    nodeId = null,
    taskId = null,
    targetType = null,
    targetId = null,
    isUrgent = false
  }) {
    const sb = await getSupabase();
    const { data: userRes } = await sb.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) throw new Error('Yêu cầu đăng nhập để ghim.');

    // Normalize target
    let resolvedNodeId = nodeId;
    let resolvedTaskId = taskId;
    if (!resolvedNodeId && !resolvedTaskId && targetType && targetId) {
      if (targetType === 'task') {
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

    const { data: existing } = await checkQuery.maybeSingle();

    if (existing) {
      const { error } = await sb.from('user_pins').delete().eq('id', existing.id);
      if (error) throw error;
      return { pinned: false };
    } else {
      const { data, error } = await sb
        .from('user_pins')
        .insert({
          organization_id: organizationId,
          user_id: userId,
          node_id: resolvedNodeId || null,
          task_id: resolvedTaskId || null,
          position: 0,
          is_urgent: Boolean(isUrgent)
        })
        .select()
        .single();
      if (error) throw error;
      return {
        pinned: true,
        pin: {
          ...data,
          targetType: data.task_id ? 'task' : 'node',
          targetId: data.task_id || data.node_id,
          sort_order: data.position,
          sortOrder: data.position
        }
      };
    }
  }
};

// ============================================================================
// 6. SAVED VIEWS REPOSITORY (Table: public.saved_views)
// Schema: id, organization_id, user_id, name, view_type, selected_node_id,
//         filters, sort_key, include_children, created_at, updated_at
// ============================================================================

export const SavedViewRepository = {
  async getSavedViews(organizationId) {
    if (!organizationId) return [];
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('saved_views')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createSavedView({
    organizationId,
    name,
    viewType = 'overview',
    selectedNodeId = null,
    filters = {},
    sortKey = 'smart',
    includeChildren = true
  }) {
    const sb = await getSupabase();
    const { data: userRes } = await sb.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) throw new Error('Yêu cầu đăng nhập để lưu chế độ xem.');

    const { data, error } = await sb
      .from('saved_views')
      .insert({
        organization_id: organizationId,
        user_id: userId,
        name,
        view_type: viewType,
        selected_node_id: selectedNodeId,
        filters: filters || {},
        sort_key: sortKey,
        include_children: includeChildren
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteSavedView(viewId) {
    if (!viewId) throw new Error('Missing viewId for deleteSavedView');
    const sb = await getSupabase();
    const { error } = await sb.from('saved_views').delete().eq('id', viewId);
    if (error) throw error;
    return { success: true };
  }
};

// ============================================================================
// 7. TASK COMMENTS REPOSITORY (Table: public.task_comments)
// Schema: id, organization_id, task_id, author_user_id, body, edited_at, created_at
// ============================================================================

export const CommentRepository = {
  async getComments(taskId) {
    if (!taskId) return [];
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('task_comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async addComment({ organizationId, taskId, body }) {
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
        body
      })
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
  async getTimeEntries(taskId) {
    if (!taskId) return [];
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('task_time_entries')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });
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
        minutes,
        note,
        started_at: startedAt,
        ended_at: endedAt
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============================================================================
// 9. TASK CHECKLIST REPOSITORY (Table: public.task_checklist_items)
// Schema: id, organization_id, task_id, content, is_done, sort_order,
//         completed_by, completed_at, created_by, created_at, updated_at
// ============================================================================

export const ChecklistRepository = {
  async getChecklistItems(taskId) {
    if (!taskId) return [];
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('task_checklist_items')
      .select('*')
      .eq('task_id', taskId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async addChecklistItem({ organizationId, taskId, content, sortOrder = 0 }) {
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('task_checklist_items')
      .insert({
        organization_id: organizationId,
        task_id: taskId,
        content,
        sort_order: sortOrder,
        is_done: false
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async toggleChecklistItem(itemId, isDone) {
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
