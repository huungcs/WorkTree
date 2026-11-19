/**
 * WorkTree X — Scoped External Task Share API & Zero-Auth Capability Link Handler
 *
 * Security model:
 * - Public access via `/s/<token>` or `/api/share?token=<token>` ONLY opens the single
 *   task pinned to that hashed token. Invalid/paused/revoked/expired/disabled links ALWAYS
 *   return HTTP 404 {"error":"not_found"} (zero tenant/task disclosure).
 * - External share links NEVER allow deleting tasks or comments, reading employee PII
 *   (email/phone/Zalo ID), viewing organization trees, reading time logs, or seeing comments
 *   marked `is_internal = true` when `hide_internal_comments` is enabled.
 * - Authenticated management API (`/api/share?action=...`) enforces Bearer JWT, active org
 *   membership, role/scope checks (`viewer` denied), and org-level kill switch.
 */

const crypto = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const mcp = require('./mcp');

const {
  loadConfig,
  encryptKey,
  decryptKey,
  sha256Hex,
  readRawBody,
  polyfillRes,
  loadReadableScopeContext,
  canReadTask,
  canManageTask,
  canCollaborateTask,
  getBaseUrl,
  sendNotFound,
  getClientIp,
  isMissingTableError
} = mcp;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_REGEX = /^wtsh_[A-Za-z0-9_-]{24,80}$/;
const VALID_PERMISSIONS = new Set(['view', 'comment', 'edit_progress']);
const VALID_STATUSES = new Set(['todo', 'in_progress', 'review', 'done']);
const VALID_EXPIRE_HOURS = new Set([0, 24, 168, 720]); // 0 = no expiry, 24h, 7d, 30d

const SHARE_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Share-Pin',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

const gShareState = globalThis.__worktreeShareState || {
  pinAttemptBuckets: new Map(),
  publicRateBuckets: new Map(),
  notFoundBuckets: new Map()
};
globalThis.__worktreeShareState = gShareState;

function createShareToken() {
  return `wtsh_${crypto.randomBytes(24).toString('base64url')}`;
}

function createPinHash(pin, pepper) {
  const cleanPin = String(pin || '').trim();
  if (!cleanPin) return null;
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(cleanPin, `${salt}:${pepper}`, 32).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPinHash(pin, storedHash, pepper) {
  if (!storedHash) return true;
  const cleanPin = String(pin || '').trim();
  if (!cleanPin || !String(storedHash).includes(':')) return false;
  const [salt, expectedHex] = String(storedHash).split(':');
  if (!salt || !expectedHex) return false;
  try {
    const actual = crypto.scryptSync(cleanPin, `${salt}:${pepper}`, 32);
    const expected = Buffer.from(expectedHex, 'hex');
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function consumeBucket(map, key, limit, windowMs) {
  const now = Date.now();
  let entry = map.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
  }
  if (entry.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }
  entry.count += 1;
  map.set(key, entry);
  if (map.size > 5000) map.clear();
  return { ok: true };
}

function applyShareHeaders(res) {
  for (const [k, v] of Object.entries(SHARE_HEADERS)) {
    res.setHeader(k, v);
  }
}

function parseQuery(req) {
  const urlSearch = typeof req.url === 'string' && req.url.includes('?')
    ? Object.fromEntries(new URL(req.url, 'http://localhost').searchParams.entries())
    : {};
  return { ...urlSearch, ...(req.query || {}) };
}

function buildShareUrl(req, rawToken) {
  return `${getBaseUrl(req)}/s/${rawToken}`;
}

async function resolvePublicGrant(supabase, rawToken) {
  if (typeof rawToken !== 'string' || !TOKEN_REGEX.test(rawToken.trim())) {
    return null;
  }
  const tokenHash = sha256Hex(rawToken.trim());
  const { data: link, error: linkErr } = await supabase
    .from('task_share_links')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (linkErr || !link || link.status !== 'active') return null;
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) return null;

  const [
    { data: org, error: orgErr },
    { data: orgSettings },
    { data: task, error: taskErr }
  ] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, status')
      .eq('id', link.organization_id)
      .maybeSingle(),
    supabase
      .from('organization_settings')
      .select('organization_id, allow_external_task_share')
      .eq('organization_id', link.organization_id)
      .maybeSingle(),
    supabase
      .from('tasks')
      .select('id, organization_id, title, description, status, priority, start_date, due_date, progress, auto_progress, tags, primary_assignee_id, archived_at, updated_at')
      .eq('organization_id', link.organization_id)
      .eq('id', link.task_id)
      .maybeSingle()
  ]);

  if (orgErr || !org || org.status !== 'active') return null;
  if (orgSettings && orgSettings.allow_external_task_share === false) return null;
  if (taskErr || !task || task.archived_at) return null;

  return { link, org, task };
}

