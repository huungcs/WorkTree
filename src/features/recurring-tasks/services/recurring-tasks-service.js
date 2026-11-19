/**
 * WorkTree X Feature: Recurring Task Templates & 1-Click Daily Check-in Service
 * Pure domain helpers + strict organization-scoped Supabase operations.
 */

import { getSupabase } from '../../../lib/supabase/client.js';
import {
  TaskRepository,
  TimeEntryRepository
} from '../../../lib/supabase/repositories.js';

export const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

export const CADENCE_OPTIONS = Object.freeze([
  { value: 'daily', label: 'Hằng ngày (Thứ 2 – Chủ nhật)' },
  { value: 'weekdays', label: 'Ngày làm việc (Thứ 2 – Thứ 6)' },
  { value: 'weekly', label: 'Theo thứ trong tuần' },
  { value: 'monthly', label: 'Theo ngày trong tháng' }
]);

export const ASSIGNMENT_MODE_OPTIONS = Object.freeze([
  { value: 'job_title', label: 'Theo chức danh (Job Title)' },
  { value: 'org_role', label: 'Theo vai trò hệ thống' },
  { value: 'employee', label: 'Chỉ định từng nhân sự' }
]);

export const ORG_ROLE_OPTIONS = Object.freeze([
  { value: 'member', label: 'Nhân viên (Member)' },
  { value: 'manager', label: 'Quản lý (Manager)' },
  { value: 'admin', label: 'Quản trị viên (Admin)' },
  { value: 'owner', label: 'Chủ sở hữu (Owner)' }
]);

export const WEEKDAY_LABELS = Object.freeze([
  { day: 1, short: 'T2', label: 'Thứ 2' },
  { day: 2, short: 'T3', label: 'Thứ 3' },
  { day: 3, short: 'T4', label: 'Thứ 4' },
  { day: 4, short: 'T5', label: 'Thứ 5' },
  { day: 5, short: 'T6', label: 'Thứ 6' },
  { day: 6, short: 'T7', label: 'Thứ 7' },
  { day: 7, short: 'CN', label: 'Chủ nhật' }
]);

export const CHECKIN_MOODS = Object.freeze([
  { value: 'green', label: 'Suôn sẻ', hint: 'Đúng tiến độ, không có vướng mắc lớn' },
  { value: 'amber', label: 'Cần lưu ý', hint: 'Có việc hơi chậm hoặc cần phối hợp thêm' },
  { value: 'red', label: 'Đang vướng', hint: 'Cần quản lý / đồng đội gỡ kẹt ngay' }
]);

const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'critical']);
const VALID_CADENCES = new Set(CADENCE_OPTIONS.map(o => o.value));
const VALID_MODES = new Set(ASSIGNMENT_MODE_OPTIONS.map(o => o.value));
const VALID_ROLES = new Set(ORG_ROLE_OPTIONS.map(o => o.value));
const VALID_MOODS = new Set(CHECKIN_MOODS.map(o => o.value));

const _ensuredTodayKeys = new Set();

export function resetEnsureTodayCache() {
  _ensuredTodayKeys.clear();
}

export function getLocalDateString(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    const byType = Object.fromEntries(parts.map(p => [p.type, p.value]));
    if (byType.year && byType.month && byType.day) {
      return `${byType.year}-${byType.month}-${byType.day}`;
    }
  } catch (_) {
    // Fallback below if timezone fails
  }
  const iso = new Date(date.getTime() + 7 * 3600 * 1000).toISOString();
  return iso.slice(0, 10);
}

export function parseChecklistInput(raw) {
  const list = Array.isArray(raw)
    ? raw
    : String(raw ?? '').split(/\r?\n/);
  const cleaned = [];
  for (const item of list) {
    const trimmed = String(item ?? '').trim().slice(0, 400);
    if (trimmed) cleaned.push(trimmed);
    if (cleaned.length >= 30) break;
  }
  return cleaned;
}

export function parseTagsInput(raw) {
  const list = Array.isArray(raw)
    ? raw
    : String(raw ?? '').split(',');
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const trimmed = String(item ?? '').trim().slice(0, 40);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= 18) break;
  }
  return out;
}

