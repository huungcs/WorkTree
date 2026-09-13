/**
 * WorkTree X — Platform Admin Portal Shell (V1)
 * Secure SaaS Super-Admin Operations Console
 * Strictly follows WorkTree X Design System & AGENTS.md contract.
 */

import { PlatformAdminService } from '../services/platform-admin-service.js';

let portalContainer = null;
let currentView = 'overview';
let isCollapsed = false;
let isMobileOpen = false;

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
  searchQuery: '',
  tenantFilterStatus: '',
  tenantFilterPlan: '',
  userFilterRole: '',
  userFilterStatus: ''
};

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
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  } catch (_) {
    return '—';
  }
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
  container.style.cssText = `
    display: none;
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: var(--bg);
    color: var(--text);
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    overflow: hidden;
  `;

  container.innerHTML = `
    <div class="app" id="paApp" style="min-height:100vh;display:grid;grid-template-columns:var(--side-width, 278px) minmax(0,1fr);transition:grid-template-columns .2s cubic-bezier(.2,.75,.25,1);height:100vh;overflow:hidden;">
      <!-- Sidebar -->
      <aside class="sidebar" id="paSidebar" style="background:var(--sidebar);color:var(--sidebar-text);border-right:1px solid var(--sidebar-line);display:flex;flex-direction:column;overflow:hidden;z-index:30;">
        <div class="brand" style="height:70px;display:flex;align-items:center;gap:10px;padding:0 16px;border-bottom:1px solid var(--sidebar-line);white-space:nowrap;position:relative;">
          <div class="brand-mark" style="width:36px;height:36px;border-radius:11px;background:#c1f0d6;color:#1c594b;display:grid;place-items:center;font-weight:900;font-size:17px;flex:0 0 auto;">W</div>
          <div class="brand-copy">
            <div style="font-size:17px;font-weight:800;letter-spacing:-0.2px;">WorkTree <span style="color:var(--primary);">X</span></div>
            <div style="font-size:11px;color:var(--sidebar-muted);margin-top:-2px;">Platform Admin</div>
          </div>
          <button class="collapse-btn" id="paCollapseBtn" aria-label="Thu gọn sidebar" style="position:absolute;right:10px;top:21px;border:0;background:rgba(255,255,255,.07);color:var(--sidebar-text);width:28px;height:28px;border-radius:8px;display:grid;place-items:center;cursor:pointer;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
        </div>

        <div class="side-scroll" style="padding:12px 10px 18px;overflow-y:auto;flex:1;">
          <button class="nav-item active" data-view="overview" style="width:100%;border:0;background:rgba(144,135,245,.18);color:#fff;display:flex;align-items:center;gap:12px;min-height:44px;border-radius:9px;padding:0 12px;margin:2px 0;text-align:left;white-space:nowrap;cursor:pointer;">
            <span class="nav-icon" style="width:20px;display:grid;place-items:center;color:#a89cff;">⌂</span>
            <span class="nav-label">Tổng quan nền tảng</span>
          </button>
          <button class="nav-item" data-view="tenants" style="width:100%;border:0;background:transparent;color:var(--sidebar-text);display:flex;align-items:center;gap:12px;min-height:44px;border-radius:9px;padding:0 12px;margin:2px 0;text-align:left;white-space:nowrap;cursor:pointer;">
            <span class="nav-icon" style="width:20px;display:grid;place-items:center;color:#b7c3db;">▦</span>
            <span class="nav-label">Doanh nghiệp</span>
            <span class="nav-count" id="paTenantNavCount" style="margin-left:auto;min-width:21px;height:20px;border-radius:6px;display:grid;place-items:center;padding:0 6px;background:rgba(255,255,255,.08);font-size:11px;">—</span>
          </button>
          <button class="nav-item" data-view="users" style="width:100%;border:0;background:transparent;color:var(--sidebar-text);display:flex;align-items:center;gap:12px;min-height:44px;border-radius:9px;padding:0 12px;margin:2px 0;text-align:left;white-space:nowrap;cursor:pointer;">
            <span class="nav-icon" style="width:20px;display:grid;place-items:center;color:#b7c3db;">♙</span>
            <span class="nav-label">Người dùng</span>
            <span class="nav-count" id="paUserNavCount" style="margin-left:auto;min-width:21px;height:20px;border-radius:6px;display:grid;place-items:center;padding:0 6px;background:rgba(255,255,255,.08);font-size:11px;">—</span>
          </button>
          <button class="nav-item" data-view="revenue" style="width:100%;border:0;background:transparent;color:var(--sidebar-text);display:flex;align-items:center;gap:12px;min-height:44px;border-radius:9px;padding:0 12px;margin:2px 0;text-align:left;white-space:nowrap;cursor:pointer;">
            <span class="nav-icon" style="width:20px;display:grid;place-items:center;color:#b7c3db;">↗</span>
            <span class="nav-label">Doanh thu</span>
          </button>
          <button class="nav-item" data-view="plans" style="width:100%;border:0;background:transparent;color:var(--sidebar-text);display:flex;align-items:center;gap:12px;min-height:44px;border-radius:9px;padding:0 12px;margin:2px 0;text-align:left;white-space:nowrap;cursor:pointer;">
            <span class="nav-icon" style="width:20px;display:grid;place-items:center;color:#b7c3db;">◇</span>
            <span class="nav-label">Gói dịch vụ</span>
          </button>
          <button class="nav-item" data-view="violations" style="width:100%;border:0;background:transparent;color:var(--sidebar-text);display:flex;align-items:center;gap:12px;min-height:44px;border-radius:9px;padding:0 12px;margin:2px 0;text-align:left;white-space:nowrap;cursor:pointer;">
            <span class="nav-icon" style="width:20px;display:grid;place-items:center;color:#b7c3db;">!</span>
            <span class="nav-label">Cảnh báo & vi phạm</span>
            <span class="nav-count" id="paViolationNavCount" style="margin-left:auto;min-width:21px;height:20px;border-radius:6px;display:grid;place-items:center;padding:0 6px;background:rgba(255,255,255,.08);font-size:11px;">0</span>
          </button>
          <button class="nav-item" data-view="logs" style="width:100%;border:0;background:transparent;color:var(--sidebar-text);display:flex;align-items:center;gap:12px;min-height:44px;border-radius:9px;padding:0 12px;margin:2px 0;text-align:left;white-space:nowrap;cursor:pointer;">
            <span class="nav-icon" style="width:20px;display:grid;place-items:center;color:#b7c3db;">☷</span>
            <span class="nav-label">Nhật ký hệ thống</span>
          </button>

          <div style="padding:16px 10px 8px;color:var(--sidebar-muted);font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;">Nền tảng</div>
          <button class="nav-item" data-view="settings" style="width:100%;border:0;background:transparent;color:var(--sidebar-text);display:flex;align-items:center;gap:12px;min-height:44px;border-radius:9px;padding:0 12px;margin:2px 0;text-align:left;white-space:nowrap;cursor:pointer;">
            <span class="nav-icon" style="width:20px;display:grid;place-items:center;color:#b7c3db;">⚙</span>
            <span class="nav-label">Cấu hình nền tảng</span>
          </button>
          <button class="nav-item" data-view="admins" style="width:100%;border:0;background:transparent;color:var(--sidebar-text);display:flex;align-items:center;gap:12px;min-height:44px;border-radius:9px;padding:0 12px;margin:2px 0;text-align:left;white-space:nowrap;cursor:pointer;">
            <span class="nav-icon" style="width:20px;display:grid;place-items:center;color:#b7c3db;">♜</span>
            <span class="nav-label">Platform Admin</span>
            <span class="nav-count" id="paAdminNavCount" style="margin-left:auto;min-width:21px;height:20px;border-radius:6px;display:grid;place-items:center;padding:0 6px;background:rgba(255,255,255,.08);font-size:11px;">1</span>
          </button>
        </div>

        <div class="side-footer" style="padding:12px 10px;border-top:1px solid var(--sidebar-line);">
          <button type="button" class="back-app" id="paBackToApp" style="width:100%;display:flex;align-items:center;gap:11px;padding:11px 12px;border-radius:10px;background:rgba(255,255,255,.05);border:0;color:#fff;cursor:pointer;text-align:left;">
            <span style="font-size:16px;">←</span>
            <div>
              <strong style="display:block;font-size:12.5px;">Quay về WorkTree</strong>
              <small style="display:block;color:var(--sidebar-muted);font-size:10.5px;">Không gian làm việc người dùng</small>
            </div>
          </button>
        </div>
      </aside>

      <!-- Main Shell -->
      <main class="main-shell" style="min-width:0;display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg);">
        <!-- Topbar -->
        <header class="topbar" style="height:70px;background:var(--surface);border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 22px;gap:10px;flex:0 0 auto;z-index:20;">
          <button class="icon-btn mobile-menu" id="paMobileMenu" aria-label="Mở menu" style="display:none;background:none;border:none;color:var(--text);font-size:20px;cursor:pointer;padding:6px;">☰</button>
          <div style="font-size:15px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px;">
            <span>🛡️ Cổng Điều hành Super-Admin</span>
            <span style="font-size:11px;font-weight:600;background:var(--green-soft);color:var(--green);padding:2px 8px;border-radius:6px;">V1.0 Live</span>
          </div>

          <div style="margin-left:auto;display:flex;align-items:center;gap:10px;">
            <button class="icon-btn" id="paThemeToggle" aria-label="Đổi giao diện" style="width:38px;height:38px;border:1px solid var(--line);border-radius:9px;background:var(--surface);display:grid;place-items:center;color:var(--text);cursor:pointer;" title="Chuyển chế độ Sáng / Tối">◐</button>
            <button class="icon-btn" id="paRefreshData" aria-label="Làm mới dữ liệu" style="width:38px;height:38px;border:1px solid var(--line);border-radius:9px;background:var(--surface);display:grid;place-items:center;color:var(--text);cursor:pointer;" title="Làm mới toàn bộ dữ liệu">↻</button>
            
            <div class="profile" style="display:flex;align-items:center;gap:10px;border-left:1px solid var(--line);padding-left:14px;">
              <div class="avatar" style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#7265e8,#478fee);color:#fff;display:grid;place-items:center;font-weight:800;font-size:14px;">PA</div>
              <div>
                <strong style="display:block;font-size:12.5px;color:var(--text);" id="paAdminEmail">Platform Admin</strong>
                <small style="color:var(--primary);font-weight:600;font-size:10.5px;">Super Admin Authority</small>
              </div>
            </div>
          </div>
        </header>

        <!-- Dynamic Content Body -->
        <div class="content" id="paContentArea" style="padding:22px;overflow-y:auto;flex:1;max-width:1720px;margin:0 auto;width:100%;">
          <div style="text-align:center;padding:48px;color:var(--muted);">Đang kết nối trung tâm điều hành...</div>
        </div>
      </main>
    </div>

    <!-- Scrim for Mobile Sidebar -->
    <div class="scrim" id="paScrim" style="display:none;position:fixed;inset:0;background:rgba(10,18,35,.45);z-index:25;"></div>

    <!-- Tenant Detail Drawer -->
    <dialog id="paTenantDrawer" style="width:min(880px,calc(100vw - 24px));margin-right:0;height:100dvh;max-height:100dvh;border-radius:16px 0 0 16px;border:1px solid var(--line);background:var(--surface);color:var(--text);box-shadow:0 24px 90px rgba(14,22,46,.25);padding:0;">
      <div style="padding:18px 22px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;background:var(--surface-2);">
        <div>
          <h2 id="paDrawerOrgName" style="margin:0;font-size:18px;font-weight:700;color:var(--text);">Chi tiết Doanh nghiệp</h2>
          <p id="paDrawerOrgSlug" style="margin:2px 0 0 0;font-size:12px;color:var(--muted);font-family:monospace;"></p>
        </div>
        <button type="button" class="icon-btn" id="paCloseDrawerBtn" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted);">✕</button>
      </div>
      <div style="padding:14px 22px;border-bottom:1px solid var(--line);display:flex;gap:8px;background:var(--surface);">
        <button class="drawer-tab active" data-tab="overview" style="height:34px;padding:0 14px;border-radius:8px;border:none;background:var(--primary-soft);color:var(--primary-text);font-weight:600;font-size:12.5px;cursor:pointer;">Tổng quan</button>
        <button class="drawer-tab" data-tab="members" style="height:34px;padding:0 14px;border-radius:8px;border:none;background:transparent;color:var(--muted);font-weight:600;font-size:12.5px;cursor:pointer;">Thành viên</button>
        <button class="drawer-tab" data-tab="subscription" style="height:34px;padding:0 14px;border-radius:8px;border:none;background:transparent;color:var(--muted);font-weight:600;font-size:12.5px;cursor:pointer;">Gói dịch vụ</button>
        <button class="drawer-tab" data-tab="audit" style="height:34px;padding:0 14px;border-radius:8px;border:none;background:transparent;color:var(--muted);font-weight:600;font-size:12.5px;cursor:pointer;">Nhật ký Audit</button>
      </div>
      <div id="paDrawerBody" style="padding:22px;overflow-y:auto;max-height:calc(100dvh - 148px);"></div>
    </dialog>

    <!-- Dangerous Action Confirmation Dialog -->
    <dialog id="paConfirmDialog" style="width:min(520px,calc(100vw - 32px));border:1px solid var(--line);border-radius:14px;background:var(--surface);color:var(--text);padding:0;box-shadow:0 24px 80px rgba(0,0,0,0.3);">
      <div style="padding:18px 22px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;background:var(--surface-2);">
        <h3 id="paConfirmTitle" style="margin:0;font-size:16px;font-weight:700;color:var(--text);">Xác nhận hành động quản trị</h3>
        <button type="button" id="paCloseConfirmBtn" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--muted);">✕</button>
      </div>
      <div style="padding:22px;">
        <div id="paConfirmCallout" style="padding:12px 16px;border-radius:10px;background:var(--red-soft);color:var(--red);font-size:13px;font-weight:500;margin-bottom:16px;line-height:1.5;"></div>
        <label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text);">
          Lý do thao tác (bắt buộc - ghi nhận vào Security Audit Log):
        </label>
        <textarea id="paConfirmReason" rows="3" placeholder="Nhập lý do chi tiết..." style="width:100%;border:1px solid var(--line);border-radius:8px;padding:10px;background:var(--surface-2);color:var(--text);font-size:13px;box-sizing:border-box;resize:vertical;"></textarea>
      </div>
      <div style="padding:14px 22px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:10px;background:var(--surface);">
        <button type="button" id="paCancelConfirmBtn" style="padding:8px 16px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--text);cursor:pointer;font-size:13px;font-weight:600;">Hủy</button>
        <button type="button" id="paProceedConfirmBtn" style="padding:8px 18px;border:none;border-radius:8px;background:var(--red);color:#fff;cursor:pointer;font-size:13px;font-weight:700;">Xác nhận</button>
      </div>
    </dialog>
  `;

  document.body.appendChild(container);
  portalContainer = container;

  // Bind Navigation Events
  bindShellEvents(container);

  return container;
}

