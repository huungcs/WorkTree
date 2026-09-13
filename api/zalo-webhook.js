/**
 * WorkTree X — Cloud Zalo Bot Webhook Handler (Vercel Serverless Function)
 * Handles incoming events from Zalo Bot Platform (or forwarded from n8n / reverse proxies).
 * Performs 1-Touch Pairing via Supabase RPC and returns automated replies.
 */

const SUPABASE_CONFIG = {
  url: process.env.SUPABASE_URL || 'https://taupjuaficdzdgbmxmbe.supabase.co',
  publishableKey: process.env.SUPABASE_ANON_KEY || 'sb_publishable_U_sRQahpts_YouuXX5xbJQ_wpohAq4t'
};

const ZALO_BOT_CONFIG = {
  botId: process.env.ZALO_BOT_ID || '2266752785520432648',
  defaultToken: process.env.ZALO_BOT_TOKEN || '2266752785520432648:FWBqyZfsALXUJUEzYBIBPRYhgLjmQTHtbGFxGvgLoksAMBDfWkerxoAGlkvqCaQh',
  apiBase: 'https://bot-api.zaloplatforms.com'
};

async function sendZaloMessage(chatId, text) {
  const token = process.env.ZALO_BOT_TOKEN || ZALO_BOT_CONFIG.defaultToken;
  try {
    const res = await fetch(`${ZALO_BOT_CONFIG.apiBase}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId),
        text: text.trim(),
        parse_mode: 'markdown'
      })
    });
    return await res.json();
  } catch (err) {
    console.error('[ZaloBot] Error sending message:', err.message);
    return { ok: false, error: err.message };
  }
}

function extractPhoneNumber(event) {
  if (!event) return null;

  // 1. Check all candidate fields
  const candidates = [
    event?.message?.text,
    event?.text,
    event?.message?.body,
    event?.message?.contact?.phone_number,
    event?.message?.contact?.phone,
    event?.message?.attachments?.[0]?.payload?.phone,
    event?.message?.attachments?.[0]?.payload?.phone_number,
    event?.message?.attachments?.[0]?.payload?.text,
    event?.message?.attachments?.[0]?.payload?.title,
    event?.message?.attachments?.[0]?.payload?.description
  ];

  for (const c of candidates) {
    if (c) {
      const clean = String(c).replace(/[\s\.\-\(\)]/g, '');
      const match = clean.match(/(?:\+?84|0)(?:3|5|7|8|9)[0-9]{8}/);
      if (match) return match[0];
    }
  }

  // 2. Global fallback search across entire event JSON
  const jsonStr = JSON.stringify(event || {});
  const cleanJson = jsonStr.replace(/[\s\.\-\(\)\"\:\,]/g, '');
  const matches = cleanJson.match(/(?:\+?84|0)(?:3|5|7|8|9)[0-9]{8}/g);
  if (matches && matches.length > 0) {
    const found = matches.find(p => !p.includes('2266752785520432648') && !p.includes('222577520227790268'));
    if (found) return found;
  }

  return null;
}

async function handleZaloEvent(event) {
  if (!event) return null;
  const chatId = event?.chat_id ||
    event?.sender?.id ||
    event?.from?.id ||
    event?.message?.chat?.id ||
    event?.message?.from?.id ||
    event?.message?.sender?.id;

  if (!chatId) {
    console.warn('[ZaloBot] Missing chatId in event:', JSON.stringify(event));
    return null;
  }

  const displayName = event?.sender?.display_name || event?.message?.from?.display_name || event?.display_name || '';
  const rawPhone = extractPhoneNumber(event);

  if (rawPhone) {
    const rpcRes = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/rpc/pair_employee_zalo_by_phone`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_CONFIG.publishableKey,
        'Authorization': `Bearer ${SUPABASE_CONFIG.publishableKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_phone: rawPhone,
        p_zalo_chat_id: String(chatId),
        p_display_name: displayName
      })
    });
    const pairResult = await rpcRes.json();

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
      const sendRes = await sendZaloMessage(chatId, successMsg);
      return { handled: true, success: true, employee: pairResult, sendRes };
    } else {
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
      const sendRes = await sendZaloMessage(chatId, notFoundMsg);
      return { handled: true, success: false, error: pairResult?.message, sendRes };
    }
  }

  // Greeting if not a phone number
  const welcomeMsg = [
    `**👋 Xin chào ${displayName || 'bạn'}!**`,
    'Tôi là **Trợ lý Thông báo Tự động** của nền tảng **WorkTree X**.',
    '━━━━━━━━━━━━━━━━━━━━━━━━━',
    '📱 **Để liên kết và nhận thông báo công việc:**',
    'Vui lòng **gửi số điện thoại** bạn đã đăng ký với công ty vào đây (ví dụ: `0912345678`).',
    '',
    'Hệ thống sẽ tự động ghép nối và kích hoạt thông báo cho bạn ngay lập tức!'
  ].join('\n');
  const sendRes = await sendZaloMessage(chatId, welcomeMsg);
  return { handled: true, isGreeting: true, sendRes };
}

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const token = process.env.ZALO_BOT_TOKEN || ZALO_BOT_CONFIG.defaultToken;
    try {
      const info = await fetch(`${ZALO_BOT_CONFIG.apiBase}/bot${token}/getWebhookInfo`).then(r => r.json());
      return res.status(200).json({
        status: 'online',
        service: 'WorkTree X Zalo Webhook Handler',
        webhookInfo: info
      });
    } catch (err) {
      return res.status(500).json({ status: 'error', error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      let payload = req.body;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch (e) { payload = { text: payload }; }
      }
      if (!payload || (typeof payload === 'object' && Object.keys(payload).length === 0)) {
        payload = await new Promise((resolve) => {
          let chunks = '';
          req.on('data', chunk => { chunks += chunk; });
          req.on('end', () => {
            try { resolve(JSON.parse(chunks || '{}')); }
            catch (e) { resolve({ text: chunks }); }
          });
          req.on('error', () => resolve({}));
        });
      }

      // Log into Supabase zalo_webhook_logs table
      try {
        await fetch(`${SUPABASE_CONFIG.url}/rest/v1/zalo_webhook_logs`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_CONFIG.publishableKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.publishableKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            headers: req.headers,
            body: payload,
            raw_body: JSON.stringify(payload)
          })
        });
      } catch (logErr) {
        console.warn('Could not log webhook:', logErr);
      }

      const result = await handleZaloEvent(payload);
      return res.status(200).json({ ok: true, result });
    } catch (err) {
      console.error('[Zalo Webhook Serverless Error]', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
