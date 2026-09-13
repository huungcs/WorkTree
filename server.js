const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

const SUPABASE_CONFIG = {
  url: 'https://taupjuaficdzdgbmxmbe.supabase.co',
  publishableKey: 'sb_publishable_U_sRQahpts_YouuXX5xbJQ_wpohAq4t'
};

const ZALO_BOT_CONFIG = {
  botId: '222577520227790268',
  defaultToken: '222577520227790268:zSIpDnuimIoojigHUyVHSlTINITBDPlypQdDUkARgQGSgHtChgODYgMwHDrkPLUJ',
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
    console.error('[ZaloBot] Send message error:', err.message);
    return { ok: false, error: err.message };
  }
}

async function handleZaloEvent(event) {
  if (!event) return null;
  const chatId = event?.chat_id ||
    event?.sender?.id ||
    event?.message?.chat?.id ||
    event?.message?.from?.id;

  if (!chatId) return null;

  const rawText = event?.message?.text || event?.text || event?.message?.body || '';
  const text = String(rawText).trim();
  const displayName = event?.sender?.display_name || event?.message?.from?.display_name || event?.display_name || '';

  const phoneMatch = text.match(/(?:\+?84|0)[3|5|7|8|9][0-9]{8}/);
  if (phoneMatch) {
    const rawPhone = phoneMatch[0];
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
      await sendZaloMessage(chatId, successMsg);
      return { handled: true, success: true, employee: pairResult };
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
      await sendZaloMessage(chatId, notFoundMsg);
      return { handled: true, success: false, error: pairResult?.message };
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
  await sendZaloMessage(chatId, welcomeMsg);
  return { handled: true, isGreeting: true };
}

function handleZaloApi(req, res, reqPath) {
  const token = process.env.ZALO_BOT_TOKEN || ZALO_BOT_CONFIG.defaultToken;

  if (reqPath === '/api/zalo/webhook' && req.method === 'POST') {
    let bodyStr = '';
    req.on('data', chunk => { bodyStr += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(bodyStr || '{}');
        const result = await handleZaloEvent(payload);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, result }));
      } catch (err) {
        console.error('[Zalo Webhook Error]', err);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  if (reqPath === '/api/zalo/webhook-info' && req.method === 'GET') {
    (async () => {
      try {
        const info = await fetch(`${ZALO_BOT_CONFIG.apiBase}/bot${token}/getWebhookInfo`).then(r => r.json());
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(info));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    })();
    return;
  }

  if (reqPath === '/api/zalo/set-webhook' && req.method === 'POST') {
    let bodyStr = '';
    req.on('data', chunk => { bodyStr += chunk; });
    req.on('end', async () => {
      try {
        const { url } = JSON.parse(bodyStr || '{}');
        const setRes = await fetch(`${ZALO_BOT_CONFIG.apiBase}/bot${token}/setWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        }).then(r => r.json());
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(setRes));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  if (reqPath === '/api/zalo/delete-webhook' && req.method === 'POST') {
    (async () => {
      try {
        const delRes = await fetch(`${ZALO_BOT_CONFIG.apiBase}/bot${token}/deleteWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        }).then(r => r.json());
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(delRes));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    })();
    return;
  }

  if (reqPath === '/api/zalo/get-updates' && req.method === 'GET') {
    (async () => {
      try {
        const updates = await fetch(`${ZALO_BOT_CONFIG.apiBase}/bot${token}/getUpdates`).then(r => r.json());
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(updates));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    })();
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'Endpoint not found' }));
}

function createServer({ publicDir = PUBLIC_DIR } = {}) {
  return http.createServer((req, res) => {
  let reqPath;

  try {
    reqPath = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('400 Bad Request');
    return;
  }

  if (reqPath.startsWith('/api/zalo/')) {
    handleZaloApi(req, res, reqPath);
    return;
  }

  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const relativeRequestPath = reqPath.replace(/^[/\\]+/, '');
  const filePath = path.resolve(publicDir, relativeRequestPath);
  const relativeFilePath = path.relative(publicDir, filePath);

  // Security check: ensure within root
  if (
    relativeFilePath === '..' ||
    relativeFilePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeFilePath)
  ) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`WorkTree X server is running at: http://localhost:${PORT}`);
    console.log(`Standalone version at: http://localhost:${PORT}/WorkTree.html`);
  });
}

module.exports = { createServer };