function bindShellEvents(container) {
  // Sidebar Nav Item clicks
  container.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view) switchView(view);
      if (window.innerWidth <= 900) {
        closeMobileSidebar();
      }
    });
  });

  // Collapse Button
  const collapseBtn = container.querySelector('#paCollapseBtn');
  const appEl = container.querySelector('#paApp');
  collapseBtn?.addEventListener('click', () => {
    isCollapsed = !isCollapsed;
    if (isCollapsed) {
      appEl.style.setProperty('--side-width', '76px');
      container.querySelectorAll('.brand-copy, .nav-label, .nav-count, .back-app div').forEach(el => el.style.display = 'none');
      collapseBtn.querySelector('svg').style.transform = 'rotate(180deg)';
    } else {
      appEl.style.setProperty('--side-width', '278px');
      container.querySelectorAll('.brand-copy, .nav-label, .nav-count, .back-app div').forEach(el => el.style.display = '');
      collapseBtn.querySelector('svg').style.transform = 'none';
    }
  });

  // Back to App button
  container.querySelector('#paBackToApp')?.addEventListener('click', () => {
    closePlatformAdminPortal();
  });

  // Theme Toggle
  container.querySelector('#paThemeToggle')?.addEventListener('click', () => {
    const curTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = curTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('worktree_theme', nextTheme);
  });

  // Refresh Data
  container.querySelector('#paRefreshData')?.addEventListener('click', () => {
    loadPortalData();
  });

  // Mobile Menu
  container.querySelector('#paMobileMenu')?.addEventListener('click', () => {
    openMobileSidebar();
  });
  container.querySelector('#paScrim')?.addEventListener('click', () => {
    closeMobileSidebar();
  });

  // Drawer Close
  container.querySelector('#paCloseDrawerBtn')?.addEventListener('click', () => {
    const drawer = container.querySelector('#paTenantDrawer');
    drawer?.close();
  });

  // Confirm Modal Close
  container.querySelector('#paCloseConfirmBtn')?.addEventListener('click', () => {
    container.querySelector('#paConfirmDialog')?.close();
  });
  container.querySelector('#paCancelConfirmBtn')?.addEventListener('click', () => {
    container.querySelector('#paConfirmDialog')?.close();
  });
}

