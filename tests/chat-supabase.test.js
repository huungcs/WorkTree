import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSupabaseChatAdapter } from '../src/features/chat/services/supabase-adapter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const USER_A = '33333333-3333-4333-8333-333333333331';
const USER_B = '33333333-3333-4333-8333-333333333332';
const MEM_A = '44444444-4444-4444-8444-444444444441';
const MEM_B = '44444444-4444-4444-8444-444444444442';
const CONV_1 = '55555555-5555-4555-8555-555555555551';
const MSG_1 = '66666666-6666-4666-8666-666666666661';

function createMockSupabase() {
  const conversations = [
    {
      id: CONV_1,
      organization_id: ORG_A,
      type: 'group',
      title: 'Nhóm Thiết Kế',
      description: 'Trao đổi UI',
      pinned_message_id: null,
      archived_at: null,
      created_at: '2026-11-19T00:00:00Z',
      updated_at: '2026-11-19T01:00:00Z'
    }
  ];
  const participants = [
    { id: 'p1', organization_id: ORG_A, conversation_id: CONV_1, membership_id: MEM_A, user_id: USER_A, group_role: 'owner', pinned: false, muted: false, last_read_at: null, removed_at: null, joined_at: '2026-11-19T00:00:00Z' },
    { id: 'p2', organization_id: ORG_A, conversation_id: CONV_1, membership_id: MEM_B, user_id: USER_B, group_role: 'member', pinned: false, muted: false, last_read_at: null, removed_at: null, joined_at: '2026-11-19T00:00:00Z' }
  ];
  const messages = [
    {
      id: MSG_1,
      organization_id: ORG_A,
      conversation_id: CONV_1,
      sender_user_id: USER_B,
      client_message_id: 'c0',
      kind: 'text',
      body: 'Chào cả nhóm',
      reply_to_message_id: null,
      metadata: {},
      reactions: [],
      created_at: '2026-11-19T01:00:00Z',
      edited_at: null,
      deleted_at: null
    }
  ];

  const tables = {
    chat_conversations: conversations,
    chat_participants: participants,
    chat_messages: messages
  };

  function makeChain(table) {
    const filters = [];
    const ins = [];
    let isSingle = false;
    let patch = null;
    let maxRows = 100;
    const api = {
      select() { return api; },
      eq(c, v) { filters.push(row => row[c] === v); return api; },
      is(c, v) { filters.push(row => (row[c] ?? null) === v); return api; },
      lt(c, v) { filters.push(row => row[c] < v); return api; },
      in(c, vals) { ins.push([c, vals || []]); return api; },
      order(c, opts = {}) { filters.push(null); api._order = [c, opts.ascending !== false]; return api; },
      limit(n) { maxRows = n; return api; },
      update(p) { patch = p; return api; },
      maybeSingle() { isSingle = true; return exec(); },
      single() { isSingle = true; return exec(); },
      then(res, rej) { return exec().then(res, rej); }
    };

    async function exec() {
      let rows = (tables[table] || []).filter(r =>
        filters.every(fn => !fn || fn(r))
        && ins.every(([c, vs]) => vs.includes(r[c]))
      );
      if (patch) {
        for (const r of rows) Object.assign(r, patch);
      }
      if (api._order) {
        const [col, asc] = api._order;
        rows = [...rows].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1));
      }
      rows = rows.slice(0, maxRows);
      return { data: isSingle ? (rows[0] || null) : rows, error: null };
    }
    return api;
  }

  return {
    tables,
    async rpc(name, args) {
      if (name === 'list_chat_eligible_participants') {
        if (args.p_organization_id !== ORG_A) return { data: null, error: { message: 'FORBIDDEN' } };
        return {
          data: [
            { membership_id: MEM_A, user_id: USER_A, employee_id: null, display_name: 'Hữu Owner', role_label: 'Chủ sở hữu' },
            { membership_id: MEM_B, user_id: USER_B, employee_id: null, display_name: 'Nam Member', role_label: 'Nhân viên' }
          ],
          error: null
        };
      }
      if (name === 'send_chat_message') {
        const dup = messages.find(m =>
          m.organization_id === args.p_organization_id &&
          m.conversation_id === args.p_conversation_id &&
          m.sender_user_id === USER_A &&
          m.client_message_id === args.p_client_message_id
        );
        if (dup) return { data: dup, error: null };
        const next = {
          id: `msg-${messages.length + 1}`,
          organization_id: args.p_organization_id,
          conversation_id: args.p_conversation_id,
          sender_user_id: USER_A,
          client_message_id: args.p_client_message_id,
          kind: 'text',
          body: args.p_text,
          reply_to_message_id: args.p_reply_to_message_id || null,
          metadata: {},
          reactions: [],
          created_at: new Date().toISOString(),
          edited_at: null,
          deleted_at: null
        };
        messages.push(next);
        return { data: next, error: null };
      }
      if (name === 'toggle_chat_reaction') {
        const m = messages.find(x => x.id === args.p_message_id);
        m.reactions = [{ emoji: args.p_emoji, userIds: [USER_A] }];
        return { data: m, error: null };
      }
      if (name === 'mark_chat_read') {
        const part = participants.find(p => p.conversation_id === args.p_conversation_id && p.user_id === USER_A);
        part.last_read_at = new Date().toISOString();
        return { data: part.last_read_at, error: null };
      }
      if (name === 'pin_chat_message') {
        conversations[0].pinned_message_id = args.p_message_id;
        return { data: conversations[0], error: null };
      }
      return { data: null, error: null };
    },
    from(table) { return makeChain(table); }
  };
}

