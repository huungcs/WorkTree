/**
 * WorkTree X — Modular Monolith App Orchestrator
 * Strictly maintains 0 visual drift, multi-tenant scoping, authoritative Supabase Auth,
 * and seamless Organization Onboarding / Workspace Switching (Step 04).
 */

import { appState } from './state.js';
import { setupSidebarToggle } from '../components/navigation/sidebar.js';
import { AuthService, AuthView } from '../features/auth/index.js';
import { OrgService, WorkspaceDialog } from '../features/organizations/index.js';
import { NodeRepository, EmployeeRepository, TaskRepository, InvitationRepository, PinRepository, StarRepository, SavedViewRepository } from '../lib/supabase/repositories.js';
import { EmployeeService } from '../features/employees/index.js';
import { TaskService, StarService } from '../features/tasks/index.js';
import { TreeService } from '../features/organization-tree/index.js';
import { ChecklistService } from '../features/checklists/index.js';
import { DependencyService } from '../features/dependencies/index.js';
import { CommentService } from '../features/comments/index.js';
import { TimeEntryService } from '../features/time-tracking/index.js';
import { PinService } from '../features/pins/index.js';
import { SavedViewService } from '../features/saved-views/index.js';

let authViewInstance = null;
let workspaceDialogInstance = null;
let isBootstrapping = false;
let workspaceLoadGeneration = 0;

/**
 * Tạo adapter cho tài khoản người dùng từ Supabase User, Profile & active organization membership
 */
function createAccountAdapter(user, profile, memberships = [], activeOrg = null) {
  const currentOrg = activeOrg || (memberships.length > 0 ? memberships[0] : null);
  const role = currentOrg?.role || 'member';
  const displayName = profile?.display_name || user.user_metadata?.full_name || (user.email ? user.email.split('@')[0] : 'Người dùng');

  return {
    id: user.id,
    username: user.email || user.id,
    email: user.email || '',
    name: displayName,
    role: role,
    scopes: [],
    personId: currentOrg?.employeeId || null,
    active: true,
    version: 1,
    rawUser: user,
    profile: profile,
    organization: currentOrg,
    memberships: memberships
  };
}

const DB_STATUS_TO_UI = {
  todo: 'Chưa làm',
  in_progress: 'Đang làm',
  review: 'Chờ duyệt',
  done: 'Hoàn thành'
};

const DB_PRIORITY_TO_UI = {
  urgent: 'Khẩn cấp',
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp'
};

/**
 * Ánh xạ organization_nodes từ Supabase sang model hiển thị cây tổ chức
 * Invariant B: Tuyệt đối không tạo/chứa person nodes trong organization_nodes.
 */
function mapCloudNodes(rawNodes, fallbackOrgName = 'Không gian tổ chức') {
  if (!rawNodes || rawNodes.length === 0) return [];
  const sorted = [...rawNodes].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  return sorted.map(n => ({
    id: n.id,
    parent: n.parent_id || null,
    type: n.type, // 'company' | 'department' | 'project' | 'team' | 'folder'
    name: n.name || fallbackOrgName,
    desc: n.description || '',
    capacity: n.capacity_hours_week || 40,
    sort_order: n.sort_order || 0
  }));
}

/**
 * Ánh xạ employees từ Supabase sang model nhân sự
 * Canonical fields: id, full_name, email, employee_code, job_title, home_node_id
 */
function mapCloudEmployees(rawEmployees) {
  return (rawEmployees || []).map(e => ({
    id: e.id,
    name: e.full_name || 'Nhân sự',
    full_name: e.full_name || 'Nhân sự',
    email: e.email || '',
    employee_code: e.employee_code || '',
    job_title: e.job_title || '',
    home_node_id: e.home_node_id || null,
    desc: e.job_title || e.employee_code || 'Nhân sự',
    capacity: 40,
    type: 'employee'
  }));
}

/**
 * Ánh xạ task_rollups từ Supabase view sang model công việc cho UI
 */
