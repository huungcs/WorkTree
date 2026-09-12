/**
 * WorkTree X Feature: Push Device Service
 * Handles PWA Push Device Registration, OneSignal Web SDK coordination,
 * and device token lifecycle synchronization with Supabase public.push_devices.
 */

import { getSupabase } from '../../../lib/supabase/client.js';

let isInitialized = false;
let currentAppId = null;
let initializationPromise = null;
let oneSignalSdk = null;

export const PushDeviceService = {
  /**
   * Kiểm tra xem trình duyệt và môi trường hiện tại có hỗ trợ Web Push & PWA không.
   */
  isPushSupported() {
    return typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
  },

  /**
   * Lấy trạng thái quyền thông báo của trình duyệt: 'granted' | 'denied' | 'default'
   */
  getPermissionState() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  },

  /**
   * Khởi tạo OneSignal Web SDK v16+
   * Không hardcode API key. Chỉ dùng publishable App ID.
   */
  async initOneSignal(appId = '252025b0-77e3-42c4-81f4-fcdb37f5925a') {
    if (!this.isPushSupported()) {
      console.info('[Push] Trình duyệt không hỗ trợ Web Push hoặc Service Worker.');
      return false;
    }

    if (isInitialized && currentAppId === appId) {
      return true;
    }
    if (initializationPromise && currentAppId === appId) {
      return initializationPromise;
    }

    currentAppId = appId;

    try {
      window.OneSignalDeferred = window.OneSignalDeferred || [];

      initializationPromise = new Promise((resolve) => {
        let settled = false;
        const finish = (result) => {
          if (settled) return;
          settled = true;
          resolve(result);
        };

        window.OneSignalDeferred.push(async function (OneSignal) {
          try {
            await OneSignal.init({
              appId: appId,
              allowLocalhostAsSecureOrigin: true,
              notifyButton: {
                enable: false // We use our custom UI
              },
              promptOptions: {
                slidedown: {
                  prompts: []
                }
              },
              serviceWorkerParam: {
                scope: '/'
              },
              serviceWorkerPath: 'OneSignalSDKWorker.js'
            });

            isInitialized = true;
            oneSignalSdk = OneSignal;
            console.info('[Push] OneSignal SDK khởi tạo thành công.');

            // Setup observer to intercept any OneSignal prompt rendering
            PushDeviceService.setupOneSignalPromptObserver();

            // Listen to subscription change
            OneSignal.User.PushSubscription.addEventListener('change', async (event) => {
              console.info('[Push] Trạng thái subscription thay đổi:', event.current);
              if (event.current.optedIn && event.current.id) {
                await PushDeviceService.syncCurrentDevice();
              }
            });

            finish(true);
          } catch (initErr) {
            const isDomainMismatch = String(initErr?.message || initErr).includes('Can only be used on');
            if (isDomainMismatch) {
              console.info('[Push] OneSignal được giới hạn bảo mật theo domain sản xuất (https://worktree.nguyentronghuu.com). Bỏ qua trên localhost.');
            } else {
              console.warn('[Push] Lỗi khởi tạo OneSignal:', initErr);
            }
            finish(false);
          }
        });

        // Tải script OneSignal nếu chưa có
        if (!document.getElementById('onesignal-sdk')) {
          const script = document.createElement('script');
          script.id = 'onesignal-sdk';
          script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
          script.defer = true;
          script.addEventListener('error', () => finish(false), { once: true });
          document.head.appendChild(script);
        }

        setTimeout(() => finish(false), 15000);
      });

      const initialized = await initializationPromise;
      if (!initialized) initializationPromise = null;
      return initialized;
    } catch (err) {
      initializationPromise = null;
      console.warn('[Push] Không thể nạp OneSignal SDK:', err);
      return false;
    }
  },

  /**
   * Đồng bộ tài khoản người dùng đăng nhập với OneSignal (External ID)
   */
  async loginUser(userId) {
    if (!userId) return false;
    try {
      const initialized = isInitialized || await this.initOneSignal();
      if (!initialized || !oneSignalSdk || typeof oneSignalSdk.login !== 'function') return false;

      await oneSignalSdk.login(userId);
      console.info('[Push] Đã liên kết tài khoản với OneSignal:', userId);
      await this.syncCurrentDevice();
      return true;
    } catch (err) {
      console.warn('[Push] OneSignal.login error:', err);
      return false;
    }
  },

  /**
   * Đăng xuất OneSignal khi người dùng đăng xuất WorkTree X
   */
  async logoutUser() {
    if (!isInitialized || !oneSignalSdk) return;
    try {
      if (typeof oneSignalSdk.logout !== 'function') return;
      await oneSignalSdk.logout();
      console.info('[Push] Đã hủy liên kết tài khoản OneSignal.');
    } catch (err) {
      console.warn('[Push] Lỗi logoutUser:', err);
    }
  },

  /**
   * Yêu cầu người dùng cấp quyền thông báo đẩy Web Push
   */
  async requestPermission() {
    if (!this.isPushSupported()) return false;

    try {
      // 1. Luôn kích hoạt native browser Notification.requestPermission() trực tiếp
      // để trình duyệt hiển thị hộp thoại cấp quyền ngay lập tức, không bị nghẽn bởi OneSignal SDK
      let permResult = Notification.permission;
      if (permResult === 'default') {
        permResult = await Promise.race([
          Notification.requestPermission(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Notification permission timeout')), 15000))
        ]);
      }

      const granted = permResult === 'granted';

      if (granted) {
        const initialized = isInitialized || await this.initOneSignal();

        // 2. Kích hoạt optIn ngầm trên OneSignal (tuyệt đối không mở UI popup của OneSignal)
        if (initialized && oneSignalSdk?.User?.PushSubscription?.optIn) {
          try {
            await Promise.race([
              oneSignalSdk.User.PushSubscription.optIn(),
              new Promise(res => setTimeout(res, 2500))
            ]);
          } catch (e) {
            console.warn('[Push] OneSignal optIn note:', e);
          }
        }

        // 3. Đồng bộ thiết bị vào Supabase trong nền (timeout 3.5s)
        Promise.race([
          this.syncCurrentDevice(),
          new Promise(res => setTimeout(res, 3500))
        ]).catch(syncErr => console.warn('[Push] Background sync error:', syncErr));
      }

      return granted;
    } catch (err) {
      console.warn('[Push] Lỗi requestPermission:', err);
      return Notification.permission === 'granted';
    }
  },

  /**
   * Đăng ký thiết bị hiện tại vào bảng public.push_devices qua RPC register_push_device
   */
  async syncCurrentDevice() {
    try {
      const sb = await getSupabase();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return null;

      const subscription = oneSignalSdk?.User?.PushSubscription;
      const subscriptionId = subscription?.id || null;
      if (!subscriptionId || subscription?.optedIn !== true) {
        console.info('[Push] Chưa có OneSignal Subscription ID đang opt-in; chưa đăng ký thiết bị.');
        return null;
      }

      const deviceType = /iPhone|iPad|iPod/i.test(navigator.userAgent)
        ? 'ios'
        : /Android/i.test(navigator.userAgent)
        ? 'android'
        : 'web';

      const { data, error } = await sb.rpc('register_push_device', {
        p_subscription_id: subscriptionId,
        p_platform: deviceType,
        p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        p_device_label: 'Web Browser'
      });

      if (error) {
        console.warn('[Push] Lỗi khi lưu push_device:', error.message);
        return null;
      }

      console.info('[Push] Thiết bị đã được ghi nhận vào Supabase Cloud:', subscriptionId);
      return data;
    } catch (err) {
      console.warn('[Push] Lỗi syncCurrentDevice:', err);
      return null;
    }
  },

  /**
   * Hủy kích hoạt thiết bị hiện tại
   */
  async unregisterDevice(playerId = null) {
    try {
      const sb = await getSupabase();
      const targetId = playerId || oneSignalSdk?.User?.PushSubscription?.id;
      if (!targetId) return;

      await sb.rpc('unregister_push_device', {
        p_subscription_id: targetId
      });
      console.info('[Push] Đã hủy kích hoạt thiết bị:', targetId);
    } catch (err) {
      console.warn('[Push] Lỗi unregisterDevice:', err);
    }
  },

  /**
   * Giám sát DOM để triệt tiêu OneSignal prompt nếu SDK tự động chèn vào giao diện.
   */
  setupOneSignalPromptObserver() {
    if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;

    try {
      const observer = new MutationObserver(() => {
        const container = document.getElementById('onesignal-slidedown-container') || document.querySelector('.onesignal-slidedown-container');
        if (container) {
          container.remove();
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    } catch (obsErr) {
      console.warn('[Push] setupOneSignalPromptObserver error:', obsErr);
    }
  },

  /**
   * Hiển thị card thông báo đẩy WorkTree X tinh tế, chuẩn Design System.
   * Chỉ hiển thị khi:
   * - Quyền hiện tại là 'default' (chưa hỏi hoặc chưa bị chặn)
   * - Đã qua cooldown (mặc định 3 ngày sau khi bấm 'Để sau')
   */
  showNotificationPromptBanner(force = false) {
    if (!this.isPushSupported()) return;
    if (this.getPermissionState() !== 'default') return;

    const lastDismissed = localStorage.getItem('wtx_push_prompt_dismissed_at');
    const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 ngày
    if (!force && lastDismissed && (Date.now() - parseInt(lastDismissed, 10) < COOLDOWN_MS)) {
      return;
    }

    if (
      document.getElementById('wtxPushPrompt') ||
      document.getElementById('worktreeTourPopover') ||
      document.getElementById('worktreeTourWelcome') ||
      document.querySelector('.worktree-tour-modal') ||
      window.WorkTreeTour?.activeTour
    ) {
      return;
    }

    const banner = document.createElement('aside');
    banner.id = 'wtxPushPrompt';
    banner.className = 'wtx-push-prompt';
    banner.setAttribute('aria-label', 'Nhận thông báo công việc');
    banner.innerHTML = `
      <div class="wtx-prompt-header">
        <div class="wtx-prompt-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        </div>
        <div class="wtx-prompt-text">
          <h4 class="wtx-prompt-title">Bật thông báo công việc</h4>
          <p class="wtx-prompt-desc">Nhận cập nhật khi có phân công mới, nhắc việc hạn chót và trao đổi quan trọng trong nhóm.</p>
        </div>
        <button type="button" class="wtx-prompt-close" id="wtxPromptClose" aria-label="Đóng thông báo" title="Để sau">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="6"></line>
          </svg>
        </button>
      </div>
      <div class="wtx-prompt-actions">
        <button type="button" class="wtx-prompt-btn-later" id="wtxPromptLater">Để sau</button>
        <button type="button" class="wtx-prompt-btn-allow" id="wtxPromptAllow">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Bật thông báo
        </button>
      </div>
    `;

    document.body.appendChild(banner);

    const closePrompt = () => {
      banner.classList.add('closing');
      setTimeout(() => banner.remove(), 260);
    };

    const handleDismiss = () => {
      localStorage.setItem('wtx_push_prompt_dismissed_at', String(Date.now()));
      closePrompt();
    };

    const closeBtn = banner.querySelector('#wtxPromptClose');
    const laterBtn = banner.querySelector('#wtxPromptLater');
    const allowBtn = banner.querySelector('#wtxPromptAllow');

    if (closeBtn) closeBtn.onclick = handleDismiss;
    if (laterBtn) laterBtn.onclick = handleDismiss;

    if (allowBtn) {
      allowBtn.onclick = async () => {
        allowBtn.disabled = true;
        allowBtn.textContent = 'Đang kích hoạt...';
        try {
          const granted = await Promise.race([
            PushDeviceService.requestPermission(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
          ]);

          if (granted) {
            if (typeof window.toast === 'function') {
              window.toast('Đã bật thông báo đẩy thành công!');
            }
            closePrompt();
          } else {
            if (Notification.permission === 'denied' && typeof window.toast === 'function') {
              window.toast('Thông báo đang bị chặn. Bấm vào biểu tượng ổ khóa/cài đặt trên thanh địa chỉ để bật lại.');
            }
            handleDismiss();
          }
        } catch (err) {
          console.warn('[Push] Lỗi kích hoạt:', err);
          if (Notification.permission === 'granted') {
            if (typeof window.toast === 'function') {
              window.toast('Đã bật thông báo đẩy thành công!');
            }
            closePrompt();
          } else {
            // Khôi phục nút nếu trình duyệt đang chờ người dùng thao tác
            allowBtn.disabled = false;
            allowBtn.innerHTML = `
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Bật thông báo
            `;
            if (typeof window.toast === 'function') {
              window.toast('Vui lòng chọn "Cho phép" (Allow) trên hộp thoại của trình duyệt.');
            }
          }
        }
      };
    }
  }
};
