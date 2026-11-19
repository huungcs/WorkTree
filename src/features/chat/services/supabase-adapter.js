/**
 * WorkTree X Feature: Supabase Internal Chat Adapter
 * Production multi-tenant chat backend implementing the contract in
 * docs/architecture/CHAT_FEATURE_HANDOFF.md.
 */

import { getSupabase } from '../../../lib/supabase/client.js';

const TONES = ['purple', 'blue', 'green', 'amber'];
const VALID_EMOJIS = new Set(['👍', '❤️', '🎉', '👀']);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHAT_STORAGE_BUCKET = 'chat-files';
const CHAT_MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

function sanitizeAttachmentFileName(fileName) {
  const clean = String(fileName || 'tep-dinh-kem.bin')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .split(/[\\/]/).filter(Boolean).pop() || 'tep-dinh-kem.bin';
  return clean.replace(/\.\.+/g, '.').replace(/[<>:"|?*]/g, '_').slice(0, 180) || 'tep-dinh-kem.bin';
}

function clone(value) {
  return structuredClone(value);
}

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase();
}

function toneForId(id) {
  const s = String(id || '');
  let sum = 0;
  for (let i = 0; i < s.length; i += 1) sum = (sum + s.charCodeAt(i)) % TONES.length;
  return TONES[sum] || 'purple';
}

function mapAdapterError(err) {
  const msg = String(err?.message || err || 'Lỗi kết nối máy chủ chat.');
  if (err?.code === 'PGRST205' || err?.code === '42P01' || /chat_(conversations|messages|participants)/i.test(msg)) {
    return Object.assign(
      new Error('Cơ sở dữ liệu chưa cập nhật bảng Chat nội bộ (vui lòng chạy migration 20261119110000_add_internal_chat.sql).'),
      { code: 'MIGRATION_REQUIRED' }
    );
  }
  if (msg.includes('UNAUTHENTICATED')) {
    return Object.assign(new Error('Phiên đăng nhập đã hết hạn.'), { code: 'UNAUTHENTICATED' });
  }
  if (msg.includes('FORBIDDEN') || err?.code === '42501') {
    return Object.assign(new Error('Bạn không có quyền truy cập cuộc trò chuyện này.'), { code: 'FORBIDDEN' });
  }
  if (msg.includes('NOT_FOUND')) {
    return Object.assign(new Error('Không tìm thấy cuộc trò chuyện hoặc tin nhắn.'), { code: 'NOT_FOUND' });
  }
  if (msg.includes('VALIDATION_ERROR:')) {
    return Object.assign(new Error(msg.split('VALIDATION_ERROR:')[1].trim()), { code: 'VALIDATION_ERROR' });
  }
  return Object.assign(new Error('Không thể xử lý thao tác trò chuyện lúc này.'), { code: 'NETWORK_ERROR' });
}

function mapMessageDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    clientMessageId: row.client_message_id || null,
    organizationId: row.organization_id,
    conversationId: row.conversation_id,
    senderUserId: row.sender_user_id || null,
    kind: row.kind || 'text',
    text: row.deleted_at ? '' : (row.body || ''),
    replyToMessageId: row.reply_to_message_id || null,
    attachments: Array.isArray(row.metadata?.attachments) ? clone(row.metadata.attachments) : [],
    reactions: Array.isArray(row.reactions) ? clone(row.reactions) : [],
    createdAt: row.created_at,
    editedAt: row.edited_at || null,
    deletedAt: row.deleted_at || null
  };
}

