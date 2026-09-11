// src/features/onboarding/ui/tour-controller.js
// Guided Tour controller with DOM spotlighting, responsive positioning,
// mobile sheet adaptation, SPA lifecycle handling, and keyboard accessibility.

import { JOURNEYS, getJourneyForRole } from '../config/journeys.js';
import { OnboardingService } from '../services/onboarding-service.js';
import { PopupCoordinator } from './popup-coordinator.js';

/**
 * Robust selector mappings for all journey target keys across desktop & mobile
 */
const TARGET_SELECTORS = {
  'workspace-brand': [
    '[data-tour~="workspace-brand"]',
    '[data-tour~="workspace-header"]',
    '.workspace-switch',
    '.brand',
    // Mobile responsive targets:
    '.topbar-left',
    '.menu-toggle'
  ],
  'org-tree': [
    '.tree-heading',
    '[data-tour~="org-tree"]',
    '#orgTree',
    '.org-tree',
    // Mobile responsive targets:
    '.m-scope-open',
    '#mobileScope'
  ],
  'access-nav': [
    '[data-tour~="access-nav"]',
    '[data-tour~="add-employee"]',
    '#accessNav',
    'button[data-action="access"]',
    // Mobile responsive targets:
    '.menu-toggle'
  ],
  'new-task-btn': [
    '[data-tour~="new-task-btn"]',
    '[data-tour~="create-task"]',
    '.side-create',
    'button[data-action="new-task"]'
  ],
  'view-tabs': [
    '[data-tour~="view-tabs"]',
    '#viewTabs',
    '.view-nav',
    // Mobile responsive targets:
    '.m-viewbutton',
    '#mobileViewbar'
  ],
  'workload-tab': [
    '#tab-workload',
    'button[data-view="workload"]',
    '#viewTabs button[data-view="workload"]',
    '#viewTabs',
    // Mobile:
    '.m-viewbutton'
  ],
  'pin-section': [
    '[data-tour~="pin-section"]',
    '[data-tour~="pins"]',
    '#pinSection',
    '.pin-section',
    // Mobile:
    '#mobileOverviewPins',
    '.m-pin-strip'
  ],
  'my-tasks-nav': [
    '[data-tour~="my-tasks-nav"]',
    '[data-tour~="my-tasks"]',
    'button[data-nav="mine"]'
  ],
  'help-nav': [
    '[data-tour~="help-nav"]',
    '[data-tour~="help-center"]',
    '#helpCenterBtn',
    'button[data-action="help"]',
    // Mobile:
    '.content-footer button[data-action="help"]'
  ],
  'filter-toolbar': [
    '[data-tour~="filter-toolbar"]',
    '[data-tour~="filters-search"]',
    '.filterbar',
    '#filterBtn'
  ],
  'task-list': [
    '[data-tour~="task-list"]',
    '#viewContent',
    '.view-content'
  ]
};

class TourControllerImpl {
  constructor() {
    this.activeTour = null;
    this.currentStepIndex = 0;
    this.targetElement = null;
    this.highlightedTarget = null;
    this.popoverEl = null;
    this.backdropEl = null;
    this.spotlightEl = null;
    this.onActionCallback = null;
    this.resizeListener = null;
    this.scrollListener = null;
    this.keydownListener = null;
    this.waitingTimer = null;
    this.scrollRepositionTimer = null;
    this.observers = [];
  }

  /**
   * Start a guided tour
   * @param {string} journeyId - Key from JOURNEYS
   * @param {Object} context - { role, user, workspace, organization }
   * @param {number} startStepIndex
   */
  async startTour(journeyId, context = {}, startStepIndex = 0) {
    // If another tour is active, clean it up first
    this.endTour(false);

    let journey = JOURNEYS[journeyId];
    if (!journey && context.role) {
      journey = getJourneyForRole(context.role);
    }

    if (!journey || !journey.steps || journey.steps.length === 0) {
      console.warn('[TourController] Invalid journey:', journeyId);
      return false;
    }

    // Filter steps by user capabilities if defined
    const userRole = (context.role || 'member').toLowerCase();
    const validSteps = journey.steps.filter(step => {
      if (!step.requiredCapability) return true;
      if (userRole === 'owner' || userRole === 'admin') return true;
      if (userRole === 'manager') {
        return step.requiredCapability !== 'manage_organization' && step.requiredCapability !== 'manage_members';
      }
      if (userRole === 'viewer') {
        return step.requiredCapability.startsWith('read') || step.requiredCapability.startsWith('view');
      }
      return true;
    });

    if (validSteps.length === 0) {
      console.warn('[TourController] No valid steps for current role/capabilities');
      return false;
    }

    // Acquire lock in popup coordinator
    if (!PopupCoordinator.requestTourLock(journey.id)) {
      console.log('[TourController] Deferred tour due to active modals/forms');
      return false;
    }

    this.activeTour = {
      ...journey,
      steps: validSteps,
      context
    };
    this.currentStepIndex = Math.max(0, Math.min(startStepIndex, validSteps.length - 1));

    // Create backdrop and spotlight container
    this.createBackdrop();
    this.bindGlobalEvents();

    await this.renderCurrentStep();
    return true;
  }

