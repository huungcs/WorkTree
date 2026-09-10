// src/features/onboarding/index.js
// Public API and entry point for WorkTree X Product Onboarding V1.
// Adheres to AGENTS.md modular architecture and design system contracts.

import { OnboardingService } from './services/onboarding-service.js';
import { TourController } from './ui/tour-controller.js';
import { WelcomeDialog } from './ui/welcome-dialog.js';
import { GettingStartedCard } from './ui/getting-started-card.js';
import { ContextualPopoverManager } from './ui/contextual-popover.js';
import { HelpCenterDialog } from './ui/help-center-dialog.js';
import { PopupCoordinator } from './ui/popup-coordinator.js';
import { JOURNEYS, getJourneyForRole } from './config/journeys.js';
import { CONTEXTUAL_HELP_TOPICS } from './config/contextual-help.js';

export {
  OnboardingService,
  TourController,
  WelcomeDialog,
  GettingStartedCard,
  ContextualPopoverManager,
  HelpCenterDialog,
  PopupCoordinator,
  JOURNEYS,
  getJourneyForRole,
  CONTEXTUAL_HELP_TOPICS
};

/**
 * Initialize Onboarding subsystem when user and workspace are ready.
 * Non-blocking, safe-fallback, respects feature flags and popup coordination.
 * @param {Object} appState - { user, organization, role, currentView }
 */
export async function initOnboarding(appState = {}) {
  try {
    // Check feature flag
    const isEnabled = window.FEATURE_FLAGS?.onboarding !== false && 
                      localStorage.getItem('worktree_onboarding_disabled') !== 'true';
    if (!isEnabled) {
      console.log('[Onboarding] Feature disabled via flag');
      return;
    }

    const { user, organization, role } = appState;
    if (!user || !organization) {
      console.log('[Onboarding] Skipped init: user or organization not ready yet');
      return;
    }

    // Set context in OnboardingService
    OnboardingService.setContext({
      user,
      organization,
      role: (role || 'member').toLowerCase()
    });

    // Initialize contextual help popover triggers across DOM
    ContextualPopoverManager.initTriggers(document);

    // Bind help button if present in topbar or mobile menu
    bindHelpCenterTriggers(appState);

    // Check if eligible for Welcome Dialog
    const journey = getJourneyForRole(role);
    const isEligible = await OnboardingService.isEligibleForWelcome(journey.id);

    if (isEligible) {
      // Allow the app UI to stabilize first (1200ms delay)
      setTimeout(async () => {
        // Ensure no active user-initiated modal is blocking
        if (PopupCoordinator.canShowWelcome()) {
          await WelcomeDialog.show({
            user,
            organization,
            role
          });
        }
      }, 1200);
    }
  } catch (err) {
    console.warn('[Onboarding] Non-fatal initialization error:', err);
  }
}

/**
 * Helper to bind buttons that open the Help Center
 */
function bindHelpCenterTriggers(appState) {
  const helpButtons = document.querySelectorAll('[data-action="open-help-center"], #helpCenterBtn, .btn-help-center, [data-action="help"]');
  helpButtons.forEach(btn => {
    if (btn._hasHelpCenterBound) return;
    btn._hasHelpCenterBound = true;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      HelpCenterDialog.open(appState);
    });
  });
}

/**
 * Mount Getting Started Card on Overview View
 * @param {HTMLElement} container
 * @param {Object} appState
 */
export async function mountOverviewChecklist(container, appState = {}) {
  try {
    const isEnabled = window.FEATURE_FLAGS?.onboarding !== false && 
                      localStorage.getItem('worktree_onboarding_disabled') !== 'true';
    if (!isEnabled) return;

    await GettingStartedCard.render(container, appState);
  } catch (err) {
    console.warn('[Onboarding] Non-fatal checklist mount error:', err);
  }
}

// Expose on window for runtime access and browser testing
if (typeof window !== 'undefined') {
  window.WorkTreeOnboarding = {
    initOnboarding,
    mountOverviewChecklist,
    OnboardingService,
    TourController,
    WelcomeDialog,
    GettingStartedCard,
    ContextualPopoverManager,
    HelpCenterDialog,
    PopupCoordinator,
    JOURNEYS,
    CONTEXTUAL_HELP_TOPICS
  };
}
