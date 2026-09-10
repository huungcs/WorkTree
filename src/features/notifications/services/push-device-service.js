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
  async initOneSignal(appId = '2ebf5317-a16f-407b-83ee-e95d8525e9e0') {
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
              serviceWorkerParam: {
                scope: '/'
              },
              serviceWorkerPath: 'OneSignalSDKWorker.js'
            });

            isInitialized = true;
            console.info('[Push] OneSignal SDK khởi tạo thành công.');

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
  }
};
