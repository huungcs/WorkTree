const { strict: assert } = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { after, before, test } = require('node:test');

const { createServer } = require('../server.js');
const { createMcpHandler, invalidateMcpCache } = require('../api/mcp.js');

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';

const USER_OWNER_A = 'aaaa1111-1111-4111-8111-111111111111';
const USER_MANAGER_A = 'aaaa2222-1111-4111-8111-111111111111';
const USER_MEMBER_A = 'aaaa3333-1111-4111-8111-111111111111';
const USER_OWNER_B = 'bbbb1111-2222-4222-8222-222222222222';

const NODE_A_ROOT = '31111111-1111-4111-8111-111111111111';
const NODE_A_DEPT1 = '31111112-1111-4111-8111-111111111111';
const NODE_A_DEPT2 = '31111113-1111-4111-8111-111111111111';
const NODE_B_ROOT = '32222221-2222-4222-8222-222222222222';

const EMP_OWNER_A = '41111111-1111-4111-8111-111111111111';
const EMP_MEMBER_A = '41111112-1111-4111-8111-111111111111';
const EMP_OWNER_B = '42222221-2222-4222-8222-222222222222';

const TASK_A1 = '51111111-1111-4111-8111-111111111111';
const TASK_A2 = '51111112-1111-4111-8111-111111111111';
const TASK_B1 = '52222221-2222-4222-8222-222222222222';

