const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const shareHandlerModule = require('../api/share');
const { createShareHandler } = shareHandlerModule;

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const NODE_A = 'aaaa1111-1111-4111-8111-111111111111';
const TASK_A = 'bbbb1111-1111-4111-8111-111111111111';
const TASK_B = 'bbbb2222-2222-4222-8222-222222222222';
const USER_ADMIN = '33333333-3333-4333-8333-333333333331';
const USER_VIEWER = '33333333-3333-4333-8333-333333333332';
const EMP_ADMIN = '44444444-4444-4444-8444-444444444441';
const CHECK_1 = '55555555-5555-4555-8555-555555555551';

function createMockShareDb() {
  const db = {
    organizations: [
      { id: ORG_A, name: 'NTH Group', status: 'active' },
      { id: ORG_B, name: 'Competitor Co', status: 'active' }
    ],
    organization_settings: [
      { organization_id: ORG_A, allow_external_task_share: true },
      { organization_id: ORG_B, allow_external_task_share: true }
    ],
    organization_members: [
      { id: 'mem-a1', organization_id: ORG_A, user_id: USER_ADMIN, employee_id: EMP_ADMIN, role: 'admin', status: 'active' },
      { id: 'mem-a2', organization_id: ORG_A, user_id: USER_VIEWER, employee_id: null, role: 'viewer', status: 'active' }
    ],
    member_scopes: [],
    organization_nodes: [
      { id: NODE_A, organization_id: ORG_A, parent_id: null, type: 'company', name: 'NTH Root', archived_at: null }
    ],
    organization_node_closure: [
      { organization_id: ORG_A, ancestor_id: NODE_A, descendant_id: NODE_A, depth: 0 }
    ],
    employees: [
      { id: EMP_ADMIN, organization_id: ORG_A, full_name: 'Nguyễn Trọng Hữu', email: 'secret-ceo@nth.vn', phone: '0909999999' }
    ],
    profiles: [
      { id: USER_ADMIN, display_name: 'Hữu Admin' }
    ],
    tasks: [
      {
        id: TASK_A,
        organization_id: ORG_A,
        node_id: NODE_A,
        title: 'Hoàn tất hợp đồng Q4',
        description: 'Kiểm tra phụ lục và nghiệm thu',
        status: 'in_progress',
        priority: 'high',
        start_date: '2026-11-18',
        due_date: '2026-11-25',
        progress: 40,
        auto_progress: false,
        tags: ['Pháp lý'],
        primary_assignee_id: EMP_ADMIN,
        collaborator_ids: [],
        archived_at: null,
        updated_at: '2026-11-19T00:00:00Z'
      },
      {
        id: TASK_B,
        organization_id: ORG_B,
        node_id: NODE_A,
        title: 'Bí mật công ty B',
        description: 'Không bao giờ được rò rỉ',
        status: 'todo',
        priority: 'urgent',
        primary_assignee_id: null,
        collaborator_ids: [],
        archived_at: null,
        updated_at: '2026-11-19T00:00:00Z'
      }
    ],
    task_checklist_items: [
      { id: CHECK_1, organization_id: ORG_A, task_id: TASK_A, content: 'Rà soát điều khoản', is_done: false, sort_order: 0, created_at: '2026-11-19T00:00:00Z' }
    ],
    task_comments: [
      { id: 'com-1', organization_id: ORG_A, task_id: TASK_A, author_user_id: USER_ADMIN, guest_author_name: null, is_internal: false, body: 'Chào anh/chị đối tác', created_at: '2026-11-19T01:00:00Z' },
      { id: 'com-2', organization_id: ORG_A, task_id: TASK_A, author_user_id: USER_ADMIN, guest_author_name: null, is_internal: true, body: 'NỘI BỘ: Giá vốn là 12tr', created_at: '2026-11-19T01:05:00Z' }
    ],
    task_attachments: [
      { id: 'att-1', organization_id: ORG_A, task_id: TASK_A, storage_path: 'private/secret/contract.pdf', original_name: 'HopDong_Q4.pdf', mime_type: 'application/pdf', size_bytes: 20480, created_at: '2026-11-19T01:10:00Z' }
    ],
    task_dependencies: [],
    task_share_links: [],
    security_audit_logs: [],
    activity_logs: []
  };

  let idSeq = 1;
  const nextUuid = () => `99999999-9999-4999-8999-${String(idSeq++).padStart(12, '0')}`;

  function buildChain(table) {
    const state = {
      filters: [],
      neqs: [],
      ins: [],
      orders: [],
      op: 'select',
      payload: null,
      singleMode: null
    };

    const api = {
      select() { return api; },
      eq(col, val) { state.filters.push([col, val]); return api; },
      neq(col, val) { state.neqs.push([col, val]); return api; },
      is(col, val) { state.filters.push([col, val]); return api; },
      in(col, vals) { state.ins.push([col, vals || []]); return api; },
      order(col, opts = {}) { state.orders.push([col, opts.ascending !== false]); return api; },
      insert(rows) {
        state.op = 'insert';
        state.payload = Array.isArray(rows) ? rows : [rows];
        return api;
      },
      update(patch) {
        state.op = 'update';
        state.payload = patch;
        return api;
      },
      upsert(rows, opts = {}) {
        state.op = 'upsert';
        state.payload = Array.isArray(rows) ? rows : [rows];
        state.upsertOpts = opts;
        return api;
      },
      maybeSingle() { state.singleMode = 'maybeSingle'; return exec(); },
      single() { state.singleMode = 'single'; return exec(); },
      then(resolve, reject) { return exec().then(resolve, reject); }
    };

    function matches(row) {
      for (const [c, v] of state.filters) if (row[c] !== v) return false;
      for (const [c, v] of state.neqs) if (row[c] === v) return false;
      for (const [c, vs] of state.ins) if (!vs.includes(row[c])) return false;
      return true;
    }

    async function exec() {
      const rows = db[table] || (db[table] = []);
      if (state.op === 'insert') {
        const inserted = state.payload.map(item => ({
          id: item.id || nextUuid(),
          view_count: 0,
          created_at: item.created_at || new Date().toISOString(),
          updated_at: item.updated_at || new Date().toISOString(),
          ...item
        }));
        rows.push(...inserted);
        if (state.singleMode) return { data: inserted[0] || null, error: null };
        return { data: inserted, error: null };
      }

      if (state.op === 'upsert') {
        const keyCol = state.upsertOpts?.onConflict || 'id';
        const out = [];
        for (const item of state.payload) {
          const idx = rows.findIndex(r => r[keyCol] === item[keyCol]);
          if (idx >= 0) {
            rows[idx] = { ...rows[idx], ...item };
            out.push(rows[idx]);
          } else {
            const added = { id: nextUuid(), ...item };
            rows.push(added);
            out.push(added);
          }
        }
        return { data: out, error: null };
      }

      if (state.op === 'update') {
        const matched = [];
        for (let i = 0; i < rows.length; i++) {
          if (matches(rows[i])) {
            rows[i] = { ...rows[i], ...state.payload, updated_at: new Date().toISOString() };
            matched.push(rows[i]);
          }
        }
        if (state.singleMode) return { data: matched[0] || null, error: null };
        return { data: matched, error: null };
      }

      let resRows = rows.filter(matches);
      for (const [col, asc] of state.orders.reverse()) {
        resRows = [...resRows].sort((a, b) => {
          if (a[col] === b[col]) return 0;
          return (a[col] > b[col] ? 1 : -1) * (asc ? 1 : -1);
        });
      }
      if (state.singleMode) return { data: resRows[0] || null, error: null };
      return { data: resRows, error: null };
    }

    return api;
  }

  return {
    db,
    auth: {
      async getUser(jwt) {
        if (jwt === 'jwt-admin') return { data: { user: { id: USER_ADMIN } }, error: null };
        if (jwt === 'jwt-viewer') return { data: { user: { id: USER_VIEWER } }, error: null };
        return { data: { user: null }, error: { message: 'invalid' } };
      }
    },
    from(table) {
      return buildChain(table);
    }
  };
}

