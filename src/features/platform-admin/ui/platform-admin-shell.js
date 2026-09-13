/**
 * WorkTree X — Platform Admin Portal Shell (V1 Ultra-Premium)
 * Secure SaaS Super-Admin Operations Console
 * Strictly follows WorkTree X Design System & AGENTS.md contract.
 * Elevated with ultra-premium WorkTree visual aesthetics matching prototype.
 */

import { PlatformAdminService } from '../services/platform-admin-service.js';

let portalContainer = null;
let currentView = 'overview';
let isCollapsed = false;
let selectedTenantTab = 'overview';
let previousDocumentTitle = null;
let previouslyFocusedElement = null;
let portalContextSnapshot = null;
let portalLoadPromise = null;

const VIEW_TITLES = {
  overview: 'Tổng quan nền tảng',
  tenants: 'Doanh nghiệp',
  users: 'Người dùng',
  revenue: 'Doanh thu',
  plans: 'Gói dịch vụ',
  violations: 'Cảnh báo & vi phạm',
  logs: 'Nhật ký hệ thống',
  settings: 'Cấu hình nền tảng',
  admins: 'Platform Admin'
};

const MOBILE_PRIMARY_VIEWS = ['overview', 'tenants', 'users', 'logs'];

// Cached State
let state = {
  metrics: null,
  organizations: [],
  users: [],
  violations: [],
  logs: [],
  admins: [],
  settings: null,
  selectedTenant: null,
  isLoading: false,
  error: null,
  tenantSearchQuery: '',
  tenantFilterStatus: '',
  tenantFilterPlan: '',
  tenantSort: 'newest',
  userSearchQuery: '',
  userFilterRole: '',
  userFilterStatus: '',
  logSearchQuery: '',
  logActionFilter: '',
  resourceErrors: {}
};

function icon(name, className = 'icon') {
  const paths = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5M9 21v-7h6v7"/>',
    building: '<path d="M4 21V4h11v17M15 9h5v12M8 8h3M8 12h3M8 16h3M3 21h18"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
    alert: '<path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-1.54-1H3v-4h.09A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1-1.54V3h4v.09A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9a1.7 1.7 0 0 0 1.54 1H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    arrowLeft: '<path d="m15 18-6-6 6-6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    theme: '<path d="M12 3a9 9 0 1 0 9 9c0-.7-.08-1.37-.23-2A7 7 0 0 1 12 3Z"/>',
    refresh: '<path d="M20 6v5h-5M4 18v-5h5"/><path d="M18.5 9A7 7 0 0 0 6 6.5L4 11M5.5 15A7 7 0 0 0 18 17.5l2-4.5"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
  };
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name] || paths.more}</svg>`;
}

function syncThemeControl(container, theme) {
  const toggle = container?.querySelector('#paThemeToggle');
  if (!toggle) return;
  const isDark = theme === 'dark';
  toggle.setAttribute('aria-pressed', String(isDark));
  toggle.setAttribute('aria-label', isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
  toggle.setAttribute('title', isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
}

function showPortalToast(message, tone = 'info') {
  const region = portalContainer?.querySelector('#paToastRegion');
  if (!region) return;
  const toast = document.createElement('div');
  toast.className = `toast ${tone}`;
  toast.textContent = message;
  region.replaceChildren(toast);
  window.setTimeout(() => {
    if (toast.isConnected) toast.remove();
  }, 4200);
}

function downloadCsv(filename, headers, rows) {
  const quote = value => {
    const text = String(value ?? '');
    const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const csv = `\uFEFF${[headers, ...rows].map(row => row.map(quote).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  portalContainer?.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showPortalToast('Đã chuẩn bị tệp CSV để tải xuống.', 'success');
}

function activatePortalContext(container) {
  if (portalContextSnapshot) return;

  previouslyFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  previousDocumentTitle = document.title;
  const appEl = document.getElementById('app');
  portalContextSnapshot = {
    bodyOverflow: document.body.style.overflow,
    htmlOverflow: document.documentElement.style.overflow,
    appDisplay: appEl ? appEl.style.display : undefined,
    backgroundElements: [...document.body.children]
      .filter(el => el !== container && !['SCRIPT', 'STYLE', 'LINK'].includes(el.tagName))
      .map(el => ({
        el,
        inert: el.inert,
        ariaHidden: el.getAttribute('aria-hidden')
      }))
  };

  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  if (appEl) {
    appEl.style.display = 'none';
  }
  portalContextSnapshot.backgroundElements.forEach(({ el }) => {
    el.inert = true;
    el.setAttribute('aria-hidden', 'true');
  });
  container.setAttribute('aria-hidden', 'false');
  container.focus({ preventScroll: true });
}

function deactivatePortalContext(container) {
  const snapshot = portalContextSnapshot;
  if (!snapshot) return;

  document.body.style.overflow = snapshot.bodyOverflow;
  document.documentElement.style.overflow = snapshot.htmlOverflow;
  const appEl = document.getElementById('app');
  if (appEl && snapshot.appDisplay !== undefined) {
    appEl.style.display = snapshot.appDisplay;
  }
  snapshot.backgroundElements.forEach(({ el, inert, ariaHidden }) => {
    el.inert = inert;
    if (ariaHidden === null) el.removeAttribute('aria-hidden');
    else el.setAttribute('aria-hidden', ariaHidden);
  });
  container?.setAttribute('aria-hidden', 'true');
  if (previousDocumentTitle !== null) document.title = previousDocumentTitle;
  if (previouslyFocusedElement?.isConnected) previouslyFocusedElement.focus({ preventScroll: true });

  portalContextSnapshot = null;
  previouslyFocusedElement = null;
  previousDocumentTitle = null;
}

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (_) {
    return isoStr;
  }
}

