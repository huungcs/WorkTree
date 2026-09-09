/**
 * WorkTree X — Modular Monolith App Orchestrator
 * Strictly maintains 0 visual drift and multi-tenant scoping.
 */

import { appState } from './state.js';
import { setupSidebarToggle } from '../components/navigation/sidebar.js';
import { AuthService } from '../features/auth/index.js';
import { OrgService } from '../features/organizations/index.js';
import { TreeService } from '../features/organization-tree/index.js';
import { TaskService } from '../features/tasks/index.js';

export async function bootstrapApp() {
  console.info('WorkTree X initializing in modular monolith mode...');

  // 1. Initialize Theme
  document.documentElement.setAttribute('data-theme', appState.theme);

  // 2. Setup Desktop Sidebar Toggle (278px expanded / 76px collapsed)
  setupSidebarToggle();

  // 3. Check Auth Session
  try {
    const user = await AuthService.getCurrentUser();
    if (user) {
      appState.user = user;
      console.info('Authenticated user:', user.email);

      // Load organizations
      const orgs = await OrgService.listUserOrganizations();
      appState.organizations = orgs;

      if (orgs.length > 0 && !appState.activeOrganizationId) {
        appState.setActiveOrg(orgs[0].id);
      }
    }
  } catch (err) {
    console.warn('Auth check skipped (offline or unauthenticated):', err.message);
  }

  // 4. Setup Theme Toggle shortcut
  const themeToggle = document.querySelector('[data-action="theme"]');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const nextTheme = appState.theme === 'dark' ? 'light' : 'dark';
      appState.setTheme(nextTheme);
    });
  }

  console.info('WorkTree X bootstrap complete.');
}

// Auto-run if loaded as script type=module
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    bootstrapApp();
  });
}