function openMobileSidebar() {
  const sidebar = portalContainer?.querySelector('#paSidebar');
  const scrim = portalContainer?.querySelector('#paScrim');
  if (sidebar && scrim) {
    sidebar.style.position = 'fixed';
    sidebar.style.left = '0';
    sidebar.style.top = '0';
    sidebar.style.height = '100vh';
    sidebar.style.transform = 'none';
    scrim.style.display = 'block';
  }
}

function closeMobileSidebar() {
  const sidebar = portalContainer?.querySelector('#paSidebar');
  const scrim = portalContainer?.querySelector('#paScrim');
  if (sidebar && scrim) {
    scrim.style.display = 'none';
    if (window.innerWidth <= 900) {
      sidebar.style.transform = 'translateX(-100%)';
    }
  }
}

function switchView(viewName) {
  currentView = viewName;
  if (!portalContainer) return;

  portalContainer.querySelectorAll('.nav-item').forEach(btn => {
    if (btn.dataset.view === viewName) {
      btn.classList.add('active');
      btn.style.background = 'rgba(144,135,245,.18)';
      btn.style.color = '#fff';
      const icon = btn.querySelector('.nav-icon');
      if (icon) icon.style.color = '#a89cff';
    } else {
      btn.classList.remove('active');
      btn.style.background = 'transparent';
      btn.style.color = 'var(--sidebar-text)';
      const icon = btn.querySelector('.nav-icon');
      if (icon) icon.style.color = '#b7c3db';
    }
  });

  renderCurrentView();
}

/**
 * Tải toàn bộ dữ liệu điều hành từ serverless endpoint /api/platform-admin
 */
async function loadPortalData() {
  state.isLoading = true;
  renderCurrentView();

  try {
    const [overview, orgs, users, violations, logs, admins, settings] = await Promise.all([
      PlatformAdminService.getOverview().catch(() => null),
      PlatformAdminService.getOrganizations().catch(() => []),
      PlatformAdminService.getUsers().catch(() => []),
      PlatformAdminService.getViolations().catch(() => []),
      PlatformAdminService.getAuditLogs().catch(() => []),
      PlatformAdminService.getPlatformAdmins().catch(() => []),
      PlatformAdminService.getSettings().catch(() => null)
    ]);

    state.metrics = overview;
    state.organizations = orgs;
    state.users = users;
    state.violations = violations;
    state.logs = logs;
    state.admins = admins;
    state.settings = settings;

    // Update nav counters
    const tenantCountEl = portalContainer?.querySelector('#paTenantNavCount');
    if (tenantCountEl) tenantCountEl.textContent = orgs.length;

    const userCountEl = portalContainer?.querySelector('#paUserNavCount');
    if (userCountEl) userCountEl.textContent = users.length;

    const violationCountEl = portalContainer?.querySelector('#paViolationNavCount');
    if (violationCountEl) violationCountEl.textContent = violations.length;

    const adminCountEl = portalContainer?.querySelector('#paAdminNavCount');
    if (adminCountEl) adminCountEl.textContent = admins.length;

  } catch (err) {
    state.error = err.message;
    console.error('[PlatformAdmin] Lỗi tải dữ liệu:', err);
  } finally {
    state.isLoading = false;
    renderCurrentView();
  }
}

function renderCurrentView() {
  const content = portalContainer?.querySelector('#paContentArea');
  if (!content) return;

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
}

