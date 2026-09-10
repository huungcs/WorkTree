// src/features/onboarding/ui/welcome-dialog.js
// Welcome Dialog for first-time users and workspace joins.
// Role-aware, accessible, skippable, and safely escapes dynamic organization names.

import { OnboardingService } from '../services/onboarding-service.js';
import { TourController } from './tour-controller.js';
import { PopupCoordinator } from './popup-coordinator.js';
import { getJourneyForRole } from '../config/journeys.js';

class WelcomeDialogImpl {
  constructor() {
    this.dialogEl = null;
    this.previousActiveElement = null;
    this.keyListener = null;
  }

  /**
   * Escape HTML utility to prevent XSS
   */
  escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  /**
   * Show Welcome Dialog if user is eligible
   * @param {Object} context - { user, organization, role }
   */
  async show(context = {}) {
    // Check if dialog is already open
    if (this.dialogEl) return;

    // Check with PopupCoordinator if safe to show
    if (!PopupCoordinator.canShowWelcome()) {
      console.log('[WelcomeDialog] Deferred showing welcome due to higher priority modal');
      return;
    }

    const role = (context.role || 'member').toLowerCase();
    const orgName = context.organization?.name || 'WorkTree';
    const journey = getJourneyForRole(role);

    // Save previous active element for accessibility focus restore
    this.previousActiveElement = document.activeElement;

    let title = 'Chào mừng đến với WorkTree';
    let description = 'Làm quen với không gian công ty và bắt đầu quản lý công việc.';
    let primaryBtnText = 'Bắt đầu hướng dẫn';
    let secondaryBtnText = 'Tự khám phá';

    if (role === 'owner' || role === 'admin') {
      title = 'Chào mừng đến với WorkTree';
      description = `Làm quen với không gian làm việc của <strong>${this.escapeHTML(orgName)}</strong> và bắt đầu thiết lập quản lý công việc hiệu quả.`;
      primaryBtnText = 'Bắt đầu hướng dẫn';
      secondaryBtnText = 'Tự khám phá';
    } else if (role === 'manager') {
      title = `Chào mừng Quản lý đến với ${this.escapeHTML(orgName)}`;
      description = 'Nắm bắt phạm vi quản lý, phân công nhiệm vụ và theo dõi tiến độ công việc của đội ngũ.';
      primaryBtnText = 'Bắt đầu hướng dẫn';
      secondaryBtnText = 'Tự khám phá';
    } else if (role === 'viewer') {
      title = `Chào mừng bạn đến với ${this.escapeHTML(orgName)}`;
      description = 'Tìm hiểu tổng quan công việc, các dự án và theo dõi tiến độ một cách minh bạch.';
      primaryBtnText = 'Xem hướng dẫn';
      secondaryBtnText = 'Để sau';
    } else {
      // Member / Employee
      title = `Chào mừng bạn đến với ${this.escapeHTML(orgName)}`;
      description = 'Tìm công việc được giao, phối hợp cùng nhóm và cập nhật tiến độ công việc hàng ngày.';
      primaryBtnText = 'Xem hướng dẫn';
      secondaryBtnText = 'Để sau';
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'worktree-welcome-backdrop';
    backdrop.id = 'worktreeWelcomeBackdrop';

    const dialog = document.createElement('div');
    dialog.className = 'worktree-welcome-dialog';
    dialog.id = 'worktreeWelcomeDialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'welcomeDialogTitle');
    dialog.setAttribute('aria-describedby', 'welcomeDialogDesc');

    dialog.innerHTML = `
      <div class="worktree-welcome-card">
        <button type="button" class="worktree-welcome-close" id="welcomeCloseBtn" aria-label="Đóng lời chào">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div class="worktree-welcome-badge">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
        </div>

        <h2 class="worktree-welcome-title" id="welcomeDialogTitle">${title}</h2>
        <div class="worktree-welcome-desc" id="welcomeDialogDesc">${description}</div>

        <div class="worktree-welcome-features">
          <div class="worktree-welcome-feature-item">
            <span class="worktree-welcome-feature-icon">✓</span>
            <span>Không gian phân cấp rõ ràng theo phòng ban & dự án</span>
          </div>
          <div class="worktree-welcome-feature-item">
            <span class="worktree-welcome-feature-icon">✓</span>
            <span>Theo dõi tiến độ trực quan với danh sách, bảng Kanban và báo cáo</span>
          </div>
          <div class="worktree-welcome-feature-item">
            <span class="worktree-welcome-feature-icon">✓</span>
            <span>Hướng dẫn chỉ mất chưa đầy 1 phút và có thể mở lại bất cứ lúc nào</span>
          </div>
        </div>

        <div class="worktree-welcome-actions">
          <button type="button" class="worktree-btn-subtle" id="welcomeSecondaryBtn">
            ${this.escapeHTML(secondaryBtnText)}
          </button>
          <button type="button" class="worktree-btn-primary" id="welcomePrimaryBtn">
            ${this.escapeHTML(primaryBtnText)}
          </button>
        </div>
      </div>
    `;

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    this.dialogEl = backdrop;

    // Button event listeners
    const closeBtn = dialog.querySelector('#welcomeCloseBtn');
    const secondaryBtn = dialog.querySelector('#welcomeSecondaryBtn');
    const primaryBtn = dialog.querySelector('#welcomePrimaryBtn');

    const handleDismiss = async () => {
      this.close();
      try {
        await OnboardingService.dismissTour(journey.id);
      } catch (err) {
        console.warn('[WelcomeDialog] Dismiss error:', err);
      }
    };

    closeBtn?.addEventListener('click', handleDismiss);
    secondaryBtn?.addEventListener('click', handleDismiss);

    primaryBtn?.addEventListener('click', async () => {
      this.close();
      // Start the corresponding role tour
      await TourController.startTour(journey.id, context, 0);
    });

    // Keyboard navigation (Escape & Tab trap)
    this.keyListener = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleDismiss();
      }
    };
    window.addEventListener('keydown', this.keyListener);

    // Initial focus on primary CTA
    primaryBtn?.focus();
  }

  /**
   * Close dialog and cleanup listeners
   */
  close() {
    if (this.keyListener) {
      window.removeEventListener('keydown', this.keyListener);
      this.keyListener = null;
    }

    if (this.dialogEl) {
      this.dialogEl.remove();
      this.dialogEl = null;
    }

    // Restore focus
    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      try {
        this.previousActiveElement.focus();
      } catch (e) {}
    }
  }
}

export const WelcomeDialog = new WelcomeDialogImpl();
