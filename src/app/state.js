/**
 * WorkTree X — Reactive Application State
 * Scoped to current tenant (activeOrganizationId).
 */

export const appState = {
  user: null,
  activeOrganizationId: null,
  organizations: [],
  nodes: [],
  selectedNodeId: null,
  currentView: 'overview',
  theme: localStorage.getItem('worktree_theme') || 'light',
  isSidebarCollapsed: localStorage.getItem('worktree_sidebar_collapsed') === 'true',

  listeners: new Set(),

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },

  notify() {
    this.listeners.forEach(fn => fn(this));
  },

  setActiveOrg(orgId) {
    this.activeOrganizationId = orgId;
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