function mapCloudTasks(rawTasks) {
  return (rawTasks || []).map(t => {
    const uiStatus = DB_STATUS_TO_UI[t.status] || 'Chưa làm';
    const uiPriority = DB_PRIORITY_TO_UI[t.priority] || 'Trung bình';
    const totalChecks = t.checklist_total || 0;
    const doneChecks = t.checklist_done || 0;

    return {
      id: t.id,
      node: t.node_id,
      title: t.title || '',
      owner: t.primary_assignee_id || null,
      status: uiStatus,
      priority: uiPriority,
      start: t.start_date || '',
      due: t.due_date || '',
      estimate: (t.estimate_minutes || 0) / 60,
      actual: (t.actual_minutes || 0) / 60,
      progress: t.status === 'done' ? 100 : (t.progress || 0),
      desc: t.description || '',
      tags: Array.isArray(t.tags) ? t.tags : [],
      dependency: t.is_blocked ? 'Chờ phụ thuộc' : 'Không có',
      dependencies: [],
      checklist: Array.from({ length: totalChecks }, (_, i) => [
        `Mục ${i + 1}`,
        i < doneChecks
      ]),
      comments: [],
      logs: [],
      favorite: false,
      autoProgress: t.auto_progress === true,
      is_blocked: t.is_blocked === true,
      checklist_total: totalChecks,
      checklist_done: doneChecks,
      createdAt: t.created_at || '',
      updatedAt: t.updated_at || ''
    };
  });
}

/**
 * Hiển thị/ẩn overlay loading của workspace
 */
