// src/features/onboarding/ui/help-center-dialog.js
// "Trợ giúp & Hướng dẫn" modal dialog.
// Allows users to replay guided tours, resume progress, restore hidden checklists,
// browse contextual topics, and toggle automatic suggestions.

import { OnboardingService } from '../services/onboarding-service.js';
import { TourController } from './tour-controller.js';
import { CONTEXTUAL_HELP_TOPICS } from '../config/contextual-help.js';
import { getJourneyForRole } from '../config/journeys.js';

class HelpCenterDialogImpl {
  constructor() {
    this.modalEl = null;
    this.keyListener = null;
    this.previousActiveElement = null;
  }

  /**
   * Open Help Center dialog
   * @param {Object} context - { user, organization, role, appState }
   */
  async open(context = {}) {
    if (this.modalEl) return;

    this.previousActiveElement = document.activeElement;

    const role = (context.role || 'member').toLowerCase();
    const journey = getJourneyForRole(role);
    const isCardDismissed = OnboardingService.isCardDismissed();

    // Check cloud progress to see if there is an in-progress step
    let progress = null;
    try {
      progress = await OnboardingService.getProgress(journey.id);
    } catch (e) {}

    const hasSavedStep = progress && typeof progress.step_index === 'number' && progress.step_index > 0 && !progress.is_completed;

    const backdrop = document.createElement('div');
    backdrop.className = 'worktree-help-center-backdrop';
    backdrop.id = 'worktreeHelpCenterBackdrop';

    const modal = document.createElement('div');
    modal.className = 'worktree-help-center-dialog';
    modal.id = 'worktreeHelpCenterDialog';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'helpCenterTitle');

    const escapeHTML = (str) => {
      const p = document.createElement('p');
      p.textContent = str || '';
      return p.innerHTML;
    };

    modal.innerHTML = `
      <div class="worktree-help-center-card">
        <div class="worktree-help-center-header">
          <div class="worktree-help-center-header-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <h2 id="helpCenterTitle">Trợ giúp & Hướng dẫn</h2>
          </div>
          <button type="button" class="worktree-help-center-close" id="helpCenterCloseBtn" aria-label="Đóng bảng trợ giúp">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="worktree-help-center-body">
          <!-- Section 1: Tour Controls -->
          <div class="worktree-help-section">
            <h3 class="worktree-help-section-title">Chuyến tham quan giao diện</h3>
            <div class="worktree-help-actions-grid">
              <div class="worktree-help-action-card">
                <div class="worktree-help-action-text">
                  <div class="worktree-help-action-name">Xem lại hướng dẫn tổng quan</div>
                  <div class="worktree-help-action-desc">Khám phá các khu vực làm việc chính phù hợp với vai trò của bạn.</div>
                </div>
                <button type="button" class="worktree-btn-primary" id="replayTourBtn">Bắt đầu</button>
              </div>

              ${hasSavedStep ? `
                <div class="worktree-help-action-card">
                  <div class="worktree-help-action-text">
                    <div class="worktree-help-action-name">Tiếp tục hành trình đang dở</div>
                    <div class="worktree-help-action-desc">Trở lại bước ${(progress.step_index || 0) + 1} của chuyến tham quan trước đó.</div>
                  </div>
                  <button type="button" class="worktree-btn-secondary" id="resumeTourBtn">Tiếp tục</button>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Section 2: Getting Started Checklist Recovery -->
          <div class="worktree-help-section">
            <h3 class="worktree-help-section-title">Danh sách bắt đầu trên Tổng quan</h3>
            <div class="worktree-help-action-card">
              <div class="worktree-help-action-text">
                <div class="worktree-help-action-name">Khôi phục danh sách gợi ý</div>
                <div class="worktree-help-action-desc">
                  ${isCardDismissed 
                    ? 'Bạn đang ẩn danh sách này trên màn hình Tổng quan. Bấm để hiển thị lại.' 
                    : 'Danh sách này hiện đang hiển thị trên trang Tổng quan của bạn.'}
                </div>
              </div>
              <button type="button" class="worktree-btn-subtle" id="restoreCardBtn" ${!isCardDismissed ? 'disabled' : ''}>
                ${isCardDismissed ? 'Hiện lại danh sách' : 'Đang hiển thị'}
              </button>
            </div>
          </div>

          <!-- Section 3: Topic Guides -->
          <div class="worktree-help-section">
            <h3 class="worktree-help-section-title">Hướng dẫn theo chủ đề</h3>
            <div class="worktree-help-topics-list">
              ${Object.values(CONTEXTUAL_HELP_TOPICS).map(topic => `
                <div class="worktree-help-topic-item">
                  <div class="worktree-help-topic-header">
                    <div class="worktree-help-topic-title">${escapeHTML(topic.title)}</div>
                  </div>
                  <div class="worktree-help-topic-desc">${escapeHTML(topic.description)}</div>
                  ${topic.tip ? `
                    <div class="worktree-help-topic-tip">
                      <strong>Mẹo:</strong> ${escapeHTML(topic.tip)}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="worktree-help-center-footer">
          <div class="worktree-help-footer-status">
            <span>WorkTree Onboarding v1.0 • Vai trò: <strong>${escapeHTML(role.toUpperCase())}</strong></span>
          </div>
          <button type="button" class="worktree-btn-primary" id="helpCenterDoneBtn">Xong</button>
        </div>
      </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    this.modalEl = backdrop;

    // Button event listeners
    modal.querySelector('#helpCenterCloseBtn')?.addEventListener('click', () => this.close());
    modal.querySelector('#helpCenterDoneBtn')?.addEventListener('click', () => this.close());

    modal.querySelector('#replayTourBtn')?.addEventListener('click', () => {
      this.close();
      TourController.startTour(journey.id, context, 0);
    });

    modal.querySelector('#resumeTourBtn')?.addEventListener('click', () => {
      this.close();
      const resumeStep = progress?.step_index || 0;
      TourController.startTour(journey.id, context, resumeStep);
    });

    modal.querySelector('#restoreCardBtn')?.addEventListener('click', async () => {
      await OnboardingService.restoreCard();
      this.close();
      // Trigger re-render of overview if container exists
      const overviewContainer = document.querySelector('#overviewView, #dashboardView, .overview-container');
      if (overviewContainer && typeof window.renderOverview === 'function') {
        window.renderOverview();
      }
      if (typeof window.showToast === 'function') {
        window.showToast('Đã khôi phục danh sách Bắt đầu trên trang Tổng quan.', 'success');
      }
    });

    // Keyboard navigation (Escape)
    this.keyListener = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    };
    window.addEventListener('keydown', this.keyListener);

    modal.querySelector('#helpCenterCloseBtn')?.focus();
  }

  /**
   * Close Help Center modal
   */
  close() {
    if (this.keyListener) {
      window.removeEventListener('keydown', this.keyListener);
      this.keyListener = null;
    }

    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
    }

    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      try {
        this.previousActiveElement.focus();
      } catch (e) {}
    }
  }
}

export const HelpCenterDialog = new HelpCenterDialogImpl();
