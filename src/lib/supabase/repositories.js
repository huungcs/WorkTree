/**
 * WorkTree X — Multi-Tenant Supabase Repositories
 * Adheres to RLS & organization_id invariants.
 */

import { getSupabase } from './client.js';

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

// 1. Organization Repository
export const OrganizationRepository = {
  async getOrganizations() {
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('organizations')
      .select('id, name, slug, timezone, created_at')
      .order('name');
    if (error) throw error;
    return data || [];
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
  }
};

// 2. Node Repository (Closure tree organization_nodes)
export const NodeRepository = {
  async getNodes(organizationId) {
    if (!organizationId) return [];
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('organization_nodes')
      .select('id, organization_id, parent_id, name, node_type, sort_order, color, icon')
      .eq('organization_id', organizationId)
      .eq('is_archived', false)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createNode({ organizationId, parentId = null, name, nodeType, color = null, icon = null }) {
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('organization_nodes')
      .insert({
        organization_id: organizationId,
        parent_id: parentId,
        name,
        node_type: nodeType,
        color,
        icon
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// 3. Employee Repository
export const EmployeeRepository = {
  async getEmployees(organizationId) {
    if (!organizationId) return [];
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('employees')
      .select('id, organization_id, user_id, full_name, email, job_title, department_id, avatar_url, is_active')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('full_name');
    if (error) throw error;
    return data || [];
  }
};

// 4. Task Repository (Reading from task_rollups view)
export const TaskRepository = {
  async getTasks(organizationId, { nodeId = null, status = null, search = '' } = {}) {
    if (!organizationId) return [];
    const sb = await getSupabase();
    let query = sb
      .from('task_rollups')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_archived', false);

    if (nodeId) {
      query = query.eq('node_id', nodeId);
    }
    if (status) {
      const dbStatus = STATUS_MAP.uiToDb[status] || status;
      query = query.eq('status', dbStatus);
    }
    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    return (data || []).map(t => ({
      ...t,
      uiStatus: STATUS_MAP.dbToUi[t.status] || t.status,
      uiPriority: PRIORITY_MAP.dbToUi[t.priority] || t.priority
    }));
  },

  async createTask({ organizationId, nodeId, title, description = '', priority = 'medium', assigneeId = null, dueDate = null }) {
    const sb = await getSupabase();
    const dbPriority = PRIORITY_MAP.uiToDb[priority] || priority;
    const { data, error } = await sb
      .from('tasks')
      .insert({
        organization_id: organizationId,
        node_id: nodeId,
        title,
        description,
        priority: dbPriority,
        assignee_id: assigneeId,
        due_date: dueDate,
        status: 'todo'
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateTaskStatus(taskId, status) {
    const sb = await getSupabase();
    const dbStatus = STATUS_MAP.uiToDb[status] || status;
    const { data, error } = await sb
      .from('tasks')
      .update({
        status: dbStatus,
        completed_at: dbStatus === 'done' ? new Date().toISOString() : null
      })
      .eq('id', taskId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// 5. User Pins Repository
export const PinRepository = {
  async getUserPins(organizationId) {
    if (!organizationId) return [];
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('user_pins')
      .select('*')
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async togglePin({ organizationId, targetType, targetId, isUrgent = false }) {
    const sb = await getSupabase();
    const { data: userRes } = await sb.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) throw new Error('Yêu cầu đăng nhập để ghim.');

    // Check existing
    const { data: existing } = await sb
      .from('user_pins')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .maybeSingle();

    if (existing) {
      const { error } = await sb.from('user_pins').delete().eq('id', existing.id);
      if (error) throw error;
      return { pinned: false };
    } else {
      const { error } = await sb.from('user_pins').insert({
        organization_id: organizationId,
        user_id: userId,
        target_type: targetType,
        target_id: targetId,
        is_urgent: isUrgent
      });
      if (error) throw error;
      return { pinned: true };
    }
  }
};
