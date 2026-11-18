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

const pendingZaloConfirmations = globalThis.__worktreeZaloPending || (globalThis.__worktreeZaloPending = new Map());
const ZALO_CONFIRM_TTL_MS = 10 * 60 * 1000;

function foldVi(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function getTodayIsoVn() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function addDaysIso(isoDate, delta) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function parseVietnameseDeadline(text, baseIso = getTodayIsoVn()) {
  const folded = foldVi(text);
  if (!folded) return null;

  const isoMatch = folded.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];

  const dmyMatch = folded.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    let year = dmyMatch[3] ? Number(dmyMatch[3]) : Number(baseIso.slice(0, 4));
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  if (/\bhom nay\b/.test(folded)) return baseIso;
  if (/\bngay mai\b|\bmai\b/.test(folded)) return addDaysIso(baseIso, 1);
  if (/\bngay kia\b/.test(folded)) return addDaysIso(baseIso, 2);
  if (/\btuan sau\b/.test(folded)) return addDaysIso(baseIso, 7);

  const weekdayMap = [
    { re: /\b(?:thu\s*hai|thu\s*2|t2)\b/, dow: 1 },
    { re: /\b(?:thu\s*ba|thu\s*3|t3)\b/, dow: 2 },
    { re: /\b(?:thu\s*tu|thu\s*4|t4)\b/, dow: 3 },
    { re: /\b(?:thu\s*nam|thu\s*5|t5)\b/, dow: 4 },
    { re: /\b(?:thu\s*sau|thu\s*6|t6)\b/, dow: 5 },
    { re: /\b(?:thu\s*bay|thu\s*7|t7)\b/, dow: 6 },
    { re: /\b(?:chu\s*nhat|cn)\b/, dow: 0 }
  ];
  for (const w of weekdayMap) {
    if (w.re.test(folded)) {
      const curDow = new Date(`${baseIso}T00:00:00Z`).getUTCDay();
      let diff = (w.dow - curDow + 7) % 7;
      if (diff === 0) diff = 7;
      return addDaysIso(baseIso, diff);
    }
  }
  return null;
}

function scoreTitleMatch(queryText, taskTitle) {
  const q = foldVi(queryText);
  const t = foldVi(taskTitle);
  if (!q || !t) return 0;
  if (t === q) return 100;
  if (t.includes(q)) return 85;
  if (q.includes(t)) return 75;
  const tokens = q.split(/\s+/).filter(w => w.length >= 2 && !['viec', 'task', 'nhe', 'nha', 'di', 'roi', 'xong', 'da'].includes(w));
  if (!tokens.length) return 0;
  const hitCount = tokens.filter(tok => t.includes(tok)).length;
  return hitCount > 0 ? Math.round((hitCount / tokens.length) * 65) : 0;
}