export function validateTemplateInput(input = {}) {
  const organizationId = String(input.organizationId || input.organization_id || '').trim();
  if (!organizationId) {
    throw new Error('Thiếu mã tổ chức (organizationId) khi lưu quy tắc việc định kỳ.');
  }

  const title = String(input.title || '').trim();
  if (title.length < 1 || title.length > 240) {
    throw new Error('Tên đầu việc định kỳ phải từ 1 đến 240 ký tự.');
  }

  const description = String(input.description || '').slice(0, 10000);
  const assignmentMode = VALID_MODES.has(input.assignmentMode || input.assignment_mode)
    ? (input.assignmentMode || input.assignment_mode)
    : 'job_title';

  const targetJobTitleRaw = String(input.targetJobTitle ?? input.target_job_title ?? '').trim();
  const targetOrgRoleRaw = String(input.targetOrgRole ?? input.target_org_role ?? '').trim();
  const targetEmployeeIdRaw = String(input.targetEmployeeId ?? input.target_employee_id ?? '').trim();

  if (assignmentMode === 'job_title' && !targetJobTitleRaw) {
    throw new Error('Vui lòng chọn hoặc nhập Chức danh (Job Title) áp dụng.');
  }
  if (assignmentMode === 'org_role' && !VALID_ROLES.has(targetOrgRoleRaw)) {
    throw new Error('Vui lòng chọn Vai trò hệ thống hợp lệ.');
  }
  if (assignmentMode === 'employee' && !targetEmployeeIdRaw) {
    throw new Error('Vui lòng chọn Nhân sự cụ thể áp dụng.');
  }

  const cadence = VALID_CADENCES.has(input.cadence) ? input.cadence : 'daily';
  const rawDays = Array.isArray(input.daysOfWeek ?? input.days_of_week)
    ? (input.daysOfWeek ?? input.days_of_week)
    : [1, 2, 3, 4, 5];
  const daysOfWeek = [...new Set(
    rawDays.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 7)
  )].sort((a, b) => a - b);

  if (cadence === 'weekly' && daysOfWeek.length === 0) {
    throw new Error('Lịch hằng tuần cần chọn ít nhất 1 thứ trong tuần.');
  }

  const rawDom = input.dayOfMonth ?? input.day_of_month;
  const parsedDom = rawDom === null || rawDom === undefined || rawDom === ''
    ? (cadence === 'monthly' ? 1 : null)
    : Number(rawDom);
  if (cadence === 'monthly' && (!Number.isInteger(parsedDom) || parsedDom < 1 || parsedDom > 31)) {
    throw new Error('Ngày trong tháng phải từ 1 đến 31.');
  }

  const estimateRaw = Number(input.estimateMinutes ?? input.estimate_minutes ?? 30);
  const estimateMinutes = Number.isFinite(estimateRaw)
    ? Math.min(60000, Math.max(0, Math.round(estimateRaw)))
    : 30;

  const dueOffsetRaw = Number(input.dueOffsetDays ?? input.due_offset_days ?? 0);
  const dueOffsetDays = Number.isFinite(dueOffsetRaw)
    ? Math.min(30, Math.max(0, Math.round(dueOffsetRaw)))
    : 0;

  const priority = VALID_PRIORITIES.has(input.priority) ? input.priority : 'medium';
  const nodeIdRaw = String(input.nodeId ?? input.node_id ?? '').trim();

  return {
    organization_id: organizationId,
    title,
    description,
    node_id: nodeIdRaw || null,
    assignment_mode: assignmentMode,
    target_job_title: assignmentMode === 'job_title' ? targetJobTitleRaw.slice(0, 120) : null,
    target_org_role: assignmentMode === 'org_role' ? targetOrgRoleRaw : null,
    target_employee_id: assignmentMode === 'employee' ? targetEmployeeIdRaw : null,
    priority,
    estimate_minutes: estimateMinutes,
    tags: parseTagsInput(input.tags),
    checklist_items: parseChecklistInput(input.checklistItems ?? input.checklist_items),
    cadence,
    days_of_week: daysOfWeek.length ? daysOfWeek : [1, 2, 3, 4, 5],
    day_of_month: cadence === 'monthly' ? parsedDom : null,
    due_offset_days: dueOffsetDays,
    timezone: String(input.timezone || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE,
    is_active: input.isActive !== undefined ? Boolean(input.isActive) : (input.is_active !== undefined ? Boolean(input.is_active) : true)
  };
}

export function isTemplateDueOnDate(template, localDateStr) {
  if (!template || !localDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(localDateStr)) {
    return false;
  }
  const [y, m, d] = localDateStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  const jsDay = utcDate.getUTCDay();
  const isoDow = jsDay === 0 ? 7 : jsDay;
  const lastDom = new Date(Date.UTC(y, m, 0)).getUTCDate();

  switch (template.cadence || 'daily') {
    case 'daily':
      return true;
    case 'weekdays':
      return isoDow >= 1 && isoDow <= 5;
    case 'weekly': {
      const days = Array.isArray(template.days_of_week) && template.days_of_week.length
        ? template.days_of_week.map(Number)
        : [1];
      return days.includes(isoDow);
    }
    case 'monthly': {
      const targetDom = Number(template.day_of_month) || 1;
      return d === Math.min(targetDom, lastDom);
    }
    default:
      return false;
  }
}

