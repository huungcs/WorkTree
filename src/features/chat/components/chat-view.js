import { ICONS } from '../../../design-system/icons.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const initials = name => String(name || '?').trim().split(/\s+/).slice(-2).map(part => part[0]).join('').toUpperCase();
const fold = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
const time = date => new Intl.DateTimeFormat('vi', { hour: '2-digit', minute: '2-digit' }).format(new Date(date));
const icon = name => ICONS[name] || ICONS.messageSquare;
function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
function avatar(name, tone = 'purple', group = false, extra = '', portrait = null, photoUrl = null) {
  const color = ['purple', 'blue', 'green', 'amber'].includes(tone) ? tone : 'purple';
  const portraitClass = Number.isInteger(portrait) && portrait >= 0 && portrait < 6 ? `chat-portrait chat-portrait-${portrait}` : '';
  const photo = photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="" class="chat-avatar-photo">` : '';
  return `<span class="chat-avatar chat-tone-${color} ${group ? 'is-group' : ''} ${extra}" aria-hidden="true">${group ? icon('users') : escapeHtml(initials(name))}<span class="${portraitClass}" aria-hidden="true"></span>${photo}</span>`;
}
const iconButton = (action, label, iconName, extra = '') => `<button type="button" class="icon-btn chat-icon-button" data-chat-action="${action}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" ${extra}>${icon(iconName)}</button>`;

/** Tenant context and adapter are injected; this feature never imports app state. */
export function mountChatFeature({ host, getContext, subscribeContext = () => () => {}, createAdapter, standalone = false, onCloseSidebar = () => {}, taskBridge = null, aiBridge = null }) {
  let context;
  let adapter;
  let abortController;
  let unsubscribeAdapter;
  let active = false;
  let disposed = false;
  let listRequest = 0;
  let detailRequest = 0;
  let refreshRequest = 0;
  let conversations = [];
  let selectedId = null;
  let current = null;
  let participants = [];
  let messages = [];
  let filter = 'all';
  let query = '';
  let nextMessagesCursor = null;
  let hasOlder = false;
  let replyTo = null;
  let infoOpen = false;
  let searchOpen = false;
  let messageQuery = '';
  let sending = false;
  let dialogMode;
  let dialogPeople = [];
  let selectedPeople = new Set();
  let modalTrigger;
  let refreshQueued = false;
  let localAvatarUrl = null;
  let profileAvatarUrl = null;
  let avatarRequest = 0;
  let pendingAttachments = [];
  let uploadingAttachment = false;
  const drafts = new Map();
  const failed = new Map();
  const taskSources = new Map();
  const events = new AbortController();

  host.classList.add('chat-page');
  host.setAttribute('aria-label', 'Tin nhắn');
  host.innerHTML = `
    <p class="sr-only" id="chatPreviewDetails">Dữ liệu minh họa. Tin nhắn và nhóm chỉ lưu trong phiên này.</p>
    <div class="chat-workbench">
      <aside class="chat-inbox" aria-label="Danh sách hội thoại">
        <div class="chat-inbox-heading">
          <h1>Cuộc trò chuyện <span data-chat-total></span></h1>
          <div class="chat-inbox-actions">
            ${iconButton('new-message', 'Tin nhắn mới', 'edit', 'aria-haspopup="dialog"')}
            ${iconButton('create-group', 'Tạo nhóm', 'plus', 'aria-haspopup="dialog"')}
          </div>
        </div>
        <label class="chat-search">${icon('search')}<input type="search" data-chat-search placeholder="Tìm người, nhóm trò chuyện..." aria-label="Tìm hội thoại" autocomplete="off"></label>
        <div class="chat-filters" role="group" aria-label="Lọc hội thoại">${[['all', 'Tất cả'], ['unread', 'Chưa đọc'], ['groups', 'Nhóm']].map(([key, label]) => `<button type="button" data-chat-filter="${key}" aria-pressed="${key === filter}">${label}<span data-filter-count="${key}"></span></button>`).join('')}</div>
        <div class="chat-conversation-list" data-chat-list></div>
        <div class="chat-inbox-meta">
          <span class="chat-preview-label" title="Tin nhắn và nhóm chỉ lưu trong phiên này">Bản xem trước</span>
          <button type="button" class="icon-btn chat-icon-button chat-avatar-picker" data-chat-action="choose-avatar" aria-label="Đổi ảnh đại diện" title="Đổi ảnh đại diện"></button>
          <input type="file" data-chat-avatar-file accept="image/png,image/jpeg,image/webp" hidden>
        </div>
      </aside>
      <section class="chat-thread" aria-label="Nội dung hội thoại" data-chat-thread></section>
      <button type="button" class="chat-info-scrim" data-chat-action="close-info" aria-label="Đóng thông tin hội thoại" hidden></button>
      <aside class="chat-info" aria-label="Thông tin hội thoại" data-chat-info hidden></aside>
    </div>
    <p class="chat-feedback" role="status" aria-live="polite" data-chat-feedback></p>`;
  const $ = selector => host.querySelector(selector);
  const list = $('[data-chat-list]');
  const thread = $('[data-chat-thread]');
  const info = $('[data-chat-info]');
  const workbench = $('.chat-workbench');
  const dialog = document.createElement('dialog');
  dialog.className = 'dialog chat-dialog';
  dialog.setAttribute('aria-labelledby', 'chatDialogTitle');
  document.body.append(dialog);
  const live = $('[data-chat-feedback]');
  let noticeTimer;
  function notice(text, error = false) {
    clearTimeout(noticeTimer);
    live.textContent = text; live.classList.toggle('is-error', error);
    noticeTimer = setTimeout(() => { live.textContent = ''; }, 5000);
  }
  function empty(title, text, action = '', actionLabel = '', large = false) {
    return `<div class="chat-empty ${large ? 'chat-empty-large' : ''}"><span class="chat-empty-icon">${icon('messageSquare')}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p>${action ? `<button type="button" class="btn ${large ? 'primary' : ''}" data-chat-action="${action}">${escapeHtml(actionLabel)}</button>` : ''}</div>`;
  }
  function skeleton() { return `<div class="chat-skeleton" role="status" aria-label="Đang tải hội thoại">${[1, 2, 3, 4].map(() => '<div><i></i><span><b></b><b></b></span></div>').join('')}</div>`; }
  function valid(captured) { return !disposed && captured === context && !captured?.signal?.aborted; }
  function draftKey(id = selectedId) { return `${context?.organizationId}:${context?.userId}:${id}`; }
  function getDraft() { return drafts.get(draftKey()) || ''; }
  function renderOwnAvatar() {
    const button = $('[data-chat-action="choose-avatar"]');
    button.hidden = adapter?.isPreview !== true;
    button.innerHTML = avatar(context?.displayName, 'purple', false, '', null, localAvatarUrl || profileAvatarUrl);
    const previewLabel = $('.chat-preview-label');
    if (previewLabel) {
      const isPrev = !adapter || adapter.isPreview === true;
      previewLabel.textContent = isPrev ? 'Bản xem trước' : 'Lưu trữ đám mây';
      previewLabel.title = isPrev ? 'Tin nhắn và nhóm chỉ lưu trong phiên này' : 'Tin nhắn được đồng bộ bảo mật qua Supabase';
    }
    const detailsSr = $('#chatPreviewDetails');
    if (detailsSr) {
      detailsSr.textContent = (!adapter || adapter.isPreview === true)
        ? 'Dữ liệu minh họa. Tin nhắn và nhóm chỉ lưu trong phiên này.'
        : 'Tin nhắn nội bộ được đồng bộ theo doanh nghiệp qua Supabase.';
    }
  }

  function clearOwnAvatar() {
    ++avatarRequest;
    if (localAvatarUrl) URL.revokeObjectURL(localAvatarUrl);
    localAvatarUrl = null;
    $('[data-chat-avatar-file]').value = '';
  }

  async function chooseOwnAvatar(file) {
    if (!file || !active || adapter?.isPreview !== true) return;
    const request = ++avatarRequest;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      notice('Chọn ảnh JPG, PNG hoặc WebP tối đa 5 MB.', true);
      return;
    }

    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (disposed || request !== avatarRequest) {
        URL.revokeObjectURL(url);
        return;
      }
    } catch {
      URL.revokeObjectURL(url);
      if (request === avatarRequest) notice('Không đọc được ảnh. Bạn thử chọn tệp khác nhé.', true);
      return;
    }

    if (localAvatarUrl) URL.revokeObjectURL(localAvatarUrl);
    localAvatarUrl = url;
    renderOwnAvatar();
    renderMessages();
    if (infoOpen) renderInfo();
    notice('Đã đổi ảnh đại diện trong phiên xem trước.');
  }
  function setRoute(id) {
    if (standalone) return;
    const hash = id ? `#messages/${encodeURIComponent(id)}` : '#messages';
    if (location.hash !== hash) window.history.replaceState(null, '', location.pathname + location.search + hash);
  }
  function updateNavigation() {
    if (active) for (const button of document.querySelectorAll('#mobileNav [aria-current]')) button.removeAttribute('aria-current');
    for (const button of document.querySelectorAll('[data-chat-open], [data-mobile="messages"]')) {
      button.toggleAttribute('aria-current', active);
      if (active) button.setAttribute('aria-current', 'page');
      const badge = button.querySelector('[data-chat-unread]');
      if (badge) { const total = conversations.filter(c => c.unreadCount > 0).length; badge.textContent = String(total); badge.hidden = !total; }
    }
  }
  function setActive(value) {
    active = value;
    host.hidden = !value;
    document.body.classList.toggle('chat-is-open', value);
    if (!value) document.body.classList.remove('chat-conversation-open');
    if (!standalone) {
      const main = document.getElementById('mainContent');
      if (main) main.hidden = value;
    }
    updateNavigation(); updateViewport();
  }
  async function refreshList() {
    if (!adapter) return;
    const captured = context;
    const request = ++listRequest;
    try {
      // Filter locally within the list returned to this preview session.
      const page = await adapter.listConversations(captured, {});
      if (!valid(captured) || request !== listRequest) return;
      conversations = page.items;
      renderList(); updateNavigation();
    } catch (error) {
      if (!valid(captured) || error.name === 'AbortError') return;
      list.innerHTML = empty('Chưa tải được hội thoại', 'Vui lòng kiểm tra kết nối rồi thử lại.', 'retry-list', 'Thử lại');
    }
  }
  function renderList() {
    const shown = conversations.filter(c => (filter !== 'unread' || c.unreadCount > 0) && (filter !== 'groups' || c.type === 'group') && fold(c.title).includes(fold(query)));
    $('[data-chat-total]').textContent = conversations.length;
    for (const button of host.querySelectorAll('[data-chat-filter]')) button.setAttribute('aria-pressed', String(button.dataset.chatFilter === filter));
    $('[data-filter-count="unread"]').textContent = conversations.filter(c => c.unreadCount).length || '';
    if (!shown.length) {
      list.innerHTML = empty(query ? 'Không tìm thấy hội thoại' : filter === 'unread' ? 'Bạn đã đọc hết rồi' : 'Bắt đầu một kết nối mới', query ? 'Thử một tên khác hoặc xóa tìm kiếm.' : filter === 'unread' ? 'Những cuộc trò chuyện mới sẽ xuất hiện ở đây.' : 'Gửi lời chào đến một đồng nghiệp của bạn.', query || filter !== 'all' ? 'clear-filter' : 'new-message', query || filter !== 'all' ? 'Xem tất cả' : 'Tin nhắn mới');
      return;
    }
    let previousPinned;
    list.innerHTML = shown.map(c => {
      const heading = c.pinned !== previousPinned ? `<p class="chat-list-label">${c.pinned ? 'ĐÃ GHIM' : 'GẦN ĐÂY'}</p>` : '';
      previousPinned = c.pinned;
      const last = c.lastMessage;
      const prefix = last?.senderUserId === context?.userId ? 'Bạn: ' : '';
      const preview = last?.deletedAt ? 'Tin nhắn đã được xóa' : last?.text || 'Chưa có tin nhắn. Gửi lời chào nhé!';
      return `${heading}<button type="button" class="chat-conversation ${c.id === selectedId ? 'is-selected' : ''} ${c.unreadCount ? 'is-unread' : ''}" data-chat-conversation="${escapeHtml(c.id)}" ${c.id === selectedId ? 'aria-current="true"' : ''}>
        ${avatar(c.title, c.tone, c.type === 'group', '', c.portrait)}<span class="chat-conversation-copy"><span class="chat-conversation-title"><strong>${escapeHtml(c.title)}</strong><time datetime="${escapeHtml(c.updatedAt)}">${time(c.updatedAt)}</time></span><span class="chat-conversation-preview"><span>${escapeHtml(prefix + preview)}</span>${c.muted ? icon('volumeOff') : c.unreadCount ? `<b aria-label="${c.unreadCount} tin chưa đọc">${c.unreadCount}</b>` : c.pinned ? `<i class="chat-list-pin">${icon('pin')}</i>` : ''}</span></span></button>`;
    }).join('');
  }
  const aiOpenedIds = new Set();
  const aiSummaries = new Map();
  const aiAbortControllers = new Map();
  let aiRequestSeq = 0;
  let aiSummarySignature = '';
  function clearConversationAiState(conversationId = null) {
    if (conversationId) {
      const ctrl = aiAbortControllers.get(conversationId);
      try { ctrl?.abort(); } catch {}
      aiAbortControllers.delete(conversationId);
      aiSummaries.delete(conversationId);
      aiOpenedIds.delete(conversationId);
      return;
    }
    for (const ctrl of aiAbortControllers.values()) {
      try { ctrl?.abort(); } catch {}
    }
    aiAbortControllers.clear();
    aiSummaries.clear();
    aiOpenedIds.clear();
    aiRequestSeq += 1;
  }
  function getMeaningfulMessages(msgList = messages) {
    return (msgList || []).filter(m => m && (m.kind === 'text' || m.kind === 'attachment') && !m.deletedAt && m.text?.trim() && !m.text.startsWith('📎 '));
  }
  function extractChatActionItems(msgList) {
    const textMsgs = getMeaningfulMessages(msgList);
    const actionPattern = /\b(nho|nhac|giao|can|chot|hoan thanh|gui|kiem tra|deadline|truoc|thu\s+[2-7]|ngay mai|hom nay|@)/i;
    const scored = textMsgs.map(m => {
      const f = fold(m.text);
      const isAction = actionPattern.test(f) || m.text.length > 35;
      return { message: m, isAction };
    });
    const picks = scored.filter(x => x.isAction).slice(-4);
    if (!picks.length && textMsgs.length) picks.push({ message: textMsgs[textMsgs.length - 1], isAction: false });
    return picks.map(x => ({
      messageId: x.message.id,
      sender: personName(x.message.senderUserId),
      text: x.message.text.trim()
    }));
  }
  async function requestAiSummary(conversationId, { force = false } = {}) {
    if (!conversationId || !current || current.id !== conversationId) return;
    const meaningful = getMeaningfulMessages(messages);
    const latestId = meaningful.at(-1)?.id || null;
    const canCloudAi = Boolean(aiBridge?.isCloudAvailable?.() && typeof aiBridge.summarizeConversation === 'function');

    if (!canCloudAi) {
      aiSummaries.set(conversationId, {
        status: 'ready',
        source: 'local',
        overview: '',
        decisions: [],
        items: extractChatActionItems(messages),
        lastMessageId: latestId,
        analyzedCount: meaningful.length,
        notice: ''
      });
      renderAiSummary();
      return;
    }

    if (meaningful.length === 0) {
      aiSummaries.set(conversationId, {
        status: 'ready',
        source: 'ai',
        overview: '',
        decisions: [],
        items: [],
        lastMessageId: null,
        analyzedCount: 0,
        notice: ''
      });
      renderAiSummary();
      return;
    }

    const existing = aiSummaries.get(conversationId);
    if (!force && existing?.status === 'ready' && existing.source === 'ai') {
      renderAiSummary();
      return;
    }
    if (existing?.status === 'loading' && !force) return;

    const prevCtrl = aiAbortControllers.get(conversationId);
    try { prevCtrl?.abort(); } catch {}
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    if (controller) aiAbortControllers.set(conversationId, controller);

    const captured = context;
    const reqId = ++aiRequestSeq;
    aiSummaries.set(conversationId, { status: 'loading', requestId: reqId, source: 'ai' });
    renderAiSummary();

    try {
      const res = await aiBridge.summarizeConversation(conversationId, { signal: controller?.signal });
      if (!valid(captured) || reqId !== aiRequestSeq) return;
      if (controller && aiAbortControllers.get(conversationId) !== controller) return;
      const data = res?.data || {};
      aiSummaries.set(conversationId, {
        status: 'ready',
        requestId: reqId,
        source: 'ai',
        model: res?.model || '',
        overview: String(data.overview || '').trim(),
        decisions: Array.isArray(data.decisions) ? data.decisions : [],
        items: Array.isArray(data.actionItems) ? data.actionItems : [],
        lastMessageId: latestId,
        analyzedCount: Number(data.analyzedCount || meaningful.length),
        notice: ''
      });
      if (current?.id === conversationId) renderAiSummary();
    } catch (error) {
      if (error?.name === 'AbortError') return;
      if (!valid(captured) || reqId !== aiRequestSeq) return;
      if (controller && aiAbortControllers.get(conversationId) !== controller) return;
      console.warn('[WorkTree Chat AI]', error?.message || error);
      const rawMsg = String(error?.message || '').trim();
      const safeReason = (rawMsg && rawMsg.length <= 130 && !/sql|jwt|stack|syntaxerror|typeerror|referenceerror/i.test(rawMsg))
        ? rawMsg
        : 'Không thể kết nối AI';
      aiSummaries.set(conversationId, {
        status: 'ready',
        requestId: reqId,
        source: 'fallback',
        overview: '',
        decisions: [],
        items: extractChatActionItems(messages),
        lastMessageId: latestId,
        analyzedCount: meaningful.length,
        notice: `${safeReason} — đang hiển thị lọc từ khóa cục bộ.`
      });
      if (current?.id === conversationId) renderAiSummary();
    } finally {
      if (controller && aiAbortControllers.get(conversationId) === controller) {
        aiAbortControllers.delete(conversationId);
      }
    }
  }
  function renderAiSummary() {
    const slot = $('[data-chat-ai-summary]');
    const btn = $('[data-chat-ai-toggle]');
    if (!slot || !current) return;
    const isOpen = aiOpenedIds.has(current.id);
    const history = $('[data-chat-scroll]');
    const atBottom = history.scrollHeight - history.scrollTop - history.clientHeight <= 2;
    btn.setAttribute('aria-expanded', String(isOpen));
    slot.hidden = !isOpen;
    if (atBottom) history.scrollTop = history.scrollHeight;
    if (!isOpen) return;

    const canCloudAi = Boolean(aiBridge?.isCloudAvailable?.() && typeof aiBridge.summarizeConversation === 'function');
    const meaningful = getMeaningfulMessages(messages);
    const latestId = meaningful.at(-1)?.id || null;
    let entry = aiSummaries.get(current.id);
    if (!entry && !canCloudAi) {
      entry = {
        status: 'ready',
        source: 'local',
        overview: '',
        decisions: [],
        items: extractChatActionItems(messages),
        lastMessageId: latestId,
        analyzedCount: meaningful.length,
        notice: ''
      };
      aiSummaries.set(current.id, entry);
    }

    const canCreate = Boolean(taskBridge?.canCreate());
    const hasNewer = Boolean(entry?.status === 'ready' && entry.source === 'ai' && latestId && entry.lastMessageId && latestId !== entry.lastMessageId);
    const refreshBtn = slot.querySelector('[data-chat-ai-refresh]');
    if (refreshBtn) {
      refreshBtn.hidden = !canCloudAi || entry?.status === 'loading' || meaningful.length === 0;
    }

    const signature = JSON.stringify([
      current.id,
      entry?.status || 'idle',
      entry?.source || 'local',
      entry?.overview || '',
      entry?.decisions || [],
      entry?.items || [],
      entry?.notice || '',
      hasNewer,
      canCloudAi,
      canCreate,
      meaningful.length
    ]);
    if (aiSummarySignature === signature) return;

    const activeTaskAttr = slot.contains(document.activeElement)
      ? (document.activeElement.dataset.chatAiTaskIdx || document.activeElement.dataset.chatAiTask || null)
      : null;
    const summaryBody = slot.querySelector('.chat-ai-summary-body');
    const count = slot.querySelector('[data-chat-ai-count]');
    const scrollTop = summaryBody.scrollTop;

    let countText = '';
    let body = '';

    if (entry?.status === 'loading') {
      countText = 'Đang phân tích…';
      body = `
        <div class="chat-ai-loading" role="status" aria-live="polite">
          <p class="chat-ai-summary-empty">AI đang đọc và tổng hợp hội thoại…</p>
          <div class="chat-ai-skeleton"></div>
          <div class="chat-ai-skeleton is-short"></div>
        </div>`;
    } else if (entry?.source === 'ai' && canCloudAi) {
      if (entry.analyzedCount === 0 || meaningful.length === 0) {
        countText = '';
        body = '<p class="chat-ai-summary-empty">Chưa đủ nội dung trao đổi để tóm tắt.</p>';
      } else {
        const items = entry.items || [];
        const decisions = entry.decisions || [];
        countText = `${entry.analyzedCount} tin nhắn · ${items.length} đầu việc`;
        const staleHtml = hasNewer
          ? '<div class="chat-ai-notice"><span>Hội thoại có tin nhắn mới</span><button type="button" class="btn small" data-chat-ai-refresh>Cập nhật</button></div>'
          : '';
        const overviewHtml = entry.overview
          ? `<section class="chat-ai-overview"><p>${escapeHtml(entry.overview)}</p></section>`
          : '';
        const decisionsHtml = decisions.length
          ? `<section class="chat-ai-decisions"><h4>Điểm đã chốt</h4><ul>${decisions.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul></section>`
          : '';
        const itemsHtml = items.length
          ? `<ul class="chat-ai-summary-list">${items.map((item, idx) => {
              const tags = [
                item.assigneeHint ? `<span class="chat-ai-chip">${escapeHtml(item.assigneeHint)}</span>` : '',
                item.dueHint ? `<span class="chat-ai-chip">${escapeHtml(item.dueHint)}</span>` : '',
                item.priority && item.priority !== 'Trung bình' ? `<span class="chat-ai-chip is-priority">${escapeHtml(item.priority)}</span>` : ''
              ].filter(Boolean).join('');
              return `
                <li class="chat-ai-summary-item">
                  <div class="chat-ai-summary-copy">
                    <strong>${escapeHtml(item.title)}</strong>
                    ${item.context ? `<p>${escapeHtml(item.context)}</p>` : ''}
                    ${tags ? `<div class="chat-ai-tags">${tags}</div>` : ''}
                  </div>
                  ${canCreate ? `<button type="button" class="icon-btn chat-icon-button" data-chat-ai-task-idx="${idx}" aria-label="Tạo công việc: ${escapeHtml(item.title)}" title="Tạo công việc">${icon('plus')}</button>` : ''}
                </li>`;
            }).join('')}</ul>`
          : '<p class="chat-ai-summary-empty">Chưa phát hiện đầu việc mới cần tạo trong đoạn trao đổi này.</p>';
        body = `${staleHtml}${overviewHtml}${decisionsHtml}${itemsHtml}`;
      }
    } else {
      const items = entry?.items || extractChatActionItems(messages);
      countText = items.length
        ? `${items.length} tin nhắn đáng chú ý${canCloudAi ? '' : ' · Xem thử'}`
        : '';
      const noticeHtml = entry?.notice
        ? `<div class="chat-ai-notice" role="status"><span>${escapeHtml(entry.notice)}</span><button type="button" class="btn small" data-chat-ai-refresh>Thử lại với AI</button></div>`
        : '';
      const listHtml = items.length
        ? `<ul class="chat-ai-summary-list">${items.map(item => `
            <li class="chat-ai-summary-item">
              <div class="chat-ai-summary-copy"><strong>${escapeHtml(item.sender)}</strong><p>${escapeHtml(item.text)}</p></div>
              ${canCreate ? `<button type="button" class="icon-btn chat-icon-button" data-chat-ai-task="${escapeHtml(item.messageId)}" aria-label="Tạo công việc từ tin nhắn của ${escapeHtml(item.sender)}" title="Tạo công việc">${icon('plus')}</button>` : ''}
            </li>`).join('')}</ul>`
        : '<p class="chat-ai-summary-empty">Chưa đủ nội dung trao đổi để rút trích đầu việc.</p>';
      body = `${noticeHtml}${listHtml}`;
    }

    count.hidden = !countText;
    count.textContent = countText;
    summaryBody.innerHTML = body;
    summaryBody.scrollTop = scrollTop;
    aiSummarySignature = signature;
    if (activeTaskAttr !== null) {
      const action = [...summaryBody.querySelectorAll('[data-chat-ai-task-idx], [data-chat-ai-task]')].find(button =>
        (button.dataset.chatAiTaskIdx || button.dataset.chatAiTask) === activeTaskAttr
      );
      (action || $('#chatAiSummaryTitle')).focus({ preventScroll: true });
    }
  }
  function setAiSummary(open) {
    if (!current) return;
    if (open) aiOpenedIds.add(current.id);
    else aiOpenedIds.delete(current.id);
    if (open) {
      const canCloudAi = Boolean(aiBridge?.isCloudAvailable?.() && typeof aiBridge.summarizeConversation === 'function');
      if (!canCloudAi || !aiSummaries.has(current.id)) {
        void requestAiSummary(current.id, { force: !canCloudAi });
      } else {
        renderAiSummary();
      }
    } else {
      renderAiSummary();
    }
    $(open ? '#chatAiSummaryTitle' : '[data-chat-ai-toggle]')?.focus({ preventScroll: true });
  }
  function renderThread() {
    aiSummarySignature = '';
    if (!current) { thread.innerHTML = empty('Cùng nhau làm được nhiều hơn', 'Chọn một cuộc trò chuyện hoặc gửi lời chào để bắt đầu.', 'new-message', 'Bắt đầu trò chuyện', true); return; }
    thread.innerHTML = `
      <header class="chat-thread-header">${iconButton('back', 'Quay lại danh sách', 'chevronLeft', 'class-extra="mobile"')}
        ${avatar(current.title, current.tone, current.type === 'group', '', current.portrait)}<div class="chat-thread-identity"><h2 tabindex="-1">${escapeHtml(current.title)}</h2><p>${current.type === 'group' ? `${participants.length} thành viên · Nhóm cộng tác` : 'Cuộc trò chuyện cá nhân'}</p></div>
        <div class="chat-thread-tools"><button type="button" class="icon-btn chat-icon-button chat-ai-summary-btn" data-chat-ai-toggle aria-expanded="${aiOpenedIds.has(current.id)}" aria-controls="chatAiSummary" aria-label="Tóm tắt AI" title="Tóm tắt AI">${icon('sparkles')}<span>Tóm tắt AI</span></button>${iconButton('search-messages', 'Tìm trong hội thoại', 'search', `aria-expanded="${searchOpen}"`)}${iconButton('toggle-info', 'Thông tin hội thoại', 'info', `aria-expanded="${infoOpen}" aria-controls="chatInfoPanel"`)}</div>
      </header>
      <div class="chat-message-search" ${searchOpen ? '' : 'hidden'}><label class="chat-search">${icon('search')}<input type="search" data-chat-message-search aria-label="Tìm nội dung trong hội thoại" placeholder="Tìm trong cuộc trò chuyện..." value="${escapeHtml(messageQuery)}"></label>${iconButton('close-message-search', 'Đóng tìm trong hội thoại', 'x')}</div>
      <div class="chat-pinned-message" data-chat-pinned hidden></div>
      <div class="chat-thread-content">
        <div class="chat-history">
          <div class="chat-message-scroll" data-chat-scroll tabindex="0" aria-label="Lịch sử tin nhắn"><div data-chat-messages></div></div>
          <button type="button" class="chat-jump btn" data-chat-action="jump-latest" hidden>${icon('arrowDown')}Tin mới nhất</button>
        </div>
        <section class="chat-ai-summary-card" id="chatAiSummary" aria-labelledby="chatAiSummaryTitle" data-chat-ai-summary hidden>
          <header class="chat-ai-summary-head">
            <span class="chat-ai-summary-mark">${icon('sparkles')}</span>
            <div class="chat-ai-summary-heading">
              <h3 id="chatAiSummaryTitle" tabindex="-1">Tóm tắt AI</h3>
              <p data-chat-ai-count hidden></p>
            </div>
            <div class="chat-ai-head-actions">
              <button type="button" class="icon-btn chat-icon-button" data-chat-ai-refresh aria-label="Phân tích lại bằng AI" title="Phân tích lại bằng AI" hidden>${icon('refresh')}</button>
              <button type="button" class="icon-btn chat-icon-button" data-chat-ai-close aria-label="Đóng tóm tắt AI" title="Đóng tóm tắt AI">${icon('x')}</button>
            </div>
          </header>
          <div class="chat-ai-summary-body"></div>
        </section>
      </div>
      <div class="chat-composer-area"><div class="chat-reply-preview" data-chat-reply hidden></div><div class="chat-pending-attachments" data-chat-pending-attachments hidden></div><div class="chat-emoji-picker" data-chat-emoji-picker hidden role="group" aria-label="Chọn biểu tượng cảm xúc">${['😊', '👍', '❤️', '🎉', '👀', '🙌', '✨', '💜'].map(emoji => `<button type="button" data-chat-emoji="${emoji}" aria-label="Chèn ${emoji}">${emoji}</button>`).join('')}</div>
        <input type="file" data-chat-attachment-file multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" hidden>
        <form class="chat-composer" data-chat-compose><textarea rows="1" maxlength="10000" data-chat-draft placeholder="Viết tin nhắn cho ${escapeHtml(current.title)}..." aria-label="Nội dung tin nhắn" aria-describedby="chatPreviewDetails" ${current.capabilities?.canSend === false ? 'disabled' : ''}>${escapeHtml(getDraft())}</textarea>
          <div class="chat-composer-toolbar"><div>${iconButton('attach-file', 'Đính kèm ảnh hoặc tệp', 'paperclip', current.capabilities?.canSend === false ? 'disabled' : '')}${iconButton('emoji-picker', 'Chèn biểu tượng cảm xúc', 'smile', 'aria-expanded="false"')}<span class="chat-compose-hint">Enter để gửi · Shift + Enter xuống dòng</span></div><button type="submit" class="chat-send" aria-label="Gửi tin nhắn" ${(!getDraft().trim() && !pendingAttachments.length) || current.capabilities?.canSend === false ? 'disabled' : ''}>${icon('send')}</button></div>
        </form>
      </div>`;
    renderPinned(); renderReply(); renderPendingAttachments(); resizeComposer();
    renderAiSummary(); renderMessages(true);
  }
  function updateSendButtonState() {
    const btn = $('.chat-send');
    if (!btn) return;
    const hasText = Boolean($('[data-chat-draft]')?.value.trim());
    btn.disabled = sending || uploadingAttachment || (!hasText && !pendingAttachments.length) || current?.capabilities?.canSend === false;
  }
  function renderPendingAttachments() {
    const slot = $('[data-chat-pending-attachments]');
    if (!slot) return;
    slot.hidden = !pendingAttachments.length && !uploadingAttachment;
    const chips = pendingAttachments.map(att => `
      <span class="chat-pending-attachment">
        ${icon('paperclip')}
        <span class="chat-attachment-name">${escapeHtml(att.fileName)}</span>
        <small>${escapeHtml(formatBytes(att.sizeBytes))}</small>
        <button type="button" class="chat-pending-remove" data-chat-remove-attachment="${escapeHtml(att.id)}" aria-label="Bỏ ${escapeHtml(att.fileName)}">${icon('x')}</button>
      </span>`).join('');
    slot.innerHTML = `${chips}${uploadingAttachment ? '<span class="chat-pending-uploading">Đang tải tệp lên...</span>' : ''}`;
    updateSendButtonState();
  }
  async function handleAttachmentFiles(fileList) {
    if (!adapter?.uploadAttachment || !current || !selectedId || current.capabilities?.canSend === false) return;
    const files = [...(fileList || [])];
    if (!files.length) return;
    const remaining = Math.max(0, 5 - pendingAttachments.length);
    if (!remaining) {
      notice('Tối đa 5 tệp đính kèm cho mỗi tin nhắn.', true);
      return;
    }
    const captured = context;
    const targetConvId = selectedId;
    uploadingAttachment = true;
    renderPendingAttachments();
    try {
      for (const file of files.slice(0, remaining)) {
        const uploaded = await adapter.uploadAttachment(captured, targetConvId, file);
        if (!valid(captured) || selectedId !== targetConvId) return;
        pendingAttachments.push(uploaded);
      }
      if (files.length > remaining) {
        notice(`Đã đính kèm ${remaining} tệp (giới hạn 5 tệp/tin nhắn).`);
      }
    } catch (error) {
      if (valid(captured) && error.name !== 'AbortError') {
        notice(error.message || 'Không thể tải tệp lên. Vui lòng thử lại.', true);
      }
    } finally {
      if (valid(captured)) {
        uploadingAttachment = false;
        renderPendingAttachments();
      }
    }
  }
  async function openMessageAttachment(messageId, attachmentId) {
    if (!adapter?.getAttachmentUrl || !current || !selectedId) return;
    const msg = messages.find(m => m.id === messageId && !m.deletedAt);
    const att = msg?.attachments?.find(a => a.id === attachmentId);
    if (!att) return;
    const captured = context;
    try {
      const url = await adapter.getAttachmentUrl(captured, selectedId, att);
      if (!valid(captured) || !url) return;
      if (url === '#preview-file') {
        notice(`Tệp xem trước: ${att.fileName}`);
        return;
      }
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.download = att.fileName || 'download';
        a.click();
      }
    } catch (error) {
      if (valid(captured) && error.name !== 'AbortError') {
        notice('Không thể mở tệp đính kèm lúc này.', true);
      }
    }
  }
  function personName(id) { return id === context?.userId ? 'Bạn' : participants.find(p => p.userId === id)?.displayName || 'Thành viên'; }
  function renderMessages(forceBottom = false) {
    const target = $('[data-chat-messages]');
    if (!target) return;
    const scroller = $('[data-chat-scroll]');
    const top = scroller.scrollTop;
    const nearBottom = scroller.scrollHeight - top - scroller.clientHeight < 150;
    let lastDate;
    const shown = messages.filter(m => !messageQuery || fold(m.text).includes(fold(messageQuery)));
    const failedItems = [...failed.values()].filter(item => item.conversationId === selectedId);
    target.innerHTML = `${hasOlder ? '<button type="button" class="btn chat-load-older" data-chat-action="older-messages">Xem tin nhắn trước</button>' : ''}${shown.length ? shown.map(m => {
      const day = new Date(m.createdAt).toLocaleDateString('vi');
      const today = day === new Date().toLocaleDateString('vi');
      const divider = lastDate !== day ? `<div class="chat-day-divider"><span>${today ? 'Hôm nay' : day}</span></div>` : '';
      lastDate = day;
      if (m.kind === 'system') return `${divider}<p class="chat-system-message">${escapeHtml(m.text)}</p>`;
      const own = m.senderUserId === context?.userId;
      const sender = participants.find(p => p.userId === m.senderUserId);
      const replied = messages.find(item => item.id === m.replyToMessageId);
      const hasAtts = !m.deletedAt && Array.isArray(m.attachments) && m.attachments.length > 0;
      const isDefaultAttLabel = hasAtts && m.kind === 'attachment' && m.text === `📎 ${m.attachments[0]?.fileName || 'Tệp đính kèm'}`;
      const canCreateTask = !m.deletedAt && (m.kind === 'text' || (m.kind === 'attachment' && !isDefaultAttLabel)) && m.text?.trim() && taskBridge?.canCreate();
      return `${divider}<article class="chat-message ${own ? 'is-own' : ''}" id="chat-message-${escapeHtml(m.id)}" data-message-id="${escapeHtml(m.id)}" aria-label="${escapeHtml(personName(m.senderUserId))}, ${time(m.createdAt)}">
        ${own && !(localAvatarUrl || profileAvatarUrl) ? '' : avatar(personName(m.senderUserId), sender?.tone, false, 'chat-message-avatar', sender?.portrait, own ? (localAvatarUrl || profileAvatarUrl) : null)}<div class="chat-message-main">${!own ? `<div class="chat-sender-name">${escapeHtml(personName(m.senderUserId))}</div>` : ''}
        <div class="chat-bubble">${replied ? `<button type="button" class="chat-quoted-message" data-chat-jump="${escapeHtml(replied.id)}"><strong>${escapeHtml(personName(replied.senderUserId))}</strong><span>${escapeHtml(replied.deletedAt ? 'Tin nhắn đã được xóa' : replied.text)}</span></button>` : ''}${!isDefaultAttLabel || m.deletedAt ? `<p>${escapeHtml(m.deletedAt ? 'Tin nhắn đã được xóa' : m.text)}</p>` : ''}${hasAtts ? `<div class="chat-message-attachments">${m.attachments.map(att => `<button type="button" class="chat-attachment-chip" data-chat-open-attachment="${escapeHtml(att.id)}" data-message="${escapeHtml(m.id)}" title="Mở hoặc tải xuống ${escapeHtml(att.fileName)}">${icon('paperclip')}<span class="chat-attachment-name">${escapeHtml(att.fileName)}</span><small class="chat-attachment-size">${escapeHtml(formatBytes(att.sizeBytes))}</small></button>`).join('')}</div>` : ''}</div>
        ${m.reactions?.length ? `<div class="chat-reactions">${m.reactions.map(r => `<button type="button" data-chat-reaction="${escapeHtml(r.emoji)}" data-message="${escapeHtml(m.id)}" aria-label="${escapeHtml(r.emoji)}, ${r.userIds.length} người" aria-pressed="${r.userIds.includes(context?.userId)}">${escapeHtml(r.emoji)} <span>${r.userIds.length}</span></button>`).join('')}</div>` : ''}
        <div class="chat-message-meta"><time datetime="${escapeHtml(m.createdAt)}">${time(m.createdAt)}</time>${m.editedAt ? '<span>· Đã chỉnh sửa</span>' : ''}${own ? `<span class="chat-message-check" title="${adapter?.isPreview ? 'Chỉ lưu trong phiên xem trước' : 'Đã đồng bộ đám mây'}">${icon('check')}</span>` : ''}${canCreateTask ? `<button type="button" class="chat-create-task" data-chat-action="create-task" data-message="${escapeHtml(m.id)}" aria-label="Tạo công việc từ tin nhắn" title="Tạo công việc từ tin nhắn">${icon('plus')}<span>Tạo công việc</span></button>` : ''}</div></div>
        ${!m.deletedAt ? `<div class="chat-message-actions">${iconButton('reply', 'Trả lời tin nhắn', 'reply', `data-message="${escapeHtml(m.id)}"`)}<button type="button" class="icon-btn chat-icon-button" data-chat-reaction="👍" data-message="${escapeHtml(m.id)}" aria-label="Thích tin nhắn" title="Thích tin nhắn">${icon('smile')}</button>${current.capabilities?.canPinMessages ? iconButton('pin-message', 'Ghim tin nhắn', 'pin', `data-message="${escapeHtml(m.id)}"`) : ''}</div>` : ''}
        </article>`;
    }).join('') : empty(messageQuery ? 'Không có tin nhắn phù hợp' : 'Một lời chào, một khởi đầu', messageQuery ? 'Thử tìm bằng từ khóa khác.' : 'Gửi tin nhắn đầu tiên cho cuộc trò chuyện này.')}
      ${failedItems.map(item => `<div class="chat-failed-message"><p>${escapeHtml(item.text || 'Tin nhắn kèm tệp')}</p><button type="button" class="btn" data-chat-retry="${item.clientMessageId}">Gửi lỗi · Thử lại</button></div>`).join('')}`;
    if (forceBottom || nearBottom) scroller.scrollTop = scroller.scrollHeight;
    else scroller.scrollTop = top;
  }
  function renderPinned() {
    const target = $('[data-chat-pinned]'); if (!target) return;
    const pinned = messages.find(m => current?.pinnedMessageIds?.includes(m.id) && !m.deletedAt);
    target.hidden = !pinned;
    if (pinned) target.innerHTML = `${icon('pin')}<button type="button" data-chat-jump="${escapeHtml(pinned.id)}"><strong>Tin nhắn đã ghim</strong><span>${escapeHtml(pinned.text)}</span></button>${icon('chevronRight')}`;
  }
  function renderReply() {
    const target = $('[data-chat-reply]'); if (!target) return;
    target.hidden = !replyTo;
    if (replyTo) target.innerHTML = `<div><strong>Trả lời ${escapeHtml(personName(replyTo.senderUserId))}</strong><p>${escapeHtml(replyTo.text)}</p></div>${iconButton('cancel-reply', 'Hủy trả lời', 'x')}`;
  }
  function setInfo(value, restoreFocus = true) {
    infoOpen = value;
    workbench.classList.toggle('info-open', value);
    info.hidden = !value;
    $('.chat-info-scrim').hidden = !value;
    const overlay = value && matchMedia('(max-width: 1449px)').matches;
    thread.inert = overlay;
    $('.chat-inbox').inert = overlay;
    $('[data-chat-action="toggle-info"]')?.setAttribute('aria-expanded', String(value));
    if (value) { renderInfo(); info.querySelector('h2')?.focus({ preventScroll: true }); }
    else if (restoreFocus) $('[data-chat-action="toggle-info"]')?.focus({ preventScroll: true });
  }
  function renderInfo() {
    if (!current) return;
    const focusedAction = info.contains(document.activeElement) ? document.activeElement.dataset.chatAction : null;
    const sharedFiles = [];
    for (const m of messages) {
      if (!m.deletedAt && Array.isArray(m.attachments)) {
        for (const att of m.attachments) sharedFiles.push({ messageId: m.id, att });
      }
    }
    const isPrev = adapter?.isPreview === true;
    info.id = 'chatInfoPanel';
    info.innerHTML = `<header class="chat-info-heading"><h2 tabindex="-1">Thông tin ${current.type === 'group' ? 'nhóm' : 'hội thoại'}</h2>${iconButton('close-info', 'Đóng thông tin hội thoại', 'x')}</header>
      <div class="chat-info-scroll"><div class="chat-info-profile">${avatar(current.title, current.tone, current.type === 'group', 'chat-avatar-large', current.portrait)}<h3>${escapeHtml(current.title)}</h3><p>${current.type === 'group' ? `${participants.length} thành viên` : 'Cuộc trò chuyện cá nhân'}</p></div>
      <div class="chat-info-quick"><button type="button" data-chat-action="mute" aria-pressed="${!!current.muted}">${icon(current.muted ? 'volumeOff' : 'bell')}<span>${current.muted ? 'Đang tắt' : 'Thông báo'}</span></button><button type="button" data-chat-action="pin-conversation" aria-pressed="${!!current.pinned}">${icon('pin')}<span>${current.pinned ? 'Đã ghim' : 'Ghim chat'}</span></button>${current.capabilities?.canRename ? `<button type="button" data-chat-action="rename-group">${icon('edit')}<span>Đổi tên</span></button>` : ''}</div>
      ${current.description ? `<section class="chat-info-section"><h3>Giới thiệu</h3><p class="chat-group-description">${escapeHtml(current.description)}</p></section>` : ''}
      <section class="chat-info-section"><div class="chat-info-section-title"><h3>Thành viên <span>${participants.length}</span></h3>${current.capabilities?.canAddMembers ? iconButton('add-members', 'Thêm thành viên', 'plus') : ''}</div><div class="chat-members">${participants.map(p => `<div class="chat-member">${avatar(p.displayName, p.tone, false, '', p.portrait, p.userId === context?.userId ? (localAvatarUrl || profileAvatarUrl) : null)}<div><strong>${escapeHtml(p.userId === context?.userId ? `${p.displayName} (Bạn)` : p.displayName)}</strong><small>${p.groupRole === 'owner' ? 'Chủ nhóm' : escapeHtml(p.roleLabel || 'Thành viên')}</small></div></div>`).join('')}</div></section>
      <section class="chat-info-section"><div class="chat-info-section-title"><h3>Ảnh và tệp đã chia sẻ <span>${sharedFiles.length}</span></h3></div>${sharedFiles.length ? `<div class="chat-shared-files">${sharedFiles.slice(-20).reverse().map(({ messageId, att }) => `<button type="button" class="chat-attachment-chip" data-chat-open-attachment="${escapeHtml(att.id)}" data-message="${escapeHtml(messageId)}">${icon('paperclip')}<span class="chat-attachment-name">${escapeHtml(att.fileName)}</span><small class="chat-attachment-size">${escapeHtml(formatBytes(att.sizeBytes))}</small></button>`).join('')}</div>` : `<div class="chat-files-empty">${icon('paperclip')}<p>Chưa có tài liệu chung.<small>Bấm biểu tượng kẹp giấy để gửi ảnh hoặc tệp.</small></p></div>`}</section>
      <div class="chat-info-privacy">${icon('info')}<p>${isPrev ? 'Đây là nhóm minh họa. Thay đổi chỉ có hiệu lực trong phiên xem trước.' : 'Hội thoại nội bộ được mã hóa bảo mật và cách ly riêng theo doanh nghiệp.'}</p></div></div>`;
    if (focusedAction) info.querySelector(`[data-chat-action="${focusedAction}"]`)?.focus({ preventScroll: true });
  }
  async function selectConversation(id, { updateRoute = true, focus = false } = {}) {
    if (!adapter) return;
    selectedId = id; current = null; participants = []; messages = []; replyTo = null; pendingAttachments = []; uploadingAttachment = false; messageQuery = ''; searchOpen = false;
    document.body.classList.add('chat-conversation-open');
    setInfo(false, false); workbench.classList.add('has-conversation');
    thread.innerHTML = skeleton(); renderList();
    const captured = context; const request = ++detailRequest;
    try {
      const [detail, page] = await Promise.all([adapter.getConversation(captured, id), adapter.listMessages(captured, id, { limit: 50 })]);
      if (!valid(captured) || request !== detailRequest) return;
      current = detail.conversation; participants = detail.participants; messages = page.items;
      nextMessagesCursor = page.nextCursor; hasOlder = page.hasMore;
      renderThread(); if (updateRoute) setRoute(id);
      if (focus) thread.querySelector('h2')?.focus({ preventScroll: true });
      await adapter.markRead(captured, id, messages.at(-1)?.id);
      if (valid(captured)) await refreshList();
    } catch (error) {
      if (!valid(captured) || request !== detailRequest || error.name === 'AbortError') return;
      thread.innerHTML = empty('Không thể mở hội thoại', 'Hội thoại chưa khả dụng hoặc bạn không còn quyền truy cập.', 'retry-conversation', 'Thử lại', true);
    }
  }
  async function refreshSelected() {
    if (!adapter || !selectedId || !current) return;
    const captured = context; const id = selectedId; const request = detailRequest; const refresh = ++refreshRequest;
    try {
      const [detail, page] = await Promise.all([adapter.getConversation(captured, id), adapter.listMessages(captured, id, { limit: 50 })]);
      if (!valid(captured) || id !== selectedId || request !== detailRequest || refresh !== refreshRequest) return;
      current = detail.conversation; participants = detail.participants;
      const merged = new Map(messages.map(message => [message.id, message]));
      for (const message of page.items) merged.set(message.id, message);
      messages = [...merged.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
      renderMessages(); renderPinned(); renderAiSummary(); if (infoOpen) renderInfo();
      const title = thread.querySelector('h2'); if (title) title.textContent = current.title;
      const subtitle = thread.querySelector('.chat-thread-identity p'); if (subtitle) subtitle.textContent = current.type === 'group' ? `${participants.length} thành viên · Nhóm cộng tác` : 'Cuộc trò chuyện cá nhân';
    } catch (error) { if (valid(captured) && error.name !== 'AbortError') notice('Chưa cập nhật được hội thoại. Vui lòng mở lại để thử lại.', true); }
  }
  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    queueMicrotask(async () => { refreshQueued = false; if (disposed) return; await Promise.all([refreshList(), refreshSelected()]); });
  }
  async function open(id) {
    if (!context?.userId || !context.organizationId || !adapter) return;
    setActive(true); onCloseSidebar();
    if (conversations.length) renderList(); else list.innerHTML = skeleton();
    const captured = context;
    await refreshList();
    if (!active || !adapter || !valid(captured)) return;
    const initial = id || selectedId || (!matchMedia('(max-width: 900px)').matches ? conversations[0]?.id : null);
    if (initial && (!current || selectedId !== initial)) await selectConversation(initial, { updateRoute: !standalone });
    else if (!initial) { renderThread(); setRoute(null); }
  }
  function close() {
    setActive(false); setInfo(false, false);
    if (dialog.open) dialog.close();
    if (!standalone && location.hash.startsWith('#messages')) window.history.replaceState(null, '', location.pathname + location.search);
  }

  function createTaskFromMessage(messageId) {
    const message = messages.find(item => item.id === messageId && (item.kind === 'text' || item.kind === 'attachment') && !item.deletedAt);
    if (!message?.text?.trim() || !taskBridge?.canCreate()) return;
    const captured = context;
    const source = { conversationId: selectedId, messageId };
    taskBridge.openForm({
      conversationId: selectedId,
      messageId,
      text: message.text,
      conversationTitle: current?.title || '',
      senderName: personName(message.senderUserId),
      isCurrent: () => valid(captured),
      onCreated(taskId) {
        if (valid(captured)) taskSources.set(String(taskId), source);
      }
    });
  }

  function createTaskFromAiItem(idx) {
    if (!current || !taskBridge?.canCreate()) return;
    const entry = aiSummaries.get(current.id);
    const item = entry?.items?.[Number(idx)];
    if (!item) return;
    const captured = context;
    const sourceMsg = messages.find(m => m.id === item.messageId && !m.deletedAt) || null;
    const source = { conversationId: selectedId, messageId: item.messageId };
    taskBridge.openForm({
      conversationId: selectedId,
      messageId: item.messageId,
      text: sourceMsg?.text || item.context || item.title,
      conversationTitle: current.title || '',
      senderName: sourceMsg ? personName(sourceMsg.senderUserId) : (item.assigneeHint || ''),
      aiExtracted: {
        title: item.title,
        assigneeHint: item.assigneeHint || '',
        description: item.context || '',
        priority: item.priority || 'Trung bình',
        due: /^\d{4}-\d{2}-\d{2}$/.test(item.dueHint || '') ? item.dueHint : ''
      },
      isCurrent: () => valid(captured),
      onCreated(taskId) {
        if (valid(captured)) taskSources.set(String(taskId), source);
      }
    });
  }

  function attachSourceButton(event) {
    const { taskId, slot } = event.detail;
    const source = taskSources.get(String(taskId));
    if (!source || !slot || !taskBridge) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn small chat-source-button';
    button.textContent = 'Xem tin nhắn gốc';
    button.title = 'Liên kết tin nhắn mẫu trong phiên này';
    button.addEventListener('click', async () => {
      const captured = context;
      taskBridge.closeDrawer();
      await open(source.conversationId);
      if (!valid(captured) || selectedId !== source.conversationId) return;
      if (messageQuery) {
        messageQuery = '';
        const search = $('[data-chat-message-search]');
        if (search) search.value = '';
        renderMessages();
      }
      const message = document.getElementById(`chat-message-${source.messageId}`);
      if (!message || !messages.some(item => item.id === source.messageId && !item.deletedAt)) {
        notice('Tin nhắn gốc hiện không còn khả dụng.', true);
        return;
      }
      message.tabIndex = -1;
      message.focus({ preventScroll: true });
      message.scrollIntoView({ block: 'center' });
      message.classList.add('chat-message-highlight');
      setTimeout(() => message.classList.remove('chat-message-highlight'), 1500);
    });
    slot.append(button);
  }
  function resizeComposer() {
    const textarea = $('[data-chat-draft]'); if (!textarea) return;
    textarea.style.height = 'auto'; textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
  }
  async function send(input) {
    if (!adapter || sending || uploadingAttachment || !current || current.capabilities?.canSend === false) return;
    const textarea = $('[data-chat-draft]');
    const attachmentsToSend = input ? (input.attachments || []) : pendingAttachments.slice(0, 5);
    const payload = input || {
      kind: attachmentsToSend.length ? 'attachment' : 'text',
      text: textarea.value.trim(),
      attachments: attachmentsToSend,
      clientMessageId: crypto.randomUUID(),
      replyToMessageId: replyTo?.id || null
    };
    if (!payload.text && !payload.attachments?.length) return;
    const captured = context; const id = selectedId; const scopedKey = draftKey(id);
    sending = true;
    updateSendButtonState();
    try {
      await adapter.sendMessage(captured, id, payload);
      if (!valid(captured)) return;
      failed.delete(payload.clientMessageId);
      // Do not discard a draft typed while this request was pending.
      if (!input && id === selectedId) {
        if ((drafts.get(scopedKey) || '').trim() === payload.text.trim() && textarea.value.trim() === payload.text.trim()) {
          textarea.value = ''; drafts.delete(scopedKey); resizeComposer();
        }
        pendingAttachments = [];
        renderPendingAttachments();
      }
      if (id === selectedId) { replyTo = null; renderReply(); await refreshSelected(); $('[data-chat-scroll]').scrollTop = $('[data-chat-scroll]').scrollHeight; }
      notice(adapter.isPreview ? 'Tin nhắn đã được lưu trong phiên xem trước.' : 'Đã gửi tin nhắn.');
    } catch (error) {
      if (!valid(captured) || error.name === 'AbortError') return;
      failed.set(payload.clientMessageId, { ...payload, conversationId: id });
      if (id === selectedId) renderMessages();
      notice('Chưa gửi được tin nhắn. Bạn có thể thử lại.', true);
    } finally {
      if (valid(captured)) { sending = false; updateSendButtonState(); }
    }
  }

  function renderPeople(search = '') {
    const target = dialog.querySelector('[data-chat-people]'); if (!target) return;
    const shown = dialogPeople.filter(p => fold(`${p.displayName} ${p.roleLabel}`).includes(fold(search)));
    const emptyText = dialogPeople.length
      ? 'Không tìm thấy người phù hợp với từ khóa.'
      : dialogMode === 'add-members'
        ? 'Không có đồng nghiệp nào khác để thêm vào nhóm.'
        : 'Chưa có đồng nghiệp có tài khoản WorkTree đang hoạt động trong doanh nghiệp này.';
    target.innerHTML = shown.length ? shown.map(p => `<label class="chat-person-option">${dialogMode === 'new-message' ? `<input type="radio" name="recipient" value="${escapeHtml(p.membershipId)}" ${selectedPeople.has(p.membershipId) ? 'checked' : ''}>` : `<input type="checkbox" value="${escapeHtml(p.membershipId)}" ${selectedPeople.has(p.membershipId) ? 'checked' : ''}>`}${avatar(p.displayName, p.tone, false, '', p.portrait, p.userId === context?.userId ? (localAvatarUrl || profileAvatarUrl) : null)}<span><strong>${escapeHtml(p.displayName)}</strong><small>${escapeHtml(p.roleLabel || 'Thành viên')}</small></span>${icon('check')}</label>`).join('') : `<p class="chat-no-people">${emptyText}</p>`;
    renderSelectedPeople();
  }
  function renderSelectedPeople() {
    const target = dialog.querySelector('[data-chat-selected]'); if (!target) return;
    target.innerHTML = [...selectedPeople].map(id => { const p = dialogPeople.find(item => item.membershipId === id); return p ? `<button type="button" class="chat-selected-person" data-chat-unselect="${escapeHtml(id)}">${escapeHtml(p.displayName.split(' ').slice(-2).join(' '))}${icon('x')}<span class="sr-only">Bỏ chọn</span></button>` : ''; }).join('');
    const submit = dialog.querySelector('[type="submit"]');
    if (submit) { submit.disabled = !selectedPeople.size || (dialogMode === 'create-group' && !dialog.querySelector('[name="name"]')?.value.trim()); submit.textContent = dialogMode === 'new-message' ? 'Bắt đầu trò chuyện' : dialogMode === 'add-members' ? `Thêm ${selectedPeople.size || ''} thành viên` : `Tạo nhóm${selectedPeople.size ? ` (${selectedPeople.size + 1})` : ''}`; }
  }
  async function openDialog(mode, trigger) {
    if (!adapter) return;
    dialogMode = mode; modalTrigger = trigger || document.activeElement; selectedPeople = new Set(); dialogPeople = [];
    const rename = mode === 'rename-group'; const title = rename ? 'Chỉnh sửa nhóm' : mode === 'new-message' ? 'Bắt đầu cuộc trò chuyện' : mode === 'add-members' ? 'Thêm thành viên' : 'Tạo nhóm mới';
    const isPrev = adapter.isPreview === true;
    dialog.innerHTML = `<form data-chat-dialog-form><div class="dialog-head"><div><p class="overline">WORKTREE X / TIN NHẮN</p><h2 id="chatDialogTitle">${title}</h2></div>${iconButton('close-dialog', 'Đóng hộp thoại', 'x')}</div><div class="dialog-scroll chat-dialog-body"><p class="chat-dialog-description">${rename ? 'Một tên gọi dễ nhớ để cả nhóm luôn tìm thấy nhau.' : mode === 'add-members' ? (isPrev ? 'Thành viên mới sẽ xem được lịch sử trò chuyện trong bản minh họa.' : 'Thành viên mới trong doanh nghiệp sẽ xem được lịch sử trò chuyện của nhóm.') : mode === 'new-message' ? 'Chọn một đồng nghiệp để gửi lời chào.' : 'Tập hợp những người cùng làm việc, để ý tưởng luôn được kết nối.'}</p>
      ${mode === 'create-group' || rename ? `<label class="field">Tên nhóm <span aria-hidden="true">*</span><input name="name" required maxlength="100" placeholder="Ví dụ: Thiết kế sản phẩm" value="${escapeHtml(rename ? current.title : '')}"></label><label class="field chat-description-field">Mô tả <span class="chat-optional">(không bắt buộc)</span><textarea name="description" rows="2" maxlength="500" placeholder="Nhóm của bạn sẽ cùng làm điều gì?">${escapeHtml(rename ? current.description : '')}</textarea></label>` : ''}
      ${!rename ? `<div class="chat-picker-title"><h3>${mode === 'new-message' ? 'Đồng nghiệp' : 'Thêm thành viên'}</h3><span>${isPrev ? 'Danh bạ minh họa' : 'Danh bạ doanh nghiệp'}</span></div><label class="chat-search">${icon('search')}<input type="search" data-chat-people-search aria-label="Tìm thành viên" placeholder="Tìm theo tên..." autocomplete="off"></label><div class="chat-selected-people" data-chat-selected></div><div class="chat-person-list" data-chat-people>${skeleton()}</div>` : ''}
      <p class="chat-dialog-error" role="alert" data-chat-dialog-error></p></div><div class="dialog-foot"><span class="chat-dialog-preview">${isPrev ? 'Chỉ lưu trong phiên xem trước' : 'Đồng bộ theo doanh nghiệp'}</span><button type="button" class="btn" data-chat-action="close-dialog">Hủy</button><button type="submit" class="btn primary" ${rename ? '' : 'disabled'}>${rename ? 'Lưu thay đổi' : mode === 'new-message' ? 'Bắt đầu trò chuyện' : 'Tạo nhóm'}</button></div></form>`;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('input')?.focus();
    if (rename) return;
    await loadDialogPeople({ focusSearch: mode === 'new-message' });
  }
  async function loadDialogPeople({ focusSearch = false } = {}) {
    const target = dialog.querySelector('[data-chat-people]');
    const search = dialog.querySelector('[data-chat-people-search]');
    if (!adapter || !dialog.open || !target || !search || target.getAttribute('aria-busy') === 'true') return;
    const captured = context;
    const mode = dialogMode;
    const isCurrent = () => valid(captured) && dialog.open && dialog.contains(target);
    target.setAttribute('aria-busy', 'true');
    target.innerHTML = skeleton();
    search.disabled = true;
    try {
      const page = await adapter.listEligibleParticipants(captured, {});
      if (!isCurrent()) return;
      dialogPeople = mode === 'add-members' ? page.items.filter(p => !participants.some(existing => existing.userId === p.userId)) : page.items;
      search.disabled = false;
      renderPeople(search.value);
      if (focusSearch) search.focus();
    } catch (error) {
      if (!isCurrent() || error.name === 'AbortError') return;
      const message = error.code === 'MIGRATION_REQUIRED'
        ? 'Danh bạ chat cần được quản trị viên cập nhật.'
        : 'Chưa tải được danh bạ.';
      target.innerHTML = `<div class="chat-no-people chat-directory-error"><p role="status">${message}</p><button type="button" class="btn small" data-chat-action="retry-directory">Thử lại</button></div>`;
      if (focusSearch) target.querySelector('button')?.focus();
    } finally { target.removeAttribute('aria-busy'); }
  }
  async function submitDialog(event) {
    event.preventDefault();
    const submit = dialog.querySelector('[type="submit"]'); if (submit.disabled) return;
    const captured = context; const mode = dialogMode; const id = selectedId;
    const data = new FormData(event.target); submit.disabled = true; submit.textContent = 'Đang lưu...';
    try {
      let result;
      if (mode === 'new-message') result = await adapter.getOrCreateDirectConversation(captured, [...selectedPeople][0]);
      else if (mode === 'create-group') result = await adapter.createGroup(captured, { name: data.get('name'), description: data.get('description') || '', participantMembershipIds: [...selectedPeople] });
      else if (mode === 'add-members') await adapter.addParticipants(captured, id, [...selectedPeople]);
      else if (mode === 'rename-group') await adapter.updateGroup(captured, id, { name: data.get('name'), description: data.get('description') || '' });
      if (!valid(captured)) return;
      dialog.close(); await refreshList();
      if (result) await selectConversation(result.id, { focus: true }); else { await refreshSelected(); if (infoOpen) info.querySelector('h2')?.focus({ preventScroll: true }); }
      notice(mode === 'create-group'
        ? (adapter.isPreview ? 'Đã tạo nhóm trong phiên xem trước.' : 'Đã tạo nhóm trò chuyện mới.')
        : mode === 'new-message'
          ? 'Cuộc trò chuyện đã sẵn sàng.'
          : (adapter.isPreview ? 'Đã cập nhật nhóm trong phiên xem trước.' : 'Đã lưu thông tin nhóm.'));
    } catch (error) {
      if (valid(captured) && dialog.open) { dialog.querySelector('[data-chat-dialog-error]').textContent = 'Chưa lưu được. Kiểm tra thông tin và thử lại.'; submit.disabled = false; submit.textContent = 'Thử lại'; }
    }
  }

  async function action(name, button) {
    if (name === 'create-task') return createTaskFromMessage(button.dataset.message);
    if (name === 'choose-avatar') { $('[data-chat-avatar-file]').click(); return; }
    if (name === 'close-dialog') { dialog.close(); return; }
    if (name === 'create-group' || name === 'new-message' || name === 'add-members' || name === 'rename-group') return openDialog(name, button);
    if (name === 'close-info') return setInfo(false);
    if (name === 'toggle-info') return setInfo(!infoOpen);
    if (name === 'back') { document.body.classList.remove('chat-conversation-open'); workbench.classList.remove('has-conversation'); selectedId = null; current = null; ++detailRequest; setInfo(false, false); renderList(); setRoute(null); $('[data-chat-search]')?.focus({ preventScroll: true }); return; }
    if (name === 'retry-list') return refreshList();
    if (name === 'retry-directory') return loadDialogPeople({ focusSearch: true });
    if (name === 'retry-conversation') return selectConversation(selectedId);
    if (name === 'clear-filter') { filter = 'all'; query = ''; $('[data-chat-search]').value = ''; renderList(); return; }
    if (name === 'cancel-reply') { replyTo = null; renderReply(); return; }
    if (name === 'reply') { replyTo = messages.find(m => m.id === button.dataset.message); renderReply(); $('[data-chat-draft]')?.focus(); return; }
    if (name === 'attach-file') { $('[data-chat-attachment-file]')?.click(); return; }
    if (name === 'attachment-unavailable') { notice('Đính kèm tệp sẽ khả dụng ở bản chat kết nối.'); return; }
    if (name === 'emoji-picker') { const picker = $('[data-chat-emoji-picker]'); picker.hidden = !picker.hidden; button.setAttribute('aria-expanded', String(!picker.hidden)); if (!picker.hidden) picker.querySelector('button').focus(); return; }
    if (name === 'jump-latest') { const scroll = $('[data-chat-scroll]'); scroll.scrollTop = scroll.scrollHeight; return; }
    if (name === 'search-messages' || name === 'close-message-search') {
      searchOpen = name === 'search-messages' ? !searchOpen : false;
      $('.chat-message-search').hidden = !searchOpen;
      $('[data-chat-action="search-messages"]').setAttribute('aria-expanded', String(searchOpen));
      if (searchOpen) $('[data-chat-message-search]').focus(); else { messageQuery = ''; $('[data-chat-message-search]').value = ''; renderMessages(); $('[data-chat-action="search-messages"]').focus(); }
      return;
    }
    if (!current || !adapter) return;
    const captured = context;
    if (name === 'mute') { await adapter.setConversationPreferences(captured, selectedId, { muted: !current.muted }); if (valid(captured)) await refreshSelected(); }
    if (name === 'pin-conversation') { await adapter.setConversationPreferences(captured, selectedId, { pinned: !current.pinned }); if (valid(captured)) await refreshSelected(); }
    if (name === 'pin-message') { await adapter.pinMessage(captured, selectedId, button.dataset.message); if (valid(captured)) { await refreshSelected(); notice('Đã ghim tin nhắn.'); } }
    if (name === 'older-messages') {
      const id = selectedId; const scroll = $('[data-chat-scroll]'); const height = scroll.scrollHeight;
      button.disabled = true;
      const page = await adapter.listMessages(captured, id, { beforeCursor: nextMessagesCursor, limit: 50 });
      if (!valid(captured) || id !== selectedId) return;
      messages = [...page.items.filter(item => !messages.some(existing => existing.id === item.id)), ...messages];
      nextMessagesCursor = page.nextCursor; hasOlder = page.hasMore; renderMessages(); scroll.scrollTop += scroll.scrollHeight - height;
    }
  }
  function onClick(event) {
    const nav = event.target.closest('[data-chat-open]');
    if (nav) { event.preventDefault(); setRoute(selectedId); open(selectedId); return; }
    if (!host.contains(event.target) && !dialog.contains(event.target)) return;
    const conversationButton = event.target.closest('[data-chat-conversation]');
    if (conversationButton) { selectConversation(conversationButton.dataset.chatConversation, { focus: true }); return; }
    const filterButton = event.target.closest('[data-chat-filter]');
    if (filterButton) { filter = filterButton.dataset.chatFilter; renderList(); return; }
    const actionButton = event.target.closest('[data-chat-action]');
    if (actionButton && !actionButton.disabled) { Promise.resolve(action(actionButton.dataset.chatAction, actionButton)).catch(error => { if (error.name !== 'AbortError') notice('Chưa thực hiện được thao tác. Vui lòng thử lại.', true); }); return; }
    const jump = event.target.closest('[data-chat-jump]');
    if (jump) { const message = document.getElementById(`chat-message-${jump.dataset.chatJump}`); message?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); message?.classList.add('chat-message-highlight'); setTimeout(() => message?.classList.remove('chat-message-highlight'), 1500); return; }
    const reaction = event.target.closest('[data-chat-reaction]');
    if (reaction && adapter && current) { adapter.toggleReaction(context, selectedId, reaction.dataset.message, reaction.dataset.chatReaction).catch(() => notice('Chưa thêm được cảm xúc. Vui lòng thử lại.', true)); return; }
    const emoji = event.target.closest('[data-chat-emoji]');
    if (emoji) { const textarea = $('[data-chat-draft]'); textarea.setRangeText(emoji.dataset.chatEmoji, textarea.selectionStart, textarea.selectionEnd, 'end'); drafts.set(draftKey(), textarea.value); $('[data-chat-emoji-picker]').hidden = true; $('[data-chat-action="emoji-picker"]').setAttribute('aria-expanded', 'false'); textarea.dispatchEvent(new Event('input', { bubbles: true })); textarea.focus(); return; }
    const retry = event.target.closest('[data-chat-retry]'); if (retry) { const payload = failed.get(retry.dataset.chatRetry); if (payload) send(payload); return; }
    const unselect = event.target.closest('[data-chat-unselect]'); if (unselect) { selectedPeople.delete(unselect.dataset.chatUnselect); renderPeople(dialog.querySelector('[data-chat-people-search]').value); return; }
    const aiToggle = event.target.closest('[data-chat-ai-toggle]');
    if (aiToggle && current) {
      setAiSummary(!aiOpenedIds.has(current.id)); return;
    }
    const aiRefresh = event.target.closest('[data-chat-ai-refresh]');
    if (aiRefresh && current) {
      void requestAiSummary(current.id, { force: true }); return;
    }
    const aiClose = event.target.closest('[data-chat-ai-close]');
    if (aiClose && current) { setAiSummary(false); return; }
    const aiIdxBtn = event.target.closest('[data-chat-ai-task-idx]');
    if (aiIdxBtn) { createTaskFromAiItem(aiIdxBtn.dataset.chatAiTaskIdx); return; }
    const aiTaskBtn = event.target.closest('[data-chat-ai-task]');
    if (aiTaskBtn) { createTaskFromMessage(aiTaskBtn.dataset.chatAiTask); return; }
    const removeAttBtn = event.target.closest('[data-chat-remove-attachment]');
    if (removeAttBtn) {
      pendingAttachments = pendingAttachments.filter(a => a.id !== removeAttBtn.dataset.chatRemoveAttachment);
      renderPendingAttachments();
      return;
    }
    const openAttBtn = event.target.closest('[data-chat-open-attachment]');
    if (openAttBtn) {
      void openMessageAttachment(openAttBtn.dataset.message, openAttBtn.dataset.chatOpenAttachment);
      return;
    }
  }
  document.addEventListener('click', onClick, { signal: events.signal });
  host.addEventListener('input', event => {
    if (event.target.matches('[data-chat-search]')) { query = event.target.value; renderList(); }
    if (event.target.matches('[data-chat-message-search]')) { messageQuery = event.target.value; renderMessages(); }
    if (event.target.matches('[data-chat-draft]')) { drafts.set(draftKey(), event.target.value); updateSendButtonState(); resizeComposer(); }
  }, { signal: events.signal });
  host.addEventListener('change', event => {
    if (event.target.matches('[data-chat-attachment-file]')) {
      const files = [...(event.target.files || [])];
      event.target.value = '';
      void handleAttachmentFiles(files);
      return;
    }
    if (!event.target.matches('[data-chat-avatar-file]')) return;
    const file = event.target.files[0];
    event.target.value = '';
    void chooseOwnAvatar(file);
  }, { signal: events.signal });
  host.addEventListener('submit', event => { if (event.target.matches('[data-chat-compose]')) { event.preventDefault(); send(); } }, { signal: events.signal });
  host.addEventListener('scroll', event => {
    if (event.target.matches?.('[data-chat-scroll]')) { const scroller = event.target; const jump = $('[data-chat-action="jump-latest"]'); if (jump) jump.hidden = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 150; }
  }, { capture: true, signal: events.signal });
  dialog.addEventListener('submit', submitDialog, { signal: events.signal });
  dialog.addEventListener('input', event => { if (event.target.matches('[data-chat-people-search]')) renderPeople(event.target.value); if (event.target.name === 'name' && dialogMode === 'create-group') renderSelectedPeople(); }, { signal: events.signal });
  dialog.addEventListener('change', event => { if (!event.target.matches('[data-chat-people] input')) return; if (dialogMode === 'new-message') selectedPeople.clear(); if (event.target.checked) selectedPeople.add(event.target.value); else selectedPeople.delete(event.target.value); renderSelectedPeople(); }, { signal: events.signal });
  dialog.addEventListener('close', () => { if (modalTrigger?.isConnected) modalTrigger.focus({ preventScroll: true }); }, { signal: events.signal });
  host.addEventListener('keydown', event => {
    if (event.target.matches('[data-chat-draft]') && event.key === 'Enter' && !event.shiftKey && !event.isComposing && !matchMedia('(max-width: 900px)').matches) { event.preventDefault(); send(); }
    if (event.key === 'Escape') {
      if (!$('[data-chat-emoji-picker]')?.hidden) { const picker = $('[data-chat-emoji-picker]'); if (picker) picker.hidden = true; $('[data-chat-action="emoji-picker"]')?.setAttribute('aria-expanded', 'false'); $('[data-chat-draft]')?.focus(); }
      else if (infoOpen) setInfo(false);
      else if (current && aiOpenedIds.has(current.id) && event.target.closest('[data-chat-ai-summary], [data-chat-ai-toggle]')) {
        event.preventDefault();
        setAiSummary(false);
      }
      else if (searchOpen) action('close-message-search');
    }
    // The slide-over panel is modal at narrow widths. Keep its focus inside.
    if (event.key === 'Tab' && infoOpen && matchMedia('(max-width: 1449px)').matches && info.contains(event.target)) {
      const focusable = [...info.querySelectorAll('button,input,[tabindex="0"]')].filter(el => !el.disabled && el.offsetParent !== null);
      if (event.shiftKey && (event.target === focusable[0] || event.target.tagName === 'H2')) { event.preventDefault(); focusable.at(-1)?.focus(); }
      else if (!event.shiftKey && event.target === focusable.at(-1)) { event.preventDefault(); focusable[0]?.focus(); }
    }
  }, { signal: events.signal });
  document.addEventListener('worktree:navigate', close, { signal: events.signal });
  if (taskBridge) document.addEventListener('worktree:task-drawer-rendered', attachSourceButton, { signal: events.signal });
  document.addEventListener('worktree:open-messages', () => { setRoute(selectedId); open(selectedId); }, { signal: events.signal });
  const updateViewport = () => {
    if (!active) return;
    const overlay = infoOpen && matchMedia('(max-width: 1449px)').matches;
    thread.inert = overlay; $('.chat-inbox').inert = overlay;
    if (window.visualViewport && matchMedia('(max-width: 900px)').matches) {
      const height = `${window.visualViewport.height}px`;
      host.style.setProperty('--chat-visible-height', height);
      dialog.style.setProperty('--chat-visible-height', height);
    }
  };
  window.visualViewport?.addEventListener('resize', updateViewport, { signal: events.signal });
  window.addEventListener('resize', updateViewport, { signal: events.signal });
  window.addEventListener('hashchange', () => { if (/^#messages(?:\/|$)/.test(location.hash)) open(decodeURIComponent(location.hash.slice(10))); else if (!standalone) close(); }, { signal: events.signal });
  function contextChanged() {
    const next = getContext();
    if (context && context.organizationId === next?.organizationId && context.userId === next?.userId) return;
    clearOwnAvatar();
    abortController?.abort(); unsubscribeAdapter?.(); adapter?.dispose?.();
    abortController = new AbortController(); context = { ...next, signal: abortController.signal };
    conversations = []; messages = []; participants = []; selectedId = null; current = null; replyTo = null; pendingAttachments = []; uploadingAttachment = false;
    drafts.clear(); failed.clear(); taskSources.clear(); clearConversationAiState(); sending = false; ++listRequest; ++detailRequest;
    clearTimeout(noticeTimer); live.textContent = ''; dialogPeople = []; selectedPeople.clear(); dialogMode = null;
    document.body.classList.remove('chat-conversation-open');
    workbench.classList.remove('has-conversation'); setInfo(false, false); if (dialog.open) dialog.close();
    dialog.replaceChildren(); info.replaceChildren();
    list.innerHTML = skeleton(); renderThread(); updateNavigation();
    if (!next?.organizationId || !next.userId) { adapter = null; renderOwnAvatar(); close(); return; }
    adapter = createAdapter(context);
    renderOwnAvatar();
    const captured = context;
    adapter.subscribe(context, { conversationChanged: queueRefresh, messagesChanged: queueRefresh, readStateChanged: queueRefresh,
      membershipRevoked: event => {
        if (!valid(captured)) return;
        if (event?.conversationId) {
          drafts.delete(draftKey(event.conversationId));
          clearConversationAiState(event.conversationId);
          conversations = conversations.filter(c => c.id !== event.conversationId);
          for (const [key, item] of failed) if (item.conversationId === event.conversationId) failed.delete(key);
          if (selectedId === event.conversationId) {
            ++detailRequest; selectedId = null; current = null; messages = []; participants = []; replyTo = null;
            document.body.classList.remove('chat-conversation-open'); workbench.classList.remove('has-conversation'); setInfo(false, false); renderThread(); setRoute(null);
          }
          if (dialog.open) dialog.close(); renderList(); updateNavigation();
        } else {
          drafts.clear(); failed.clear(); clearConversationAiState(); conversations = []; messages = []; participants = []; current = null; selectedId = null; replyTo = null;
          close(); renderList(); renderThread(); abortController.abort(); unsubscribeAdapter?.(); adapter?.dispose?.(); adapter = null;
        }
        notice('Bạn không còn quyền truy cập cuộc trò chuyện này.', true);
      },
      connectionChanged: () => { if (valid(captured)) queueRefresh(); }
    }).then(unsubscribe => { if (valid(captured)) unsubscribeAdapter = unsubscribe; else unsubscribe(); }).catch(() => {});
    if (standalone || active || /^#messages(?:\/|$)/.test(location.hash)) open(location.hash.startsWith('#messages/') ? decodeURIComponent(location.hash.slice(10)) : null);
  }
  for (const element of document.querySelectorAll('.chat-nav-icon')) element.innerHTML = icon('messageSquare');
  const unsubscribeContext = subscribeContext(contextChanged);
  contextChanged();
  return {
    open,
    close,
    setProfileAvatar(url) {
      profileAvatarUrl = url;
      renderOwnAvatar();
      renderMessages();
      if (infoOpen) renderInfo();
    },
    dispose() { disposed = true; close(); clearOwnAvatar(); clearConversationAiState(); abortController?.abort(); events.abort(); unsubscribeAdapter?.(); unsubscribeContext?.(); adapter?.dispose?.(); clearTimeout(noticeTimer); drafts.clear(); failed.clear(); taskSources.clear(); dialog.remove(); host.replaceChildren(); }
  };
}