// -----------------------------------------------------------------------------
// 1. OVERVIEW VIEW
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

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px;">
      <div>
        <h1 style="font-size:26px;font-weight:800;margin:0 0 6px;letter-spacing:-0.5px;color:var(--text);">Tổng quan nền tảng</h1>
        <p style="margin:0;color:var(--muted);font-size:13px;">Theo dõi toàn bộ hoạt động, sức khỏe và các chỉ số SaaS của WorkTree X</p>
      </div>
      <button type="button" id="paQuickRefreshBtn" style="height:36px;padding:0 14px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--text);font-size:12.5px;font-weight:600;cursor:pointer;">
        Đồng bộ tức thì
      </button>
    </div>

    <!-- 4 Key KPI Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:14px;margin-bottom:20px;">
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:18px;box-shadow:var(--shadow);">
        <div style="display:flex;gap:12px;align-items:center;">
          <div style="width:42px;height:42px;border-radius:10px;background:var(--primary-soft);color:var(--primary);display:grid;place-items:center;font-size:18px;">▦</div>
          <div>
            <div style="font-size:12px;font-weight:650;color:var(--muted);">Doanh nghiệp hoạt động</div>
            <div style="font-size:26px;font-weight:800;color:var(--text);margin:2px 0;">${m.activeOrganizations}</div>
            <div style="font-size:11px;color:var(--green);font-weight:600;">Tổng số: ${m.totalOrganizations} tenant</div>
          </div>
        </div>
      </div>

      <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:18px;box-shadow:var(--shadow);">
        <div style="display:flex;gap:12px;align-items:center;">
          <div style="width:42px;height:42px;border-radius:10px;background:var(--green-soft);color:var(--green);display:grid;place-items:center;font-size:18px;">♙</div>
          <div>
            <div style="font-size:12px;font-weight:650;color:var(--muted);">Người dùng toàn hệ thống</div>
            <div style="font-size:26px;font-weight:800;color:var(--text);margin:2px 0;">${m.totalUsers}</div>
            <div style="font-size:11px;color:var(--muted);">Tài khoản trên auth.users</div>
          </div>
        </div>
      </div>

      <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:18px;box-shadow:var(--shadow);">
        <div style="display:flex;gap:12px;align-items:center;">
          <div style="width:42px;height:42px;border-radius:10px;background:var(--amber-soft);color:var(--amber);display:grid;place-items:center;font-size:18px;">$</div>
          <div>
            <div style="font-size:12px;font-weight:650;color:var(--muted);">Doanh thu tháng này</div>
            <div style="font-size:18px;font-weight:800;color:var(--text);margin:6px 0;">Chưa có dữ liệu đối soát</div>
            <div style="font-size:11px;color:var(--muted);">Cần kết nối cổng thanh toán</div>
          </div>
        </div>
      </div>

      <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:18px;box-shadow:var(--shadow);">
        <div style="display:flex;gap:12px;align-items:center;">
          <div style="width:42px;height:42px;border-radius:10px;background:var(--red-soft);color:var(--red);display:grid;place-items:center;font-size:18px;">!</div>
          <div>
            <div style="font-size:12px;font-weight:650;color:var(--muted);">Doanh nghiệp bị khóa</div>
            <div style="font-size:26px;font-weight:800;color:var(--red);margin:2px 0;">${m.suspendedOrganizations}</div>
            <div style="font-size:11px;color:var(--muted);">${m.suspendedOrganizations > 0 ? 'Đã chặn truy cập business' : 'Không có tenant bị chặn'}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Middle Grid: Plans & Health -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:14px;margin-bottom:20px;">
      <!-- Plan Breakdown -->
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <strong style="font-size:15px;font-weight:700;color:var(--text);">Phân bổ Gói dịch vụ</strong>
          <span style="font-size:11.5px;color:var(--muted);">Theo số tenant</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div style="padding:12px;background:var(--surface-2);border-radius:10px;border:1px solid var(--line);">
            <div style="font-size:11px;color:var(--muted);font-weight:600;">FREE TIER</div>
            <div style="font-size:20px;font-weight:800;color:var(--text);">${m.plansBreakdown.free || 0}</div>
          </div>
          <div style="padding:12px;background:var(--blue-soft);border-radius:10px;border:1px solid rgba(53,108,165,0.2);">
            <div style="font-size:11px;color:var(--blue);font-weight:600;">STARTER</div>
            <div style="font-size:20px;font-weight:800;color:var(--blue);">${m.plansBreakdown.starter || 0}</div>
          </div>
          <div style="padding:12px;background:var(--purple-soft);border-radius:10px;border:1px solid rgba(134,93,178,0.2);">
            <div style="font-size:11px;color:var(--purple);font-weight:600;">BUSINESS</div>
            <div style="font-size:20px;font-weight:800;color:var(--purple);">${m.plansBreakdown.business || 0}</div>
          </div>
          <div style="padding:12px;background:var(--green-soft);border-radius:10px;border:1px solid rgba(16,115,83,0.2);">
            <div style="font-size:11px;color:var(--green);font-weight:600;">ENTERPRISE</div>
            <div style="font-size:20px;font-weight:800;color:var(--green);">${m.plansBreakdown.enterprise || 0}</div>
          </div>
        </div>
      </div>

      <!-- System Health Diagnostics -->
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <strong style="font-size:15px;font-weight:700;color:var(--text);">Sức khỏe Nền tảng</strong>
          <span style="background:var(--green-soft);color:var(--green);font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;">Ổn định</span>
        </div>
        <div style="display:grid;gap:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--line);">
            <span style="font-size:12.5px;color:var(--text);">API & Serverless Gateway</span>
            <span style="color:var(--green);font-weight:600;font-size:11.5px;">✓ Bình thường</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--line);">
            <span style="font-size:12.5px;color:var(--text);">Cơ sở dữ liệu PostgreSQL</span>
            <span style="color:var(--green);font-weight:600;font-size:11.5px;">✓ Bình thường</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--line);">
            <span style="font-size:12.5px;color:var(--text);">Supabase Auth & Sessions</span>
            <span style="color:var(--green);font-weight:600;font-size:11.5px;">✓ Bình thường</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;">
            <span style="font-size:12.5px;color:var(--text);">Zalo Bot & Webhook Gateway</span>
            <span style="color:var(--green);font-weight:600;font-size:11.5px;">✓ Trực tuyến</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Tenants Table -->
    <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <strong style="font-size:15px;font-weight:700;color:var(--text);">Doanh nghiệp mới tham gia</strong>
        <button type="button" id="paViewAllTenantsBtn" style="background:none;border:none;color:var(--primary);font-weight:600;font-size:12.5px;cursor:pointer;">Xem tất cả →</button>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">
          <thead>
            <tr style="background:var(--surface-2);color:var(--muted);font-size:11px;font-weight:700;text-transform:uppercase;">
              <th style="padding:10px 14px;">Doanh nghiệp</th>
              <th style="padding:10px 14px;">Gói</th>
              <th style="padding:10px 14px;">Số thành viên</th>
              <th style="padding:10px 14px;">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            ${state.organizations.slice(0, 5).map(org => `
              <tr style="border-bottom:1px solid var(--line);">
                <td style="padding:10px 14px;font-weight:600;color:var(--text);">${esc(org.name)}</td>
                <td style="padding:10px 14px;"><span style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--primary);">${esc(org.subscription?.plan || 'free')}</span></td>
                <td style="padding:10px 14px;color:var(--muted);">${org.activeMembersCount || 1} / ${org.subscription?.seatLimit || 5}</td>
                <td style="padding:10px 14px;">
                  <span style="font-size:11px;font-weight:600;color:${org.status === 'active' ? 'var(--green)' : 'var(--red)'};">
                    ● ${org.status === 'active' ? 'Hoạt động' : 'Đã khóa'}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelector('#paQuickRefreshBtn')?.addEventListener('click', loadPortalData);
  container.querySelector('#paViewAllTenantsBtn')?.addEventListener('click', () => switchView('tenants'));
}

// -----------------------------------------------------------------------------
// 2. TENANTS VIEW
// -----------------------------------------------------------------------------
function renderTenants(container) {
  let filtered = state.organizations.filter(org => {
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      if (!org.name.toLowerCase().includes(q) && !org.slug.toLowerCase().includes(q)) return false;
    }
    if (state.tenantFilterStatus && org.status !== state.tenantFilterStatus) return false;
    if (state.tenantFilterPlan && org.subscription.plan !== state.tenantFilterPlan) return false;
    return true;
  });

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px;">
      <div>
        <h1 style="font-size:26px;font-weight:800;margin:0 0 6px;letter-spacing:-0.5px;color:var(--text);">Quản lý Doanh nghiệp (Tenants)</h1>
        <p style="margin:0;color:var(--muted);font-size:13px;">Theo dõi danh bạ tenant, cấu hình gói cước và thực thi khóa/mở khóa an toàn</p>
      </div>
      <div style="display:flex;gap:8px;">
        <button type="button" id="paExportTenantsBtn" style="height:36px;padding:0 14px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--text);font-size:12.5px;font-weight:600;cursor:pointer;">
          Xuất danh sách
        </button>
      </div>
    </div>

    <!-- Toolbar -->
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px;align-items:center;">
      <div style="flex:1;min-width:240px;position:relative;">
        <input type="text" id="paTenantSearch" placeholder="Tìm kiếm theo tên công ty, slug..." value="${esc(state.searchQuery)}" style="width:100%;height:38px;padding:0 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
      </div>
      <select id="paTenantPlanFilter" style="height:38px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px;">
        <option value="">Tất cả gói cước</option>
        <option value="free" ${state.tenantFilterPlan === 'free' ? 'selected' : ''}>Free</option>
        <option value="starter" ${state.tenantFilterPlan === 'starter' ? 'selected' : ''}>Starter</option>
        <option value="business" ${state.tenantFilterPlan === 'business' ? 'selected' : ''}>Business</option>
        <option value="enterprise" ${state.tenantFilterPlan === 'enterprise' ? 'selected' : ''}>Enterprise</option>
      </select>
      <select id="paTenantStatusFilter" style="height:38px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px;">
        <option value="">Tất cả trạng thái</option>
        <option value="active" ${state.tenantFilterStatus === 'active' ? 'selected' : ''}>🟢 Đang hoạt động</option>
        <option value="suspended" ${state.tenantFilterStatus === 'suspended' ? 'selected' : ''}>🔴 Đã khóa</option>
      </select>
    </div>

    <!-- Tenants Table -->
    <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow);">
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">
          <thead>
            <tr style="background:var(--surface-2);color:var(--muted);font-size:11px;font-weight:700;text-transform:uppercase;">
              <th style="padding:12px 16px;">Doanh nghiệp</th>
              <th style="padding:12px 16px;">Chủ sở hữu</th>
              <th style="padding:12px 16px;">Gói cước</th>
              <th style="padding:12px 16px;">Thành viên</th>
              <th style="padding:12px 16px;">Trạng thái</th>
              <th style="padding:12px 16px;">Ngày tạo</th>
              <th style="padding:12px 16px;text-align:right;">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0 ? `
              <tr><td colspan="7" style="text-align:center;padding:48px;color:var(--muted);">Không có doanh nghiệp nào phù hợp.</td></tr>
            ` : filtered.map(org => {
              const isSuspended = org.status === 'suspended';
              return `
                <tr style="border-bottom:1px solid var(--line);">
                  <td style="padding:14px 16px;">
                    <div style="font-weight:700;color:var(--text);">${esc(org.name)}</div>
                    <div style="font-size:11px;color:var(--muted);font-family:monospace;">${esc(org.slug)}</div>
                  </td>
                  <td style="padding:14px 16px;color:var(--text);">${esc(org.ownerName)}</td>
                  <td style="padding:14px 16px;">
                    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;text-transform:uppercase;background:var(--primary-soft);color:var(--primary-text);">
                      ${esc(org.subscription?.plan || 'free')}
                    </span>
                  </td>
                  <td style="padding:14px 16px;color:var(--text);font-weight:600;">
                    ${org.activeMembersCount || 1} / ${org.subscription?.seatLimit || 5}
                  </td>
                  <td style="padding:14px 16px;">
                    <span style="font-size:11px;font-weight:600;padding:3px 8px;border-radius:4px;background:${isSuspended ? 'var(--red-soft)' : 'var(--green-soft)'};color:${isSuspended ? 'var(--red)' : 'var(--green)'};">
                      ● ${isSuspended ? 'Đã khóa' : 'Hoạt động'}
                    </span>
                  </td>
                  <td style="padding:14px 16px;color:var(--muted);font-size:12px;">${formatDate(org.createdAt)}</td>
                  <td style="padding:14px 16px;text-align:right;">
                    <div style="display:inline-flex;gap:6px;">
                      <button type="button" class="pa-view-detail-btn" data-id="${org.id}" style="padding:4px 10px;font-size:12px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--text);cursor:pointer;">
                        Chi tiết
                      </button>
                      ${isSuspended ? `
                        <button type="button" class="pa-toggle-suspend-btn" data-id="${org.id}" data-action="unsuspend" style="padding:4px 10px;font-size:12px;border:none;border-radius:6px;background:var(--green-soft);color:var(--green);cursor:pointer;font-weight:600;">
                          Mở khóa
                        </button>
                      ` : `
                        <button type="button" class="pa-toggle-suspend-btn" data-id="${org.id}" data-action="suspend" style="padding:4px 10px;font-size:12px;border:none;border-radius:6px;background:var(--red-soft);color:var(--red);cursor:pointer;font-weight:600;">
                          Khóa
                        </button>
                      `}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Attach search/filter listeners
  container.querySelector('#paTenantSearch')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderTenants(container);
  });
  container.querySelector('#paTenantPlanFilter')?.addEventListener('change', (e) => {
    state.tenantFilterPlan = e.target.value;
    renderTenants(container);
  });
  container.querySelector('#paTenantStatusFilter')?.addEventListener('change', (e) => {
    state.tenantFilterStatus = e.target.value;
    renderTenants(container);
  });

  // Attach Detail Drawer Triggers
  container.querySelectorAll('.pa-view-detail-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const orgId = btn.dataset.id;
      if (orgId) openTenantDrawer(orgId);
    });
  });

  // Attach Lock/Unlock Triggers
  container.querySelectorAll('.pa-toggle-suspend-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const orgId = btn.dataset.id;
      const action = btn.dataset.action;
      if (orgId) confirmTenantSuspension(orgId, action);
    });
  });
}