function createMockSupabase({ missingMcpTable = false } = {}) {
  const db = {
    organizations: [
      { id: ORG_A, name: 'Công ty Alpha', slug: 'alpha', timezone: 'Asia/Ho_Chi_Minh', status: 'active', root_node_id: NODE_A_ROOT },
      { id: ORG_B, name: 'Công ty Beta', slug: 'beta', timezone: 'Asia/Ho_Chi_Minh', status: 'active', root_node_id: NODE_B_ROOT }
    ],
    profiles: [
      { id: USER_OWNER_A, display_name: 'Nguyễn Owner A' },
      { id: USER_MANAGER_A, display_name: 'Trần Manager A' },
      { id: USER_MEMBER_A, display_name: 'Lê Member A' },
      { id: USER_OWNER_B, display_name: 'Phạm Owner B' }
    ],
    organization_members: [
      { id: '61111111-1111-4111-8111-111111111111', organization_id: ORG_A, user_id: USER_OWNER_A, employee_id: EMP_OWNER_A, role: 'owner', status: 'active' },
      { id: '61111112-1111-4111-8111-111111111111', organization_id: ORG_A, user_id: USER_MANAGER_A, employee_id: null, role: 'manager', status: 'active' },
      { id: '61111113-1111-4111-8111-111111111111', organization_id: ORG_A, user_id: USER_MEMBER_A, employee_id: EMP_MEMBER_A, role: 'member', status: 'active' },
      { id: '62222221-2222-4222-8222-222222222222', organization_id: ORG_B, user_id: USER_OWNER_B, employee_id: EMP_OWNER_B, role: 'owner', status: 'active' }
    ],
    member_scopes: [
      { organization_id: ORG_A, membership_id: '61111112-1111-4111-8111-111111111111', node_id: NODE_A_DEPT1 },
      { organization_id: ORG_A, membership_id: '61111113-1111-4111-8111-111111111111', node_id: NODE_A_DEPT1 }
    ],
    organization_nodes: [
      { id: NODE_A_ROOT, organization_id: ORG_A, parent_id: null, type: 'company', name: 'Công ty Alpha', description: '', capacity_hours_week: 40, sort_order: 0, archived_at: null },
      { id: NODE_A_DEPT1, organization_id: ORG_A, parent_id: NODE_A_ROOT, type: 'department', name: 'Phòng Kinh doanh', description: 'Sales', capacity_hours_week: 40, sort_order: 1, archived_at: null },
      { id: NODE_A_DEPT2, organization_id: ORG_A, parent_id: NODE_A_ROOT, type: 'department', name: 'Phòng Kỹ thuật', description: 'Tech', capacity_hours_week: 40, sort_order: 2, archived_at: null },
      { id: NODE_B_ROOT, organization_id: ORG_B, parent_id: null, type: 'company', name: 'Công ty Beta (Bí mật)', description: '', capacity_hours_week: 40, sort_order: 0, archived_at: null }
    ],
    organization_node_closure: [
      { organization_id: ORG_A, ancestor_id: NODE_A_ROOT, descendant_id: NODE_A_ROOT, depth: 0 },
      { organization_id: ORG_A, ancestor_id: NODE_A_ROOT, descendant_id: NODE_A_DEPT1, depth: 1 },
      { organization_id: ORG_A, ancestor_id: NODE_A_ROOT, descendant_id: NODE_A_DEPT2, depth: 1 },
      { organization_id: ORG_A, ancestor_id: NODE_A_DEPT1, descendant_id: NODE_A_DEPT1, depth: 0 },
      { organization_id: ORG_A, ancestor_id: NODE_A_DEPT2, descendant_id: NODE_A_DEPT2, depth: 0 },
      { organization_id: ORG_B, ancestor_id: NODE_B_ROOT, descendant_id: NODE_B_ROOT, depth: 0 }
    ],
    employees: [
      { id: EMP_OWNER_A, organization_id: ORG_A, full_name: 'Nguyễn Owner A', email: 'owner@alpha.test', employee_code: 'NV01', job_title: 'CEO', home_node_id: NODE_A_ROOT, employment_status: 'active', zalo_chat_id: null },
      { id: EMP_MEMBER_A, organization_id: ORG_A, full_name: 'Lê Member A', email: 'member@alpha.test', employee_code: 'NV02', job_title: 'Sales', home_node_id: NODE_A_DEPT1, employment_status: 'active', zalo_chat_id: 'zalo-1' },
      { id: EMP_OWNER_B, organization_id: ORG_B, full_name: 'Phạm Owner B', email: 'owner@beta.test', employee_code: 'B01', job_title: 'CEO Beta', home_node_id: NODE_B_ROOT, employment_status: 'active', zalo_chat_id: null }
    ],
    tasks: [
      { id: TASK_A1, organization_id: ORG_A, node_id: NODE_A_DEPT1, primary_assignee_id: EMP_MEMBER_A, collaborator_ids: [], title: 'Chốt hợp đồng Q4', description: 'Theo dõi khách VIP', status: 'in_progress', priority: 'urgent', start_date: '2026-11-10', due_date: '2026-11-15', estimate_minutes: 240, progress: 50, auto_progress: false, tags: ['Sales'], completed_at: null, archived_at: null, created_by: USER_OWNER_A, created_at: '2026-11-10T08:00:00Z', updated_at: '2026-11-10T08:00:00Z' },
      { id: TASK_A2, organization_id: ORG_A, node_id: NODE_A_DEPT2, primary_assignee_id: EMP_OWNER_A, collaborator_ids: [], title: 'Nâng cấp hệ thống', description: 'Bảo trì server', status: 'todo', priority: 'medium', start_date: null, due_date: null, estimate_minutes: 120, progress: 0, auto_progress: false, tags: ['Tech'], completed_at: null, archived_at: null, created_by: USER_OWNER_A, created_at: '2026-11-11T08:00:00Z', updated_at: '2026-11-11T08:00:00Z' },
      { id: TASK_B1, organization_id: ORG_B, node_id: NODE_B_ROOT, primary_assignee_id: EMP_OWNER_B, collaborator_ids: [], title: 'Bí mật kinh doanh Beta', description: 'Không được lộ sang Alpha', status: 'todo', priority: 'high', start_date: null, due_date: null, estimate_minutes: 60, progress: 0, auto_progress: false, tags: ['Secret'], completed_at: null, archived_at: null, created_by: USER_OWNER_B, created_at: '2026-11-12T08:00:00Z', updated_at: '2026-11-12T08:00:00Z' }
    ],
    task_checklist_items: [],
    task_dependencies: [],
    task_comments: [],
    task_time_entries: [],
    task_attachments: [],
    activity_logs: [],
    security_audit_logs: [],
    mcp_servers: [],
    mcp_call_logs: [],
    daily_checkins: [
      {
        id: '96111111-1111-4111-8111-111111111111',
        organization_id: ORG_A,
        user_id: USER_MEMBER_A,
        employee_id: EMP_MEMBER_A,
        checkin_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
        mood: 'red',
        completed_task_ids: [TASK_A1],
        in_progress_task_ids: [],
        minutes_logged: 120,
        summary: 'Đã gửi báo giá sơ bộ cho khách VIP.',
        blockers: 'Cần sếp duyệt chiết khấu 10%.',
        tomorrow_plan: 'Chốt ký hợp đồng Q4.',
        submitted_at: '2026-11-19T10:30:00Z'
      },
      {
        id: '96222221-2222-4222-8222-222222222222',
        organization_id: ORG_B,
        user_id: USER_OWNER_B,
        employee_id: EMP_OWNER_B,
        checkin_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
        mood: 'green',
        completed_task_ids: [],
        in_progress_task_ids: [],
        minutes_logged: 60,
        summary: 'Bí mật Beta check-in',
        blockers: '',
        tomorrow_plan: '',
        submitted_at: '2026-11-19T10:35:00Z'
      }
    ],
    recurring_task_templates: [
      {
        id: '97111111-1111-4111-8111-111111111111',
        organization_id: ORG_A,
        title: 'Kiểm tra pipeline khách hàng hằng ngày',
        description: 'Rà soát các lead nóng phát sinh trong 24h.',
        node_id: NODE_A_DEPT1,
        assignment_mode: 'job_title',
        target_job_title: 'Sales',
        target_org_role: null,
        target_employee_id: null,
        priority: 'high',
        estimate_minutes: 30,
        checklist_items: ['Mở CRM', 'Phân loại lead nóng'],
        cadence: 'weekdays',
        days_of_week: [1, 2, 3, 4, 5],
        day_of_month: null,
        due_offset_days: 0,
        is_active: true,
        last_generated_date: '2026-11-19',
        created_at: '2026-11-18T08:00:00Z'
      },
      {
        id: '97222221-2222-4222-8222-222222222222',
        organization_id: ORG_B,
        title: 'Việc định kỳ bí mật Beta',
        description: '',
        node_id: NODE_B_ROOT,
        assignment_mode: 'org_role',
        target_job_title: null,
        target_org_role: 'member',
        target_employee_id: null,
        priority: 'medium',
        estimate_minutes: 30,
        checklist_items: [],
        cadence: 'daily',
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
        day_of_month: null,
        due_offset_days: 0,
        is_active: true,
        last_generated_date: null,
        created_at: '2026-11-18T08:00:00Z'
      }
    ]
  };

  let auditSeq = 1;

  function materializeRollups() {
    return db.tasks.map(t => {
      const checks = db.task_checklist_items.filter(c => c.task_id === t.id);
      const timeSum = db.task_time_entries.filter(te => te.task_id === t.id).reduce((s, x) => s + (x.minutes || 0), 0);
      const isBlocked = db.task_dependencies.some(d => {
        if (d.organization_id !== t.organization_id || d.task_id !== t.id) return false;
        const prereq = db.tasks.find(p => p.id === d.depends_on_task_id && p.organization_id === t.organization_id && !p.archived_at);
        return Boolean(prereq && prereq.status !== 'done');
      });
      return {
        ...t,
        actual_minutes: timeSum,
        checklist_total: checks.length,
        checklist_done: checks.filter(c => c.is_done).length,
        is_blocked: isBlocked
      };
    });
  }

  function makeQuery(table) {
    const state = {
      table,
      op: 'select',
      payload: null,
      filters: [],
      orders: [],
      limitVal: null,
      singleMode: null
    };

    const builder = {
      select() { return builder; },
      insert(rows) {
        state.op = 'insert';
        state.payload = Array.isArray(rows) ? rows : [rows];
        return builder;
      },
      update(patch) {
        state.op = 'update';
        state.payload = patch;
        return builder;
      },
      delete() {
        state.op = 'delete';
        return builder;
      },
      eq(col, val) {
        state.filters.push(row => row[col] === val);
        return builder;
      },
      neq(col, val) {
        state.filters.push(row => row[col] !== val);
        return builder;
      },
      in(col, vals) {
        const set = new Set(vals || []);
        state.filters.push(row => set.has(row[col]));
        return builder;
      },
      is(col, val) {
        state.filters.push(row => (val === null ? row[col] == null : row[col] === val));
        return builder;
      },
      order(col, opts = {}) {
        state.orders.push({ col, asc: opts.ascending !== false });
        return builder;
      },
      limit(n) {
        state.limitVal = n;
        return builder;
      },
      maybeSingle() {
        state.singleMode = 'maybe';
        return builder.execute();
      },
      single() {
        state.singleMode = 'single';
        return builder.execute();
      },
      then(resolve, reject) {
        return builder.execute().then(resolve, reject);
      },
      async execute() {
        if (missingMcpTable && (state.table === 'mcp_servers' || state.table === 'mcp_call_logs')) {
          return { data: null, error: { code: 'PGRST205', message: `Could not find the table 'public.${state.table}' in the schema cache` } };
        }

        if (state.op === 'insert') {
          const inserted = [];
          for (const item of state.payload) {
            const now = new Date().toISOString();
            const row = {
              id: item.id || (state.table === 'security_audit_logs' || state.table === 'activity_logs' ? auditSeq++ : crypto.randomUUID()),
              created_at: item.created_at || now,
              updated_at: item.updated_at || now,
              ...item
            };
            if (!db[state.table]) db[state.table] = [];
            db[state.table].push(row);
            inserted.push({ ...row });
            if (state.table === 'organization_nodes') {
              db.organization_node_closure.push({ organization_id: row.organization_id, ancestor_id: row.id, descendant_id: row.id, depth: 0 });
              if (row.parent_id) {
                const ancestors = db.organization_node_closure.filter(c => c.organization_id === row.organization_id && c.descendant_id === row.parent_id);
                for (const a of ancestors) {
                  db.organization_node_closure.push({ organization_id: row.organization_id, ancestor_id: a.ancestor_id, descendant_id: row.id, depth: a.depth + 1 });
                }
              }
            }
          }
          if (state.singleMode === 'single') return { data: inserted[0], error: null };
          if (state.singleMode === 'maybe') return { data: inserted[0] || null, error: null };
          return { data: inserted, error: null };
        }

        const sourceRows = state.table === 'task_rollups' ? materializeRollups() : (db[state.table] || []);
        const matched = sourceRows.filter(r => state.filters.every(fn => fn(r)));

        if (state.op === 'update') {
          const updated = [];
          for (const r of matched) {
            Object.assign(r, state.payload, { updated_at: new Date().toISOString() });
            updated.push({ ...r });
          }
          if (state.singleMode === 'single') return { data: updated[0] || null, error: updated[0] ? null : { message: 'Not found' } };
          if (state.singleMode === 'maybe') return { data: updated[0] || null, error: null };
          return { data: updated, error: null };
        }

        if (state.op === 'delete') {
          const toDelete = new Set(matched);
          db[state.table] = (db[state.table] || []).filter(r => !toDelete.has(r));
          return { data: matched, error: null };
        }

        let results = matched.map(r => ({ ...r }));
        for (let i = state.orders.length - 1; i >= 0; i -= 1) {
          const { col, asc } = state.orders[i];
          results.sort((a, b) => {
            if (a[col] === b[col]) return 0;
            if (a[col] == null) return asc ? -1 : 1;
            if (b[col] == null) return asc ? 1 : -1;
            return (a[col] < b[col] ? -1 : 1) * (asc ? 1 : -1);
          });
        }
        if (state.limitVal != null) {
          results = results.slice(0, state.limitVal);
        }
        if (state.singleMode === 'single') {
          return results[0] ? { data: results[0], error: null } : { data: null, error: { message: 'Row not found' } };
        }
        if (state.singleMode === 'maybe') {
          return { data: results[0] || null, error: null };
        }
        return { data: results, error: null };
      }
    };

    return builder;
  }

  const tokenUserMap = {
    'token-owner-a': { id: USER_OWNER_A, email: 'owner@alpha.test' },
    'token-manager-a': { id: USER_MANAGER_A, email: 'manager@alpha.test' },
    'token-member-a': { id: USER_MEMBER_A, email: 'member@alpha.test' },
    'token-owner-b': { id: USER_OWNER_B, email: 'owner@beta.test' }
  };

  return {
    db,
    auth: {
      async getUser(token) {
        const u = tokenUserMap[token];
        if (!u) return { data: { user: null }, error: { message: 'Invalid token' } };
        return { data: { user: u }, error: null };
      }
    },
    from(table) {
      return makeQuery(table);
    }
  };
}