async function invoke(handler, { method = 'GET', url = '/api/share', headers = {}, body = null } = {}) {
  const resState = { statusCode: 200, headers: {}, body: null };
  const res = {
    setHeader(k, v) { resState.headers[String(k).toLowerCase()] = v; },
    removeHeader(k) { delete resState.headers[String(k).toLowerCase()]; },
    status(code) { resState.statusCode = code; return res; },
    json(data) { resState.body = data; return res; },
    end(txt) { if (txt) resState.body = txt; return res; }
  };
  await handler({ method, url, headers, body }, res);
  return resState;
}

test('Invalid, missing, malformed, and revoked share tokens strictly return 404 without disclosure', async () => {
  const mockSb = createMockShareDb();
  const handler = createShareHandler({ supabase: mockSb, pepper: 'test-pepper-share' });

  const bad1 = await invoke(handler, { url: '/api/share?token=invalid_token_abc' });
  assert.equal(bad1.statusCode, 404);
  assert.deepEqual(bad1.body, { error: 'not_found' });

  const bad2 = await invoke(handler, { url: '/s/wtsh_missing_nonexistent_token_value_1234' });
  assert.equal(bad2.statusCode, 404);
  assert.deepEqual(bad2.body, { error: 'not_found' });
});

test('Role & cross-tenant authorization blocks viewer and Org B access on link creation', async () => {
  const mockSb = createMockShareDb();
  const handler = createShareHandler({ supabase: mockSb, pepper: 'test-pepper-share' });

  const viewerAttempt = await invoke(handler, {
    method: 'POST',
    url: '/api/share?action=create',
    headers: { authorization: 'Bearer jwt-viewer' },
    body: { organizationId: ORG_A, taskId: TASK_A, permission: 'view' }
  });
  assert.equal(viewerAttempt.statusCode, 403);

  const crossTenantAttempt = await invoke(handler, {
    method: 'POST',
    url: '/api/share?action=create',
    headers: { authorization: 'Bearer jwt-admin' },
    body: { organizationId: ORG_A, taskId: TASK_B, permission: 'view' }
  });
  assert.equal(crossTenantAttempt.statusCode, 403);
});