  /**
   * Render the current step
   */
  async renderCurrentStep() {
    if (!this.activeTour) return;

    const step = this.activeTour.steps[this.currentStepIndex];
    if (!step) {
      this.completeTour();
      return;
    }

    // Check if step requires preparing UI (e.g. Switching view or opening menu)
    if (typeof step.beforeShow === 'function') {
      try {
        await step.beforeShow();
      } catch (err) {
        console.warn('[TourController] beforeShow error:', err);
      }
    }

    // Locate target element by passing step object (resolves targetKey, targetSelector, or aliases)
    const target = await this.locateTarget(step, 2500);
    this.targetElement = target;

    // Ensure target is fully revealed in its scroll container before computing coordinates
    if (target) {
      this.ensureTargetVisible(target);
    }

    // Save progress to cloud/local
    OnboardingService.updateStepProgress(
      this.activeTour.id,
      this.currentStepIndex,
      this.activeTour.steps.length
    ).catch(err => console.warn('[TourController] Progress update error:', err));

    this.renderPopover(step, target);
    this.updateSpotlight(target);
  }

  /**
   * Locate target element with fallback and timeout
   * @param {Object|string} stepOrSelector
   * @param {number} timeoutMs
   */
  locateTarget(stepOrSelector, timeoutMs = 2500) {
    return new Promise(resolve => {
      let candidateSelectors = [];

      if (typeof stepOrSelector === 'string') {
        candidateSelectors = [stepOrSelector];
      } else if (stepOrSelector && typeof stepOrSelector === 'object') {
        const { targetKey, targetSelector, id } = stepOrSelector;
        if (targetSelector) {
          candidateSelectors.push(targetSelector);
        }
        if (targetKey) {
          candidateSelectors.push(`[data-tour~="${targetKey}"]`);
          if (TARGET_SELECTORS[targetKey]) {
            candidateSelectors.push(...TARGET_SELECTORS[targetKey]);
          }
        }
        if (id && TARGET_SELECTORS[id]) {
          candidateSelectors.push(...TARGET_SELECTORS[id]);
        }
      }

      if (candidateSelectors.length === 0) {
        resolve(null);
        return;
      }

      const findVisible = () => {
        for (const selector of candidateSelectors) {
          try {
            const els = document.querySelectorAll(selector);
            for (const el of els) {
              if (this.isElementVisible(el)) {
                return el;
              }
            }
          } catch (e) {
            // ignore invalid selector syntax
          }
        }
        return null;
      };

      const immediateEl = findVisible();
      if (immediateEl) {
        resolve(immediateEl);
        return;
      }

      const startTime = Date.now();
      const interval = 120;

      const check = () => {
        const el = findVisible();
        if (el) {
          resolve(el);
          return;
        }

        if (Date.now() - startTime >= timeoutMs) {
          // Timeout reached, return null (popover will center as modal fallback)
          resolve(null);
          return;
        }

        this.waitingTimer = setTimeout(check, interval);
      };

      this.waitingTimer = setTimeout(check, interval);
    });
  }

  /**
   * Check if element is displayed and in viewport
   */
  isElementVisible(el) {
    if (!el || !el.isConnected) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    // Viewport bounds check: reject off-canvas or clipped-out elements
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= vw || rect.top >= vh) {
      return false;
    }

    // On mobile (<= 900px), reject elements covered under bottom sheet
    if (window.innerWidth <= 900) {
      const popover = document.getElementById('worktreeTourPopover');
      const bottomSheetTop = popover && popover.getBoundingClientRect().height > 0
        ? popover.getBoundingClientRect().top
        : (vh - 240);
      if (rect.top >= bottomSheetTop) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create backdrop and spotlight DOM nodes
   */
  createBackdrop() {
    this.removeBackdrop();

    const backdrop = document.createElement('div');
    backdrop.className = 'worktree-tour-backdrop';
    backdrop.id = 'worktreeTourBackdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.addEventListener('click', (e) => {
      // Don't close immediately on backdrop click to prevent accidental dismissal
      e.stopPropagation();
    });