export function createSupabaseChatAdapter(initialContext) {
  const scope = {
    organizationId: initialContext?.organizationId,
    userId: initialContext?.userId,
    displayName: initialContext?.displayName || 'Bạn'
  };
  if (!scope.organizationId || !scope.userId) {
    throw new Error('Chat cloud adapter requires an active organizationId and userId.');
  }

  let disposed = false;
  let cachedSupabase = initialContext?.supabase || null;
  let directoryCache = new Map(); // userId -> participant DTO
  const listeners = new Set();
  let rtChannel = null;
  let refreshTimer = null;

  function assertContext(context) {
    if (disposed || context?.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    if (context?.organizationId !== scope.organizationId || context?.userId !== scope.userId) {
      throw Object.assign(new Error('Không có quyền truy cập.'), { code: 'FORBIDDEN' });
    }
  }

  async function sbClient() {
    if (!cachedSupabase) {
      cachedSupabase = await getSupabase();
    }
    return cachedSupabase;
  }

  async function ensureDirectory(sb, force = false) {
    if (!force && directoryCache.size > 0) return directoryCache;
    const { data, error } = await sb.rpc('list_chat_eligible_participants', {
      p_organization_id: scope.organizationId,
      p_query: ''
    });
    if (error) throw mapAdapterError(error);
    const nextMap = new Map();
    for (const row of data || []) {
      nextMap.set(row.user_id, {
        userId: row.user_id,
        membershipId: row.membership_id,
        employeeId: row.employee_id || null,
        displayName: row.display_name || 'Thành viên',
        roleLabel: row.role_label || 'Thành viên',
        tone: toneForId(row.user_id),
        avatarPath: null,
        portrait: null,
        groupRole: 'member',
        joinedAt: null
      });
    }
    directoryCache = nextMap;
    return directoryCache;
  }

  function buildConversationDto(row, selfPart, convParts, lastMsg, unreadCount, dir) {
    const memberIds = convParts.map(p => p.user_id);
    const otherUserId = row.type === 'direct' ? memberIds.find(uid => uid !== scope.userId) : null;
    const otherPerson = otherUserId ? dir.get(otherUserId) : null;
    const title = row.type === 'direct'
      ? (otherPerson?.displayName || 'Đồng nghiệp')
      : (row.title || 'Nhóm trò chuyện');
    const isGroupManager = row.type === 'group' && (selfPart?.group_role === 'owner' || selfPart?.group_role === 'admin');
    const isGroupOwner = row.type === 'group' && selfPart?.group_role === 'owner';

    return {
      id: row.id,
      organizationId: row.organization_id,
      type: row.type,
      title,
      description: row.description || '',
      memberIds,
      unreadCount: Number(unreadCount || 0),
      pinned: Boolean(selfPart?.pinned),
      muted: Boolean(selfPart?.muted),
      tone: row.type === 'direct' ? (otherPerson?.tone || toneForId(row.id)) : toneForId(row.id),
      avatarPath: null,
      portrait: null,
      participantCount: memberIds.length,
      capabilities: {
        canSend: true,
        canRename: isGroupManager,
        canAddMembers: isGroupManager,
        canRemoveMembers: isGroupManager,
        canTransferOwnership: isGroupOwner,
        canLeave: row.type === 'group',
        canPinMessages: true
      },
      updatedAt: lastMsg?.createdAt || row.updated_at || row.created_at,
      lastMessage: lastMsg || null,
      pinnedMessageIds: row.pinned_message_id ? [row.pinned_message_id] : []
    };
  }

  async function hydrateConversations(sb, convRows, allParticipants, dir) {
    const convIds = convRows.map(c => c.id);
    if (!convIds.length) return [];

    const { data: recentMsgs = [], error: msgErr } = await sb
      .from('chat_messages')
      .select('id, organization_id, conversation_id, sender_user_id, client_message_id, kind, body, reply_to_message_id, metadata, reactions, created_at, edited_at, deleted_at')
      .eq('organization_id', scope.organizationId)
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })
      .limit(Math.max(50, convIds.length * 10));

    if (msgErr) throw mapAdapterError(msgErr);

    const lastByConv = new Map();
    const msgsByConv = new Map();
    for (const m of recentMsgs || []) {
      if (!lastByConv.has(m.conversation_id)) {
        lastByConv.set(m.conversation_id, mapMessageDto(m));
      }
      if (!msgsByConv.has(m.conversation_id)) msgsByConv.set(m.conversation_id, []);
      msgsByConv.get(m.conversation_id).push(m);
    }

    return convRows.map(c => {
      const convParts = (allParticipants || []).filter(p => p.conversation_id === c.id && !p.removed_at);
      const selfPart = convParts.find(p => p.user_id === scope.userId);
      const readAtMs = selfPart?.last_read_at ? new Date(selfPart.last_read_at).getTime() : 0;
      const unread = (msgsByConv.get(c.id) || []).filter(m =>
        m.sender_user_id !== scope.userId
        && new Date(m.created_at).getTime() > readAtMs
      ).length;
      return buildConversationDto(c, selfPart, convParts, lastByConv.get(c.id) || null, unread, dir);
    });
  }

  function emit(name, detail = {}) {
    for (const listener of listeners) {
      try {
        listener[name]?.(detail);
      } catch {}
    }
  }

  return {
    isPreview: false,

    async listConversations(context, { filter = 'all', query = '' } = {}) {
      assertContext(context);
      const sb = await sbClient();
      const [dir, { data: myParts = [], error: myErr }] = await Promise.all([
        ensureDirectory(sb),
        sb
          .from('chat_participants')
          .select('conversation_id')
          .eq('organization_id', scope.organizationId)
          .eq('user_id', scope.userId)
          .is('removed_at', null)
      ]);
      if (myErr) throw mapAdapterError(myErr);

      const convIds = [...new Set((myParts || []).map(p => p.conversation_id).filter(Boolean))];
      if (!convIds.length) return { items: [], nextCursor: null, hasMore: false };

      const [
        { data: convRows = [], error: convErr },
        { data: allParts = [], error: partErr }
      ] = await Promise.all([
        sb
          .from('chat_conversations')
          .select('*')
          .eq('organization_id', scope.organizationId)
          .in('id', convIds)
          .is('archived_at', null),
        sb
          .from('chat_participants')
          .select('*')
          .eq('organization_id', scope.organizationId)
          .in('conversation_id', convIds)
          .is('removed_at', null)
      ]);
      if (convErr) throw mapAdapterError(convErr);
      if (partErr) throw mapAdapterError(partErr);

      const dtos = await hydrateConversations(sb, convRows || [], allParts || [], dir);
      const foldedQ = fold(query);
      const filtered = dtos
        .filter(c => (filter !== 'unread' || c.unreadCount > 0) && (filter !== 'groups' || c.type === 'group') && fold(c.title).includes(foldedQ))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));

      return { items: clone(filtered), nextCursor: null, hasMore: false };
    },

    async listEligibleParticipants(context, { query = '' } = {}) {
      assertContext(context);
      const sb = await sbClient();
      const dir = await ensureDirectory(sb, true);
      const foldedQ = fold(query);
      const items = [...dir.values()]
        .filter(p => p.userId !== scope.userId && fold(`${p.displayName} ${p.roleLabel}`).includes(foldedQ));
      return { items: clone(items), nextCursor: null, hasMore: false };
    },

    async getConversation(context, id) {
      assertContext(context);
      if (!UUID_REGEX.test(String(id || ''))) {
        throw Object.assign(new Error('Không tìm thấy cuộc trò chuyện.'), { code: 'NOT_FOUND' });
      }
      const sb = await sbClient();
      const [
        dir,
        { data: conv, error: convErr },
        { data: convParts = [], error: partErr }
      ] = await Promise.all([
        ensureDirectory(sb),
        sb
          .from('chat_conversations')
          .select('*')
          .eq('organization_id', scope.organizationId)
          .eq('id', id)
          .is('archived_at', null)
          .maybeSingle(),
        sb
          .from('chat_participants')
          .select('*')
          .eq('organization_id', scope.organizationId)
          .eq('conversation_id', id)
          .is('removed_at', null)
      ]);
      if (convErr) throw mapAdapterError(convErr);
      if (partErr) throw mapAdapterError(partErr);
      if (!conv || !(convParts || []).some(p => p.user_id === scope.userId)) {
        throw Object.assign(new Error('Không tìm thấy cuộc trò chuyện.'), { code: 'NOT_FOUND' });
      }

      const [hydrated] = await hydrateConversations(sb, [conv], convParts || [], dir);
      const participants = (convParts || []).map(p => {
        const info = dir.get(p.user_id);
        return {
          userId: p.user_id,
          membershipId: p.membership_id,
          employeeId: info?.employeeId || null,
          displayName: info?.displayName || (p.user_id === scope.userId ? scope.displayName : 'Thành viên'),
          roleLabel: info?.roleLabel || 'Thành viên',
          tone: info?.tone || toneForId(p.user_id),
          avatarPath: null,
          portrait: null,
          groupRole: p.group_role || 'member',
          joinedAt: p.joined_at
        };
      });

      return clone({ conversation: hydrated, participants });
    },

    async listMessages(context, id, { beforeCursor = null, limit = 50 } = {}) {
      assertContext(context);
      if (!UUID_REGEX.test(String(id || ''))) {
        throw Object.assign(new Error('Không tìm thấy cuộc trò chuyện.'), { code: 'NOT_FOUND' });
      }
      const sb = await sbClient();
      const pageLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
      let q = sb
        .from('chat_messages')
        .select('*')
        .eq('organization_id', scope.organizationId)
        .eq('conversation_id', id)
        .order('created_at', { ascending: false })
        .limit(pageLimit + 1);

      if (beforeCursor) {
        q = q.lt('created_at', beforeCursor);
      }
      const { data: rows = [], error } = await q;
      if (error) throw mapAdapterError(error);

      const hasMore = (rows || []).length > pageLimit;
      const slice = hasMore ? rows.slice(0, pageLimit) : (rows || []);
      const chronological = [...slice].reverse().map(mapMessageDto);
      return {
        items: clone(chronological),
        nextCursor: hasMore && chronological.length ? chronological[0].createdAt : null,
        hasMore
      };
    },

    async getOrCreateDirectConversation(context, membershipId) {
      assertContext(context);
      const sb = await sbClient();
      const { data: convId, error } = await sb.rpc('get_or_create_direct_chat', {
        p_organization_id: scope.organizationId,
        p_target_membership_id: membershipId
      });
      if (error || !convId) throw mapAdapterError(error || new Error('NOT_FOUND'));
      const detail = await this.getConversation(context, convId);
      emit('conversationChanged', { conversationId: convId });
      return detail.conversation;
    },

    async createGroup(context, { name, description = '', participantMembershipIds = [] }) {
      assertContext(context);
      if (!name?.trim() || name.trim().length > 100 || !Array.isArray(participantMembershipIds) || !participantMembershipIds.length) {
        throw Object.assign(new Error('Nhập tên nhóm và chọn ít nhất một người.'), { code: 'VALIDATION_ERROR' });
      }
      const sb = await sbClient();
      const { data: convId, error } = await sb.rpc('create_chat_group', {
        p_organization_id: scope.organizationId,
        p_name: name.trim(),
        p_description: String(description || '').trim(),
        p_participant_membership_ids: [...new Set(participantMembershipIds)]
      });
      if (error || !convId) throw mapAdapterError(error || new Error('VALIDATION_ERROR'));
      const detail = await this.getConversation(context, convId);
      emit('conversationChanged', { conversationId: convId });
      return detail.conversation;
    },

    async uploadAttachment(context, conversationId, file) {
      assertContext(context);
      if (!UUID_REGEX.test(String(conversationId || '')) || !file) {
        throw Object.assign(new Error('Tệp hoặc hội thoại không hợp lệ.'), { code: 'VALIDATION_ERROR' });
      }
      const sizeBytes = Number(file.size) || 0;
      if (sizeBytes <= 0 || sizeBytes > CHAT_MAX_FILE_SIZE) {
        throw Object.assign(new Error('Tệp đính kèm phải nhỏ hơn 25 MB.'), { code: 'VALIDATION_ERROR' });
      }
      const sb = await sbClient();
      const attId = crypto.randomUUID();
      const safeName = sanitizeAttachmentFileName(file.name);
      const mimeType = String(file.type || 'application/octet-stream').slice(0, 120);
      const storagePath = `${scope.organizationId}/${conversationId}/${attId}-${safeName}`;
      const { error } = await sb.storage
        .from(CHAT_STORAGE_BUCKET)
        .upload(storagePath, file, {
          upsert: false,
          contentType: mimeType
        });
      if (error) throw mapAdapterError(error);
      return clone({
        id: attId,
        fileName: safeName,
        mimeType,
        sizeBytes,
        storagePath
      });
    },

    async getAttachmentUrl(context, conversationId, attachment) {
      assertContext(context);
      if (attachment?.url) return attachment.url;
      const storagePath = String(attachment?.storagePath || '');
      const expectedPrefix = `${scope.organizationId}/${conversationId}/`;
      if (!storagePath.startsWith(expectedPrefix) || storagePath.includes('..')) {
        throw Object.assign(new Error('Đường dẫn tệp không hợp lệ.'), { code: 'FORBIDDEN' });
      }
      const sb = await sbClient();
      const { data, error } = await sb.storage
        .from(CHAT_STORAGE_BUCKET)
        .createSignedUrl(storagePath, 3600);
      if (error || !data?.signedUrl) throw mapAdapterError(error || new Error('NOT_FOUND'));
      return data.signedUrl;
    },

    async sendMessage(context, id, input = {}) {
      assertContext(context);
      const attachments = Array.isArray(input.attachments) ? input.attachments : [];
      const cleanText = String(input.text || '').trim();
      if (!input.clientMessageId || cleanText.length > 10000 || attachments.length > 5 || (!cleanText.length && !attachments.length)) {
        throw Object.assign(new Error('Tin nhắn cần có nội dung hoặc tối đa 5 tệp đính kèm.'), { code: 'VALIDATION_ERROR' });
      }
      const rpcParams = {
        p_organization_id: scope.organizationId,
        p_conversation_id: id,
        p_client_message_id: String(input.clientMessageId),
        p_text: cleanText || `📎 ${attachments[0]?.fileName || 'Tệp đính kèm'}`,
        p_reply_to_message_id: input.replyToMessageId || null
      };
      if (attachments.length > 0) {
        rpcParams.p_attachments = attachments.map(a => ({
          id: String(a.id || ''),
          fileName: sanitizeAttachmentFileName(a.fileName),
          mimeType: String(a.mimeType || 'application/octet-stream'),
          sizeBytes: Number(a.sizeBytes) || 0,
          storagePath: String(a.storagePath || '')
        }));
      }
      const sb = await sbClient();
      const { data, error } = await sb.rpc('send_chat_message', rpcParams);
      if (error || !data) throw mapAdapterError(error || new Error('NETWORK_ERROR'));
      const dto = clone(mapMessageDto(data));
      emit('messagesChanged', { conversationId: id });
      emit('conversationChanged', { conversationId: id });
      return dto;
    },

    async markRead(context, id, messageId) {
      assertContext(context);
      const sb = await sbClient();
      const { error } = await sb.rpc('mark_chat_read', {
        p_organization_id: scope.organizationId,
        p_conversation_id: id,
        p_message_id: messageId || null
      });
      if (error) throw mapAdapterError(error);
      emit('readStateChanged', { conversationId: id });
      return { unreadCount: 0, lastReadMessageId: messageId || null };
    },

    async setConversationPreferences(context, id, patch = {}) {
      assertContext(context);
      const sb = await sbClient();
      const updateRow = {};
      if (typeof patch.pinned === 'boolean') updateRow.pinned = patch.pinned;
      if (typeof patch.muted === 'boolean') updateRow.muted = patch.muted;
      const { data, error } = await sb
        .from('chat_participants')
        .update(updateRow)
        .eq('organization_id', scope.organizationId)
        .eq('conversation_id', id)
        .eq('user_id', scope.userId)
        .is('removed_at', null)
        .select('pinned, muted')
        .single();
      if (error) throw mapAdapterError(error);
      emit('conversationChanged', { conversationId: id });
      return clone({ pinned: Boolean(data?.pinned), muted: Boolean(data?.muted) });
    },

    async updateGroup(context, id, patch = {}) {
      assertContext(context);
      if (!patch.name?.trim() || patch.name.trim().length > 100) {
        throw Object.assign(new Error('Tên nhóm cần có từ 1 đến 100 ký tự.'), { code: 'VALIDATION_ERROR' });
      }
      const sb = await sbClient();
      const updateRow = { title: patch.name.trim() };
      if (patch.description !== undefined) updateRow.description = String(patch.description || '').trim().slice(0, 500);
      const { error } = await sb
        .from('chat_conversations')
        .update(updateRow)
        .eq('organization_id', scope.organizationId)
        .eq('id', id)
        .eq('type', 'group');
      if (error) throw mapAdapterError(error);
      const detail = await this.getConversation(context, id);
      emit('conversationChanged', { conversationId: id });
      return detail.conversation;
    },

    async addParticipants(context, id, membershipIds = []) {
      assertContext(context);
      const sb = await sbClient();
      const { error } = await sb.rpc('add_chat_participants', {
        p_organization_id: scope.organizationId,
        p_conversation_id: id,
        p_membership_ids: membershipIds
      });
      if (error) throw mapAdapterError(error);
      const detail = await this.getConversation(context, id);
      emit('conversationChanged', { conversationId: id });
      return detail;
    },

    async toggleReaction(context, id, messageId, emoji) {
      assertContext(context);
      if (!VALID_EMOJIS.has(emoji)) {
        throw Object.assign(new Error('Cảm xúc không hợp lệ.'), { code: 'VALIDATION_ERROR' });
      }
      const sb = await sbClient();
      const { data, error } = await sb.rpc('toggle_chat_reaction', {
        p_organization_id: scope.organizationId,
        p_conversation_id: id,
        p_message_id: messageId,
        p_emoji: emoji
      });
      if (error || !data) throw mapAdapterError(error || new Error('NOT_FOUND'));
      emit('messagesChanged', { conversationId: id });
      return clone(mapMessageDto(data));
    },

    async pinMessage(context, id, messageId) {
      assertContext(context);
      const sb = await sbClient();
      const { error } = await sb.rpc('pin_chat_message', {
        p_organization_id: scope.organizationId,
        p_conversation_id: id,
        p_message_id: messageId
      });
      if (error) throw mapAdapterError(error);
      const detail = await this.getConversation(context, id);
      emit('conversationChanged', { conversationId: id });
      return detail.conversation;
    },

    async subscribe(context, handlers = {}) {
      assertContext(context);
      listeners.add(handlers);
      const sb = await sbClient();

      if (!rtChannel && typeof sb.channel === 'function') {
        const scheduleEmit = (kind, convId) => {
          clearTimeout(refreshTimer);
          refreshTimer = setTimeout(() => {
            emit(kind, { conversationId: convId });
          }, 120);
        };

        rtChannel = sb
          .channel(`chat-sync:${scope.organizationId}:${scope.userId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'chat_messages', filter: `organization_id=eq.${scope.organizationId}` },
            (payload) => {
              const row = payload?.new || payload?.old;
              scheduleEmit('messagesChanged', row?.conversation_id);
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'chat_participants', filter: `organization_id=eq.${scope.organizationId}` },
            (payload) => {
              const row = payload?.new || payload?.old;
              if (row?.user_id === scope.userId && row?.removed_at) {
                emit('membershipRevoked', { conversationId: row.conversation_id });
              } else {
                scheduleEmit('conversationChanged', row?.conversation_id);
              }
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'chat_conversations', filter: `organization_id=eq.${scope.organizationId}` },
            (payload) => {
              const row = payload?.new;
              scheduleEmit('conversationChanged', row?.id);
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') emit('connectionChanged', { status: 'connected' });
          });
      }

      return async () => {
        listeners.delete(handlers);
        if (listeners.size === 0 && rtChannel && typeof sb.removeChannel === 'function') {
          const ch = rtChannel;
          rtChannel = null;
          await sb.removeChannel(ch).catch(() => {});
        }
      };
    },

    dispose() {
      disposed = true;
      clearTimeout(refreshTimer);
      listeners.clear();
      directoryCache.clear();
      if (rtChannel && cachedSupabase && typeof cachedSupabase.removeChannel === 'function') {
        const ch = rtChannel;
        rtChannel = null;
        cachedSupabase.removeChannel(ch).catch(() => {});
      }
    }
  };
}
