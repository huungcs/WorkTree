/**
 * WorkTree X Feature: Push Device Service
 * Handles PWA Push Device Registration, OneSignal Web SDK coordination,
 * and device token lifecycle synchronization with Supabase public.push_devices.
 */

import { getSupabase } from '../../../lib/supabase/client.js';

let isInitialized = false;
let currentAppId = null;

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

    currentAppId = appId;

    try {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      
      // Tải script OneSignal nếu chưa có
      if (!document.getElementById('onesignal-sdk')) {
        const script = document.createElement('script');
        script.id = 'onesignal-sdk';
        script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
        script.defer = true;
        document.head.appendChild(script);
      }

      await new Promise((resolve) => {
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
                  prompts: [
                    {
                      type: 'push',
                      autoPrompt: false, // Suppress default unstyled OneSignal popup
                      text: {
                        actionMessage: 'Bật thông báo đẩy để nhận cập nhật công việc, hạn chót và trao đổi theo thời gian thực.',
                        acceptButton: 'Bật thông báo',
                        cancelButton: 'Để sau'
                      }
                    }
                  ]
                }
              },
              serviceWorkerParam: {
                scope: '/'
              },
              serviceWorkerPath: 'OneSignalSDKWorker.js'
            });

            isInitialized = true;
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

            resolve(true);
          } catch (initErr) {
            console.warn('[Push] Lỗi khởi tạo OneSignal:', initErr);
            resolve(false);
          }
        });
      });

      return isInitialized;
    } catch (err) {
      console.warn('[Push] Không thể nạp OneSignal SDK:', err);
      return false;
    }
  },

  /**
   * Đồng bộ tài khoản người dùng đăng nhập với OneSignal (External ID)
   */
  async loginUser(userId) {
    if (!userId) return;
    try {
      if (window.OneSignalDeferred) {
        window.OneSignalDeferred.push(async function (OneSignal) {
          try {
            await OneSignal.login(userId);
            console.info('[Push] Đã liên kết tài khoản với OneSignal:', userId);
            await PushDeviceService.syncCurrentDevice();
          } catch (e) {
            console.warn('[Push] OneSignal.login error:', e);
          }
        });
      }
    } catch (err) {
      console.warn('[Push] Lỗi loginUser:', err);
    }
  },

  /**
   * Đăng xuất OneSignal khi người dùng đăng xuất WorkTree X
   */
  async logoutUser() {
    try {
      if (window.OneSignalDeferred) {
        window.OneSignalDeferred.push(async function (OneSignal) {
          try {
            await OneSignal.logout();
            console.info('[Push] Đã đăng xuất OneSignal.');
          } catch (e) {
            console.warn('[Push] OneSignal.logout error:', e);
          }
        });
      }
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
      if (window.OneSignalDeferred) {
        return await new Promise((resolve) => {
          window.OneSignalDeferred.push(async function (OneSignal) {
            try {
              await OneSignal.Notifications.requestPermission();
              const granted = Notification.permission === 'granted';
              if (granted) {
                await PushDeviceService.syncCurrentDevice();
              }
              resolve(granted);
            } catch (err) {
              console.warn('[Push] Lỗi khi xin quyền OneSignal:', err);
              resolve(Notification.permission === 'granted');
            }
          });
        });
      } else {
        const result = await Notification.requestPermission();
        return result === 'granted';
      }
    } catch (err) {
      console.warn('[Push] Lỗi requestPermission:', err);
      return false;
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

      let playerId = null;
      let pushToken = null;

      if (window.OneSignal) {
        playerId = window.OneSignal.User?.PushSubscription?.id || null;
        pushToken = window.OneSignal.User?.PushSubscription?.token || null;
      }

      if (!playerId) {
        // Fallback: Generate or get a persistent local device ID if OneSignal subscription is pending
        playerId = localStorage.getItem('wtx_push_device_id');
        if (!playerId) {
          playerId = 'web-' + crypto.randomUUID();
          localStorage.setItem('wtx_push_device_id', playerId);
        }
      }

      const deviceType = /iPhone|iPad|iPod/i.test(navigator.userAgent)
        ? 'ios'
        : /Android/i.test(navigator.userAgent)
        ? 'android'
        : 'web';

      const { data, error } = await sb.rpc('register_push_device', {
        p_player_id: playerId,
        p_device_type: deviceType,
        p_push_token: pushToken
      });

      if (error) {
        console.warn('[Push] Lỗi khi lưu push_device:', error.message);
        return null;
      }

      console.info('[Push] Thiết bị đã được ghi nhận vào Supabase Cloud:', playerId);
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
      const targetId = playerId || localStorage.getItem('wtx_push_device_id') || window.OneSignal?.User?.PushSubscription?.id;
      if (!targetId) return;

      await sb.rpc('unregister_push_device', {
        p_player_id: targetId
      });
      console.info('[Push] Đã hủy kích hoạt thiết bị:', targetId);
    } catch (err) {
      console.warn('[Push] Lỗi unregisterDevice:', err);
    }
  },

  /**
   * Giám sát DOM để chặn và bản địa hóa OneSignal prompt nếu SDK tự động chèn vào giao diện.
   */
  setupOneSignalPromptObserver() {
    if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;

    try {
      const observer = new MutationObserver(() => {
        const container = document.getElementById('onesignal-slidedown-container');
        if (container) {
          const messageEl = document.getElementById('onesignal-slidedown-message');
          if (messageEl && (messageEl.textContent.includes('Subscribe to our notifications') || messageEl.textContent.includes('notifications for the latest news'))) {
            messageEl.innerHTML = '<strong style="display:block;font-size:13.5px;font-weight:650;margin-bottom:4px;color:var(--text)">Bật thông báo công việc</strong>' +
              '<span style="font-size:12px;color:var(--muted);line-height:1.45">Nhận cập nhật khi có phân công mới, nhắc việc hạn chót và trao đổi dự án theo thời gian thực.</span>';
          }

          const allowBtn = document.getElementById('onesignal-slidedown-allow-button');
          if (allowBtn && (allowBtn.textContent.trim() === 'Subscribe' || allowBtn.textContent.trim() === 'Allow')) {
            allowBtn.textContent = 'Bật thông báo';
          }

          const cancelBtn = document.getElementById('onesignal-slidedown-cancel-button');
          if (cancelBtn && (cancelBtn.textContent.trim() === 'Later' || cancelBtn.textContent.trim() === 'Cancel')) {
            cancelBtn.textContent = 'Để sau';
          }

          // Thêm nút đóng (x) tinh tế nếu OneSignal chưa có
          const dialog = document.getElementById('onesignal-slidedown-dialog');
          if (dialog && !dialog.querySelector('.onesignal-wtx-close')) {
            dialog.style.position = 'relative';
            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'onesignal-wtx-close';
            closeBtn.setAttribute('aria-label', 'Đóng');
            closeBtn.innerHTML = '&times;';
            closeBtn.style.cssText = 'position:absolute;top:10px;right:12px;background:none;border:none;color:var(--muted);font-size:20px;line-height:1;cursor:pointer;padding:4px 6px;border-radius:6px;';
            closeBtn.onmouseover = () => { closeBtn.style.color = 'var(--text)'; };
            closeBtn.onmouseout = () => { closeBtn.style.color = 'var(--muted)'; };
            closeBtn.onclick = () => {
              container.remove();
              localStorage.setItem('wtx_push_prompt_dismissed_at', String(Date.now()));
            };
            dialog.appendChild(closeBtn);
          }
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

    if (document.getElementById('wtxPushPrompt')) return;

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
          <svg viewBox="0 0 24 24" width="14" height="14">
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
          const granted = await PushDeviceService.requestPermission();
          if (granted) {
            if (typeof window.toast === 'function') {
              window.toast('Đã bật thông báo đẩy thành công!');
            }
            closePrompt();
          } else {
            handleDismiss();
          }
        } catch (err) {
          console.warn('[Push] Lỗi kích hoạt:', err);
          closePrompt();
        }
      };
    }
  }
};
