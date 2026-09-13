#!/usr/bin/env node
/**
 * WorkTree X — Zalo Bot Listener & CLI Helper
 * Supports polling mode, webhook management, status checks, and pairing tests.
 * 
 * Usage:
 *   node scripts/run-zalo-bot-listener.js --info
 *   node scripts/run-zalo-bot-listener.js --poll
 *   node scripts/run-zalo-bot-listener.js --test-phone 0912345678
 *   node scripts/run-zalo-bot-listener.js --set-webhook https://your-domain.com/api/zalo/webhook
 *   node scripts/run-zalo-bot-listener.js --delete-webhook
 */

const SUPABASE_CONFIG = {
  url: 'https://taupjuaficdzdgbmxmbe.supabase.co',
  publishableKey: 'sb_publishable_U_sRQahpts_YouuXX5xbJQ_wpohAq4t'
};

const ZALO_BOT_CONFIG = {
  botId: '2266752785520432648',
  defaultToken: '2266752785520432648:FWBqyZfsALXUJUEzYBIBPRYhgLjmQTHtbGFxGvgLoksAMBDfWkerxoAGlkvqCaQh',
  apiBase: 'https://bot-api.zaloplatforms.com'
};

const token = process.env.ZALO_BOT_TOKEN || ZALO_BOT_CONFIG.defaultToken;

async function api(method, path, body = null) {
  const url = `${ZALO_BOT_CONFIG.apiBase}/bot${token}/${path}`;
  const opts = { method, headers: {} };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  return await res.json();
}

async function sendMessage(chatId, text) {
  return await api('POST', 'sendMessage', {
    chat_id: String(chatId),
    text: text.trim(),
    parse_mode: 'markdown'
  });
}

async function pairEmployeePhone(phone, chatId, displayName = '') {
  const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/rpc/pair_employee_zalo_by_phone`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_CONFIG.publishableKey,
      'Authorization': `Bearer ${SUPABASE_CONFIG.publishableKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      p_phone: phone,
      p_zalo_chat_id: String(chatId),
      p_display_name: displayName
    })
  });
  return await res.json();
}