async function fetchPublicTaskDetails(supabase, { link, org, task }) {
  const [
    { data: assignee },
    { data: checklist = [] },
    { data: rawComments = [] },
    { data: rawAttachments = [] },
    { data: rawDeps = [] }
  ] = await Promise.all([
    task.primary_assignee_id
      ? supabase
          .from('employees')
          .select('id, full_name')
          .eq('organization_id', link.organization_id)
          .eq('id', task.primary_assignee_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('task_checklist_items')
      .select('id, content, is_done, sort_order, created_at')
      .eq('organization_id', link.organization_id)
      .eq('task_id', task.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    (() => {
      let q = supabase
        .from('task_comments')
        .select('id, author_user_id, guest_author_name, is_internal, body, created_at')
        .eq('organization_id', link.organization_id)
        .eq('task_id', task.id)
        .order('created_at', { ascending: true });
      if (link.hide_internal_comments !== false) {
        q = q.eq('is_internal', false);
      }
      return q;
    })(),
    supabase
      .from('task_attachments')
      .select('id, original_name, mime_type, size_bytes, created_at')
      .eq('organization_id', link.organization_id)
      .eq('task_id', task.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('task_dependencies')
      .select('depends_on_task_id')
      .eq('organization_id', link.organization_id)
      .eq('task_id', task.id)
  ]);

  const userIds = [...new Set((rawComments || []).map(c => c.author_user_id).filter(Boolean))];
  const profileMap = new Map();
  if (userIds.length > 0) {
    const { data: profiles = [] } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', userIds);
    for (const p of profiles || []) {
      profileMap.set(p.id, p.display_name || 'Thành viên');
    }
  }

  let isBlocked = false;
  if (Array.isArray(rawDeps) && rawDeps.length > 0) {
    const depIds = rawDeps.map(d => d.depends_on_task_id).filter(Boolean);
    if (depIds.length > 0) {
      const { data: depTasks = [] } = await supabase
        .from('tasks')
        .select('id, status')
        .eq('organization_id', link.organization_id)
        .in('id', depIds);
      isBlocked = (depTasks || []).some(dt => dt.status !== 'done');
    }
  }

  const cleanChecklist = (checklist || []).map(item => ({
    id: item.id,
    content: item.content,
    isDone: Boolean(item.is_done),
    sortOrder: item.sort_order || 0
  }));
  const doneCount = cleanChecklist.filter(c => c.isDone).length;

  const cleanComments = (rawComments || [])
    .filter(c => link.hide_internal_comments === false || !c.is_internal)
    .map(c => ({
      id: c.id,
      authorName: c.guest_author_name
        ? `${c.guest_author_name} (Khách)`
        : (profileMap.get(c.author_user_id) || 'Thành viên nhóm'),
      isGuest: Boolean(c.guest_author_name && !c.author_user_id),
      body: c.body,
      createdAt: c.created_at
    }));

  const cleanAttachments = (rawAttachments || []).map(a => ({
    id: a.id,
    originalName: a.original_name,
    mimeType: a.mime_type || 'application/octet-stream',
    sizeBytes: Number(a.size_bytes || 0),
    createdAt: a.created_at
  }));

  return {
    ok: true,
    requiresPin: false,
    share: {
      id: link.id,
      label: link.label,
      permission: link.permission,
      allowChecklistToggle: Boolean(link.allow_checklist_toggle || link.permission === 'edit_progress'),
      hideInternalComments: link.hide_internal_comments !== false,
      expiresAt: link.expires_at || null,
      organizationName: org.name,
      hasPin: Boolean(link.pin_hash)
    },
    task: {
      id: task.id,
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      startDate: task.start_date || null,
      dueDate: task.due_date || null,
      progress: task.status === 'done' ? 100 : Number(task.progress || 0),
      autoProgress: Boolean(task.auto_progress),
      isBlocked,
      tags: Array.isArray(task.tags) ? task.tags : [],
      primaryAssigneeName: assignee?.full_name || null,
      checklistTotal: cleanChecklist.length,
      checklistDone: doneCount,
      updatedAt: task.updated_at
    },
    checklist: cleanChecklist,
    comments: cleanComments,
    attachments: cleanAttachments
  };
}

async function handlePublicGuestRequest(req, res, rawToken, { supabase, pepper }) {
  const ip = getClientIp(req);
  const ipQuota = consumeBucket(gShareState.notFoundBuckets, `nf:${ip}`, 60, 60_000);
  if (!ipQuota.ok) {
    res.setHeader('Retry-After', String(ipQuota.retryAfterSec));
    return sendNotFound(res);
  }

  if (req.method === 'DELETE') {
    return res.status(403).json({
      ok: false,
      error: 'Link chia sẻ ngoài không bao giờ được phép xóa công việc hoặc dữ liệu gốc.'
    });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Phương thức không được hỗ trợ.' });
  }

  const grant = await resolvePublicGrant(supabase, rawToken);
  if (!grant) {
    return sendNotFound(res);
  }

  const pubRate = consumeBucket(gShareState.publicRateBuckets, `pub:${grant.link.id}:${ip}`, 90, 60_000);
  if (!pubRate.ok) {
    res.setHeader('Retry-After', String(pubRate.retryAfterSec));
    return res.status(429).json({ ok: false, error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.' });
  }

  let body = {};
  if (req.method === 'POST') {
    const raw = await readRawBody(req);
    if (raw.tooLarge) return res.status(413).json({ ok: false, error: 'Dữ liệu gửi lên quá lớn.' });
    try {
      body = raw.text ? JSON.parse(raw.text) : {};
    } catch {
      return res.status(400).json({ ok: false, error: 'JSON không hợp lệ.' });
    }
  }

  const submittedPin = req.headers['x-share-pin'] || body.pin || '';
  if (grant.link.pin_hash) {
    const hasAttemptedPin = Boolean(String(submittedPin).trim());
    if (!hasAttemptedPin && req.method === 'GET') {
      return res.status(200).json({
        ok: true,
        requiresPin: true,
        share: {
          label: grant.link.label,
          permission: grant.link.permission,
          organizationName: grant.org.name,
          expiresAt: grant.link.expires_at || null
        }
      });
    }

    const pinGate = consumeBucket(gShareState.pinAttemptBuckets, `pin:${grant.link.id}:${ip}`, 10, 300_000);
    if (!pinGate.ok) {
      res.setHeader('Retry-After', String(pinGate.retryAfterSec));
      return res.status(429).json({
        ok: false,
        requiresPin: true,
        error: 'Bạn đã nhập sai mã PIN quá nhiều lần. Vui lòng thử lại sau 5 phút.'
      });
    }

    if (!verifyPinHash(submittedPin, grant.link.pin_hash, pepper)) {
      return res.status(403).json({
        ok: false,
        requiresPin: true,
        error: 'Mã PIN không đúng.'
      });
    }
  }

  if (req.method === 'GET' || body.guestAction === 'unlock') {
    // Non-blocking view telemetry update
    supabase
      .from('task_share_links')
      .update({
        view_count: Number(grant.link.view_count || 0) + 1,
        last_accessed_at: new Date().toISOString()
      })
      .eq('id', grant.link.id)
      .then(() => {})
      .catch(() => {});

    const payload = await fetchPublicTaskDetails(supabase, grant);
    return res.status(200).json(payload);
  }

  const action = String(body.guestAction || '').trim();
  const { link, task } = grant;
  const guestName = String(body.guestName || 'Khách mời').trim().slice(0, 80) || 'Khách mời';

  if (action === 'delete_task' || action === 'delete_comment' || action === 'delete_checklist' || action === 'archive_task') {
    return res.status(403).json({
      ok: false,
      error: 'Link chia sẻ ngoài không bao giờ được phép xóa công việc hoặc bình luận.'
    });
  }

  if (action === 'add_comment') {
    if (link.permission !== 'comment' && link.permission !== 'edit_progress') {
      return res.status(403).json({ ok: false, error: 'Link này chỉ cấp quyền xem, không được bình luận.' });
    }
    const cleanName = String(body.guestName || '').trim();
    const commentBody = String(body.body || '').trim();
    if (cleanName.length < 1 || cleanName.length > 80) {
      return res.status(400).json({ ok: false, error: 'Vui lòng nhập tên hiển thị của bạn (1–80 ký tự).' });
    }
    if (commentBody.length < 1 || commentBody.length > 5000) {
      return res.status(400).json({ ok: false, error: 'Nội dung bình luận phải từ 1 đến 5.000 ký tự.' });
    }

    const { data: inserted, error: insErr } = await supabase
      .from('task_comments')
      .insert({
        organization_id: link.organization_id,
        task_id: link.task_id,
        author_user_id: null,
        guest_author_name: cleanName,
        share_link_id: link.id,
        is_internal: false,
        body: commentBody
      })
      .select('id, guest_author_name, body, created_at')
      .single();

    if (insErr) throw insErr;
    return res.status(201).json({
      ok: true,
      comment: {
        id: inserted.id,
        authorName: `${inserted.guest_author_name} (Khách)`,
        isGuest: true,
        body: inserted.body,
        createdAt: inserted.created_at
      }
    });
  }

  const checklistAllowed = link.permission === 'edit_progress'
    || (link.permission === 'comment' && link.allow_checklist_toggle === true);

  if (action === 'toggle_checklist') {
    if (!checklistAllowed) {
      return res.status(403).json({ ok: false, error: 'Link này không cho phép thay đổi checklist.' });
    }
    const itemId = String(body.itemId || '').trim();
    if (!UUID_REGEX.test(itemId)) {
      return res.status(400).json({ ok: false, error: 'Mã checklist không hợp lệ.' });
    }

    const { data: item, error: itemErr } = await supabase
      .from('task_checklist_items')
      .select('id, is_done')
      .eq('organization_id', link.organization_id)
      .eq('task_id', link.task_id)
      .eq('id', itemId)
      .maybeSingle();

    if (itemErr || !item) {
      return res.status(404).json({ ok: false, error: 'Không tìm thấy mục checklist thuộc công việc này.' });
    }

    const nextDone = typeof body.isDone === 'boolean' ? body.isDone : !item.is_done;
    const { data: updated, error: updErr } = await supabase
      .from('task_checklist_items')
      .update({ is_done: nextDone })
      .eq('id', item.id)
      .eq('organization_id', link.organization_id)
      .select('id, content, is_done, sort_order')
      .single();

    if (updErr) throw updErr;

    if (task.auto_progress && task.status !== 'done') {
      const { data: allItems = [] } = await supabase
        .from('task_checklist_items')
        .select('id, is_done')
        .eq('organization_id', link.organization_id)
        .eq('task_id', link.task_id);
      const total = allItems.length;
      const done = allItems.filter(x => x.is_done).length;
      const pct = total === 0 ? 0 : Math.round((done / total) * 100);
      await supabase
        .from('tasks')
        .update({ progress: pct })
        .eq('id', task.id)
        .eq('organization_id', link.organization_id);
    }

    await supabase.from('activity_logs').insert({
      organization_id: link.organization_id,
      actor_user_id: null,
      action: 'task.shared_checklist_toggled',
      task_id: task.id,
      summary: `Khách (${guestName}) ${nextDone ? 'đánh dấu xong' : 'bỏ đánh dấu'} checklist qua link chia sẻ`,
      metadata: { share_link_id: link.id, guest_name: guestName, item_id: item.id, is_done: nextDone }
    }).then(() => {}).catch(() => {});

    return res.status(200).json({
      ok: true,
      item: {
        id: updated.id,
        content: updated.content,
        isDone: Boolean(updated.is_done),
        sortOrder: updated.sort_order || 0
      }
    });
  }

  if (action === 'add_checklist') {
    if (!checklistAllowed) {
      return res.status(403).json({ ok: false, error: 'Link này không cho phép thêm mục checklist.' });
    }
    const content = String(body.content || '').trim();
    if (content.length < 1 || content.length > 400) {
      return res.status(400).json({ ok: false, error: 'Nội dung checklist phải từ 1 đến 400 ký tự.' });
    }

    const { data: created, error: createErr } = await supabase
      .from('task_checklist_items')
      .insert({
        organization_id: link.organization_id,
        task_id: link.task_id,
        content,
        is_done: false
      })
      .select('id, content, is_done, sort_order')
      .single();

    if (createErr) throw createErr;

    await supabase.from('activity_logs').insert({
      organization_id: link.organization_id,
      actor_user_id: null,
      action: 'task.shared_checklist_added',
      task_id: task.id,
      summary: `Khách (${guestName}) thêm mục checklist qua link chia sẻ`,
      metadata: { share_link_id: link.id, guest_name: guestName, item_id: created.id }
    }).then(() => {}).catch(() => {});

    return res.status(201).json({
      ok: true,
      item: {
        id: created.id,
        content: created.content,
        isDone: false,
        sortOrder: created.sort_order || 0
      }
    });
  }

  if (action === 'update_progress') {
    if (link.permission !== 'edit_progress') {
      return res.status(403).json({ ok: false, error: 'Link này không cấp quyền cập nhật trạng thái hoặc tiến độ.' });
    }

    const updates = {};
    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      const nextStatus = String(body.status || '').trim();
      if (!VALID_STATUSES.has(nextStatus)) {
        return res.status(400).json({ ok: false, error: 'Trạng thái công việc không hợp lệ.' });
      }
      updates.status = nextStatus;
      if (nextStatus === 'done') updates.progress = 100;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'progress') && updates.status !== 'done') {
      const pct = Number(body.progress);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({ ok: false, error: 'Tiến độ phải nằm trong khoảng 0 đến 100.' });
      }
      updates.progress = Math.round(pct);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ ok: false, error: 'Không có trường trạng thái hoặc tiến độ để cập nhật.' });
    }

    if (updates.status === 'done') {
      const { data: rawDeps = [] } = await supabase
        .from('task_dependencies')
        .select('depends_on_task_id')
        .eq('organization_id', link.organization_id)
        .eq('task_id', task.id);
      if (rawDeps && rawDeps.length > 0) {
        const depIds = rawDeps.map(d => d.depends_on_task_id).filter(Boolean);
        const { data: depTasks = [] } = await supabase
          .from('tasks')
          .select('id, status')
          .eq('organization_id', link.organization_id)
          .in('id', depIds);
        if ((depTasks || []).some(dt => dt.status !== 'done')) {
          return res.status(409).json({
            ok: false,
            error: 'Công việc này còn việc tiền đề chưa hoàn thành nên chưa thể đóng.'
          });
        }
      }
      if (task.auto_progress) {
        const { data: openChecks = [] } = await supabase
          .from('task_checklist_items')
          .select('id')
          .eq('organization_id', link.organization_id)
          .eq('task_id', task.id)
          .eq('is_done', false);
        if (openChecks && openChecks.length > 0) {
          return res.status(409).json({
            ok: false,
            error: 'Vui lòng hoàn tất tất cả mục checklist trước khi chuyển sang Hoàn thành.'
          });
        }
      }
    }

    const { data: updatedTask, error: updTaskErr } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', task.id)
      .eq('organization_id', link.organization_id)
      .select('id, status, progress, updated_at')
      .single();

    if (updTaskErr) throw updTaskErr;

    await supabase.from('activity_logs').insert({
      organization_id: link.organization_id,
      actor_user_id: null,
      action: 'task.shared_progress_updated',
      task_id: task.id,
      summary: `Khách (${guestName}) cập nhật tiến độ qua link chia sẻ`,
      metadata: { share_link_id: link.id, guest_name: guestName, updates }
    }).then(() => {}).catch(() => {});

    return res.status(200).json({
      ok: true,
      task: {
        id: updatedTask.id,
        status: updatedTask.status,
        progress: updatedTask.status === 'done' ? 100 : Number(updatedTask.progress || 0),
        updatedAt: updatedTask.updated_at
      }
    });
  }

  return res.status(400).json({ ok: false, error: `Thao tác không hợp lệ: ${action}` });
}

