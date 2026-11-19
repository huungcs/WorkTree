const { strict: assert } = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { after, before, test } = require('node:test');

const { createServer } = require('../server.js');
const { createAiHandler } = require('../api/ai.js');

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';

const USER_OWNER_A = 'aaaa1111-1111-4111-8111-111111111111';
const USER_MEMBER_A = 'aaaa3333-1111-4111-8111-111111111111';
const USER_VIEWER_A = 'aaaa4444-1111-4111-8111-111111111111';

const NODE_A_ROOT = '31111111-1111-4111-8111-111111111111';
const NODE_A_DEPT1 = '31111112-1111-4111-8111-111111111111';
const NODE_B_ROOT = '32222221-2222-4222-8222-222222222222';

const EMP_OWNER_A = '41111111-1111-4111-8111-111111111111';
const EMP_MEMBER_A = '41111112-1111-4111-8111-111111111111';

const TASK_A1 = '51111111-1111-4111-8111-111111111111';
const TASK_B1 = '52222221-2222-4222-8222-222222222222';
const CONV_A = '71111111-1111-4111-8111-111111111111';
const CONV_B = '72222221-2222-4222-8222-222222222222';
const MSG_A1 = '81111111-1111-4111-8111-111111111111';
const MSG_A2 = '81111112-1111-4111-8111-111111111111';
const MSG_B1 = '82222221-2222-4222-8222-222222222222';