export function formatCadenceLabel(template = {}) {
  switch (template.cadence) {
    case 'daily':
      return 'Hằng ngày (T2 – CN)';
    case 'weekdays':
      return 'Ngày làm việc (T2 – T6)';
    case 'weekly': {
      const days = Array.isArray(template.days_of_week) ? template.days_of_week : [];
      const map = Object.fromEntries(WEEKDAY_LABELS.map(w => [w.day, w.short]));
      const text = days.map(d => map[Number(d)]).filter(Boolean).join(', ');
      return text ? `Hằng tuần (${text})` : 'Hằng tuần';
    }
    case 'monthly':
      return `Ngày ${Number(template.day_of_month) || 1} hằng tháng`;
    default:
      return 'Định kỳ';
  }
}

export function formatAssignmentLabel(template = {}, { employees = [] } = {}) {
  const mode = template.assignment_mode;
  if (mode === 'job_title') {
    return `Chức danh: ${template.target_job_title || 'Chưa chọn'}`;
  }
  if (mode === 'org_role') {
    const roleObj = ORG_ROLE_OPTIONS.find(r => r.value === template.target_org_role);
    return `Vai trò: ${roleObj ? roleObj.label : (template.target_org_role || '')}`;
  }
  if (mode === 'employee') {
    const emp = (employees || []).find(e => String(e.id) === String(template.target_employee_id));
    return `Nhân sự: ${emp ? (emp.full_name || emp.name || 'Nhân viên') : 'Nhân sự đã chọn'}`;
  }
  return 'Chưa gán';
}

export function countMatchingEmployees(template = {}, { employees = [], members = [] } = {}) {
  const activeEmps = (employees || []).filter(e => (e.employment_status || 'active') === 'active');
  if (template.assignment_mode === 'employee') {
    return activeEmps.some(e => String(e.id) === String(template.target_employee_id)) ? 1 : 0;
  }
  if (template.assignment_mode === 'job_title') {
    const target = String(template.target_job_title || '').trim().toLowerCase();
    if (!target) return 0;
    return activeEmps.filter(e => String(e.job_title || '').trim().toLowerCase() === target).length;
  }
  if (template.assignment_mode === 'org_role') {
    const targetRole = template.target_org_role;
    if (Array.isArray(members) && members.length) {
      return members.filter(m => m.status === 'active' && m.role === targetRole).length;
    }
    const hasEmployeeRoles = activeEmps.some(e => Boolean(e.role));
    if (!hasEmployeeRoles) return null;
    return activeEmps.filter(e => e.role === targetRole).length;
  }
  return 0;
}

export function validateCheckinInput(input = {}) {
  const organizationId = String(input.organizationId || input.organization_id || '').trim();
  if (!organizationId) {
    throw new Error('Thiếu mã tổ chức để lưu báo cáo cuối ngày.');
  }

  const checkinDate = /^\d{4}-\d{2}-\d{2}$/.test(String(input.checkinDate || input.checkin_date || ''))
    ? String(input.checkinDate || input.checkin_date)
    : getLocalDateString();

  const mood = VALID_MOODS.has(input.mood) ? input.mood : 'green';
  const completedTaskIds = [...new Set(
    (Array.isArray(input.completedTaskIds ?? input.completed_task_ids)
      ? (input.completedTaskIds ?? input.completed_task_ids)
      : []
    ).map(v => String(v || '').trim()).filter(Boolean)
  )].slice(0, 100);

  const inProgressTaskIds = [...new Set(
    (Array.isArray(input.inProgressTaskIds ?? input.in_progress_task_ids)
      ? (input.inProgressTaskIds ?? input.in_progress_task_ids)
      : []
    ).map(v => String(v || '').trim()).filter(Boolean)
  )].slice(0, 100);

  const minutesRaw = Number(input.minutesLogged ?? input.minutes_logged ?? 0);
  const minutesLogged = Number.isFinite(minutesRaw)
    ? Math.min(1440, Math.max(0, Math.round(minutesRaw)))
    : 0;

  return {
    organization_id: organizationId,
    checkin_date: checkinDate,
    mood,
    completed_task_ids: completedTaskIds,
    in_progress_task_ids: inProgressTaskIds,
    minutes_logged: minutesLogged,
    summary: String(input.summary || '').trim().slice(0, 4000),
    blockers: String(input.blockers || '').trim().slice(0, 2000),
    tomorrow_plan: String(input.tomorrowPlan ?? input.tomorrow_plan ?? '').trim().slice(0, 2000)
  };
}

