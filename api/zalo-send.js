/**
 * WorkTree X — Cloud Zalo Bot Message Sender (Vercel Serverless Function)
 * Proxies outbound messages to Zalo Bot Platform HTTP API securely
 * to prevent browser CORS blocks and protect bot tokens.
 */

const BOT_TOKENS = [
  // Bot WorkTree X 🛎 (Active primary bot)
  '2266752785520432648:FWBqyZfsALXUJUEzYBIBPRYhgLjmQTHtbGFxGvgLoksAMBDfWkerxoAGlkvqCaQh',
  // Bot AI Assistant 1 (Backup bot)
  '222577520227790268:zSIpDnuimIoojigHUyVHSlTINITBDPlypQdDUkARgQGSgHtChgODYgMwHDrkPLUJ'
];

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const chatId = payload.chatId || payload.chat_id || payload.zaloChatId;
    const text = payload.text || payload.message;
    const parseMode = payload.parseMode || payload.parse_mode || 'markdown';
    const customToken = payload.token || process.env.ZALO_BOT_TOKEN;

    if (!chatId) {
      return res.status(400).json({ ok: false, error: 'Missing chatId' });
    }
    if (!text || !String(text).trim()) {
      return res.status(400).json({ ok: false, error: 'Missing text content' });
    }

    const tokensToTry = customToken ? [customToken, ...BOT_TOKENS] : BOT_TOKENS;
    let lastError = null;

    for (const token of tokensToTry) {
      try {
        const response = await fetch(`https://bot-api.zaloplatforms.com/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: String(chatId),
            text: String(text).trim(),
            parse_mode: parseMode
          })
        });

        const data = await response.json();
        if (data && data.ok) {
          return res.status(200).json(data);
        }
        lastError = data;
      } catch (err) {
        lastError = { ok: false, error: err.message };
      }
    }

    return res.status(502).json(lastError || { ok: false, error: 'Failed to send message via Zalo API' });
  } catch (err) {
    console.error('[zalo-send error]', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