function showWorkspaceLoading(show) {
  let overlay = document.getElementById('workspaceLoadingOverlay');
  if (!overlay && show) {
    overlay = document.createElement('div');
    overlay.id = 'workspaceLoadingOverlay';
    overlay.className = 'workspace-loading-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = `
      <div class="workspace-loading-card">
        <div class="spinner"></div>
        <p id="workspaceLoadingText">Đang đồng bộ dữ liệu từ Supabase Cloud...</p>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  if (overlay) {
    overlay.hidden = !show;
  }
}

/**
 * Hiển thị trạng thái lỗi khi tải workspace có nút retry
 */
function showWorkspaceError(message, retryCallback) {
  let overlay = document.getElementById('workspaceLoadingOverlay');
  if (!overlay) {
    showWorkspaceLoading(true);
    overlay = document.getElementById('workspaceLoadingOverlay');
  }
  if (overlay) {
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="workspace-loading-card error">
        <div class="error-icon" style="color:var(--red);font-size:24px;margin-bottom:8px">⚠️</div>
        <p style="color:var(--text);font-weight:600;margin-bottom:4px">Lỗi tải dữ liệu workspace</p>
        <p style="color:var(--muted);font-size:13px;margin-bottom:16px">${message}</p>
        <button class="btn primary" id="retryWorkspaceLoadBtn">Thử lại</button>
      </div>
    `;
    const retryBtn = document.getElementById('retryWorkspaceLoadBtn');
    if (retryBtn && retryCallback) {
      retryBtn.addEventListener('click', () => {
        overlay.innerHTML = `
          <div class="workspace-loading-card">
            <div class="spinner"></div>
            <p id="workspaceLoadingText">Đang thử lại kết nối Supabase Cloud...</p>
          </div>
        `;
        retryCallback();
      });
    }
  }
}

/**
 * STEP 05 — CLOUD WORKSPACE LOAD PIPELINE
 * Tải đồng thời organization_nodes, employees, task_rollups và commit nguyên tử
 */
export async function loadWorkspaceData(orgId) {
  if (!orgId) return;

  const currentGeneration = ++workspaceLoadGeneration;

  // 1. Kiểm tra quyền membership
  const memberships = appState.organizations || [];
  const membership = memberships.find(m => m.organizationId === orgId);
  if (!membership) {
    console.error('Không tìm thấy quyền truy cập hợp lệ cho tổ chức:', orgId);
    return;
  }

  // 2. Hiển thị loading state
  showWorkspaceLoading(true);

  try {
    // 3. Purge dữ liệu tenant trước đó để tránh flash / mix data
    if (typeof window.clearTenantUI === 'function') {
      window.clearTenantUI(membership.name);
    }

    // 4, 5, 6. Fetch song song từ canonical repositories (kể cả personal cloud data: pins, stars, saved views)
    const [rawNodes, rawEmployees, rawTasks, rawPins, rawStarredTaskIds, rawSavedViews] = await Promise.all([
      NodeRepository.getNodes(orgId),
      EmployeeRepository.getEmployees(orgId),
      TaskRepository.getTasks(orgId),
      PinRepository.getUserPins(orgId),
      StarRepository.getStarredTaskIds(orgId),
      SavedViewRepository.getSavedViews(orgId)
    ]);

    // 7. Security / Data Leak Guard: Xác nhận toàn bộ bản ghi thuộc đúng activeOrganizationId
    const leakedNode = rawNodes.find(n => n.organization_id !== orgId);
    if (leakedNode) {
      throw new Error(`SECURITY ALERT: Node ${leakedNode.id} organization mismatch (${leakedNode.organization_id} !== ${orgId})`);
    }
    const leakedEmp = rawEmployees.find(e => e.organization_id !== orgId);
    if (leakedEmp) {
      throw new Error(`SECURITY ALERT: Employee ${leakedEmp.id} organization mismatch (${leakedEmp.organization_id} !== ${orgId})`);
    }
    const leakedTask = rawTasks.find(t => t.organization_id !== orgId);
    if (leakedTask) {
      throw new Error(`SECURITY ALERT: Task ${leakedTask.id} organization mismatch (${leakedTask.organization_id} !== ${orgId})`);
    }
    const leakedPin = (rawPins || []).find(p => p.organization_id !== orgId);
    if (leakedPin) {
      throw new Error(`SECURITY ALERT: Pin ${leakedPin.id} organization mismatch (${leakedPin.organization_id} !== ${orgId})`);
    }
    const leakedSavedView = (rawSavedViews || []).find(sv => sv.organization_id !== orgId);
    if (leakedSavedView) {
      throw new Error(`SECURITY ALERT: Saved view ${leakedSavedView.id} organization mismatch (${leakedSavedView.organization_id} !== ${orgId})`);
    }

    // 8. REQUEST CONCURRENCY / RACE CONDITION GUARD
    if (currentGeneration !== workspaceLoadGeneration || orgId !== appState.activeOrganizationId) {
      console.warn(`[Race Guard] Hủy bỏ kết quả load cũ (generation ${currentGeneration}, org ${orgId}) vì generation mới nhất là ${workspaceLoadGeneration} (active org ${appState.activeOrganizationId})`);
      return;
    }

    // 9. Normalize / map rows
    const mappedNodes = mapCloudNodes(rawNodes, membership.name);
    const mappedEmployees = mapCloudEmployees(rawEmployees);
    const mappedTasks = mapCloudTasks(rawTasks);

    // 10. Commit snapshot atomically vào appState
    appState.nodes = mappedNodes;
    appState.employees = mappedEmployees;
    appState.tasks = mappedTasks;
    appState.userPins = rawPins || [];
    appState.starredTaskIds = rawStarredTaskIds || new Set();
    appState.savedViews = rawSavedViews || [];

    // 11. Cập nhật UI projection layer
    if (typeof window.setCloudWorkspaceData === 'function') {
      window.setCloudWorkspaceData({
        nodes: mappedNodes,
        employees: mappedEmployees,
        tasks: mappedTasks,
        pins: rawPins || [],
        starredTaskIds: rawStarredTaskIds || new Set(),
        savedViews: rawSavedViews || [],
        orgName: membership.name
      });
    }

  } catch (err) {
    console.error('Lỗi khi tải dữ liệu workspace từ Supabase Cloud:', err);
    if (currentGeneration === workspaceLoadGeneration) {
      showWorkspaceError('Không thể tải dữ liệu workspace: ' + (err.message || 'Vui lòng thử lại.'), () => {
        loadWorkspaceData(orgId);
      });
    }
  } finally {
    if (currentGeneration === workspaceLoadGeneration) {
      showWorkspaceLoading(false);
    }
  }
}

/**
 * Chuyển đổi tổ chức đang hoạt động (Workspace Switcher & Tenant Purge)
 */
export async function switchWorkspace(targetOrgId, shouldShowToast = true) {
  console.info('Chuyển đổi workspace sang:', targetOrgId);

  // 1. Xác thực organizationId có trong danh sách memberships của user
  let targetOrg = (appState.organizations || []).find(o => o.organizationId === targetOrgId);
  if (!targetOrg) {
    // Thử reload từ database
    const freshMemberships = await OrgService.listUserOrganizations();
    appState.organizations = freshMemberships;
    targetOrg = freshMemberships.find(o => o.organizationId === targetOrgId);
  }

  if (!targetOrg) {
    console.error('Không tìm thấy workspace hợp lệ hoặc bạn không có quyền truy cập:', targetOrgId);
    if (workspaceDialogInstance) {
      workspaceDialogInstance.openSwitcher({
        organizations: appState.organizations,
        activeOrganizationId: appState.activeOrganizationId
      });
    }
    return;
  }

  // 2. Xóa sạch dữ liệu tenant cũ trong bộ nhớ (Tenant State Purge)
  appState.purgeTenantData();

  // Đóng các dialog/drawer đang mở
  document.querySelectorAll('dialog[open]').forEach(d => {
    try { d.close(); } catch (e) {}
  });

  // 3. Kích hoạt tenant mới trong appState
  appState.setActiveOrg(targetOrg.organizationId, {
    role: targetOrg.role,
    status: targetOrg.status,
    employeeId: targetOrg.employeeId,
    rootNodeId: targetOrg.rootNodeId
  });

  // 4. Cập nhật giao diện workspace & profile
  updateWorkspaceUI(targetOrg.name, targetOrg.slug || 'Không gian tổ chức');

  const profile = window.__worktree_supabase_user?.profile || null;
  const accountAdapter = createAccountAdapter(appState.user, profile, appState.organizations, targetOrg);
  window.__worktree_supabase_user = accountAdapter;
  updateUserProfileUI(accountAdapter);

  // 5. Làm sạch UI dữ liệu cục bộ và hiển thị workspace
  if (typeof window.clearTenantUI === 'function') {
    window.clearTenantUI(targetOrg.name);
  }

  // 6. STEP 05/06 READ MODEL: Tải dữ liệu đám mây thật cho workspace
  await loadWorkspaceData(targetOrg.organizationId);

  // 7. Vào workspace
  if (typeof window.enterWorkspace === 'function') {
    await window.enterWorkspace(accountAdapter, false, true);
  } else {
    const authScreen = document.getElementById('authScreen');
    const appEl = document.getElementById('app');
    if (authScreen) authScreen.hidden = true;
    if (appEl) {
      appEl.hidden = false;
      appEl.inert = false;
    }
  }

  if (shouldShowToast && typeof window.toast === 'function') {
    window.toast('Đã chuyển sang workspace: ' + targetOrg.name);
  }
}

/**
 * Khởi tạo ứng dụng sau khi xác thực thành công qua Supabase Auth
 */
export async function bootstrapAuthenticatedUser(user, session) {
  if (isBootstrapping) return;
  isBootstrapping = true;

  try {
    console.info('Supabase Authenticated user:', user.email);

    // 1. Tải Profile người dùng từ public.profiles
    const profile = await AuthService.getProfile(user.id);

    // 2. Tải danh sách Organization memberships của người dùng từ Supabase
    const memberships = await OrgService.listUserOrganizations();
    appState.user = user;
    appState.organizations = memberships;

    const initialAdapter = createAccountAdapter(user, profile, memberships);
    window.__worktree_supabase_user = initialAdapter;
    updateUserProfileUI(initialAdapter);

    // 3. Xử lý các trường hợp Onboarding / Auto-select / Multi-org
    if (memberships.length === 0) {
      // CASE A: 0 organizations -> Onboarding state
      console.info('Case A: 0 organizations -> Kích hoạt Onboarding modal');
      appState.activeOrganizationId = null;
      updateWorkspaceUI('Chưa có workspace', 'Khởi tạo tổ chức');

      // Ẩn auth screen và mở modal tạo workspace đầu tiên
      const authScreen = document.getElementById('authScreen');
      if (authScreen) authScreen.hidden = true;

      const appEl = document.getElementById('app');
      if (appEl) {
        appEl.hidden = false;
        appEl.inert = false;
      }

      if (typeof window.clearTenantUI === 'function') {
        window.clearTenantUI('Chưa có workspace');
      }

      workspaceDialogInstance.openCreateWorkspace({
        isZeroOrg: true,
        defaultName: profile?.display_name ? `${profile.display_name}'s Org` : ''
      });

    } else if (memberships.length === 1) {
      // CASE B: 1 organization -> Tự động vào workspace duy nhất
      console.info('Case B: 1 organization -> Tự động chọn:', memberships[0].name);
      await switchWorkspace(memberships[0].organizationId, false);

    } else {
      // CASE C: >1 organizations -> Kiểm tra preference hoặc hiển thị Workspace Selector
      const preferredOrgId = appState.getPreferredOrgId();
      if (preferredOrgId && memberships.some(m => m.organizationId === preferredOrgId)) {
        console.info('Case C: Chọn workspace theo preference:', preferredOrgId);
        await switchWorkspace(preferredOrgId, false);
      } else {
        console.info('Case C: Hiển thị Workspace Selector để người dùng chọn');
        updateWorkspaceUI('Chọn workspace', 'Nhiều không gian');

        const authScreen = document.getElementById('authScreen');
        if (authScreen) authScreen.hidden = true;

        const appEl = document.getElementById('app');
        if (appEl) {
          appEl.hidden = false;
          appEl.inert = false;
        }

        if (typeof window.clearTenantUI === 'function') {
          window.clearTenantUI('Chọn workspace');
        }

        workspaceDialogInstance.openSwitcher({
          organizations: memberships,
          activeOrganizationId: null
        });
      }
    }

  } catch (err) {
    console.error('Lỗi bootstrap session:', err);
    if (authViewInstance) {
      authViewInstance.showError('Không thể khởi tạo phiên làm việc: ' + err.message);
    }
  } finally {
    isBootstrapping = false;
  }
}