function createMockSupabase() {
  const db = {
    organizations: [
      { id: ORG_A, name: 'Công ty Alpha', slug: 'alpha', timezone: 'Asia/Ho_Chi_Minh', status: 'active', root_node_id: NODE_A_ROOT },
      { id: ORG_B, name: 'Công ty Beta', slug: 'beta', timezone: 'Asia/Ho_Chi_Minh', status: 'active', root_node_id: NODE_B_ROOT }
    ],
    profiles: [
      { id: USER_OWNER_A, display_name: 'Nguyễn Owner A' },
      { id: USER_MEMBER_A, display_name: 'Lê Member A' },
      { id: USER_VIEWER_A, display_name: 'Trần Viewer A' }
    ],
    organization_members: [
      { id: '61111111-1111-4111-8111-111111111111', organization_id: ORG_A, user_id: USER_OWNER_A, employee_id: EMP_OWNER_A, role: 'owner', status: 'active' },
      { id: '61111113-1111-4111-8111-111111111111', organization_id: ORG_A, user_id: USER_MEMBER_A, employee_id: EMP_MEMBER_A, role: 'member', status: 'active' },
      { id: '61111114-1111-4111-8111-111111111111', organization_id: ORG_A, user_id: USER_VIEWER_A, employee_id: null, role: 'viewer', status: 'active' }
    ],
    member_scopes: [
      { organization_id: ORG_A, membership_id: '61111113-1111-4111-8111-111111111111', node_id: NODE_A_DEPT1 },
      { organization_id: ORG_A, membership_id: '61111114-1111-4111-8111-111111111111', node_id: NODE_A_DEPT1 }
    ],
    organization_nodes: [
      { id: NODE_A_ROOT, organization_id: ORG_A, parent_id: null, type: 'company', name: 'Công ty Alpha', description: '', capacity_hours_week: 40, sort_order: 0, archived_at: null },
      { id: NODE_A_DEPT1, organization_id: ORG_A, parent_id: NODE_A_ROOT, type: 'department', name: 'Phòng Kinh doanh', description: 'Sales', capacity_hours_week: 40, sort_order: 1, archived_at: null },
      { id: NODE_B_ROOT, organization_id: ORG_B, parent_id: null, type: 'company', name: 'Công ty Beta (Bí mật)', description: '', capacity_hours_week: 40, sort_order: 0, archived_at: null }
    ],
    organization_node_closure: [
      { organization_id: ORG_A, ancestor_id: NODE_A_ROOT, descendant_id: NODE_A_ROOT, depth: 0 },
      { organization_id: ORG_A, ancestor_id: NODE_A_ROOT, descendant_id: NODE_A_DEPT1, depth: 1 },
      { organization_id: ORG_A, ancestor_id: NODE_A_DEPT1, descendant_id: NODE_A_DEPT1, depth: 0 }
    ],
    employees: [
      { id: EMP_OWNER_A, organization_id: ORG_A, full_name: 'Nguyễn Owner A', email: 'owner@alpha.test', employee_code: 'NV01', job_title: 'CEO', home_node_id: NODE_A_ROOT, employment_status: 'active' },
      { id: EMP_MEMBER_A, organization_id: ORG_A, full_name: 'Lê Member A', email: 'member@alpha.test', employee_code: 'NV02', job_title: 'Sales', home_node_id: NODE_A_DEPT1, employment_status: 'active' }
    ],
    tasks: [
      { id: TASK_A1, organization_id: ORG_A, node_id: NODE_A_DEPT1, primary_assignee_id: EMP_MEMBER_A, collaborator_ids: [], title: 'Chốt hợp đồng Q4', description: 'Khách VIP', status: 'in_progress', priority: 'urgent', start_date: '2026-11-10', due_date: '2026-11-15', estimate_minutes: 240, progress: 50, auto_progress: false, tags: ['Sales'], completed_at: null, archived_at: null, created_by: USER_OWNER_A, created_at: '2026-11-10T08:00:00Z', updated_at: '2026-11-10T08:00:00Z' },
      { id: TASK_B1, organization_id: ORG_B, node_id: NODE_B_ROOT, primary_assignee_id: null, collaborator_ids: [], title: 'Bí mật Beta', description: 'Không được lộ', status: 'todo', priority: 'high', start_date: null, due_date: null, estimate_minutes: 60, progress: 0, auto_progress: false, tags: [], completed_at: null, archived_at: null, created_by: USER_OWNER_A, created_at: '2026-11-12T08:00:00Z', updated_at: '2026-11-12T08:00:00Z' }
    ],
    task_checklist_items: [
      { id: '91111111-1111-4111-8111-111111111111', organization_id: ORG_A, task_id: TASK_A1, content: 'Rà soát lịch sử khách hàng', is_done: false, sort_order: 1, completed_at: null, created_at: '2026-11-10T09:00:00Z' }
    ],
    task_dependencies: [],
    task_comments: [
      { id: '92111111-1111-4111-8111-111111111111', organization_id: ORG_A, task_id: TASK_A1, author_user_id: USER_MEMBER_A, body: 'Khách hẹn chốt bảng giá bản cuối trước 17h.', edited_at: null, created_at: '2026-11-11T09:00:00Z' }
    ],
    task_time_entries: [],
    task_attachments: [],
    activity_logs: [],
    chat_conversations: [
      { id: CONV_A, organization_id: ORG_A, type: 'group', title: 'Nhóm Chốt Hợp Đồng Q4', description: 'Phối hợp sales', archived_at: null },
      { id: CONV_B, organization_id: ORG_B, type: 'group', title: 'Kênh Bí Mật Beta', description: '', archived_at: null }
    ],
    chat_participants: [
      { id: '65111111-1111-4111-8111-111111111111', organization_id: ORG_A, conversation_id: CONV_A, user_id: USER_OWNER_A, removed_at: null },
      { id: '65111112-1111-4111-8111-111111111111', organization_id: ORG_A, conversation_id: CONV_A, user_id: USER_MEMBER_A, removed_at: null }
    ],
    chat_messages: [
      { id: MSG_A1, organization_id: ORG_A, conversation_id: CONV_A, sender_user_id: USER_OWNER_A, kind: 'text', body: 'Nhờ Lê Member A gửi báo giá Q4 cho khách VIP trước thứ Sáu nhé.', deleted_at: null, created_at: '2026-11-12T09:00:00Z' },
      { id: MSG_A2, organization_id: ORG_A, conversation_id: CONV_A, sender_user_id: USER_MEMBER_A, kind: 'text', body: 'Đã nhận, chiều nay em hoàn thiện file và gửi kiểm tra.', deleted_at: null, created_at: '2026-11-12T09:05:00Z' },
      { id: MSG_B1, organization_id: ORG_B, conversation_id: CONV_B, sender_user_id: USER_OWNER_A, kind: 'text', body: 'Bí mật tenant Beta', deleted_at: null, created_at: '2026-11-12T09:10:00Z' }
    ],
    platform_ai_settings: []
  };

  function makeQuery(table) {
    const state = { table, op: 'select', payload: null, filters: [], orders: [], limitVal: null, singleMode: null };
    const builder = {
      select() { return builder; },
      insert(rows) { state.op = 'insert'; state.payload = Array.isArray(rows) ? rows : [rows]; return builder; },
      update(patch) { state.op = 'update'; state.payload = patch; return builder; },
      delete() { state.op = 'delete'; return builder; },
      eq(col, val) { state.filters.push(r => r[col] === val); return builder; },
      in(col, vals) { const set = new Set(vals || []); state.filters.push(r => set.has(r[col])); return builder; },
      is(col, val) { state.filters.push(r => (val === null ? r[col] == null : r[col] === val)); return builder; },
      order(col, opts = {}) { state.orders.push({ col, asc: opts.ascending !== false }); return builder; },
      limit(n) { state.limitVal = n; return builder; },
      maybeSingle() { state.singleMode = 'maybe'; return builder.execute(); },
      single() { state.singleMode = 'single'; return builder.execute(); },
      then(resolve, reject) { return builder.execute().then(resolve, reject); },
      async execute() {
        if (state.op === 'insert') {
          const inserted = state.payload.map(item => {
            const row = { id: item.id || crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...item };
            if (!db[state.table]) db[state.table] = [];
            db[state.table].push(row);
            return { ...row };
          });
          if (state.singleMode === 'single') return { data: inserted[0], error: null };
          if (state.singleMode === 'maybe') return { data: inserted[0] || null, error: null };
          return { data: inserted, error: null };
        }
        const sourceRows = state.table === 'task_rollups'
          ? db.tasks.map(t => ({ ...t, actual_minutes: 0, checklist_total: 0, checklist_done: 0, is_blocked: false }))
          : (db[state.table] || []);
        const matched = sourceRows.filter(r => state.filters.every(fn => fn(r)));
        if (state.op === 'update') {
          const updated = matched.map(r => Object.assign(r, state.payload));
          if (state.singleMode === 'single') return { data: updated[0] || null, error: updated[0] ? null : { message: 'Not found' } };
          return { data: updated, error: null };
        }
        let results = matched.map(r => ({ ...r }));
        if (state.orders.length) {
          results.sort((a, b) => {
            for (const o of state.orders) {
              const av = a[o.col] ?? '';
              const bv = b[o.col] ?? '';
              const cmp = String(av).localeCompare(String(bv));
              if (cmp !== 0) return o.asc ? cmp : -cmp;
            }
            return 0;
          });
        }
        if (state.limitVal != null) results = results.slice(0, state.limitVal);
        if (state.singleMode === 'single') return results[0] ? { data: results[0], error: null } : { data: null, error: { message: 'Not found' } };
        if (state.singleMode === 'maybe') return { data: results[0] || null, error: null };
        return { data: results, error: null };
      }
    };
    return builder;
  }

  const users = {
    'token-owner-a': { id: USER_OWNER_A, email: 'owner@alpha.test' },
    'token-member-a': { id: USER_MEMBER_A, email: 'member@alpha.test' },
    'token-viewer-a': { id: USER_VIEWER_A, email: 'viewer@alpha.test' }
  };

  return {
    db,
    auth: {
      async getUser(token) {
        const u = users[token];
        return u ? { data: { user: u }, error: null } : { data: { user: null }, error: { message: 'Invalid' } };
      }
    },
    from(table) { return makeQuery(table); }
  };
}

