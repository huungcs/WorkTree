/**
 * WorkTree X Feature: Recurring Tasks Hub Panel
 * Renders inside System Hub ("Cài đặt -> Việc định kỳ") so Owners, Admins, and
 * scoped Managers can configure role/job-title/employee recurring task templates,
 * preview impacted staff, trigger immediate generation, and inspect run logs.
 */

import { ICONS } from '../../../design-system/icons.js';
import {
  ASSIGNMENT_MODE_OPTIONS,
  CADENCE_OPTIONS,
  ORG_ROLE_OPTIONS,
  RecurringTasksService,
  WEEKDAY_LABELS,
  countMatchingEmployees,
  formatAssignmentLabel,
  formatCadenceLabel,
  getLocalDateString
} from '../services/recurring-tasks-service.js';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Thấp' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'high', label: 'Cao' },
  { value: 'critical', label: 'Khẩn cấp' }
];

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

export function injectRecurringStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('worktreeRecurringStyles')) return;
  const style = document.createElement('style');
  style.id = 'worktreeRecurringStyles';
  style.textContent = `
    .wt-rec-hub{display:flex;flex-direction:column;gap:18px;font-family:var(--font-sans);color:var(--text);min-width:0}
    .wt-rec-banner{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 20px;border-radius:var(--radius);background:var(--primary-soft);border:1px solid var(--line);flex-wrap:wrap}
    .wt-rec-banner-main{display:flex;align-items:flex-start;gap:14px;min-width:0;flex:1 1 320px}
    .wt-rec-banner-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:var(--surface);color:var(--primary-text);border:1px solid var(--line);flex-shrink:0}
    .wt-rec-banner-icon .icon{width:20px;height:20px}
    .wt-rec-banner h3{margin:0 0 4px;font-size:1.05rem;font-weight:700;color:var(--text)}
    .wt-rec-banner p{margin:0;font-size:.875rem;line-height:1.5;color:var(--muted)}
    .wt-rec-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    .wt-rec-card{border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);padding:18px;display:flex;flex-direction:column;gap:14px;min-width:0}
    .wt-rec-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .wt-rec-full{grid-column:1 / -1}
    .wt-rec-days{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
    .wt-rec-day-chip{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:38px;padding:0 10px;border-radius:var(--radius-md);border:1px solid var(--line);background:var(--surface-2);color:var(--text);font-size:.8125rem;font-weight:600;cursor:pointer;user-select:none;transition:background .15s,border-color .15s,color .15s}
    .wt-rec-day-chip input{position:absolute;opacity:0;pointer-events:none}
    .wt-rec-day-chip.is-selected{background:var(--primary-soft);border-color:var(--primary);color:var(--primary-text)}
    .wt-rec-list{display:flex;flex-direction:column;gap:10px}
    .wt-rec-item{border:1px solid var(--line);border-radius:var(--radius-lg);background:var(--surface);padding:14px 16px;display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;min-width:0}
    .wt-rec-item.is-paused{opacity:.72;background:var(--surface-2)}
    .wt-rec-item-body{min-width:0;flex:1 1 300px;display:flex;flex-direction:column;gap:6px}
    .wt-rec-item-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .wt-rec-item-title{margin:0;font-size:.95rem;font-weight:650;color:var(--text)}
    .wt-rec-item-desc{margin:0;font-size:.8125rem;color:var(--muted);line-height:1.45;word-break:break-word}
    .wt-rec-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
    .wt-rec-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:var(--radius-pill);font-size:.75rem;font-weight:600;border:1px solid var(--line);background:var(--surface-2);color:var(--text)}
    .wt-rec-pill.is-primary{background:var(--primary-soft);color:var(--primary-text);border-color:transparent}
    .wt-rec-pill.is-green{background:var(--green-soft);color:var(--green);border-color:transparent}
    .wt-rec-pill.is-amber{background:var(--amber-soft);color:var(--amber);border-color:transparent}
    .wt-rec-pill.is-red{background:var(--red-soft);color:var(--red);border-color:transparent}
    .wt-rec-pill .icon{width:13px;height:13px}
    .wt-rec-item-ops{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .wt-rec-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .wt-rec-section-head h4{margin:0;font-size:.9375rem;font-weight:700;color:var(--text)}
    .wt-rec-runs{display:flex;flex-direction:column;gap:6px}
    .wt-rec-run-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:var(--radius-md);background:var(--surface-2);border:1px solid var(--line);font-size:.8125rem;flex-wrap:wrap}

    .wt-chk-dialog{width:min(760px,calc(100vw - 24px));max-height:calc(100dvh - 32px);padding:0;border:1px solid var(--line);border-radius:var(--radius-dialog);background:var(--surface);color:var(--text);box-shadow:var(--shadow-lg);overflow:hidden;font-family:var(--font-sans)}
    .wt-chk-dialog[open]{display:flex;flex-direction:column}
    .wt-chk-dialog .dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 22px 14px;border-bottom:1px solid var(--line);flex-shrink:0}
    .wt-chk-dialog .dialog-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;padding:18px 22px;display:flex;flex-direction:column;gap:16px}
    .wt-chk-dialog .dialog-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 22px;padding-bottom:max(14px,env(safe-area-inset-bottom));border-top:1px solid var(--line);background:var(--surface-2);flex-shrink:0;flex-wrap:wrap}
    .wt-chk-tabs{display:flex;gap:6px;border-bottom:1px solid var(--line);padding:0 22px;background:var(--surface-2);flex-shrink:0;overflow-x:auto}
    .wt-chk-tab{display:inline-flex;align-items:center;gap:6px;min-height:42px;padding:8px 14px;border:none;border-bottom:2px solid transparent;background:transparent;color:var(--muted);font-family:var(--font-sans);font-size:.875rem;font-weight:600;cursor:pointer;white-space:nowrap}
    .wt-chk-tab[aria-selected="true"]{color:var(--primary-text);border-bottom-color:var(--primary)}
    .wt-chk-moods{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .wt-chk-mood-btn{display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-height:44px;padding:10px 12px;border-radius:var(--radius-lg);border:1px solid var(--line);background:var(--surface-2);color:var(--text);font-family:var(--font-sans);text-align:left;cursor:pointer;transition:border-color .15s,background .15s}
    .wt-chk-mood-btn strong{font-size:.875rem;display:flex;align-items:center;gap:6px}
    .wt-chk-mood-btn small{font-size:.75rem;color:var(--muted);line-height:1.35}
    .wt-chk-mood-btn.is-active[data-mood="green"]{background:var(--green-soft);border-color:var(--green);color:var(--green)}
    .wt-chk-mood-btn.is-active[data-mood="amber"]{background:var(--amber-soft);border-color:var(--amber);color:var(--amber)}
    .wt-chk-mood-btn.is-active[data-mood="red"]{background:var(--red-soft);border-color:var(--red);color:var(--red)}
    .wt-chk-task-list{display:flex;flex-direction:column;gap:8px}
    .wt-chk-task-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:var(--radius-md);border:1px solid var(--line);background:var(--surface-2);min-width:0}
    .wt-chk-task-main{display:flex;align-items:flex-start;gap:10px;min-width:0;flex:1 1 auto}
    .wt-chk-task-main input[type="checkbox"]{width:20px;height:20px;margin:2px 0 0;accent-color:var(--primary);flex-shrink:0;cursor:pointer}
    .wt-chk-task-title{font-size:.875rem;font-weight:600;color:var(--text);word-break:break-word}
    .wt-chk-task-meta{font-size:.75rem;color:var(--muted);margin-top:2px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
    .wt-chk-mins-wrap{display:flex;align-items:center;gap:4px;flex-shrink:0}
    .wt-chk-mins{width:68px;min-height:36px;padding:4px 8px;border:1px solid var(--line-strong);border-radius:var(--radius-md);background:var(--surface);color:var(--text);font-family:var(--font-sans);font-size:.8125rem;text-align:right}
    .wt-chk-team-card{border:1px solid var(--line);border-radius:var(--radius-lg);background:var(--surface-2);padding:14px;display:flex;flex-direction:column;gap:8px}
    .wt-chk-team-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}

    @media (max-width: 900px) {
      .wt-rec-form-grid{grid-template-columns:1fr}
      .wt-chk-dialog{width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;border-radius:0;border:none;margin:0}
      .wt-chk-moods{grid-template-columns:1fr}
      .wt-chk-task-row{flex-wrap:wrap}
      .wt-chk-mins-wrap{width:100%;justify-content:flex-end}
      .wt-rec-actions .btn,.wt-rec-item-ops .btn,.wt-chk-dialog .btn{min-height:44px}
    }
  `;
  document.head.appendChild(style);
}

