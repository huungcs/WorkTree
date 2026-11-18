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

test('ZaloBotService.sendStatusNotification formats Vietnamese rich markdown notification', async () => {
  const { ZaloBotService } = await import('../src/features/integrations/services/zalo-bot-service.js');

  let sentPayload = null;
  const originalSendMessage = ZaloBotService.sendMessage;
  ZaloBotService.sendMessage = async (chatId, text, options) => {
    sentPayload = { chatId, text, options };
    return { ok: true, result: { message_id: 'msg_status_1' } };
  };

  try {
    const res = await ZaloBotService.sendStatusNotification({
      zaloChatId: 'chat_emp_002',
      taskTitle: 'Thiết kế landing page sản phẩm mới',
      nodeName: 'Nhóm Marketing',
      oldStatus: 'Đang làm',
      newStatus: 'Hoàn thành',
      updaterName: 'Nguyễn Trọng Hữu',
      taskId: 'task_456'
    });

    assert.equal(res.ok, true);
    assert.equal(sentPayload.chatId, 'chat_emp_002');
    assert.match(sentPayload.text, /CẬP NHẬT TRẠNG THÁI CÔNG VIỆC/);
    assert.match(sentPayload.text, /Thiết kế landing page sản phẩm mới/);
    assert.match(sentPayload.text, /Nhóm Marketing/);
    assert.match(sentPayload.text, /🟢 Hoàn thành/);
    assert.match(sentPayload.text, /Nguyễn Trọng Hữu/);
  } finally {
    ZaloBotService.sendMessage = originalSendMessage;
  }
});

test('ZaloBotService.sendCommentNotification formats Vietnamese rich markdown notification', async () => {
  const { ZaloBotService } = await import('../src/features/integrations/services/zalo-bot-service.js');

  let sentPayload = null;
  const originalSendMessage = ZaloBotService.sendMessage;
  ZaloBotService.sendMessage = async (chatId, text, options) => {
    sentPayload = { chatId, text, options };
    return { ok: true, result: { message_id: 'msg_comment_1' } };
  };

  try {
    const res = await ZaloBotService.sendCommentNotification({
      zaloChatId: 'chat_emp_003',
      taskTitle: 'Kiểm toán hệ thống bảo mật quý 3',
      nodeName: 'Ban Giám Đốc',
      authorName: 'Trần Văn Quản Lý',
      commentBody: 'Đã hoàn tất rà soát RLS, cần thêm báo cáo trước 17h hôm nay.',
      taskId: 'task_789'
    });

    assert.equal(res.ok, true);
    assert.equal(sentPayload.chatId, 'chat_emp_003');
    assert.match(sentPayload.text, /BÌNH LUẬN MỚI TRÊN CÔNG VIỆC/);
    assert.match(sentPayload.text, /Kiểm toán hệ thống bảo mật quý 3/);
    assert.match(sentPayload.text, /Ban Giám Đốc/);
    assert.match(sentPayload.text, /Trần Văn Quản Lý/);
    assert.match(sentPayload.text, /Đã hoàn tất rà soát RLS/);
    assert.match(sentPayload.text, /worktree\.nguyentronghuu\.com/);
  } finally {
    ZaloBotService.sendMessage = originalSendMessage;
  }
});



async function loadZaloBotService() {
  const mod = await import('../src/features/integrations/services/zalo-bot-service.js');
  return mod.ZaloBotService;
}