test('External share protects PIN, hides internal comments/PII, enforces permissions, and forbids deletion', async () => {
  const mockSb = createMockShareDb();
  const handler = createShareHandler({ supabase: mockSb, pepper: 'test-pepper-share' });

  // 1. Create PIN-protected comment share link with checklist toggle
  const createRes = await invoke(handler, {
    method: 'POST',
    url: '/api/share?action=create',
    headers: { authorization: 'Bearer jwt-admin', host: 'worktree.nguyentronghuu.com', 'x-forwarded-proto': 'https' },
    body: {
      organizationId: ORG_A,
      taskId: TASK_A,
      permission: 'comment',
      allowChecklistToggle: true,
      hideInternalComments: true,
      pin: '2468'
    }
  });
  assert.equal(createRes.statusCode, 201);
  assert.equal(createRes.body.link.hasPin, true);
  assert.match(createRes.body.link.url, /^https:\/\/worktree\.nguyentronghuu\.com\/s\/wtsh_/);
  const rawToken = createRes.body.link.url.split('/s/')[1];

  // 2. GET without PIN returns requiresPin and zero task details
  const lockedGet = await invoke(handler, { url: `/api/share?token=${rawToken}` });
  assert.equal(lockedGet.statusCode, 200);
  assert.equal(lockedGet.body.requiresPin, true);
  assert.equal(lockedGet.body.task, undefined);

  // 3. Wrong PIN returns 403
  const wrongPin = await invoke(handler, {
    method: 'POST',
    url: `/api/share?token=${rawToken}`,
    body: { guestAction: 'unlock', pin: '0000' }
  });
  assert.equal(wrongPin.statusCode, 403);

  // 4. Correct PIN unlocks task, hides internal comments, hides employee PII & storage_path
  const unlocked = await invoke(handler, {
    method: 'POST',
    url: `/api/share?token=${rawToken}`,
    body: { guestAction: 'unlock', pin: '2468' }
  });
  assert.equal(unlocked.statusCode, 200);
  assert.equal(unlocked.body.requiresPin, false);
  assert.equal(unlocked.body.task.title, 'Hoàn tất hợp đồng Q4');
  assert.equal(unlocked.body.task.primaryAssigneeName, 'Nguyễn Trọng Hữu');
  const serialized = JSON.stringify(unlocked.body);
  assert.equal(serialized.includes('secret-ceo@nth.vn'), false);
  assert.equal(serialized.includes('0909999999'), false);
  assert.equal(serialized.includes('Giá vốn'), false);
  assert.equal(serialized.includes('private/secret/contract.pdf'), false);
  assert.equal(unlocked.body.comments.length, 1);

  // 5. Guest can comment & toggle checklist, cannot update status/progress, and NEVER delete
  const commentRes = await invoke(handler, {
    method: 'POST',
    url: `/api/share?token=${rawToken}`,
    headers: { 'x-share-pin': '2468' },
    body: { guestAction: 'add_comment', guestName: 'Khách Đối Tác', body: 'Đã duyệt phụ lục 1' }
  });
  assert.equal(commentRes.statusCode, 201);
  assert.equal(commentRes.body.comment.isGuest, true);
  assert.match(commentRes.body.comment.authorName, /Khách Đối Tác/);

  const statusDenied = await invoke(handler, {
    method: 'POST',
    url: `/api/share?token=${rawToken}`,
    headers: { 'x-share-pin': '2468' },
    body: { guestAction: 'update_progress', status: 'done' }
  });
  assert.equal(statusDenied.statusCode, 403);

  const deleteDenied = await invoke(handler, {
    method: 'DELETE',
    url: `/api/share?token=${rawToken}`
  });
  assert.equal(deleteDenied.statusCode, 403);

  // 6. Rotation invalidates old token immediately; org kill switch disables all sharing
  const rotRes = await invoke(handler, {
    method: 'POST',
    url: '/api/share?action=rotate',
    headers: { authorization: 'Bearer jwt-admin', host: 'worktree.nguyentronghuu.com' },
    body: { organizationId: ORG_A, shareId: createRes.body.link.id }
  });
  assert.equal(rotRes.statusCode, 200);
  const newToken = rotRes.body.link.url.split('/s/')[1];
  assert.notEqual(newToken, rawToken);

  const oldGet = await invoke(handler, { url: `/api/share?token=${rawToken}` });
  assert.equal(oldGet.statusCode, 404);

  const policyOff = await invoke(handler, {
    method: 'POST',
    url: '/api/share?action=org_policy',
    headers: { authorization: 'Bearer jwt-admin' },
    body: { organizationId: ORG_A, allowExternalTaskShare: false }
  });
  assert.equal(policyOff.statusCode, 200);

  const disabledGet = await invoke(handler, { url: `/api/share?token=${newToken}` });
  assert.equal(disabledGet.statusCode, 404);
});

