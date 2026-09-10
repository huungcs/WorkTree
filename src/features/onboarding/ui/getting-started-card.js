// src/features/onboarding/ui/getting-started-card.js
// Getting Started Checklist Card rendered on Overview / Dashboard.
// Evaluates real business milestones, displays progress bar, collapsible & dismissible.

import { OnboardingService } from '../services/onboarding-service.js';
import { TourController } from './tour-controller.js';
import { getJourneyForRole } from '../config/journeys.js';

export class GettingStartedCard {
  /**
   * Render the checklist card into the target container (e.g. Overview container)
   * @param {HTMLElement} container
   * @param {Object} context - { user, organization, role, appState }
   */
  static async render(container, context = {}) {
    if (!container) return;

    // Check if user has explicitly hidden the card
    const isDismissed = OnboardingService.isCardDismissed();
    if (isDismissed) {
      // Remove any existing card
      const existing = container.querySelector('#worktreeGettingStartedCard');
      if (existing) existing.remove();
      return;
    }

    const role = (context.role || 'member').toLowerCase();
    const journey = getJourneyForRole(role);
    if (!journey) return;

    // Evaluate real business milestones
    const checklistItems = await OnboardingService.evaluateChecklist(journey.id, context);
    if (!checklistItems || checklistItems.length === 0) return;

    const completedCount = checklistItems.filter(item => item.completed).length;
    const totalCount = checklistItems.length;
    const percentage = Math.round((completedCount / totalCount) * 100);

    // If 100% completed, don't show or show congrats badge
    if (completedCount === totalCount) {
      // Mark as completed in cloud
      OnboardingService.saveChecklistMilestones(checklistItems.map(i => i.id)).catch(() => {});
    }

    // Build or update card DOM
    let card = container.querySelector('#worktreeGettingStartedCard');
    if (!card) {
      card = document.createElement('div');
      card.id = 'worktreeGettingStartedCard';
      card.className = 'worktree-getting-started-card';
      container.prepend(card);
    }

    const escapeHTML = (str) => {
      const p = document.createElement('p');
      p.textContent = str || '';
      return p.innerHTML;
    };

    const isCollapsed = localStorage.getItem('worktree_checklist_collapsed') === 'true';

    card.innerHTML = `
      <div class="worktree-checklist-header">
        <div class="worktree-checklist-title-group">
          <div class="worktree-checklist-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div>
            <h3 class="worktree-checklist-title">Bắt đầu với WorkTree</h3>
            <p class="worktree-checklist-subtitle">
              ${completedCount === totalCount 
                ? 'Tuyệt vời! Bạn đã hoàn thành các bước thiết lập cơ bản.'
                : `Hoàn thành ${completedCount}/${totalCount} bước để làm quen không gian làm việc.`}
            </p>
          </div>
        </div>

        <div class="worktree-checklist-header-actions">
          <button type="button" class="worktree-checklist-btn-toggle" id="checklistToggleBtn" aria-label="Thu gọn hoặc mở rộng danh sách">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="${isCollapsed ? '6 9 12 15 18 9' : '18 15 12 9 6 15'}"></polyline>
            </svg>
          </button>
          <button type="button" class="worktree-checklist-btn-hide" id="checklistDismissBtn" aria-label="Ẩn danh sách gợi ý" title="Ẩn thẻ này (có thể mở lại từ mục Trợ giúp)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <div class="worktree-checklist-progress-bar">
        <div class="worktree-checklist-progress-fill" style="width: ${percentage}%"></div>
      </div>

      <div class="worktree-checklist-content ${isCollapsed ? 'is-collapsed' : ''}" id="checklistContent">
        <div class="worktree-checklist-items">
          ${checklistItems.map((item, idx) => `
            <div class="worktree-checklist-item ${item.completed ? 'is-completed' : ''}" data-step-id="${escapeHTML(item.id)}">
              <div class="worktree-checklist-item-check">
                ${item.completed ? `
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                ` : `
                  <span class="worktree-checklist-item-num">${idx + 1}</span>
                `}
              </div>
              <div class="worktree-checklist-item-info">
                <div class="worktree-checklist-item-title">${escapeHTML(item.title)}</div>
                <div class="worktree-checklist-item-desc">${escapeHTML(item.description)}</div>
                ${item.note ? `<div class="worktree-checklist-item-note">${escapeHTML(item.note)}</div>` : ''}
              </div>
              <div class="worktree-checklist-item-action">
                ${!item.completed && item.actionText ? `
                  <button type="button" class="worktree-checklist-action-btn" data-action="${escapeHTML(item.actionType || '')}">
                    ${escapeHTML(item.actionText)}
                  </button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>

        <div class="worktree-checklist-footer">
          <button type="button" class="worktree-checklist-tour-btn" id="startTourFromCardBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polygon points="10 8 16 12 10 16 10 8"></polygon>
            </svg>
            <span>Xem lại chuyến tham quan giao diện</span>
          </button>
        </div>
      </div>
    `;

    // Event listeners
    const toggleBtn = card.querySelector('#checklistToggleBtn');
    const dismissBtn = card.querySelector('#checklistDismissBtn');
    const contentEl = card.querySelector('#checklistContent');
    const tourBtn = card.querySelector('#startTourFromCardBtn');

    toggleBtn?.addEventListener('click', () => {
      const currentlyCollapsed = contentEl.classList.contains('is-collapsed');
      if (currentlyCollapsed) {
        contentEl.classList.remove('is-collapsed');
        localStorage.setItem('worktree_checklist_collapsed', 'false');
        toggleBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        `;
      } else {
        contentEl.classList.add('is-collapsed');
        localStorage.setItem('worktree_checklist_collapsed', 'true');
        toggleBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        `;
      }
    });

    dismissBtn?.addEventListener('click', async () => {
      card.remove();
      await OnboardingService.dismissCard();
      if (typeof window.showToast === 'function') {
        window.showToast('Đã ẩn danh sách hướng dẫn. Bạn có thể mở lại từ mục Trợ giúp.', 'info');
      }
    });

    tourBtn?.addEventListener('click', () => {
      TourController.startTour(journey.id, context, 0);
    });

    // Action buttons inside checklist items
    card.querySelectorAll('.worktree-checklist-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const actionType = e.currentTarget.getAttribute('data-action');
        GettingStartedCard.handleItemAction(actionType, context);
      });
    });
  }

  /**
   * Handle user clicking action inside an item (delegates to standard handlers)
   */
  static handleItemAction(actionType, context) {
    switch (actionType) {
      case 'create-task':
        if (typeof window.openTaskModal === 'function') {
          window.openTaskModal();
        } else if (typeof window.showCreateTaskDialog === 'function') {
          window.showCreateTaskDialog();
        } else {
          document.querySelector('[data-tour="create-task"], #newTaskBtn')?.click();
        }
        break;

      case 'add-employee':
        if (typeof window.openEmployeeModal === 'function') {
          window.openEmployeeModal();
        } else if (typeof window.showAddEmployeeModal === 'function') {
          window.showAddEmployeeModal();
        } else {
          document.querySelector('[data-tour="add-employee"], #addEmployeeBtn')?.click();
        }
        break;

      case 'create-node':
        // Highlight organization tree or click add node
        if (typeof window.showAddNodeModal === 'function') {
          window.showAddNodeModal();
        } else {
          document.querySelector('button[data-action="new-node"], #addNodeBtn, [data-tour="org-tree"]')?.click();
        }
        break;

      case 'my-tasks':
        if (typeof window.switchView === 'function') {
          window.switchView('tasks');
        } else {
          document.querySelector('[data-tour="my-tasks"], [data-view="tasks"]')?.click();
        }
        break;

      case 'pins':
        if (typeof window.switchView === 'function') {
          window.switchView('tasks');
        }
        // Scroll to or highlight pins bar
        const pinsEl = document.querySelector('[data-tour="pins"], .pins-container, #pinsBar');
        if (pinsEl) {
          pinsEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        break;

      default:
        // Default start tour
        const role = (context.role || 'member').toLowerCase();
        const journey = getJourneyForRole(role);
        if (journey) {
          TourController.startTour(journey.id, context, 0);
        }
        break;
    }
  }
}