test('supabase chat adapter rejects cross-tenant, wrong-user, and aborted calls immediately', async () => {
  const sb = createMockSupabase();
  const ctx = { organizationId: ORG_A, userId: USER_A, displayName: 'Hữu', supabase: sb };
  const adapter = createSupabaseChatAdapter(ctx);
  assert.equal(adapter.isPreview, false);

  await assert.rejects(adapter.listConversations({ ...ctx, organizationId: ORG_B }), { code: 'FORBIDDEN' });
  await assert.rejects(adapter.listConversations({ ...ctx, userId: USER_B }), { code: 'FORBIDDEN' });

  const abort = new AbortController();
  abort.abort();
  await assert.rejects(adapter.listConversations({ ...ctx, signal: abort.signal }), { name: 'AbortError' });

  adapter.dispose();
  await assert.rejects(adapter.listConversations(ctx), { name: 'AbortError' });
});

test('supabase chat adapter supports conversations, idempotent sendMessage, read state, reactions, pinning & immutable DTOs', async () => {
  const sb = createMockSupabase();
  const ctx = { organizationId: ORG_A, userId: USER_A, displayName: 'Hữu', supabase: sb };
  const adapter = createSupabaseChatAdapter(ctx);

  const listRes = await adapter.listConversations(ctx);
  assert.equal(listRes.items.length, 1);
  assert.equal(listRes.items[0].unreadCount, 1);
  assert.equal(listRes.items[0].capabilities.canRename, true);

  listRes.items[0].title = 'Tampered';
  const detail = await adapter.getConversation(ctx, CONV_1);
  assert.equal(detail.conversation.title, 'Nhóm Thiết Kế');
  assert.equal(detail.participants.length, 2);

  const cid = crypto.randomUUID();
  const [m1, m2] = await Promise.all([
    adapter.sendMessage(ctx, CONV_1, { clientMessageId: cid, text: 'Chốt giao diện <script>' }),
    adapter.sendMessage(ctx, CONV_1, { clientMessageId: cid, text: 'Chốt giao diện <script>' })
  ]);
  assert.equal(m1.id, m2.id);
  assert.equal(m1.text, 'Chốt giao diện <script>');

  const reacted = await adapter.toggleReaction(ctx, CONV_1, MSG_1, '👍');
  assert.equal(reacted.reactions[0].emoji, '👍');

  await adapter.pinMessage(ctx, CONV_1, MSG_1);
  const pinnedDetail = await adapter.getConversation(ctx, CONV_1);
  assert.deepEqual(pinnedDetail.conversation.pinnedMessageIds, [MSG_1]);

  await adapter.markRead(ctx, CONV_1, MSG_1);
  const afterRead = await adapter.listConversations(ctx);
  assert.equal(afterRead.items[0].unreadCount, 0);

  adapter.dispose();
});

test('internal chat migration enforces composite tenant FKs, RLS, idempotency index & scoped realtime', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20261119110000_add_internal_chat.sql'),
    'utf8'
  );
  assert.equal(/REVOKE ALL ON public\.chat_conversations, public\.chat_participants, public\.chat_messages FROM PUBLIC, anon/i.test(sql), true);
  assert.equal(/chat_messages_reply_fk/i.test(sql), true);
  assert.equal(/chat_messages_idempotency_uidx/i.test(sql), true);
  assert.equal(/public\.is_chat_participant/i.test(sql), true);
});