function createMockZaloSupabase(initialState) {
  const db = {
    organizations: [...(initialState.organizations || [])],
    employees: [...(initialState.employees || [])],
    organization_members: [...(initialState.organization_members || [])],
    member_scopes: [...(initialState.member_scopes || [])],
    organization_nodes: [...(initialState.organization_nodes || [])],
    organization_node_closure: [...(initialState.organization_node_closure || [])],
    tasks: [...(initialState.tasks || [])],
    activity_logs: [...(initialState.activity_logs || [])]
  };
  let nextId = 1000;

  function makeBuilder(table) {
    const filters = [];
    let mode = 'select';
    let payload = null;
    let maxRows = null;
    let singleMode = null;

    const applyFilters = (rows) => rows.filter((row) => filters.every(([op, col, val]) => {
      if (op === 'eq') return row[col] === val;
      if (op === 'is') return val === null ? (row[col] === null || row[col] === undefined) : row[col] === val;
      return true;
    }));

    const execute = async () => {
      const rows = db[table] || [];
      if (mode === 'insert') {
        const record = { id: `${table}_${nextId++}`, ...payload };
        rows.push(record);
        return singleMode ? { data: record, error: null } : { data: [record], error: null };
      }
      if (mode === 'update') {
        const matched = applyFilters(rows);
        matched.forEach((row) => Object.assign(row, payload));
        return singleMode ? { data: matched[0] || null, error: null } : { data: matched, error: null };
      }
      let result = applyFilters(rows);
      if (typeof maxRows === 'number') result = result.slice(0, maxRows);
      if (singleMode === 'single') {
        return { data: result[0] || null, error: result[0] ? null : { message: 'Not found' } };
      }
      if (singleMode === 'maybeSingle') {
        return { data: result[0] || null, error: null };
      }
      return { data: result, error: null };
    };

    const builder = {
      select() { return builder; },
      eq(col, val) { filters.push(['eq', col, val]); return builder; },
      is(col, val) { filters.push(['is', col, val]); return builder; },
      order() { return builder; },
      limit(n) { maxRows = n; return builder; },
      single() { singleMode = 'single'; return builder; },
      maybeSingle() { singleMode = 'maybeSingle'; return builder; },
      update(values) { mode = 'update'; payload = values; return builder; },
      insert(values) { mode = 'insert'; payload = values; return builder; },
      then(resolve, reject) { return execute().then(resolve, reject); }
    };
    return builder;
  }

  return { db, from: (table) => makeBuilder(table) };
}

test('Zalo Copilot: resolveZaloEmployeeContext resolves tenant, membership, and member_scopes', async () => {
  const sb = createMockZaloSupabase({
    organizations: [
      { id: 'org_a', name: 'Alpha Co', slug: 'alpha', status: 'active', root_node_id: 'node_root_a' },
      { id: 'org_b', name: 'Beta Co', slug: 'beta', status: 'active', root_node_id: 'node_root_b' }
    ],
    employees: [
      { id: 'emp_a1', organization_id: 'org_a', full_name: 'Nguyễn Văn An', home_node_id: 'node_sales_a', employment_status: 'active', zalo_chat_id: 'zalo_ctx_1' }
    ],
    organization_members: [
      { id: 'mem_a1', organization_id: 'org_a', user_id: 'user_a1', employee_id: 'emp_a1', role: 'manager', status: 'active' }
    ],
    member_scopes: [
      { organization_id: 'org_a', membership_id: 'mem_a1', node_id: 'node_sales_a' }
    ]
  });

  const ZaloBotService = await loadZaloBotService();
  const ctx = await ZaloBotService.resolveZaloEmployeeContext(sb, 'zalo_ctx_1');
  assert.ok(ctx);
  assert.equal(ctx.organizationId, 'org_a');
  assert.equal(ctx.role, 'manager');
  assert.deepEqual(ctx.scopeNodeIds, ['node_sales_a']);
});