export function buildAutoSummaryText({ completedTasks = [], inProgressTasks = [], minutesLogged = 0 } = {}) {
  const parts = [];
  if (completedTasks.length) {
    parts.push(`Hoàn thành (${completedTasks.length}): ${completedTasks.map(t => t.title).slice(0, 5).join(', ')}${completedTasks.length > 5 ? '...' : ''}`);
  }
  if (inProgressTasks.length) {
    parts.push(`Đang xử lý (${inProgressTasks.length}): ${inProgressTasks.map(t => t.title).slice(0, 4).join(', ')}${inProgressTasks.length > 4 ? '...' : ''}`);
  }
  if (minutesLogged > 0) {
    const hrs = Math.floor(minutesLogged / 60);
    const mins = minutesLogged % 60;
    const label = hrs > 0 ? `${hrs}g${mins ? ` ${mins}p` : ''}` : `${mins} phút`;
    parts.push(`Thời gian ghi nhận: ${label}`);
  }
  return parts.join(' | ');
}

export function createRecurringTasksService({
  getClient = () => getSupabase(),
  taskRepo = TaskRepository,
  timeRepo = TimeEntryRepository
} = {}) {
  async function requireSupabase() {
    const client = await getClient();
    if (!client) {
      throw new Error('Không thể kết nối máy chủ Supabase.');
    }
    return client;
  }

  return {
    async listTemplates(organizationId) {
      if (!organizationId) return [];
      const sb = await requireSupabase();
      const { data, error } = await sb
        .from('recurring_task_templates')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message || 'Không thể tải danh sách quy tắc việc định kỳ.');
      return data || [];
    },

    async createTemplate(input, userId = null) {
      const payload = validateTemplateInput(input);
      if (userId) payload.created_by = userId;
      const sb = await requireSupabase();
      const { data, error } = await sb
        .from('recurring_task_templates')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw new Error(error.message || 'Không thể tạo quy tắc việc định kỳ.');
      return data;
    },

    async updateTemplate(organizationId, templateId, patch) {
      if (!organizationId || !templateId) throw new Error('Thiếu mã quy tắc cần cập nhật.');
      const payload = validateTemplateInput({ ...patch, organizationId });
      delete payload.organization_id;
      delete payload.created_by;
      const sb = await requireSupabase();
      const { data, error } = await sb
        .from('recurring_task_templates')
        .update(payload)
        .eq('organization_id', organizationId)
        .eq('id', templateId)
        .select('*')
        .single();
      if (error) throw new Error(error.message || 'Không thể cập nhật quy tắc việc định kỳ.');
      return data;
    },

    async toggleTemplateActive(organizationId, templateId, isActive) {
      if (!organizationId || !templateId) throw new Error('Thiếu mã quy tắc.');
      const sb = await requireSupabase();
      const { data, error } = await sb
        .from('recurring_task_templates')
        .update({ is_active: Boolean(isActive) })
        .eq('organization_id', organizationId)
        .eq('id', templateId)
        .select('*')
        .single();
      if (error) throw new Error(error.message || 'Không thể đổi trạng thái quy tắc.');
      return data;
    },

    async deleteTemplate(organizationId, templateId) {
      if (!organizationId || !templateId) throw new Error('Thiếu mã quy tắc.');
      const sb = await requireSupabase();
      const { error } = await sb
        .from('recurring_task_templates')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', templateId);
      if (error) throw new Error(error.message || 'Không thể xóa quy tắc việc định kỳ.');
      return true;
    },

    async listRecentRuns(organizationId, limit = 40) {
      if (!organizationId) return [];
      const sb = await requireSupabase();
      const { data, error } = await sb
        .from('recurring_task_runs')
        .select('*')
        .eq('organization_id', organizationId)
        .order('run_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message || 'Không thể tải lịch sử tạo việc tự động.');
      return data || [];
    },

    async generateForOrganization(organizationId, targetDate = null) {
      if (!organizationId) return { created: 0, skipped: 0, task_ids: [] };
      const sb = await requireSupabase();
      const { data, error } = await sb.rpc('generate_recurring_tasks_for_org', {
        p_organization_id: organizationId,
        p_target_date: targetDate || null
      });
      if (error) throw new Error(error.message || 'Không thể sinh việc định kỳ hôm nay.');
      return data || { created: 0, skipped: 0, task_ids: [] };
    },

    async ensureTodayGenerated(organizationId, role = 'member') {
      if (!organizationId || !['owner', 'admin', 'manager'].includes(role)) {
        return { created: 0, skipped: 0, cached: true };
      }
      const todayKey = `${organizationId}:${getLocalDateString()}`;
      if (_ensuredTodayKeys.has(todayKey)) {
        return { created: 0, skipped: 0, cached: true };
      }
      _ensuredTodayKeys.add(todayKey);
      try {
        return await this.generateForOrganization(organizationId, null);
      } catch (err) {
        _ensuredTodayKeys.delete(todayKey);
        console.warn('[RecurringTasks] Bỏ qua kiểm tra tạo việc đầu ngày:', err?.message || err);
        return { created: 0, skipped: 0, error: err?.message || String(err) };
      }
    },

    async getTodayCheckin(organizationId, userId, dateStr = getLocalDateString()) {
      if (!organizationId || !userId) return null;
      const sb = await requireSupabase();
      const { data, error } = await sb
        .from('daily_checkins')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .eq('checkin_date', dateStr)
        .maybeSingle();
      if (error) throw new Error(error.message || 'Không thể tải báo cáo hôm nay.');
      return data || null;
    },

    async listTeamCheckins(organizationId, dateStr = getLocalDateString()) {
      if (!organizationId) return [];
      const sb = await requireSupabase();
      const { data, error } = await sb
        .from('daily_checkins')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('checkin_date', dateStr)
        .order('submitted_at', { ascending: false });
      if (error) throw new Error(error.message || 'Không thể tải tổng hợp check-in đội ngũ.');
      return data || [];
    },

    async submitDailyCheckin(input = {}) {
      const sb = await requireSupabase();
      const perTaskMinutes = input.perTaskMinutes && typeof input.perTaskMinutes === 'object'
        ? input.perTaskMinutes
        : {};
      const existingTaskMap = input.existingTaskMap instanceof Map
        ? input.existingTaskMap
        : new Map();
      const userId = String(input.userId || input.user_id || '').trim();
      const employeeId = String(input.employeeId || input.employee_id || '').trim() || null;

      let computedMinutes = 0;
      const warnings = [];
      let updatedTasksCount = 0;

      const validated = validateCheckinInput(input);

      for (const taskId of validated.completed_task_ids) {
        const current = existingTaskMap.get(String(taskId));
        if (!current || current.status !== 'done') {
          try {
            await taskRepo.updateTask(taskId, { status: 'done', progress: 100 });
            updatedTasksCount += 1;
          } catch (err) {
            warnings.push(`Không thể đánh dấu hoàn thành "${current?.title || taskId}": ${err?.message || err}`);
          }
        }
      }

      for (const taskId of validated.in_progress_task_ids) {
        if (validated.completed_task_ids.includes(taskId)) continue;
        const current = existingTaskMap.get(String(taskId));
        if (current && current.status === 'todo') {
          try {
            await taskRepo.updateTask(taskId, { status: 'doing', progress: Math.max(25, Number(current.progress) || 25) });
            updatedTasksCount += 1;
          } catch (err) {
            warnings.push(`Không thể cập nhật trạng thái "${current?.title || taskId}": ${err?.message || err}`);
          }
        }
      }

      for (const [taskId, minsRaw] of Object.entries(perTaskMinutes)) {
        const mins = Math.round(Number(minsRaw) || 0);
        if (mins > 0 && mins <= 1440) {
          computedMinutes += mins;
          try {
            await timeRepo.logTime({
              organizationId: validated.organization_id,
              taskId,
              minutes: mins,
              note: `Ghi nhanh qua Báo cáo hôm nay (${validated.checkin_date})`
            });
          } catch (err) {
            warnings.push(`Không thể ghi giờ làm việc: ${err?.message || err}`);
          }
        }
      }

      const finalMinutes = validated.minutes_logged > 0
        ? validated.minutes_logged
        : Math.min(1440, computedMinutes);

      const upsertPayload = {
        ...validated,
        user_id: userId,
        employee_id: employeeId,
        minutes_logged: finalMinutes,
        submitted_at: new Date().toISOString()
      };

      const { data, error } = await sb
        .from('daily_checkins')
        .upsert(upsertPayload, { onConflict: 'organization_id,user_id,checkin_date' })
        .select('*')
        .single();

      if (error) {
        throw new Error(error.message || 'Không thể lưu Check-in cuối ngày.');
      }

      return {
        checkin: data,
        updatedTasksCount,
        loggedMinutes: finalMinutes,
        warnings
      };
    }
  };
}

export const RecurringTasksService = createRecurringTasksService();
