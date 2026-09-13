const { strict: assert } = require('node:assert');
const { test } = require('node:test');

test('ZaloBotService validates input parameters for sendMessage', async () => {
  const { ZaloBotService } = await import('../src/features/integrations/services/zalo-bot-service.js');

  await assert.rejects(
    () => ZaloBotService.sendMessage('', 'Hello'),
    /Thiếu chatId người nhận/
  );

  await assert.rejects(
    () => ZaloBotService.sendMessage('123', '   '),
    /Nội dung tin nhắn không được rỗng/
  );
});

test('ZaloBotService.sendTaskNotification formats Vietnamese rich markdown notification', async () => {
  const { ZaloBotService } = await import('../src/features/integrations/services/zalo-bot-service.js');

  let sentPayload = null;
  const originalSendMessage = ZaloBotService.sendMessage;
  ZaloBotService.sendMessage = async (chatId, text, options) => {
    sentPayload = { chatId, text, options };
    return { ok: true, result: { message_id: 'msg_1' } };
  };

  try {
    const res = await ZaloBotService.sendTaskNotification({
      zaloChatId: 'chat_emp_001',
      taskTitle: 'Hoàn thiện hồ sơ năng lực 2026',
      nodeName: 'Phòng Kỹ Thuật',
      dueDate: '2026-09-20',
      priority: 'Khẩn cấp',
      assignerName: 'Trần Giám Đốc',
      taskId: 'task_123'
    });

    assert.equal(res.ok, true);
    assert.equal(sentPayload.chatId, 'chat_emp_001');
    assert.match(sentPayload.text, /CÔNG VIỆC MỚI ĐƯỢC GIAO/);
    assert.match(sentPayload.text, /Hoàn thiện hồ sơ năng lực 2026/);
    assert.match(sentPayload.text, /Phòng Kỹ Thuật/);
    assert.match(sentPayload.text, /🔴 Khẩn cấp/);
    assert.match(sentPayload.text, /2026-09-20/);
    assert.match(sentPayload.text, /Trần Giám Đốc/);
    assert.match(sentPayload.text, /worktree\.nguyentronghuu\.com/);
  } finally {
    ZaloBotService.sendMessage = originalSendMessage;
  }
});

test('ZaloBotService.processIncomingMessage handles 1-touch pairing when user sends phone number', async () => {
  const { ZaloBotService } = await import('../src/features/integrations/services/zalo-bot-service.js');

  let rpcCall = null;
  const mockSupabase = {
    rpc: async (fnName, params) => {
      rpcCall = { fnName, params };
      return {
        data: {
          success: true,
          employee_id: 'emp_test_id',
          full_name: 'Nguyễn Văn QA',
          organization_name: 'Four Group Corporation'
        },
        error: null
      };
    }
  };

  let replySent = null;
  const originalSendMessage = ZaloBotService.sendMessage;
  ZaloBotService.sendMessage = async (chatId, text) => {
    replySent = { chatId, text };
    return { ok: true };
  };

  try {
    const event = {
      message: {
        chat: { id: 'zalo_chat_abc123' },
        from: { id: 'zalo_chat_abc123', display_name: 'Nguyen QA' },
        text: 'Alo đây là số của tôi: 0987654321, liên kết giúp nhé'
      }
    };

    const res = await ZaloBotService.processIncomingMessage(event, mockSupabase);

    assert.equal(res.handled, true);
    assert.equal(res.success, true);
    assert.equal(rpcCall.fnName, 'pair_employee_zalo_by_phone');
    assert.equal(rpcCall.params.p_phone, '0987654321');
    assert.equal(rpcCall.params.p_zalo_chat_id, 'zalo_chat_abc123');
    assert.equal(rpcCall.params.p_display_name, 'Nguyen QA');

    assert.match(replySent.text, /LIÊN KẾT THÀNH CÔNG/);
    assert.match(replySent.text, /Nguyễn Văn QA/);
    assert.match(replySent.text, /Four Group Corporation/);
  } finally {
    ZaloBotService.sendMessage = originalSendMessage;
  }
});

test('ZaloBotService.processIncomingMessage sends guide when input is non-phone message', async () => {
  const { ZaloBotService } = await import('../src/features/integrations/services/zalo-bot-service.js');

  let replySent = null;
  const originalSendMessage = ZaloBotService.sendMessage;
  ZaloBotService.sendMessage = async (chatId, text) => {
    replySent = { chatId, text };
    return { ok: true };
  };

  try {
    const event = {
      sender: { id: 'chat_xyz', display_name: 'Khách' },
      message: { text: 'Chào bot, bot làm được gì thế?' }
    };

    const res = await ZaloBotService.processIncomingMessage(event);

    assert.equal(res.handled, true);
    assert.equal(res.isGreeting, true);
    assert.equal(replySent.chatId, 'chat_xyz');
    assert.match(replySent.text, /Trợ lý Thông báo Tự động/);
    assert.match(replySent.text, /gửi số điện thoại/);
  } finally {
    ZaloBotService.sendMessage = originalSendMessage;
  }
});