    const spotlight = document.createElement('div');
    spotlight.className = 'worktree-tour-spotlight';
    spotlight.id = 'worktreeTourSpotlight';

    document.body.appendChild(backdrop);
    document.body.appendChild(spotlight);

    this.backdropEl = backdrop;
    this.spotlightEl = spotlight;
  }

  removeBackdrop() {
    if (this.highlightedTarget) {
      this.highlightedTarget.removeAttribute('data-tour-target-highlight');
      this.highlightedTarget = null;
    }
    document.querySelectorAll('[data-tour-target-highlight]').forEach(el => el.removeAttribute('data-tour-target-highlight'));

    if (this.backdropEl) {
      this.backdropEl.remove();
      this.backdropEl = null;
    }
    if (this.spotlightEl) {
      this.spotlightEl.remove();
      this.spotlightEl = null;
    }
    document.querySelectorAll('.worktree-tour-backdrop, .worktree-tour-spotlight').forEach(el => el.remove());
  }

  /**
   * Ensure target element is fully visible in its parent scrollable container or window
   * @param {HTMLElement} target
   */
  ensureTargetVisible(target) {
    if (!target || !target.isConnected) return;

    if (window.innerWidth <= 900) {
      const rect = target.getBoundingClientRect();
      const vh = window.innerHeight;
      const popover = document.getElementById('worktreeTourPopover');
      const maxBottom = popover && popover.getBoundingClientRect().height > 0
        ? popover.getBoundingClientRect().top
        : (vh - 240);
      if (rect.top >= 0 && rect.bottom <= maxBottom) {
        return; // Already comfortably visible in viewable area above bottom sheet
      }
      target.scrollIntoView({ behavior: 'auto', block: 'nearest' });
      return;
    }

    // Check if target is inside a scroll container like .side-scroll or .content
    const scrollContainer = target.closest('.side-scroll, .content, main');
    if (scrollContainer) {
      const cRect = scrollContainer.getBoundingClientRect();
      const tRect = target.getBoundingClientRect();

      // Check if target is clipped vertically by the scroll container
      if (tRect.top < cRect.top || tRect.bottom > cRect.bottom) {
        const scrollDelta = tRect.top - cRect.top - 16;
        scrollContainer.scrollTop += scrollDelta;
      }
    } else {
      // If target is in the sidebar but ABOVE .side-scroll (e.g. workspace-switch or new-task-btn),
      // ensure .side-scroll is reset to top so it's not scrolled down awkwardly.
      const sideScroll = document.querySelector('.side-scroll');
      if (sideScroll && target.closest('.sidebar') && !target.closest('.side-footer')) {
        sideScroll.scrollTop = 0;
      }

      // Check window viewport bounds
      const rect = target.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        target.scrollIntoView({ behavior: 'auto', block: 'nearest' });
      }
    }
  }

  /**
   * Update spotlight box over target (using fixed viewport coordinates)
   */
  updateSpotlight(target) {
    if (!this.spotlightEl) return;

    if (this.highlightedTarget && this.highlightedTarget !== target) {
      this.highlightedTarget.removeAttribute('data-tour-target-highlight');
      this.highlightedTarget = null;
    }

    if (!target || !this.isElementVisible(target)) {
      this.spotlightEl.classList.remove('is-active');
      return;
    }

    this.ensureTargetVisible(target);

    const rect = target.getBoundingClientRect();
    const padding = 6;

    // Double check rect validity after ensureTargetVisible
    if (rect.width <= 0 || rect.height <= 0 || rect.right <= 0 || rect.bottom <= 0) {
      this.spotlightEl.classList.remove('is-active');
      return;
    }

    // Viewport coordinates for position: fixed
    this.spotlightEl.style.position = 'fixed';
    this.spotlightEl.style.top = `${Math.max(0, rect.top - padding)}px`;
    this.spotlightEl.style.left = `${Math.max(0, rect.left - padding)}px`;
    this.spotlightEl.style.width = `${rect.width + padding * 2}px`;
    this.spotlightEl.style.height = `${rect.height + padding * 2}px`;
    this.spotlightEl.classList.add('is-active');

    target.setAttribute('data-tour-target-highlight', 'true');
    this.highlightedTarget = target;
  }

  /**
   * Render popover card / mobile sheet
   */
  renderPopover(step, target) {
    if (this.popoverEl) {
      this.popoverEl.remove();
      this.popoverEl = null;
    }

    const isMobile = window.innerWidth <= 900;
    const totalSteps = this.activeTour.steps.length;
    const currentStepNum = this.currentStepIndex + 1;
    const isFirstStep = this.currentStepIndex === 0;
    const isLastStep = this.currentStepIndex === totalSteps - 1;

    const popover = document.createElement('div');
    popover.className = `worktree-tour-popover ${isMobile ? 'worktree-tour-popover--mobile' : ''}`;
    popover.id = 'worktreeTourPopover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', step.title);
    popover.setAttribute('tabindex', '-1');

    // Safe escaping
    const escapeHTML = (str) => {
      const p = document.createElement('p');
      p.textContent = str || '';
      return p.innerHTML;
    };

    const actionText = step.actionLabel || step.actionButtonText;
    const descText = step.body || step.description || '';

    popover.innerHTML = `
      <div class="worktree-tour-card">
        <div class="worktree-tour-header">
          <div class="worktree-tour-step-badge">
            Bước ${currentStepNum}/${totalSteps}
          </div>
          <button type="button" class="worktree-tour-close-btn" id="tourCloseBtn" aria-label="Đóng hướng dẫn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="worktree-tour-body">
          <h3 class="worktree-tour-title">${escapeHTML(step.title)}</h3>
          <p class="worktree-tour-desc">${escapeHTML(descText)}</p>
          ${!target && (step.targetSelector || step.targetKey) && !actionText ? `<div class="worktree-tour-target-note">Mẹo: Mục này đang ở màn hình khác hoặc thanh điều hướng. Bạn có thể bấm Tiếp tục để xem bước sau.</div>` : ''}
        </div>

        ${isMobile ? `
          <div class="worktree-tour-footer worktree-tour-footer--mobile">
            ${actionText ? `
              <div class="worktree-tour-action-wrap">
                <button type="button" class="worktree-btn-action" id="tourActionBtn">
                  ${escapeHTML(actionText)}
                </button>
              </div>
            ` : ''}
            <div class="worktree-tour-nav-row">
              <div class="worktree-tour-footer-left">
                <button type="button" class="worktree-btn-subtle" id="tourSkipBtn">Bỏ qua</button>
              </div>
              <div class="worktree-tour-footer-right">
                ${!isFirstStep ? `<button type="button" class="worktree-btn-ghost" id="tourPrevBtn">Quay lại</button>` : ''}
                <button type="button" class="worktree-btn-primary" id="tourNextBtn">
                  ${isLastStep ? 'Hoàn tất' : 'Tiếp tục'}
                </button>
              </div>
            </div>
          </div>
        ` : `
          <div class="worktree-tour-footer">
            <div class="worktree-tour-footer-left">
              <button type="button" class="worktree-btn-subtle" id="tourSkipBtn">Bỏ qua</button>
            </div>
            <div class="worktree-tour-footer-right">
              ${!isFirstStep ? `<button type="button" class="worktree-btn-ghost" id="tourPrevBtn">Quay lại</button>` : ''}
              ${actionText ? `
                <button type="button" class="worktree-btn-action" id="tourActionBtn">
                  ${escapeHTML(actionText)}
                </button>
              ` : ''}
              <button type="button" class="worktree-btn-primary" id="tourNextBtn">
                ${isLastStep ? 'Hoàn tất' : 'Tiếp tục'}
              </button>
            </div>
          </div>
        `}
      </div>
    `;

    document.body.appendChild(popover);
    this.popoverEl = popover;

    // Attach button listeners
    popover.querySelector('#tourCloseBtn')?.addEventListener('click', () => this.skipTour());
    popover.querySelector('#tourSkipBtn')?.addEventListener('click', () => this.skipTour());
    popover.querySelector('#tourPrevBtn')?.addEventListener('click', () => this.prevStep());
    popover.querySelector('#tourNextBtn')?.addEventListener('click', () => this.nextStep());

    if (actionText) {
      popover.querySelector('#tourActionBtn')?.addEventListener('click', () => {
        this.handleStepAction(step);
      });
    }

    // Position popover relative to target with preferred placement
    this.positionPopover(popover, target, isMobile, step.placement);

    // Focus on primary CTA for keyboard navigation
    const primaryBtn = popover.querySelector('#tourNextBtn');
    if (primaryBtn) {
      primaryBtn.focus();
    }
  }

  /**
   * Handle user action button inside a step (e.g. Open Task Modal)
   */
  handleStepAction(step) {
    if (!step) return;

    const actionName = step.actionName || step.id;
    if (actionName === 'open-new-task' || step.id === 'owner-create-task' || step.id === 'manager-assign-task' || step.id === 'new-task-btn') {
      this.endTour(false);
      // Call standard application task creation modal
      if (typeof window.openTaskModal === 'function') {
        window.openTaskModal();
      } else if (typeof window.showCreateTaskDialog === 'function') {
        window.showCreateTaskDialog();
      } else {
        const createTaskBtn = document.querySelector('[data-tour~="create-task"], [data-tour~="new-task-btn"], #newTaskBtn, .btn-new-task, .side-create');
        if (createTaskBtn) createTaskBtn.click();
      }
    } else if (actionName === 'open-add-member' || step.id === 'owner-add-member' || step.id === 'access-nav') {
      this.endTour(false);
      if (typeof window.openEmployeeModal === 'function') {
        window.openEmployeeModal();
      } else if (typeof window.showAddEmployeeModal === 'function') {
        window.showAddEmployeeModal();
      } else {
        const addMemberBtn = document.querySelector('[data-tour~="add-employee"], [data-tour~="access-nav"], #accessNav, .btn-add-employee');
        if (addMemberBtn) addMemberBtn.click();
      }
    } else if (step.id === 'member-my-tasks' || step.id === 'my-tasks-nav') {
      if (typeof window.switchView === 'function') {
        window.switchView('tasks');
      }
      this.nextStep();
    } else {
      this.nextStep();
    }
  }

  /**
   * Position popover relative to target or center
   */
  positionPopover(popover, target, isMobile, preferredPlacement) {
    if (isMobile) {
      // Bottom sheet layout handled via CSS
      popover.style.position = 'fixed';
      popover.style.top = '';
      popover.style.left = '';
      popover.style.right = '';
      popover.style.bottom = '';
      popover.style.transform = '';
      return;
    }

    if (!target) {
      // Center modal fallback
      popover.style.position = 'fixed';
      popover.style.top = '50%';
      popover.style.left = '50%';
      popover.style.transform = 'translate(-50%, -50%)';
      return;
    }

    const rect = target.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const spacing = 14;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let top = 0;
    let left = 0;

    // Detect if target is in the sidebar rail
    const isInSidebar = rect.right <= 360;

    const spaceRight = viewportW - rect.right;
    const spaceBottom = viewportH - rect.bottom;
    const spaceLeft = rect.left;
    const spaceTop = rect.top;

    let placement = preferredPlacement || (isInSidebar ? 'right' : 'bottom');

    // Sidebar items always look best placed to the right if space allows
    if (isInSidebar && spaceRight >= popoverRect.width + spacing) {
      placement = 'right';
    }

    if (placement === 'right' && spaceRight >= popoverRect.width + spacing) {
      left = rect.right + spacing;
      top = Math.max(16, Math.min(rect.top, viewportH - popoverRect.height - 16));
    } else if (placement === 'bottom' && spaceBottom >= popoverRect.height + spacing) {
      top = rect.bottom + spacing;
      left = Math.max(16, Math.min(rect.left, viewportW - popoverRect.width - 16));
    } else if (placement === 'top' && spaceTop >= popoverRect.height + spacing) {
      top = rect.top - popoverRect.height - spacing;
      left = Math.max(16, Math.min(rect.left, viewportW - popoverRect.width - 16));
    } else if (placement === 'left' && spaceLeft >= popoverRect.width + spacing) {
      left = rect.left - popoverRect.width - spacing;
      top = Math.max(16, Math.min(rect.top, viewportH - popoverRect.height - 16));
    } else {
      // Fallback: choose whichever side has greatest available space
      const maxSpace = Math.max(spaceRight, spaceBottom, spaceLeft, spaceTop);
      if (maxSpace === spaceRight) {
        left = Math.min(rect.right + spacing, viewportW - popoverRect.width - 16);
        top = Math.max(16, Math.min(rect.top, viewportH - popoverRect.height - 16));
      } else if (maxSpace === spaceBottom) {
        top = Math.min(rect.bottom + spacing, viewportH - popoverRect.height - 16);
        left = Math.max(16, Math.min(rect.left, viewportW - popoverRect.width - 16));
      } else if (maxSpace === spaceLeft) {
        left = Math.max(16, rect.left - popoverRect.width - spacing);
        top = Math.max(16, Math.min(rect.top, viewportH - popoverRect.height - 16));
      } else {
        top = Math.max(16, rect.top - popoverRect.height - spacing);
        left = Math.max(16, Math.min(rect.left, viewportW - popoverRect.width - 16));
      }
    }

    // Strict boundary clamps
    left = Math.max(16, Math.min(left, viewportW - popoverRect.width - 16));
    top = Math.max(16, Math.min(top, viewportH - popoverRect.height - 16));

    popover.style.position = 'fixed';
    popover.style.top = `${Math.round(top)}px`;
    popover.style.left = `${Math.round(left)}px`;
    popover.style.transform = 'none';
  }

  /**
   * Advance to next step
   */
  async nextStep() {
    if (!this.activeTour) return;

    if (this.currentStepIndex < this.activeTour.steps.length - 1) {
      this.currentStepIndex++;
      await this.renderCurrentStep();
    } else {
      this.completeTour();
    }
  }

  /**
   * Go back to previous step
   */
  async prevStep() {
    if (!this.activeTour) return;

    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      await this.renderCurrentStep();
    }
  }

  /**
   * Complete the tour
   */
  async completeTour() {
    if (!this.activeTour) return;

    const journeyId = this.activeTour.id;
    try {
      await OnboardingService.markTourCompleted(journeyId);
    } catch (err) {
      console.warn('[TourController] Error marking tour completed:', err);
    }

    this.endTour(true);

    // After tour completion, notify user gently with a brief toast
    if (typeof window.showToast === 'function') {
      window.showToast('Bạn đã hoàn tất chuyến tham quan WorkTree!', 'success');
    }
  }

  /**
   * Skip / dismiss tour
   */
  async skipTour() {
    if (!this.activeTour) return;

    const journeyId = this.activeTour.id;
    try {
      await OnboardingService.dismissTour(journeyId);
    } catch (err) {
      console.warn('[TourController] Error dismissing tour:', err);
    }

    this.endTour(false);
  }

  /**
   * End tour and cleanup resources
   */
  endTour(isCompleted = false) {
    if (this.waitingTimer) {
      clearTimeout(this.waitingTimer);
      this.waitingTimer = null;
    }
    if (this.scrollRepositionTimer) {
      clearTimeout(this.scrollRepositionTimer);
      this.scrollRepositionTimer = null;
    }

    if (this.highlightedTarget) {
      this.highlightedTarget.removeAttribute('data-tour-target-highlight');
      this.highlightedTarget = null;
    }
    document.querySelectorAll('[data-tour-target-highlight]').forEach(el => el.removeAttribute('data-tour-target-highlight'));

    this.unbindGlobalEvents();
    this.removeBackdrop();

    if (this.popoverEl) {
      this.popoverEl.remove();
      this.popoverEl = null;
    }

    if (this.activeTour) {
      PopupCoordinator.releaseTourLock();
      this.activeTour = null;
    }

    this.currentStepIndex = 0;
    this.targetElement = null;
  }

  /**
   * Global listeners for keyboard Escape, window resize, and capture scroll
   */
  bindGlobalEvents() {
    this.unbindGlobalEvents();

    this.keydownListener = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.skipTour();
      }
    };
    window.addEventListener('keydown', this.keydownListener, true);

    this.resizeListener = () => {
      if (this.activeTour && this.popoverEl) {
        const isMobile = window.innerWidth <= 900;
        const currentStep = this.activeTour.steps[this.currentStepIndex];
        this.positionPopover(this.popoverEl, this.targetElement, isMobile, currentStep?.placement);
        this.updateSpotlight(this.targetElement);
      }
    };
    window.addEventListener('resize', this.resizeListener, { passive: true });

    // Capture scroll on any container (such as .side-scroll or .content)
    this.scrollListener = () => {
      if (this.activeTour && this.targetElement && this.popoverEl) {
        const isMobile = window.innerWidth <= 900;
        this.updateSpotlight(this.targetElement);
        const currentStep = this.activeTour.steps[this.currentStepIndex];
        this.positionPopover(this.popoverEl, this.targetElement, isMobile, currentStep?.placement);
      }
    };
    window.addEventListener('scroll', this.scrollListener, { capture: true, passive: true });
  }

  unbindGlobalEvents() {
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener, true);
      this.keydownListener = null;
    }
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
      this.resizeListener = null;
    }
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener, { capture: true });
      this.scrollListener = null;
    }
  }
}

export const TourController = new TourControllerImpl();