const STATUS_LABEL_MAP = {
  todo: 'Chưa làm',
  in_progress: 'Đang làm',
  review: 'Chờ duyệt',
  done: 'Hoàn thành'
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
   * Format and send a notification when someone comments on a task
   */
  async sendCommentNotification({
    zaloChatId,
    taskTitle,
    nodeName = 'Toàn công ty',
    authorName = 'Thành viên nhóm',
    commentBody = '',
    taskId = null
  }) {
    if (!zaloChatId) {
      return { ok: false, description: 'Chưa liên kết Zalo' };
    }

    const shortComment = (commentBody || '').length > 300
      ? (commentBody || '').substring(0, 300) + '...'
      : (commentBody || '');

    const message = [
      '**💬 WORKTREE X — BÌNH LUẬN MỚI TRÊN CÔNG VIỆC**',
      '━━━━━━━━━━━━━━━━━━━━━━━━━',
      `📋 **Công việc:** ${taskTitle}`,
      `🏢 **Đơn vị:** ${nodeName}`,
      `👤 **Người bình luận:** ${authorName}`,
      `💬 **Nội dung:** "${shortComment}"`,
      '━━━━━━━━━━━━━━━━━━━━━━━━━',
      '👉 **Mở WorkTree X để xem trao đổi & phản hồi:**',
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
   * Resolve WorkTree tenant context (employee + membership + scopes) from zalo_chat_id.
   */
  async resolveZaloEmployeeContext(sb, chatId) {
    if (!sb || typeof sb.from !== 'function' || !chatId) return null;

    const { data: empRows, error: empErr } = await sb
      .from('employees')
      .select('id, organization_id, full_name, email, phone, job_title, home_node_id, employment_status, zalo_chat_id')
      .eq('zalo_chat_id', String(chatId))
      .eq('employment_status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (empErr || !Array.isArray(empRows) || empRows.length === 0) return null;
    const emp = empRows[0];

    const [{ data: org }, { data: memRows }] = await Promise.all([
      sb.from('organizations')
        .select('id, name, slug, timezone, status, root_node_id')
        .eq('id', emp.organization_id)
        .maybeSingle(),
      sb.from('organization_members')
        .select('id, organization_id, user_id, employee_id, role, status')
        .eq('organization_id', emp.organization_id)
        .eq('employee_id', emp.id)
        .eq('status', 'active')
        .limit(1)
    ]);

    if (!org || (org.status && org.status !== 'active')) return null;

    const membership = Array.isArray(memRows) ? (memRows[0] || null) : memRows;
    let role = membership?.role || 'member';
    let scopeNodeIds = emp.home_node_id ? [emp.home_node_id] : [];

    if (membership?.id && !['owner', 'admin'].includes(role)) {
      const { data: scopes } = await sb
        .from('member_scopes')
        .select('node_id')
        .eq('organization_id', emp.organization_id)
        .eq('membership_id', membership.id);
      if (Array.isArray(scopes) && scopes.length > 0) {
        scopeNodeIds = scopes.map(s => s.node_id).filter(Boolean);
      }
    }

    return {
      organizationId: emp.organization_id,
      organization: org,
      employee: emp,
      membership,
      userId: membership?.user_id || null,
      role,
      scopeNodeIds
    };
  },

  /**
   * Two-way Conversational Copilot for linked employees via Zalo Bot.
   * Enforces tenant/role/scope isolation and requires confirmation before DB writes.
   */
  async handleConversationalCopilot({ chatId, text, employeeCtx, sb, sendFn = null }) {
    const key = String(chatId);
    const send = typeof sendFn === 'function' ? sendFn : (cid, msg) => this.sendMessage(cid, msg);
    const { organizationId, organization, employee, role, userId, scopeNodeIds } = employeeCtx;
    const folded = foldVi(text);
    const today = getTodayIsoVn();

    // 1. Check pending confirmation flow first
    const pending = pendingZaloConfirmations.get(key);
    if (pending && pending.expiresAt < Date.now()) {
      pendingZaloConfirmations.delete(key);
    }

    if (pending && pending.expiresAt >= Date.now()) {
      if (/^(ok|oke|xac nhan|dong y|chot|yes|y|co|duyet)$/.test(folded)) {
        pendingZaloConfirmations.delete(key);
        try {
          const execResult = await pending.execute();
          await send(chatId, execResult.reply);
          return { handled: true, copilotAction: 'confirmed', intent: pending.intent, ...execResult.meta };
        } catch (err) {
          await send(chatId, `**❌ KHÔNG THỂ THỰC HIỆN**\n${err.message || 'Đã xảy ra lỗi khi lưu dữ liệu.'}`);
          return { handled: true, copilotAction: 'error', error: err.message };
        }
      }
      if (/^(huy|khong|bo qua|cancel|no|thoi)$/.test(folded)) {
        pendingZaloConfirmations.delete(key);
        await send(chatId, '🚫 Đã hủy thao tác chờ xác nhận. Bạn cần hỗ trợ gì khác cứ nhắn nhé!');
        return { handled: true, copilotAction: 'cancelled', intent: pending.intent };
      }
    }

    // Load scoped readable nodes & tasks within the employee's organization ONLY
    const [{ data: orgNodes = [] }, { data: orgClosures = [] }, { data: rawTasks = [] }] = await Promise.all([
      sb.from('organization_nodes')
        .select('id, organization_id, parent_id, type, name')
        .eq('organization_id', organizationId)
        .is('archived_at', null),
      sb.from('organization_node_closure')
        .select('ancestor_id, descendant_id')
        .eq('organization_id', organizationId),
      sb.from('tasks')
        .select('*')
        .eq('organization_id', organizationId)
        .is('archived_at', null)
    ]);

    const actionableNodes = new Set();
    if (['owner', 'admin'].includes(role)) {
      orgNodes.forEach(n => actionableNodes.add(n.id));
    } else {
      for (const rootId of (scopeNodeIds || [])) {
        actionableNodes.add(rootId);
        for (const c of orgClosures) {
          if (c.ancestor_id === rootId) actionableNodes.add(c.descendant_id);
        }
      }
    }

    const canRead = (t) => {
      if (!t || t.organization_id !== organizationId || t.archived_at) return false;
      if (role === 'owner' || role === 'admin') return true;
      if (role === 'member') {
        const isAssignee = t.primary_assignee_id === employee.id;
        const isCollab = Array.isArray(t.collaborator_ids) && t.collaborator_ids.includes(employee.id);
        return isAssignee || isCollab;
      }
      return actionableNodes.has(t.node_id);
    };

    const canMutateTask = (t) => {
      if (!canRead(t) || role === 'viewer') return false;
      if (role === 'member') {
        return t.primary_assignee_id === employee.id || (Array.isArray(t.collaborator_ids) && t.collaborator_ids.includes(employee.id));
      }
      return ['owner', 'admin'].includes(role) || actionableNodes.has(t.node_id);
    };

    const readableTasks = rawTasks.filter(canRead);

    // Intent A: Report / Query urgent or overdue or assigned tasks
    const isTaskQuery = /(viec nao|hom nay|tre han|qua han|deadline|sap het han|viec gap|cua toi|bao cao|cong viec)/.test(folded)
      && !/(bao xong|hoan thanh|da xong|xong viec|nhac |giao |tao viec )/.test(folded);

    if (isTaskQuery) {
      const openTasks = readableTasks.filter(t => t.status !== 'done');
      const lateOrUrgent = openTasks
        .filter(t => (t.due_date && t.due_date <= addDaysIso(today, 2)) || t.priority === 'urgent' || t.priority === 'high')
        .sort((a, b) => String(a.due_date || '9999-12-31').localeCompare(String(b.due_date || '9999-12-31')));
      const listToShow = (lateOrUrgent.length ? lateOrUrgent : openTasks).slice(0, 6);

      if (listToShow.length === 0) {
        const msg = [
          `**✨ CHÀO ${employee.full_name.toUpperCase()} (${organization.name})**`,
          'Hiện tại bạn không có công việc nào đang quá hạn hoặc khẩn cấp cần xử lý gấp.',
          `Tổng công việc đang mở trong phạm vi: **${openTasks.length}**.`
        ].join('\n');
        await send(chatId, msg);
        return { handled: true, copilotIntent: 'query_tasks', tasksCount: 0 };
      }

      const lines = listToShow.map((t, idx) => {
        const isLate = Boolean(t.due_date && t.due_date < today);
        const dueStr = t.due_date ? (isLate ? `⚠️ Quá hạn (${t.due_date})` : `📅 Hạn ${t.due_date}`) : 'Chưa đặt hạn';
        const priStr = t.priority === 'urgent' ? '🔴 Khẩn cấp' : t.priority === 'high' ? '🟠 Cao' : '🔵 Bình thường';
        return `${idx + 1}. **${t.title}**\n   ${priStr} · ${dueStr} · Tiến độ ${t.progress || 0}%`;
      });

      const msg = [
        `**📋 VIỆC CẦN CHÚ Ý — ${employee.full_name}**`,
        `🏢 ${organization.name} · Ngày ${today}`,
        '━━━━━━━━━━━━━━━━━━━━━━━━━',
        ...lines,
        '━━━━━━━━━━━━━━━━━━━━━━━━━',
        '💡 *Nhắn "Báo xong [tên việc]" để cập nhật nhanh, hoặc mở WorkTree X xem chi tiết.*'
      ].join('\n');
      await send(chatId, msg);
      return { handled: true, copilotIntent: 'query_tasks', tasksCount: listToShow.length };
    }

    // Intent B: Complete / Update Task Status -> Preview & Require Confirmation
    const completeMatch = folded.match(/^(?:bao xong|hoan thanh|da xong|xong viec|cap nhat xong)\s*(?:viec|task)?\s*(.+)$/);
    if (completeMatch && role !== 'viewer') {
      const phrase = completeMatch[1].replace(/\b(nhe|nha|di|giup|voi|a)\b/g, ' ').trim();
      const candidates = readableTasks
        .filter(t => t.status !== 'done' && canMutateTask(t))
        .map(t => ({ task: t, score: scoreTitleMatch(phrase, t.title) }))
        .filter(x => x.score >= 30)
        .sort((a, b) => b.score - a.score);

      if (candidates.length === 0) {
        await send(chatId, `🤔 Mình chưa tìm thấy đầu việc đang mở nào khớp với "**${phrase || text}**" trong phạm vi của bạn.\nNhắn *"Hôm nay tôi có việc nào?"* để xem chính xác tên công việc nhé.`);
        return { handled: true, copilotIntent: 'propose_complete', requiresConfirmation: false, matched: false };
      }

      const targetTask = candidates[0].task;
      const nowIso = new Date().toISOString();
      pendingZaloConfirmations.set(key, {
        intent: 'complete_task',
        expiresAt: Date.now() + ZALO_CONFIRM_TTL_MS,
        execute: async () => {
          const { data: updated, error } = await sb
            .from('tasks')
            .update({ status: 'done', progress: 100, completed_at: nowIso })
            .eq('organization_id', organizationId)
            .eq('id', targetTask.id)
            .select()
            .single();
          if (error) throw error;
          if (sb.from) {
            try {
              await sb.from('activity_logs').insert({
                organization_id: organizationId,
                actor_user_id: userId,
                action: 'task.status_changed',
                task_id: targetTask.id,
                node_id: targetTask.node_id,
                summary: `${employee.full_name} báo hoàn thành "${targetTask.title}" qua Zalo Bot`
              });
            } catch (_) {}
          }
          return {
            reply: [
              '**✅ ĐÃ CẬP NHẬT TRẠNG THÁI TRÊN WORKTREE X**',
              '━━━━━━━━━━━━━━━━━━━━━━━━━',
              `📋 **Công việc:** ${updated?.title || targetTask.title}`,
              `📊 **Trạng thái:** ${STATUS_LABEL_MAP[targetTask.status] || targetTask.status} ➔ **🟢 Hoàn thành (100%)**`,
              `👤 **Người xác nhận:** ${employee.full_name}`
            ].join('\n'),
            meta: { taskId: targetTask.id, status: 'done' }
          };
        }
      });

      const previewMsg = [
        '**📝 XÁC NHẬN CẬP NHẬT CÔNG VIỆC**',
        '━━━━━━━━━━━━━━━━━━━━━━━━━',
        `📋 **Công việc:** ${targetTask.title}`,
        `📊 **Thay đổi:** ${STATUS_LABEL_MAP[targetTask.status] || targetTask.status} (${targetTask.progress || 0}%) ➔ **🟢 Hoàn thành (100%)**`,
        '━━━━━━━━━━━━━━━━━━━━━━━━━',
        '👉 Nhắn **OK** hoặc **XÁC NHẬN** để lưu vào hệ thống *(hoặc nhắn **HỦY** để bỏ qua)*.'
      ].join('\n');
      await send(chatId, previewMsg);
      return { handled: true, copilotIntent: 'propose_complete', requiresConfirmation: true, taskId: targetTask.id, taskTitle: targetTask.title };
    }

    // Intent C: Assign / Create task via natural phrasing (Managers/Admins/Owners)
    const assignMatch = text.trim().match(/^(?:nhắc|giao|tạo việc(?:\s+cho)?|nhờ)\s+([^\s,:]+(?:\s+[^\s,:]+){0,2}?)\s+(?:làm|xử lý|thực hiện|triển khai|kiểm tra|hoàn thiện|gửi|soạn|chuẩn bị|gọi)\s+(.+)$/i)
      || text.trim().match(/^(?:nhắc|giao|tạo việc(?:\s+cho)?|nhờ)\s+([^\s,:]+)\s*[:,]\s*(.+)$/i);
    if (assignMatch) {
      if (!['owner', 'admin', 'manager'].includes(role)) {
        await send(chatId, '🔒 Vai trò hiện tại của bạn không có quyền giao việc mới cho người khác qua Zalo. Bạn chỉ có thể hỏi việc hoặc báo hoàn thành công việc được giao.');
        return { handled: true, copilotIntent: 'propose_create_task', denied: true };
      }

      const { data: orgEmployees = [] } = await sb
        .from('employees')
        .select('id, full_name, home_node_id, employment_status')
        .eq('organization_id', organizationId)
        .eq('employment_status', 'active');

      const rawTargetPerson = assignMatch[1];
      let matchedEmp = orgEmployees.find(e => foldVi(e.full_name).split(' ').pop() === foldVi(rawTargetPerson));
      if (!matchedEmp) {
        matchedEmp = orgEmployees.find(e => foldVi(e.full_name).includes(foldVi(rawTargetPerson)));
      }

      let rawBody = assignMatch[2].trim();
      const parsedDue = parseVietnameseDeadline(rawBody, today);
      const cleanTitle = rawBody
        .replace(/\b(?:trước|hạn|vào)\s+(?:\d{1,2}h(?:\d{2})?\s+)?(?:hôm nay|ngày mai|ngày kia|tuần sau|thứ\s+\S+|chủ\s+nhật|\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/gi, '')
        .replace(/[.!?]+$/, '')
        .trim()
        .slice(0, 180) || rawBody.slice(0, 180);

      const targetNodeId = matchedEmp?.home_node_id || [...actionableNodes][0] || organization.root_node_id || orgNodes[0]?.id || null;
      const actorCreatorId = userId || employee.id;

      pendingZaloConfirmations.set(key, {
        intent: 'create_task',
        expiresAt: Date.now() + ZALO_CONFIRM_TTL_MS,
        execute: async () => {
          const { data: created, error } = await sb
            .from('tasks')
            .insert({
              organization_id: organizationId,
              node_id: targetNodeId,
              primary_assignee_id: matchedEmp?.id || null,
              title: cleanTitle,
              description: `Khởi tạo từ Zalo Copilot bởi ${employee.full_name}: "${text.trim()}"`,
              status: 'todo',
              priority: /gap|khan/i.test(folded) ? 'high' : 'medium',
              due_date: parsedDue,
              estimate_minutes: 120,
              progress: 0,
              created_by: actorCreatorId
            })
            .select()
            .single();
          if (error) throw error;
          return {
            reply: [
              '**✅ ĐÃ TẠO CÔNG VIỆC MỚI TRÊN WORKTREE X**',
              '━━━━━━━━━━━━━━━━━━━━━━━━━',
              `📋 **Tên việc:** ${created?.title || cleanTitle}`,
              `👤 **Phụ trách:** ${matchedEmp?.full_name || 'Chưa giao'}`,
              `📅 **Hạn hoàn thành:** ${parsedDue || 'Chưa đặt hạn'}`
            ].join('\n'),
            meta: { taskId: created?.id, assigneeId: matchedEmp?.id || null, dueDate: parsedDue }
          };
        }
      });

      const previewMsg = [
        '**📝 XÁC NHẬN TẠO CÔNG VIỆC MỚI**',
        '━━━━━━━━━━━━━━━━━━━━━━━━━',
        `📋 **Công việc:** ${cleanTitle}`,
        `👤 **Giao cho:** ${matchedEmp?.full_name || 'Chưa xác định (sẽ để Chưa giao)'}`,
        `📅 **Hạn hoàn thành:** ${parsedDue || 'Chưa đặt hạn'}`,
        '━━━━━━━━━━━━━━━━━━━━━━━━━',
        '👉 Nhắn **OK** hoặc **XÁC NHẬN** để tạo việc *(hoặc nhắn **HỦY** để bỏ qua)*.'
      ].join('\n');
      await send(chatId, previewMsg);
      return {
        handled: true,
        copilotIntent: 'propose_create_task',
        requiresConfirmation: true,
        draft: { title: cleanTitle, assigneeId: matchedEmp?.id || null, assigneeName: matchedEmp?.full_name || null, dueDate: parsedDue }
      };
    }

    // Default help for linked employee
    const helpMsg = [
      `👋 Xin chào **${employee.full_name}** (${organization.name}),`,
      'Tôi là **Trợ lý Công việc 2 chiều WorkTree X**. Bạn có thể nhắn tự nhiên với tôi:',
      '━━━━━━━━━━━━━━━━━━━━━━━━━',
      '1️⃣ *"Hôm nay tôi có việc nào gấp sắp trễ hạn?"*',
      '2️⃣ *"Báo xong việc [tên công việc]"* *(Bot sẽ tóm tắt hỏi xác nhận trước khi lưu)*',
      ['owner', 'admin', 'manager'].includes(role)
        ? '3️⃣ *"Nhắc [Tên nhân sự] làm [đầu việc] trước thứ Sáu"*'
        : '3️⃣ Mở WorkTree X: https://worktree.nguyentronghuu.com'
    ].join('\n');
    await send(chatId, helpMsg);
    return { handled: true, copilotIntent: 'help' };
  },

  /**
   * Process incoming webhook or polling message from Zalo user.
   * Handles 1-touch pairing by phone number and 2-way Conversational Copilot for linked staff.
   */
  async processIncomingMessage(eventData, customSupabase = null, options = {}) {
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

    // 2. Two-way Conversational Copilot for linked employees (only when queryable Supabase is available)
    const copilotSb = customSupabase && typeof customSupabase.from === 'function' ? customSupabase : null;
    if (copilotSb && text) {
      try {
        const employeeCtx = await this.resolveZaloEmployeeContext(copilotSb, chatId);
        if (employeeCtx) {
          return await this.handleConversationalCopilot({
            chatId,
            text,
            employeeCtx,
            sb: copilotSb,
            sendFn: options.sendMessage
          });
        }
      } catch (copilotErr) {
        console.error('[ZaloBot] Copilot error:', copilotErr);
      }
    }

    // 3. Help / Greeting response if not phone number and not linked
    const welcomeMsg = [
      `**👋 Xin chào ${displayName || 'bạn'}!**`,
      'Tôi là **Trợ lý Thông báo Tự động** của nền tảng **WorkTree X**.',
      '━━━━━━━━━━━━━━━━━━━━━━━━━',
      '📱 **Để liên kết và nhận thông báo công việc:**',
      'Vui lòng **gửi số điện thoại** bạn đã đăng ký với công ty vào đây (ví dụ: `0912345678`).',
      '',
      'Hệ thống sẽ tự động ghép nối và kích hoạt thông báo cho bạn ngay lập tức!'
    ].join('\n');

    if (typeof options.sendMessage === 'function') {
      await options.sendMessage(chatId, welcomeMsg);
    } else {
      await this.sendMessage(chatId, welcomeMsg);
    }
    return { handled: true, isGreeting: true };
  }
};