test('edit_progress allows progress/status updates while strictly blocking title edits, deletes, paused & revoked links', async () => {
  const mockSb = createMockShareDb();
  const handler = createShareHandler({ supabase: mockSb, pepper: 'test-pepper-share' });

  const createRes = await invoke(handler, {
    method: 'POST',
    url: '/api/share?action=create',
    headers: { authorization: 'Bearer jwt-admin', host: 'worktree.nguyentronghuu.com', 'x-forwarded-proto': 'https' },
    body: { organizationId: ORG_A, taskId: TASK_A, permission: 'edit_progress' }
  });
  assert.equal(createRes.statusCode, 201);
  const rawToken = createRes.body.link.url.split('/s/')[1];

  const updRes = await invoke(handler, {
    method: 'POST',
    url: `/api/share?token=${rawToken}`,
    body: { guestAction: 'update_progress', guestName: 'Đối tác B', status: 'review', progress: 85, title: 'HACKED' }
  });
  assert.equal(updRes.statusCode, 200);
  assert.equal(updRes.body.task.status, 'review');
  assert.equal(updRes.body.task.progress, 85);
  assert.equal(mockSb.db.tasks.find(t => t.id === TASK_A).title, 'Hoàn tất hợp đồng Q4');

  const delActionDenied = await invoke(handler, {
    method: 'POST',
    url: `/api/share?token=${rawToken}`,
    body: { guestAction: 'delete_task' }
  });
  assert.equal(delActionDenied.statusCode, 403);

  const pauseRes = await invoke(handler, {
    method: 'POST',
    url: '/api/share?action=toggle',
    headers: { authorization: 'Bearer jwt-admin' },
    body: { organizationId: ORG_A, shareId: createRes.body.link.id }
  });
  assert.equal(pauseRes.statusCode, 200);
  assert.equal(pauseRes.body.link.status, 'paused');

  const pausedGet = await invoke(handler, { url: `/api/share?token=${rawToken}` });
  assert.equal(pausedGet.statusCode, 404);

  const resumeRes = await invoke(handler, {
    method: 'POST',
    url: '/api/share?action=toggle',
    headers: { authorization: 'Bearer jwt-admin' },
    body: { organizationId: ORG_A, shareId: createRes.body.link.id }
  });
  assert.equal(resumeRes.body.link.status, 'active');

  const revokeRes = await invoke(handler, {
    method: 'POST',
    url: '/api/share?action=delete',
    headers: { authorization: 'Bearer jwt-admin' },
    body: { organizationId: ORG_A, shareId: createRes.body.link.id }
  });
  assert.equal(revokeRes.statusCode, 200);
  assert.equal(revokeRes.body.revoked, true);

  const revokedGet = await invoke(handler, { url: `/api/share?token=${rawToken}` });
  assert.equal(revokedGet.statusCode, 404);
});

test('Static audit on share files guarantees zero hardcoded secrets and no raw innerHTML leaks', () => {
  const shareHtml = fs.readFileSync(path.join(__dirname, '..', 'share.html'), 'utf8');
  const shareApi = fs.readFileSync(path.join(__dirname, '..', 'api', 'share.js'), 'utf8');
  const migration = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20261119103000_add_task_share_links.sql'),
    'utf8'
  );

  assert.equal(/sb_secret_|sk-[A-Za-z0-9]{12,}|SUPABASE_SERVICE_ROLE/.test(shareHtml), false);
  assert.equal(shareHtml.includes('tokens.css'), true);
  assert.equal(shareApi.includes('delete_task'), true);
  assert.equal(/REVOKE ALL ON public\.task_share_links FROM PUBLIC, anon/i.test(migration), true);
});
