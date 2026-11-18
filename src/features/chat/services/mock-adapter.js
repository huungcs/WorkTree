/** In-memory preview only. No network, browser storage or real workspace data. */
const clone = value => structuredClone(value);
const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
const capabilities = { canSend: true, canRename: true, canAddMembers: true, canRemoveMembers: true, canTransferOwnership: true, canLeave: true, canPinMessages: true };

export function createMockChatAdapter(initialContext) {
  const scope = { organizationId: initialContext.organizationId, userId: initialContext.userId };
  if (!scope.organizationId || !scope.userId) throw new Error('Chat preview requires a workspace and user.');
  let disposed = false;
  const listeners = new Set();
  const people = [
    { userId: scope.userId, membershipId: 'preview-self', displayName: initialContext.displayName || 'Bạn', roleLabel: 'Bạn', tone: 'purple' },
    { userId: 'preview-anh', membershipId: 'preview-member-anh', displayName: 'Nguyễn Minh Anh', roleLabel: 'Product Designer', tone: 'purple' },
    { userId: 'preview-nam', membershipId: 'preview-member-nam', displayName: 'Trần Hoàng Nam', roleLabel: 'Phát triển sản phẩm', tone: 'blue' },
    { userId: 'preview-ha', membershipId: 'preview-member-ha', displayName: 'Lê Thu Hà', roleLabel: 'Marketing', tone: 'green' },
    { userId: 'preview-huy', membershipId: 'preview-member-huy', displayName: 'Phạm Quang Huy', roleLabel: 'Quản lý dự án', tone: 'amber' },
    { userId: 'preview-linh', membershipId: 'preview-member-linh', displayName: 'Đỗ Khánh Linh', roleLabel: 'Product Designer', tone: 'purple' },
    { userId: 'preview-duc', membershipId: 'preview-member-duc', displayName: 'Vũ Minh Đức', roleLabel: 'Kỹ thuật', tone: 'blue' }
  ].map((p, index) => ({
    ...p,
    employeeId: null,
    avatarPath: null,
    portrait: index === 0 ? null : index - 1,
    groupRole: p.userId === scope.userId ? 'owner' : 'member',
    joinedAt: new Date().toISOString()
  }));
  const now = new Date();
  const at = minutes => new Date(now.getTime() - minutes * 60000).toISOString();
  const makeConversation = (id, title, type, memberIds, description, unreadCount = 0, pinned = false, tone = 'purple') => ({
    id, organizationId: scope.organizationId, title, type, description, memberIds, unreadCount, pinned, muted: false,
    tone, avatarPath: null, portrait: type === 'direct' ? people.find(person => person.userId === memberIds[1])?.portrait : null,
    participantCount: memberIds.length, capabilities: { ...capabilities, canRename: type === 'group', canAddMembers: type === 'group' },
    updatedAt: at(10), lastMessage: null, pinnedMessageIds: []
  });
  let conversations = [
    makeConversation('preview-design', 'Thiết kế sản phẩm', 'group', people.slice(0, 6).map(p => p.userId), 'Một nơi để chia sẻ ý tưởng, góp ý thiết kế và cùng xây dựng trải nghiệm WorkTree tốt hơn.', 3, true),
    makeConversation('preview-direct-anh', 'Nguyễn Minh Anh', 'direct', [scope.userId, 'preview-anh'], '', 2, false, 'purple'),
    makeConversation('preview-team', 'WorkTree · Cả nhà', 'group', people.map(p => p.userId), 'Kết nối mọi người, cập nhật những điều mới và cùng nhau tiến về phía trước.', 0, true, 'green'),
    makeConversation('preview-campaign', 'Chiến dịch tháng 11', 'group', [scope.userId, 'preview-ha', 'preview-huy', 'preview-nam'], 'Phối hợp nội dung và triển khai chiến dịch tháng 11.', 1, false, 'amber'),
    makeConversation('preview-direct-nam', 'Trần Hoàng Nam', 'direct', [scope.userId, 'preview-nam'], '', 0, false, 'blue'),
    makeConversation('preview-direct-ha', 'Lê Thu Hà', 'direct', [scope.userId, 'preview-ha'], '', 0, false, 'green')
  ];
  const messages = new Map(conversations.map(c => [c.id, []]));
  let counter = 0;
  function message(conversationId, senderUserId, text, minutes, extra = {}) {
    const m = { id: `preview-message-${++counter}`, clientMessageId: null, organizationId: scope.organizationId, conversationId, senderUserId,
      kind: 'text', text, replyToMessageId: null, attachments: [], reactions: [], createdAt: at(minutes), editedAt: null, deletedAt: null, ...extra };
    messages.get(conversationId).push(m);
    return m;
  }
  message('preview-design', null, 'Quang Huy đã tạo nhóm Thiết kế sản phẩm', 1440, { kind: 'system' });
  message('preview-design', 'preview-huy', 'Chào cả nhà! Mình dùng nhóm này để trao đổi về giao diện mới của WorkTree nhé.', 1380);
  message('preview-design', 'preview-anh', 'Mình đã hoàn thiện hướng thiết kế cho phần cộng tác. Ưu tiên sự rõ ràng, dễ dùng và giữ đúng tinh thần của WorkTree.', 68);
  message('preview-design', scope.userId, 'Ổn đó Anh. Phần danh sách hội thoại mình để gọn hơn một chút, để mọi người có nhiều không gian trao đổi nhé.', 55);
  const reply = message('preview-design', 'preview-linh', 'Mình thích hướng này! Các trạng thái chưa đọc và thông tin nhóm nhìn rất dễ theo dõi.', 43, { reactions: [{ emoji: '👍', userIds: ['preview-anh', scope.userId] }] });
  message('preview-design', 'preview-nam', 'Phần mobile mình sẽ kiểm tra thêm ở màn hình nhỏ. Composer cần luôn nằm trong tầm tay khi mở bàn phím.', 32);
  message('preview-design', scope.userId, 'Đồng ý. Mình cùng chốt trải nghiệm trước, rồi ghép từng phần để mọi thứ liền mạch.', 24, { replyToMessageId: reply.id });
  message('preview-design', 'preview-anh', 'Mình vừa cập nhật lại khoảng cách và màu nền. Cả nhà xem rồi góp ý thêm giúp mình nhé!', 8);
  message('preview-direct-anh', 'preview-anh', 'Bạn xem giúp mình phần giao diện chat mới nhé. Mình đã chỉnh lại bố cục cho thoáng hơn rồi.', 12);
  message('preview-team', 'preview-huy', 'Chúc cả nhà một ngày làm việc hiệu quả! Có ý tưởng mới thì cùng chia sẻ ở đây nhé.', 34);
  message('preview-campaign', 'preview-ha', 'Mình gửi lịch nội dung tuần này để cả nhóm cùng theo dõi nhé.', 58);
  message('preview-direct-nam', scope.userId, 'Cảm ơn Nam, mình đã xem qua các góp ý rồi nhé.', 92);
  message('preview-direct-ha', 'preview-ha', 'Cảm ơn bạn, hẹn gặp trong buổi trao đổi ngày mai!', 140);
  conversations[0].pinnedMessageIds.push(messages.get('preview-design')[2].id);
  for (const c of conversations) sync(c);

  function assertContext(context) {
    if (disposed || context.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (context.organizationId !== scope.organizationId || context.userId !== scope.userId) throw Object.assign(new Error('Không có quyền truy cập.'), { code: 'FORBIDDEN' });
  }
  function conversation(context, id) {
    assertContext(context);
    const c = conversations.find(item => item.id === id && item.memberIds.includes(scope.userId));
    if (!c) throw Object.assign(new Error('Không tìm thấy cuộc trò chuyện.'), { code: 'NOT_FOUND' });
    return c;
  }
  function sync(c) {
    c.lastMessage = messages.get(c.id)?.at(-1) || null;
    c.updatedAt = c.lastMessage?.createdAt || new Date().toISOString();
    c.participantCount = c.memberIds.length;
  }
  function notify(name, id) { for (const listener of listeners) listener[name]?.({ conversationId: id }); }
  function detail(c) { return clone({ conversation: c, participants: people.filter(p => c.memberIds.includes(p.userId)) }); }
  function page(items) { return { items: clone(items), nextCursor: null, hasMore: false }; }

  return {
    isPreview: true,
    async listConversations(context, { filter = 'all', query = '' } = {}) {
      assertContext(context);
      return page(conversations.filter(c => (filter !== 'unread' || c.unreadCount > 0) && (filter !== 'groups' || c.type === 'group') && fold(c.title).includes(fold(query)))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)));
    },
    async listEligibleParticipants(context, { query = '' } = {}) { assertContext(context); return page(people.filter(p => p.userId !== scope.userId && fold(`${p.displayName} ${p.roleLabel}`).includes(fold(query)))); },
    async getConversation(context, id) { return detail(conversation(context, id)); },
    async listMessages(context, id) { conversation(context, id); return page(messages.get(id) || []); },
    async getOrCreateDirectConversation(context, membershipId) {
      assertContext(context);
      const target = people.find(p => p.membershipId === membershipId && p.userId !== scope.userId);
      if (!target) throw new Error('Người nhận không hợp lệ.');
      const existing = conversations.find(c => c.type === 'direct' && c.memberIds.includes(target.userId));
      if (existing) return clone(existing);
      const c = makeConversation(crypto.randomUUID(), target.displayName, 'direct', [scope.userId, target.userId], '', 0, false, target.tone);
      conversations.push(c); messages.set(c.id, []); sync(c); notify('conversationChanged', c.id); return clone(c);
    },
    async createGroup(context, { name, description = '', participantMembershipIds }) {
      assertContext(context);
      const selected = [...new Set(participantMembershipIds)].map(id => people.find(p => p.membershipId === id && p.userId !== scope.userId));
      if (!name?.trim() || name.trim().length > 100 || !selected.length || selected.some(p => !p)) throw new Error('Nhập tên nhóm và chọn ít nhất một người.');
      const c = makeConversation(crypto.randomUUID(), name.trim(), 'group', [scope.userId, ...selected.map(p => p.userId)], description.trim());
      conversations.unshift(c); messages.set(c.id, []);
      message(c.id, null, 'Bạn đã tạo nhóm. Cùng bắt đầu cuộc trò chuyện nhé!', 0, { kind: 'system' });
      sync(c); notify('conversationChanged', c.id); return clone(c);
    },
    async sendMessage(context, id, input) {
      const c = conversation(context, id);
      const old = messages.get(id).find(m => m.clientMessageId === input.clientMessageId && m.senderUserId === scope.userId);
      if (old) return clone(old);
      if (!input.clientMessageId || !input.text?.trim() || input.text.trim().length > 10000) throw new Error('Tin nhắn cần có từ 1 đến 10.000 ký tự.');
      if (input.replyToMessageId && !messages.get(id).some(m => m.id === input.replyToMessageId)) throw new Error('Tin trả lời không hợp lệ.');
      const m = message(id, scope.userId, input.text.trim(), 0, { clientMessageId: input.clientMessageId, replyToMessageId: input.replyToMessageId || null });
      sync(c); notify('messagesChanged', id); notify('conversationChanged', id); return clone(m);
    },
    async markRead(context, id, messageId) {
      const c = conversation(context, id);
      if (messageId && !messages.get(id).some(m => m.id === messageId)) throw new Error('Tin nhắn không hợp lệ.');
      c.unreadCount = 0; notify('readStateChanged', id); return { unreadCount: 0, lastReadMessageId: messageId };
    },
    async setConversationPreferences(context, id, patch) {
      const c = conversation(context, id);
      if (typeof patch.pinned === 'boolean') c.pinned = patch.pinned;
      if (typeof patch.muted === 'boolean') c.muted = patch.muted;
      notify('conversationChanged', id); return clone({ pinned: c.pinned, muted: c.muted });
    },
    async updateGroup(context, id, patch) {
      const c = conversation(context, id);
      if (c.type !== 'group' || !patch.name?.trim() || patch.name.trim().length > 100) throw new Error('Tên nhóm cần có từ 1 đến 100 ký tự.');
      c.title = patch.name.trim(); if (patch.description !== undefined) c.description = patch.description.trim();
      notify('conversationChanged', id); return clone(c);
    },
    async addParticipants(context, id, membershipIds) {
      const c = conversation(context, id);
      const selected = membershipIds.map(mid => people.find(p => p.membershipId === mid));
      if (c.type !== 'group' || selected.some(p => !p)) throw new Error('Thành viên không hợp lệ.');
      c.memberIds = [...new Set([...c.memberIds, ...selected.map(p => p.userId)])]; sync(c); notify('conversationChanged', id); return detail(c);
    },
    async toggleReaction(context, id, messageId, emoji) {
      conversation(context, id);
      const m = messages.get(id).find(item => item.id === messageId && !item.deletedAt && item.kind !== 'system');
      if (!m || !['👍', '❤️', '🎉', '👀'].includes(emoji)) throw new Error('Cảm xúc không hợp lệ.');
      let r = m.reactions.find(item => item.emoji === emoji);
      if (!r) { r = { emoji, userIds: [] }; m.reactions.push(r); }
      r.userIds = r.userIds.includes(scope.userId) ? r.userIds.filter(uid => uid !== scope.userId) : [...r.userIds, scope.userId];
      m.reactions = m.reactions.filter(item => item.userIds.length); notify('messagesChanged', id); return clone(m);
    },
    async pinMessage(context, id, messageId) {
      const c = conversation(context, id);
      if (!messages.get(id).some(m => m.id === messageId && !m.deletedAt && m.kind !== 'system')) throw new Error('Tin nhắn không hợp lệ.');
      c.pinnedMessageIds = [messageId]; notify('conversationChanged', id); return clone(c);
    },
    async subscribe(context, handlers) { assertContext(context); listeners.add(handlers); return async () => listeners.delete(handlers); },
    dispose() { disposed = true; listeners.clear(); messages.clear(); conversations = []; }
  };
}