function formatShareLinkRow(req, row, pepper, currentUserId) {
  const rawToken = row.token_encrypted ? decryptKey(row.token_encrypted, pepper) : null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    taskId: row.task_id,
    createdBy: row.created_by,
    isOwn: row.created_by === currentUserId,
    label: row.label,
    permission: row.permission,
    tokenPrefix: row.token_prefix,
    url: rawToken && row.status !== 'revoked' ? buildShareUrl(req, rawToken) : null,
    hasPin: Boolean(row.pin_hash),
    hideInternalComments: row.hide_internal_comments !== false,
    allowChecklistToggle: Boolean(row.allow_checklist_toggle),
    status: row.status,
    expiresAt: row.expires_at || null,
    viewCount: Number(row.view_count || 0),
    lastAccessedAt: row.last_accessed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function handleShareManagementApi(req, res, { supabase, pepper }) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const jwt = String(authHeader).replace(/^Bearer\s+/i, '').trim();
  if (!jwt) {
    return res.status(401).json({ ok: false, error: 'Yêu cầu đăng nhập để quản lý chia sẻ công việc.' });
  }

  const { data: authData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !authData?.user) {
    return res.status(401).json({ ok: false, error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
  }
  const user = authData.user;

  const query = parseQuery(req);
  let body = {};
  if (req.method === 'POST') {
    const raw = await readRawBody(req);
    if (raw.tooLarge) return res.status(413).json({ ok: false, error: 'Payload quá lớn.' });
    try {
      body = raw.text ? JSON.parse(raw.text) : {};
    } catch {
      return res.status(400).json({ ok: false, error: 'JSON không hợp lệ.' });
    }
  }

  const action = String(query.action || body.action || 'list').trim();
  const organizationId = String(query.organizationId || body.organizationId || '').trim();
  if (!UUID_REGEX.test(organizationId)) {
    return res.status(400).json({ ok: false, error: 'Thiếu hoặc sai định dạng organizationId.' });
  }

  const [
    { data: org, error: orgErr },
    { data: membership, error: memErr },
    { data: orgSettings }
  ] = await Promise.all([
    supabase.from('organizations').select('id, name, status').eq('id', organizationId).maybeSingle(),
    supabase
      .from('organization_members')
      .select('id, role, status, employee_id')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
    supabase
      .from('organization_settings')
      .select('organization_id, allow_external_task_share')
      .eq('organization_id', organizationId)
      .maybeSingle()
  ]);

  if (orgErr || !org || org.status !== 'active') {
    return res.status(403).json({ ok: false, error: 'Tổ chức không tồn tại hoặc đã bị tạm ngưng.' });
  }
  if (memErr || !membership) {
    return res.status(403).json({ ok: false, error: 'Bạn không phải thành viên đang hoạt động của tổ chức này.' });
  }

  const orgPolicyEnabled = orgSettings ? orgSettings.allow_external_task_share !== false : true;
  const isAdmin = membership.role === 'owner' || membership.role === 'admin';

  if (action === 'org_policy' && req.method === 'POST') {
    if (!isAdmin) {
      return res.status(403).json({ ok: false, error: 'Chỉ Chủ doanh nghiệp hoặc Quản trị viên mới được bật/tắt chia sẻ ngoài.' });
    }
    const enabled = Boolean(body.allowExternalTaskShare);
    const { error: upsertErr } = await supabase
      .from('organization_settings')
      .upsert(
        { organization_id: organizationId, allow_external_task_share: enabled },
        { onConflict: 'organization_id' }
      );
    if (upsertErr) throw upsertErr;

    await supabase.from('security_audit_logs').insert({
      organization_id: organizationId,
      actor_user_id: user.id,
      action: 'ORG_SHARE_POLICY_UPDATED',
      resource_type: 'organization_settings',
      metadata: { allow_external_task_share: enabled }
    }).then(() => {}).catch(() => {});

    return res.status(200).json({ ok: true, allowExternalTaskShare: enabled });
  }

  const taskId = String(query.taskId || body.taskId || '').trim();
  const shareId = String(query.shareId || body.shareId || '').trim();

  if (action === 'list' || action === 'create') {
    if (!UUID_REGEX.test(taskId)) {
      return res.status(400).json({ ok: false, error: 'Thiếu hoặc sai định dạng taskId.' });
    }
  } else if (!UUID_REGEX.test(shareId)) {
    return res.status(400).json({ ok: false, error: 'Thiếu hoặc sai định dạng shareId.' });
  }

  const grantForScope = {
    organizationId,
    role: membership.role,
    employeeId: membership.employee_id || null,
    membershipId: membership.id,
    mcpScopeNodeIds: []
  };
  const scopeCtx = await loadReadableScopeContext(supabase, grantForScope);

  async function loadScopedTask(targetTaskId) {
    const { data: t, error: tErr } = await supabase
      .from('tasks')
      .select('id, organization_id, node_id, primary_assignee_id, collaborator_ids, title, archived_at')
      .eq('organization_id', organizationId)
      .eq('id', targetTaskId)
      .maybeSingle();
    if (tErr || !t) return null;
    return t;
  }

  if (action === 'list') {
    const task = await loadScopedTask(taskId);
    if (!task || !canReadTask(grantForScope, task, scopeCtx)) {
      return res.status(403).json({ ok: false, error: 'Bạn không có quyền truy cập công việc này.' });
    }

    let q = supabase
      .from('task_share_links')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('task_id', taskId)
      .neq('status', 'revoked')
      .order('created_at', { ascending: false });

    const canManage = canManageTask(grantForScope, task.node_id, scopeCtx);
    if (!canManage) {
      q = q.eq('created_by', user.id);
    }

    const { data: rows = [], error: listErr } = await q;
    if (listErr) {
      if (isMissingTableError(listErr)) {
        return res.status(503).json({
          ok: false,
          code: 'migration_required',
          error: 'Hệ thống cơ sở dữ liệu chưa cập nhật tính năng Chia sẻ công việc (chưa chạy migration 20261119103000_add_task_share_links.sql).'
        });
      }
      throw listErr;
    }

    return res.status(200).json({
      ok: true,
      role: membership.role,
      canShare: canCollaborateTask(grantForScope, task, scopeCtx),
      isAdmin,
      allowExternalTaskShare: orgPolicyEnabled,
      links: (rows || []).map(r => formatShareLinkRow(req, r, pepper, user.id))
    });
  }

  if (action === 'create' && req.method === 'POST') {
    if (!orgPolicyEnabled) {
      return res.status(403).json({
        ok: false,
        code: 'org_share_disabled',
        error: 'Doanh nghiệp đang tắt tính năng chia sẻ công việc ra ngoài trong Cài đặt bảo mật.'
      });
    }

    const task = await loadScopedTask(taskId);
    if (!task || !canCollaborateTask(grantForScope, task, scopeCtx)) {
      return res.status(403).json({
        ok: false,
        error: 'Bạn không có quyền tạo link chia sẻ cho công việc này (chỉ người được phép thao tác hoặc quản lý đơn vị).'
      });
    }

    const permission = String(body.permission || 'view').trim();
    if (!VALID_PERMISSIONS.has(permission)) {
      return res.status(400).json({ ok: false, error: 'Quyền chia sẻ không hợp lệ (chỉ hỗ trợ view, comment, edit_progress).' });
    }

    const label = String(body.label || `Chia sẻ: ${task.title || 'Công việc'}`).trim().slice(0, 120) || 'Link chia sẻ công việc';
    const rawPin = body.pin ? String(body.pin).trim() : '';
    if (rawPin && !/^[A-Za-z0-9]{4,12}$/.test(rawPin)) {
      return res.status(400).json({ ok: false, error: 'Mã PIN phải gồm 4–12 ký tự chữ hoặc số.' });
    }

    let expiresAt = null;
    if (Object.prototype.hasOwnProperty.call(body, 'expiresInHours') && body.expiresInHours !== null && body.expiresInHours !== '') {
      const hours = Number(body.expiresInHours);
      if (!VALID_EXPIRE_HOURS.has(hours) && (!Number.isFinite(hours) || hours < 1 || hours > 8760)) {
        return res.status(400).json({ ok: false, error: 'Thời hạn link phải từ 1 giờ đến 365 ngày.' });
      }
      if (hours > 0) {
        expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
      }
    } else if (body.expiresAt) {
      const ts = new Date(body.expiresAt).getTime();
      if (!Number.isFinite(ts) || ts <= Date.now()) {
        return res.status(400).json({ ok: false, error: 'Ngày hết hạn không hợp lệ.' });
      }
      expiresAt = new Date(ts).toISOString();
    } else {
      expiresAt = new Date(Date.now() + 168 * 3600 * 1000).toISOString(); // Safe default: 7 days
    }

    const hideInternalComments = body.hideInternalComments !== false;
    const allowChecklistToggle = permission === 'edit_progress'
      ? true
      : (permission === 'comment' && Boolean(body.allowChecklistToggle));

    const rawToken = createShareToken();
    const tokenHash = sha256Hex(rawToken);
    const tokenPrefix = rawToken.slice(0, 12);
    const tokenEncrypted = encryptKey(rawToken, pepper);
    const pinHash = rawPin ? createPinHash(rawPin, pepper) : null;

    const { data: created, error: insErr } = await supabase
      .from('task_share_links')
      .insert({
        organization_id: organizationId,
        task_id: taskId,
        created_by: user.id,
        label,
        permission,
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        token_encrypted: tokenEncrypted,
        pin_hash: pinHash,
        hide_internal_comments: hideInternalComments,
        allow_checklist_toggle: allowChecklistToggle,
        status: 'active',
        expires_at: expiresAt
      })
      .select('*')
      .single();

    if (insErr) throw insErr;

    await Promise.all([
      supabase.from('security_audit_logs').insert({
        organization_id: organizationId,
        actor_user_id: user.id,
        action: 'SHARE_LINK_CREATED',
        resource_type: 'task_share_links',
        metadata: { share_id: created.id, task_id: taskId, permission, has_pin: Boolean(pinHash), expires_at: expiresAt }
      }),
      supabase.from('activity_logs').insert({
        organization_id: organizationId,
        actor_user_id: user.id,
        action: 'task.share_link_created',
        task_id: taskId,
        summary: `Tạo link chia sẻ ngoài (${permission})`,
        metadata: { share_id: created.id, permission }
      })
    ].map(p => p.then(() => {}).catch(() => {})));

    return res.status(201).json({
      ok: true,
      link: {
        ...formatShareLinkRow(req, created, pepper, user.id),
        url: buildShareUrl(req, rawToken)
      }
    });
  }

  // Load existing link for toggle / rotate / update / delete
  const { data: existingLink, error: findErr } = await supabase
    .from('task_share_links')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', shareId)
    .maybeSingle();

  if (findErr || !existingLink || existingLink.status === 'revoked') {
    return res.status(404).json({ ok: false, error: 'Không tìm thấy link chia sẻ hoặc link đã bị thu hồi.' });
  }

  const task = await loadScopedTask(existingLink.task_id);
  const canManage = task && canManageTask(grantForScope, task.node_id, scopeCtx);
  if (existingLink.created_by !== user.id && !canManage) {
    return res.status(403).json({ ok: false, error: 'Bạn chỉ được quản lý link chia sẻ do mình tạo hoặc trong phạm vi phụ trách.' });
  }

  if (action === 'toggle' && req.method === 'POST') {
    const nextStatus = existingLink.status === 'active' ? 'paused' : 'active';
    const { data: updated, error: updErr } = await supabase
      .from('task_share_links')
      .update({ status: nextStatus })
      .eq('id', shareId)
      .eq('organization_id', organizationId)
      .select('*')
      .single();
    if (updErr) throw updErr;

    await supabase.from('security_audit_logs').insert({
      organization_id: organizationId,
      actor_user_id: user.id,
      action: 'SHARE_LINK_TOGGLED',
      resource_type: 'task_share_links',
      metadata: { share_id: shareId, task_id: existingLink.task_id, status: nextStatus }
    }).then(() => {}).catch(() => {});

    return res.status(200).json({ ok: true, link: formatShareLinkRow(req, updated, pepper, user.id) });
  }

  if (action === 'rotate' && req.method === 'POST') {
    const rawToken = createShareToken();
    const { data: updated, error: updErr } = await supabase
      .from('task_share_links')
      .update({
        token_hash: sha256Hex(rawToken),
        token_prefix: rawToken.slice(0, 12),
        token_encrypted: encryptKey(rawToken, pepper),
        status: 'active'
      })
      .eq('id', shareId)
      .eq('organization_id', organizationId)
      .select('*')
      .single();
    if (updErr) throw updErr;

    await supabase.from('security_audit_logs').insert({
      organization_id: organizationId,
      actor_user_id: user.id,
      action: 'SHARE_LINK_ROTATED',
      resource_type: 'task_share_links',
      metadata: { share_id: shareId, task_id: existingLink.task_id }
    }).then(() => {}).catch(() => {});

    return res.status(200).json({
      ok: true,
      link: {
        ...formatShareLinkRow(req, updated, pepper, user.id),
        url: buildShareUrl(req, rawToken)
      }
    });
  }

  if (action === 'delete' && req.method === 'POST') {
    const { error: revErr } = await supabase
      .from('task_share_links')
      .update({ status: 'revoked', token_encrypted: null })
      .eq('id', shareId)
      .eq('organization_id', organizationId);
    if (revErr) throw revErr;

    await supabase.from('security_audit_logs').insert({
      organization_id: organizationId,
      actor_user_id: user.id,
      action: 'SHARE_LINK_REVOKED',
      resource_type: 'task_share_links',
      metadata: { share_id: shareId, task_id: existingLink.task_id }
    }).then(() => {}).catch(() => {});

    return res.status(200).json({ ok: true, revoked: true, shareId });
  }

  return res.status(400).json({ ok: false, error: `Action không hợp lệ: ${action}` });
}

function createShareHandler(overrides = {}) {
  return async function shareRequestHandler(req, res) {
    polyfillRes(res);
    applyShareHeaders(res);

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const cfg = loadConfig(overrides.env);
    const supabase = overrides.supabase || (
      cfg.supabaseUrl && cfg.supabaseKey ? createClient(cfg.supabaseUrl, cfg.supabaseKey) : null
    );
    const pepper = overrides.pepper || cfg.pepper;

    if (!supabase || !pepper) {
      return res.status(503).json({
        ok: false,
        code: 'missing_backend_config',
        error: 'Máy chủ chưa cấu hình biến môi trường SUPABASE_SERVICE_ROLE_KEY (hoặc SUPABASE_SECRET_KEY) trong Vercel Project Settings → Environment Variables.'
      });
    }

    try {
      const query = parseQuery(req);
      let rawToken = typeof query.token === 'string' ? query.token : '';
      if (!rawToken && typeof req.url === 'string') {
        const cleanPath = req.url.split('?')[0];
        if (cleanPath.startsWith('/s/')) {
          rawToken = cleanPath.slice('/s/'.length).replace(/\/+$/, '');
        }
      }

      if (rawToken) {
        return await handlePublicGuestRequest(req, res, rawToken, { supabase, pepper });
      }
      return await handleShareManagementApi(req, res, { supabase, pepper });
    } catch (err) {
      console.error('[Share API Error]', err);
      if (!res.headersSent) {
        return res.status(500).json({ ok: false, error: err.message || 'Internal Server Error' });
      }
      res.end();
    }
  };
}

const defaultHandler = createShareHandler();
defaultHandler.createShareHandler = createShareHandler;
defaultHandler.createShareToken = createShareToken;
defaultHandler.createPinHash = createPinHash;
defaultHandler.verifyPinHash = verifyPinHash;
defaultHandler.handlePublicGuestRequest = handlePublicGuestRequest;
defaultHandler.handleShareManagementApi = handleShareManagementApi;

module.exports = defaultHandler;