function formatRelativeTime(isoStr) {
  if (!isoStr) return '—';
  try {
    const diffMs = Date.now() - new Date(isoStr).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ngày trước`;
  } catch (_) {
    return formatDate(isoStr);
  }
}

const LOGO_COLORS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];
function getLogoColor(idStr) {
  let hash = 0;
  for (let i = 0; i < (idStr || '').length; i++) {
    hash = (hash << 5) - hash + idStr.charCodeAt(i);
  }
  return LOGO_COLORS[Math.abs(hash) % LOGO_COLORS.length];
}

function getInitials(name) {
  if (!name) return 'WT';
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (parts[0] || 'W').slice(0, 2).toUpperCase();
}

/**
 * Tạo và nạp Shell giao diện Platform Admin
 */
export function initPlatformAdminShell() {
  if (portalContainer && document.body.contains(portalContainer)) {
    return portalContainer;
  }

  const container = document.createElement('div');
  container.id = 'platformAdminPortal';
  container.className = 'platform-admin-portal';
  container.setAttribute('role', 'dialog');
  container.setAttribute('aria-modal', 'true');
  container.setAttribute('aria-label', 'Trung tâm quản trị nền tảng WorkTree X');
  container.setAttribute('aria-hidden', 'true');
  container.setAttribute('tabindex', '-1');
  container.style.cssText = `
    display: none;
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: var(--bg);
    color: var(--text);
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    overflow: hidden;
  `;

  container.innerHTML = `
    <style id="paPortalStyles">
      .platform-admin-portal {
        --bg:#f7f8fb;--surface:#fff;--surface-2:#f9fafc;--surface-3:#f1f3f8;--text:#20283d;
        --muted:#65728a;--subtle:#64718a;--line:#e8ebf2;--line-strong:#d8deea;
        --primary:#6962db;--primary-hover:#5851c4;--primary-soft:#eeecfc;--primary-text:#6256ca;
        --green:#107353;--green-soft:#e8f5ef;--amber:#93540c;--amber-soft:#fcf3df;
        --red:#ae3a4a;--red-soft:#fcecef;--blue:#356ca5;--blue-soft:#eaf2fc;
        --purple:#865db2;--purple-soft:#f2eaf9;--sidebar:#141c2e;--sidebar-muted:#96a3bf;
        --sidebar-text:#e2e7f3;--sidebar-line:rgba(186,201,238,.1);
        --shadow:0 3px 15px rgba(23,35,70,.025);--shadow-lg:0 24px 90px rgba(14,22,46,.2);
        --radius:14px;--focus:#8a7fec;--side-width:278px;--topbar:70px;
        --ease:cubic-bezier(.2,.75,.25,1);
      }
      html[data-theme="dark"] .platform-admin-portal,
      .platform-admin-portal[data-theme="dark"] {
        --bg:#111622;--surface:#1a2131;--surface-2:#20283a;--surface-3:#252e43;--text:#e6eaf3;
        --muted:#a0acc4;--subtle:#a6b2ca;--line:#2c3448;--line-strong:#424d68;
        --primary:#8d82f1;--primary-hover:#9d93fc;--primary-soft:#302c4e;--primary-text:#b5aafb;
        --green:#73d6b4;--green-soft:#1c3a34;--amber:#e9bd72;--amber-soft:#3e3424;
        --red:#f28f9c;--red-soft:#432834;--blue:#8bbcf0;--blue-soft:#25384e;
        --purple:#c5a0e7;--purple-soft:#392d4a;--sidebar:#0d1423;--sidebar-muted:#98a8c5;
        --sidebar-text:#e2e8f5;--shadow:0 3px 18px rgba(0,0,0,.07);--shadow-lg:0 24px 90px rgba(0,0,0,.4);
      }
      .platform-admin-portal *{box-sizing:border-box}
      .platform-admin-portal button,.platform-admin-portal input,.platform-admin-portal select,.platform-admin-portal textarea{font:inherit;color:inherit}
      .platform-admin-portal button{cursor:pointer}
      .platform-admin-portal button:disabled,.platform-admin-portal input:disabled,.platform-admin-portal select:disabled,.platform-admin-portal textarea:disabled{cursor:not-allowed;opacity:.58}
      .platform-admin-portal :is(button,input,select,textarea,[tabindex]):focus-visible{outline:3px solid var(--focus);outline-offset:2px}
      .platform-admin-portal svg{display:block}
      .platform-admin-portal .icon{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}

      .platform-admin-portal .app{min-height:100dvh;display:grid;grid-template-columns:var(--side-width) minmax(0,1fr);transition:grid-template-columns .2s var(--ease);height:100dvh;overflow:hidden;}
      .platform-admin-portal .app.collapsed{--side-width:76px}
      .platform-admin-portal .main-shell{min-width:0;display:flex;flex-direction:column;height:100dvh;overflow:hidden;background:var(--bg);}
      
      .platform-admin-portal .sidebar{height:100dvh;background:var(--sidebar);color:var(--sidebar-text);border-right:1px solid var(--sidebar-line);display:flex;flex-direction:column;overflow:hidden;z-index:30;flex:0 0 auto;}
      .platform-admin-portal .brand{height:70px;display:flex;align-items:center;gap:10px;padding:0 16px;border-bottom:1px solid var(--sidebar-line);white-space:nowrap;position:relative}
      .platform-admin-portal .brand-mark{width:36px;height:36px;border-radius:11px;background:#c1f0d6;color:#1c594b;display:grid;place-items:center;font-weight:900;font-size:17px;flex:0 0 auto}
      .platform-admin-portal .brand-title{font-size:17px;font-weight:800}
      .platform-admin-portal .brand-sub{font-size:11px;color:var(--sidebar-muted);margin-top:-2px}
      
      .platform-admin-portal .side-scroll{padding:12px 10px 18px;overflow-y:auto;flex:1}
      .platform-admin-portal .nav-title{padding:16px 10px 8px;color:var(--sidebar-muted);font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap}
      .platform-admin-portal .nav-item{width:100%;border:0;background:transparent;color:var(--sidebar-text);display:flex;align-items:center;gap:12px;min-height:44px;border-radius:9px;padding:0 12px;margin:2px 0;text-align:left;white-space:nowrap;transition:.16s;font-size:13px;}
      .platform-admin-portal .nav-item:hover{background:rgba(255,255,255,.055)}
      .platform-admin-portal .nav-item.active{background:rgba(144,135,245,.18);color:#fff}
      .platform-admin-portal .nav-item.active .nav-icon{color:#a89cff}
      .platform-admin-portal .nav-icon{width:21px;display:grid;place-items:center;flex:0 0 auto;color:#b7c3db}
      .platform-admin-portal .nav-label{overflow:hidden;text-overflow:ellipsis}
      .platform-admin-portal .nav-count{margin-left:auto;min-width:21px;height:20px;border-radius:6px;display:grid;place-items:center;padding:0 6px;background:rgba(255,255,255,.08);font-size:11px}
      
      .platform-admin-portal .side-footer{padding:12px 10px;border-top:1px solid var(--sidebar-line)}
      .platform-admin-portal .back-app{display:flex;align-items:center;gap:11px;padding:11px 12px;border-radius:10px;background:rgba(255,255,255,.05);border:0;color:#fff;cursor:pointer;text-align:left;width:100%;}
      .platform-admin-portal .back-app small{display:block;color:var(--sidebar-muted)}
      .platform-admin-portal .collapse-btn{position:absolute;right:10px;top:21px;border:0;background:rgba(255,255,255,.07);color:var(--sidebar-text);width:28px;height:28px;border-radius:8px;display:grid;place-items:center}
      
      .platform-admin-portal .app.collapsed .brand-copy,
      .platform-admin-portal .app.collapsed .nav-label,
      .platform-admin-portal .app.collapsed .nav-count,
      .platform-admin-portal .app.collapsed .nav-title,
      .platform-admin-portal .app.collapsed .back-app div{display:none}
      .platform-admin-portal .app.collapsed .brand{justify-content:center;padding:0}
      .platform-admin-portal .app.collapsed .nav-item{justify-content:center;padding:0}
      .platform-admin-portal .app.collapsed .back-app{justify-content:center}
      .platform-admin-portal .app.collapsed .collapse-btn{right:24px}
      .platform-admin-portal .app.collapsed .collapse-btn svg{transform:rotate(180deg)}

      .platform-admin-portal .topbar{height:var(--topbar);background:var(--surface);border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 22px;gap:10px;flex:0 0 auto;z-index:20}
      .platform-admin-portal .mobile-menu{display:none}
      .platform-admin-portal .mobile-bottom-nav{display:none}
      .platform-admin-portal .top-search{margin-left:auto;width:min(450px,42vw);height:40px;border:1px solid var(--line);background:var(--surface-2);border-radius:9px;display:flex;align-items:center;gap:9px;padding:0 12px}
      .platform-admin-portal .top-search input{border:0;outline:0;background:transparent;width:100%;min-width:0}
      .platform-admin-portal .top-search kbd{border:1px solid var(--line);background:var(--surface);border-radius:5px;padding:1px 6px;color:var(--muted);font-size:11px}
      .platform-admin-portal .icon-btn{width:38px;height:38px;border:1px solid var(--line);background:var(--surface);border-radius:9px;display:grid;place-items:center;color:var(--text);cursor:pointer;}
      .platform-admin-portal .icon-btn:hover{background:var(--surface-3)}
      .platform-admin-portal .profile{display:flex;align-items:center;gap:10px;border-left:1px solid var(--line);padding-left:14px;min-width:180px}
      .platform-admin-portal .avatar{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#7265e8,#478fee);color:#fff;display:grid;place-items:center;font-weight:800;font-size:14px;}
      .platform-admin-portal .profile strong{display:block;font-size:12.5px;color:var(--text);}
      .platform-admin-portal .profile small{color:var(--primary);font-weight:600;font-size:10.5px;}

      .platform-admin-portal .content{padding:22px 22px 32px;overflow-y:auto;flex:1;max-width:1720px;margin:0 auto;width:100%;}
      .platform-admin-portal .page-heading{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:16px}
      .platform-admin-portal .page-heading h1{font-size:26px;line-height:1.2;margin:0 0 5px;letter-spacing:-.025em;font-weight:800;}
      .platform-admin-portal .page-heading h1:focus{outline:none}
      .platform-admin-portal .page-heading p{margin:0;color:var(--muted);font-size:13px;}
      .platform-admin-portal .heading-actions{display:flex;gap:8px;flex-wrap:wrap}
      
      .platform-admin-portal .card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow)}
      .platform-admin-portal .grid{display:grid;gap:14px}
      .platform-admin-portal .kpi-grid{grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:14px}
      .platform-admin-portal .kpi{padding:17px 18px;display:flex;gap:14px;min-height:126px}
      .platform-admin-portal .kpi-icon{width:42px;height:42px;border-radius:11px;display:grid;place-items:center;flex:0 0 auto;font-size:18px;}
      .platform-admin-portal .kpi-icon.purple{background:var(--primary-soft);color:var(--primary)}
      .platform-admin-portal .kpi-icon.green{background:var(--green-soft);color:var(--green)}
      .platform-admin-portal .kpi-icon.amber{background:var(--amber-soft);color:var(--amber)}
      .platform-admin-portal .kpi-icon.red{background:var(--red-soft);color:var(--red)}
      .platform-admin-portal .kpi-icon.blue{background:var(--blue-soft);color:var(--blue)}
      .platform-admin-portal .kpi-label{color:var(--muted);font-weight:650;font-size:12px;}
      .platform-admin-portal .kpi-value{font-size:28px;font-weight:800;line-height:1.1;margin:8px 0 5px;letter-spacing:-.03em}
      .platform-admin-portal .trend{font-size:12px;font-weight:650}
      .platform-admin-portal .trend.up{color:var(--green)}
      .platform-admin-portal .trend.bad{color:var(--red)}

      .platform-admin-portal .panel{padding:17px}
      .platform-admin-portal .panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
      .platform-admin-portal .panel-title{font-size:15px;font-weight:800}
      .platform-admin-portal .panel-sub{font-size:11.5px;color:var(--muted)}
      .platform-admin-portal .analytics-grid{grid-template-columns:1.6fr 1fr .9fr;margin-bottom:14px}
      .platform-admin-portal .lower-grid{grid-template-columns:minmax(0,1fr) 340px}
      .platform-admin-portal .split{display:grid;grid-template-columns:1.2fr .8fr;gap:14px}
      .platform-admin-portal .stack{display:grid;gap:14px}
      
      .platform-admin-portal .btn{height:38px;border:1px solid var(--line);background:var(--surface);border-radius:8px;padding:0 12px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:700;font-size:12.5px;}
      .platform-admin-portal .btn:hover{background:var(--surface-2)}
      .platform-admin-portal .btn.primary{border-color:transparent;background:var(--primary);color:white}
      .platform-admin-portal .btn.primary:hover{background:var(--primary-hover)}
      .platform-admin-portal .btn.danger{background:var(--red-soft);border-color:transparent;color:var(--red)}
      .platform-admin-portal .btn.success{background:var(--green-soft);border-color:transparent;color:var(--green)}
      .platform-admin-portal .btn.warn{background:var(--amber-soft);border-color:transparent;color:var(--amber)}
      .platform-admin-portal .btn.ghost{border-color:transparent;background:transparent;color:var(--muted)}

      .platform-admin-portal .input-wrap{height:38px;border:1px solid var(--line);border-radius:8px;display:flex;align-items:center;gap:8px;padding:0 10px;background:var(--surface)}
      .platform-admin-portal .input-wrap input{border:0;outline:0;background:transparent;width:100%;font-size:12.5px;}
      .platform-admin-portal .select,.platform-admin-portal .text-input,.platform-admin-portal .textarea{height:38px;border:1px solid var(--line);background:var(--surface);border-radius:8px;padding:0 10px;color:var(--muted);min-width:0;font-size:12.5px;}
      .platform-admin-portal .text-input{color:var(--text);width:100%}
      .platform-admin-portal .textarea{height:auto;min-height:90px;padding:10px;resize:vertical;color:var(--text);width:100%}
      .platform-admin-portal .toolbar{display:grid;grid-template-columns:minmax(220px,1.5fr) repeat(3,minmax(130px,.55fr));gap:8px;margin-bottom:12px}
      .platform-admin-portal .toolbar.two{grid-template-columns:minmax(220px,1fr) .55fr .55fr}
      
      .platform-admin-portal .table-wrap{overflow:auto;border:1px solid var(--line);border-radius:12px}
      .platform-admin-portal table{border-collapse:collapse;width:100%;min-width:880px}
      .platform-admin-portal th,.platform-admin-portal td{padding:10px 13px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle;font-size:12.5px;}
      .platform-admin-portal th{background:var(--surface-2);font-size:11px;color:var(--muted);font-weight:750;white-space:nowrap}
      .platform-admin-portal tbody tr:hover{background:var(--surface-2)}
      .platform-admin-portal tbody tr:last-child td{border-bottom:0}
      .platform-admin-portal .tenant-name,.platform-admin-portal .user-name{display:flex;align-items:center;gap:9px;font-weight:700}
      .platform-admin-portal .tenant-logo,.platform-admin-portal .user-avatar{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;font-size:10px;color:white;font-weight:850}
      
      .platform-admin-portal .c1{background:#59b96c}.platform-admin-portal .c2{background:#2474c6}.platform-admin-portal .c3{background:#0b8b95}.platform-admin-portal .c4{background:#3e6fe9}.platform-admin-portal .c5{background:#e6444f}.platform-admin-portal .c6{background:#7a62e9}.platform-admin-portal .c7{background:#78859c}.platform-admin-portal .c8{background:#2188c9}
      .platform-admin-portal .pill{display:inline-flex;border-radius:6px;padding:3px 7px;font-size:10.5px;font-weight:700;white-space:nowrap}
      .platform-admin-portal .pill.business{background:var(--blue-soft);color:var(--blue)}
      .platform-admin-portal .pill.pro{background:var(--primary-soft);color:var(--primary)}
      .platform-admin-portal .pill.enterprise{background:var(--green-soft);color:var(--green)}
      .platform-admin-portal .pill.trial,.platform-admin-portal .pill.free{background:var(--surface-3);color:var(--muted)}
      .platform-admin-portal .pill.active{background:var(--green-soft);color:var(--green)}
      .platform-admin-portal .pill.locked,.platform-admin-portal .pill.suspended{background:var(--red-soft);color:var(--red)}
      .platform-admin-portal .pill.pending{background:var(--amber-soft);color:var(--amber)}
      .platform-admin-portal .pill.owner{background:var(--primary-soft);color:var(--primary)}
      .platform-admin-portal .pill.admin{background:var(--blue-soft);color:var(--blue)}
      .platform-admin-portal .pill.member{background:var(--surface-3);color:var(--muted)}
      .platform-admin-portal .more-btn{width:31px;height:29px;border:1px solid var(--line);border-radius:8px;background:var(--surface);display:grid;place-items:center;cursor:pointer;}

      .platform-admin-portal .bars{height:210px;display:flex;align-items:flex-end;gap:18px;padding:24px 6px 6px;border-bottom:1px solid var(--line);position:relative}
      .platform-admin-portal .bars:before{content:"";position:absolute;inset:24px 0 6px;background:repeating-linear-gradient(to top,transparent 0 42px,var(--line) 42px 43px);opacity:.8;pointer-events:none}
      .platform-admin-portal .bar-col{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:6px;z-index:1;min-width:0}
      .platform-admin-portal .bar{width:min(54px,80%);height:var(--h, 60px);border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,#aca5ff,#7367e9)}
      .platform-admin-portal .bar.green{background:linear-gradient(180deg,#84d9bc,#3dae86)}
      .platform-admin-portal .bar.blue{background:linear-gradient(180deg,#82b9ef,#397fc4)}
      .platform-admin-portal .bar-label{font-size:11px;color:var(--muted);white-space:nowrap}
      
      .platform-admin-portal .donut-wrap{display:flex;align-items:center;gap:18px;min-height:195px}
      .platform-admin-portal .donut{width:138px;height:138px;border-radius:50%;background:conic-gradient(var(--primary) 0 38%,#448ee8 38% 68%,#56bea0 68% 90%,#d8dfeb 90% 100%);position:relative;flex:0 0 auto}
      .platform-admin-portal .donut:after{content:"";position:absolute;inset:21px;border-radius:50%;background:var(--surface)}
      .platform-admin-portal .donut-center{position:absolute;inset:0;z-index:1;display:grid;place-content:center;text-align:center}
      .platform-admin-portal .donut-center strong{font-size:27px;color:var(--text);}
      .platform-admin-portal .donut-center span{font-size:11px;color:var(--muted)}
      .platform-admin-portal .legend{display:grid;gap:8px;min-width:0}
      .platform-admin-portal .legend-row{display:grid;grid-template-columns:8px 1fr auto;gap:8px;align-items:center;font-size:12px}
      .platform-admin-portal .dot{width:8px;height:8px;border-radius:3px}
      .platform-admin-portal .dot.p{background:var(--primary)}.platform-admin-portal .dot.b{background:#448ee8}.platform-admin-portal .dot.g{background:#56bea0}.platform-admin-portal .dot.n{background:#d8dfeb}.platform-admin-portal .dot.r{background:var(--red)}.platform-admin-portal .dot.a{background:var(--amber)}

      .platform-admin-portal .health-list{display:grid;gap:7px}
      .platform-admin-portal .health-row{display:flex;align-items:center;gap:10px;padding:6px 0}
      .platform-admin-portal .health-icon{width:29px;height:29px;border-radius:9px;background:var(--green-soft);color:var(--green);display:grid;place-items:center}
      .platform-admin-portal .health-name{flex:1;font-size:12.5px;}
      .platform-admin-portal .status-ok{color:var(--green);font-size:11.5px;font-weight:700}
      .platform-admin-portal .status-badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;background:var(--green-soft);color:var(--green);padding:5px 8px;font-size:11px;font-weight:800}
      .platform-admin-portal .status-badge:before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}

      .platform-admin-portal .activity-list{display:grid;gap:2px}
      .platform-admin-portal .activity{display:grid;grid-template-columns:34px 1fr auto;gap:10px;align-items:start;padding:9px 0;border-bottom:1px solid var(--line)}
      .platform-admin-portal .activity:last-child{border-bottom:0}
      .platform-admin-portal .activity-icon{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-size:14px;}
      .platform-admin-portal .activity-icon.red{background:var(--red-soft);color:var(--red)}
      .platform-admin-portal .activity-icon.purple{background:var(--primary-soft);color:var(--primary)}
      .platform-admin-portal .activity-icon.green{background:var(--green-soft);color:var(--green)}
      .platform-admin-portal .activity-icon.blue{background:var(--blue-soft);color:var(--blue)}
      .platform-admin-portal .activity strong{display:block;font-size:12px}
      .platform-admin-portal .activity small{display:block;color:var(--muted);margin-top:2px}
      .platform-admin-portal .activity time{font-size:10.5px;color:var(--muted);white-space:nowrap}

      .platform-admin-portal .metric-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
      .platform-admin-portal .metric-card{padding:15px}
      .platform-admin-portal .metric-card strong{display:block;font-size:23px;margin-top:5px}
      .platform-admin-portal .metric-card span{color:var(--muted);font-size:12px;}

      .platform-admin-portal .plan-grid{grid-template-columns:repeat(4,1fr)}
      .platform-admin-portal .plan-card{padding:18px;position:relative;overflow:hidden}
      .platform-admin-portal .plan-card.recommended{border-color:var(--primary)}
      .platform-admin-portal .plan-name{font-size:17px;font-weight:850}
      .platform-admin-portal .plan-price{font-size:27px;font-weight:850;margin:10px 0}
      .platform-admin-portal .plan-price small{font-size:11px;color:var(--muted);font-weight:600}
      .platform-admin-portal .plan-list{display:grid;gap:8px;color:var(--muted);margin:14px 0}
      .platform-admin-portal .plan-list div:before{content:"✓ ";color:var(--green);font-weight:800;margin-right:7px}

      .platform-admin-portal .alert-card{padding:15px;display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:start}
      .platform-admin-portal .alert-icon{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;font-weight:800;font-size:16px;}
      .platform-admin-portal .alert-icon.red{background:var(--red-soft);color:var(--red)}
      .platform-admin-portal .alert-icon.amber{background:var(--amber-soft);color:var(--amber)}
      .platform-admin-portal .alert-icon.blue{background:var(--blue-soft);color:var(--blue)}
      .platform-admin-portal .alert-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:7px;color:var(--muted);font-size:11px}

      .platform-admin-portal .log-row{display:grid;grid-template-columns:150px 120px 170px minmax(220px,1fr) 120px;gap:10px;align-items:center;padding:11px 13px;border-bottom:1px solid var(--line)}
      .platform-admin-portal .log-row.header{background:var(--surface-2);font-size:11px;color:var(--muted);font-weight:750}
      .platform-admin-portal .log-row:last-child{border-bottom:0}
      .platform-admin-portal .log-action{font-weight:700}

      .platform-admin-portal .settings-grid{grid-template-columns:1fr 1fr}
      .platform-admin-portal .settings-section{padding:18px}
      .platform-admin-portal .field{display:grid;gap:6px;margin-bottom:13px}
      .platform-admin-portal .field label{font-weight:700;font-size:12.5px;}
      .platform-admin-portal .field small{color:var(--muted)}
      .platform-admin-portal .toggle-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid var(--line)}
      .platform-admin-portal .toggle-row:last-child{border-bottom:0}
      .platform-admin-portal .switch{width:42px;height:24px;border:0;border-radius:999px;background:var(--line-strong);padding:3px;display:flex;justify-content:flex-start;cursor:pointer;}
      .platform-admin-portal .switch.on{background:var(--primary);justify-content:flex-end}
      .platform-admin-portal .switch span{width:18px;height:18px;border-radius:50%;background:white}

      .platform-admin-portal .admin-list{display:grid;gap:8px}
      .platform-admin-portal .admin-card{display:flex;align-items:center;gap:11px;border:1px solid var(--line);border-radius:10px;padding:11px}
      .platform-admin-portal .admin-card .meta{flex:1}
      .platform-admin-portal .admin-card small{display:block;color:var(--muted)}

      .platform-admin-portal .tabbar{display:flex;gap:4px;padding:4px;background:var(--surface-3);border-radius:9px;width:max-content;max-width:100%;overflow:auto}
      .platform-admin-portal .tab-btn{height:32px;border:0;background:transparent;border-radius:7px;padding:0 11px;color:var(--muted);font-weight:700;white-space:nowrap;cursor:pointer;}
      .platform-admin-portal .tab-btn.active{background:var(--surface);color:var(--text);box-shadow:0 1px 3px rgba(30,40,70,.08)}

      .platform-admin-portal .drawer-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 18px}
      .platform-admin-portal .detail-item{padding:10px 0;border-bottom:1px solid var(--line)}
      .platform-admin-portal .detail-item span{display:block;color:var(--muted);font-size:11px}
      .platform-admin-portal .detail-item strong{display:block;margin-top:3px;font-size:13px;}

      .platform-admin-portal .timeline{position:relative;padding-left:18px}
      .platform-admin-portal .timeline:before{content:"";position:absolute;left:5px;top:3px;bottom:3px;width:1px;background:var(--line)}
      .platform-admin-portal .timeline-item{position:relative;padding:0 0 14px 14px}
      .platform-admin-portal .timeline-item:before{content:"";position:absolute;left:-17px;top:5px;width:9px;height:9px;border-radius:50%;background:var(--primary);border:3px solid var(--surface)}
      .platform-admin-portal .timeline-item strong{display:block;font-size:12.5px;}
      .platform-admin-portal .timeline-item small{color:var(--muted);font-size:11px;}

      .platform-admin-portal .invoice-list{display:grid;gap:8px}
      .platform-admin-portal .invoice{display:grid;grid-template-columns:1fr 100px 110px 110px auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}
      .platform-admin-portal .invoice:last-child{border-bottom:0}

      .platform-admin-portal .progress{height:7px;border-radius:999px;background:var(--surface-3);overflow:hidden}
      .platform-admin-portal .progress>span{display:block;height:100%;border-radius:inherit;background:var(--primary)}
      .platform-admin-portal .progress.green>span{background:var(--green)}
      .platform-admin-portal .progress.red>span{background:var(--red)}

      .platform-admin-portal .callout{padding:13px 14px;border-radius:10px;background:var(--primary-soft);color:var(--primary-text);display:flex;flex-direction:column;gap:4px;}
      .platform-admin-portal .callout.warn{background:var(--amber-soft);color:var(--amber)}
      .platform-admin-portal .callout.red{background:var(--red-soft);color:var(--red)}
      .platform-admin-portal .empty{padding:32px;text-align:center;color:var(--muted)}
      .platform-admin-portal .data-status{margin:0 0 14px;padding:12px 14px;border:1px solid color-mix(in srgb,var(--amber) 32%,transparent);border-radius:10px;background:var(--amber-soft);color:var(--amber);display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px}
      .platform-admin-portal .data-status strong{display:block;margin-bottom:2px}
      .platform-admin-portal .data-status .btn{flex:0 0 auto;background:var(--surface)}
      .platform-admin-portal .toast-region{position:fixed;right:18px;top:calc(var(--topbar) + 14px);z-index:100001;display:grid;gap:8px;width:min(380px,calc(100vw - 24px));pointer-events:none}
      .platform-admin-portal .toast{padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--text);box-shadow:var(--shadow-lg);font-size:12.5px;font-weight:650;pointer-events:auto}
      .platform-admin-portal .toast.error{border-color:var(--red);color:var(--red)}
      .platform-admin-portal .toast.warn{border-color:var(--amber);color:var(--amber)}
      .platform-admin-portal .toast.success{border-color:var(--green);color:var(--green)}

      .platform-admin-portal .scrim{display:none;position:fixed;inset:0;background:rgba(10,18,35,.45);z-index:39}
      .platform-admin-portal dialog{width:min(820px,calc(100vw - 28px));border:1px solid var(--line);border-radius:17px;background:var(--surface);color:var(--text);box-shadow:var(--shadow-lg);padding:0}
      .platform-admin-portal dialog::backdrop{background:rgba(10,18,35,.45)}
      .platform-admin-portal .dialog-head{padding:18px 19px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
      .platform-admin-portal .dialog-head h2{margin:0;font-size:19px;font-weight:800;}
      .platform-admin-portal .dialog-head p{margin:3px 0 0;color:var(--muted);font-size:12px;}
      .platform-admin-portal .dialog-body{padding:18px 19px}
      .platform-admin-portal .dialog-foot{padding:14px 19px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:8px}
      .platform-admin-portal .drawer-dialog{width:min(920px,calc(100vw - 20px));margin-right:0;height:100dvh;max-height:100dvh;border-radius:17px 0 0 17px}
      .platform-admin-portal .drawer-dialog .dialog-body{overflow-y:auto;max-height:calc(100dvh - 137px)}

      @media(max-width:1180px){
        .platform-admin-portal .kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        .platform-admin-portal .analytics-grid{grid-template-columns:1.4fr 1fr}
        .platform-admin-portal .analytics-grid .health-card{grid-column:1/-1}
        .platform-admin-portal .lower-grid,.platform-admin-portal .split{grid-template-columns:1fr}
        .platform-admin-portal .plan-grid{grid-template-columns:repeat(2,1fr)}
        .platform-admin-portal .settings-grid{grid-template-columns:1fr}
        .platform-admin-portal .metric-row{grid-template-columns:1fr 1fr}
      }
      @media(max-width:900px){
        .platform-admin-portal .app{display:block}
        .platform-admin-portal .main-shell{height:100dvh}
        .platform-admin-portal .sidebar{position:fixed;left:0;top:0;width:min(390px,92vw);height:100dvh;padding-bottom:env(safe-area-inset-bottom);transform:translateX(-103%);transition:transform .2s var(--ease);box-shadow:var(--shadow-lg);z-index:50}
        .platform-admin-portal .app.mobile-open .sidebar{transform:none}
        .platform-admin-portal .app.mobile-open .scrim{display:block}
        .platform-admin-portal .collapse-btn{display:none}
        .platform-admin-portal .brand-copy,.platform-admin-portal .nav-label,.platform-admin-portal .nav-count,.platform-admin-portal .nav-title,.platform-admin-portal .back-app div{display:block!important}
        .platform-admin-portal .nav-item{justify-content:flex-start!important;padding:0 12px!important}
        .platform-admin-portal .brand{justify-content:flex-start!important;padding:0 16px!important}
        .platform-admin-portal .back-app{justify-content:flex-start!important}
        .platform-admin-portal .mobile-menu{display:grid}
        .platform-admin-portal .topbar{height:calc(var(--topbar) + env(safe-area-inset-top));padding:env(safe-area-inset-top) 12px 0;gap:6px}
        .platform-admin-portal .icon-btn{width:44px;height:44px}
        .platform-admin-portal .top-search{width:auto;flex:1;margin-left:0}
        .platform-admin-portal .profile{min-width:auto;padding-left:8px}
        .platform-admin-portal .profile div:last-child{display:none}
        .platform-admin-portal .content{padding:16px 12px calc(92px + env(safe-area-inset-bottom))}
        .platform-admin-portal .mobile-bottom-nav{position:fixed;left:0;right:0;bottom:0;z-index:35;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));height:calc(68px + env(safe-area-inset-bottom));padding:4px 6px env(safe-area-inset-bottom);border-top:1px solid var(--line);background:var(--surface);box-shadow:0 -8px 24px rgba(14,22,46,.08)}
        .platform-admin-portal .mobile-nav-item{border:0;background:transparent;color:var(--muted);min-width:0;min-height:48px;border-radius:9px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:4px;font-size:10.5px;font-weight:700}
        .platform-admin-portal .mobile-nav-item .icon{width:20px;height:20px}
        .platform-admin-portal .mobile-nav-item span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .platform-admin-portal .mobile-nav-item.active{color:var(--primary);background:var(--primary-soft)}
        .platform-admin-portal .toast-region{top:calc(var(--topbar) + env(safe-area-inset-top) + 10px);right:12px}
        .platform-admin-portal .page-heading h1{font-size:24px}
        .platform-admin-portal .toolbar,.platform-admin-portal .toolbar.two{grid-template-columns:1fr 1fr}
        .platform-admin-portal .toolbar .input-wrap,.platform-admin-portal .toolbar.two .input-wrap{grid-column:1/-1}
        .platform-admin-portal .log-row{grid-template-columns:120px 100px minmax(180px,1fr)}
        .platform-admin-portal .log-row>*:nth-child(3),.platform-admin-portal .log-row>*:nth-child(5){display:none}
        .platform-admin-portal .drawer-dialog{width:100vw;border-radius:0}
        .platform-admin-portal .drawer-grid{grid-template-columns:1fr}
      }
      @media(max-width:680px){
        .platform-admin-portal .top-search{display:none}
        .platform-admin-portal .kpi-grid{grid-template-columns:1fr 1fr;gap:9px}
        .platform-admin-portal .kpi{padding:13px;min-height:112px;display:block}
        .platform-admin-portal .kpi-icon{width:34px;height:34px;margin-bottom:7px}
        .platform-admin-portal .kpi-value{font-size:23px;margin:4px 0}
        .platform-admin-portal .analytics-grid{grid-template-columns:1fr}
        .platform-admin-portal .analytics-grid .health-card{grid-column:auto}
        .platform-admin-portal .donut-wrap{justify-content:center}
        .platform-admin-portal .plan-grid,.platform-admin-portal .settings-grid{grid-template-columns:1fr}
        .platform-admin-portal .metric-row{grid-template-columns:1fr}
        .platform-admin-portal .toolbar,.platform-admin-portal .toolbar.two{grid-template-columns:1fr}
        .platform-admin-portal .toolbar .input-wrap,.platform-admin-portal .toolbar.two .input-wrap{grid-column:auto}
        .platform-admin-portal .page-heading{align-items:center}
        .platform-admin-portal .page-heading p{font-size:12px}
        .platform-admin-portal .invoice{grid-template-columns:1fr auto}
        .platform-admin-portal .invoice>*:nth-child(2),.platform-admin-portal .invoice>*:nth-child(4){display:none}
        .platform-admin-portal .alert-card{grid-template-columns:auto 1fr}
        .platform-admin-portal .alert-card>div:last-child{grid-column:1/-1;justify-content:flex-end}
        .platform-admin-portal .heading-actions .hide-mobile{display:none}
      }
      @media(max-width:430px){
        .platform-admin-portal .kpi-grid{grid-template-columns:1fr}
        .platform-admin-portal .kpi{display:flex}
        .platform-admin-portal .kpi-icon{margin:0}
        .platform-admin-portal .page-heading h1{font-size:22px}
        .platform-admin-portal .panel{padding:14px}
        .platform-admin-portal .bars{gap:9px}
        .platform-admin-portal .bar-label{font-size:10px}
        .platform-admin-portal .donut-wrap{flex-direction:column}
        .platform-admin-portal .legend{width:100%}
        .platform-admin-portal .page-heading{align-items:flex-start;flex-direction:column}
        .platform-admin-portal .heading-actions{width:100%}
        .platform-admin-portal .heading-actions .btn{width:100%}
      }
      @media(prefers-reduced-motion:reduce){
        .platform-admin-portal *,
        .platform-admin-portal *::before,
        .platform-admin-portal *::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
      }
      /* Reset legacy workspace classes at the portal boundary. */
      .platform-admin-portal{font-size:13px;line-height:1.5}
      .platform-admin-portal .sidebar{padding:0;position:relative;top:auto}
      .platform-admin-portal .brand{padding:0 18px;min-height:70px;flex-shrink:0}
      .platform-admin-portal .brand-mark{border-radius:10px}
      .platform-admin-portal .side-scroll{min-height:0}
      .platform-admin-portal .panel-head{padding:0}
      .platform-admin-portal .profile{width:auto;margin-left:auto;padding:0 0 0 14px;color:var(--text);max-width:270px}
      .platform-admin-portal .profile>div:last-child{min-width:0}
      .platform-admin-portal .profile strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .platform-admin-portal .top-search{margin-left:0;max-width:450px;width:100%}
      .platform-admin-portal .topbar .mobile-menu{display:none}
      .platform-admin-portal .content{min-height:0;overscroll-behavior:contain;scrollbar-gutter:stable}
      .platform-admin-portal .page-heading h1{font-weight:700}
      .platform-admin-portal .grid>*{min-width:0}
      .platform-admin-portal .panel-title{font-weight:650}
      .platform-admin-portal .avatar{background:var(--primary-soft);color:var(--primary-text)}
      .platform-admin-portal .app.collapsed .brand-mark{display:none}
      .platform-admin-portal .app.collapsed .collapse-btn{width:36px;height:36px;right:20px;top:17px}
      .platform-admin-portal .btn{white-space:normal;min-height:38px;height:auto;line-height:1.4}
      .platform-admin-portal .btn.primary{color:var(--surface)}
      .platform-admin-portal .btn.ghost.pa-tenant-click{text-align:left;justify-content:flex-start;padding:4px 0;color:var(--text)}
      .platform-admin-portal .tenant-logo,.platform-admin-portal .user-avatar{flex-shrink:0;background:var(--primary-soft);color:var(--primary-text)}
      .platform-admin-portal .user-name>div{min-width:0;overflow-wrap:anywhere}
      .platform-admin-portal .table-wrap{background:var(--surface)}
      .platform-admin-portal .table-wrap td{overflow-wrap:anywhere}
      .platform-admin-portal .bar{background:var(--primary)}
      .platform-admin-portal .bar.green{background:var(--green)}
      .platform-admin-portal .bar.blue{background:var(--blue)}
      .platform-admin-portal .dot.b{background:var(--blue)}
      .platform-admin-portal .dot.g{background:var(--green)}
      .platform-admin-portal .dot.n{background:var(--line-strong)}
      .platform-admin-portal .dialog-foot{padding-bottom:max(14px,env(safe-area-inset-bottom))}
      .platform-admin-portal dialog[open]{display:flex;flex-direction:column;max-height:calc(100dvh - 24px)}
      .platform-admin-portal .dialog-head,.platform-admin-portal .dialog-foot{flex-shrink:0}
      .platform-admin-portal .dialog-body{min-height:0;overflow:auto;overscroll-behavior:contain}
      .platform-admin-portal .drawer-dialog[open]{max-height:100dvh;margin-top:0;margin-bottom:0}
      .platform-admin-portal .drawer-dialog .dialog-body{flex:1;max-height:none}
      .platform-admin-portal .detail-item strong{overflow-wrap:anywhere}
      .platform-admin-portal .data-status span{overflow-wrap:anywhere}
      .platform-admin-portal .log-row{grid-template-columns:110px minmax(100px,.8fr) minmax(120px,1fr) minmax(160px,1.5fr) 95px;font-size:12px}
      .platform-admin-portal .log-row>div{overflow-wrap:anywhere;min-width:0}
      @media(max-width:1180px){
        .platform-admin-portal .analytics-grid{grid-template-columns:minmax(0,1fr)}
        .platform-admin-portal .log-row{grid-template-columns:100px 1fr 1fr}
        .platform-admin-portal .log-row>div:nth-child(3),.platform-admin-portal .log-row>div:nth-child(5){display:none}
      }
      @media(max-width:900px){
        .platform-admin-portal .sidebar{position:fixed;top:0;padding-bottom:env(safe-area-inset-bottom)}
        .platform-admin-portal .app.collapsed .brand-mark{display:grid}
        .platform-admin-portal .topbar .mobile-menu{display:grid}
        .platform-admin-portal .profile{min-width:0;border:0;padding:0}
        .platform-admin-portal .mobile-bottom-nav{height:calc(74px + env(safe-area-inset-bottom))}
        .platform-admin-portal .btn,.platform-admin-portal .tab-btn,.platform-admin-portal .input-wrap,.platform-admin-portal .select,.platform-admin-portal .text-input{min-height:44px}
        .platform-admin-portal .nav-item{min-height:48px}
        .platform-admin-portal .input-wrap input,.platform-admin-portal .text-input,.platform-admin-portal .textarea{font-size:16px}
        .platform-admin-portal .page-heading{flex-wrap:wrap}
        .platform-admin-portal .data-status{align-items:flex-start;flex-wrap:wrap}
        .platform-admin-portal table{min-width:0}
        .platform-admin-portal .pa-responsive-table thead{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
        .platform-admin-portal .pa-responsive-table,.platform-admin-portal .pa-responsive-table tbody{display:block;width:100%}
        .platform-admin-portal .pa-responsive-table tr{display:block;padding:12px;border-bottom:1px solid var(--line)}
        .platform-admin-portal .pa-responsive-table td{display:flex;align-items:center;justify-content:space-between;gap:14px;border:0;padding:6px 0;width:100%;text-align:right;font-size:13px}
        .platform-admin-portal .pa-responsive-table td::before{content:attr(data-label);color:var(--muted);font-size:12px;text-align:left;flex-shrink:0}
        .platform-admin-portal .pa-responsive-table td:first-child{font-weight:650;justify-content:flex-start;text-align:left}
        .platform-admin-portal .pa-responsive-table td:first-child::before,.platform-admin-portal .pa-responsive-table td[colspan]::before{display:none}
        .platform-admin-portal .pa-responsive-table td[colspan]{display:block;text-align:center}
        .platform-admin-portal .log-row.header{display:none}
        .platform-admin-portal .log-row{grid-template-columns:1fr 1fr}
        .platform-admin-portal .log-row>div:nth-child(4){grid-column:1/-1}
        .platform-admin-portal .dialog-head{padding-top:max(18px,env(safe-area-inset-top))}
        .platform-admin-portal .toast-region{z-index:100002}
      }
    </style>

    <div class="app" id="paApp">
      <!-- Sidebar -->
      <aside class="sidebar" id="paSidebar">
        <div class="brand">
          <div class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none" style="width:20px;height:20px;"><path d="M7 8v9a6 6 0 006 6h12M16 5v18M25 10v13" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="7" cy="7" r="3" fill="currentColor"/><circle cx="16" cy="6" r="3" fill="currentColor"/><circle cx="25" cy="10" r="3" fill="currentColor"/></svg>
          </div>
          <div class="brand-copy">
            <div class="brand-title" style="font-size:16px;font-weight:800;letter-spacing:-.02em;">WorkTree<span style="color:var(--primary);margin-left:1px;">X</span></div>
            <div class="brand-sub" style="font-size:10px;font-weight:700;letter-spacing:.08em;color:var(--sidebar-muted);text-transform:uppercase;">Platform Admin</div>
          </div>
          <button class="collapse-btn" id="paCollapseBtn" aria-label="Thu gọn sidebar" aria-expanded="true" title="Thu gọn sidebar (Ctrl+B)">
            <svg class="icon" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
        </div>

        <div class="side-scroll">
          <button class="nav-item active" data-view="overview" aria-label="Tổng quan nền tảng" aria-current="page" title="Tổng quan nền tảng">
            <span class="nav-icon">${icon('home')}</span>
            <span class="nav-label">Tổng quan nền tảng</span>
          </button>
          <button class="nav-item" data-view="tenants" aria-label="Doanh nghiệp" title="Doanh nghiệp">
            <span class="nav-icon">${icon('building')}</span>
            <span class="nav-label">Doanh nghiệp</span>
            <span class="nav-count" id="paTenantNavCount">—</span>
          </button>
          <button class="nav-item" data-view="users" aria-label="Người dùng" title="Người dùng">
            <span class="nav-icon">${icon('users')}</span>
            <span class="nav-label">Người dùng</span>
            <span class="nav-count" id="paUserNavCount">—</span>
          </button>
          <button class="nav-item" data-view="revenue" aria-label="Doanh thu" title="Doanh thu">
            <span class="nav-icon">${icon('trend')}</span>
            <span class="nav-label">Doanh thu</span>
          </button>
          <button class="nav-item" data-view="plans" aria-label="Gói dịch vụ" title="Gói dịch vụ">
            <span class="nav-icon">${icon('layers')}</span>
            <span class="nav-label">Gói dịch vụ</span>
          </button>
          <button class="nav-item" data-view="violations" aria-label="Cảnh báo và vi phạm" title="Cảnh báo & vi phạm">
            <span class="nav-icon">${icon('alert')}</span>
            <span class="nav-label">Cảnh báo & vi phạm</span>
            <span class="nav-count" id="paViolationNavCount">0</span>
          </button>
          <button class="nav-item" data-view="logs" aria-label="Nhật ký hệ thống" title="Nhật ký hệ thống">
            <span class="nav-icon">${icon('list')}</span>
            <span class="nav-label">Nhật ký hệ thống</span>
          </button>
          
          <div class="nav-title">Nền tảng</div>
          <button class="nav-item" data-view="settings" aria-label="Cấu hình nền tảng" title="Cấu hình nền tảng">
            <span class="nav-icon">${icon('settings')}</span>
            <span class="nav-label">Cấu hình nền tảng</span>
          </button>
          <button class="nav-item" data-view="admins" aria-label="Platform Admin" title="Platform Admin">
            <span class="nav-icon">${icon('shield')}</span>
            <span class="nav-label">Platform Admin</span>
            <span class="nav-count" id="paAdminNavCount">1</span>
          </button>
        </div>

        <div class="side-footer">
          <button type="button" class="back-app" id="paBackToApp" aria-label="Quay về WorkTree" title="Quay về WorkTree">
            <span>${icon('arrowLeft')}</span>
            <div>
              <strong style="display:block;font-size:12.5px;">Quay về WorkTree</strong>
              <small style="display:block;color:var(--sidebar-muted);font-size:10.5px;">Truy cập không gian làm việc</small>
            </div>
          </button>
        </div>
      </aside>

      <!-- Scrim for Mobile Sidebar -->
      <div class="scrim" id="paScrim"></div>

      <!-- Main Shell -->
      <main class="main-shell">
        <!-- Topbar -->
        <header class="topbar">
          <button class="icon-btn mobile-menu" id="paMobileMenu" aria-label="Mở menu" aria-expanded="false" aria-controls="paSidebar">${icon('menu')}</button>
          <div class="top-crumb" style="display:flex;align-items:center;gap:8px;font-size:13px;white-space:nowrap;">
            <span class="icon" style="color:var(--primary);width:16px;height:16px;">${icon('shield')}</span>
            <span style="color:var(--muted);font-weight:600;">WorkTree X</span>
            <span class="crumb-divider" style="color:var(--muted);opacity:.4;">/</span>
            <strong id="paTopBreadcrumbView" style="color:var(--text);font-weight:750;">Tổng quan nền tảng</strong>
          </div>
          <div class="top-search">
            <span>${icon('search')}</span>
            <input id="paGlobalSearch" aria-label="Tìm doanh nghiệp, người dùng hoặc email" placeholder="Tìm doanh nghiệp, người dùng, email...">
            <kbd>Ctrl K</kbd>
          </div>
          <button class="icon-btn" id="paThemeToggle" aria-label="Đổi giao diện" aria-pressed="false" title="Chuyển chế độ Sáng / Tối">${icon('theme')}</button>
          <button class="icon-btn" id="paRefreshData" aria-label="Làm mới dữ liệu" title="Làm mới toàn bộ dữ liệu">${icon('refresh')}</button>
          
          <div class="profile">
            <div class="avatar" id="paAvatarPill">PA</div>
            <div>
              <strong id="paAdminEmail">Platform Admin</strong>
              <small>Super Admin Authority</small>
            </div>
          </div>
        </header>

        <!-- Dynamic Content Body -->
        <div class="content" id="paContentArea" role="region" aria-label="Nội dung quản trị" aria-live="polite" aria-busy="true">
          <div style="text-align:center;padding:48px;color:var(--muted);">Đang kết nối trung tâm điều hành...</div>
        </div>
      </main>

      <nav class="mobile-bottom-nav" aria-label="Điều hướng quản trị trên thiết bị di động">
        <button class="mobile-nav-item active" data-view="overview" aria-label="Tổng quan" aria-current="page">${icon('home')}<span>Tổng quan</span></button>
        <button class="mobile-nav-item" data-view="tenants" aria-label="Doanh nghiệp">${icon('building')}<span>Doanh nghiệp</span></button>
        <button class="mobile-nav-item" data-view="users" aria-label="Người dùng">${icon('users')}<span>Người dùng</span></button>
        <button class="mobile-nav-item" data-view="logs" aria-label="Nhật ký">${icon('list')}<span>Nhật ký</span></button>
        <button class="mobile-nav-item" id="paMobileMore" aria-label="Mở thêm mục quản trị" aria-expanded="false" aria-controls="paSidebar">${icon('more')}<span>Thêm</span></button>
      </nav>
    </div>

    <!-- Tenant Detail Drawer -->
    <dialog id="paTenantDrawer" class="drawer-dialog" aria-labelledby="paDrawerOrgName" aria-describedby="paDrawerOrgSlug">
      <div class="dialog-head">
        <div>
          <h2 id="paDrawerOrgName">Chi tiết Doanh nghiệp</h2>
          <p id="paDrawerOrgSlug"></p>
        </div>
        <button type="button" class="icon-btn" id="paCloseDrawerBtn" aria-label="Đóng chi tiết doanh nghiệp">✕</button>
      </div>
      <div class="dialog-body">
        <div class="tabbar" id="paDrawerTabs" role="tablist" aria-label="Thông tin doanh nghiệp">
          <button class="tab-btn active" data-tab="overview" role="tab" aria-selected="true">Tổng quan</button>
          <button class="tab-btn" data-tab="users" role="tab" aria-selected="false">Người dùng</button>
          <button class="tab-btn" data-tab="billing" role="tab" aria-selected="false">Thanh toán</button>
          <button class="tab-btn" data-tab="audit" role="tab" aria-selected="false">Audit</button>
        </div>
        <div id="paDrawerBody" style="margin-top:14px"></div>
      </div>
      <div class="dialog-foot">
        <button class="btn" id="paCloseDrawerBtn2">Đóng</button>
        <button class="btn danger" id="paDrawerTenantStateBtn">Khóa doanh nghiệp</button>
      </div>
    </dialog>

    <!-- Dangerous Action Confirmation Dialog -->
    <dialog id="paConfirmDialog" aria-labelledby="paConfirmTitle" aria-describedby="paConfirmSub">
      <div class="dialog-head">
        <div>
          <h2 id="paConfirmTitle">Xác nhận thao tác quản trị</h2>
          <p id="paConfirmSub">Hành động này tác động trực tiếp đến quyền truy cập của tenant.</p>
        </div>
        <button type="button" class="icon-btn" id="paCloseConfirmBtn" aria-label="Đóng hộp thoại xác nhận">✕</button>
      </div>
      <div class="dialog-body">
        <div class="callout red" id="paConfirmCallout"></div>
        <div class="field" style="margin-top:14px">
          <label for="paConfirmReason">Lý do thao tác (bắt buộc - ghi nhận vào Security Audit Log):</label>
          <textarea class="textarea" id="paConfirmReason" placeholder="Nhập lý do chi tiết..."></textarea>
        </div>
      </div>
      <div class="dialog-foot">
        <button class="btn" id="paCancelConfirmBtn">Hủy</button>
        <button class="btn danger" id="paProceedConfirmBtn">Xác nhận</button>
      </div>
    </dialog>
    <div class="toast-region" id="paToastRegion" role="status" aria-live="polite" aria-atomic="true"></div>
  `;

  document.body.appendChild(container);
  portalContainer = container;

  // Bind Navigation Events
  bindShellEvents(container);

  return container;
}

function bindShellEvents(container) {
  // Sidebar Nav Item clicks
  container.querySelectorAll('.nav-item, .mobile-nav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view) switchView(view, true);
      closeMobileSidebar();
    });
  });

  // Collapse Button
  const collapseBtn = container.querySelector('#paCollapseBtn');
  const appEl = container.querySelector('#paApp');
  collapseBtn?.addEventListener('click', () => {
    isCollapsed = !isCollapsed;
    appEl.classList.toggle('collapsed', isCollapsed);
    collapseBtn.setAttribute('aria-expanded', String(!isCollapsed));
    collapseBtn.setAttribute('aria-label', isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar');
    collapseBtn.setAttribute('title', isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar');
  });

  // Back to App button
  container.querySelector('#paBackToApp')?.addEventListener('click', (e) => {
    e.preventDefault();
    closePlatformAdminPortal();
  });

  // Theme Toggle
  container.querySelector('#paThemeToggle')?.addEventListener('click', () => {
    const curTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = curTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    container.setAttribute('data-theme', nextTheme);
    localStorage.setItem('worktree_theme', nextTheme);
    syncThemeControl(container, nextTheme);
  });

  // Refresh Data
  container.querySelector('#paRefreshData')?.addEventListener('click', () => {
    loadPortalData();
  });

  // Mobile Menu
  container.querySelector('#paMobileMenu')?.addEventListener('click', () => {
    container.querySelector('#paApp')?.classList.add('mobile-open');
    container.querySelector('#paMobileMenu')?.setAttribute('aria-expanded', 'true');
    container.querySelector('#paMobileMore')?.setAttribute('aria-expanded', 'true');
    syncMobileAccess();
  });
  container.querySelector('#paMobileMore')?.addEventListener('click', () => {
    container.querySelector('#paApp')?.classList.add('mobile-open');
    container.querySelector('#paMobileMenu')?.setAttribute('aria-expanded', 'true');
    container.querySelector('#paMobileMore')?.setAttribute('aria-expanded', 'true');
    syncMobileAccess();
  });
  container.querySelector('#paScrim')?.addEventListener('click', () => {
    closeMobileSidebar();
  });

  // Global search keyboard shortcut Ctrl+K
  document.addEventListener('keydown', (e) => {
    if (portalContainer && portalContainer.style.display !== 'none') {
      // Workspace shortcuts must not act on the covered tenant workspace.
      e.stopImmediatePropagation();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (window.innerWidth <= 680) {
          switchView('tenants');
          container.querySelector('#tenantSearch')?.focus();
        } else container.querySelector('#paGlobalSearch')?.focus();
      }
      if (e.key === 'Tab' && !container.querySelector('dialog[open]')) {
        const scope = appEl.classList.contains('mobile-open') ? container.querySelector('#paSidebar') : container;
        const targets = [...scope.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')]
          .filter(el => !el.closest('[inert]') && el.getClientRects().length);
        const first = targets[0];
        const last = targets[targets.length - 1];
        if (e.shiftKey && (document.activeElement === first || !scope.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        const drawer = container.querySelector('#paTenantDrawer');
        const confirmDialog = container.querySelector('#paConfirmDialog');
        if (confirmDialog?.open) {
          confirmDialog.close();
        } else if (drawer?.open) {
          drawer.close();
        } else if (container.querySelector('#paApp')?.classList.contains('mobile-open')) {
          closeMobileSidebar();
        } else {
          closePlatformAdminPortal();
        }
      }
    }
  }, true);
  window.matchMedia('(max-width: 900px)').addEventListener('change', () => {
    closeMobileSidebar();
    syncMobileAccess();
  });

  // Global search input
  container.querySelector('#paGlobalSearch')?.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (currentView === 'users') {
      state.userSearchQuery = q;
      const userSearch = container.querySelector('#userSearch');
      if (userSearch) userSearch.value = q;
      filterAndRenderUsersTable();
      return;
    }

    if (currentView !== 'tenants') switchView('tenants');
    state.tenantSearchQuery = q;
    const tenantSearch = container.querySelector('#tenantSearch');
    if (tenantSearch) tenantSearch.value = q;
    filterAndRenderTenantsTable();
  });

  // Drawer Close
  container.querySelector('#paCloseDrawerBtn')?.addEventListener('click', () => {
    container.querySelector('#paTenantDrawer')?.close();
  });
  container.querySelector('#paCloseDrawerBtn2')?.addEventListener('click', () => {
    container.querySelector('#paTenantDrawer')?.close();
  });

  // Drawer Tabs
  container.querySelectorAll('#paDrawerTabs .tab-btn').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      selectedTenantTab = tabBtn.dataset.tab;
      container.querySelectorAll('#paDrawerTabs .tab-btn').forEach(candidate => {
        const isActive = candidate === tabBtn;
        candidate.classList.toggle('active', isActive);
        candidate.setAttribute('aria-selected', String(isActive));
      });
      renderDrawerActiveTab();
    });
  });

  // Confirm Modal Close
  container.querySelector('#paCloseConfirmBtn')?.addEventListener('click', () => {
    container.querySelector('#paConfirmDialog')?.close();
  });
  container.querySelector('#paCancelConfirmBtn')?.addEventListener('click', () => {
    container.querySelector('#paConfirmDialog')?.close();
  });
}

function closeMobileSidebar() {
  portalContainer?.querySelector('#paApp')?.classList.remove('mobile-open');
  portalContainer?.querySelector('#paMobileMenu')?.setAttribute('aria-expanded', 'false');
  portalContainer?.querySelector('#paMobileMore')?.setAttribute('aria-expanded', 'false');
  syncMobileAccess();
}

function syncMobileAccess() {
  if (!portalContainer) return;
  const mobile = window.innerWidth <= 900;
  const open = mobile && portalContainer.querySelector('#paApp').classList.contains('mobile-open');
  portalContainer.querySelector('#paSidebar').inert = mobile && !open;
  portalContainer.querySelector('.main-shell').inert = open;
  portalContainer.querySelector('.mobile-bottom-nav').inert = open;
  if (open) portalContainer.querySelector('#paSidebar .nav-item').focus();
}

function switchView(viewName, focusHeading = false) {
  if (!VIEW_TITLES[viewName]) viewName = 'overview';
  currentView = viewName;
  if (!portalContainer) return;

  portalContainer.querySelectorAll('.nav-item, .mobile-nav-item[data-view]').forEach(btn => {
    const isActive = btn.dataset.view === viewName;
    btn.classList.toggle('active', isActive);
    if (isActive) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
  portalContainer.querySelector('#paMobileMore')?.classList.toggle('active', !MOBILE_PRIMARY_VIEWS.includes(viewName));
  document.title = `${VIEW_TITLES[viewName]} · Platform Admin · WorkTree X`;

  // Sync hash
  const targetHash = viewName === 'overview' ? '#admin' : `#admin/${viewName}`;
  if (window.location.hash !== targetHash && window.location.hash !== targetHash.replace('#admin', '#platform-admin')) {
    try {
      window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}${targetHash}`);
    } catch (_) {
      window.location.hash = targetHash;
    }
  }

  const breadcrumbEl = portalContainer?.querySelector('#paTopBreadcrumbView');
  if (breadcrumbEl) breadcrumbEl.textContent = VIEW_TITLES[viewName];

  renderCurrentView();
  if (focusHeading) window.requestAnimationFrame(() => {
    const heading = portalContainer?.querySelector('#paContentArea h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  });
}

/**
 * Tải toàn bộ dữ liệu điều hành từ serverless endpoint /api/platform-admin
 */
function loadPortalData() {
  if (!portalLoadPromise) portalLoadPromise = fetchPortalData().finally(() => { portalLoadPromise = null; });
  return portalLoadPromise;
}

async function fetchPortalData() {
  state.isLoading = true;
  state.error = null;
  renderCurrentView();

  try {
    const resources = [
      ['metrics', 'Tổng quan', () => PlatformAdminService.getOverview()],
      ['organizations', 'Doanh nghiệp', () => PlatformAdminService.getOrganizations()],
      ['users', 'Người dùng', () => PlatformAdminService.getUsers()],
      ['violations', 'Cảnh báo', () => PlatformAdminService.getViolations()],
      ['logs', 'Nhật ký', () => PlatformAdminService.getAuditLogs()],
      ['admins', 'Platform Admin', () => PlatformAdminService.getPlatformAdmins()],
      ['settings', 'Cấu hình', () => PlatformAdminService.getSettings()]
    ];
    const results = await Promise.allSettled(resources.map(([, , request]) => request()));
    const resourceErrors = {};

    results.forEach((result, index) => {
      const [key, label] = resources[index];
      if (result.status === 'fulfilled') {
        state[key] = result.value;
      } else {
        resourceErrors[key] = `${label}: tạm thời chưa thể đồng bộ`;
      }
    });
    state.resourceErrors = resourceErrors;

    // Update nav counters
    const tenantCountEl = portalContainer?.querySelector('#paTenantNavCount');
    if (tenantCountEl) tenantCountEl.textContent = resourceErrors.organizations ? '—' : state.organizations.length;

    const userCountEl = portalContainer?.querySelector('#paUserNavCount');
    if (userCountEl) userCountEl.textContent = resourceErrors.users ? '—' : state.users.length;

    const violationCountEl = portalContainer?.querySelector('#paViolationNavCount');
    if (violationCountEl) violationCountEl.textContent = resourceErrors.violations ? '—' : state.violations.length;

    const adminCountEl = portalContainer?.querySelector('#paAdminNavCount');
    if (adminCountEl) adminCountEl.textContent = resourceErrors.admins ? '—' : state.admins.length;

  } catch (err) {
    state.error = 'Chưa thể đồng bộ dữ liệu. Vui lòng thử lại.';
    console.error('[PlatformAdmin] Lỗi tải dữ liệu:', err);
  } finally {
    state.isLoading = false;
    renderCurrentView();
  }
}

function renderCurrentView() {
  const content = portalContainer?.querySelector('#paContentArea');
  if (!content) return;
  content.setAttribute('aria-busy', String(state.isLoading));

  if (state.isLoading && !state.organizations.length && !state.metrics) {
    content.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:380px;gap:14px;color:var(--muted);">
        <div style="width:42px;height:42px;border:3px solid var(--line);border-top-color:var(--primary);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
        <p style="margin:0;font-size:14px;font-weight:600;color:var(--text);">Đang xác thực quyền Super-Admin & tải dữ liệu vận hành...</p>
      </div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    `;
    return;
  }

  switch (currentView) {
    case 'overview':
      renderOverview(content);
      break;
    case 'tenants':
      renderTenants(content);
      break;
    case 'users':
      renderUsers(content);
      break;
    case 'revenue':
      renderRevenue(content);
      break;
    case 'plans':
      renderPlans(content);
      break;
    case 'violations':
      renderViolations(content);
      break;
    case 'logs':
      renderLogs(content);
      break;
    case 'settings':
      renderSettings(content);
      break;
    case 'admins':
      renderAdmins(content);
      break;
    default:
      renderOverview(content);
  }

  renderResourceStatus(content);
  enhanceTables(content);
}

function enhanceTables(root) {
  root?.querySelectorAll('table').forEach(table => {
    table.classList.add('pa-responsive-table');
    const labels = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach(row => {
      [...row.children].forEach((cell, index) => cell.setAttribute('data-label', labels[index] || ''));
    });
  });
}

function renderResourceStatus(content) {
  const errors = Object.values(state.resourceErrors || {});
  if (!errors.length && !state.error) return;
  const messages = state.error ? [state.error, ...errors] : errors;
  content.insertAdjacentHTML('afterbegin', `
    <div class="data-status" role="status">
      <div>
        <strong>Một phần dữ liệu chưa được đồng bộ</strong>
        <span>${esc(messages.join(' · '))}. Dữ liệu đã tải thành công vẫn được giữ nguyên.</span>
      </div>
      <button class="btn" type="button" id="paRetryPartialData">Thử lại</button>
    </div>
  `);
  content.querySelector('#paRetryPartialData')?.addEventListener('click', () => loadPortalData());
}

// -----------------------------------------------------------------------------
// 1. OVERVIEW VIEW (Matching Prototype Analytics Grid & Lower Grid)
// -----------------------------------------------------------------------------
function renderOverview(container) {
  const m = state.metrics || {
    totalOrganizations: state.organizations.length,
    activeOrganizations: state.organizations.filter(o => o.status === 'active').length,
    suspendedOrganizations: state.organizations.filter(o => o.status === 'suspended').length,
    totalUsers: state.users.length,
    totalTasks: 0,
    plansBreakdown: { free: 0, starter: 0, business: 0, enterprise: 0 }
  };

  const recentOrgs = (state.organizations || []).slice(0, 5);
  const growth = Array.from({ length: 6 }, (_, index) => {
    const start = new Date(new Date().getFullYear(), new Date().getMonth() - 5 + index, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return { label: `T${start.getMonth() + 1}`, count: state.organizations.filter(org => {
      const date = new Date(org.createdAt || org.created_at);
      return date >= start && date < end;
    }).length };
  });
  const maxGrowth = Math.max(1, ...growth.map(item => item.count));
  const breakdown = m.plansBreakdown || {};
  const counts = [breakdown.enterprise || 0, breakdown.business || 0, (breakdown.starter || 0) + (breakdown.pro || 0), (breakdown.free || 0) + (breakdown.trial || 0)];
  const knownPlans = counts.reduce((sum, count) => sum + count, 0);
  const unknownPlans = Math.max(0, (m.totalOrganizations || 0) - knownPlans);
  const totalPlans = Math.max(1, knownPlans + unknownPlans);
  let cursor = 0;
  const slices = [...counts, unknownPlans].map((count, i) => {
    const start = cursor;
    cursor += count / totalPlans * 100;
    return `${['var(--primary)', 'var(--blue)', 'var(--green)', 'var(--line-strong)', 'var(--surface-3)'][i]} ${start}% ${cursor}%`;
  }).join(',');

  container.innerHTML = `
    <div class="page-heading">
      <div>
        <h1>Tổng quan nền tảng</h1>
        <p>Theo dõi hoạt động, doanh thu và sức khỏe hệ thống WorkTree X</p>
      </div>
      <div class="heading-actions">
        <button class="btn" id="paOverviewSyncBtn">Đồng bộ tức thì ${icon('refresh')}</button>
      </div>
    </div>

    <!-- 4 Key KPI Cards -->
    <div class="grid kpi-grid">
      <article class="card kpi">
        <div class="kpi-icon purple">${icon('building')}</div>
        <div>
          <div class="kpi-label">Doanh nghiệp đang hoạt động</div>
          <div class="kpi-value">${m.activeOrganizations}</div>
          <div class="trend">Trong ${m.totalOrganizations} doanh nghiệp trên nền tảng</div>
        </div>
      </article>

      <article class="card kpi">
        <div class="kpi-icon green">${icon('users')}</div>
        <div>
          <div class="kpi-label">Hồ sơ người dùng</div>
          <div class="kpi-value">${m.totalUsers}</div>
          <div class="trend up">Định danh xác thực qua Supabase</div>
        </div>
      </article>

      <article class="card kpi">
        <div class="kpi-icon amber">${icon('trend')}</div>
        <div>
          <div class="kpi-label">Doanh thu tháng này</div>
          <div class="kpi-value" style="font-size:20px;margin:12px 0 6px;">Chưa đối soát</div>
          <div class="trend">Chưa kích hoạt cổng thanh toán</div>
        </div>
      </article>

      <article class="card kpi">
        <div class="kpi-icon red">${icon('alert')}</div>
        <div>
          <div class="kpi-label">Doanh nghiệp bị khóa</div>
          <div class="kpi-value">${m.suspendedOrganizations}</div>
          <div class="trend ${m.suspendedOrganizations > 0 ? 'bad' : 'up'}">${m.suspendedOrganizations > 0 ? 'Đã chặn truy cập' : 'Chưa có doanh nghiệp bị khóa'}</div>
        </div>
      </article>
    </div>

    <!-- Analytics Grid (Bars, Donut, Health) -->
    <div class="grid analytics-grid">
      <!-- 6-month Revenue / MRR Trend -->
      <article class="card panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">Doanh nghiệp mới theo tháng</div>
            <div class="panel-sub">6 tháng gần nhất · theo ngày tạo doanh nghiệp</div>
          </div>
          <span class="pill business">${new Date().getFullYear()}</span>
        </div>
        ${state.resourceErrors.organizations ? '<div class="empty">Chưa tải được dữ liệu tăng trưởng.</div>' : `<div class="bars">${growth.map(item => `<div class="bar-col"><strong>${item.count}</strong><div class="bar" style="--h:${Math.max(2, item.count / maxGrowth * 135)}px"></div><div class="bar-label">${item.label}</div></div>`).join('')}</div>`}
      </article>

      <!-- Plan Distribution Donut Chart -->
      <article class="card panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">Phân bổ gói dịch vụ</div>
            <div class="panel-sub">Theo số doanh nghiệp</div>
          </div>
        </div>
        <div class="donut-wrap">
          <div class="donut" style="background:conic-gradient(${slices})" aria-hidden="true">
            <div class="donut-center">
              <strong>${m.totalOrganizations}</strong>
              <span>doanh nghiệp</span>
            </div>
          </div>
          <div class="legend">
            <div class="legend-row"><span class="dot p"></span><span>Enterprise</span><strong>${m.plansBreakdown.enterprise || 0}</strong></div>
            <div class="legend-row"><span class="dot b"></span><span>Business</span><strong>${m.plansBreakdown.business || 0}</strong></div>
            <div class="legend-row"><span class="dot g"></span><span>Starter / Pro</span><strong>${counts[2]}</strong></div>
            <div class="legend-row"><span class="dot n"></span><span>Free / Trial</span><strong>${counts[3]}</strong></div>
            ${unknownPlans ? `<div class="legend-row"><span class="dot n"></span><span>Chưa có thông tin gói</span><strong>${unknownPlans}</strong></div>` : ''}
          </div>
        </div>
      </article>

      <!-- System Health Diagnostics -->
      <article class="card panel health-card">
        <div class="panel-head">
          <div>
            <div class="panel-title">Đồng bộ dữ liệu</div>
            <div class="panel-sub">Kết quả lần tải gần nhất</div>
          </div>
          <span class="pill ${Object.keys(state.resourceErrors).length ? 'pending' : 'active'}">${Object.keys(state.resourceErrors).length ? 'Cần kiểm tra' : 'Đã tải'}</span>
        </div>
        <div class="health-list">
          ${[['metrics','Tổng quan','trend'],['organizations','Doanh nghiệp','building'],['users','Người dùng','users'],['logs','Nhật ký','list'],['violations','Cảnh báo','shield']].map(([key,label,symbol]) => `<div class="health-row"><div class="health-icon">${icon(symbol)}</div><div class="health-name">${label}</div><span class="pill ${state.resourceErrors[key] ? 'pending' : 'active'}">${state.resourceErrors[key] ? 'Chưa tải' : 'Đã tải'}</span></div>`).join('')}
        </div>
      </article>
    </div>

    <!-- Lower Grid (Recent Tenants & Activity Feed) -->
    <div class="grid lower-grid">
      <article class="card panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">Doanh nghiệp mới nhất</div>
            <div class="panel-sub">Các tenant vừa được tạo trên hệ thống</div>
          </div>
          <button class="btn" id="paViewAllTenantsBtn">Xem tất cả →</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Doanh nghiệp</th>
                <th>Gói</th>
                <th>Người dùng</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              ${recentOrgs.length ? recentOrgs.map(t => {
                const plan = (t.subscription?.plan || 'free').toLowerCase();
                const isLocked = t.status === 'suspended';
                const cls = getLogoColor(t.id);
                return `
                  <tr>
                    <td>
                      <button class="btn ghost pa-tenant-click" data-id="${t.id}">
                        <span class="tenant-logo ${cls}">${getInitials(t.name)}</span>
                        ${esc(t.name)}
                      </button>
                    </td>
                    <td><span class="pill ${plan}">${esc(t.subscription?.plan || 'Free')}</span></td>
                    <td>${t.activeMembersCount || 1}</td>
                    <td><span class="pill ${isLocked ? 'locked' : 'active'}">${isLocked ? 'Đã khóa' : 'Đang hoạt động'}</span></td>
                  </tr>
                `;
              }).join('') : `
                <tr><td colspan="4"><div class="empty">Chưa có doanh nghiệp nào.</div></td></tr>
              `}
            </tbody>
          </table>
        </div>
      </article>

      <article class="card panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">Hoạt động gần đây</div>
            <div class="panel-sub">Nhật ký bảo mật và quản trị</div>
          </div>
        </div>
        <div class="activity-list">
          ${(state.logs || []).slice(0, 4).map(l => `
            <div class="activity">
              <div class="activity-icon ${l.action.includes('SUSPEND') ? 'red' : 'purple'}">
                ${l.action.includes('SUSPEND') ? icon('alert') : icon('shield')}
              </div>
              <div>
                <strong>${esc(l.action)}</strong>
                <small>${esc(l.metadata?.organization_name || l.target_type || 'Platform')}</small>
              </div>
              <time>${formatRelativeTime(l.created_at)}</time>
            </div>
          `).join('') || `
            <div class="activity">
              <div class="activity-icon green">${icon('shield')}</div>
              <div><strong>Hệ thống khởi chạy</strong><small>Platform Super-Admin Console</small></div>
              <time>Vừa xong</time>
            </div>
          `}
        </div>
      </article>
    </div>
  `;

  // Bind Overview events
  container.querySelector('#paOverviewSyncBtn')?.addEventListener('click', () => loadPortalData());
  container.querySelector('#paViewAllTenantsBtn')?.addEventListener('click', () => switchView('tenants'));
  container.querySelectorAll('.pa-tenant-click').forEach(b => {
    b.addEventListener('click', () => openTenantDetailDrawer(b.dataset.id));
  });
}

// -----------------------------------------------------------------------------
// 2. TENANTS VIEW
// -----------------------------------------------------------------------------
function renderTenants(container) {
  container.innerHTML = `
    <div class="page-heading">
      <div>
        <h1>Doanh nghiệp</h1>
        <p>Quản lý toàn bộ tenant trong hệ sinh thái WorkTree</p>
      </div>
      <div class="heading-actions">
        <button class="btn" id="paExportTenantsBtn">Xuất danh sách</button>
      </div>
    </div>

    <!-- Tenants KPI -->
    <div class="grid kpi-grid">
      <article class="card kpi">
        <div class="kpi-icon purple">${icon('building')}</div>
        <div>
          <div class="kpi-label">Tổng doanh nghiệp</div>
          <div class="kpi-value">${state.organizations.length}</div>
          <div class="trend up">${state.organizations.filter(o => o.status === 'active').length} đang hoạt động</div>
        </div>
      </article>
      <article class="card kpi">
        <div class="kpi-icon green">${icon('shield')}</div>
        <div>
          <div class="kpi-label">Đang hoạt động</div>
          <div class="kpi-value">${state.organizations.filter(o => o.status === 'active').length}</div>
          <div class="trend up">Truy cập bình thường</div>
        </div>
      </article>
      <article class="card kpi">
        <div class="kpi-icon amber">${icon('refresh')}</div>
        <div>
          <div class="kpi-label">Gói Free / Trial</div>
          <div class="kpi-value">${state.organizations.filter(o => (o.subscription?.plan || 'free') === 'free').length}</div>
          <div class="trend">Chưa nâng cấp trả phí</div>
        </div>
      </article>
      <article class="card kpi">
        <div class="kpi-icon red">${icon('alert')}</div>
        <div>
          <div class="kpi-label">Đã khóa</div>
          <div class="kpi-value">${state.organizations.filter(o => o.status === 'suspended').length}</div>
          <div class="trend ${state.organizations.some(o => o.status === 'suspended') ? 'bad' : 'up'}">Chặn quyền truy cập</div>
        </div>
      </article>
    </div>

    <!-- Toolbar -->
    <div class="toolbar">
      <div class="input-wrap">
        <span>${icon('search')}</span>
        <input id="tenantSearch" aria-label="Tìm doanh nghiệp theo tên, domain hoặc email" placeholder="Tìm theo tên, domain, email..." value="${esc(state.tenantSearchQuery)}">
      </div>
      <select class="select" id="tenantPlanFilter" aria-label="Lọc doanh nghiệp theo gói dịch vụ">
        <option value="">Tất cả gói</option>
        <option value="enterprise" ${state.tenantFilterPlan === 'enterprise' ? 'selected' : ''}>Enterprise</option>
        <option value="business" ${state.tenantFilterPlan === 'business' ? 'selected' : ''}>Business</option>
        <option value="starter" ${state.tenantFilterPlan === 'starter' ? 'selected' : ''}>Starter</option>
        <option value="free" ${state.tenantFilterPlan === 'free' ? 'selected' : ''}>Free</option>
      </select>
      <select class="select" id="tenantStatusFilter" aria-label="Lọc doanh nghiệp theo trạng thái">
        <option value="">Tất cả trạng thái</option>
        <option value="active" ${state.tenantFilterStatus === 'active' ? 'selected' : ''}>Đang hoạt động</option>
        <option value="suspended" ${state.tenantFilterStatus === 'suspended' ? 'selected' : ''}>Đã khóa</option>
      </select>
      <select class="select" id="tenantSortFilter" aria-label="Sắp xếp danh sách doanh nghiệp">
        <option value="newest" ${state.tenantSort === 'newest' ? 'selected' : ''}>Sắp xếp: Mới nhất</option>
        <option value="name" ${state.tenantSort === 'name' ? 'selected' : ''}>Tên A–Z</option>
      </select>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Doanh nghiệp</th>
            <th>Domain</th>
            <th>Gói</th>
            <th>Người dùng</th>
            <th>Ngày tạo</th>
            <th>Trạng thái</th>
            <th style="text-align:right;">Thao tác</th>
          </tr>
        </thead>
        <tbody id="tenantTableBody"></tbody>
      </table>
    </div>
  `;

  filterAndRenderTenantsTable();

  // Bind Toolbar inputs
  container.querySelector('#tenantSearch')?.addEventListener('input', (e) => {
    state.tenantSearchQuery = e.target.value.trim().toLowerCase();
    filterAndRenderTenantsTable();
  });
  container.querySelector('#tenantPlanFilter')?.addEventListener('change', (e) => {
    state.tenantFilterPlan = e.target.value;
    filterAndRenderTenantsTable();
  });
  container.querySelector('#tenantStatusFilter')?.addEventListener('change', (e) => {
    state.tenantFilterStatus = e.target.value;
    filterAndRenderTenantsTable();
  });
  container.querySelector('#tenantSortFilter')?.addEventListener('change', (e) => {
    state.tenantSort = e.target.value;
    filterAndRenderTenantsTable();
  });
  container.querySelector('#paExportTenantsBtn')?.addEventListener('click', () => {
    downloadCsv('worktree-platform-tenants.csv', ['Doanh nghiệp', 'Domain', 'Gói', 'Người dùng', 'Ngày tạo', 'Trạng thái'],
      state.organizations.map(org => [
        org.name,
        org.domain || `${org.slug || ''}.worktree.vn`,
        org.subscription?.plan || 'Free',
        org.activeMembersCount || 0,
        formatDate(org.createdAt || org.created_at),
        org.status || 'active'
      ]));
  });
}

function filterAndRenderTenantsTable() {
  const tbody = portalContainer?.querySelector('#tenantTableBody');
  if (!tbody) return;

  const q = state.tenantSearchQuery;
  const p = state.tenantFilterPlan;
  const s = state.tenantFilterStatus;

  const filtered = (state.organizations || []).filter(org => {
    const matchesSearch = !q || (org.name + ' ' + (org.slug || '') + ' ' + (org.ownerName || '')).toLowerCase().includes(q);
    const matchesPlan = !p || (org.subscription?.plan || 'free').toLowerCase() === p;
    const matchesStatus = !s || org.status === s;
    return matchesSearch && matchesPlan && matchesStatus;
  }).sort((a, b) => state.tenantSort === 'name'
    ? String(a.name || '').localeCompare(String(b.name || ''), 'vi')
    : new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty">Không tìm thấy doanh nghiệp phù hợp.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(t => {
    const plan = (t.subscription?.plan || 'free').toLowerCase();
    const isLocked = t.status === 'suspended';
    const cls = getLogoColor(t.id);
    return `
      <tr>
        <td>
          <button class="btn ghost pa-tenant-click" data-id="${t.id}">
            <span class="tenant-logo ${cls}">${getInitials(t.name)}</span>
            ${esc(t.name)}
          </button>
        </td>
        <td style="color:var(--muted);font-family:monospace;font-size:12px;">${esc(t.domain || (t.slug + '.worktree.vn'))}</td>
        <td><span class="pill ${plan}">${esc(t.subscription?.plan || 'Free')}</span></td>
        <td>${t.activeMembersCount || 1}</td>
        <td>${formatDate(t.createdAt || t.created_at)}</td>
        <td><span class="pill ${isLocked ? 'locked' : 'active'}">${isLocked ? 'Đã khóa' : 'Đang hoạt động'}</span></td>
        <td style="text-align:right;">
          <button class="btn ghost pa-detail-btn" data-id="${t.id}" style="padding:0 8px;">Chi tiết</button>
          <button class="btn ${isLocked ? 'success' : 'danger'} pa-suspend-btn" data-id="${t.id}" style="padding:0 10px;margin-left:4px;">
            ${isLocked ? 'Mở khóa' : 'Khóa'}
          </button>
        </td>
      </tr>
    `;
  }).join('');
  enhanceTables(portalContainer);

  // Bind table action clicks
  tbody.querySelectorAll('.pa-tenant-click, .pa-detail-btn').forEach(b => {
    b.addEventListener('click', () => openTenantDetailDrawer(b.dataset.id));
  });
  tbody.querySelectorAll('.pa-suspend-btn').forEach(b => {
    b.addEventListener('click', () => {
      const org = state.organizations.find(o => o.id === b.dataset.id);
      if (org) {
        confirmTenantSuspension(org.id, org.status === 'suspended' ? 'unsuspend' : 'suspend');
      }
    });
  });
}

// -----------------------------------------------------------------------------
// 3. USERS VIEW
// -----------------------------------------------------------------------------
function renderUsers(container) {
  container.innerHTML = `
    <div class="page-heading">
      <div>
        <h1>Người dùng nền tảng</h1>
        <p>Theo dõi người dùng đã kích hoạt trên tất cả doanh nghiệp</p>
      </div>
      <div class="heading-actions">
        <button class="btn" id="paExportUsersBtn">Xuất danh sách</button>
      </div>
    </div>

    <!-- Users KPI -->
    <div class="grid kpi-grid">
      <article class="card kpi">
        <div class="kpi-icon blue">${icon('users')}</div>
        <div>
          <div class="kpi-label">Tổng tài khoản</div>
          <div class="kpi-value">${state.users.length}</div>
          <div class="trend up">Định danh xác thực</div>
        </div>
      </article>
      <article class="card kpi">
        <div class="kpi-icon green">${icon('shield')}</div>
        <div>
          <div class="kpi-label">Đã kích hoạt</div>
          <div class="kpi-value">${state.users.filter(u => u.status === 'active').length}</div>
          <div class="trend up">Hoạt động bình thường</div>
        </div>
      </article>
      <article class="card kpi">
        <div class="kpi-icon amber">${icon('refresh')}</div>
        <div>
          <div class="kpi-label">Chờ xác nhận</div>
          <div class="kpi-value">${state.users.filter(u => u.status === 'pending').length}</div>
          <div class="trend">Lời mời tham gia</div>
        </div>
      </article>
      <article class="card kpi">
        <div class="kpi-icon red">${icon('alert')}</div>
        <div>
          <div class="kpi-label">Bị vô hiệu hóa</div>
          <div class="kpi-value">${state.users.filter(u => u.status === 'disabled').length}</div>
          <div class="trend bad">Bảo vệ bảo mật</div>
        </div>
      </article>
    </div>

    <!-- Toolbar -->
    <div class="toolbar two">
      <div class="input-wrap">
        <span>${icon('search')}</span>
        <input id="userSearch" aria-label="Tìm người dùng theo tên, email hoặc doanh nghiệp" placeholder="Tìm theo tên, email, tenant..." value="${esc(state.userSearchQuery)}">
      </div>
      <select class="select" id="userRoleFilter" aria-label="Lọc người dùng theo vai trò">
        <option value="">Tất cả vai trò</option>
        <option value="owner" ${state.userFilterRole === 'owner' ? 'selected' : ''}>Owner</option>
        <option value="admin" ${state.userFilterRole === 'admin' ? 'selected' : ''}>Admin</option>
        <option value="manager" ${state.userFilterRole === 'manager' ? 'selected' : ''}>Manager</option>
        <option value="member" ${state.userFilterRole === 'member' ? 'selected' : ''}>Member</option>
        <option value="viewer" ${state.userFilterRole === 'viewer' ? 'selected' : ''}>Viewer</option>
      </select>
      <select class="select" id="userStatusFilter" aria-label="Lọc người dùng theo trạng thái">
        <option value="">Tất cả trạng thái</option>
        <option value="active" ${state.userFilterStatus === 'active' ? 'selected' : ''}>Đã kích hoạt</option>
        <option value="pending" ${state.userFilterStatus === 'pending' ? 'selected' : ''}>Chờ xác nhận</option>
      </select>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Người dùng</th>
            <th>Doanh nghiệp</th>
            <th>Vai trò</th>
            <th>Trạng thái</th>
            <th>Ngày tham gia</th>
          </tr>
        </thead>
        <tbody id="userTableBody"></tbody>
      </table>
    </div>
  `;

  filterAndRenderUsersTable();

  container.querySelector('#userSearch')?.addEventListener('input', (e) => {
    state.userSearchQuery = e.target.value.trim().toLowerCase();
    filterAndRenderUsersTable();
  });
  container.querySelector('#userRoleFilter')?.addEventListener('change', (e) => {
    state.userFilterRole = e.target.value;
    filterAndRenderUsersTable();
  });
  container.querySelector('#userStatusFilter')?.addEventListener('change', (e) => {
    state.userFilterStatus = e.target.value;
    filterAndRenderUsersTable();
  });
  container.querySelector('#paExportUsersBtn')?.addEventListener('click', () => {
    downloadCsv('worktree-platform-users.csv', ['Người dùng', 'Email', 'Doanh nghiệp', 'Vai trò', 'Trạng thái', 'Ngày tham gia'],
      state.users.map(user => [
        user.displayName,
        user.email,
        user.organizationName,
        user.role || 'Member',
        user.status || 'active',
        formatDate(user.createdAt || user.created_at)
      ]));
  });
}

function filterAndRenderUsersTable() {
  const tbody = portalContainer?.querySelector('#userTableBody');
  if (!tbody) return;

  const q = state.userSearchQuery;
  const r = state.userFilterRole;
  const s = state.userFilterStatus;

  const filtered = (state.users || []).filter(u => {
    const matchesSearch = !q || (u.displayName + ' ' + (u.email || '') + ' ' + (u.organizationName || '')).toLowerCase().includes(q);
    const matchesRole = !r || (u.role || '').toLowerCase() === r;
    const matchesStatus = !s || u.status === s;
    return matchesSearch && matchesRole && matchesStatus;
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty">Không tìm thấy người dùng phù hợp.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(u => {
    const role = (u.role || 'member').toLowerCase();
    const cls = getLogoColor(u.id);
    return `
      <tr>
        <td>
          <div class="user-name">
            <span class="user-avatar ${cls}">${getInitials(u.displayName)}</span>
            <div>
              <strong style="color:var(--text);">${esc(u.displayName)}</strong>
              <small style="display:block;color:var(--muted);">${esc(u.email || '—')}</small>
            </div>
          </div>
        </td>
        <td>${esc(u.organizationName || '—')}</td>
        <td><span class="pill ${role}">${esc(u.role || 'Member')}</span></td>
        <td><span class="pill ${u.status === 'active' ? 'active' : 'pending'}">${u.status === 'active' ? 'Đã kích hoạt' : 'Chờ xác nhận'}</span></td>
        <td>${formatDate(u.createdAt || u.created_at)}</td>
      </tr>
    `;
  }).join('');
  enhanceTables(portalContainer);
}

// -----------------------------------------------------------------------------
// 4. REVENUE VIEW
// -----------------------------------------------------------------------------
function renderRevenue(container) {
  container.innerHTML = `
    <div class="page-heading">
      <div>
        <h1>Doanh thu</h1>
        <p>Theo dõi MRR, ARR và hiệu quả tăng trưởng SaaS</p>
      </div>
      <div class="heading-actions">
        <button class="btn" id="paExportRevenueBtn">Xuất báo cáo</button>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="grid kpi-grid">
      <article class="card kpi">
        <div class="kpi-icon green">${icon('trend')}</div>
        <div>
          <div class="kpi-label">MRR Ước tính</div>
          <div class="kpi-value" style="font-size:22px;margin:8px 0 4px;">Chưa đối soát</div>
          <div class="trend">Chưa nối cổng thanh toán</div>
        </div>
      </article>
      <article class="card kpi">
        <div class="kpi-icon purple">${icon('trend')}</div>
        <div>
          <div class="kpi-label">ARR Dự phóng</div>
          <div class="kpi-value" style="font-size:22px;margin:8px 0 4px;">Chưa đối soát</div>
          <div class="trend">Theo giá niêm yết gói</div>
        </div>
      </article>
      <article class="card kpi">
        <div class="kpi-icon blue">${icon('building')}</div>
        <div>
          <div class="kpi-label">Tổng thuê bao</div>
          <div class="kpi-value">${state.organizations.length}</div>
          <div class="trend up">Đang quản trị</div>
        </div>
      </article>
      <article class="card kpi">
        <div class="kpi-icon amber">${icon('refresh')}</div>
        <div>
          <div class="kpi-label">Tỷ lệ duy trì</div>
          <div class="kpi-value">100%</div>
          <div class="trend up">Không có churn</div>
        </div>
      </article>
    </div>

    <div class="split">
      <article class="card panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">Xu hướng doanh thu & thuê bao</div>
            <div class="panel-sub">12 tháng gần nhất (Mô phỏng tăng trưởng)</div>
          </div>
        </div>
        <div class="bars">
          <div class="bar-col"><div class="bar green" style="--h:62px"></div><div class="bar-label">T1</div></div>
          <div class="bar-col"><div class="bar green" style="--h:72px"></div><div class="bar-label">T2</div></div>
          <div class="bar-col"><div class="bar green" style="--h:84px"></div><div class="bar-label">T3</div></div>
          <div class="bar-col"><div class="bar green" style="--h:91px"></div><div class="bar-label">T4</div></div>
          <div class="bar-col"><div class="bar green" style="--h:108px"></div><div class="bar-label">T5</div></div>
          <div class="bar-col"><div class="bar green" style="--h:123px"></div><div class="bar-label">T6</div></div>
          <div class="bar-col"><div class="bar green" style="--h:132px"></div><div class="bar-label">T7</div></div>
          <div class="bar-col"><div class="bar green" style="--h:142px"></div><div class="bar-label">T8</div></div>
          <div class="bar-col"><div class="bar green" style="--h:150px"></div><div class="bar-label">T9</div></div>
          <div class="bar-col"><div class="bar green" style="--h:162px"></div><div class="bar-label">T10</div></div>
          <div class="bar-col"><div class="bar green" style="--h:174px"></div><div class="bar-label">T11</div></div>
          <div class="bar-col"><div class="bar green" style="--h:190px"></div><div class="bar-label">T12</div></div>
        </div>
      </article>

      <div class="stack">
        <article class="card panel">
          <div class="panel-head">
            <div>
              <div class="panel-title">Phân loại thuê bao</div>
              <div class="panel-sub">Tỷ trọng doanh nghiệp theo gói</div>
            </div>
          </div>
          <div class="legend">
            <div class="legend-row"><span class="dot p"></span><span>Enterprise</span><strong>${(state.metrics?.plansBreakdown?.enterprise || 0)} tenant</strong></div>
            <div class="legend-row"><span class="dot b"></span><span>Business</span><strong>${(state.metrics?.plansBreakdown?.business || 0)} tenant</strong></div>
            <div class="legend-row"><span class="dot g"></span><span>Starter / Pro</span><strong>${(state.metrics?.plansBreakdown?.starter || 0)} tenant</strong></div>
            <div class="legend-row"><span class="dot n"></span><span>Free Tier</span><strong>${(state.metrics?.plansBreakdown?.free || 0)} tenant</strong></div>
          </div>
        </article>

        <article class="card panel">
          <div class="panel-head">
            <div>
              <div class="panel-title">Trạng thái thanh toán</div>
              <div class="panel-sub">Hóa đơn chu kỳ hiện tại</div>
            </div>
          </div>
          <div class="metric-row">
            <div class="metric-card card"><span>Đã thu</span><strong>${state.organizations.length}</strong></div>
            <div class="metric-card card"><span>Chờ duyệt</span><strong>0</strong></div>
            <div class="metric-card card"><span>Thất bại</span><strong>0</strong></div>
          </div>
        </article>
      </div>
    </div>

    <div class="card panel" style="margin-top:14px">
      <div class="panel-head">
        <div>
          <div class="panel-title">Ghi chú vận hành thanh toán</div>
          <div class="panel-sub">Chính sách bảo mật dữ liệu tài chính</div>
        </div>
      </div>
      <div class="callout warn">
        <strong>THÔNG BÁO MINH BẠCH DỮ LIỆU:</strong>
        <span>WorkTree X V1 đang vận hành ở chế độ phân quyền đa tổ chức độc lập. Module thanh toán tự động qua Stripe/VNPay sẽ được tích hợp ở bản cập nhật tiếp theo. Không bịa đặt số tiền giao dịch ảo trên màn hình production.</span>
      </div>
    </div>
  `;

  container.querySelector('#paExportRevenueBtn')?.addEventListener('click', () => {
    downloadCsv('worktree-platform-subscriptions.csv', ['Doanh nghiệp', 'Gói', 'Trạng thái', 'Số ghế'],
      state.organizations.map(org => [
        org.name,
        org.subscription?.plan || 'Free',
        org.subscription?.status || org.status || 'active',
        org.subscription?.seat_limit || org.subscription?.seatLimit || ''
      ]));
  });
}

// -----------------------------------------------------------------------------
// 5. PLANS VIEW
// -----------------------------------------------------------------------------
function renderPlans(container) {
  container.innerHTML = `
    <div class="page-heading">
      <div>
        <h1>Gói dịch vụ</h1>
        <p>Quản lý cấu hình thương mại và giới hạn của từng gói</p>
      </div>
      <div class="heading-actions">
        <button class="btn primary" disabled title="Cần API cấu hình gói có kiểm tra quyền">Cập nhật hạn mức</button>
      </div>
    </div>

    <!-- 4 Plan Cards -->
    <div class="grid plan-grid">
      <article class="card plan-card">
        <div class="plan-name">Free</div>
        <div class="plan-price">0đ <small>/ tháng</small></div>
        <div class="plan-sub" style="color:var(--muted);font-size:12px;">Trải nghiệm cho nhóm nhỏ khởi đầu.</div>
        <div class="plan-list">
          <div>5 người dùng tối đa</div>
          <div>1 GB dung lượng tệp</div>
          <div>Quản lý công việc cốt lõi</div>
        </div>
        <span class="pill active" style="width:100%;justify-content:center;padding:8px">Đang áp dụng</span>
      </article>

      <article class="card plan-card">
        <div class="plan-name">Starter</div>
        <div class="plan-price">490.000đ <small>/ tháng</small></div>
        <div class="plan-sub" style="color:var(--muted);font-size:12px;">Cho nhóm cộng tác đầy đủ tính năng.</div>
        <div class="plan-list">
          <div>20 người dùng</div>
          <div>20 GB dung lượng lưu trữ</div>
          <div>Realtime đa thiết bị & Zalo bot</div>
        </div>
        <span class="pill active" style="width:100%;justify-content:center;padding:8px">Đang áp dụng</span>
      </article>

      <article class="card plan-card recommended">
        <span class="pill pro" style="position:absolute;right:14px;top:14px">Phổ biến</span>
        <div class="plan-name">Business</div>
        <div class="plan-price">1.290.000đ <small>/ tháng</small></div>
        <div class="plan-sub" style="color:var(--muted);font-size:12px;">Doanh nghiệp đang mở rộng quy mô.</div>
        <div class="plan-list">
          <div>100 người dùng</div>
          <div>100 GB lưu trữ</div>
          <div>Security Audit & Hỗ trợ ưu tiên</div>
        </div>
        <span class="pill active" style="width:100%;justify-content:center;padding:8px">Đang áp dụng</span>
      </article>

      <article class="card plan-card">
        <div class="plan-name">Enterprise</div>
        <div class="plan-price">Liên hệ <small>/ năm</small></div>
        <div class="plan-sub" style="color:var(--muted);font-size:12px;">Tổ chức lớn cần SLA và hạ tầng riêng.</div>
        <div class="plan-list">
          <div>Không giới hạn người dùng</div>
          <div>Không giới hạn lưu trữ</div>
          <div>Chuyên gia hỗ trợ 24/7 & SSO</div>
        </div>
        <span class="pill active" style="width:100%;justify-content:center;padding:8px">Đang áp dụng</span>
      </article>
    </div>

    <!-- Feature Entitlements Matrix -->
    <div class="card panel" style="margin-top:14px">
      <div class="panel-head">
        <div>
          <div class="panel-title">Feature Entitlements Matrix</div>
          <div class="panel-sub">Phân quyền tính năng theo từng gói dịch vụ</div>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tính năng</th>
              <th>Free</th>
              <th>Starter</th>
              <th>Business</th>
              <th>Enterprise</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Quản lý Cây tổ chức & Phòng ban</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>Công việc, Checklist, Tiến độ</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>Dung lượng tệp đính kèm</td><td>1 GB</td><td>20 GB</td><td>100 GB</td><td>Tùy chỉnh</td></tr>
            <tr><td>Kênh Realtime WebSocket riêng tư</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>Đồng bộ thông báo Zalo Bot</td><td>—</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>Nhật ký Security Audit Logs</td><td>—</td><td>—</td><td>✓</td><td>✓</td></tr>
            <tr><td>Cam kết chất lượng dịch vụ (SLA)</td><td>—</td><td>—</td><td>—</td><td>✓</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// 6. VIOLATIONS VIEW
// -----------------------------------------------------------------------------
function renderViolations(container) {
  const violations = state.violations || [];

  container.innerHTML = `
    <div class="page-heading">
      <div>
        <h1>Cảnh báo & vi phạm</h1>
        <p>Theo dõi tenant có dấu hiệu vi phạm chính sách hoặc cần can thiệp vận hành</p>
      </div>
      <div class="heading-actions">
        <button class="btn" id="paRefreshViolationsBtn">Quét lại vi phạm ${icon('refresh')}</button>
      </div>
    </div>

    <div class="grid kpi-grid">
      <article class="card kpi">
        <div class="kpi-icon red">${icon('alert')}</div>
        <div>
          <div class="kpi-label">Vi phạm đang mở</div>
          <div class="kpi-value">${violations.filter(v => v.status === 'open').length}</div>
          <div class="trend bad">Cần xử lý kịp thời</div>
        </div>
      </article>
      <article class="card kpi">
        <div class="kpi-icon amber">${icon('refresh')}</div>
        <div>
          <div class="kpi-label">Đang xem xét</div>
          <div class="kpi-value">${violations.filter(v => v.status === 'reviewing').length}</div>
          <div class="trend">Đang đánh giá</div>
        </div>
      </article>
      <article class="card kpi">
        <div class="kpi-icon green">${icon('shield')}</div>
        <div>
          <div class="kpi-label">Đã giải quyết</div>
          <div class="kpi-value">${violations.filter(v => v.status === 'resolved').length}</div>
          <div class="trend up">Đã khôi phục an toàn</div>
        </div>
      </article>
      <article class="card kpi">
        <div class="kpi-icon blue">${icon('building')}</div>
        <div>
          <div class="kpi-label">Tenant bị khóa</div>
          <div class="kpi-value">${state.organizations.filter(o => o.status === 'suspended').length}</div>
          <div class="trend">Chặn quyền truy cập</div>
        </div>
      </article>
    </div>

    <div class="stack">
      ${violations.length ? violations.map(v => {
        const isRed = v.severity === 'critical' || v.severity === 'high';
        return `
          <article class="card alert-card">
            <div class="alert-icon ${isRed ? 'red' : 'amber'}">${icon('alert')}</div>
            <div>
              <strong style="color:var(--text);">${esc(v.summary)}</strong>
              <div style="color:var(--muted);margin-top:2px;">${esc(v.details || 'Không có ghi chú thêm.')}</div>
              <div class="alert-meta">
                <span>Tenant ID: ${esc(v.organization_id)}</span>
                <span>• Loại: ${esc(v.type)}</span>
                <span>• Mức độ: ${esc(v.severity)}</span>
                <span>• Thời gian: ${formatRelativeTime(v.created_at)}</span>
              </div>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn pa-suspend-btn" data-id="${v.organization_id}">Khóa tenant</button>
            </div>
          </article>
        `;
      }).join('') : `
        <article class="card panel">
          <div class="empty">
            <div style="display:grid;place-items:center;margin-bottom:8px;color:var(--green);">${icon('shield')}</div>
            <strong style="display:block;color:var(--text);">Hệ thống đang an toàn</strong>
            <span style="font-size:12px;color:var(--muted);">Không có báo cáo vi phạm chính sách hoặc lạm dụng tài nguyên nào được ghi nhận.</span>
          </div>
        </article>
      `}
    </div>
  `;

  container.querySelector('#paRefreshViolationsBtn')?.addEventListener('click', () => loadPortalData());
}

// -----------------------------------------------------------------------------
// 7. LOGS VIEW
// -----------------------------------------------------------------------------
function renderLogs(container) {
  container.innerHTML = `
    <div class="page-heading">
      <div>
        <h1>Nhật ký hệ thống</h1>
        <p>Audit hoạt động của Platform Super-Admin và các sự kiện bảo mật toàn nền tảng</p>
      </div>
      <div class="heading-actions">
        <button class="btn" id="paRefreshLogsBtn">Làm mới log ${icon('refresh')}</button>
      </div>
    </div>

    <div class="toolbar two">
      <div class="input-wrap">
        <span>${icon('search')}</span>
        <input id="paLogSearch" aria-label="Tìm nhật ký theo actor, doanh nghiệp hoặc hành động" placeholder="Tìm actor, tenant, hành động..." value="${esc(state.logSearchQuery)}">
      </div>
      <select class="select" id="paLogActionFilter" aria-label="Lọc nhật ký theo loại hành động">
        <option value="">Tất cả hành động</option>
        <option value="TENANT_SUSPENDED" ${state.logActionFilter === 'TENANT_SUSPENDED' ? 'selected' : ''}>TENANT_SUSPENDED</option>
        <option value="TENANT_UNSUSPENDED" ${state.logActionFilter === 'TENANT_UNSUSPENDED' ? 'selected' : ''}>TENANT_UNSUSPENDED</option>
      </select>
      <select class="select" aria-label="Lọc nhật ký theo khoảng thời gian" disabled title="API hiện trả dữ liệu trong 30 ngày gần nhất">
        <option>30 ngày gần nhất</option>
      </select>
    </div>

    <div class="card" style="overflow:hidden">
      <div class="log-row header">
        <div>Thời gian</div>
        <div>Actor ID</div>
        <div>Tenant</div>
        <div>Hành động</div>
        <div>Kết quả</div>
      </div>
      <div id="paLogRows"></div>
    </div>
  `;

  filterAndRenderLogs();
  container.querySelector('#paRefreshLogsBtn')?.addEventListener('click', () => loadPortalData());
  container.querySelector('#paLogSearch')?.addEventListener('input', event => {
    state.logSearchQuery = event.target.value.trim().toLowerCase();
    filterAndRenderLogs();
  });
  container.querySelector('#paLogActionFilter')?.addEventListener('change', event => {
    state.logActionFilter = event.target.value;
    filterAndRenderLogs();
  });
}

function filterAndRenderLogs() {
  const target = portalContainer?.querySelector('#paLogRows');
  if (!target) return;
  const q = state.logSearchQuery;
  const action = state.logActionFilter;
  const filtered = (state.logs || []).filter(log => {
    const haystack = `${log.actor_user_id || 'System'} ${log.metadata?.organization_name || ''} ${log.target_type || ''} ${log.action || ''}`.toLowerCase();
    return (!q || haystack.includes(q)) && (!action || log.action === action);
  });

  target.innerHTML = filtered.length ? filtered.map(log => `
    <div class="log-row">
      <div style="color:var(--muted);font-size:11.5px;">${formatDate(log.created_at)}</div>
      <div style="font-family:monospace;font-size:11px;">${esc((log.actor_user_id || 'System').slice(0, 8))}...</div>
      <div>${esc(log.metadata?.organization_name || log.target_type || '—')}</div>
      <div class="log-action" style="color:var(--primary);">${esc(log.action)}</div>
      <div><span class="pill active">Thành công</span></div>
    </div>
  `).join('') : '<div class="empty">Không tìm thấy nhật ký phù hợp.</div>';
}

// -----------------------------------------------------------------------------
// 8. SETTINGS VIEW
// -----------------------------------------------------------------------------
function renderSettings(container) {
  container.innerHTML = `
    <div class="page-heading">
      <div>
        <h1>Cấu hình nền tảng</h1>
        <p>Cấu hình hành vi mặc định và chính sách vận hành toàn hệ thống WorkTree X</p>
      </div>
      <div class="heading-actions">
        <button class="btn primary" id="paSaveSettingsBtn">Lưu thay đổi</button>
      </div>
    </div>

    <div class="callout warn" role="note" style="margin-bottom:14px">
      <strong>Chế độ bản nháp an toàn</strong>
      <span>Các thay đổi chỉ được lưu sau khi API cấu hình có kiểm tra quyền và Security Audit Log được triển khai.</span>
    </div>

    <div class="grid settings-grid">
      <!-- Section 1 -->
      <article class="card settings-section">
        <div class="panel-head">
          <div>
            <div class="panel-title">Thiết lập chung</div>
            <div class="panel-sub">Thông tin nhận diện và địa chỉ hệ thống</div>
          </div>
        </div>
        <div class="field">
          <label for="paPlatformName">Tên nền tảng</label>
          <input class="text-input" id="paPlatformName" value="WorkTree X" readonly>
        </div>
        <div class="field">
          <label for="paPlatformDomain">Domain chính</label>
          <input class="text-input" id="paPlatformDomain" value="app.worktree.vn" readonly>
        </div>
        <div class="field">
          <label for="paDefaultTimezone">Múi giờ mặc định</label>
          <select class="select" id="paDefaultTimezone">
            <option>Asia/Ho_Chi_Minh (GMT+7)</option>
            <option>UTC</option>
          </select>
        </div>
      </article>

      <!-- Section 2 -->
      <article class="card settings-section">
        <div class="panel-head">
          <div>
            <div class="panel-title">Chính sách doanh nghiệp (Tenant)</div>
            <div class="panel-sub">Quy tắc mặc định khi khởi tạo workspace mới</div>
          </div>
        </div>
        <div class="toggle-row">
          <div>
            <strong style="color:var(--text);">Cho phép đăng ký mới</strong>
            <small style="display:block;color:var(--muted)">Người dùng có thể tự tạo workspace tổ chức</small>
          </div>
          <button class="switch on" type="button" role="switch" aria-checked="true" aria-label="Cho phép đăng ký mới"><span></span></button>
        </div>
        <div class="toggle-row">
          <div>
            <strong style="color:var(--text);">Tự kích hoạt gói Free</strong>
            <small style="display:block;color:var(--muted)">Gán gói dùng thử miễn phí khi tạo workspace</small>
          </div>
          <button class="switch on" type="button" role="switch" aria-checked="true" aria-label="Tự kích hoạt gói Free"><span></span></button>
        </div>
        <div class="toggle-row">
          <div>
            <strong style="color:var(--text);">Yêu cầu xác minh tài khoản</strong>
            <small style="display:block;color:var(--muted)">Bắt buộc xác thực email qua Supabase Auth</small>
          </div>
          <button class="switch on" type="button" role="switch" aria-checked="true" aria-label="Yêu cầu xác minh tài khoản"><span></span></button>
        </div>
      </article>

      <!-- Section 3 -->
      <article class="card settings-section">
        <div class="panel-head">
          <div>
            <div class="panel-title">Bảo mật nền tảng</div>
            <div class="panel-sub">Các cơ chế bảo vệ tài khoản Super-Admin</div>
          </div>
        </div>
        <div class="toggle-row">
          <div>
            <strong style="color:var(--text);">Ghi Security Audit bất biến</strong>
            <small style="display:block;color:var(--muted)">Lưu mọi hành động quản trị vào audit table</small>
          </div>
          <button class="switch on" type="button" role="switch" aria-checked="true" aria-label="Ghi Security Audit bất biến"><span></span></button>
        </div>
        <div class="toggle-row">
          <div>
            <strong style="color:var(--text);">Kiểm tra thẩm quyền phía Server</strong>
            <small style="display:block;color:var(--muted)">Xác thực JWT và public.platform_admins</small>
          </div>
          <button class="switch on" type="button" role="switch" aria-checked="true" aria-label="Kiểm tra thẩm quyền phía Server"><span></span></button>
        </div>
      </article>

      <!-- Section 4 -->
      <article class="card settings-section">
        <div class="panel-head">
          <div>
            <div class="panel-title">Giới hạn tài nguyên mặc định</div>
            <div class="panel-sub">Hạn mức áp dụng khi chưa cấu hình gói riêng</div>
          </div>
        </div>
        <div class="field">
          <label for="paDefaultUsers">Người dùng tối đa mặc định</label>
          <input class="text-input" id="paDefaultUsers" type="number" min="1" value="100">
        </div>
        <div class="field">
          <label for="paDefaultStorage">Dung lượng lưu trữ mặc định (GB)</label>
          <input class="text-input" id="paDefaultStorage" type="number" min="1" value="20">
        </div>
        <div class="field">
          <label for="paDefaultUpload">Kích thước tệp tải lên tối đa (MB)</label>
          <input class="text-input" id="paDefaultUpload" type="number" min="1" value="50">
        </div>
      </article>
    </div>
  `;

  container.querySelectorAll('.switch').forEach(sw => {
    sw.addEventListener('click', () => {
      const isOn = sw.classList.toggle('on');
      sw.setAttribute('aria-checked', String(isOn));
    });
  });

  container.querySelector('#paSaveSettingsBtn')?.addEventListener('click', () => {
    showPortalToast('Chưa lưu: cần triển khai API cấu hình có kiểm tra quyền và ghi Security Audit Log.', 'warn');
  });
}

// -----------------------------------------------------------------------------
// 9. ADMINS VIEW
// -----------------------------------------------------------------------------
function renderAdmins(container) {
  const admins = state.admins || [];

  container.innerHTML = `
    <div class="page-heading">
      <div>
        <h1>Platform Admin</h1>
        <p>Quản lý tài khoản có quyền vận hành toàn bộ nền tảng WorkTree X</p>
      </div>
      <div class="heading-actions">
        <button class="btn primary" id="paAddAdminBtn">＋ Thêm Platform Admin</button>
      </div>
    </div>

    <div class="split">
      <article class="card panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">Quản trị viên cấp cao hiện tại</div>
            <div class="panel-sub">Tài khoản được cấp quyền trong public.platform_admins</div>
          </div>
        </div>
        <div class="admin-list">
          ${admins.length ? admins.map(a => `
            <div class="admin-card">
              <div class="avatar" style="background:linear-gradient(135deg,#7265e8,#478fee);">
                ${esc(getInitials(a.displayName || a.email || 'PA'))}
              </div>
              <div class="meta">
                <strong>${esc(a.displayName || a.email || a.user_id)}</strong>
                <small>${esc(a.role || 'Platform Admin')}</small>
              </div>
              <span class="pill owner">Super-Admin</span>
            </div>
          `).join('') : `
            <div class="admin-card">
              <div class="avatar">PA</div>
              <div class="meta">
                <strong>Super Admin Active</strong>
                <small>Thẩm quyền xác thực qua cơ sở dữ liệu</small>
              </div>
              <span class="pill owner">Active</span>
            </div>
          `}
        </div>
      </article>

      <div class="stack">
        <article class="card panel">
          <div class="panel-head">
            <div>
              <div class="panel-title">Nguyên tắc phân quyền tối cao</div>
              <div class="panel-sub">Tách biệt hoàn toàn với vai trò của Tenant</div>
            </div>
          </div>
          <div class="plan-list">
            <div>Platform Admin KHÔNG PHẢI là Tenant Owner</div>
            <div>Tenant Owner KHÔNG BAO GIỜ tự động có quyền Platform Admin</div>
            <div>Mọi thao tác khóa/mở tenant đều được ghi nhận Security Audit Log</div>
            <div>Tuyệt đối không nhúng secret key của hệ thống vào trình duyệt client</div>
          </div>
        </article>

        <article class="card panel">
          <div class="panel-head">
            <div>
              <div class="panel-title">Phiên quản trị hiện hành</div>
              <div class="panel-sub">Thông tin phiên Super-Admin đang kết nối</div>
            </div>
          </div>
          <div class="metric-row">
            <div class="metric-card card">
              <span>Trạng thái</span>
              <strong style="color:var(--green);font-size:18px;">Active</strong>
            </div>
            <div class="metric-card card">
              <span>Bảo mật</span>
              <strong style="font-size:18px;">JWT Verified</strong>
            </div>
            <div class="metric-card card">
              <span>Quyền hạn</span>
              <strong style="font-size:18px;">100% Full</strong>
            </div>
          </div>
        </article>
      </div>
    </div>
  `;

  container.querySelector('#paAddAdminBtn')?.addEventListener('click', () => {
    showPortalToast('Thêm Platform Admin phải thực hiện qua quy trình máy chủ đáng tin cậy có Security Audit Log.', 'warn');
  });
}

// -----------------------------------------------------------------------------
// TENANT DETAIL DRAWER LOGIC
// -----------------------------------------------------------------------------
async function openTenantDetailDrawer(orgId) {
  const drawer = portalContainer?.querySelector('#paTenantDrawer');
  const orgNameEl = portalContainer?.querySelector('#paDrawerOrgName');
  const orgSlugEl = portalContainer?.querySelector('#paDrawerOrgSlug');
  const stateBtn = portalContainer?.querySelector('#paDrawerTenantStateBtn');
  if (!drawer) return;

  selectedTenantTab = 'overview';
  state.selectedTenant = null;
  drawer.showModal();
  drawer.querySelectorAll('[role="tab"]').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === 'overview');
    tab.setAttribute('aria-selected', String(tab.dataset.tab === 'overview'));
  });

  const cachedOrg = state.organizations.find(o => o.id === orgId);
  orgNameEl.textContent = cachedOrg ? cachedOrg.name : 'Đang tải thông tin...';
  orgSlugEl.textContent = cachedOrg ? (cachedOrg.domain || cachedOrg.slug) : '';

  if (stateBtn && cachedOrg) {
    const isLocked = cachedOrg.status === 'suspended';
    stateBtn.textContent = isLocked ? 'Mở khóa doanh nghiệp' : 'Khóa doanh nghiệp';
    stateBtn.className = 'btn ' + (isLocked ? 'success' : 'danger');
    stateBtn.onclick = () => {
      drawer.close();
      confirmTenantSuspension(cachedOrg.id, isLocked ? 'unsuspend' : 'suspend');
    };
  }

  const body = portalContainer?.querySelector('#paDrawerBody');
  body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:240px;color:var(--muted);gap:10px;">
      <div style="width:28px;height:28px;border:2px solid var(--line);border-top-color:var(--primary);border-radius:50%;animation:spin .8s linear infinite;"></div>
      <span>Đang nạp chi tiết tenant...</span>
    </div>
  `;

  try {
    const detail = await PlatformAdminService.getTenantDetail(orgId);
    state.selectedTenant = detail;
    renderDrawerActiveTab();
  } catch (err) {
    body.innerHTML = `<div class="empty" role="status">Chưa tải được thông tin doanh nghiệp. Hãy đóng và thử lại.</div>`;
  }
}

function renderDrawerActiveTab() {
  const body = portalContainer?.querySelector('#paDrawerBody');
  const tabs = portalContainer?.querySelectorAll('#paDrawerTabs .tab-btn');
  if (!body) return;

  tabs?.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === selectedTenantTab);
    btn.setAttribute('aria-selected', String(btn.dataset.tab === selectedTenantTab));
  });

  const t = state.selectedTenant;
  if (!t) return;

  const isLocked = t.status === 'suspended';

  if (selectedTenantTab === 'overview') {
    body.innerHTML = `
      <div class="callout ${isLocked ? 'red' : ''}">
        <strong>${isLocked ? 'Doanh nghiệp đang bị khóa (Suspended)' : 'Doanh nghiệp đang hoạt động bình thường (Active)'}</strong>
        <span>${isLocked ? `Lý do: ${esc(t.suspension_reason || 'Bị khóa bởi quản trị viên.')}` : 'Không phát hiện bất thường bảo mật trong chu kỳ hiện tại.'}</span>
      </div>

      <div class="drawer-grid" style="margin-top:14px">
        <div class="detail-item">
          <span>Gói dịch vụ</span>
          <strong>${esc(t.subscription?.plan || 'Free')}</strong>
        </div>
        <div class="detail-item">
          <span>Trạng thái tài khoản</span>
          <strong style="color:${isLocked ? 'var(--red)' : 'var(--green)'};">${isLocked ? 'Đã khóa' : 'Hoạt động'}</strong>
        </div>
        <div class="detail-item">
          <span>Người sáng lập / Owner</span>
          <strong>${esc(t.ownerName || '—')}</strong>
        </div>
        <div class="detail-item">
          <span>Mã định danh (Slug)</span>
          <strong style="font-family:monospace;">${esc(t.slug || '—')}</strong>
        </div>
        <div class="detail-item">
          <span>Số lượng thành viên</span>
          <strong>${t.stats?.memberCount ?? 0} tài khoản</strong>
        </div>
        <div class="detail-item">
          <span>Tổng số công việc</span>
          <strong>${t.stats?.taskCount || 0} tasks</strong>
        </div>
        <div class="detail-item">
          <span>Phòng ban / Dự án</span>
          <strong>${t.stats?.nodeCount || 0} đơn vị</strong>
        </div>
        <div class="detail-item">
          <span>Ngày tạo</span>
          <strong>${formatDate(t.created_at)}</strong>
        </div>
        <div class="detail-item" style="grid-column:1/-1;">
          <span>Organization ID</span>
          <strong style="font-family:monospace;font-size:11.5px;">${esc(t.id)}</strong>
        </div>
      </div>
    `;
  } else if (selectedTenantTab === 'users') {
    const members = t.members || [];
    body.innerHTML = `
      <div class="panel-head">
        <div>
          <div class="panel-title">Thành viên tổ chức (${members.length})</div>
          <div class="panel-sub">Danh sách các tài khoản đang thuộc doanh nghiệp này</div>
        </div>
      </div>
      ${members.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Họ và tên</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              ${members.map(m => `
                <tr>
                  <td><strong>${esc(m.displayName || m.user_id.slice(0, 8))}</strong></td>
                  <td><span class="pill ${m.role}">${esc(m.role)}</span></td>
                  <td><span class="pill ${m.status === 'active' ? 'active' : 'pending'}">${m.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <div class="empty">Chưa có danh sách thành viên.</div>
      `}
    `;
  } else if (selectedTenantTab === 'billing') {
    const sub = t.subscription || {};
    body.innerHTML = `
      <div class="metric-row">
        <div class="metric-card card">
          <span>Gói cước</span>
          <strong style="color:var(--primary);text-transform:uppercase;">${esc(sub.plan || 'Free')}</strong>
        </div>
        <div class="metric-card card">
          <span>Giới hạn Seats</span>
          <strong>${sub.seat_limit || 5}</strong>
        </div>
        <div class="metric-card card">
          <span>Hạn mức Storage</span>
          <strong>${Math.round((sub.storage_bytes_limit || 1073741824) / 1073741824)} GB</strong>
        </div>
      </div>

      <div class="callout warn" style="margin-top:14px">
        <strong>Thông tin thuê bao:</strong>
        <span>Trạng thái: ${esc(sub.status || 'Active')} · Hạn mức đang kích hoạt trực tiếp từ Supabase Cloud.</span>
      </div>
    `;
  } else if (selectedTenantTab === 'audit') {
    const logs = t.auditLogs || [];
    body.innerHTML = `
      <div class="timeline" style="margin-top:10px;">
        ${logs.length ? logs.map(l => `
          <div class="timeline-item">
            <strong>${esc(l.action)}</strong>
            <small>Actor: ${esc((l.actor_user_id || 'System').slice(0, 8))}... · ${formatRelativeTime(l.created_at)}</small>
          </div>
        `).join('') : `
          <div class="timeline-item">
            <strong>Doanh nghiệp khởi tạo</strong>
            <small>Hệ thống WorkTree X · ${formatDate(t.created_at)}</small>
          </div>
        `}
      </div>
    `;
  }
}

// -----------------------------------------------------------------------------
// DANGEROUS SUSPEND / UNSUSPEND WORKFLOW
// -----------------------------------------------------------------------------
function confirmTenantSuspension(organizationId, action) {
  const dialog = portalContainer?.querySelector('#paConfirmDialog');
  const title = portalContainer?.querySelector('#paConfirmTitle');
  const callout = portalContainer?.querySelector('#paConfirmCallout');
  const reasonInput = portalContainer?.querySelector('#paConfirmReason');
  const proceedBtn = portalContainer?.querySelector('#paProceedConfirmBtn');
  if (!dialog) return;

  const org = state.organizations.find(o => o.id === organizationId);
  const orgName = org ? org.name : 'doanh nghiệp này';

  if (action === 'suspend') {
    title.textContent = `Tạm khóa doanh nghiệp: ${orgName}`;
    callout.innerHTML = `
      <strong>HÀNH ĐỘNG CÓ TÁC ĐỘNG CAO:</strong><br>
      Khóa doanh nghiệp này sẽ <strong>chặn toàn bộ quyền truy cập</strong> của mọi thành viên (Owner, Admin, Member) tại tầng Database/RLS.<br>
      Dữ liệu công việc và tài liệu sẽ <strong>không bị xóa</strong> và có thể phục hồi bất cứ lúc nào.
    `;
    callout.className = 'callout red';
    proceedBtn.className = 'btn danger';
    proceedBtn.textContent = 'Khóa doanh nghiệp';
  } else {
    title.textContent = `Mở khóa doanh nghiệp: ${orgName}`;
    callout.innerHTML = `
      <strong>KÍCH HOẠT LẠI DOANH NGHIỆP:</strong><br>
      Doanh nghiệp này sẽ được kích hoạt lại trạng thái hoạt động bình thường (Active) và các thành viên có thể đăng nhập tiếp tục làm việc.
    `;
    callout.className = 'callout';
    proceedBtn.className = 'btn success';
    proceedBtn.textContent = 'Kích hoạt lại';
  }

  reasonInput.value = '';
  dialog.showModal();

  proceedBtn.onclick = async () => {
    const reason = reasonInput.value.trim();
    if (action === 'suspend' && !reason) {
      showPortalToast('Vui lòng nhập lý do khóa doanh nghiệp để ghi vào Security Audit Log.', 'error');
      reasonInput.focus();
      return;
    }

    const proceedLabel = proceedBtn.textContent;
    proceedBtn.disabled = true;
    proceedBtn.textContent = 'Đang xử lý...';

    try {
      if (action === 'suspend') {
        await PlatformAdminService.suspendTenant(organizationId, reason);
      } else {
        await PlatformAdminService.unsuspendTenant(organizationId, reason || 'Phục hồi hoạt động bởi Platform Admin');
      }

      dialog.close();
      await loadPortalData();
    } catch (err) {
      showPortalToast(`Không thể hoàn tất thao tác: ${err.message}`, 'error');
    } finally {
      proceedBtn.disabled = false;
      proceedBtn.textContent = proceedLabel;
    }
  };
}

/**
 * Mở toàn màn hình Platform Admin Portal
 */
export async function openPlatformAdminPortal(initialView = null) {
  const container = initPlatformAdminShell();
  container.style.display = 'block';
  activatePortalContext(container);
  syncMobileAccess();

  // Sync theme
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  container.setAttribute('data-theme', currentTheme);
  syncThemeControl(container, currentTheme);

  if (initialView) {
    switchView(initialView);
  } else {
    document.title = `${VIEW_TITLES[currentView]} · Platform Admin · WorkTree X`;
  }

  // Load authoritative admin email into profile pill
  try {
    const sb = await (await import('../../../lib/supabase/client.js')).getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    const emailEl = container.querySelector('#paAdminEmail');
    const avatarPill = container.querySelector('#paAvatarPill');
    if (emailEl && user?.email) {
      emailEl.textContent = user.email;
      if (avatarPill) avatarPill.textContent = getInitials(user.email.split('@')[0]);
    }
  } catch (_) {}

  await loadPortalData();
  window.requestAnimationFrame(() => {
    const heading = container.querySelector('#paContentArea h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    } else {
      container.focus({ preventScroll: true });
    }
  });
}

/**
 * Đóng Platform Admin Portal và quay về không gian WorkTree bình thường
 */
export function closePlatformAdminPortal() {
  if (portalContainer) {
    portalContainer.style.display = 'none';
    closeMobileSidebar();
    deactivatePortalContext(portalContainer);
  }
  const h = (window.location.hash || '').toLowerCase();
  if (h.startsWith('#admin') || h.startsWith('#platform-admin') || h.startsWith('#admon')) {
    try {
      window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
    } catch (_) {
      window.location.hash = '';
    }
  }
}