test('Zalo Copilot: queries urgent/overdue tasks with strict tenant & scope isolation', async () => {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const sb = createMockZaloSupabase({
    organizations: [
      { id: 'org_a', name: 'Alpha Co', status: 'active', root_node_id: 'node_root_a' },
      { id: 'org_b', name: 'Beta Co', status: 'active', root_node_id: 'node_root_b' }
    ],
    employees: [
      { id: 'emp_m1', organization_id: 'org_a', full_name: 'Trần Minh', home_node_id: 'node_a_1', employment_status: 'active', zalo_chat_id: 'zalo_q_1' }
    ],
    organization_members: [
      { id: 'mem_m1', organization_id: 'org_a', user_id: 'u_m1', employee_id: 'emp_m1', role: 'member', status: 'active' }
    ],
    member_scopes: [{ organization_id: 'org_a', membership_id: 'mem_m1', node_id: 'node_a_1' }],
    organization_nodes: [{ id: 'node_a_1', organization_id: 'org_a', type: 'department', name: 'Kinh doanh' }],
    organization_node_closure: [{ organization_id: 'org_a', ancestor_id: 'node_a_1', descendant_id: 'node_a_1' }],
    tasks: [
      { id: 't_mine', organization_id: 'org_a', node_id: 'node_a_1', primary_assignee_id: 'emp_m1', title: 'Chốt hợp đồng Q4', status: 'doing', priority: 'urgent', due_date: yesterday, progress: 60 },
      { id: 't_other_member', organization_id: 'org_a', node_id: 'node_a_1', primary_assignee_id: 'emp_other', title: 'Việc nội bộ người khác', status: 'todo', priority: 'urgent', due_date: yesterday, progress: 0 },
      { id: 't_org_b', organization_id: 'org_b', node_id: 'node_b_1', primary_assignee_id: 'emp_m1', title: 'Bí mật Org B', status: 'todo', priority: 'urgent', due_date: yesterday, progress: 0 }
    ]
  });

  const ZaloBotService = await loadZaloBotService();
  const sent = [];
  const res = await ZaloBotService.processIncomingMessage(
    { chat_id: 'zalo_q_1', text: 'Hôm nay tôi có việc nào gấp sắp trễ hạn?' },
    sb,
    { sendMessage: async (cid, msg) => sent.push({ cid, msg }) }
  );

  assert.equal(res.handled, true);
  assert.equal(res.copilotIntent, 'query_tasks');
  assert.equal(res.tasksCount, 1);
  assert.match(sent[0].msg, /Chốt hợp đồng Q4/);
  assert.doesNotMatch(sent[0].msg, /Bí mật Org B/);
  assert.doesNotMatch(sent[0].msg, /Việc nội bộ người khác/);
});

test('Zalo Copilot: two-step confirmation required before marking task done (and HỦY aborts cleanly)', async () => {
  const sb = createMockZaloSupabase({
    organizations: [{ id: 'org_a', name: 'Alpha Co', status: 'active', root_node_id: 'node_root_a' }],
    employees: [
      { id: 'emp_m2', organization_id: 'org_a', full_name: 'Lê Hoa', home_node_id: 'node_a_1', employment_status: 'active', zalo_chat_id: 'zalo_done_1' }
    ],
    organization_members: [
      { id: 'mem_m2', organization_id: 'org_a', user_id: 'u_m2', employee_id: 'emp_m2', role: 'member', status: 'active' }
    ],
    tasks: [
      { id: 't_q4', organization_id: 'org_a', node_id: 'node_a_1', primary_assignee_id: 'emp_m2', title: 'Chốt hợp đồng Q4', status: 'doing', priority: 'high', progress: 70 }
    ]
  });

  const ZaloBotService = await loadZaloBotService();
  const sent = [];
  const opts = { sendMessage: async (cid, msg) => sent.push({ cid, msg }) };

  const step1 = await ZaloBotService.processIncomingMessage({ chat_id: 'zalo_done_1', text: 'Báo xong việc chốt hợp đồng Q4 nhé' }, sb, opts);
  assert.equal(step1.requiresConfirmation, true);
  assert.equal(sb.db.tasks[0].status, 'doing');

  const cancelStep = await ZaloBotService.processIncomingMessage({ chat_id: 'zalo_done_1', text: 'HỦY' }, sb, opts);
  assert.equal(cancelStep.copilotAction, 'cancelled');
  assert.equal(sb.db.tasks[0].status, 'doing');

  await ZaloBotService.processIncomingMessage({ chat_id: 'zalo_done_1', text: 'Báo xong việc chốt hợp đồng Q4 nhé' }, sb, opts);
  const confirmStep = await ZaloBotService.processIncomingMessage({ chat_id: 'zalo_done_1', text: 'XÁC NHẬN' }, sb, opts);
  assert.equal(confirmStep.copilotAction, 'confirmed');
  assert.equal(sb.db.tasks[0].status, 'done');
  assert.equal(sb.db.tasks[0].progress, 100);
  assert.equal(sb.db.activity_logs.length, 1);
});

