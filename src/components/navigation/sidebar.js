/**
 * WorkTree X Desktop Sidebar Component
 * Expanded: 278px | Collapsed: 76px
 * Boundary: Desktop >= 901px
 */

import { ICONS } from '../../design-system/icons.js';

export function setupSidebarToggle({
  toggleBtnSelector = '#sidebarToggleBtn',
  appContainerSelector = '.app',
  storageKey = 'worktree_sidebar_collapsed'
} = {}) {
  const toggleBtn = document.querySelector(toggleBtnSelector);
  const appContainer = document.querySelector(appContainerSelector);

  const getSavedState = () => {
    try {
      return localStorage.getItem(storageKey) === 'true';
    } catch (e) {
      return false;
    }
  };

  const setCollapsedState = (isCollapsed) => {
    if (!appContainer) return;
    if (isCollapsed) {
      appContainer.classList.add('sidebar-collapsed');
      document.body.setAttribute('data-sidebar-collapsed', 'true');
    } else {
      appContainer.classList.remove('sidebar-collapsed');
      document.body.removeAttribute('data-sidebar-collapsed');
    }
    try {
      localStorage.setItem(storageKey, isCollapsed ? 'true' : 'false');
    } catch (e) {}
  };

  // Initialize
  const initial = getSavedState();
  if (initial) {
    setCollapsedState(true);
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const currentState = appContainer?.classList.contains('sidebar-collapsed');
      setCollapsedState(!currentState);
    });
  }

  return {
    isCollapsed: () => appContainer?.classList.contains('sidebar-collapsed'),
    setCollapsed: setCollapsedState
  };
}
