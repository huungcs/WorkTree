/**
 * WorkTree X — Popup Coordinator
 * Manages modal & overlay priority, ensuring guided tours never collide with active forms or push prompts.
 */

export const POPUP_PRIORITY = {
  CRITICAL: 1,      // Auth, Security, Confirmation dialogs
  USER_FORM: 2,     // Forms opened by user (task form, node form, drawer)
  GUIDED_TOUR: 3,   // Welcome dialog & role-aware guided tours
  BACKGROUND: 4     // Push notification prompt, PWA install prompt
};

class Coordinator {
  constructor() {
    this.activeTourId = null;
    this.tourLock = false;
    this.isTourActive = false;
    this.isWelcomeActive = false;
    this.activeDialogs = new Set();
    this.tourEndedAt = 0;
  }

  /**
   * Reset all locks and active dialog tracking (useful for testing or workspace switch)
   */
  reset() {
    this.activeTourId = null;
    this.tourLock = false;
    this.isTourActive = false;
    this.isWelcomeActive = false;
    this.activeDialogs.clear();
    this.tourEndedAt = 0;
  }

  /**
   * Register a currently active modal / form dialog
   */
  registerActiveDialog(dialogId) {
    if (dialogId) {
      this.activeDialogs.add(dialogId);
    }
  }

  /**
   * Unregister a closed modal / form dialog
   */
  unregisterActiveDialog(dialogId) {
    if (dialogId) {
      this.activeDialogs.delete(dialogId);
    }
  }

  /**
   * Kiểm tra xem màn hình có đang bận với dialog/form nào không
   */
  hasActiveUserDialog() {
    if (this.activeDialogs.size > 0) return true;

    if (typeof document !== 'undefined') {
      const openDialogs = Array.from(document.querySelectorAll('dialog[open]'));
      if (openDialogs.some(d => d.id !== 'welcomeDialog' && d.id !== 'tourCardDialog' && d.id !== 'worktreeWelcomeDialog')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Kiểm tra xem có được phép hiển thị Welcome dialog lúc này không
   */
  canShowWelcome() {
    if (this.tourLock || this.isTourActive || this.isWelcomeActive) return false;
    if (this.hasActiveUserDialog()) return false;

    // Check deep link hash
    if (typeof window !== 'undefined') {
      const hash = window.location.hash || '';
      if (hash.includes('type=recovery') || hash.includes('type=invitation')) {
        return false;
      }
    }

    return true;
  }

  /**
   * Xin quyền chạy Tour (khóa các modal background và push pre-prompt)
   */
  requestTourLock(tourId = 'default') {
    if (this.hasActiveUserDialog()) return false;
    if (this.tourLock || this.isTourActive) return false;

    this.tourLock = true;
    this.isTourActive = true;
    this.activeTourId = tourId;
    this.notifyTourStarted();
    return true;
  }

  /**
   * Giải phóng quyền sau khi kết thúc hoặc huỷ tour
   */
  releaseTourLock() {
    this.tourLock = false;
    this.isTourActive = false;
    this.activeTourId = null;
    this.notifyTourEnded();
  }

  /**
   * Kiểm tra xem có được phép hiển thị Tour lúc này không
   */
  canShowTour() {
    if (this.tourLock || this.isTourActive || this.isWelcomeActive) return false;
    if (this.hasActiveUserDialog()) return false;

    // Check deep link hash
    if (typeof window !== 'undefined') {
      const hash = window.location.hash || '';
      if (hash.includes('type=recovery') || hash.includes('type=invitation')) {
        return false;
      }
    }

    return true;
  }

  /**
   * Đăng ký khi Tour bắt đầu: tạm ẩn push prompt banner
   */
  notifyTourStarted() {
    this.tourLock = true;
    this.isTourActive = true;
    if (typeof window !== 'undefined' && window.PushDeviceService?.hideNotificationPromptBanner) {
      window.PushDeviceService.hideNotificationPromptBanner();
    }
  }

  /**
   * Đăng ký khi Tour kết thúc: đặt cooldown trước khi cho phép background prompt
   */
  notifyTourEnded() {
    this.tourLock = false;
    this.isTourActive = false;
    this.activeTourId = null;
    this.tourEndedAt = Date.now();
  }

  notifyWelcomeStarted() {
    this.isWelcomeActive = true;
    if (typeof window !== 'undefined' && window.PushDeviceService?.hideNotificationPromptBanner) {
      window.PushDeviceService.hideNotificationPromptBanner();
    }
  }

  notifyWelcomeEnded() {
    this.isWelcomeActive = false;
  }

  /**
   * Kiểm tra xem Push Pre-Prompt có cần hoãn lại vì tour / form đang mở không
   */
  shouldDeferPushPrompt() {
    if (this.tourLock || this.isTourActive || this.isWelcomeActive) return true;
    if (this.hasActiveUserDialog()) return true;
    // Cooldown 20s sau khi tour kết thúc
    if (Date.now() - this.tourEndedAt < 20000) return true;
    return false;
  }

  /**
   * Kiểm tra xem Push Prompt có được phép hiển thị hay không (phải sau cooldown)
   */
  canShowPushPrompt() {
    return !this.shouldDeferPushPrompt();
  }
}

export const PopupCoordinator = new Coordinator();