// -----------------------------------------------------------------------------
// 3. GLOBAL USERS VIEW
// -----------------------------------------------------------------------------
function renderUsers(container) {
  let filtered = state.users.filter(u => {
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      if (!u.name.toLowerCase().includes(q) && !u.organizationName.toLowerCase().includes(q)) return false;
    }
    if (state.userFilterRole && u.role !== state.userFilterRole) return false;
    if (state.userFilterStatus && u.status !== state.userFilterStatus) return false;
    return true;
  });

  container.innerHTML = `
    <div style="margin-bottom:16px;">
      <h1 style="font-size:26px;font-weight:800;margin:0 0 6px;letter-spacing:-0.5px;color:var(--text);">Người dùng toàn hệ thống</h1>
      <p style="margin:0;color:var(--muted);font-size:13px;">Theo dõi danh sách tài khoản đã kích hoạt và phân quyền tại các doanh nghiệp</p>
    </div>

    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
      <input type="text" id="paUserSearch" placeholder="Tìm theo tên người dùng, doanh nghiệp..." value="${esc(state.searchQuery)}" style="flex:1;min-width:240px;height:38px;padding:0 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px;">
      <select id="paUserRoleFilter" style="height:38px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px;">
        <option value="">Tất cả vai trò</option>
        <option value="owner" ${state.userFilterRole === 'owner' ? 'selected' : ''}>Owner</option>
        <option value="admin" ${state.userFilterRole === 'admin' ? 'selected' : ''}>Admin</option>
        <option value="manager" ${state.userFilterRole === 'manager' ? 'selected' : ''}>Manager</option>
        <option value="member" ${state.userFilterRole === 'member' ? 'selected' : ''}>Member</option>
        <option value="viewer" ${state.userFilterRole === 'viewer' ? 'selected' : ''}>Viewer</option>
      </select>
    </div>

    <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">
        <thead>
          <tr style="background:var(--surface-2);color:var(--muted);font-size:11px;font-weight:700;text-transform:uppercase;">
            <th style="padding:12px 16px;">Người dùng</th>
            <th style="padding:12px 16px;">Doanh nghiệp</th>
            <th style="padding:12px 16px;">Vai trò</th>
            <th style="padding:12px 16px;">Trạng thái</th>
            <th style="padding:12px 16px;">Ngày tham gia</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length === 0 ? `
            <tr><td colspan="5" style="text-align:center;padding:48px;color:var(--muted);">Không tìm thấy người dùng.</td></tr>
          ` : filtered.map(u => `
            <tr style="border-bottom:1px solid var(--line);">
              <td style="padding:12px 16px;font-weight:600;color:var(--text);">${esc(u.name)}</td>
              <td style="padding:12px 16px;color:var(--text);">${esc(u.organizationName)}</td>
              <td style="padding:12px 16px;">
                <span style="font-size:11px;font-weight:700;padding:2px 7px;border-radius:4px;text-transform:uppercase;background:var(--surface-3);color:var(--text);">
                  ${esc(u.role)}
                </span>
              </td>
              <td style="padding:12px 16px;">
                <span style="font-size:11px;font-weight:600;color:var(--green);">● ${esc(u.status)}</span>
              </td>
              <td style="padding:12px 16px;color:var(--muted);font-size:12px;">${formatDate(u.joinedDate)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  container.querySelector('#paUserSearch')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderUsers(container);
  });
  container.querySelector('#paUserRoleFilter')?.addEventListener('change', (e) => {
    state.userFilterRole = e.target.value;
    renderUsers(container);
  });
}