/**
 * Cập nhật tên và thông tin workspace trên giao diện
 */
function updateWorkspaceUI(name, sub = 'Không gian làm việc') {
  const wsNameEl = document.getElementById('workspaceName');
  const topWsEl = document.getElementById('topWorkspace');
  const wsSubEl = document.getElementById('workspaceSub');
  const wsAvatarEl = document.querySelector('.workspace-avatar');

  if (wsNameEl) wsNameEl.textContent = name;
  if (topWsEl) topWsEl.textContent = name;
  if (wsSubEl) wsSubEl.textContent = sub;
  if (wsAvatarEl) {
    wsAvatarEl.textContent = (name || 'W').slice(0, 2).toUpperCase();
  }
}

/**
 * Cập nhật avatar và tên user trên sidebar và header
 */
function updateUserProfileUI(account) {
  const nameEl = document.getElementById('profileName');
  const roleEl = document.getElementById('profileRole');
  const userAvatar = document.getElementById('userAvatar');
  const topAvatar = document.getElementById('topAvatar');

  const nameParts = (account.name || 'User').trim().split(/\s+/);
  const initials = nameParts.length > 1
    ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
    : (nameParts[0].slice(0, 2)).toUpperCase();

  const roleLabels = {
    owner: 'Chủ sở hữu',
    admin: 'Quản trị viên',
    manager: 'Quản lý',
    member: 'Nhân viên',
    viewer: 'Chỉ xem'
  };
  const displayRole = roleLabels[account.role] || account.role;

  if (nameEl) nameEl.textContent = account.name;
  if (roleEl) roleEl.textContent = displayRole;
  if (userAvatar) userAvatar.textContent = initials;
  if (topAvatar) topAvatar.textContent = initials;
}

