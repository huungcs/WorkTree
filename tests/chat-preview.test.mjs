import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMockChatAdapter } from '../src/features/chat/services/mock-adapter.js';

const context = () => ({ organizationId: 'test-org-a', userId: 'test-user-a', displayName: 'Người thử' });

test('preview adapter rejects a different tenant or user and a cancelled request', async () => {
  const ctx = context(); const adapter = createMockChatAdapter(ctx);
  await assert.rejects(adapter.listConversations({ ...ctx, organizationId: 'test-org-b' }), { code: 'FORBIDDEN' });
  await assert.rejects(adapter.listConversations({ ...ctx, userId: 'other-user' }), { code: 'FORBIDDEN' });
  const abort = new AbortController(); abort.abort();
  await assert.rejects(adapter.listConversations({ ...ctx, signal: abort.signal }), { name: 'AbortError' });
  adapter.dispose();
});

test('retrying a client message ID creates one message and one notification event', async () => {
  const ctx = context(); const adapter = createMockChatAdapter(ctx);
  let count = 0;
  await adapter.subscribe(ctx, { messagesChanged: () => count++ });
  const input = { clientMessageId: crypto.randomUUID(), text: 'Nội dung thử nghiệm', kind: 'text' };
  const [first, retry] = await Promise.all([adapter.sendMessage(ctx, 'preview-design', input), adapter.sendMessage(ctx, 'preview-design', input)]);
  assert.equal(first.id, retry.id);
  const page = await adapter.listMessages(ctx, 'preview-design');
  assert.equal(page.items.filter(m => m.clientMessageId === input.clientMessageId).length, 1);
  assert.equal(count, 1);
  adapter.dispose();
});

test('direct conversations are reused instead of duplicated', async () => {
  const ctx = context(); const adapter = createMockChatAdapter(ctx);
  const first = await adapter.getOrCreateDirectConversation(ctx, 'preview-member-duc');
  const second = await adapter.getOrCreateDirectConversation(ctx, 'preview-member-duc');
  assert.equal(first.id, second.id);
  assert.equal(first.participantCount, 2);
  adapter.dispose();
});

test('group creation validates recipients and deduplicates selections', async () => {
  const ctx = context(); const adapter = createMockChatAdapter(ctx);
  await assert.rejects(adapter.createGroup(ctx, { name: 'Nhóm', participantMembershipIds: ['unknown-membership'] }));
  await assert.rejects(adapter.createGroup(ctx, { name: ' ', participantMembershipIds: ['preview-member-anh'] }));
  const group = await adapter.createGroup(ctx, { name: '  Nhóm mới  ', participantMembershipIds: ['preview-member-anh', 'preview-member-anh'] });
  assert.equal(group.title, 'Nhóm mới');
  const detail = await adapter.getConversation(ctx, group.id);
  assert.equal(detail.participants.length, 2);
  assert.equal(detail.participants.find(p => p.userId === ctx.userId).groupRole, 'owner');
  adapter.dispose();
});

test('reply cannot reference a message from a different conversation', async () => {
  const ctx = context(); const adapter = createMockChatAdapter(ctx);
  const other = await adapter.listMessages(ctx, 'preview-direct-anh');
  await assert.rejects(adapter.sendMessage(ctx, 'preview-design', { clientMessageId: crypto.randomUUID(), text: 'Reply', replyToMessageId: other.items[0].id }));
  adapter.dispose();
});

test('returned DTOs cannot mutate the adapter, and a new session has no old drafts or messages', async () => {
  const ctx = context(); const adapter = createMockChatAdapter(ctx);
  const page = await adapter.listConversations(ctx);
  page.items[0].title = 'Modified';
  assert.notEqual((await adapter.getConversation(ctx, page.items[0].id)).conversation.title, 'Modified');
  const message = await adapter.sendMessage(ctx, 'preview-design', { clientMessageId: crypto.randomUUID(), text: 'Private preview session' });
  adapter.dispose();
  await assert.rejects(adapter.listMessages(ctx, 'preview-design'), { name: 'AbortError' });
  const next = createMockChatAdapter(ctx);
  assert.equal((await next.listMessages(ctx, 'preview-design')).items.some(m => m.id === message.id || m.text === message.text), false);
  next.dispose();
});

test('markup in message content remains literal text in the data contract', async () => {
  const ctx = context(); const adapter = createMockChatAdapter(ctx);
  const text = '<img src=x onerror=alert(1)> & a "quote"';
  const result = await adapter.sendMessage(ctx, 'preview-design', { clientMessageId: crypto.randomUUID(), text });
  assert.equal(result.text, text);
  adapter.dispose();
});