export async function renderRecurringTasksHub({
  container,
  organizationId,
  userId = null,
  role = 'member',
  employees = [],
  nodes = [],
  tasks = [],
  isDemo = false,
  onTasksGenerated = async () => {},
  onOpenTask = () => {},
  onToast = () => {}
} = {}) {
  if (!container) return;
  injectRecurringStyles();

  const canManage = !isDemo && ['owner', 'admin', 'manager'].includes(role);
  const service = RecurringTasksService;
  const distinctJobTitles = [...new Set(
    (employees || [])
      .map(e => String(e.job_title || '').trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'vi'));

  const state = {
    loading: !isDemo && Boolean(organizationId),
    busy: false,
    error: '',
    templates: [],
    runs: [],
    editingId: null,
    showForm: false,
    pendingDeleteId: null,
    draft: createBlankDraft()
  };

  function createBlankDraft(tpl = null) {
    if (tpl) {
      return {
        title: tpl.title || '',
        description: tpl.description || '',
        nodeId: tpl.node_id || '',
        assignmentMode: tpl.assignment_mode || 'job_title',
        targetJobTitle: tpl.target_job_title || '',
        targetOrgRole: tpl.target_org_role || 'member',
        targetEmployeeId: tpl.target_employee_id || '',
        priority: tpl.priority || 'medium',
        estimateMinutes: Number(tpl.estimate_minutes ?? 30),
        dueOffsetDays: Number(tpl.due_offset_days ?? 0),
        tags: Array.isArray(tpl.tags) ? tpl.tags.join(', ') : '',
        checklistText: Array.isArray(tpl.checklist_items) ? tpl.checklist_items.join('\n') : '',
        cadence: tpl.cadence || 'weekdays',
        daysOfWeek: Array.isArray(tpl.days_of_week) ? tpl.days_of_week.map(Number) : [1, 2, 3, 4, 5],
        dayOfMonth: Number(tpl.day_of_month || 1),
        isActive: tpl.is_active !== false
      };
    }
    return {
      title: '',
      description: '',
      nodeId: '',
      assignmentMode: distinctJobTitles.length ? 'job_title' : 'org_role',
      targetJobTitle: distinctJobTitles[0] || '',
      targetOrgRole: 'member',
      targetEmployeeId: employees[0]?.id || '',
      priority: 'medium',
      estimateMinutes: 30,
      dueOffsetDays: 0,
      tags: 'hang-ngay',
      checklistText: '',
      cadence: 'weekdays',
      daysOfWeek: [1, 2, 3, 4, 5],
      dayOfMonth: 1,
      isActive: true
    };
  }

  async function loadAll() {
    if (isDemo || !organizationId) {
      state.loading = false;
      render();
      return;
    }
    state.loading = true;
    state.error = '';
    render();
    try {
      const [templates, runs] = await Promise.all([
        service.listTemplates(organizationId),
        service.listRecentRuns(organizationId, 30)
      ]);
      state.templates = templates;
      state.runs = runs;
    } catch (err) {
      state.error = err?.message || 'Không thể tải cấu hình việc định kỳ.';
    } finally {
      state.loading = false;
      render();
    }
  }

  function draftMatchPreview() {
    const mockTpl = {
      assignment_mode: state.draft.assignmentMode,
      target_job_title: state.draft.targetJobTitle,
      target_org_role: state.draft.targetOrgRole,
      target_employee_id: state.draft.targetEmployeeId
    };
    return countMatchingEmployees(mockTpl, { employees });
  }

  function renderForm() {
    if (!state.showForm || !canManage) return '';
    const d = state.draft;
    const matchCount = draftMatchPreview();
    const isEditing = Boolean(state.editingId);
    const activeNodes = (nodes || []).filter(n => !n.archived_at && n.type !== 'person');

    return `
      <form id="wtRecTemplateForm" class="wt-rec-card" aria-label="${isEditing ? 'Chỉnh sửa quy tắc việc định kỳ' : 'Tạo quy tắc việc định kỳ'}">
        <div class="wt-rec-section-head">
          <h4>${isEditing ? 'Chỉnh sửa quy tắc việc định kỳ' : 'Tạo quy tắc việc định kỳ mới'}</h4>
          <span class="wt-rec-pill is-primary">${ICONS.users} ${matchCount !== null ? `Khớp ${matchCount} nhân sự` : 'Theo vai trò hệ thống'}</span>
        </div>

        <div class="wt-rec-form-grid">
          <label class="field wt-rec-full">
            Tên đầu việc tạo tự động *
            <input id="wtRecTitle" type="text" required maxlength="240" value="${esc(d.title)}" placeholder="Ví dụ: Kiểm tra tồn kho & chốt doanh số ca">
          </label>

          <label class="field">
            Phân công theo
            <select id="wtRecAssignmentMode">
              ${ASSIGNMENT_MODE_OPTIONS.map(o => `<option value="${o.value}" ${d.assignmentMode === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
            </select>
          </label>

          ${d.assignmentMode === 'job_title' ? `
            <label class="field">
              Chức danh áp dụng *
              <input id="wtRecTargetJobTitle" list="wtRecJobTitleList" type="text" required maxlength="120" value="${esc(d.targetJobTitle)}" placeholder="Ví dụ: Nhân viên Kinh doanh">
              <datalist id="wtRecJobTitleList">
                ${distinctJobTitles.map(jt => `<option value="${esc(jt)}">`).join('')}
              </datalist>
            </label>
          ` : d.assignmentMode === 'org_role' ? `
            <label class="field">
              Vai trò hệ thống *
              <select id="wtRecTargetOrgRole">
                ${ORG_ROLE_OPTIONS.map(r => `<option value="${r.value}" ${d.targetOrgRole === r.value ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}
              </select>
            </label>
          ` : `
            <label class="field">
              Nhân sự áp dụng *
              <select id="wtRecTargetEmployee">
                <option value="">-- Chọn nhân sự --</option>
                ${(employees || []).map(e => `<option value="${esc(e.id)}" ${String(d.targetEmployeeId) === String(e.id) ? 'selected' : ''}>${esc(e.full_name || e.name)}${e.job_title ? ` (${esc(e.job_title)})` : ''}</option>`).join('')}
              </select>
            </label>
          `}

          <label class="field">
            Chu kỳ lặp lại
            <select id="wtRecCadence">
              ${CADENCE_OPTIONS.map(o => `<option value="${o.value}" ${d.cadence === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
            </select>
          </label>

          <label class="field">
            Đơn vị / Nhánh tạo việc ${role === 'manager' ? '*' : '(tùy chọn)'}
            <select id="wtRecNodeId" ${role === 'manager' ? 'required' : ''}>
              ${role === 'manager' ? '<option value="">-- Chọn nhánh thuộc quyền --</option>' : '<option value="">Tự động theo phòng/nhánh của nhân sự</option>'}
              ${activeNodes.map(n => `<option value="${esc(n.id)}" ${String(d.nodeId) === String(n.id) ? 'selected' : ''}>${esc(n.name)}</option>`).join('')}
            </select>
          </label>

          ${d.cadence === 'weekly' ? `
            <div class="field wt-rec-full">
              <span>Chọn các thứ trong tuần</span>
              <div class="wt-rec-days">
                ${WEEKDAY_LABELS.map(w => {
                  const active = d.daysOfWeek.includes(w.day);
                  return `<label class="wt-rec-day-chip ${active ? 'is-selected' : ''}"><input type="checkbox" data-rec-dow="${w.day}" ${active ? 'checked' : ''}>${w.short}</label>`;
                }).join('')}
              </div>
            </div>
          ` : ''}

          ${d.cadence === 'monthly' ? `
            <label class="field">
              Ngày lặp trong tháng (1–31)
              <input id="wtRecDayOfMonth" type="number" min="1" max="31" value="${Number(d.dayOfMonth) || 1}">
            </label>
          ` : ''}

          <label class="field">
            Mức độ ưu tiên
            <select id="wtRecPriority">
              ${PRIORITY_OPTIONS.map(p => `<option value="${p.value}" ${d.priority === p.value ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}
            </select>
          </label>

          <label class="field">
            Thời gian dự kiến (phút)
            <input id="wtRecEstimateMinutes" type="number" min="0" max="60000" step="5" value="${Number(d.estimateMinutes) || 0}">
          </label>

          <label class="field">
            Hạn hoàn thành (sau số ngày)
            <select id="wtRecDueOffset">
              <option value="0" ${Number(d.dueOffsetDays) === 0 ? 'selected' : ''}>Trong ngày (hết hôm nay)</option>
              <option value="1" ${Number(d.dueOffsetDays) === 1 ? 'selected' : ''}>Sau 1 ngày (hôm sau)</option>
              <option value="2" ${Number(d.dueOffsetDays) === 2 ? 'selected' : ''}>Sau 2 ngày</option>
              <option value="7" ${Number(d.dueOffsetDays) === 7 ? 'selected' : ''}>Sau 7 ngày</option>
            </select>
          </label>

          <label class="field">
            Nhãn thẻ (cách nhau bằng dấu phẩy)
            <input id="wtRecTags" type="text" value="${esc(d.tags)}" placeholder="hang-ngay, van-hanh">
          </label>

          <label class="field wt-rec-full">
            Hướng dẫn chi tiết (mô tả đầu việc)
            <textarea id="wtRecDesc" rows="2" maxlength="10000" placeholder="Ghi chú quy chuẩn thực hiện, link biểu mẫu hoặc KPI cần đạt...">${esc(d.description)}</textarea>
          </label>

          <label class="field wt-rec-full">
            Checklist chuẩn tự động chèn vào việc (mỗi dòng 1 bước)
            <textarea id="wtRecChecklist" rows="3" placeholder="Kiểm tra tồn đầu ca&#10;Cập nhật CRM 100% khách phát sinh&#10;Bấm Báo cáo hôm nay trước 17:30">${esc(d.checklistText)}</textarea>
          </label>
        </div>

        <div class="wt-rec-actions" style="justify-content:flex-end">
          <button type="button" class="btn" data-rec-action="cancel-form">Hủy</button>
          <button type="submit" class="btn primary" ${state.busy ? 'disabled' : ''}>
            ${ICONS.check}<span>${state.busy ? 'Đang lưu...' : (isEditing ? 'Lưu thay đổi' : 'Lưu quy tắc & Áp dụng')}</span>
          </button>
        </div>
      </form>
    `;
  }

  function renderTemplates() {
    if (isDemo) {
      return `
        <div class="wt-rec-card">
          <p class="view-note" style="margin:0">Bạn đang ở chế độ Demo cục bộ. Đăng nhập Không gian Đám mây để thiết lập Việc định kỳ theo Chức danh/Vai trò và đồng bộ tạo việc tự động qua Cron hằng ngày.</p>
        </div>
      `;
    }
    if (state.loading) {
      return `<div class="wt-rec-card"><p class="view-note" style="margin:0">Đang tải cấu hình việc định kỳ...</p></div>`;
    }
    if (state.error) {
      return `<div class="wt-rec-card"><p class="view-note" style="margin:0;color:var(--red)">${esc(state.error)}</p></div>`;
    }
    if (!state.templates.length) {
      return `
        <div class="empty-state">
          <h3>Chưa có quy tắc việc định kỳ nào</h3>
          <p>${canManage ? 'Bấm “+ Tạo quy tắc định kỳ” để tự động giao việc lặp lại mỗi sáng cho từng chức danh (Kinh doanh, Kế toán, Kho...) hoặc từng vai trò.' : 'Quản lý chưa thiết lập quy tắc việc định kỳ nào trong không gian này.'}</p>
        </div>
      `;
    }

    const empNameMap = new Map((employees || []).map(e => [String(e.id), e.full_name || e.name]));
    const tplMap = new Map(state.templates.map(t => [String(t.id), t]));
    const taskMap = new Map((tasks || []).map(t => [String(t.id), t]));

    return `
      <div class="wt-rec-list">
        ${state.templates.map(tpl => {
          const matchCount = countMatchingEmployees(tpl, { employees });
          const checklistLen = Array.isArray(tpl.checklist_items) ? tpl.checklist_items.length : 0;
          const confirmingDelete = state.pendingDeleteId === tpl.id;
          return `
            <article class="wt-rec-item ${tpl.is_active ? '' : 'is-paused'}">
              <div class="wt-rec-item-body">
                <div class="wt-rec-item-head">
                  <h4 class="wt-rec-item-title">${esc(tpl.title)}</h4>
                  <span class="wt-rec-pill ${tpl.is_active ? 'is-green' : 'is-amber'}">${tpl.is_active ? 'Đang bật' : 'Tạm dừng'}</span>
                </div>
                ${tpl.description ? `<p class="wt-rec-item-desc">${esc(tpl.description)}</p>` : ''}
                <div class="wt-rec-meta">
                  <span class="wt-rec-pill is-primary">${ICONS.users} ${esc(formatAssignmentLabel(tpl, { employees }))}${matchCount !== null ? ` (${matchCount} người)` : ''}</span>
                  <span class="wt-rec-pill">${ICONS.calendar} ${esc(formatCadenceLabel(tpl))}</span>
                  <span class="wt-rec-pill">${ICONS.clock} ${Number(tpl.estimate_minutes) || 0} phút</span>
                  ${checklistLen > 0 ? `<span class="wt-rec-pill">${ICONS.check} ${checklistLen} bước checklist</span>` : ''}
                  ${tpl.last_generated_date ? `<span class="wt-rec-pill">Tạo gần nhất: ${esc(tpl.last_generated_date)}</span>` : ''}
                </div>
              </div>
              ${canManage ? `
                <div class="wt-rec-item-ops">
                  <button type="button" class="btn small" data-rec-action="toggle-active" data-rec-id="${esc(tpl.id)}" ${state.busy ? 'disabled' : ''}>
                    ${tpl.is_active ? 'Tạm dừng' : 'Bật lại'}
                  </button>
                  <button type="button" class="btn small" data-rec-action="edit" data-rec-id="${esc(tpl.id)}" ${state.busy ? 'disabled' : ''}>
                    ${ICONS.edit} Sửa
                  </button>
                  ${confirmingDelete ? `
                    <button type="button" class="btn small danger" data-rec-action="delete-confirm" data-rec-id="${esc(tpl.id)}" ${state.busy ? 'disabled' : ''}>Xác nhận xóa</button>
                    <button type="button" class="btn small" data-rec-action="delete-cancel">Hủy</button>
                  ` : `
                    <button type="button" class="btn small" data-rec-action="delete-ask" data-rec-id="${esc(tpl.id)}" ${state.busy ? 'disabled' : ''}>Xóa</button>
                  `}
                </div>
              ` : ''}
            </article>
          `;
        }).join('')}
      </div>

      ${state.runs.length ? `
        <div class="wt-rec-card">
          <div class="wt-rec-section-head">
            <h4>Lịch sử tự động sinh việc gần đây</h4>
            <span class="wt-rec-pill">${state.runs.length} lượt gần nhất</span>
          </div>
          <div class="wt-rec-runs">
            ${state.runs.slice(0, 12).map(run => {
              const tpl = tplMap.get(String(run.template_id));
              const empName = run.employee_id ? (empNameMap.get(String(run.employee_id)) || 'Nhân sự') : 'Chưa gán';
              const liveTask = run.task_id ? taskMap.get(String(run.task_id)) : null;
              return `
                <div class="wt-rec-run-row">
                  <span><strong>${esc(tpl?.title || 'Quy tắc đã xóa')}</strong> · ${esc(empName)}</span>
                  <div class="wt-rec-actions">
                    <span class="wt-rec-pill">${esc(run.run_date)}</span>
                    ${liveTask ? `<button type="button" class="btn small" data-rec-action="open-task" data-task-id="${esc(run.task_id)}">Mở việc</button>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
    `;
  }

  function syncDraftFromDom() {
    const form = container.querySelector('#wtRecTemplateForm');
    if (!form) return;
    const val = id => form.querySelector(id)?.value;
    state.draft.title = val('#wtRecTitle') ?? state.draft.title;
    state.draft.assignmentMode = val('#wtRecAssignmentMode') ?? state.draft.assignmentMode;
    if (form.querySelector('#wtRecTargetJobTitle')) state.draft.targetJobTitle = val('#wtRecTargetJobTitle');
    if (form.querySelector('#wtRecTargetOrgRole')) state.draft.targetOrgRole = val('#wtRecTargetOrgRole');
    if (form.querySelector('#wtRecTargetEmployee')) state.draft.targetEmployeeId = val('#wtRecTargetEmployee');
    state.draft.cadence = val('#wtRecCadence') ?? state.draft.cadence;
    state.draft.nodeId = val('#wtRecNodeId') ?? state.draft.nodeId;
    if (form.querySelector('#wtRecDayOfMonth')) state.draft.dayOfMonth = Number(val('#wtRecDayOfMonth')) || 1;
    state.draft.priority = val('#wtRecPriority') ?? state.draft.priority;
    state.draft.estimateMinutes = Number(val('#wtRecEstimateMinutes') ?? 30);
    state.draft.dueOffsetDays = Number(val('#wtRecDueOffset') ?? 0);
    state.draft.tags = val('#wtRecTags') ?? '';
    state.draft.description = val('#wtRecDesc') ?? '';
    state.draft.checklistText = val('#wtRecChecklist') ?? '';
    const dows = [...form.querySelectorAll('[data-rec-dow]')];
    if (dows.length) {
      state.draft.daysOfWeek = dows.filter(el => el.checked).map(el => Number(el.dataset.recDow));
    }
  }

  function render() {
    container.innerHTML = `
      <section class="wt-rec-hub" aria-label="Thiết lập Việc định kỳ theo vai trò">
        <div class="wt-rec-banner">
          <div class="wt-rec-banner-main">
            <span class="wt-rec-banner-icon" aria-hidden="true">${ICONS.calendar}</span>
            <div>
              <h3>Việc định kỳ theo Vai trò &amp; Chức danh</h3>
              <p>Hệ thống tự động sinh công việc hằng ngày (00:05 giờ Việt Nam) cho từng nhân sự khớp Chức danh, Vai trò hoặc cá nhân được chỉ định — mỗi công việc có sẵn checklist và nhãn <code>recurring</code>.</p>
            </div>
          </div>
          ${canManage ? `
            <div class="wt-rec-actions">
              <button type="button" class="btn" data-rec-action="run-now" ${state.busy ? 'disabled' : ''}>
                ${ICONS.clock}<span>Chạy tạo việc hôm nay</span>
              </button>
              <button type="button" class="btn primary" data-rec-action="new-form" ${state.busy ? 'disabled' : ''}>
                ${ICONS.plus}<span>Tạo quy tắc định kỳ</span>
              </button>
            </div>
          ` : ''}
        </div>

        ${renderForm()}
        ${renderTemplates()}
      </section>
    `;

    const form = container.querySelector('#wtRecTemplateForm');
    if (form) {
      form.querySelector('#wtRecAssignmentMode')?.addEventListener('change', () => {
        syncDraftFromDom();
        render();
      });
      form.querySelector('#wtRecCadence')?.addEventListener('change', () => {
        syncDraftFromDom();
        render();
      });
      form.querySelectorAll('#wtRecTargetJobTitle,#wtRecTargetOrgRole,#wtRecTargetEmployee').forEach(el => {
        el.addEventListener('change', () => {
          syncDraftFromDom();
          render();
        });
      });
      form.querySelectorAll('[data-rec-dow]').forEach(el => {
        el.addEventListener('change', () => {
          syncDraftFromDom();
          render();
        });
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (state.busy) return;
        syncDraftFromDom();
        state.busy = true;
        render();
        try {
          const payload = {
            organizationId,
            ...state.draft,
            daysOfWeek: state.draft.daysOfWeek,
            dayOfMonth: state.draft.dayOfMonth
          };
          if (state.editingId) {
            await service.updateTemplate(organizationId, state.editingId, payload);
            onToast('Đã cập nhật quy tắc việc định kỳ.');
          } else {
            await service.createTemplate(payload, userId);
            onToast('Đã tạo quy tắc việc định kỳ mới.');
          }
          // Generate immediately for today if due today so creator sees instant effect
          try {
            const genRes = await service.generateForOrganization(organizationId, getLocalDateString());
            if (genRes?.created > 0) {
              await onTasksGenerated();
              onToast(`Đã tự động tạo ${genRes.created} đầu việc định kỳ cho hôm nay.`);
            }
          } catch (_) {}
          state.showForm = false;
          state.editingId = null;
          state.draft = createBlankDraft();
          await loadAll();
        } catch (err) {
          onToast(err?.message || 'Không thể lưu quy tắc.', 'error');
          state.busy = false;
          render();
        }
      });
    }

    container.querySelectorAll('[data-rec-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.recAction;
        const id = btn.dataset.recId;
        if (action === 'new-form') {
          state.editingId = null;
          state.draft = createBlankDraft();
          state.showForm = true;
          render();
          container.querySelector('#wtRecTitle')?.focus();
          return;
        }
        if (action === 'cancel-form') {
          state.showForm = false;
          state.editingId = null;
          render();
          return;
        }
        if (action === 'edit' && id) {
          const tpl = state.templates.find(t => t.id === id);
          if (!tpl) return;
          state.editingId = tpl.id;
          state.draft = createBlankDraft(tpl);
          state.showForm = true;
          render();
          container.querySelector('#wtRecTitle')?.focus();
          return;
        }
        if (action === 'toggle-active' && id) {
          const tpl = state.templates.find(t => t.id === id);
          if (!tpl || state.busy) return;
          state.busy = true;
          render();
          try {
            await service.toggleTemplateActive(organizationId, id, !tpl.is_active);
            onToast(tpl.is_active ? 'Đã tạm dừng quy tắc.' : 'Đã bật lại quy tắc.');
            await loadAll();
          } catch (err) {
            onToast(err?.message || 'Không thể đổi trạng thái.', 'error');
            state.busy = false;
            render();
          }
          return;
        }
        if (action === 'delete-ask' && id) {
          state.pendingDeleteId = id;
          render();
          return;
        }
        if (action === 'delete-cancel') {
          state.pendingDeleteId = null;
          render();
          return;
        }
        if (action === 'delete-confirm' && id) {
          if (state.busy) return;
          state.busy = true;
          render();
          try {
            await service.deleteTemplate(organizationId, id);
            state.pendingDeleteId = null;
            onToast('Đã xóa quy tắc việc định kỳ.');
            await loadAll();
          } catch (err) {
            onToast(err?.message || 'Không thể xóa quy tắc.', 'error');
            state.busy = false;
            render();
          }
          return;
        }
        if (action === 'run-now') {
          if (state.busy) return;
          state.busy = true;
          render();
          try {
            const res = await service.generateForOrganization(organizationId, getLocalDateString());
            const created = Number(res?.created || 0);
            const skipped = Number(res?.skipped || 0);
            if (created > 0) {
              await onTasksGenerated();
              onToast(`Đã sinh ${created} đầu việc định kỳ cho hôm nay${skipped ? ` (${skipped} việc đã có trước đó)` : ''}.`);
            } else {
              onToast(`Hôm nay chưa có thêm đầu việc định kỳ mới cần sinh${skipped ? ` (${skipped} việc đã được tạo sẵn)` : ''}.`);
            }
            await loadAll();
          } catch (err) {
            onToast(err?.message || 'Không thể chạy tạo việc tự động.', 'error');
            state.busy = false;
            render();
          }
          return;
        }
        if (action === 'open-task' && btn.dataset.taskId) {
          onOpenTask(btn.dataset.taskId);
        }
      });
    });
  }

  await loadAll();
}