test('Zalo Copilot: task assignment enforces role permissions and tenant isolation with confirmation gate', async () => {
  const sb = createMockZaloSupabase({
    organizations: [
      { id: 'org_a', name: 'Alpha Co', status: 'active', root_node_id: 'node_root_a' },
      { id: 'org_b', name: 'Beta Co', status: 'active', root_node_id: 'node_root_b' }
    ],
    employees: [
      { id: 'emp_mem', organization_id: 'org_a', full_name: 'Nhân viên A', home_node_id: 'node_a_1', employment_status: 'active', zalo_chat_id: 'zalo_role_mem' },
      { id: 'emp_mgr', organization_id: 'org_a', full_name: 'Quản lý Hùng', home_node_id: 'node_a_1', employment_status: 'active', zalo_chat_id: 'zalo_role_mgr' },
      { id: 'emp_nam_a', organization_id: 'org_a', full_name: 'Nguyễn Hoàng Nam', home_node_id: 'node_mkt', employment_status: 'active' },
      { id: 'emp_nam_b', organization_id: 'org_b', full_name: 'Trần Nam Org B', home_node_id: 'node_b_1', employment_status: 'active' }
    ],
    organization_members: [
      { id: 'mem_1', organization_id: 'org_a', user_id: 'u_mem', employee_id: 'emp_mem', role: 'member', status: 'active' },
      { id: 'mem_2', organization_id: 'org_a', user_id: 'u_mgr', employee_id: 'emp_mgr', role: 'manager', status: 'active' }
    ],
    member_scopes: [
      { organization_id: 'org_a', membership_id: 'mem_2', node_id: 'node_a_1' }
    ],
    organization_nodes: [{ id: 'node_a_1', organization_id: 'org_a', type: 'department', name: 'Marketing' }],
    tasks: []
  });

  const ZaloBotService = await loadZaloBotService();
  const sent = [];
  const opts = { sendMessage: async (cid, msg) => sent.push({ cid, msg }) };

  const memberDeny = await ZaloBotService.processIncomingMessage({ chat_id: 'zalo_role_mem', text: 'Nhắc Nam làm landing page trước thứ Sáu' }, sb, opts);
  assert.equal(memberDeny.denied, true);
  assert.equal(sb.db.tasks.length, 0);

  const mgrPropose = await ZaloBotService.processIncomingMessage({ chat_id: 'zalo_role_mgr', text: 'Nhắc Nam làm landing page trước 17h thứ Sáu' }, sb, opts);
  assert.equal(mgrPropose.requiresConfirmation, true);
  assert.equal(mgrPropose.draft.assigneeId, 'emp_nam_a');
  assert.equal(sb.db.tasks.length, 0);

  const mgrConfirm = await ZaloBotService.processIncomingMessage({ chat_id: 'zalo_role_mgr', text: 'OK' }, sb, opts);
  assert.equal(mgrConfirm.copilotAction, 'confirmed');
  assert.equal(sb.db.tasks.length, 1);
  assert.equal(sb.db.tasks[0].organization_id, 'org_a');
  assert.equal(sb.db.tasks[0].primary_assignee_id, 'emp_nam_a');
  assert.match(sb.db.tasks[0].title, /landing page/i);
});

test('Zalo Copilot: unlinked user non-phone message still falls back to onboarding greeting', async () => {
  const ZaloBotService = await loadZaloBotService();
  const sb = createMockZaloSupabase({ organizations: [], employees: [] });
  const sent = [];
  const res = await ZaloBotService.processIncomingMessage(
    { chat_id: 'zalo_unknown_99', display_name: 'Khách', text: 'Xin chào' },
    sb,
    { sendMessage: async (cid, msg) => sent.push({ cid, msg }) }
  );
  assert.equal(res.isGreeting, true);
  assert.match(sent[0].msg, /gửi số điện thoại/i);
});
