/**
 * WorkTree X Feature: Zalo Bot Integration Service
 * Connects to Zalo Bot Platform (bot.zapps.me / zalo.me/s/botcreator/)
 * Handles 1-touch pairing by phone number and automated rich-text task notifications.
 */

import { getSupabase } from '../../../lib/supabase/client.js';

export const ZALO_BOT_CONFIG = {
  BOT_ID: '2266752785520432648',
  BOT_ACCOUNT_NAME: 'bot.vdxOmKTr',
  BOT_NAME: 'Bot WorkTree X 🛎',
  DEFAULT_TOKEN: '2266752785520432648:FWBqyZfsALXUJUEzYBIBPRYhgLjmQTHtbGFxGvgLoksAMBDfWkerxoAGlkvqCaQh',
  API_BASE: 'https://bot-api.zaloplatforms.com',
  MINI_APP_URL: 'https://zalo.me/s/botcreator/',
  BOT_LINK: 'https://zalo.me/3771437682242262538'
};

export const ZaloBotService = {
  getToken() {
    // In server environment or runtime config, can use env or fallback
    if (typeof process !== 'undefined' && process.env && process.env.ZALO_BOT_TOKEN) {
      return process.env.ZALO_BOT_TOKEN;
    }
    return ZALO_BOT_CONFIG.DEFAULT_TOKEN;
  },

  /**
   * Send a raw text or markdown message via Zalo Bot API
   */
  async sendMessage(chatId, text, options = {}) {
    if (!chatId) throw new Error('Thiếu chatId người nhận');
    if (!text || !text.trim()) throw new Error('Nội dung tin nhắn không được rỗng');

    const token = options.token || this.getToken();
    const payload = {
      chatId: String(chatId),
      text: text.trim(),
      parse_mode: options.parse_mode || 'markdown',
      token
    };

    // If running in browser environment, use same-origin proxy to bypass CORS
    if (typeof window !== 'undefined') {
      try {
        const proxyRes = await fetch('/api/zalo-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (proxyRes.ok) {
          const data = await proxyRes.json();
          if (data && data.ok) return data;
        }
      } catch (proxyErr) {
        console.warn('[ZaloBotService] Proxy /api/zalo-send failed, falling back to direct:', proxyErr);
      }
    }

    // Direct fallback (e.g. Node server / CLI)
    const url = `${ZALO_BOT_CONFIG.API_BASE}/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: String(chatId),
        text: text.trim(),
        parse_mode: options.parse_mode || 'markdown'
      })
    });

    const data = await response.json();
    return data;
  },

  /**
   * Format and send a rich task notification to an employee's linked Zalo
   */
  async sendTaskNotification({
    zaloChatId,
    taskTitle,
    nodeName = 'Toàn công ty',
    dueDate = null,
    priority = 'Trung bình',
    assignerName = 'Quản lý',
    taskId = null
  }) {
    if (!zaloChatId) {
      return { ok: false, description: 'Nhân viên chưa liên kết tài khoản Zalo' };
    }

    const priorityBadge = priority === 'Khẩn cấp' ? '🔴 Khẩn cấp'
      : priority === 'Cao' ? '🟠 Cao'
      : priority === 'Thấp' ? '⚪ Thấp'
      : '🔵 Trung bình';

    const formattedDue = dueDate ? dueDate : 'Chưa đặt hạn chót';

    const message = [
      '**📌 WORKTREE X — CÔNG VIỆC MỚI ĐƯỢC GIAO**',
      '━━━━━━━━━━━━━━━━━━━━━━━━━',
      `📋 **Công việc:** ${taskTitle}`,
      `🏢 **Đơn vị:** ${nodeName}`,
      `⚡ **Mức ưu tiên:** ${priorityBadge}`,
      `⏰ **Hạn hoàn thành:** ${formattedDue}`,
      `👤 **Người giao việc:** ${assignerName}`,
      '━━━━━━━━━━━━━━━━━━━━━━━━━',
      '👉 **Mở WorkTree X để xem chi tiết & cập nhật tiến độ:**',
      'https://worktree.nguyentronghuu.com'
    ].join('\n');

    return await this.sendMessage(zaloChatId, message, { parse_mode: 'markdown' });
  },

  /**
   * Format and send a notification when a task's status changes
   */
  async sendStatusNotification({
    zaloChatId,
    taskTitle,
    nodeName = 'Toàn công ty',
    oldStatus = null,
    newStatus = 'Đang làm',
    updaterName = 'Đồng đội',
    taskId = null
  }) {
    if (!zaloChatId) {
      return { ok: false, description: 'Chưa liên kết Zalo' };
    }

    const statusBadge = newStatus === 'Hoàn thành' ? '🟢 Hoàn thành'
      : newStatus === 'Chờ duyệt' ? '🟠 Chờ duyệt'
      : newStatus === 'Đang làm' ? '🟡 Đang làm'
      : '🔵 Chưa làm';

    const statusChangeText = oldStatus && oldStatus !== newStatus
      ? `${oldStatus} ➔ ${statusBadge}`
      : statusBadge;

    const message = [
      '**🔄 WORKTREE X — CẬP NHẬT TRẠNG THÁI CÔNG VIỆC**',
      '━━━━━━━━━━━━━━━━━━━━━━━━━',
      `📋 **Công việc:** ${taskTitle}`,
      `🏢 **Đơn vị:** ${nodeName}`,
      `📊 **Trạng thái:** ${statusChangeText}`,
      `👤 **Người thực hiện:** ${updaterName}`,
      '━━━━━━━━━━━━━━━━━━━━━━━━━',
      '👉 **Mở WorkTree X để xem chi tiết:**',
      'https://worktree.nguyentronghuu.com'
    ].join('\n');

    return await this.sendMessage(zaloChatId, message, { parse_mode: 'markdown' });
  },

  /**
   * Format and send a reminder for an upcoming or overdue task
   */
  async sendReminderNotification({
    zaloChatId,
    taskTitle,
    dueDate,
    isOverdue = false
  }) {
    if (!zaloChatId) return { ok: false, description: 'Chưa liên kết Zalo' };

    const header = isOverdue
      ? '**⚠️ CẢNH BÁO: CÔNG VIỆC QUÁ HẠN TRÊN WORKTREE X**'
      : '**⏰ NHẮC NHỞ: CÔNG VIỆC SẮP ĐẾN HẠN**';

    const message = [
      header,
      '━━━━━━━━━━━━━━━━━━━━━━━━━',
      `📋 **Công việc:** ${taskTitle}`,
      `📅 **Hạn chót:** ${dueDate || 'Hôm nay'}`,
      isOverdue ? '⚡ *Vui lòng cập nhật trạng thái hoặc liên hệ Quản lý nếu cần gia hạn.*' : '💡 *Hãy hoàn thành đúng hạn để đảm bảo tiến độ chung nhé!*',
      '━━━━━━━━━━━━━━━━━━━━━━━━━',
      '👉 https://worktree.nguyentronghuu.com'
    ].join('\n');

    return await this.sendMessage(zaloChatId, message, { parse_mode: 'markdown' });
  },

  /**
   * Get bot information
   */
  async getMe(options = {}) {
    const token = options.token || this.getToken();
    const res = await fetch(`${ZALO_BOT_CONFIG.API_BASE}/bot${token}/getMe`);
    return await res.json();
  },

  /**
   * Get current webhook info
   */
  async getWebhookInfo(options = {}) {
    const token = options.token || this.getToken();
    const res = await fetch(`${ZALO_BOT_CONFIG.API_BASE}/bot${token}/getWebhookInfo`);
    return await res.json();
  },

  /**
   * Set webhook URL for incoming messages
   */
  async setWebhook(webhookUrl, options = {}) {
    if (!webhookUrl) throw new Error('Thiếu URL webhook');
    const token = options.token || this.getToken();
    const res = await fetch(`${ZALO_BOT_CONFIG.API_BASE}/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    });
    return await res.json();
  },

  /**
   * Remove webhook to enable getUpdates polling
   */
  async deleteWebhook(options = {}) {
    const token = options.token || this.getToken();
    const res = await fetch(`${ZALO_BOT_CONFIG.API_BASE}/bot${token}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    return await res.json();
  },

  /**
   * Long-poll or get latest updates if webhook is not set
   */
  async getUpdates(options = {}) {
    const token = options.token || this.getToken();
    const params = new URLSearchParams();
    if (options.offset) params.append('offset', options.offset);
    if (options.limit) params.append('limit', options.limit);
    if (options.timeout) params.append('timeout', options.timeout);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${ZALO_BOT_CONFIG.API_BASE}/bot${token}/getUpdates${query}`);
    return await res.json();
  },

  /**
   * Process incoming webhook or polling message from Zalo user.
   * Handles 1-touch pairing when employee texts their phone number.
   * Tolerates diverse event payload schemas from Zalo Bot API / n8n / webhooks.
   */
  async processIncomingMessage(eventData, customSupabase = null) {
    if (!eventData) return null;

    // Normalize sender / chat ID across different webhook shapes
    const chatId = eventData?.chat_id ||
      eventData?.sender?.id ||
      eventData?.message?.chat?.id ||
      eventData?.message?.from?.id;

    if (!chatId) return null;

    // Normalize message text
    const rawText = eventData?.message?.text ||
      eventData?.text ||
      eventData?.message?.body ||
      '';
    const text = String(rawText).trim();

    // Normalize sender display name
    const displayName = eventData?.sender?.display_name ||
      eventData?.message?.from?.display_name ||
      eventData?.display_name ||
      '';

    const sb = customSupabase || (await getSupabase());

    // 1. Extract phone number (tolerates spaces, dashes, contact cards, etc.)
    let rawPhone = null;
    const cleanText = text.replace(/[\s\.\-\(\)]/g, '');
    const textMatch = cleanText.match(/(?:\+?84|0)(?:3|5|7|8|9)[0-9]{8}/);
    if (textMatch) {
      rawPhone = textMatch[0];
    } else {
      const contactPhone = eventData?.message?.contact?.phone_number ||
        eventData?.message?.contact?.phone ||
        eventData?.message?.attachments?.[0]?.payload?.phone ||
        eventData?.message?.attachments?.[0]?.payload?.phone_number ||
        eventData?.message?.attachments?.[0]?.payload?.text;
      if (contactPhone) {
        const contactMatch = String(contactPhone).replace(/[\s\.\-\(\)]/g, '').match(/(?:\+?84|0)(?:3|5|7|8|9)[0-9]{8}/);
        if (contactMatch) rawPhone = contactMatch[0];
      }
      if (!rawPhone) {
        const jsonStr = JSON.stringify(eventData || {});
        const allPhones = jsonStr.replace(/[\s\.\-\(\)]/g, '').match(/(?:\+?84|0)(?:3|5|7|8|9)[0-9]{8}/g);
        if (allPhones && allPhones.length > 0) {
          rawPhone = allPhones.find(p => !p.includes('2266752785520432648') && !p.includes('222577520227790268')) || allPhones[0];
        }
      }
    }

    if (rawPhone) {
      try {
        // Call security definer RPC function to pair
        const { data: pairResult, error: rpcError } = await sb.rpc('pair_employee_zalo_by_phone', {
          p_phone: rawPhone,
          p_zalo_chat_id: String(chatId),
          p_display_name: displayName
        });

        if (rpcError) {
          console.error('[ZaloBot] RPC error pairing:', rpcError);
          await this.sendMessage(
            chatId,
            `**❌ LỖI HỆ THỐNG**\nKhông thể hoàn tất liên kết lúc này: ${rpcError.message}`
          );
          return { handled: true, success: false, error: rpcError };
        }

        if (pairResult && pairResult.success) {
          const successMsg = [
            '**🎉 LIÊN KẾT THÀNH CÔNG!**',
            '━━━━━━━━━━━━━━━━━━━━━━━━━',
            `Xin chào **${pairResult.full_name}**,`,
            `Tài khoản Zalo của bạn đã được liên kết thành công với **${pairResult.organization_name}** trên hệ thống **WorkTree X**.`,
            '',
            '✅ Từ bây giờ, bạn sẽ tự động nhận được thông báo khi:',
            '• Được giao công việc mới',
            '• Nhắc nhở hạn hoàn thành (Deadline)',
            '• Có người bình luận hoặc nhắc tên bạn',
            '━━━━━━━━━━━━━━━━━━━━━━━━━',
            'Chúc bạn một ngày làm việc hiệu quả! 🚀'
          ].join('\n');

          await this.sendMessage(chatId, successMsg);
          return { handled: true, success: true, employee: pairResult };
        } else {
          // Not found or invalid
          const notFoundMsg = [
            '**⚠️ CHƯA TÌM THẤY THÔNG TIN NHÂN VIÊN**',
            '━━━━━━━━━━━━━━━━━━━━━━━━━',
            `Số điện thoại \`${rawPhone}\` chưa được đăng ký trong danh bạ nhân sự của **WorkTree X**.`,
            '',
            '💡 **Cách xử lý:**',
            '1. Kiểm tra lại xem bạn có gõ nhầm số điện thoại không.',
            '2. Nhờ Quản trị viên công ty cập nhật số điện thoại này vào mục **Hồ sơ nhân viên** trên WorkTree X.',
            '3. Sau đó quay lại đây nhắn lại số điện thoại để liên kết nhé!'
          ].join('\n');

          await this.sendMessage(chatId, notFoundMsg);
          return { handled: true, success: false, error: pairResult?.message };
        }
      } catch (err) {
        console.error('[ZaloBot] Unexpected error in pairing:', err);
        return { handled: true, success: false, error: err.message };
      }
    }

    // 2. Help / Greeting response if not phone number
    const welcomeMsg = [
      `**👋 Xin chào ${displayName || 'bạn'}!**`,
      'Tôi là **Trợ lý Thông báo Tự động** của nền tảng **WorkTree X**.',
      '━━━━━━━━━━━━━━━━━━━━━━━━━',
      '📱 **Để liên kết và nhận thông báo công việc:**',
      'Vui lòng **gửi số điện thoại** bạn đã đăng ký với công ty vào đây (ví dụ: `0912345678`).',
      '',
      'Hệ thống sẽ tự động ghép nối và kích hoạt thông báo cho bạn ngay lập tức!'
    ].join('\n');

    await this.sendMessage(chatId, welcomeMsg);
    return { handled: true, isGreeting: true };
  }
};