let server;
let origin;
let mockSb;
let upstreamCalls = [];

before(async () => {
  mockSb = createMockSupabase();
  const mockFetch = async (_url, opts) => {
    const body = JSON.parse(opts.body);
    upstreamCalls.push({ authHeader: opts.headers.Authorization, body });

    const lastMsg = body.messages[body.messages.length - 1];
    // Simulate multi-step tool calling:
    // 1. User asks for report -> model calls read tool worktree_get_report
    // 2. User asks to create task -> model proposes worktree_create_task (queued for confirmation!)
    if (lastMsg.role === 'user' && /tạo việc/i.test(lastMsg.content)) {
      return new Response(JSON.stringify({
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_write_1',
              type: 'function',
              function: {
                name: 'worktree_create_task',
                arguments: JSON.stringify({
                  node_id: NODE_A_DEPT1,
                  title: 'Theo dõi khách VIP Q4',
                  priority: 'high'
                })
              }
            }]
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (lastMsg.role === 'user') {
      return new Response(JSON.stringify({
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_read_1',
              type: 'function',
              function: {
                name: 'worktree_get_report',
                arguments: JSON.stringify({ include_workload: true })
              }
            }]
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // After tool execution result arrives, return final summary
    if (lastMsg.role === 'tool' && lastMsg.tool_call_id === 'call_read_1') {
      const toolData = JSON.parse(lastMsg.content);
      return new Response(JSON.stringify({
        choices: [{
          message: {
            role: 'assistant',
            content: `Hiện tổ chức có ${toolData.total_tasks} công việc, ${toolData.overdue_count} việc quá hạn.`
          }
        }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      choices: [{
        message: {
          role: 'assistant',
          content: 'Mình đã chuẩn bị đề xuất tạo công việc bên dưới, bạn bấm Xác nhận thực hiện nhé.'
        }
      }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const aiHandler = createAiHandler({
    supabase: mockSb,
    fetchFn: mockFetch,
    env: {
      AI_API_BASE_URL: 'https://mock-ai.local/v1/chat/completions',
      AI_API_KEY: 'mock-server-only-key',
      AI_MODEL: 'claude-opus-5'
    }
  });

  server = createServer({ aiHandler });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!server) return;
  await new Promise(resolve => server.close(resolve));
});

test('AI endpoint enforces authentication, tenant isolation, and never leaks AI_API_KEY', async () => {
  const anon = await fetch(`${origin}/api/ai?action=status&organizationId=${ORG_A}`);
  assert.equal(anon.status, 401);

  const crossTenant = await fetch(`${origin}/api/ai?action=status&organizationId=${ORG_B}`, {
    headers: { Authorization: 'Bearer token-owner-a' }
  });
  assert.equal(crossTenant.status, 403);

  const ownerStatus = await fetch(`${origin}/api/ai?action=status&organizationId=${ORG_A}`, {
    headers: { Authorization: 'Bearer token-owner-a' }
  }).then(r => r.json());
  assert.equal(ownerStatus.ok, true);
  assert.equal(ownerStatus.configured, true);
  assert.equal(ownerStatus.model, 'claude-opus-5');
  assert.equal(ownerStatus.canMutate, true);
  assert.equal(JSON.stringify(ownerStatus).includes('mock-server-only-key'), false);

  const viewerStatus = await fetch(`${origin}/api/ai?action=status&organizationId=${ORG_A}`, {
    headers: { Authorization: 'Bearer token-viewer-a' }
  }).then(r => r.json());
  assert.equal(viewerStatus.canMutate, false);
  assert.equal(viewerStatus.accessMode, 'read_only');
});

test('Read tools auto-execute strictly within tenant; write tools require explicit user confirmation', async () => {
  upstreamCalls = [];
  const chatRes = await fetch(`${origin}/api/ai`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-owner-a'
    },
    body: JSON.stringify({
      action: 'chat',
      organizationId: ORG_A,
      messages: [{ role: 'user', content: 'Báo cáo KPI hôm nay' }]
    })
  }).then(r => r.json());

  assert.equal(chatRes.ok, true);
  assert.match(chatRes.reply, /Hiện tổ chức có 1 công việc/);
  assert.equal(chatRes.executedTools.length, 1);
  assert.equal(chatRes.executedTools[0].name, 'worktree_get_report');
  assert.ok(Array.isArray(chatRes.quickLinks) && chatRes.quickLinks.some(l => l.href === `worktree://task/${TASK_A1}`));
  assert.ok(chatRes.quickLinks.some(l => l.href === 'worktree://view/late'));
  assert.equal(JSON.stringify(chatRes.quickLinks).includes(TASK_B1), false, 'Cross-tenant task must never appear in quickLinks');
  assert.equal(upstreamCalls[0].authHeader, 'Bearer mock-server-only-key');
  assert.equal(JSON.stringify(upstreamCalls).includes('Bí mật Beta'), false, 'Cross-tenant data must never reach AI context');

  // Proposing a write action must NOT mutate DB automatically
  const beforeCount = mockSb.db.tasks.length;
  const writeProposalRes = await fetch(`${origin}/api/ai`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-owner-a'
    },
    body: JSON.stringify({
      action: 'chat',
      organizationId: ORG_A,
      messages: [{ role: 'user', content: 'Hãy tạo việc mới cho phòng Kinh doanh' }]
    })
  }).then(r => r.json());

  assert.equal(writeProposalRes.ok, true);
  assert.equal(mockSb.db.tasks.length, beforeCount, 'Chat turn must not execute write tool without confirmation');
  assert.equal(writeProposalRes.pendingActions.length, 1);
  assert.equal(writeProposalRes.pendingActions[0].toolName, 'worktree_create_task');

  // Member attempting to execute create_task directly must be denied 403
  const memberDenied = await fetch(`${origin}/api/ai`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-member-a'
    },
    body: JSON.stringify({
      action: 'execute_action',
      organizationId: ORG_A,
      toolName: writeProposalRes.pendingActions[0].toolName,
      arguments: writeProposalRes.pendingActions[0].arguments
    })
  });
  assert.equal(memberDenied.status, 403);
  assert.equal(mockSb.db.tasks.length, beforeCount);

  // Owner confirming execute_action creates the task
  const ownerExec = await fetch(`${origin}/api/ai`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-owner-a'
    },
    body: JSON.stringify({
      action: 'execute_action',
      organizationId: ORG_A,
      toolName: writeProposalRes.pendingActions[0].toolName,
      arguments: writeProposalRes.pendingActions[0].arguments
    })
  }).then(r => r.json());
  assert.equal(ownerExec.ok, true);
  assert.equal(mockSb.db.tasks.length, beforeCount + 1);
});

test('AI endpoint defaults to claude-opus-5 and falls back to claude-opus-4-6 on upstream 429 capacity error', async () => {
  const modelsSeen = [];
  const fallbackFetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    modelsSeen.push(body.model);
    const lastMsg = body.messages[body.messages.length - 1];

    if (body.model === 'claude-opus-5') {
      return new Response(JSON.stringify({
        error: { message: 'No provider capacity right now; retry.' }
      }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }

    if (lastMsg.role === 'user') {
      return new Response(JSON.stringify({
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_fb_1',
              type: 'function',
              function: {
                name: 'worktree_get_report',
                arguments: JSON.stringify({ include_workload: false })
              }
            }]
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      choices: [{
        message: {
          role: 'assistant',
          content: 'Đã tổng hợp báo cáo qua model dự phòng.'
        }
      }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const fallbackHandler = createAiHandler({
    supabase: createMockSupabase(),
    fetchFn: fallbackFetch,
    env: {
      AI_API_BASE_URL: 'https://mock-ai.local/v1/chat/completions',
      AI_API_KEY: 'mock-server-only-key',
      AI_MODEL: 'claude-opus-5',
      AI_FALLBACK_MODEL: 'claude-opus-4-6'
    }
  });

  const fbServer = createServer({ aiHandler: fallbackHandler });
  await new Promise(resolve => fbServer.listen(0, '127.0.0.1', resolve));
  const fbOrigin = `http://127.0.0.1:${fbServer.address().port}`;

  try {
    const statusRes = await fetch(`${fbOrigin}/api/ai?action=status&organizationId=${ORG_A}`, {
      headers: { Authorization: 'Bearer token-owner-a' }
    }).then(r => r.json());
    assert.equal(statusRes.ok, true);
    assert.equal(statusRes.model, 'claude-opus-5');
    assert.equal(statusRes.fallbackModel, 'claude-opus-4-6');

    const chatRes = await fetch(`${fbOrigin}/api/ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-owner-a'
      },
      body: JSON.stringify({
        action: 'chat',
        organizationId: ORG_A,
        messages: [{ role: 'user', content: 'Kiểm tra tiến độ công việc' }]
      })
    }).then(r => r.json());

    assert.equal(chatRes.ok, true);
    assert.equal(chatRes.model, 'claude-opus-4-6');
    assert.equal(chatRes.configuredModel, 'claude-opus-5');
    assert.equal(chatRes.fallbackFrom, 'claude-opus-5');
    assert.match(chatRes.reply, /model dự phòng/);
    assert.deepEqual(modelsSeen, ['claude-opus-5', 'claude-opus-4-6', 'claude-opus-4-6']);
  } finally {
    await new Promise(resolve => fbServer.close(resolve));
  }
});

test('AI rich-text renderer parses safe worktree:// action links and neutralizes XSS payloads', async () => {
  const { renderSafeRichText, sanitizeWorktreeHref } = await import('../src/features/ai/ui/ai-assistant-dialog.js');
  const validHref = `worktree://task/${TASK_A1}?focus=checklist`;
  assert.equal(sanitizeWorktreeHref(validHref), validHref);
  assert.equal(sanitizeWorktreeHref('javascript:alert(1)'), '');
  assert.equal(sanitizeWorktreeHref('worktree://task/<script>'), '');

  const html = renderSafeRichText(
    `### Phần cần xử lý\n1. [${'Chốt hợp đồng'}](${validHref})\n2. [XSS](javascript:alert(1))\n3. <script>alert(1)</script>`
  );
  assert.match(html, /class="ai-rich-heading"/);
  assert.match(html, new RegExp(`data-ai-nav="worktree://task/${TASK_A1}\\?focus=checklist"`));
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('href="javascript:'), false);
});

test('AI endpoint loads settings directly from Supabase platform_ai_settings without AI_* env vars', async () => {
  const dbMock = createMockSupabase();
  dbMock.db.platform_ai_settings.push({
    id: 'default',
    provider: 'xpiki',
    api_base_url: 'https://mock-db-ai.local/v1/chat/completions',
    api_key: 'db-secret-provider-key-xyz',
    model: 'claude-opus-5',
    fallback_model: 'claude-opus-4-6',
    is_enabled: true,
    timeout_ms: 18000
  });

  let seenAuth = '';
  let seenSystemPrompt = '';
  const dbFetch = async (_url, options) => {
    seenAuth = options.headers.Authorization;
    const body = JSON.parse(options.body);
    seenSystemPrompt = body.messages?.[0]?.content || '';
    return new Response(JSON.stringify({
      choices: [{
        message: {
          role: 'assistant',
          content: `Đã đọc từ snapshot: [${'Chốt hợp đồng Q4'}](worktree://task/${TASK_A1})`
        }
      }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const dbHandler = createAiHandler({
    supabase: dbMock,
    fetchFn: dbFetch,
    env: {}
  });
  const dbServer = createServer({ aiHandler: dbHandler });
  await new Promise(resolve => dbServer.listen(0, '127.0.0.1', resolve));
  const dbOrigin = `http://127.0.0.1:${dbServer.address().port}`;

  try {
    const statusRes = await fetch(`${dbOrigin}/api/ai?action=status&organizationId=${ORG_A}`, {
      headers: { Authorization: 'Bearer token-owner-a' }
    }).then(r => r.json());
    assert.equal(statusRes.ok, true);
    assert.equal(statusRes.configured, true);
    assert.equal(statusRes.configSource, 'database');
    assert.equal(statusRes.model, 'claude-opus-5');
    assert.equal(JSON.stringify(statusRes).includes('db-secret-provider-key-xyz'), false);

    const chatRes = await fetch(`${dbOrigin}/api/ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-owner-a'
      },
      body: JSON.stringify({
        action: 'chat',
        organizationId: ORG_A,
        messages: [{ role: 'user', content: 'Tóm tắt nhanh các việc đang mở' }]
      })
    }).then(r => r.json());

    assert.equal(chatRes.ok, true);
    assert.equal(seenAuth, 'Bearer db-secret-provider-key-xyz');
    assert.equal(seenSystemPrompt.includes(TASK_A1), true, 'Snapshot should preload scoped task IDs for 1-turn response');
    assert.equal(seenSystemPrompt.includes('Bí mật Beta'), false, 'Snapshot must preserve strict tenant isolation');
    assert.ok(chatRes.quickLinks.some(l => l.href === `worktree://task/${TASK_A1}`));

    // Disabling AI in database must block chat cleanly with 503
    dbMock.db.platform_ai_settings[0].is_enabled = false;
    const disabledRes = await fetch(`${dbOrigin}/api/ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-owner-a'
      },
      body: JSON.stringify({
        action: 'chat',
        organizationId: ORG_A,
        messages: [{ role: 'user', content: 'Thử lại khi đã tắt' }]
      })
    });
    assert.equal(disabledRes.status, 503);
  } finally {
    await new Promise(resolve => dbServer.close(resolve));
  }
});

test('AI engine deduplicates/parallelizes read tools on shared cache and recovers cleanly from upstream timeout', async () => {
  const dbMock = createMockSupabase();
  let rollupQueries = 0;
  let employeeQueries = 0;
  const origFrom = dbMock.from.bind(dbMock);
  dbMock.from = (table) => {
    if (table === 'task_rollups') rollupQueries += 1;
    if (table === 'employees') employeeQueries += 1;
    return origFrom(table);
  };

  let callCount = 0;
  const cacheTestFetch = async () => {
    callCount += 1;
    if (callCount === 1) {
      return new Response(JSON.stringify({
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              { id: 'c1', type: 'function', function: { name: 'worktree_get_report', arguments: '{}' } },
              { id: 'c2', type: 'function', function: { name: 'worktree_list_tasks', arguments: '{"status":"in_progress"}' } },
              { id: 'c3', type: 'function', function: { name: 'worktree_get_report', arguments: '{}' } }
            ]
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    throw abortErr;
  };

  const cacheHandler = createAiHandler({
    supabase: dbMock,
    fetchFn: cacheTestFetch,
    env: {
      AI_API_BASE_URL: 'https://mock-ai.local/v1/chat/completions',
      AI_API_KEY: 'mock-server-only-key',
      AI_MODEL: 'claude-opus-5'
    }
  });
  const cacheServer = createServer({ aiHandler: cacheHandler });
  await new Promise(resolve => cacheServer.listen(0, '127.0.0.1', resolve));
  const cacheOrigin = `http://127.0.0.1:${cacheServer.address().port}`;

  try {
    const res = await fetch(`${cacheOrigin}/api/ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-owner-a'
      },
      body: JSON.stringify({
        action: 'chat',
        organizationId: ORG_A,
        messages: [{ role: 'user', content: 'Kiểm tra song song báo cáo và danh sách việc' }]
      })
    }).then(r => r.json());

    assert.equal(res.ok, true, 'Timeout after loading verified data should return deterministic fallback reply instead of 504 error');
    assert.equal(res.executedTools.length, 3);
    assert.equal(rollupQueries, 1, 'Shared execution cache must coalesce snapshot + 3 parallel/duplicate tool calls into 1 DB query');
    assert.equal(employeeQueries, 1, 'Shared execution cache must query employees only once');
    assert.match(res.reply, /Chốt hợp đồng Q4/);
    assert.match(res.reply, new RegExp(`worktree://task/${TASK_A1}`));
  } finally {
    await new Promise(resolve => cacheServer.close(resolve));
  }
});

test('AI UI feature and tracked code adhere to AGENTS.md architecture and zero-secret rules', () => {
  const aiFiles = [
    path.join(__dirname, '..', 'api', 'ai.js'),
    path.join(__dirname, '..', 'api', '_zalo-copilot.js'),
    path.join(__dirname, '..', 'api', 'platform-admin.js'),
    path.join(__dirname, '..', 'api', 'zalo-webhook.js'),
    path.join(__dirname, '..', 'scripts', 'sync-ai-config-to-db.js'),
    path.join(__dirname, '..', 'supabase', 'migrations', '20261119021000_add_platform_ai_settings.sql'),
    path.join(__dirname, '..', 'src', 'features', 'ai', 'index.js'),
    path.join(__dirname, '..', 'src', 'features', 'ai', 'services', 'ai-client-service.js'),
    path.join(__dirname, '..', 'src', 'features', 'ai', 'ui', 'ai-assistant-dialog.js'),
    path.join(__dirname, '..', 'src', 'features', 'integrations', 'services', 'zalo-bot-service.js'),
    path.join(__dirname, '..', 'src', 'features', 'chat', 'components', 'chat-view.js'),
    path.join(__dirname, '..', 'src', 'features', 'chat', 'styles', 'chat.css'),
    path.join(__dirname, '..', 'src', 'features', 'organizations', 'components', 'workspace-dialog.js'),
    path.join(__dirname, '..', 'src', 'features', 'recurring-tasks', 'ui', 'daily-checkin-dialog.js'),
    path.join(__dirname, '..', 'src', 'features', 'onboarding', 'ui', 'getting-started-card.js')
  ];
  for (const f of aiFiles) {
    assert.ok(fs.existsSync(f), `Expected file ${f}`);
    const content = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(content, /sk-[A-Za-z0-9]{20,}/, 'Must never commit or embed raw AI API keys');
    if (f.includes(`${path.sep}src${path.sep}`)) {
      assert.doesNotMatch(content, /app\/state\.js/, 'Feature must not import app/state.js');
      assert.doesNotMatch(content, /(?<!&)#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/, 'Must use CSS design tokens, no hardcoded hex');
      assert.doesNotMatch(content, /\balert\s*\(/, 'Must not use browser alert()');
    }
  }
});

test('inline_assist enforces auth, tenant isolation, permissions and parses real LLM JSON cleanly', async () => {
  const inlineMock = createMockSupabase();
  const inlineFetch = async (_url, opts) => {
    const reqBody = JSON.parse(opts.body);
    const sys = String(reqBody.messages?.[0]?.content || '');
    const usr = String(reqBody.messages?.[1]?.content || '');

    if (sys.includes('{"items":')) {
      return new Response(JSON.stringify({
        choices: [{
          message: {
            role: 'assistant',
            content: 'Đây là đề xuất:\n```json\n{"items":["rà soát lịch sử khách hàng","Gửi lại bảng giá đã cập nhật","Xác nhận lịch ký hợp đồng"],"suggestedHours":999,"rationale":"Bám sát bình luận chốt bảng giá trước 17h."}\n```'
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (sys.includes('"progressText"')) {
      return new Response(JSON.stringify({
        choices: [{
          message: {
            role: 'assistant',
            content: JSON.stringify({
              progressText: 'Đang đạt 50%, đã hoàn thành bước 0/1 checklist và chờ gửi báo giá bản cuối.',
              blockerText: 'Sát hạn 2026-11-15, cần chốt báo giá trước 17h.',
              nextStepText: 'Hoàn tất rà soát bảng giá và gửi khách VIP xác nhận.',
              riskLevel: 'high'
            })
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (sys.includes('"actionItems"')) {
      assert.equal(usr.includes(MSG_B1), false, 'Other tenant chat messages must never appear in prompt');
      return new Response(JSON.stringify({
        choices: [{
          message: {
            role: 'assistant',
            content: JSON.stringify({
              overview: 'Nhóm đang chốt gửi báo giá Q4 cho khách VIP trước thứ Sáu.',
              decisions: ['Hoàn thiện file báo giá trong chiều nay'],
              actionItems: [
                {
                  messageId: MSG_A1,
                  title: 'Gửi báo giá Q4 cho khách VIP',
                  assigneeHint: 'Lê Member A',
                  dueHint: '2026-11-20',
                  priority: 'Cao',
                  context: 'Hoàn thiện file và gửi kiểm tra trong chiều nay.'
                },
                {
                  messageId: '00000000-0000-4000-8000-000000000999',
                  title: 'Đầu việc ảo không có message thật',
                  assigneeHint: '',
                  dueHint: '',
                  priority: 'Thấp',
                  context: ''
                }
              ]
            })
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (sys.includes('"departments"')) {
      return new Response(JSON.stringify({
        choices: [{
          message: {
            role: 'assistant',
            content: JSON.stringify({
              summary: 'Cơ cấu phòng khám nha khoa 3 khối trọng tâm',
              departments: [
                {
                  name: 'Khối Điều trị & Bác sĩ',
                  type: 'department',
                  description: 'Thăm khám và điều trị lâm sàng',
                  projects: [{ name: 'Chuẩn hóa quy trình vô khuẩn', description: 'SOP phòng khám' }],
                  starterTasks: [{
                    title: 'Rà soát lịch khám theo ca sáng/chiều',
                    priority: 'high',
                    estimateMinutes: 99999,
                    tags: ['Y tế', 'Vận hành', 'SOP', 'Extra'],
                    checklist: ['Kiểm tra danh mục dụng cụ', 'Chốt ca trực tuần']
                  }]
                },
                {
                  name: 'Chăm sóc Khách hàng',
                  type: 'department',
                  description: 'Đặt lịch & tái khám',
                  projects: [{ name: 'Chăm sóc sau điều trị', description: '' }],
                  starterTasks: [{ title: 'Nhắc lịch tái khám 7 ngày', priority: 'medium', estimateMinutes: 60, tags: ['CSKH'], checklist: ['Gửi tin nhắn nhắc lịch'] }]
                }
              ]
            })
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (sys.includes('"tomorrowPlan"')) {
      assert.equal(usr.includes('Chốt hợp đồng Q4'), true, 'Scoped task context should appear in prompt');
      assert.equal(usr.includes('Bí mật Beta'), false, 'Other tenant tasks must never leak into prompt');
      return new Response(JSON.stringify({
        choices: [{
          message: {
            role: 'assistant',
            content: JSON.stringify({
              summary: 'Đã xử lý trọng tâm chốt hợp đồng Q4 với 90 phút tập trung.',
              blockers: '',
              tomorrowPlan: 'Hoàn tất gửi hợp đồng bản cuối và theo dõi phản hồi khách VIP.'
            })
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // chat_extract_task
    return new Response(JSON.stringify({
      choices: [{
        message: {
          role: 'assistant',
          content: JSON.stringify({
            title: 'Gửi báo giá Q4 cho khách VIP',
            description: 'Hoàn thiện bảng giá và gửi khách hàng trước thứ Sáu.',
            priority: 'high',
            due: '2026-11-20',
            estimateHours: 6,
            ownerId: EMP_MEMBER_A,
            collaboratorIds: ['00000000-0000-4000-8000-000000000999'],
            nodeId: NODE_A_DEPT1,
            tags: ['sales', 'Q4', 'sales']
          })
        }
      }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const inlineHandler = createAiHandler({
    supabase: inlineMock,
    fetchFn: inlineFetch,
    env: {
      AI_API_BASE_URL: 'https://mock-ai.local/v1/chat/completions',
      AI_API_KEY: 'mock-server-only-key',
      AI_MODEL: 'claude-opus-5'
    }
  });
  const inlineServer = createServer({ aiHandler: inlineHandler });
  await new Promise(resolve => inlineServer.listen(0, '127.0.0.1', resolve));
  const inlineOrigin = `http://127.0.0.1:${inlineServer.address().port}`;

  try {
    // 1. Security & cross-tenant gates
    const unauth = await fetch(`${inlineOrigin}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'inline_assist', organizationId: ORG_A, mode: 'task_summary', payload: { taskId: TASK_A1 } })
    });
    assert.equal(unauth.status, 401);

    const crossOrg = await fetch(`${inlineOrigin}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-owner-a' },
      body: JSON.stringify({ action: 'inline_assist', organizationId: ORG_B, mode: 'task_summary', payload: { taskId: TASK_B1 } })
    });
    assert.equal(crossOrg.status, 403);

    const crossTask = await fetch(`${inlineOrigin}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-owner-a' },
      body: JSON.stringify({ action: 'inline_assist', organizationId: ORG_A, mode: 'task_summary', payload: { taskId: TASK_B1 } })
    });
    assert.ok([403, 404].includes(crossTask.status));

    const viewerChecklist = await fetch(`${inlineOrigin}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-viewer-a' },
      body: JSON.stringify({ action: 'inline_assist', organizationId: ORG_A, mode: 'task_checklist', payload: { taskId: TASK_A1 } })
    });
    assert.equal(viewerChecklist.status, 403);

    const viewerSummary = await fetch(`${inlineOrigin}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-viewer-a' },
      body: JSON.stringify({ action: 'inline_assist', organizationId: ORG_A, mode: 'task_summary', payload: { taskId: TASK_A1 } })
    });
    assert.equal(viewerSummary.status, 200);
    const viewerSummaryJson = await viewerSummary.json();
    assert.equal(viewerSummaryJson.data.riskLevel, 'high');

    const nonParticipantChat = await fetch(`${inlineOrigin}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-viewer-a' },
      body: JSON.stringify({ action: 'inline_assist', organizationId: ORG_A, mode: 'chat_summary', payload: { conversationId: CONV_A } })
    });
    assert.equal(nonParticipantChat.status, 403);

    // 2. task_checklist deduplicates existing items and clamps hours
    const chkRes = await fetch(`${inlineOrigin}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-member-a' },
      body: JSON.stringify({ action: 'inline_assist', organizationId: ORG_A, mode: 'task_checklist', payload: { taskId: TASK_A1 } })
    }).then(r => r.json());
    assert.equal(chkRes.ok, true);
    assert.deepEqual(chkRes.data.items, ['Gửi lại bảng giá đã cập nhật', 'Xác nhận lịch ký hợp đồng']);
    assert.equal(chkRes.data.suggestedHours, 40);
    assert.match(chkRes.data.rationale, /bảng giá/);

    // 3. chat_summary validates real messageIds & drops hallucinated items
    const chatRes = await fetch(`${inlineOrigin}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-member-a' },
      body: JSON.stringify({ action: 'inline_assist', organizationId: ORG_A, mode: 'chat_summary', payload: { conversationId: CONV_A } })
    }).then(r => r.json());
    assert.equal(chatRes.ok, true);
    assert.equal(chatRes.data.decisions.length, 1);
    assert.equal(chatRes.data.actionItems.length, 1);
    assert.equal(chatRes.data.actionItems[0].messageId, MSG_A1);

    // 4. chat_extract_task validates real tenant IDs and strips hallucinated collaborator UUIDs
    const extractRes = await fetch(`${inlineOrigin}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-member-a' },
      body: JSON.stringify({
        action: 'inline_assist',
        organizationId: ORG_A,
        mode: 'chat_extract_task',
        payload: { conversationId: CONV_A, messageId: MSG_A1, conversationTitle: 'Nhóm Chốt Hợp Đồng Q4' }
      })
    }).then(r => r.json());
    assert.equal(extractRes.ok, true);
    assert.equal(extractRes.data.priority, 'Cao');
    assert.equal(extractRes.data.ownerId, EMP_MEMBER_A);
    assert.equal(extractRes.data.nodeId, NODE_A_DEPT1);
    assert.deepEqual(extractRes.data.collaboratorIds, []);
    assert.deepEqual(extractRes.data.tags, ['sales', 'Q4']);

    // 5. org_blueprint restricts to owner/admin & sanitizes output
    const memberBp = await fetch(`${inlineOrigin}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-member-a' },
      body: JSON.stringify({ action: 'inline_assist', organizationId: ORG_A, mode: 'org_blueprint', payload: { description: 'Phòng khám nha khoa 20 người' } })
    });
    assert.equal(memberBp.status, 403);

    const shortBp = await fetch(`${inlineOrigin}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-owner-a' },
      body: JSON.stringify({ action: 'inline_assist', organizationId: ORG_A, mode: 'org_blueprint', payload: { description: 'ab' } })
    });
    assert.equal(shortBp.status, 400);

    const ownerBp = await fetch(`${inlineOrigin}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-owner-a' },
      body: JSON.stringify({ action: 'inline_assist', organizationId: ORG_A, mode: 'org_blueprint', payload: { description: 'Phòng khám nha khoa 20 nhân sự gồm Bác sĩ và CSKH' } })
    }).then(r => r.json());
    assert.equal(ownerBp.ok, true);
    assert.equal(ownerBp.data.departments.length, 2);
    assert.equal(ownerBp.data.departments[0].starterTasks[0].estimateMinutes, 2400);
    assert.equal(ownerBp.data.departments[0].starterTasks[0].tags.length, 3);

    // 6. checkin_draft restricts viewer & drafts structured check-in from scoped tasks
    const viewerCheckin = await fetch(`${inlineOrigin}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-viewer-a' },
      body: JSON.stringify({ action: 'inline_assist', organizationId: ORG_A, mode: 'checkin_draft', payload: { mood: 'green' } })
    });
    assert.equal(viewerCheckin.status, 403);

    const memberCheckin = await fetch(`${inlineOrigin}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-member-a' },
      body: JSON.stringify({
        action: 'inline_assist',
        organizationId: ORG_A,
        mode: 'checkin_draft',
        payload: { mood: 'green', completedTaskIds: [TASK_A1, TASK_B1], minutesLogged: 90 }
      })
    }).then(r => r.json());
    assert.equal(memberCheckin.ok, true);
    assert.match(memberCheckin.data.summary, /hợp đồng Q4/i);
    assert.ok(memberCheckin.data.tomorrowPlan.length > 0);
  } finally {
    await new Promise(resolve => inlineServer.close(resolve));
  }
});