/**
 * Khởi tạo toàn bộ ứng dụng và điều phối auth lifecycle
 */
export async function bootstrapApp() {
  console.info('WorkTree X initializing with authoritative Supabase Auth & Multi-Tenant Onboarding...');

  // 1. Áp dụng Theme
  document.documentElement.setAttribute('data-theme', appState.theme);

  // 2. Thiết lập Desktop Sidebar Toggle (278px / 76px)
  setupSidebarToggle();

  // 3. Khởi tạo WorkspaceDialog
  workspaceDialogInstance = new WorkspaceDialog({
    onWorkspaceChanged: async (orgId) => {
      await switchWorkspace(orgId, true);
    },
    onLogout: async () => {
      await window.supabaseSignOut();
    }
  });

  // Móc nối toàn cục để gọi từ sidebar và topbar
  window.openWorkspaceSwitcher = () => {
    const userOrgs = appState.organizations || [];
    if (userOrgs.length === 0) {
      workspaceDialogInstance.openCreateWorkspace({ isZeroOrg: true });
    } else {
      workspaceDialogInstance.openSwitcher({
        organizations: userOrgs,
        activeOrganizationId: appState.activeOrganizationId
      });
    }
  };

  window.openCreateWorkspaceModal = () => {
    workspaceDialogInstance.openCreateWorkspace({ isZeroOrg: false });
  };

  // 4. Khởi tạo AuthView
  authViewInstance = new AuthView({
    container: document.getElementById('authScreen'),
    onAuthenticated: (session) => {
      if (session?.user) {
        bootstrapAuthenticatedUser(session.user, session);
      }
    }
  });

  window.renderSupabaseAuth = (msg) => {
    authViewInstance.render('login', msg ? { error: msg } : {});
  };

  window.supabaseSignOut = async () => {
    try {
      await AuthService.signOut();
    } catch (err) {
      console.warn('Lỗi khi signOut:', err.message);
    } finally {
      window.__worktree_supabase_user = null;
      appState.user = null;
      appState.activeOrganizationId = null;
      appState.organizations = [];
      appState.purgeTenantData();
      if (workspaceDialogInstance) workspaceDialogInstance.close();
      if (typeof window.lockWorkspace === 'function') {
        window.lockWorkspace('Đã đăng xuất.');
      } else {
        authViewInstance.render('login');
      }
    }
  };

  // 5. Kiểm tra session hiện tại từ Supabase Auth
  try {
    const session = await AuthService.getSession();
    if (session?.user) {
      await bootstrapAuthenticatedUser(session.user, session);
    } else {
      console.info('No active session. Displaying Supabase Auth screen.');
      window.__worktree_supabase_user = null;
      authViewInstance.render('login');
    }
  } catch (err) {
    console.warn('Auth check error:', err.message);
    window.__worktree_supabase_user = null;
    authViewInstance.render('login', { error: AuthService.formatAuthError(err) });
  }

  // 6. Lắng nghe Auth State Changes
  try {
    await AuthService.onAuthStateChange(async (event, session) => {
      console.info('Supabase Auth Event:', event);

      switch (event) {
        case 'SIGNED_IN':
          if (session?.user && !window.__worktree_supabase_user) {
            await bootstrapAuthenticatedUser(session.user, session);
          }
          break;

        case 'SIGNED_OUT':
          window.__worktree_supabase_user = null;
          appState.user = null;
          appState.activeOrganizationId = null;
          appState.organizations = [];
          appState.purgeTenantData();
          if (workspaceDialogInstance) workspaceDialogInstance.close();
          if (typeof window.lockWorkspace === 'function') {
            window.lockWorkspace('Đã đăng xuất.');
          } else {
            authViewInstance.render('login');
          }
          break;

        case 'TOKEN_REFRESHED':
          if (session?.user && window.__worktree_supabase_user) {
            window.__worktree_supabase_user.rawUser = session.user;
          }
          break;

        case 'PASSWORD_RECOVERY':
          authViewInstance.render('recovery');
          break;
      }
    });
  } catch (err) {
    console.warn('Không thể đăng ký onAuthStateChange listener:', err.message);
  }

  // 7. Gán sự kiện click cho Workspace switcher trên giao diện
  const wsBtn = document.querySelector('[data-action="workspace"]');
  if (wsBtn) {
    wsBtn.setAttribute('aria-haspopup', 'dialog');
    wsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.openWorkspaceSwitcher();
    });
  }

  const topWs = document.getElementById('topWorkspace');
  if (topWs) {
    topWs.style.cursor = 'pointer';
    topWs.setAttribute('title', 'Bấm để chuyển đổi không gian làm việc');
    topWs.addEventListener('click', (e) => {
      e.preventDefault();
      window.openWorkspaceSwitcher();
    });
  }

  // 8. Nút đổi theme
  const themeToggle = document.querySelector('[data-action="theme"]');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const nextTheme = appState.theme === 'dark' ? 'light' : 'dark';
      appState.setTheme(nextTheme);
    });
  }

  console.info('WorkTree X bootstrap complete.');
}

if (typeof window !== 'undefined') {
  window.appState = appState;
  window.loadWorkspaceData = loadWorkspaceData;
  window.getWorkspaceLoadGeneration = () => workspaceLoadGeneration;
  window.TaskService = TaskService;
  window.TreeService = TreeService;
  window.ChecklistService = ChecklistService;
  window.DependencyService = DependencyService;
  window.CommentService = CommentService;
  window.TimeEntryService = TimeEntryService;
  window.EmployeeService = EmployeeService;
  window.EmployeeRepository = EmployeeRepository;
  window.InvitationRepository = InvitationRepository;
  window.PinRepository = PinRepository;
  window.StarRepository = StarRepository;
  window.SavedViewRepository = SavedViewRepository;
  window.PinService = PinService;
  window.StarService = StarService;
  window.SavedViewService = SavedViewService;
}

// Tự khởi chạy khi file được nạp
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => bootstrapApp());
  } else {
    bootstrapApp();
  }
}