let server;
let origin;
let mockSb;

before(async () => {
  mockSb = createMockSupabase();
  const mcpHandler = createMcpHandler({
    supabase: mockSb,
    pepper: 'test-worktree-mcp-pepper-secret-123456'
  });
  server = createServer({ mcpHandler });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  origin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close(err => err ? reject(err) : resolve());
  });
});

async function callManagement(method, queryOrBody, token = null) {
  const isGet = method === 'GET';
  const url = isGet ? `${origin}/api/mcp?${new URLSearchParams(queryOrBody).toString()}` : `${origin}/api/mcp`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    ...(isGet ? {} : { body: JSON.stringify(queryOrBody) })
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, headers: res.headers, data };
}

async function callMcpRpc(mcpUrl, body, extraHeaders = {}) {
  const res = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, headers: res.headers, data: json, raw: text };
}

test('Invalid/missing/revoked MCP keys always return 404 without WWW-Authenticate (never 401)', async () => {
  for (const badPath of ['/mcp', '/mcp/', '/mcp/wtmcp_invalid_key', '/mcp/foo/bar']) {
    const res = await fetch(`${origin}${badPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' })
    });
    assert.equal(res.status, 404, `Expected 404 for ${badPath}`);
    assert.equal(res.headers.get('www-authenticate'), null, 'Must never send WWW-Authenticate');
    const body = await res.json();
    assert.equal(body.error, 'not_found');
  }
});

test('Management API requires valid Supabase Bearer JWT and active membership', async () => {
  const anonRes = await callManagement('GET', { action: 'list', organizationId: ORG_A });
  assert.equal(anonRes.status, 401);

  const crossTenantRes = await callManagement('GET', { action: 'list', organizationId: ORG_B }, 'token-owner-a');
  assert.equal(crossTenantRes.status, 403);
});

test('Zero-auth MCP link works end-to-end for ChatGPT/Claude without Authorization header', async () => {
  const created = await callManagement('POST', {
    action: 'create',
    organizationId: ORG_A,
    name: 'ChatGPT Điều hành Alpha',
    accessMode: 'full'
  }, 'token-owner-a');

  assert.equal(created.status, 200);
  assert.equal(created.data.ok, true);
  const mcpUrl = created.data.server.url;
  assert.match(mcpUrl, /\/mcp\/wtmcp_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

  // Browser GET shows friendly Vietnamese HTML page
  const htmlRes = await fetch(mcpUrl, {
    headers: { Accept: 'text/html,application/xhtml+xml' }
  });
  assert.equal(htmlRes.status, 200);
  const html = await htmlRes.text();
  assert.match(html, /Đây là endpoint MCP của WorkTree X/);
  assert.match(html, /No authentication/);

  // 1. initialize (no Authorization header)
  const initRes = await callMcpRpc(mcpUrl, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'openai-mcp', version: '1.0' } }
  });
  assert.equal(initRes.status, 200);
  assert.equal(initRes.data.result.protocolVersion, '2025-03-26');
  assert.equal(initRes.data.result.serverInfo.name, 'worktree-x-mcp');
  assert.match(initRes.data.result.instructions, /worktree_get_workspace/);

  // 2. notifications/initialized -> 202 Accepted
  const notifRes = await callMcpRpc(mcpUrl, {
    jsonrpc: '2.0',
    method: 'notifications/initialized'
  });
  assert.equal(notifRes.status, 202);

  // 3. tools/list -> all 19 tools for owner full mode
  const listRes = await callMcpRpc(mcpUrl, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.equal(listRes.status, 200);
  const toolNames = listRes.data.result.tools.map(t => t.name);
  assert.equal(toolNames.length, 19);
  assert.ok(toolNames.includes('worktree_get_workspace'));
  assert.ok(toolNames.includes('worktree_list_daily_checkins'));
  assert.ok(toolNames.includes('worktree_list_recurring_templates'));
  assert.ok(toolNames.includes('worktree_create_task'));
  assert.ok(toolNames.includes('worktree_manage_dependency'));
  assert.ok(toolNames.includes('worktree_archive_task'));

  // 4. Tenant isolation check: worktree_list_tasks and worktree_get_report only see ORG_A
  const tasksRes = await callMcpRpc(mcpUrl, {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'worktree_list_tasks', arguments: {} }
  });
  assert.equal(tasksRes.status, 200);
  assert.equal(tasksRes.data.result.isError, false);
  const listedIds = tasksRes.data.result.structuredContent.tasks.map(t => t.id);
  assert.ok(listedIds.includes(TASK_A1));
  assert.ok(listedIds.includes(TASK_A2));
  assert.equal(listedIds.includes(TASK_B1), false, 'Tenant B task must never leak into Tenant A MCP');

  // Direct cross-tenant task UUID probe must fail
  const crossTaskRes = await callMcpRpc(mcpUrl, {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: { name: 'worktree_get_task', arguments: { task_id: TASK_B1 } }
  });
  assert.equal(crossTaskRes.data.result.isError, true);
  assert.equal(crossTaskRes.data.result.structuredContent.error.code, 'not_found_or_denied');

  // 5. Create task with checklist items
  const createTaskRes = await callMcpRpc(mcpUrl, {
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: {
      name: 'worktree_create_task',
      arguments: {
        node_id: NODE_A_DEPT1,
        title: 'Triển khai MCP WorkTree X',
        priority: 'high',
        assignee_id: EMP_MEMBER_A,
        due_date: '2026-11-20',
        checklist_items: ['Kiểm thử ChatGPT', 'Kiểm thử Claude']
      }
    }
  });
  assert.equal(createTaskRes.data.result.isError, false);
  const newTaskId = createTaskRes.data.result.structuredContent.task.id;
  assert.ok(newTaskId);

  // 6. Update task with explicit null clears due_date & assignee_id
  const updateNullRes = await callMcpRpc(mcpUrl, {
    jsonrpc: '2.0',
    id: 6,
    method: 'tools/call',
    params: {
      name: 'worktree_update_task',
      arguments: {
        task_id: newTaskId,
        due_date: null,
        assignee_id: null
      }
    }
  });
  assert.equal(updateNullRes.data.result.isError, false);
  assert.equal(updateNullRes.data.result.structuredContent.task.due_date, null);
  assert.equal(updateNullRes.data.result.structuredContent.task.primary_assignee_id, null);

  // 7. Set status, add comment, log time, create node, archive task
  const statusRes = await callMcpRpc(mcpUrl, {
    jsonrpc: '2.0',
    id: 7,
    method: 'tools/call',
    params: {
      name: 'worktree_set_task_status',
      arguments: { task_ids: [newTaskId], status: 'done' }
    }
  });
  assert.equal(statusRes.data.result.structuredContent.updated[0].progress, 100);

  const commentRes = await callMcpRpc(mcpUrl, {
    jsonrpc: '2.0',
    id: 8,
    method: 'tools/call',
    params: {
      name: 'worktree_add_comment',
      arguments: { task_id: newTaskId, body: 'Đã kiểm thử thành công với ChatGPT.' }
    }
  });
  assert.equal(commentRes.data.result.isError, false);

  const timeRes = await callMcpRpc(mcpUrl, {
    jsonrpc: '2.0',
    id: 9,
    method: 'tools/call',
    params: {
      name: 'worktree_log_time',
      arguments: { task_id: newTaskId, minutes: 45, note: 'Test MCP' }
    }
  });
  assert.equal(timeRes.data.result.isError, false);

  const badNodeRes = await callMcpRpc(mcpUrl, {
    jsonrpc: '2.0',
    id: 10,
    method: 'tools/call',
    params: {
      name: 'worktree_create_node',
      arguments: { parent_id: NODE_A_ROOT, name: 'Invalid', type: 'person' }
    }
  });
  assert.equal(badNodeRes.data.result.isError, true);

  const archiveRes = await callMcpRpc(mcpUrl, {
    jsonrpc: '2.0',
    id: 11,
    method: 'tools/call',
    params: { name: 'worktree_archive_task', arguments: { task_id: newTaskId } }
  });
  assert.equal(archiveRes.data.result.isError, false);
});

test('Read-only MCP mode & role/scope limits restrict tools and data properly', async () => {
  // Read-only link for Owner
  const roCreated = await callManagement('POST', {
    action: 'create',
    organizationId: ORG_A,
    name: 'Báo cáo chỉ đọc',
    accessMode: 'read_only'
  }, 'token-owner-a');
  const roUrl = roCreated.data.server.url;

  const roList = await callMcpRpc(roUrl, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
  const roNames = roList.data.result.tools.map(t => t.name);
  assert.equal(roNames.length, 9);
  assert.ok(roNames.includes('worktree_list_daily_checkins'));
  assert.ok(roNames.includes('worktree_list_recurring_templates'));
  assert.equal(roNames.includes('worktree_create_task'), false);

  const roCallWrite = await callMcpRpc(roUrl, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'worktree_create_task', arguments: { node_id: NODE_A_DEPT1, title: 'Blocked' } }
  });
  assert.equal(roCallWrite.data.result.isError, true);
  assert.equal(roCallWrite.data.result.structuredContent.error.code, 'permission_denied');

  // Manager link scoped strictly to DEPT1
  const mgrCreated = await callManagement('POST', {
    action: 'create',
    organizationId: ORG_A,
    name: 'Manager Sales MCP',
    accessMode: 'full'
  }, 'token-manager-a');
  const mgrTasks = await callMcpRpc(mgrCreated.data.server.url, {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'worktree_list_tasks', arguments: {} }
  });
  const mgrIds = mgrTasks.data.result.structuredContent.tasks.map(t => t.id);
  assert.ok(mgrIds.includes(TASK_A1));
  assert.equal(mgrIds.includes(TASK_A2), false, 'Manager scoped to DEPT1 must not see DEPT2 task');

  // Member link cannot create tasks or edit title
  const memCreated = await callManagement('POST', {
    action: 'create',
    organizationId: ORG_A,
    name: 'Member MCP',
    accessMode: 'full'
  }, 'token-member-a');
  const memList = await callMcpRpc(memCreated.data.server.url, { jsonrpc: '2.0', id: 4, method: 'tools/list' });
  const memTools = memList.data.result.tools.map(t => t.name);
  assert.equal(memTools.includes('worktree_create_task'), false);
  assert.equal(memTools.includes('worktree_archive_task'), false);
  assert.ok(memTools.includes('worktree_set_task_status'));

  const memEditTitle = await callMcpRpc(memCreated.data.server.url, {
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: { name: 'worktree_update_task', arguments: { task_id: TASK_A1, title: 'Hacked title' } }
  });
  assert.equal(memEditTitle.data.result.isError, true);
  assert.equal(memEditTitle.data.result.structuredContent.error.code, 'permission_denied');

  // Adding Member as collaborator on cross-department TASK_A2 grants read + status collaboration (but not changing collaborator_ids)
  const memBeforeCollab = await callMcpRpc(memCreated.data.server.url, {
    jsonrpc: '2.0',
    id: 51,
    method: 'tools/call',
    params: { name: 'worktree_list_tasks', arguments: {} }
  });
  assert.equal(memBeforeCollab.data.result.structuredContent.tasks.some(t => t.id === TASK_A2), false);

  const ownerCollabMcp = await callManagement('POST', {
    action: 'create',
    organizationId: ORG_A,
    name: 'Owner Collab Manager',
    accessMode: 'full'
  }, 'token-owner-a');
  const addCollabRes = await callMcpRpc(ownerCollabMcp.data.server.url, {
    jsonrpc: '2.0',
    id: 52,
    method: 'tools/call',
    params: { name: 'worktree_update_task', arguments: { task_id: TASK_A2, collaborator_ids: [EMP_MEMBER_A] } }
  });
  assert.equal(addCollabRes.data.result.isError, false);
  assert.deepEqual(addCollabRes.data.result.structuredContent.task.collaborator_ids, [EMP_MEMBER_A]);

  const memAfterCollab = await callMcpRpc(memCreated.data.server.url, {
    jsonrpc: '2.0',
    id: 53,
    method: 'tools/call',
    params: { name: 'worktree_get_task', arguments: { task_id: TASK_A2 } }
  });
  assert.equal(memAfterCollab.data.result.isError, false);
  assert.deepEqual(memAfterCollab.data.result.structuredContent.task.collaborator_ids, [EMP_MEMBER_A]);

  const memCollabStatus = await callMcpRpc(memCreated.data.server.url, {
    jsonrpc: '2.0',
    id: 54,
    method: 'tools/call',
    params: { name: 'worktree_set_task_status', arguments: { task_ids: [TASK_A2], status: 'in_progress' } }
  });
  assert.equal(memCollabStatus.data.result.isError, false);

  const memEditCollabsDenied = await callMcpRpc(memCreated.data.server.url, {
    jsonrpc: '2.0',
    id: 55,
    method: 'tools/call',
    params: { name: 'worktree_update_task', arguments: { task_id: TASK_A2, collaborator_ids: [] } }
  });
  assert.equal(memEditCollabsDenied.data.result.isError, true);
  assert.equal(memEditCollabsDenied.data.result.structuredContent.error.code, 'permission_denied');

  // Cleanup collaborator change & ownerCollabMcp
  await callMcpRpc(ownerCollabMcp.data.server.url, {
    jsonrpc: '2.0',
    id: 56,
    method: 'tools/call',
    params: { name: 'worktree_update_task', arguments: { task_id: TASK_A2, collaborator_ids: [] } }
  });
  await callManagement('POST', { action: 'delete', organizationId: ORG_A, mcpId: ownerCollabMcp.data.server.id }, 'token-owner-a');
});

test('Key rotation, pause/resume, revoke and tenant suspension immediately enforce 404', async () => {
  const created = await callManagement('POST', {
    action: 'create',
    organizationId: ORG_A,
    name: 'Lifecycle Test MCP',
    accessMode: 'read_only'
  }, 'token-owner-a');
  const mcpId = created.data.server.id;
  const oldUrl = created.data.server.url;

  // Rotate key
  const rotated = await callManagement('POST', {
    action: 'rotate',
    organizationId: ORG_A,
    mcpId
  }, 'token-owner-a');
  assert.equal(rotated.status, 200);
  const newUrl = rotated.data.server.url;
  assert.notEqual(newUrl, oldUrl);

  // Old key must now return 404
  const oldCall = await callMcpRpc(oldUrl, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.equal(oldCall.status, 404);

  // New key works
  const newCall = await callMcpRpc(newUrl, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.equal(newCall.status, 200);

  // Disable -> 404, re-enable -> 200
  await callManagement('POST', { action: 'toggle', organizationId: ORG_A, mcpId, status: 'disabled' }, 'token-owner-a');
  const disabledCall = await callMcpRpc(newUrl, { jsonrpc: '2.0', id: 3, method: 'tools/list' });
  assert.equal(disabledCall.status, 404);

  await callManagement('POST', { action: 'toggle', organizationId: ORG_A, mcpId, status: 'active' }, 'token-owner-a');
  const enabledCall = await callMcpRpc(newUrl, { jsonrpc: '2.0', id: 4, method: 'tools/list' });
  assert.equal(enabledCall.status, 200);

  // Tenant suspension -> 404
  mockSb.db.organizations[0].status = 'suspended';
  invalidateMcpCache();
  const suspendedCall = await callMcpRpc(newUrl, { jsonrpc: '2.0', id: 5, method: 'tools/list' });
  assert.equal(suspendedCall.status, 404);
  mockSb.db.organizations[0].status = 'active';
  invalidateMcpCache();

  // Revoke -> 404 permanently
  await callManagement('POST', { action: 'delete', organizationId: ORG_A, mcpId }, 'token-owner-a');
  const revokedCall = await callMcpRpc(newUrl, { jsonrpc: '2.0', id: 6, method: 'tools/list' });
  assert.equal(revokedCall.status, 404);
});

test('Fallback audit-log persistence works even before mcp_servers table migration is applied', async () => {
  const fallbackSb = createMockSupabase({ missingMcpTable: true });
  const fallbackHandler = createMcpHandler({
    supabase: fallbackSb,
    pepper: 'test-fallback-pepper-123456'
  });
  const srv = createServer({ mcpHandler: fallbackHandler });
  await new Promise(resolve => srv.listen(0, '127.0.0.1', resolve));
  const addr = srv.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const createRes = await fetch(`${baseUrl}/api/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-owner-a' },
      body: JSON.stringify({ action: 'create', organizationId: ORG_A, name: 'Fallback MCP', accessMode: 'read_only' })
    }).then(r => r.json());
    assert.equal(createRes.ok, true);
    const mcpUrl = createRes.server.url;

    const listRes = await fetch(`${baseUrl}/api/mcp?action=list&organizationId=${ORG_A}`, {
      headers: { Authorization: 'Bearer token-owner-a' }
    }).then(r => r.json());
    assert.equal(listRes.ok, true);
    assert.equal(listRes.servers.length, 1);
    assert.equal(listRes.servers[0].url, mcpUrl);

    const rpcRes = await callMcpRpc(mcpUrl, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'worktree_get_workspace', arguments: {} }
    });
    assert.equal(rpcRes.status, 200);
    assert.equal(rpcRes.data.result.structuredContent.organization.id, ORG_A);

    const logsFallbackRes = await fetch(`${baseUrl}/api/mcp?action=logs&organizationId=${ORG_A}`, {
      headers: { Authorization: 'Bearer token-owner-a' }
    }).then(r => r.json());
    assert.equal(logsFallbackRes.ok, true);
    assert.equal(logsFallbackRes.migrationRequired, true);
    assert.deepEqual(logsFallbackRes.logs, []);

    // Revoke via fallback
    await fetch(`${baseUrl}/api/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-owner-a' },
      body: JSON.stringify({ action: 'delete', organizationId: ORG_A, mcpId: createRes.server.id })
    });
    const afterRevoke = await callMcpRpc(mcpUrl, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
    assert.equal(afterRevoke.status, 404);
  } finally {
    await new Promise(resolve => srv.close(resolve));
  }
});

test('MCP prompts, batch checklist, task dependencies & activity logs API enforce rules cleanly', async () => {
  const ownerCreated = await callManagement('POST', {
    action: 'create',
    organizationId: ORG_A,
    name: 'Claude Pro Owner MCP',
    accessMode: 'full'
  }, 'token-owner-a');
  assert.equal(ownerCreated.status, 200);
  const ownerUrl = ownerCreated.data.server.url;

  const memberCreated = await callManagement('POST', {
    action: 'create',
    organizationId: ORG_A,
    name: 'Claude Pro Member MCP',
    accessMode: 'full'
  }, 'token-member-a');
  assert.equal(memberCreated.status, 200);
  const memberUrl = memberCreated.data.server.url;

  // 1. prompts/list & prompts/get
  const promptsListRes = await callMcpRpc(ownerUrl, { jsonrpc: '2.0', id: 101, method: 'prompts/list' });
  assert.equal(promptsListRes.status, 200);
  const promptNames = promptsListRes.data.result.prompts.map(p => p.name);
  assert.deepEqual(promptNames, [
    'daily_executive_digest',
    'optimize_workload',
    'triage_overdue_and_blocked',
    'breakdown_task_checklist'
  ]);

  const digestPromptRes = await callMcpRpc(ownerUrl, {
    jsonrpc: '2.0',
    id: 102,
    method: 'prompts/get',
    params: { name: 'daily_executive_digest', arguments: { horizon_days: 5 } }
  });
  assert.equal(digestPromptRes.status, 200);
  assert.match(digestPromptRes.data.result.messages[0].content.text, /worktree_get_workspace/);
  assert.match(digestPromptRes.data.result.messages[0].content.text, /worktree_get_report/);

  const missingArgPromptRes = await callMcpRpc(ownerUrl, {
    jsonrpc: '2.0',
    id: 103,
    method: 'prompts/get',
    params: { name: 'breakdown_task_checklist', arguments: {} }
  });
  assert.equal(missingArgPromptRes.status, 200);
  assert.equal(missingArgPromptRes.data.error.code, -32602);

  const breakdownPromptRes = await callMcpRpc(ownerUrl, {
    jsonrpc: '2.0',
    id: 104,
    method: 'prompts/get',
    params: { name: 'breakdown_task_checklist', arguments: { task_id: TASK_A1, target_steps: 4 } }
  });
  assert.equal(breakdownPromptRes.status, 200);
  assert.match(breakdownPromptRes.data.result.messages[0].content.text, new RegExp(TASK_A1));
  assert.match(breakdownPromptRes.data.result.messages[0].content.text, /worktree_manage_checklist/);

  // 2. worktree_manage_checklist batch items + auto_progress recalculation
  const autoTaskRes = await callMcpRpc(ownerUrl, {
    jsonrpc: '2.0',
    id: 105,
    method: 'tools/call',
    params: {
      name: 'worktree_create_task',
      arguments: {
        node_id: NODE_A_DEPT1,
        title: 'Task kiểm thử checklist batch',
        auto_progress: true
      }
    }
  });
  assert.equal(autoTaskRes.data.result.isError, false);
  const autoTaskId = autoTaskRes.data.result.structuredContent.task.id;

  const batchAddRes = await callMcpRpc(ownerUrl, {
    jsonrpc: '2.0',
    id: 106,
    method: 'tools/call',
    params: {
      name: 'worktree_manage_checklist',
      arguments: {
        task_id: autoTaskId,
        operation: 'add',
        items: ['Bước 1: Phân tích', 'Bước 2: Thực hiện', 'Bước 3: Nghiệm thu', '']
      }
    }
  });
  assert.equal(batchAddRes.data.result.isError, false);
  assert.equal(batchAddRes.data.result.structuredContent.added_count, 3);
  assert.equal(batchAddRes.data.result.structuredContent.items.length, 3);
  assert.equal(batchAddRes.data.result.structuredContent.task_progress, 0);

  const firstItemId = batchAddRes.data.result.structuredContent.items[0].id;
  const toggleRes = await callMcpRpc(ownerUrl, {
    jsonrpc: '2.0',
    id: 107,
    method: 'tools/call',
    params: {
      name: 'worktree_manage_checklist',
      arguments: {
        task_id: autoTaskId,
        operation: 'toggle',
        item_id: firstItemId,
        is_done: true
      }
    }
  });
  assert.equal(toggleRes.data.result.isError, false);
  assert.equal(toggleRes.data.result.structuredContent.task_progress, 33);

  // 3. worktree_manage_dependency: self check, cross-tenant, add, cycle guard, member guard, remove
  const selfDepRes = await callMcpRpc(ownerUrl, {
    jsonrpc: '2.0',
    id: 108,
    method: 'tools/call',
    params: {
      name: 'worktree_manage_dependency',
      arguments: { operation: 'add', task_id: TASK_A2, depends_on_task_id: TASK_A2 }
    }
  });
  assert.equal(selfDepRes.data.result.isError, true);
  assert.equal(selfDepRes.data.result.structuredContent.error.code, 'invalid_argument');

  const crossTenantDepRes = await callMcpRpc(ownerUrl, {
    jsonrpc: '2.0',
    id: 109,
    method: 'tools/call',
    params: {
      name: 'worktree_manage_dependency',
      arguments: { operation: 'add', task_id: TASK_A2, depends_on_task_id: TASK_B1 }
    }
  });
  assert.equal(crossTenantDepRes.data.result.isError, true);
  assert.equal(crossTenantDepRes.data.result.structuredContent.error.code, 'not_found_or_denied');

  const addDepRes = await callMcpRpc(ownerUrl, {
    jsonrpc: '2.0',
    id: 110,
    method: 'tools/call',
    params: {
      name: 'worktree_manage_dependency',
      arguments: { operation: 'add', task_id: TASK_A2, depends_on_task_id: TASK_A1 }
    }
  });
  assert.equal(addDepRes.data.result.isError, false);

  const listDepRes = await callMcpRpc(ownerUrl, {
    jsonrpc: '2.0',
    id: 111,
    method: 'tools/call',
    params: {
      name: 'worktree_manage_dependency',
      arguments: { operation: 'list', task_id: TASK_A2 }
    }
  });
  assert.equal(listDepRes.data.result.isError, false);
  assert.equal(listDepRes.data.result.structuredContent.prerequisites.length, 1);
  assert.equal(listDepRes.data.result.structuredContent.prerequisites[0].id, TASK_A1);

  const blockedTaskGet = await callMcpRpc(ownerUrl, {
    jsonrpc: '2.0',
    id: 112,
    method: 'tools/call',
    params: { name: 'worktree_get_task', arguments: { task_id: TASK_A2 } }
  });
  assert.equal(blockedTaskGet.data.result.structuredContent.task.is_blocked, true);

  // Cycle detection: TASK_A1 depending back on TASK_A2 must fail with conflict
  const cycleDepRes = await callMcpRpc(ownerUrl, {
    jsonrpc: '2.0',
    id: 113,
    method: 'tools/call',
    params: {
      name: 'worktree_manage_dependency',
      arguments: { operation: 'add', task_id: TASK_A1, depends_on_task_id: TASK_A2 }
    }
  });
  assert.equal(cycleDepRes.data.result.isError, true);
  assert.equal(cycleDepRes.data.result.structuredContent.error.code, 'conflict');

  // Member can read visible dependency (list) on assigned TASK_A1, but cannot mutate dependencies (matches RLS)
  const memberListDepRes = await callMcpRpc(memberUrl, {
    jsonrpc: '2.0',
    id: 114,
    method: 'tools/call',
    params: {
      name: 'worktree_manage_dependency',
      arguments: { operation: 'list', task_id: TASK_A1 }
    }
  });
  assert.equal(memberListDepRes.data.result.isError, false);

  const memberAddDepDenied = await callMcpRpc(memberUrl, {
    jsonrpc: '2.0',
    id: 115,
    method: 'tools/call',
    params: {
      name: 'worktree_manage_dependency',
      arguments: { operation: 'add', task_id: TASK_A1, depends_on_task_id: autoTaskId }
    }
  });
  assert.equal(memberAddDepDenied.data.result.isError, true);
  assert.equal(memberAddDepDenied.data.result.structuredContent.error.code, 'permission_denied');

  // Remove dependency
  const removeDepRes = await callMcpRpc(ownerUrl, {
    jsonrpc: '2.0',
    id: 116,
    method: 'tools/call',
    params: {
      name: 'worktree_manage_dependency',
      arguments: { operation: 'remove', task_id: TASK_A2, depends_on_task_id: TASK_A1 }
    }
  });
  assert.equal(removeDepRes.data.result.isError, false);
  assert.equal(removeDepRes.data.result.structuredContent.removed, true);

  const unblockedTaskGet = await callMcpRpc(ownerUrl, {
    jsonrpc: '2.0',
    id: 117,
    method: 'tools/call',
    params: { name: 'worktree_get_task', arguments: { task_id: TASK_A2 } }
  });
  assert.equal(unblockedTaskGet.data.result.structuredContent.task.is_blocked, false);

  // 4. Management Logs API (GET /api/mcp?action=logs) tenant & role isolation
  const ownerLogsRes = await callManagement('GET', {
    action: 'logs',
    organizationId: ORG_A,
    limit: 20
  }, 'token-owner-a');
  assert.equal(ownerLogsRes.status, 200);
  assert.equal(ownerLogsRes.data.ok, true);
  assert.ok(ownerLogsRes.data.logs.length > 0);
  assert.ok(ownerLogsRes.data.logs.some(l => l.toolName === 'worktree_manage_dependency'));

  const memberLogsRes = await callManagement('GET', {
    action: 'logs',
    organizationId: ORG_A,
    limit: 20
  }, 'token-member-a');
  assert.equal(memberLogsRes.status, 200);
  assert.ok(memberLogsRes.data.logs.length > 0);
  assert.ok(
    memberLogsRes.data.logs.every(l => l.actorUserId === USER_MEMBER_A),
    'Non-admin member must only view their own MCP call logs'
  );

  const crossTenantLogsRes = await callManagement('GET', {
    action: 'logs',
    organizationId: ORG_B
  }, 'token-owner-a');
  assert.equal(crossTenantLogsRes.status, 403);

  // Cleanup temp task & MCP links
  await callMcpRpc(ownerUrl, {
    jsonrpc: '2.0',
    id: 118,
    method: 'tools/call',
    params: { name: 'worktree_archive_task', arguments: { task_id: autoTaskId } }
  });
  await callManagement('POST', { action: 'delete', organizationId: ORG_A, mcpId: ownerCreated.data.server.id }, 'token-owner-a');
  await callManagement('POST', { action: 'delete', organizationId: ORG_A, mcpId: memberCreated.data.server.id }, 'token-member-a');
});

test('MCP endpoint handles malformed key cleanly (404) and returns clear Vietnamese 503 when service key is missing', async () => {
  const malformedRes = await callMcpRpc(`${origin}/api/mcp?key=%ZZ`, { jsonrpc: '2.0', id: 201, method: 'tools/list' });
  assert.equal(malformedRes.status, 404);

  const unconfiguredHandler = createMcpHandler({
    env: {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: '',
      SUPABASE_SECRET_KEY: '',
      MCP_KEY_PEPPER: ''
    },
    supabase: null
  });
  let hit = null;
  await unconfiguredHandler(
    { method: 'GET', url: '/api/mcp?action=list', headers: {} },
    {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      getHeader(k) { return this.headers[k]; },
      removeHeader(k) { delete this.headers[k]; },
      status(code) { this.statusCode = code; return this; },
      json(body) { hit = { status: this.statusCode, body }; return this; },
      send(body) { hit = { status: this.statusCode, body }; return this; },
      end() { return this; }
    }
  );
  assert.ok(hit, 'Expected 503 response');
  assert.equal(hit.status, 503);
  assert.equal(hit.body.code, 'missing_backend_config');
  assert.match(hit.body.error, /SUPABASE_SERVICE_ROLE_KEY/);
});

test('MCP UI feature module adheres to AGENTS.md architecture and zero-secret rules', () => {
  const mcpDir = path.join(__dirname, '..', 'src', 'features', 'mcp');
  const files = [
    path.join(mcpDir, 'index.js'),
    path.join(mcpDir, 'services', 'mcp-client-service.js'),
    path.join(mcpDir, 'ui', 'mcp-dialog.js')
  ];
  for (const f of files) {
    assert.ok(fs.existsSync(f), `Expected file ${f}`);
    const content = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(content, /app\/state\.js/, 'Feature must not import app/state.js');
    assert.doesNotMatch(content, /(?<!&)#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/, 'UI feature must use CSS design tokens, no hardcoded hex colors');
    assert.doesNotMatch(content, /\balert\s*\(/, 'Must not use browser alert()');
  }
});

test('worktree_list_daily_checkins & worktree_list_recurring_templates enforce role/scope & tenant isolation', async () => {
  const ownerCreated = await callManagement('POST', {
    action: 'create',
    organizationId: ORG_A,
    name: 'Checkin Owner MCP',
    accessMode: 'read_only'
  }, 'token-owner-a');
  const memberCreated = await callManagement('POST', {
    action: 'create',
    organizationId: ORG_A,
    name: 'Checkin Member MCP',
    accessMode: 'read_only'
  }, 'token-member-a');
  const managerCreated = await callManagement('POST', {
    action: 'create',
    organizationId: ORG_A,
    name: 'Checkin Manager MCP',
    accessMode: 'read_only'
  }, 'token-manager-a');

  const ownerUrl = ownerCreated.data.server.url;
  const memberUrl = memberCreated.data.server.url;
  const managerUrl = managerCreated.data.server.url;

  try {
    // 1. Owner reads all org checkins + missing employees, never ORG_B
    const ownerChk = await callMcpRpc(ownerUrl, {
      jsonrpc: '2.0',
      id: 301,
      method: 'tools/call',
      params: { name: 'worktree_list_daily_checkins', arguments: { only_needs_support: true } }
    });
    assert.equal(ownerChk.data.result.isError, false);
    const ownerData = ownerChk.data.result.structuredContent;
    assert.equal(ownerData.total_checkins, 1);
    assert.equal(ownerData.needs_support_count, 1);
    assert.equal(ownerData.checkins[0].employee_id, EMP_MEMBER_A);
    assert.equal(ownerData.checkins[0].needs_support, true);
    assert.ok(ownerData.missing_employees.some(e => e.employee_id === EMP_OWNER_A));
    assert.equal(JSON.stringify(ownerData).includes('Bí mật Beta'), false);

    // 2. Scoped manager (NODE_A_DEPT1) sees in-scope check-ins & scoped missing only (excludes EMP_OWNER_A at NODE_A_ROOT)
    const mgrChk = await callMcpRpc(managerUrl, {
      jsonrpc: '2.0',
      id: 302,
      method: 'tools/call',
      params: { name: 'worktree_list_daily_checkins', arguments: {} }
    });
    assert.equal(mgrChk.data.result.isError, false);
    const mgrData = mgrChk.data.result.structuredContent;
    assert.equal(mgrData.checkins.length, 1);
    assert.equal(mgrData.missing_employees.some(e => e.employee_id === EMP_OWNER_A), false);

    // 3. Member sees only own check-in & no missing_employees list
    const memberChk = await callMcpRpc(memberUrl, {
      jsonrpc: '2.0',
      id: 303,
      method: 'tools/call',
      params: { name: 'worktree_list_daily_checkins', arguments: {} }
    });
    assert.equal(memberChk.data.result.isError, false);
    assert.equal(memberChk.data.result.structuredContent.checkins.length, 1);
    assert.deepEqual(memberChk.data.result.structuredContent.missing_employees, []);

    // 4. Invalid date format fails closed with invalid_argument
    const badDateRes = await callMcpRpc(ownerUrl, {
      jsonrpc: '2.0',
      id: 304,
      method: 'tools/call',
      params: { name: 'worktree_list_daily_checkins', arguments: { date: '19-11-2026' } }
    });
    assert.equal(badDateRes.data.result.isError, true);
    assert.equal(badDateRes.data.result.structuredContent.error.code, 'invalid_argument');

    // 5. worktree_list_recurring_templates returns only ORG_A templates
    const tplRes = await callMcpRpc(ownerUrl, {
      jsonrpc: '2.0',
      id: 305,
      method: 'tools/call',
      params: { name: 'worktree_list_recurring_templates', arguments: { assignment_mode: 'job_title', is_active: true } }
    });
    assert.equal(tplRes.data.result.isError, false);
    const tplData = tplRes.data.result.structuredContent;
    assert.equal(tplData.total, 1);
    assert.equal(tplData.templates[0].target_job_title, 'Sales');
    assert.equal(tplData.templates[0].checklist_count, 2);
    assert.equal(JSON.stringify(tplData).includes('Bí mật Beta'), false);
  } finally {
    await callManagement('POST', { action: 'delete', organizationId: ORG_A, mcpId: ownerCreated.data.server.id }, 'token-owner-a');
    await callManagement('POST', { action: 'delete', organizationId: ORG_A, mcpId: memberCreated.data.server.id }, 'token-member-a');
    await callManagement('POST', { action: 'delete', organizationId: ORG_A, mcpId: managerCreated.data.server.id }, 'token-owner-a');
  }
});
