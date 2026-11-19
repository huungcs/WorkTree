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

const NODE_TYPE_LABELS = {
  company: 'Công ty',
  department: 'Phòng ban',
  project: 'Dự án',
  team: 'Nhóm',
  folder: 'Thư mục'
};

const NODE_TYPE_ICONS = {
  company: ICONS.building,
  department: ICONS.building,
  project: ICONS.kanban,
  team: ICONS.users,
  folder: ICONS.folder
};

const UNFOLD_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 15 12 20 17 15"/><polyline points="7 9 12 4 17 9"/></svg>';

const DEMO_RULES = [
  { id: 'demo-sales', title: 'Gọi lại khách quan tâm', assignment_mode: 'job_title', target_job_title: 'Nhân viên kinh doanh', cadence: 'weekdays', estimate_minutes: 30, checklist_items: ['Xem danh sách khách', 'Ghi kết quả cuộc gọi'], is_active: true },
  { id: 'demo-stock', title: 'Kiểm tra tồn kho đầu ca', assignment_mode: 'job_title', target_job_title: 'Nhân viên kho', cadence: 'daily', estimate_minutes: 20, checklist_items: ['Đối chiếu số liệu'], is_active: true },
  { id: 'demo-weekly', title: 'Tổng hợp công việc trong tuần', assignment_mode: 'org_role', target_org_role: 'manager', cadence: 'weekly', days_of_week: [5], estimate_minutes: 25, is_active: false }
];

const activeHubRender = new WeakMap();

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function foldText(str) {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function formatRunDate(value) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  return parts ? `${parts[3]}/${parts[2]}/${parts[1]}` : value || 'Chưa ghi nhận';
}

function getInitials(name) {
  const parts = String(name || 'N').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return String(name || 'N').trim().slice(0, 2).toUpperCase();
}

function avatarColorIndex(idOrName) {
  let hash = 0;
  const s = String(idOrName || '');
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 6;
}