async function handleMessage(event) {
  const chatId = event?.chat_id ||
    event?.sender?.id ||
    event?.message?.chat?.id ||
    event?.message?.from?.id;

  if (!chatId) return null;

  const rawText = event?.message?.text || event?.text || '';
  const text = String(rawText).trim();
  const displayName = event?.sender?.display_name || event?.message?.from?.display_name || '';

  console.log(`[Zalo Listener] Nhận tin nhắn từ [${chatId}] (${displayName}): "${text}"`);

  const phoneMatch = text.match(/(?:\+?84|0)[3|5|7|8|9][0-9]{8}/);
  if (phoneMatch) {
    const rawPhone = phoneMatch[0];
    console.log(`[Zalo Listener] Phát hiện số điện thoại: ${rawPhone}. Đang gọi ghép nối RPC...`);
    const result = await pairEmployeePhone(rawPhone, chatId, displayName);

    if (result && result.success) {
      console.log(`[Zalo Listener] Ghép nối THÀNH CÔNG cho: ${result.full_name} (${result.organization_name})`);
      const successMsg = [
        '**🎉 LIÊN KẾT THÀNH CÔNG!**',
        '━━━━━━━━━━━━━━━━━━━━━━━━━',
        `Xin chào **${result.full_name}**,`,
        `Tài khoản Zalo của bạn đã được liên kết thành công với **${result.organization_name}** trên hệ thống **WorkTree X**.`,
        '',
        '✅ Từ bây giờ, bạn sẽ tự động nhận được thông báo khi:',
        '• Được giao công việc mới',
        '• Nhắc nhở hạn hoàn thành (Deadline)',
        '• Có người bình luận hoặc nhắc tên bạn',
        '━━━━━━━━━━━━━━━━━━━━━━━━━',
        'Chúc bạn một ngày làm việc hiệu quả! 🚀'
      ].join('\n');
      await sendMessage(chatId, successMsg);
      return result;
    } else {
      console.log(`[Zalo Listener] Không tìm thấy nhân viên với SĐT: ${rawPhone}`);
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
      await sendMessage(chatId, notFoundMsg);
      return result;
    }
  }

  // Welcome / Greeting
  const welcomeMsg = [
    `**👋 Xin chào ${displayName || 'bạn'}!**`,
    'Tôi là **Trợ lý Thông báo Tự động** của nền tảng **WorkTree X**.',
    '━━━━━━━━━━━━━━━━━━━━━━━━━',
    '📱 **Để liên kết và nhận thông báo công việc:**',
    'Vui lòng **gửi số điện thoại** bạn đã đăng ký với công ty vào đây (ví dụ: `0912345678`).',
    '',
    'Hệ thống sẽ tự động ghép nối và kích hoạt thông báo cho bạn ngay lập tức!'
  ].join('\n');
  await sendMessage(chatId, welcomeMsg);
  return { isGreeting: true };
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || '--info';

  if (mode === '--info') {
    console.log('=== WORKTREE X ZALO BOT STATUS ===');
    const me = await api('GET', 'getMe');
    console.log('Bot Profile:', me);
    const webhook = await api('GET', 'getWebhookInfo');
    console.log('Webhook Status:', webhook);
    console.log('\nCommands:');
    console.log('  --poll           : Start long-polling listener (auto-removes webhook)');
    console.log('  --set-webhook <url> : Set webhook URL');
    console.log('  --delete-webhook : Delete active webhook to use getUpdates');
    console.log('  --test-phone <sđt>: Test pairing logic against Supabase');
    return;
  }

  if (mode === '--delete-webhook') {
    const res = await api('POST', 'deleteWebhook', {});
    console.log('deleteWebhook result:', res);
    return;
  }

  if (mode === '--set-webhook') {
    const url = args[1];
    if (!url) {
      console.error('Thiếu URL webhook! Ví dụ: --set-webhook https://domain.com/api/zalo/webhook');
      return;
    }
    const res = await api('POST', 'setWebhook', { url });
    console.log('setWebhook result:', res);
    return;
  }

  if (mode === '--test-phone') {
    const phone = args[1];
    if (!phone) {
      console.error('Thiếu số điện thoại! Ví dụ: --test-phone 0912345678');
      return;
    }
    console.log(`Đang kiểm tra ghép nối số: ${phone}...`);
    const res = await pairEmployeePhone(phone, 'test_chat_id_cli', 'Người dùng Test CLI');
    console.log('Kết quả RPC Supabase:', res);
    return;
  }

  if (mode === '--poll') {
    console.log('Starting polling mode. Checking webhook status...');
    const hookInfo = await api('GET', 'getWebhookInfo');
    if (hookInfo?.result?.url) {
      console.log(`Phát hiện webhook đang bật: ${hookInfo.result.url}`);
      console.log('Gỡ webhook để kích hoạt getUpdates polling...');
      await api('POST', 'deleteWebhook', {});
    }

    console.log('>>> Zalo Bot Polling Listener is running! Nhấn Ctrl+C để dừng.\n');
    let lastUpdateId = 0;

    while (true) {
      try {
        const query = lastUpdateId ? `?offset=${lastUpdateId + 1}&timeout=20` : '?timeout=20';
        const res = await api('GET', `getUpdates${query}`);

        if (res && res.ok && Array.isArray(res.result)) {
          for (const update of res.result) {
            if (update.update_id) lastUpdateId = update.update_id;
            await handleMessage(update);
          }
        }
      } catch (err) {
        console.error('[Polling Error]', err.message);
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  console.log('Không nhận diện được lệnh. Chạy --info để xem hướng dẫn.');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = {
  handleMessage,
  pairEmployeePhone,
  sendMessage
};
