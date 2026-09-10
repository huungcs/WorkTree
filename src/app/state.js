/**
 * WorkTree X — Reactive Application State
 * Scoped to current tenant (activeOrganizationId).
 * Invariants: activeOrganizationId is UI context, not security boundary.
 */

const PREF_ORG_KEY = 'worktree_active_organization_id';

export function normalizeStarredTaskIds(raw) {
  if (raw instanceof Set) return raw;
  if (Array.isArray(raw)) return new Set(raw);
  if (!raw) return new Set();
  return new Set(raw);
}

export const appState = {
  user: null,
  activeOrganizationId: null,
  activeMembership: null, // { role, status, employeeId, organizationId }
  organizations: [],     // Array of organizations user has active membership in
  nodes: [],
  employees: [],
  tasks: [],
  userPins: [],
  starredTaskIds: new Set(),
  savedViews: [],
  taskDetail: {
    taskId: null,
    checklist: [],
    dependencies: [],
    comments: [],
    timeEntries: [],
    attachments: [],
    loading: {
      checklist: false,
      dependencies: false,
      comments: false,
      timeEntries: false,
      attachments: false
    },
    errors: {
      checklist: null,
      dependencies: null,
      comments: null,
      timeEntries: null,
      attachments: null
    }
  },
  selectedNodeId: null,
  currentView: 'overview',
  theme: (typeof localStorage !== 'undefined' ? localStorage.getItem('worktree_theme') : null) || 'light',
  isSidebarCollapsed: typeof localStorage !== 'undefined' ? localStorage.getItem('worktree_sidebar_collapsed') === 'true' : false,
  realtimeStatus: 'offline',

  listeners: new Set(),

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },

  notify() {
    this.listeners.forEach(fn => {
      try {
        fn(this);
      } catch (err) {
        console.error('Lỗi state listener:', err);
      }
    });
  },

  /**
   * Thiết lập tổ chức đang hoạt động và lưu preference
   */
  setActiveOrg(orgId, membership = null) {
    this.activeOrganizationId = orgId;
    this.activeMembership = membership;
    if (typeof localStorage !== 'undefined') {
      if (orgId) {
        localStorage.setItem(PREF_ORG_KEY, orgId);
      } else {
        localStorage.removeItem(PREF_ORG_KEY);
      }
    }
    this.notify();
  },

  /**
   * Lấy ID tổ chức ưa thích đã lưu, chỉ trả về nếu hợp lệ trong danh sách memberships
   */
  getPreferredOrgId() {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(PREF_ORG_KEY) : null;
    if (!saved || !this.organizations.length) return null;
    const exists = this.organizations.some(o => (o.organizationId || o.id) === saved);
    return exists ? saved : null;
  },

  /**
   * Xóa sạch toàn bộ dữ liệu tenant trong bộ nhớ (khi switch workspace hoặc logout)
   * Ngăn chặn rò rỉ hoặc chớp nháy dữ liệu giữa Công ty A và Công ty B.
   */
  purgeTenantData() {
    this.nodes = [];
    this.employees = [];
    this.tasks = [];
    this.userPins = [];
    this.starredTaskIds = new Set();
    this.savedViews = [];
    this.taskDetail = {
      taskId: null,
      checklist: [],
      dependencies: [],
      comments: [],
      timeEntries: [],
      attachments: [],
      loading: { checklist: false, dependencies: false, comments: false, timeEntries: false, attachments: false },
      errors: { checklist: null, dependencies: null, comments: null, timeEntries: null, attachments: null }
    };
    this.selectedNodeId = null;
    this.currentView = 'overview';
    this.activeMembership = null;
    // Gọi hook dọn dẹp legacy nếu có
    if (typeof window.clearTenantUI === 'function') {
      try {
        window.clearTenantUI();
      } catch (e) {
        console.warn('Lỗi gọi clearTenantUI:', e);
      }
    }
    this.notify();
  },

  setView(viewName) {
    this.currentView = viewName;
    this.notify();
  },

  setTheme(themeName) {
    this.theme = themeName;
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('worktree_theme', themeName);
    this.notify();
  }
};