export function injectRecurringStyles() {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById('worktreeRecurringStyles');
  const css = `
    .wt-rec-hub{display:flex;flex-direction:column;gap:18px;font-family:var(--font-sans);color:var(--text);min-width:0}
    .wt-rec-banner{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:0 0 16px;border-bottom:1px solid var(--line);flex-wrap:wrap}
    .wt-rec-banner-main{display:flex;align-items:flex-start;gap:14px;min-width:0;flex:1 1 320px}
    .wt-rec-banner-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:var(--radius-lg,10px);background:var(--primary-soft);color:var(--primary-text);flex-shrink:0}
    .wt-rec-banner-icon .icon{width:20px;height:20px}
    .wt-rec-banner h3{margin:0 0 4px;font-size:var(--text-dialog-title);font-weight:var(--weight-strong);color:var(--text)}
    .wt-rec-banner p{margin:0;font-size:var(--text-control);line-height:var(--leading-copy);color:var(--muted)}
    .wt-rec-note,#wtRecTemplateForm .field-hint{margin:0;font-size:var(--text-sm);font-weight:var(--weight-regular);line-height:var(--leading-copy);color:var(--muted)}
    .wt-rec-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    .wt-rec-card{border:1px solid var(--line);border-radius:var(--radius,14px);background:var(--surface);padding:18px;display:flex;flex-direction:column;gap:14px;min-width:0}
    .wt-rec-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .wt-rec-form-grid>.field:not(.wt-rec-full){grid-column:auto;min-width:0}
    .wt-rec-full{grid-column:1 / -1;min-width:0}
    .wt-rec-hub .field input:not([type="checkbox"]):not([type="radio"]),.wt-rec-hub .field select,.wt-rec-hub .field textarea{border-radius:var(--radius-md,8px)}
    .wt-rec-hub .node-picker-popover,.wt-rec-hub .owner-picker-popover{left:0;right:auto;width:min(520px,100%);border-radius:var(--radius-lg,10px)}
    .wt-rec-form-heading{margin:2px 0 0;padding-top:12px;border-top:1px solid var(--line);font-size:var(--text-control);font-weight:var(--weight-strong)}
    #wtRecTemplateForm .field-title{color:var(--muted);font-size:var(--text-label);font-weight:var(--weight-semibold)}
    .wt-rec-form-actions{justify-content:flex-end;padding-top:12px;border-top:1px solid var(--line)}
    .wt-rec-job-picker{position:relative;min-width:0}
    .wt-rec-job-picker:has([data-rec-job-toggle]) #wtRecTargetJobTitle{padding-inline-end:46px}
    .wt-rec-job-toggle{position:absolute;inset-block-start:4px;inset-inline-end:4px}
    .wt-rec-job-toggle[aria-expanded="true"]{color:var(--primary-text)}
    .wt-rec-job-toggle[aria-expanded="true"] .icon{transform:rotate(180deg)}
    .wt-rec-job-menu{position:absolute;inset:calc(100% + 6px) 0 auto;z-index:20;max-height:min(242px,40dvh);overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;padding:5px;border:1px solid var(--line-strong);border-radius:var(--radius-lg,10px);background:var(--surface);box-shadow:var(--shadow-lg)}
    .wt-rec-job-option{display:flex;align-items:center;gap:8px;width:100%;min-height:36px;padding:6px 8px;border-radius:var(--radius-md,8px);background:transparent;color:var(--text);text-align:start;font-size:var(--text-control);font-weight:var(--weight-regular);line-height:var(--leading-copy)}
    .wt-rec-job-option:hover{background:var(--surface-2)}
    .wt-rec-job-option[aria-pressed="true"]{background:var(--primary-soft);color:var(--primary-text);font-weight:var(--weight-medium)}
    .wt-rec-job-option:focus-visible{outline-offset:-2px}
    .wt-rec-job-option-name{min-width:0;flex:1;overflow-wrap:anywhere}
    .wt-rec-job-count{flex:none;color:var(--muted);font-size:var(--text-sm);font-weight:var(--weight-regular);font-variant-numeric:tabular-nums}
    .wt-rec-job-empty{margin:0;padding:8px;color:var(--muted);font-size:var(--text-label)}
    .wt-rec-days{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
    .wt-rec-day-chip{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:38px;padding:0 10px;border-radius:var(--radius-md,8px);border:1px solid var(--line);background:var(--surface-2);color:var(--text);font-size:var(--text-control);font-weight:var(--weight-medium);cursor:pointer;user-select:none;transition:background .15s,border-color .15s,color .15s}
    .wt-rec-day-chip input{position:absolute;opacity:0;pointer-events:none}
    .wt-rec-day-chip:has(input:checked){background:var(--primary-soft);border-color:var(--primary);color:var(--primary-text)}
    .wt-rec-day-chip:has(input:focus-visible){outline:2px solid var(--focus);outline-offset:2px}
    .wt-rec-list{display:flex;flex-direction:column;gap:10px}
    .wt-rec-list-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .wt-rec-list-toolbar .inline-search{min-width:0;min-height:38px;max-width:360px}
    .wt-rec-list-toolbar select{min-height:38px;padding:6px 9px;border:1px solid var(--line-strong);border-radius:var(--radius-md);font-size:var(--text-control)}
    .wt-rec-list-results{display:grid;gap:8px;min-width:0}
    .wt-rec-run-date{margin:4px 0;font-size:var(--text-label);font-weight:var(--weight-semibold);color:var(--muted)}
    .wt-rec-run-row>span{min-width:0;overflow-wrap:anywhere}
    .wt-rec-item{border:1px solid var(--line);border-radius:var(--radius-lg,10px);background:var(--surface);padding:14px 16px;display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;min-width:0}
    .wt-rec-item.is-paused{background:var(--surface-2)}
    .wt-rec-item-body{min-width:0;flex:1 1 300px;display:flex;flex-direction:column;gap:6px}
    .wt-rec-item-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .wt-rec-item-title{margin:0;font-size:var(--text-md);font-weight:var(--weight-strong);color:var(--text);overflow-wrap:anywhere}
    .wt-rec-item-desc{margin:0;font-size:var(--text-control);font-weight:var(--weight-regular);color:var(--muted);line-height:var(--leading-copy);overflow-wrap:anywhere}
    .wt-rec-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
    .wt-rec-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:var(--radius-badge,5px);font-size:var(--text-label);font-weight:var(--weight-semibold);background:var(--surface-3);color:var(--muted);max-width:100%;overflow-wrap:anywhere}
    .wt-rec-pill.is-primary{background:var(--primary-soft);color:var(--primary-text);border-color:transparent}
    .wt-rec-pill.is-green{background:var(--green-soft);color:var(--green);border-color:transparent}
    .wt-rec-pill.is-amber{background:var(--amber-soft);color:var(--amber);border-color:transparent}
    .wt-rec-pill.is-red{background:var(--red-soft);color:var(--red);border-color:transparent}
    .wt-rec-pill .icon{width:13px;height:13px;flex:none}
    .wt-rec-hub .wt-rec-meta .wt-rec-pill{font-weight:var(--weight-regular)}
    .wt-rec-item-ops{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .wt-rec-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .wt-rec-section-head h4{margin:0;font-size:var(--text-md);font-weight:var(--weight-strong);color:var(--text)}
    .wt-rec-history summary{display:flex;justify-content:space-between;gap:8px;align-items:center;cursor:pointer;font-weight:var(--weight-semibold);min-height:36px}
    .wt-rec-history summary::-webkit-details-marker{display:none}
    .wt-rec-history[open] summary>.icon{transform:rotate(180deg)}
    .wt-rec-history .wt-rec-runs{margin-top:12px;max-height:360px;overflow:auto}
    .wt-rec-runs{display:flex;flex-direction:column;gap:6px}
    .wt-rec-run-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:var(--radius-md,8px);background:var(--surface-2);border:1px solid var(--line);font-size:var(--text-control);flex-wrap:wrap}

    #wtDailyCheckinDialog{width:720px;max-height:calc(100dvh - 48px);border-radius:var(--radius-dialog,17px)}
    .wt-chk-dialog[open]{display:flex;flex-direction:column}
    .wt-chk-dialog .dialog-head{align-items:center;padding-block:16px}
    .wt-chk-heading{display:flex;align-items:center;gap:12px;min-width:0;overflow-wrap:anywhere}
    .wt-chk-heading-icon{display:grid;place-items:center;width:40px;height:40px;flex:none;border-radius:var(--radius-lg,10px);background:var(--primary-soft);color:var(--primary-text)}
    .wt-chk-note{margin:0;color:var(--muted);font-size:var(--text-label);line-height:var(--leading-copy)}
    .wt-chk-heading .wt-chk-note{margin-top:3px}
    #wtDailyCheckinDialog .dialog-scroll{flex:1 1 auto;min-height:0;max-height:none;overflow:auto;overscroll-behavior:contain;scroll-padding:16px;display:grid;align-content:start;gap:16px}
    .wt-chk-tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);padding:8px 24px;background:var(--surface-2);flex:none;overflow-x:auto}
    .wt-chk-tab{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:5px 10px;border:0;border-radius:var(--radius-md,8px);background:transparent;color:var(--muted);font-size:var(--text-control);font-weight:var(--weight-semibold);cursor:pointer;white-space:nowrap}
    .wt-chk-tab:is([aria-selected="true"],[aria-pressed="true"]){color:var(--primary-text);background:var(--primary-soft)}
    #wtDailyCheckinDialog .wt-chk-form{display:grid;gap:16px;max-height:none;min-width:0}
    .wt-chk-form .field{min-width:0;grid-column:auto}
    .wt-chk-section{display:grid;gap:8px;min-width:0}
    .wt-chk-section h3{margin:0;font-size:var(--text-control);font-weight:var(--weight-strong)}
    .wt-chk-submitted{justify-self:start}
    .wt-chk-moods{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .wt-chk-mood-btn{display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-height:44px;padding:10px 12px;border-radius:var(--radius-lg,10px);border:1px solid var(--line);background:var(--surface-2);color:var(--text);font:inherit;text-align:left;cursor:pointer}
    .wt-chk-mood-btn strong{font-size:var(--text-control);display:flex;align-items:center;gap:6px}
    .wt-chk-mood-btn small{font-size:var(--text-label);color:var(--muted);line-height:1.35}
    .wt-chk-mood-btn:hover{border-color:var(--line-strong)}
    .wt-chk-mood-btn:is(.is-active,[aria-pressed="true"]):is([data-mood="green"],[data-chk-mood="green"]){background:var(--green-soft);border-color:var(--green);color:var(--green)}
    .wt-chk-mood-btn:is(.is-active,[aria-pressed="true"]):is([data-mood="amber"],[data-chk-mood="amber"]){background:var(--amber-soft);border-color:var(--amber);color:var(--amber)}
    .wt-chk-mood-btn:is(.is-active,[aria-pressed="true"]):is([data-mood="red"],[data-chk-mood="red"]){background:var(--red-soft);border-color:var(--red);color:var(--red)}
    .wt-chk-task-list{display:grid;gap:8px}
    .wt-chk-task-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 10px;border-radius:var(--radius-lg,10px);border:1px solid var(--line);background:var(--surface);min-width:0}
    .wt-chk-task-row:has([data-chk-task]:checked){background:var(--surface-2);border-color:var(--line-strong)}
    .wt-chk-task-main{display:flex;align-items:center;gap:9px;min-width:0;min-height:44px;padding-block:6px;flex:1;cursor:pointer}
    .wt-chk-task-copy{min-width:0;overflow-wrap:anywhere}
    .wt-chk-task-main input[type="checkbox"]{width:20px;height:20px;margin:0;accent-color:var(--primary);flex:none;cursor:pointer}
    .wt-chk-task-title{font-size:var(--text-control);font-weight:var(--weight-semibold)}
    .wt-chk-task-meta{font-size:var(--text-label);color:var(--muted);margin-top:2px;display:flex;flex-wrap:wrap;gap:5px;align-items:center}
    .wt-chk-mins-wrap{display:flex;align-items:center;gap:4px;flex:none}
    .wt-chk-mins{width:64px;min-height:36px;padding:4px 8px;border:1px solid var(--line-strong);border-radius:var(--radius-md,8px);background:var(--surface);color:var(--text);font:inherit;text-align:right}
    .wt-chk-team-card{border:1px solid var(--line);border-radius:var(--radius-lg,10px);background:var(--surface-2);padding:14px;display:flex;flex-direction:column;gap:8px;overflow-wrap:anywhere}
    .wt-chk-team-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
    .wt-chk-team{display:grid;gap:12px;min-width:0}
    .wt-chk-team-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0}
    .wt-chk-team-metrics>div{padding:10px 12px;border:1px solid var(--line);border-radius:var(--radius-lg);background:var(--surface-2);min-width:0}
    .wt-chk-team-metrics dt{font-size:var(--text-label);color:var(--muted)}
    .wt-chk-team-metrics dd{margin:2px 0 0;font-size:var(--text-lg);font-weight:var(--weight-strong);font-variant-numeric:tabular-nums}
    .wt-chk-team-metrics .has-support{color:var(--amber)}
    .wt-chk-team-card.needs-support{border-inline-start:3px solid var(--amber)}
    .wt-chk-team-card h5{margin:0;font-size:var(--text-control);font-weight:var(--weight-semibold)}
    .wt-chk-report-copy,.wt-chk-report-blocker{margin:0;font-size:var(--text-control);line-height:var(--leading-copy);white-space:pre-wrap}
    .wt-chk-report-blocker{padding:8px 10px;border-radius:var(--radius-md);background:var(--amber-soft);color:var(--amber)}
    .wt-chk-team button[aria-pressed="true"]{background:var(--primary-soft);color:var(--primary-text);border-color:var(--primary)}

    @media (max-width: 900px) {
      #hubPanelRecurring .wt-rec-hub{gap:14px}
      #hubPanelRecurring .wt-rec-banner{gap:10px;padding-bottom:12px}
      #hubPanelRecurring .wt-rec-banner p{font-size:var(--text-base)}
      #hubPanelRecurring .wt-rec-note{font-size:var(--text-label)}
      #hubPanelRecurring .wt-rec-list-toolbar{display:grid;grid-template-columns:minmax(0,1fr)}
      #hubPanelRecurring .wt-rec-list-toolbar .inline-search{max-width:none}
      .wt-rec-form-grid{grid-template-columns:minmax(0,1fr)}
      .wt-rec-hub .wt-rec-form-grid :is(input:not([type="checkbox"]):not([type="radio"]),select,textarea){font-size:var(--text-entry);min-height:44px}
      .wt-rec-hub .wt-rec-form-actions>.btn{flex:1 1 auto;justify-content:center}
      .wt-rec-card,.wt-rec-item{padding:12px}
      .wt-rec-list-toolbar .inline-search,.wt-rec-list-toolbar select{min-height:44px}
      .wt-rec-list-toolbar .inline-search input{font-size:var(--text-entry)}
      .wt-rec-banner-main{flex-basis:100%;gap:10px}
      .wt-rec-banner>.wt-rec-actions,.wt-rec-item-ops{width:100%}
      .wt-rec-banner>.wt-rec-actions>.btn{flex:1 1 auto}
      .wt-rec-item-ops{padding-top:8px;border-top:1px solid var(--line)}
      .wt-rec-item-ops .btn{flex:1 1 auto}
      .wt-rec-day-chip,.wt-rec-history summary{min-height:44px}
      .wt-rec-job-toggle{inset-block-start:2px;width:44px;height:44px}
      .wt-rec-job-picker:has([data-rec-job-toggle]) #wtRecTargetJobTitle{min-height:48px;padding-inline-end:52px}
      .wt-rec-job-option{min-height:44px}
      .wt-rec-hub .node-picker-popover,.wt-rec-hub .owner-picker-popover{position:static;width:100%;margin-top:8px;box-shadow:none;background:var(--surface-2)}
      #wtDailyCheckinDialog{width:100%;max-height:var(--m-vh,100dvh);border-radius:0}
      #wtDailyCheckinDialog .dialog-head{padding:calc(10px + env(safe-area-inset-top,0px)) 16px 10px}
      #wtDailyCheckinDialog .dialog-scroll{padding:14px 16px}
      .wt-chk-tabs{padding:5px 16px}
      .wt-chk-tab{min-height:44px}
      .wt-chk-team-metrics>div{padding:8px}
      .wt-chk-moods{grid-template-columns:1fr}
      .wt-chk-mood-btn{gap:2px;padding:8px 10px}
      .wt-chk-task-row{padding-inline:8px}
      .wt-chk-mins{width:58px;min-height:44px;font-size:var(--text-entry)}
      .wt-rec-actions .btn,.wt-rec-item-ops .btn,.wt-chk-dialog .btn{min-height:44px}
    }
  `;
  if (existing) {
    existing.textContent = css;
    return;
  }
  const style = document.createElement('style');
  style.id = 'worktreeRecurringStyles';
  style.textContent = css;
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
  scopes = [],
  isDemo = false,
  onTasksGenerated = async () => {},
  onOpenTask = () => {},
  onToast = () => {}
} = {}) {
  if (!container) return;
  injectRecurringStyles();
  const renderId = Symbol();
  activeHubRender.set(container, renderId);
  const isLatest = () => activeHubRender.get(container) === renderId && container.isConnected;

  const canManage = !isDemo && ['owner', 'admin', 'manager'].includes(role);
  const service = RecurringTasksService;

  const jobTitleCounts = new Map();
  for (const emp of employees || []) {
    if ((emp.employment_status || 'active') !== 'active') continue;
    const jt = String(emp.job_title || '').trim();
    if (!jt) continue;
    jobTitleCounts.set(jt, (jobTitleCounts.get(jt) || 0) + 1);
  }
  const distinctJobTitles = [...jobTitleCounts.keys()].sort((a, b) => a.localeCompare(b, 'vi'));

  // Build normalized node tree maps
  const activeNodes = (nodes || [])
    .filter(n => !n.archived_at && n.type !== 'person')
    .map(n => ({
      ...n,
      idStr: String(n.id),
      parentStr: (n.parent ?? n.parent_id) ? String(n.parent ?? n.parent_id) : null
    }));
  const nodeById = new Map(activeNodes.map(n => [n.idStr, n]));
  const childrenMap = new Map();
  for (const n of activeNodes) {
    const pKey = n.parentStr && nodeById.has(n.parentStr) ? n.parentStr : '__root__';
    if (!childrenMap.has(pKey)) childrenMap.set(pKey, []);
    childrenMap.get(pKey).push(n);
  }

  function getNodePathNames(idStr) {
    const out = [];
    const seen = new Set();
    let cur = nodeById.get(String(idStr));
    while (cur && !seen.has(cur.idStr)) {
      seen.add(cur.idStr);
      out.unshift(cur.name);
      cur = cur.parentStr ? nodeById.get(cur.parentStr) : null;
    }
    return out;
  }

  function getNodeBreadcrumb(idStr) {
    const parts = getNodePathNames(idStr);
    parts.pop();
    return parts.join(' / ');
  }

  const selectableNodeSet = new Set();
  if (role === 'manager' && Array.isArray(scopes) && scopes.length > 0) {
    const queue = scopes.map(String).filter(id => nodeById.has(id));
    while (queue.length) {
      const curId = queue.shift();
      if (selectableNodeSet.has(curId)) continue;
      selectableNodeSet.add(curId);
      for (const child of childrenMap.get(curId) || []) {
        queue.push(child.idStr);
      }
    }
  } else {
    for (const n of activeNodes) selectableNodeSet.add(n.idStr);
  }

  const activeEmployees = (employees || [])
    .filter(e => (e.employment_status || 'active') === 'active')
    .sort((a, b) => String(a.full_name || a.name || '').localeCompare(String(b.full_name || b.name || ''), 'vi'));
  const empById = new Map(activeEmployees.map(e => [String(e.id), e]));

  const state = {
    loading: !isDemo && Boolean(organizationId),
    busy: false,
    error: '',
    templates: isDemo ? DEMO_RULES : [],
    runs: [],
    editingId: null,
    showForm: false,
    pendingDeleteId: null,
    ruleQuery: '',
    ruleFilter: 'all',
    historyOpen: false,
    historyError: false,
    nodePickerOpen: false,
    nodePickerQuery: '',
    nodePickerTypeFilter: 'all',
    nodeCollapsed: new Set(),
    empPickerOpen: false,
    empPickerQuery: '',
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
      targetEmployeeId: activeEmployees[0]?.id || '',
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
      const [templates, runs] = await Promise.allSettled([
        service.listTemplates(organizationId),
        service.listRecentRuns(organizationId, 30)
      ]);
      if (templates.status === 'fulfilled') state.templates = templates.value;
      else state.error = 'Không thể tải quy tắc việc định kỳ.';
      if (runs.status === 'fulfilled') state.runs = runs.value;
      state.historyError = runs.status === 'rejected';
    } finally {
      state.loading = false;
      state.busy = false;
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

  function buildNodeTreeHtml() {
    const selVal = String(state.draft.nodeId || '');
    const q = foldText(state.nodePickerQuery);
    const typeFilter = state.nodePickerTypeFilter || 'all';
    const selectableList = activeNodes.filter(n => selectableNodeSet.has(n.idStr));
    const rows = [];

    if (role !== 'manager' && typeFilter === 'all' && (!q || 'tu dong theo phong nhanh nhan su mac dinh'.includes(q))) {
      const isSel = !selVal;
      rows.push(`
        <div class="node-picker-row ${isSel ? 'is-selected' : ''}" style="--depth:0">
          <span class="node-picker-twisty-spacer" aria-hidden="true"></span>
          <button type="button" class="node-picker-option" data-rec-select-node="">
            <span class="node-type-icon small type-company">${ICONS.sparkles}</span>
            <span class="node-picker-option-main">
              <span class="node-picker-option-name">Tự động theo phòng/nhánh của nhân sự</span>
              <span class="node-picker-option-crumb">Mỗi nhân sự nhận việc vào đơn vị gốc của mình</span>
            </span>
            ${isSel ? `<span class="node-picker-check">${ICONS.check}</span>` : ''}
          </button>
        </div>
      `);
    }

    if (q || typeFilter !== 'all') {
      const matches = selectableList.filter(n => {
        if (typeFilter !== 'all' && n.type !== typeFilter) return false;
        if (!q) return true;
        return foldText(`${n.name} ${getNodePathNames(n.idStr).join(' ')} ${NODE_TYPE_LABELS[n.type] || ''}`).includes(q);
      });
      for (const n of matches) {
        const isSel = selVal === n.idStr;
        const crumb = getNodeBreadcrumb(n.idStr);
        rows.push(`
          <div class="node-picker-row ${isSel ? 'is-selected' : ''}" style="--depth:0">
            <button type="button" class="node-picker-option" data-rec-select-node="${esc(n.idStr)}">
              <span class="node-type-icon small type-${esc(n.type)}">${NODE_TYPE_ICONS[n.type] || ICONS.folder}</span>
              <span class="node-picker-option-main">
                <span class="node-picker-option-name">${esc(n.name)}</span>
                ${crumb ? `<span class="node-picker-option-crumb">${esc(crumb)}</span>` : ''}
              </span>
              <span class="node-type-pill type-${esc(n.type)}">${esc(NODE_TYPE_LABELS[n.type] || n.type)}</span>
              ${isSel ? `<span class="node-picker-check">${ICONS.check}</span>` : ''}
            </button>
          </div>
        `);
      }
      if (!rows.length) {
        return '<p class="muted" style="font-size:12px;padding:8px">Không tìm thấy đơn vị phù hợp.</p>';
      }
      return rows.join('');
    }

    const visibleMemo = new Map();
    const isVisibleInTree = (node) => {
      if (!node) return false;
      if (visibleMemo.has(node.idStr)) return visibleMemo.get(node.idStr);
      if (selectableNodeSet.has(node.idStr)) {
        visibleMemo.set(node.idStr, true);
        return true;
      }
      const vis = (childrenMap.get(node.idStr) || []).some(c => isVisibleInTree(c));
      visibleMemo.set(node.idStr, vis);
      return vis;
    };

    const visited = new Set();
    const walk = (node, depth) => {
      if (!node || visited.has(node.idStr) || !isVisibleInTree(node)) return;
      visited.add(node.idStr);
      const visKids = (childrenMap.get(node.idStr) || []).filter(c => isVisibleInTree(c));
      const hasKids = visKids.length > 0;
      const isCollapsed = hasKids && state.nodeCollapsed.has(node.idStr);
      const canSelect = selectableNodeSet.has(node.idStr);
      const isSel = canSelect && selVal === node.idStr;
      const twisty = hasKids
        ? `<button type="button" class="node-picker-twisty" data-rec-twisty="${esc(node.idStr)}" aria-label="${isCollapsed ? 'Mở rộng nhánh' : 'Thu gọn nhánh'}" aria-expanded="${!isCollapsed}">${isCollapsed ? ICONS.chevronRight : ICONS.chevronDown}</button>`
        : '<span class="node-picker-twisty-spacer" aria-hidden="true"></span>';

      rows.push(`
        <div class="node-picker-row ${isSel ? 'is-selected' : ''} ${canSelect ? '' : 'is-ancestor-only'}" style="--depth:${Math.min(6, depth)}">
          ${twisty}
          <button type="button" class="node-picker-option" ${canSelect ? `data-rec-select-node="${esc(node.idStr)}"` : 'disabled aria-disabled="true"'} title="${esc(getNodePathNames(node.idStr).join(' / '))}">
            <span class="node-type-icon small type-${esc(node.type)}">${NODE_TYPE_ICONS[node.type] || ICONS.folder}</span>
            <span class="node-picker-option-main">
              <span class="node-picker-option-name">${esc(node.name)}</span>
            </span>
            <span class="node-type-pill type-${esc(node.type)}">${esc(NODE_TYPE_LABELS[node.type] || node.type)}</span>
            ${isSel ? `<span class="node-picker-check">${ICONS.check}</span>` : ''}
          </button>
        </div>
      `);

      if (hasKids && !isCollapsed) {
        for (const kid of visKids) walk(kid, depth + 1);
      }
    };

    for (const root of childrenMap.get('__root__') || []) {
      walk(root, 0);
    }
    for (const n of activeNodes) {
      if (!visited.has(n.idStr)) walk(n, 0);
    }

    return rows.length ? rows.join('') : '<p class="muted" style="font-size:12px;padding:8px">Không có đơn vị khả dụng.</p>';
  }

  function renderNodePickerBox() {
    const selVal = String(state.draft.nodeId || '');
    const selNode = selVal ? nodeById.get(selVal) : null;
    const isOpen = state.nodePickerOpen;
    const iconHtml = selNode
      ? `<span class="node-type-icon type-${esc(selNode.type)}">${NODE_TYPE_ICONS[selNode.type] || ICONS.folder}</span>`
      : `<span class="node-type-icon type-company">${role === 'manager' ? ICONS.building : ICONS.sparkles}</span>`;
    const mainHtml = selNode
      ? `<span class="node-picker-trigger-main"><span class="node-picker-trigger-top"><strong id="wtRecNodePickerValue">${esc(selNode.name)}</strong><span class="node-type-pill type-${esc(selNode.type)}">${esc(NODE_TYPE_LABELS[selNode.type] || selNode.type)}</span></span><span class="node-picker-path">${esc(getNodeBreadcrumb(selNode.idStr) || 'Đơn vị gốc toàn công ty')}</span></span>`
      : `<span class="node-picker-trigger-main"><span class="node-picker-trigger-top"><strong id="wtRecNodePickerValue">${role === 'manager' ? '-- Chọn nhánh thuộc quyền --' : 'Tự động theo phòng/nhánh của nhân sự'}</strong></span><span class="node-picker-path">${role === 'manager' ? 'Bắt buộc chọn đơn vị trong phạm vi quản lý' : 'Mặc định gán vào nhánh gốc của từng người'}</span></span>`;

    let popHtml = '';
    if (isOpen) {
      const selectableList = activeNodes.filter(n => selectableNodeSet.has(n.idStr));
      const counts = { all: selectableList.length, department: 0, project: 0, team: 0, folder: 0 };
      for (const n of selectableList) {
        if (Object.hasOwn(counts, n.type)) counts[n.type] += 1;
      }
      const tabs = [
        { key: 'all', label: 'Tất cả' },
        { key: 'department', label: 'Phòng ban' },
        { key: 'project', label: 'Dự án' },
        { key: 'team', label: 'Nhóm' },
        { key: 'folder', label: 'Thư mục' }
      ].filter(t => t.key === 'all' || counts[t.key] > 0);

      popHtml = `
        <div class="node-picker-popover" id="wtRecNodePickerPopover">
          <div class="node-picker-search-wrap">
            <div class="node-picker-search-box">
              ${ICONS.search}
              <input type="search" class="node-picker-search" id="wtRecNodePickerSearch" value="${esc(state.nodePickerQuery)}" placeholder="Tìm phòng ban, dự án, nhóm..." aria-label="Tìm phòng ban, dự án hoặc nhóm" autocomplete="off">
            </div>
            <button type="button" class="icon-btn small" data-rec-node-toggle-all="true" title="Thu gọn hoặc mở rộng toàn bộ cây" aria-label="Thu gọn hoặc mở rộng cây">${UNFOLD_ICON}</button>
          </div>
          <div class="node-picker-type-tabs" role="group" aria-label="Lọc theo loại đơn vị">
            ${tabs.map(tab => `<button type="button" class="node-type-tab ${state.nodePickerTypeFilter === tab.key ? 'active' : ''}" aria-pressed="${state.nodePickerTypeFilter === tab.key}" data-rec-node-type="${tab.key}">${esc(tab.label)} <small>${counts[tab.key]}</small></button>`).join('')}
          </div>
          <div class="node-picker-tree" id="wtRecNodePickerTree">${buildNodeTreeHtml()}</div>
        </div>
      `;
    }

    return `
      <input type="hidden" id="wtRecNodeId" value="${esc(selVal)}">
      <div class="node-picker-box ${isOpen ? 'is-open' : ''}" id="wtRecNodePickerBox">
        <button type="button" class="node-picker-trigger" id="wtRecNodePickerTrigger" data-rec-toggle-node-picker="true" aria-expanded="${isOpen}" ${isOpen ? 'aria-controls="wtRecNodePickerPopover"' : ''}>
          ${iconHtml}${mainHtml}<span class="node-picker-caret" aria-hidden="true">${ICONS.chevronDown}</span>
        </button>
        ${popHtml}
      </div>
    `;
  }

  function buildEmployeeListHtml() {
    const selVal = String(state.draft.targetEmployeeId || '');
    const q = foldText(state.empPickerQuery);
    const matched = activeEmployees.filter(e => {
      if (!q) return true;
      const homeName = e.home_node_id ? (nodeById.get(String(e.home_node_id))?.name || '') : '';
      return foldText(`${e.full_name || e.name || ''} ${e.job_title || ''} ${e.email || ''} ${homeName}`).includes(q);
    });
    if (!matched.length) {
      return '<p class="muted" style="font-size:12px;padding:8px">Không tìm thấy nhân sự phù hợp.</p>';
    }
    return matched.map(e => {
      const idStr = String(e.id);
      const name = e.full_name || e.name || 'Nhân sự';
      const homeName = e.home_node_id ? (nodeById.get(String(e.home_node_id))?.name || '') : '';
      const sub = [e.job_title, homeName].filter(Boolean).join(' · ') || 'Thành viên trong tổ chức';
      const isSel = selVal === idStr;
      return `
        <button type="button" class="owner-picker-option ${isSel ? 'is-selected' : ''}" data-rec-select-emp="${esc(idStr)}">
          <span class="avatar av-${avatarColorIndex(idStr)}">${esc(getInitials(name))}</span>
          <span class="node-picker-option-main">
            <span class="node-picker-option-name">${esc(name)}</span>
            <span class="node-picker-option-crumb">${esc(sub)}</span>
          </span>
          ${isSel ? `<span class="node-picker-check">${ICONS.check}</span>` : ''}
        </button>
      `;
    }).join('');
  }

  function renderEmployeePickerBox() {
    const selVal = String(state.draft.targetEmployeeId || '');
    const emp = selVal ? empById.get(selVal) : null;
    const name = emp ? (emp.full_name || emp.name || 'Nhân sự') : 'Chọn nhân sự áp dụng';
    const homeName = emp?.home_node_id ? (nodeById.get(String(emp.home_node_id))?.name || '') : '';
    const sub = emp ? ([emp.job_title, homeName].filter(Boolean).join(' · ') || 'Thành viên trong tổ chức') : 'Bấm để tìm và chọn nhân sự';
    const isOpen = state.empPickerOpen;
    const avHtml = emp
      ? `<span class="avatar av-${avatarColorIndex(selVal)}">${esc(getInitials(name))}</span>`
      : `<span class="owner-unassigned-avatar">${ICONS.user}</span>`;

    return `
      <input type="hidden" id="wtRecTargetEmployee" value="${esc(selVal)}">
      <div class="owner-picker-box ${isOpen ? 'is-open' : ''}" id="wtRecEmpPickerBox">
        <button type="button" class="owner-picker-trigger" id="wtRecEmpPickerTrigger" data-rec-toggle-emp-picker="true" aria-expanded="${isOpen}" aria-haspopup="listbox">
          ${avHtml}
          <span class="owner-picker-trigger-main">
            <span class="node-picker-trigger-top"><strong id="wtRecEmpPickerValue">${esc(name)}</strong></span>
            <span class="node-picker-path">${esc(sub)}</span>
          </span>
          <span class="node-picker-caret" aria-hidden="true">${ICONS.chevronDown}</span>
        </button>
        ${isOpen ? `
          <div class="owner-picker-popover" id="wtRecEmpPickerPopover">
            <div class="node-picker-search-wrap">
              <div class="node-picker-search-box">
                ${ICONS.search}
                <input type="search" class="node-picker-search" id="wtRecEmpPickerSearch" value="${esc(state.empPickerQuery)}" placeholder="Tìm nhân sự theo tên, chức danh..." autocomplete="off">
              </div>
            </div>
            <div class="owner-picker-list" id="wtRecEmpPickerList">${buildEmployeeListHtml()}</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderForm() {
    if (!state.showForm || !canManage) return '';
    const d = state.draft;
    const matchCount = draftMatchPreview();
    const isEditing = Boolean(state.editingId);

    return `
      <form id="wtRecTemplateForm" class="wt-rec-card" aria-label="${isEditing ? 'Chỉnh sửa quy tắc việc định kỳ' : 'Tạo quy tắc việc định kỳ'}">
        <div class="wt-rec-section-head">
          <h4>${isEditing ? 'Chỉnh sửa quy tắc việc định kỳ' : 'Tạo quy tắc việc định kỳ mới'}</h4>
          <span class="wt-rec-pill is-primary" data-rec-match aria-live="polite">${matchCount !== null ? `Khớp ${matchCount} nhân sự` : 'Theo vai trò hệ thống'}</span>
        </div>

        <div class="wt-rec-form-grid">
          <label class="field wt-rec-full">
            <span class="field-title">Tên công việc <span class="required" aria-hidden="true">*</span></span>
            <input id="wtRecTitle" type="text" required maxlength="240" value="${esc(d.title)}" placeholder="Ví dụ: Kiểm tra tồn kho & chốt doanh số ca">
          </label>

          <h5 class="wt-rec-full wt-rec-form-heading">Phân công</h5>
          <label class="field">
            <span class="field-title">Phân công theo</span>
            <select id="wtRecAssignmentMode">
              ${ASSIGNMENT_MODE_OPTIONS.map(o => `<option value="${o.value}" ${d.assignmentMode === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
            </select>
          </label>

          ${d.assignmentMode === 'job_title' ? `
            <div class="field">
              <label class="field-title" for="wtRecTargetJobTitle">Chức danh áp dụng <span class="required" aria-hidden="true">*</span></label>
              <div class="wt-rec-job-picker">
                <input id="wtRecTargetJobTitle" type="text" required maxlength="120" value="${esc(d.targetJobTitle)}" placeholder="Nhập hoặc chọn chức danh" autocomplete="off">
                ${distinctJobTitles.length ? `
                  <button type="button" class="icon-btn wt-rec-job-toggle" data-rec-job-toggle aria-label="Danh sách chức danh" aria-expanded="false" aria-controls="wtRecJobMenu">${ICONS.chevronDown}</button>
                  <div class="wt-rec-job-menu" id="wtRecJobMenu" role="group" aria-label="Chức danh hiện có" hidden></div>
                ` : ''}
              </div>
            </div>
          ` : d.assignmentMode === 'org_role' ? `
            <label class="field">
              <span class="field-title">Vai trò hệ thống <span class="required" aria-hidden="true">*</span></span>
              <select id="wtRecTargetOrgRole">
                ${ORG_ROLE_OPTIONS.map(r => `<option value="${r.value}" ${d.targetOrgRole === r.value ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}
              </select>
            </label>
          ` : `
            <div class="field">
              <span class="field-title" id="wtRecEmpLabel">Nhân sự áp dụng <span class="required" aria-hidden="true">*</span></span>
              ${renderEmployeePickerBox()}
            </div>
          `}

          <div class="field wt-rec-full">
            <span class="field-title" id="wtRecNodeLabel">Đơn vị / Nhánh tạo việc ${role === 'manager' ? '<span class="required" aria-hidden="true">*</span>' : '(tùy chọn)'}</span>
            ${renderNodePickerBox()}
          </div>

          <h5 class="wt-rec-full wt-rec-form-heading">Lịch lặp</h5>
          <label class="field">
            <span class="field-title">Chu kỳ lặp lại</span>
            <select id="wtRecCadence">
              ${CADENCE_OPTIONS.map(o => `<option value="${o.value}" ${d.cadence === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span class="field-title">Hạn hoàn thành</span>
            <input id="wtRecDueOffset" type="number" min="0" max="30" value="${Number(d.dueOffsetDays) || 0}" aria-describedby="wtRecDueHint">
            <small class="field-hint" id="wtRecDueHint">Số ngày sau khi tạo. Nhập 0 nếu hạn trong ngày.</small>
          </label>
          ${d.cadence === 'weekly' ? `
            <div class="field wt-rec-full">
              <span class="field-title">Chọn các thứ trong tuần</span>
              <div class="wt-rec-days">
                ${WEEKDAY_LABELS.map(w => {
                  const active = d.daysOfWeek.includes(w.day);
                  return `<label class="wt-rec-day-chip"><input type="checkbox" data-rec-dow="${w.day}" ${active ? 'checked' : ''}>${w.short}</label>`;
                }).join('')}
              </div>
            </div>
          ` : ''}

          ${d.cadence === 'monthly' ? `
            <label class="field">
              <span class="field-title">Ngày lặp trong tháng (1–31)</span>
              <input id="wtRecDayOfMonth" type="number" min="1" max="31" value="${Number(d.dayOfMonth) || 1}">
            </label>
          ` : ''}

          <h5 class="wt-rec-full wt-rec-form-heading">Nội dung công việc</h5>
          <label class="field">
            <span class="field-title">Mức độ ưu tiên</span>
            <select id="wtRecPriority">
              ${PRIORITY_OPTIONS.map(p => `<option value="${p.value}" ${d.priority === p.value ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}
            </select>
          </label>

          <label class="field">
            <span class="field-title">Thời gian dự kiến (phút)</span>
            <input id="wtRecEstimateMinutes" type="number" min="0" max="60000" value="${Number(d.estimateMinutes) || 0}">
          </label>

          <label class="field wt-rec-full">
            <span class="field-title">Nhãn thẻ (cách nhau bằng dấu phẩy)</span>
            <input id="wtRecTags" type="text" value="${esc(d.tags)}" placeholder="hang-ngay, van-hanh">
          </label>

          <label class="field wt-rec-full">
            <span class="field-title">Hướng dẫn chi tiết (mô tả đầu việc)</span>
            <textarea id="wtRecDesc" rows="2" maxlength="10000" placeholder="Ghi chú quy chuẩn thực hiện, link biểu mẫu hoặc KPI cần đạt...">${esc(d.description)}</textarea>
          </label>

          <label class="field wt-rec-full">
            <span class="field-title">Checklist (mỗi dòng một bước)</span>
            <textarea id="wtRecChecklist" rows="3" placeholder="Kiểm tra tồn đầu ca&#10;Cập nhật CRM 100% khách phát sinh&#10;Bấm Báo cáo hôm nay trước 17:30">${esc(d.checklistText)}</textarea>
          </label>
        </div>

        <div class="wt-rec-actions wt-rec-form-actions">
          <button type="button" class="btn" data-rec-action="cancel-form">Hủy</button>
          <button type="submit" class="btn primary" ${state.busy ? 'disabled' : ''}>
            ${ICONS.check}<span>${state.busy ? 'Đang lưu…' : 'Lưu quy tắc'}</span>
          </button>
        </div>
      </form>
    `;
  }

  function renderTemplates() {
    if (state.loading) {
      return `<p class="wt-rec-note" role="status">Đang tải quy tắc việc định kỳ…</p>`;
    }
    if (state.error) {
      return `<div class="wt-rec-card"><p class="wt-rec-note" role="alert">${esc(state.error)}</p><div><button type="button" class="btn" data-rec-action="reload">Thử lại</button></div></div>`;
    }
    const empNameMap = new Map((employees || []).map(e => [String(e.id), e.full_name || e.name]));
    const tplMap = new Map(state.templates.map(t => [String(t.id), t]));
    const taskMap = new Map((tasks || []).map(t => [String(t.id), t]));

    return `
      <div class="wt-rec-list">
        <div class="wt-rec-section-head"><h4>${isDemo ? 'Quy tắc minh họa' : 'Quy tắc đã thiết lập'}</h4><span class="wt-rec-note">${state.templates.filter(tpl => tpl.is_active).length} đang bật · ${state.templates.filter(tpl => !tpl.is_active).length} tạm dừng</span></div>
        ${state.templates.length ? `
        <div class="wt-rec-list-toolbar">
          <label class="inline-search">${ICONS.search}<input type="search" data-rec-rule-query aria-label="Tìm quy tắc" placeholder="Tìm quy tắc, chức danh, nhân sự…" value="${esc(state.ruleQuery)}"></label>
          <select data-rec-rule-filter aria-label="Lọc theo trạng thái">
            ${[['all', 'Tất cả trạng thái'], ['active', 'Đang bật'], ['paused', 'Tạm dừng']].map(([key, label]) => `<option value="${key}" ${state.ruleFilter === key ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <p class="wt-rec-note" data-rec-rule-count role="status" hidden></p>
        <div class="wt-rec-list-results">
        ${state.templates.map(tpl => {
          const matchCount = isDemo ? null : countMatchingEmployees(tpl, { employees });
          const checklistLen = Array.isArray(tpl.checklist_items) ? tpl.checklist_items.length : 0;
          const confirmingDelete = state.pendingDeleteId === tpl.id;
          const assignmentLabel = formatAssignmentLabel(tpl, { employees });
          const cadenceLabel = formatCadenceLabel(tpl);
          return `
            <article class="wt-rec-item ${tpl.is_active ? '' : 'is-paused'}" data-rec-rule-status="${tpl.is_active ? 'active' : 'paused'}" data-rec-rule-text="${esc(foldText([tpl.title, assignmentLabel, cadenceLabel].join(' ')))}">
              <div class="wt-rec-item-body">
                <div class="wt-rec-item-head">
                  <h4 class="wt-rec-item-title">${esc(tpl.title)}</h4>
                  <span class="wt-rec-pill ${tpl.is_active ? 'is-green' : 'is-amber'}">${tpl.is_active ? 'Đang bật' : 'Tạm dừng'}</span>
                </div>
                ${tpl.description ? `<p class="wt-rec-item-desc">${esc(tpl.description)}</p>` : ''}
                <div class="wt-rec-meta">
                  <span class="wt-rec-pill is-primary">${ICONS.users} ${esc(assignmentLabel)}${matchCount !== null ? ` (${matchCount} người)` : ''}</span>
                  <span class="wt-rec-pill">${ICONS.calendar} ${esc(cadenceLabel)}</span>
                  <span class="wt-rec-pill">${ICONS.clock} ${Number(tpl.estimate_minutes) || 0} phút</span>
                  ${checklistLen > 0 ? `<span class="wt-rec-pill">${ICONS.check} ${checklistLen} bước checklist</span>` : ''}
                  ${tpl.last_generated_date ? `<span class="wt-rec-pill">Tạo gần nhất ${esc(formatRunDate(tpl.last_generated_date))}</span>` : ''}
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
        </div>` : `<div class="empty-state"><h3>Chưa có quy tắc việc định kỳ</h3><p>${canManage ? 'Tạo quy tắc để giao công việc theo lịch lặp cho nhân sự.' : 'Quản lý chưa thiết lập quy tắc trong không gian này.'}</p></div>`}
      </div>

      ${state.historyError ? '<p class="wt-rec-note">Chưa tải được lịch sử tạo việc. <button class="link-btn" type="button" data-rec-action="reload">Thử lại</button></p>' : ''}
      ${state.runs.length ? `
        <details class="wt-rec-card wt-rec-history" ${state.historyOpen ? 'open' : ''}>
          <summary>Lịch sử tạo việc (${state.runs.length}) ${ICONS.chevronDown}</summary>
          <div class="wt-rec-runs">
            ${state.runs.map((run, index) => {
              const tpl = tplMap.get(String(run.template_id));
              const empName = run.employee_id ? (empNameMap.get(String(run.employee_id)) || 'Nhân sự') : 'Chưa gán';
              const liveTask = run.task_id ? taskMap.get(String(run.task_id)) : null;
              return `
                ${index === 0 || state.runs[index - 1].run_date !== run.run_date ? `<h5 class="wt-rec-run-date">${esc(formatRunDate(run.run_date))}</h5>` : ''}
                <div class="wt-rec-run-row">
                  <span><strong>${esc(tpl?.title || 'Quy tắc đã xóa')}</strong> · ${esc(empName)}</span>
                  <div class="wt-rec-actions">
                    ${liveTask ? `<button type="button" class="btn small" data-rec-action="open-task" data-task-id="${esc(run.task_id)}">Mở việc</button>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </details>
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
    if (form.querySelector('#wtRecNodeId')) state.draft.nodeId = val('#wtRecNodeId');
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

  function updateMatchBadge() {
    const matchBadge = container.querySelector('[data-rec-match]');
    if (!matchBadge) return;
    const count = draftMatchPreview();
    matchBadge.textContent = count === null ? 'Theo vai trò hệ thống' : `Khớp ${count} nhân sự`;
  }

  function bindNodePickerEvents(form) {
    form.querySelector('[data-rec-toggle-node-picker]')?.addEventListener('click', (e) => {
      e.preventDefault();
      syncDraftFromDom();
      state.empPickerOpen = false;
      state.nodePickerOpen = !state.nodePickerOpen;
      render(state.nodePickerOpen ? 'wtRecNodePickerSearch' : 'wtRecNodePickerTrigger');
    });

    const nodeSearchInput = form.querySelector('#wtRecNodePickerSearch');
    nodeSearchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') e.preventDefault();
    });
    nodeSearchInput?.addEventListener('input', (e) => {
      state.nodePickerQuery = e.target.value;
      const treeEl = form.querySelector('#wtRecNodePickerTree');
      if (treeEl) {
        treeEl.innerHTML = buildNodeTreeHtml();
        bindNodeTreeSelectionEvents(form);
      }
    });

    form.querySelector('[data-rec-node-toggle-all]')?.addEventListener('click', () => {
      const expandable = activeNodes
        .filter(n => (childrenMap.get(n.idStr) || []).length > 0)
        .map(n => n.idStr);
      if (expandable.length && state.nodeCollapsed.size < expandable.length) {
        state.nodeCollapsed = new Set(expandable);
      } else {
        state.nodeCollapsed = new Set();
      }
      const treeEl = form.querySelector('#wtRecNodePickerTree');
      if (treeEl) {
        treeEl.innerHTML = buildNodeTreeHtml();
        bindNodeTreeSelectionEvents(form);
      }
    });

    form.querySelectorAll('[data-rec-node-type]').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        syncDraftFromDom();
        state.nodePickerTypeFilter = tabBtn.dataset.recNodeType || 'all';
        render('wtRecNodePickerSearch');
      });
    });

    bindNodeTreeSelectionEvents(form);
  }

  function bindNodeTreeSelectionEvents(form) {
    form.querySelectorAll('[data-rec-twisty]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const nid = btn.dataset.recTwisty;
        if (state.nodeCollapsed.has(nid)) state.nodeCollapsed.delete(nid);
        else state.nodeCollapsed.add(nid);
        const treeEl = form.querySelector('#wtRecNodePickerTree');
        if (treeEl) {
          treeEl.innerHTML = buildNodeTreeHtml();
          bindNodeTreeSelectionEvents(form);
        }
      });
    });

    form.querySelectorAll('[data-rec-select-node]').forEach(btn => {
      btn.addEventListener('click', () => {
        syncDraftFromDom();
        state.draft.nodeId = btn.dataset.recSelectNode || '';
        state.nodePickerOpen = false;
        render('wtRecNodePickerTrigger');
      });
    });
  }

  function bindEmployeePickerEvents(form) {
    form.querySelector('[data-rec-toggle-emp-picker]')?.addEventListener('click', (e) => {
      e.preventDefault();
      syncDraftFromDom();
      state.nodePickerOpen = false;
      state.empPickerOpen = !state.empPickerOpen;
      render(state.empPickerOpen ? 'wtRecEmpPickerSearch' : 'wtRecEmpPickerTrigger');
    });

    const empSearchInput = form.querySelector('#wtRecEmpPickerSearch');
    empSearchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') e.preventDefault();
    });
    empSearchInput?.addEventListener('input', (e) => {
      state.empPickerQuery = e.target.value;
      const listEl = form.querySelector('#wtRecEmpPickerList');
      if (listEl) {
        listEl.innerHTML = buildEmployeeListHtml();
        bindEmployeeRowEvents(form);
      }
    });

    bindEmployeeRowEvents(form);
  }

  function bindEmployeeRowEvents(form) {
    form.querySelectorAll('[data-rec-select-emp]').forEach(btn => {
      btn.addEventListener('click', () => {
        syncDraftFromDom();
        state.draft.targetEmployeeId = btn.dataset.recSelectEmp || '';
        state.empPickerOpen = false;
        render('wtRecEmpPickerTrigger');
      });
    });
  }

  function onOutsideClick(e) {
    if (!isLatest()) {
      document.removeEventListener('click', onOutsideClick);
      return;
    }
    if (!e.target.closest?.('.wt-rec-job-picker')) closeJobMenu();
    if (!state.nodePickerOpen && !state.empPickerOpen) return;
    if (e.target.closest?.('#wtRecNodePickerBox') || e.target.closest?.('#wtRecEmpPickerBox')) return;
    state.nodePickerOpen = false;
    state.empPickerOpen = false;
    syncDraftFromDom();
    render();
  }

  function onEscapeKey(e) {
    if (!isLatest()) {
      document.removeEventListener('keydown', onEscapeKey);
      return;
    }
    if (e.key !== 'Escape' || (!state.nodePickerOpen && !state.empPickerOpen)) return;
    const targetId = state.nodePickerOpen ? 'wtRecNodePickerTrigger' : 'wtRecEmpPickerTrigger';
    state.nodePickerOpen = false;
    state.empPickerOpen = false;
    syncDraftFromDom();
    render(targetId);
  }

  document.addEventListener('click', onOutsideClick);
  document.addEventListener('keydown', onEscapeKey);

  function closeJobMenu() {
    const menu = container.querySelector('#wtRecJobMenu');
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    container.querySelector('[data-rec-job-toggle]')?.setAttribute('aria-expanded', 'false');
  }

  function bindJobPicker(form) {
    const input = form.querySelector('#wtRecTargetJobTitle');
    if (!input) return;
    const picker = input.closest('.wt-rec-job-picker');
    const toggle = picker.querySelector('[data-rec-job-toggle]');
    const menu = picker.querySelector('#wtRecJobMenu');
    const openMenu = (query = '') => {
      if (!menu) return;
      const normalizedQuery = foldText(query);
      const currentTitle = foldText(input.value);
      const titles = distinctJobTitles.filter(title => foldText(title).includes(normalizedQuery));
      menu.innerHTML = titles.length ? titles.map(title => `
        <button type="button" class="wt-rec-job-option" data-rec-job-option="${esc(title)}" aria-pressed="${foldText(title) === currentTitle}">
          <span class="wt-rec-job-option-name">${esc(title)}</span><span class="wt-rec-job-count">${jobTitleCounts.get(title)} người</span>
        </button>`).join('') : '<p class="wt-rec-job-empty" role="status">Không có chức danh khớp. Bạn có thể dùng tên đã nhập.</p>';
      menu.scrollTop = 0;
      menu.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
    };
    input.addEventListener('input', () => {
      syncDraftFromDom();
      updateMatchBadge();
      openMenu(input.value);
    });
    if (!menu) return;
    input.addEventListener('click', () => { if (menu.hidden) openMenu(); });
    toggle.addEventListener('click', () => {
      if (!menu.hidden) { closeJobMenu(); return; }
      openMenu();
      input.focus({ preventScroll: true });
    });
    menu.addEventListener('click', event => {
      const option = event.target.closest('[data-rec-job-option]');
      if (!option) return;
      input.value = option.dataset.recJobOption;
      syncDraftFromDom();
      updateMatchBadge();
      closeJobMenu();
      input.focus({ preventScroll: true });
    });
    picker.addEventListener('focusout', event => {
      if (event.relatedTarget && !picker.contains(event.relatedTarget)) closeJobMenu();
    });
    picker.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !menu.hidden) {
        event.preventDefault();
        event.stopPropagation();
        closeJobMenu();
        input.focus({ preventScroll: true });
      } else if (event.key === 'ArrowDown' && event.target === input) {
        event.preventDefault();
        if (menu.hidden) openMenu();
        menu.querySelector('[data-rec-job-option]')?.focus();
      }
    });
  }

  function render(focusId = '') {
    if (!isLatest()) return;
    container.innerHTML = `
      <section class="wt-rec-hub" aria-label="Việc định kỳ">
        <div class="wt-rec-banner">
          <div class="wt-rec-banner-main">
            <span class="wt-rec-banner-icon" aria-hidden="true">${ICONS.calendar}</span>
            <div>
              <h3>Việc định kỳ</h3>
              <p>Giao việc theo lịch cho chức danh, vai trò hoặc từng nhân sự.</p>
            </div>
          </div>
          ${canManage ? `
            <div class="wt-rec-actions">
              <button type="button" class="btn" data-rec-action="run-now" ${state.busy ? 'disabled' : ''}>
                ${ICONS.clock}<span>Tạo việc hôm nay</span>
              </button>
              <button type="button" class="btn primary" data-rec-action="new-form" ${state.busy ? 'disabled' : ''}>
                ${ICONS.plus}<span>Tạo quy tắc</span>
              </button>
            </div>
          ` : ''}
        </div>

        ${isDemo ? '<p class="wt-rec-note">Dữ liệu minh họa. Có thể thiết lập quy tắc trong không gian làm việc đám mây.</p>' : ''}
        ${renderForm()}
        ${renderTemplates()}
      </section>
    `;
    if (focusId) container.querySelector('#' + focusId)?.focus({ preventScroll: true });
    const history = container.querySelector('.wt-rec-history');
    history?.addEventListener('toggle', () => { state.historyOpen = history.open; });

    const query = container.querySelector('[data-rec-rule-query]');
    const filter = container.querySelector('[data-rec-rule-filter]');
    if (query && filter) {
      const cards = [...container.querySelectorAll('[data-rec-rule-status]')];
      const result = container.querySelector('[data-rec-rule-count]');
      const applyFilter = () => {
        state.ruleQuery = query.value;
        state.ruleFilter = filter.value;
        const keyword = foldText(state.ruleQuery);
        let visible = 0;
        for (const card of cards) {
          card.hidden = !card.dataset.recRuleText.includes(keyword) ||
            (state.ruleFilter !== 'all' && card.dataset.recRuleStatus !== state.ruleFilter);
          if (!card.hidden) visible++;
        }
        result.hidden = !keyword && state.ruleFilter === 'all';
        result.textContent = visible ? `${visible}/${cards.length} quy tắc phù hợp` : 'Không tìm thấy quy tắc phù hợp.';
      };
      query.addEventListener('input', applyFilter);
      filter.addEventListener('change', applyFilter);
      applyFilter();
    }

    const form = container.querySelector('#wtRecTemplateForm');
    if (form) {
      form.querySelectorAll('#wtRecAssignmentMode,#wtRecCadence').forEach(el => el.addEventListener('change', () => {
        syncDraftFromDom();
        state.nodePickerOpen = false;
        state.empPickerOpen = false;
        render(el.id);
      }));

      form.querySelectorAll('#wtRecTargetOrgRole').forEach(el => {
        el.addEventListener('change', () => {
          syncDraftFromDom();
          updateMatchBadge();
        });
      });

      bindJobPicker(form);
      bindNodePickerEvents(form);
      bindEmployeePickerEvents(form);

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (state.busy) return;
        syncDraftFromDom();

        if (role === 'manager' && !state.draft.nodeId) {
          onToast('Quản lý cần chọn đơn vị / nhánh thuộc phạm vi quản lý.', 'error');
          state.nodePickerOpen = true;
          render('wtRecNodePickerTrigger');
          return;
        }
        if (state.draft.assignmentMode === 'employee' && !state.draft.targetEmployeeId) {
          onToast('Vui lòng chọn nhân sự áp dụng quy tắc.', 'error');
          state.empPickerOpen = true;
          render('wtRecEmpPickerTrigger');
          return;
        }

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
          try {
            const genRes = await service.generateForOrganization(organizationId, getLocalDateString());
            if (genRes?.created > 0) {
              await onTasksGenerated();
              onToast(`Đã tự động tạo ${genRes.created} đầu việc định kỳ cho hôm nay.`);
            }
          } catch (_) {}
          state.showForm = false;
          state.editingId = null;
          state.nodePickerOpen = false;
          state.empPickerOpen = false;
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
        if (form) syncDraftFromDom();
        if (action === 'reload') {
          await loadAll();
          return;
        }
        if (action === 'new-form') {
          state.editingId = null;
          state.draft = createBlankDraft();
          state.showForm = true;
          state.nodePickerOpen = false;
          state.empPickerOpen = false;
          render();
          container.querySelector('#wtRecTitle')?.focus();
          return;
        }
        if (action === 'cancel-form') {
          state.showForm = false;
          state.editingId = null;
          state.nodePickerOpen = false;
          state.empPickerOpen = false;
          render();
          return;
        }
        if (action === 'edit' && id) {
          const tpl = state.templates.find(t => t.id === id);
          if (!tpl) return;
          state.editingId = tpl.id;
          state.draft = createBlankDraft(tpl);
          state.showForm = true;
          state.nodePickerOpen = false;
          state.empPickerOpen = false;
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