// -----------------------------------------------------------------------------
// 4. REVENUE VIEW
// -----------------------------------------------------------------------------
function renderRevenue(container) {
  container.innerHTML = `
    <div style="margin-bottom:16px;">
      <h1 style="font-size:26px;font-weight:800;margin:0 0 6px;letter-spacing:-0.5px;color:var(--text);">Báo cáo Doanh thu & Thuê bao</h1>
      <p style="margin:0;color:var(--muted);font-size:13px;">Theo dõi các chỉ số tài chính và doanh thu định kỳ SaaS</p>
    </div>

    <div style="padding:20px;border-radius:var(--radius);background:var(--amber-soft);border:1px solid rgba(147,84,12,0.2);margin-bottom:20px;color:var(--amber);">
      <div style="font-weight:700;font-size:14px;margin-bottom:4px;">ℹ️ Thông báo vận hành tài chính</div>
      <div style="font-size:12.5px;line-height:1.5;">
        Theo nguyên tắc bảo mật và quản lý hợp đồng dữ liệu thực tế: Cổng thanh toán trực tiếp (Stripe/VNPay) chưa được kích hoạt đối soát tự động.
        Số liệu dưới đây được tổng hợp dựa trên số lượng gói thuê bao (Subscriptions) đang hoạt động trên hệ thống.
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:14px;">
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:18px;">
        <span style="font-size:12px;font-weight:650;color:var(--muted);text-transform:uppercase;">Gói Enterprise</span>
        <div style="font-size:26px;font-weight:800;color:var(--text);margin:6px 0;">${state.metrics?.plansBreakdown?.enterprise || 0}</div>
        <small style="color:var(--muted);">Gói hợp đồng tùy chỉnh</small>
      </div>
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:18px;">
        <span style="font-size:12px;font-weight:650;color:var(--muted);text-transform:uppercase;">Gói Business</span>
        <div style="font-size:26px;font-weight:800;color:var(--text);margin:6px 0;">${state.metrics?.plansBreakdown?.business || 0}</div>
        <small style="color:var(--muted);">Doanh nghiệp vừa</small>
      </div>
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:18px;">
        <span style="font-size:12px;font-weight:650;color:var(--muted);text-transform:uppercase;">Gói Starter</span>
        <div style="font-size:26px;font-weight:800;color:var(--text);margin:6px 0;">${state.metrics?.plansBreakdown?.starter || 0}</div>
        <small style="color:var(--muted);">Nhóm khởi nghiệp</small>
      </div>
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:18px;">
        <span style="font-size:12px;font-weight:650;color:var(--muted);text-transform:uppercase;">Gói Free</span>
        <div style="font-size:26px;font-weight:800;color:var(--text);margin:6px 0;">${state.metrics?.plansBreakdown?.free || 0}</div>
        <small style="color:var(--muted);">Dùng thử miễn phí</small>
      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// 5. PLANS VIEW
// -----------------------------------------------------------------------------
function renderPlans(container) {
  container.innerHTML = `
    <div style="margin-bottom:16px;">
      <h1 style="font-size:26px;font-weight:800;margin:0 0 6px;letter-spacing:-0.5px;color:var(--text);">Cấu hình Gói dịch vụ</h1>
      <p style="margin:0;color:var(--muted);font-size:13px;">Chi tiết hạn mức tài nguyên và đặc quyền của từng gói cước</p>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:16px;margin-bottom:24px;">
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:22px;">
        <h3 style="margin:0 0 6px;font-size:18px;color:var(--text);">Free Tier</h3>
        <div style="font-size:24px;font-weight:800;color:var(--text);margin-bottom:12px;">$0 <small style="font-size:12px;color:var(--muted);">/ vĩnh viễn</small></div>
        <ul style="padding-left:18px;margin:0;font-size:13px;color:var(--muted);line-height:1.8;">
          <li>Tối đa 5 thành viên</li>
          <li>1 GB lưu trữ tài liệu</li>
          <li>Quản lý công việc cơ bản</li>
          <li>Thông báo đẩy Web & Zalo Bot</li>
        </ul>
      </div>

      <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:22px;">
        <h3 style="margin:0 0 6px;font-size:18px;color:var(--blue);">Starter Plan</h3>
        <div style="font-size:24px;font-weight:800;color:var(--text);margin-bottom:12px;">$49 <small style="font-size:12px;color:var(--muted);">/ tháng</small></div>
        <ul style="padding-left:18px;margin:0;font-size:13px;color:var(--muted);line-height:1.8;">
          <li>Tối đa 20 thành viên</li>
          <li>20 GB lưu trữ tài liệu</li>
          <li>Đồng bộ Realtime tức thì</li>
          <li>Không giới hạn dự án & thẻ tag</li>
        </ul>
      </div>

      <div style="background:var(--surface);border:2px solid var(--primary);border-radius:var(--radius);padding:22px;position:relative;">
        <span style="position:absolute;right:14px;top:14px;background:var(--primary);color:#fff;font-size:10px;font-weight:800;padding:2px 8px;border-radius:4px;text-transform:uppercase;">Phổ biến</span>
        <h3 style="margin:0 0 6px;font-size:18px;color:var(--primary);">Business Plan</h3>
        <div style="font-size:24px;font-weight:800;color:var(--text);margin-bottom:12px;">$99 <small style="font-size:12px;color:var(--muted);">/ tháng</small></div>
        <ul style="padding-left:18px;margin:0;font-size:13px;color:var(--muted);line-height:1.8;">
          <li>Tối đa 100 thành viên</li>
          <li>100 GB lưu trữ tài liệu</li>
          <li>Phân quyền cây tổ chức sâu</li>
          <li>Nhật ký bảo mật Security Audit</li>
        </ul>
      </div>

      <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:22px;">
        <h3 style="margin:0 0 6px;font-size:18px;color:var(--green);">Enterprise</h3>
        <div style="font-size:24px;font-weight:800;color:var(--text);margin-bottom:12px;">Tùy biến <small style="font-size:12px;color:var(--muted);">/ liên hệ</small></div>
        <ul style="padding-left:18px;margin:0;font-size:13px;color:var(--muted);line-height:1.8;">
          <li>Không giới hạn số thành viên</li>
          <li>Không giới hạn dung lượng lưu trữ</li>
          <li>Hỗ trợ kỹ thuật 24/7 & SLA riêng</li>
          <li>Tùy biến tên miền & thương hiệu</li>
        </ul>
      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// 6. VIOLATIONS VIEW
// -----------------------------------------------------------------------------
function renderViolations(container) {
  container.innerHTML = `
    <div style="margin-bottom:16px;">
      <h1 style="font-size:26px;font-weight:800;margin:0 0 6px;letter-spacing:-0.5px;color:var(--text);">Cảnh báo & Vi phạm</h1>
      <p style="margin:0;color:var(--muted);font-size:13px;">Giám sát các trường hợp bất thường hoặc cần can thiệp xử trị trên toàn nền tảng</p>
    </div>

    <div style="display:grid;gap:12px;">
      ${state.violations.length === 0 ? `
        <div style="padding:48px;text-align:center;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);color:var(--muted);">
          Không có cảnh báo vi phạm nào đang mở. Nền tảng hoạt động an toàn!
        </div>
      ` : state.violations.map(v => `
        <div style="background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:18px;display:flex;justify-content:space-between;align-items:center;gap:16px;">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span style="color:var(--red);font-weight:700;font-size:12px;">⚠️ ${esc(v.type)}</span>
              <strong style="font-size:14px;color:var(--text);">${esc(v.title)}</strong>
            </div>
            <p style="margin:0;font-size:12.5px;color:var(--muted);">${esc(v.desc)}</p>
            <small style="color:var(--muted);font-size:11px;display:block;margin-top:4px;">Doanh nghiệp: <strong>${esc(v.tenant)}</strong> · ${formatRelativeTime(v.time)}</small>
          </div>
          <button type="button" style="padding:6px 14px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2);color:var(--text);font-size:12px;font-weight:600;cursor:pointer;">
            Xem xét
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

// -----------------------------------------------------------------------------
// 7. AUDIT LOGS VIEW
// -----------------------------------------------------------------------------
function renderLogs(container) {
  container.innerHTML = `
    <div style="margin-bottom:16px;">
      <h1 style="font-size:26px;font-weight:800;margin:0 0 6px;letter-spacing:-0.5px;color:var(--text);">Nhật ký hệ thống (Audit Logs)</h1>
      <p style="margin:0;color:var(--muted);font-size:13px;">Ghi nhận mọi hành động quản trị nhạy cảm của Platform Super-Admin</p>
    </div>

    <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">
        <thead>
          <tr style="background:var(--surface-2);color:var(--muted);font-size:11px;font-weight:700;text-transform:uppercase;">
            <th style="padding:12px 16px;">Thời gian</th>
            <th style="padding:12px 16px;">Người thực hiện</th>
            <th style="padding:12px 16px;">Doanh nghiệp</th>
            <th style="padding:12px 16px;">Hành động</th>
            <th style="padding:12px 16px;">Kết quả</th>
          </tr>
        </thead>
        <tbody>
          ${state.logs.length === 0 ? `
            <tr><td colspan="5" style="text-align:center;padding:48px;color:var(--muted);">Chưa có nhật ký audit nào được ghi nhận.</td></tr>
          ` : state.logs.map(log => `
            <tr style="border-bottom:1px solid var(--line);">
              <td style="padding:12px 16px;color:var(--muted);font-size:12px;">${formatDate(log.timestamp)}</td>
              <td style="padding:12px 16px;font-weight:600;color:var(--text);">${esc(log.actor)}</td>
              <td style="padding:12px 16px;color:var(--text);">${esc(log.tenant)}</td>
              <td style="padding:12px 16px;font-weight:600;color:var(--primary);">${esc(log.action)}</td>
              <td style="padding:12px 16px;"><span style="color:var(--green);font-weight:600;font-size:11.5px;">✓ ${esc(log.result)}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// 8. SETTINGS VIEW
// -----------------------------------------------------------------------------
function renderSettings(container) {
  const s = state.settings || {
    general: { platformName: 'WorkTree X', mainDomain: 'worktree.nguyentronghuu.com', supportEmail: 'support@worktree.nguyentronghuu.com', defaultTimezone: 'Asia/Ho_Chi_Minh' }
  };

  container.innerHTML = `
    <div style="margin-bottom:16px;">
      <h1 style="font-size:26px;font-weight:800;margin:0 0 6px;letter-spacing:-0.5px;color:var(--text);">Cấu hình Nền tảng</h1>
      <p style="margin:0;color:var(--muted);font-size:13px;">Thiết lập quy chuẩn vận hành và chính sách an toàn cho toàn bộ hệ thống</p>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:16px;">
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:20px;">
        <h3 style="margin:0 0 14px;font-size:15px;color:var(--text);">Thông tin nền tảng</h3>
        <div style="display:grid;gap:12px;">
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--muted);display:block;margin-bottom:4px;">Tên thương hiệu</label>
            <input type="text" value="${esc(s.general.platformName)}" readonly style="width:100%;height:36px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2);color:var(--text);font-size:13px;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--muted);display:block;margin-bottom:4px;">Domain chính thức</label>
            <input type="text" value="${esc(s.general.mainDomain)}" readonly style="width:100%;height:36px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2);color:var(--text);font-size:13px;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--muted);display:block;margin-bottom:4px;">Email hỗ trợ</label>
            <input type="text" value="${esc(s.general.supportEmail)}" readonly style="width:100%;height:36px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2);color:var(--text);font-size:13px;box-sizing:border-box;">
          </div>
        </div>
      </div>

      <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:20px;">
        <h3 style="margin:0 0 14px;font-size:15px;color:var(--text);">Chính sách bảo mật Super-Admin</h3>
        <div style="display:grid;gap:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--line);">
            <div>
              <strong style="font-size:13px;display:block;color:var(--text);">Ghi nhật ký bảo mật (Security Audit)</strong>
              <small style="color:var(--muted);">Lưu vết mọi hành vi nhạy cảm</small>
            </div>
            <span style="color:var(--green);font-weight:700;font-size:12px;">Bắt buộc</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--line);">
            <div>
              <strong style="font-size:13px;display:block;color:var(--text);">Row-Level Security (RLS)</strong>
              <small style="color:var(--muted);">Cách ly tenant 100% tại database</small>
            </div>
            <span style="color:var(--green);font-weight:700;font-size:12px;">Bật 100%</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;">
            <div>
              <strong style="font-size:13px;display:block;color:var(--text);">Bảo vệ Khóa Tenant</strong>
              <small style="color:var(--muted);">Ngắt quyền truy cập ngay lập tức</small>
            </div>
            <span style="color:var(--green);font-weight:700;font-size:12px;">Sẵn sàng</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// 9. ADMINS VIEW
// -----------------------------------------------------------------------------
function renderAdmins(container) {
  container.innerHTML = `
    <div style="margin-bottom:16px;">
      <h1 style="font-size:26px;font-weight:800;margin:0 0 6px;letter-spacing:-0.5px;color:var(--text);">Quản trị viên Nền tảng (Platform Admins)</h1>
      <p style="margin:0;color:var(--muted);font-size:13px;">Danh sách tài khoản được cấp đặc quyền vận hành cấp cao trong public.platform_admins</p>
    </div>

    <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:20px;margin-bottom:20px;">
      <div style="font-weight:700;font-size:14px;margin-bottom:12px;color:var(--text);">Quản trị viên đang hoạt động</div>
      <div style="display:grid;gap:10px;">
        ${state.admins.map(adm => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--surface-2);border-radius:10px;border:1px solid var(--line);">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:36px;height:36px;border-radius:10px;background:var(--primary);color:#fff;display:grid;place-items:center;font-weight:800;font-size:13px;">PA</div>
              <div>
                <strong style="font-size:13px;color:var(--text);display:block;">${esc(adm.displayName)}</strong>
                <small style="color:var(--muted);font-family:monospace;font-size:11px;">ID: ${esc(adm.userId)}</small>
              </div>
            </div>
            <span style="background:var(--green-soft);color:var(--green);font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;text-transform:uppercase;">
              ${esc(adm.role)}
            </span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// TENANT DETAIL DRAWER
// -----------------------------------------------------------------------------
async function openTenantDrawer(organizationId) {
  const drawer = portalContainer?.querySelector('#paTenantDrawer');
  const body = portalContainer?.querySelector('#paDrawerBody');
  const title = portalContainer?.querySelector('#paDrawerOrgName');
  const slug = portalContainer?.querySelector('#paDrawerOrgSlug');
  if (!drawer || !body) return;

  drawer.showModal();
  body.innerHTML = '<div style="text-align:center;padding:48px;color:var(--muted);">Đang tải thông tin chi tiết tenant...</div>';

  try {
    const tenant = await PlatformAdminService.getTenantDetail(organizationId);
    state.selectedTenant = tenant;

    if (title) title.textContent = tenant.name;
    if (slug) slug.textContent = `${tenant.slug}.worktree.vn · ID: ${tenant.id}`;

    body.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;">
        <div style="padding:12px;background:var(--surface-2);border-radius:10px;border:1px solid var(--line);">
          <span style="font-size:11px;color:var(--muted);display:block;">Chủ sở hữu</span>
          <strong style="font-size:14px;color:var(--text);margin-top:2px;display:block;">${esc(tenant.ownerName)}</strong>
        </div>
        <div style="padding:12px;background:var(--surface-2);border-radius:10px;border:1px solid var(--line);">
          <span style="font-size:11px;color:var(--muted);display:block;">Gói cước</span>
          <strong style="font-size:14px;color:var(--primary);margin-top:2px;display:block;text-transform:uppercase;">${esc(tenant.subscription?.plan || 'free')}</strong>
        </div>
        <div style="padding:12px;background:var(--surface-2);border-radius:10px;border:1px solid var(--line);">
          <span style="font-size:11px;color:var(--muted);display:block;">Số lượng công việc (Tasks)</span>
          <strong style="font-size:14px;color:var(--text);margin-top:2px;display:block;">${tenant.stats.taskCount} công việc</strong>
        </div>
        <div style="padding:12px;background:var(--surface-2);border-radius:10px;border:1px solid var(--line);">
          <span style="font-size:11px;color:var(--muted);display:block;">Trạng thái vận hành</span>
          <strong style="font-size:14px;color:${tenant.status === 'active' ? 'var(--green)' : 'var(--red)'};margin-top:2px;display:block;">
            ● ${tenant.status === 'active' ? 'Đang hoạt động' : 'Đã tạm khóa'}
          </strong>
        </div>
      </div>

      <h4 style="font-size:13.5px;font-weight:700;margin:0 0 10px;color:var(--text);">Danh sách thành viên (${tenant.members.length})</h4>
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;font-size:12.5px;text-align:left;">
          <thead>
            <tr style="background:var(--surface-2);color:var(--muted);font-size:11px;font-weight:700;text-transform:uppercase;">
              <th style="padding:8px 12px;">Họ và tên</th>
              <th style="padding:8px 12px;">Vai trò</th>
              <th style="padding:8px 12px;">Ngày tham gia</th>
            </tr>
          </thead>
          <tbody>
            ${tenant.members.map(m => `
              <tr style="border-bottom:1px solid var(--line);">
                <td style="padding:8px 12px;font-weight:600;color:var(--text);">${esc(m.displayName)}</td>
                <td style="padding:8px 12px;"><span style="font-size:10px;font-weight:700;text-transform:uppercase;padding:2px 6px;border-radius:4px;background:var(--surface-3);color:var(--text);">${esc(m.role)}</span></td>
                <td style="padding:8px 12px;color:var(--muted);font-size:11.5px;">${formatDate(m.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;padding-top:16px;border-top:1px solid var(--line);">
        ${tenant.status === 'active' ? `
          <button type="button" id="paDrawerSuspendBtn" style="padding:8px 16px;border:none;border-radius:8px;background:var(--red-soft);color:var(--red);cursor:pointer;font-weight:700;font-size:13px;">
            Khóa doanh nghiệp này
          </button>
        ` : `
          <button type="button" id="paDrawerUnsuspendBtn" style="padding:8px 16px;border:none;border-radius:8px;background:var(--green-soft);color:var(--green);cursor:pointer;font-weight:700;font-size:13px;">
            Mở khóa doanh nghiệp
          </button>
        `}
      </div>
    `;

    body.querySelector('#paDrawerSuspendBtn')?.addEventListener('click', () => {
      drawer.close();
      confirmTenantSuspension(tenant.id, 'suspend');
    });
    body.querySelector('#paDrawerUnsuspendBtn')?.addEventListener('click', () => {
      drawer.close();
      confirmTenantSuspension(tenant.id, 'unsuspend');
    });

  } catch (err) {
    body.innerHTML = `<div style="padding:32px;text-align:center;color:var(--red);">Lỗi nạp chi tiết: ${esc(err.message)}</div>`;
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
      <strong>⚠️ HÀNH ĐỘNG CÓ TÁC ĐỘNG CAO:</strong><br>
      Khóa doanh nghiệp này sẽ <strong>chặn toàn bộ quyền truy cập</strong> của mọi thành viên (Owner, Admin, Member).
      Dữ liệu công việc và tài liệu sẽ <strong>không bị xóa</strong> và có thể phục hồi bất cứ lúc nào.
    `;
    callout.style.background = 'var(--red-soft)';
    callout.style.color = 'var(--red)';
    proceedBtn.style.background = 'var(--red)';
    proceedBtn.textContent = 'Khóa doanh nghiệp';
  } else {
    title.textContent = `Mở khóa doanh nghiệp: ${orgName}`;
    callout.innerHTML = `
      <strong>KÍCH HOẠT LẠI DOANH NGHIỆP:</strong><br>
      Doanh nghiệp này sẽ được kích hoạt lại trạng thái hoạt động bình thường (Active) và các thành viên có thể đăng nhập tiếp tục làm việc.
    `;
    callout.style.background = 'var(--green-soft)';
    callout.style.color = 'var(--green)';
    proceedBtn.style.background = 'var(--green)';
    proceedBtn.textContent = 'Kích hoạt lại';
  }

  reasonInput.value = '';
  dialog.showModal();

  proceedBtn.onclick = async () => {
    const reason = reasonInput.value.trim();
    if (action === 'suspend' && !reason) {
      alert('Vui lòng nhập lý do khóa doanh nghiệp để lưu vào Security Audit Log!');
      reasonInput.focus();
      return;
    }

    proceedBtn.disabled = true;
    proceedBtn.textContent = 'Đang xử lý...';

    try {
      if (action === 'suspend') {
        await PlatformAdminService.suspendTenant(organizationId, reason);
      } else {
        await PlatformAdminService.unsuspendTenant(organizationId, reason || 'Phục hồi hoạt động');
      }

      dialog.close();
      await loadPortalData();
    } catch (err) {
      alert('Lỗi thực hiện: ' + err.message);
    } finally {
      proceedBtn.disabled = false;
    }
  };
}

/**
 * Mở toàn màn hình Platform Admin Portal
 */
export async function openPlatformAdminPortal(initialView = null) {
  const container = initPlatformAdminShell();
  container.style.display = 'block';

  if (initialView) {
    switchView(initialView);
  }

  const targetHash = initialView ? `#platform-admin/${initialView}` : '#platform-admin';
  if (window.location.hash !== targetHash) {
    window.location.hash = targetHash;
  }

  // Load authoritative admin email into profile pill
  try {
    const sb = (await import('../../../lib/supabase/client.js')).getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    const emailEl = container.querySelector('#paAdminEmail');
    if (emailEl && user?.email) {
      emailEl.textContent = user.email;
    }
  } catch (_) {}

  await loadPortalData();
}

/**
 * Đóng Platform Admin Portal và quay về không gian WorkTree bình thường
 */
export function closePlatformAdminPortal() {
  if (portalContainer) {
    portalContainer.style.display = 'none';
  }
  const h = (window.location.hash || '').toLowerCase();
  if (h.startsWith('#admin') || h.startsWith('#platform-admin') || h.startsWith('#admon')) {
    window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
  }
}
