// src/features/onboarding/ui/contextual-popover.js
// Contextual help triggers and popover manager.
// Accessible via click/touch/keyboard, manages single-instance exclusivity.

import { CONTEXTUAL_HELP_TOPICS } from '../config/contextual-help.js';

class ContextualPopoverManagerImpl {
  constructor() {
    this.activePopover = null;
    this.activeTrigger = null;
    this.outsideClickListener = null;
    this.escapeListener = null;
  }

  /**
   * Initialize contextual triggers in the DOM
   */
  initTriggers(root = document) {
    const triggerButtons = root.querySelectorAll('[data-contextual-help]');
    triggerButtons.forEach(btn => {
      // Remove any previously bound listener to prevent duplication
      if (btn._hasContextualListener) return;
      btn._hasContextualListener = true;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const topicId = btn.getAttribute('data-contextual-help');
        this.toggle(topicId, btn);
      });

      // Keyboard support (Enter or Space)
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          const topicId = btn.getAttribute('data-contextual-help');
          this.toggle(topicId, btn);
        }
      });
    });
  }

  /**
   * Helper to create a contextual help trigger button element
   * @param {string} topicId
   * @param {string} ariaLabel
   */
  createTriggerElement(topicId, ariaLabel = 'Trợ giúp về mục này') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'worktree-contextual-trigger';
    btn.setAttribute('data-contextual-help', topicId);
    btn.setAttribute('aria-label', ariaLabel);
    btn.title = ariaLabel;
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    `;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggle(topicId, btn);
    });

    return btn;
  }

  /**
   * Toggle contextual help popover
   */
  toggle(topicId, triggerEl) {
    if (this.activePopover && this.activeTrigger === triggerEl) {
      this.close();
      return;
    }
    this.open(topicId, triggerEl);
  }

  /**
   * Open contextual popover for a specific topic
   */
  open(topicId, triggerEl) {
    this.close();

    const topic = CONTEXTUAL_HELP_TOPICS[topicId];
    if (!topic || !triggerEl) return;

    this.activeTrigger = triggerEl;

    const escapeHTML = (str) => {
      const p = document.createElement('p');
      p.textContent = str || '';
      return p.innerHTML;
    };

    const popover = document.createElement('div');
    popover.className = 'worktree-contextual-popover';
    popover.id = 'worktreeContextualPopover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', topic.title);

    // Support Top Layer via Popover API so it renders above native <dialog> (like taskDialog)
    const supportsPopover = typeof popover.showPopover === 'function';
    if (supportsPopover) {
      popover.setAttribute('popover', 'manual');
    }

    popover.innerHTML = `
      <div class="worktree-contextual-card">
        <div class="worktree-contextual-header">
          <span class="worktree-contextual-title">${escapeHTML(topic.title)}</span>
          <button type="button" class="worktree-contextual-close" id="contextualCloseBtn" aria-label="Đóng trợ giúp">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="worktree-contextual-body">
          <p class="worktree-contextual-desc">${escapeHTML(topic.description)}</p>
          ${topic.tip ? `
            <div class="worktree-contextual-tip">
              <span class="worktree-contextual-tip-label">Mẹo:</span>
              <span>${escapeHTML(topic.tip)}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // If trigger is inside an active modal dialog and Popover API is not supported,
    // append directly inside the dialog so it shares the dialog's top-layer context
    const activeDialog = triggerEl.closest('dialog[open]');
    if (!supportsPopover && activeDialog) {
      activeDialog.appendChild(popover);
      popover.style.zIndex = '10010';
    } else {
      document.body.appendChild(popover);
    }

    if (supportsPopover) {
      try {
        popover.showPopover();
      } catch (_) {}
    }

    this.activePopover = popover;

    popover.querySelector('#contextualCloseBtn')?.addEventListener('click', () => {
      this.close();
    });

    this.positionPopover(popover, triggerEl);

    // Outside click & Escape listener
    setTimeout(() => {
      this.outsideClickListener = (e) => {
        if (popover && !popover.contains(e.target) && !triggerEl.contains(e.target)) {
          this.close();
        }
      };
      document.addEventListener('click', this.outsideClickListener);

      this.escapeListener = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          this.close();
        }
      };
      document.addEventListener('keydown', this.escapeListener);
    }, 50);
  }

  /**
   * Calculate position for contextual popover
   */
  positionPopover(popover, triggerEl) {
    const rect = triggerEl.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const isMobile = window.innerWidth <= 900;

    if (isMobile) {
      // Mobile positioning: centered or clamped
      popover.style.position = 'fixed';
      popover.style.left = '16px';
      popover.style.right = '16px';
      popover.style.width = 'auto';

      if (rect.bottom + popoverRect.height + 10 < window.innerHeight) {
        popover.style.top = `${rect.bottom + 8}px`;
      } else {
        popover.style.bottom = `${Math.max(16, window.innerHeight - rect.top + 8)}px`;
      }
      return;
    }

    // Desktop positioning
    const margin = 8;
    const popoverWidth = popoverRect.width || 280;
    const popoverHeight = popoverRect.height || 140;

    let top = rect.bottom + margin;
    let left = rect.left;

    // If trigger is inside an open modal dialog, prevent overflowing the dialog's right edge
    const activeDialog = triggerEl.closest('dialog[open]');
    const dialogRect = activeDialog ? activeDialog.getBoundingClientRect() : null;

    if (dialogRect && (left + popoverWidth > dialogRect.right - 12)) {
      // Align popover's right edge with trigger or clamp to dialog's right padding
      left = Math.max(dialogRect.left + 16, rect.right - popoverWidth);
    } else if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }

    // Check bottom boundary overflow
    if (top + popoverHeight > window.innerHeight - 16) {
      top = rect.top - popoverHeight - margin;
    }

    popover.style.position = 'fixed';
    popover.style.top = `${Math.max(16, top)}px`;
    popover.style.left = `${Math.max(16, left)}px`;
  }

  /**
   * Close active contextual popover
   */
  close() {
    if (this.outsideClickListener) {
      document.removeEventListener('click', this.outsideClickListener);
      this.outsideClickListener = null;
    }
    if (this.escapeListener) {
      document.removeEventListener('keydown', this.escapeListener);
      this.escapeListener = null;
    }

    if (this.activePopover) {
      if (typeof this.activePopover.hidePopover === 'function') {
        try {
          this.activePopover.hidePopover();
        } catch (_) {}
      }
      this.activePopover.remove();
      this.activePopover = null;
    }

    if (this.activeTrigger && typeof this.activeTrigger.focus === 'function') {
      try {
        this.activeTrigger.focus();
      } catch (e) {}
    }
    this.activeTrigger = null;
  }
}

export const ContextualPopoverManager = new ContextualPopoverManagerImpl();
