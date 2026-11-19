const { strict: assert } = require('node:assert');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

async function loadStateModule() {
  const source = readFileSync(join(__dirname, '..', 'src', 'app', 'state.js'), 'utf8');
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  return import(moduleUrl);
}

test('normalizes repository star ID arrays to a Set for UI mutations', async () => {
  const { normalizeStarredTaskIds } = await loadStateModule();
  const starredTaskIds = normalizeStarredTaskIds(['task-a', 'task-b', 'task-a']);

  assert.equal(starredTaskIds instanceof Set, true);
  assert.equal(starredTaskIds.size, 2);
  assert.equal(starredTaskIds.has('task-a'), true);
  assert.equal(starredTaskIds.has('task-b'), true);
});

test('keeps an existing Set instance intact', async () => {
  const { normalizeStarredTaskIds } = await loadStateModule();
  const existing = new Set(['task-a']);
  const normalized = normalizeStarredTaskIds(existing);

  assert.equal(normalized, existing);
  assert.equal(normalized.has('task-a'), true);
});

test('setActiveOrg(null) removes active org preference and syncAuthenticatedUser isolates cross-user localStorage', async () => {
  const store = new Map();
  const prevLocalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };

  try {
    const { appState } = await loadStateModule();
    appState.syncAuthenticatedUser('user-a');
    appState.setActiveOrg('org-a', { role: 'owner' });
    assert.equal(store.get('worktree_active_organization_id'), 'org-a');
    assert.equal(store.get('worktree_last_auth_user_id'), 'user-a');

    // Signing out clears active org preference and last user marker
    appState.setActiveOrg(null);
    assert.equal(store.has('worktree_active_organization_id'), false);
    assert.equal(appState.activeOrganizationId, null);

    // Simulate user-a having a persisted org, then user-b signs in on same browser
    store.set('worktree_active_organization_id', 'org-a');
    store.set('worktree_last_auth_user_id', 'user-a');
    appState.activeOrganizationId = 'org-a';

    appState.syncAuthenticatedUser('user-b');
    assert.equal(store.has('worktree_active_organization_id'), false);
    assert.equal(appState.activeOrganizationId, null);
    assert.equal(store.get('worktree_last_auth_user_id'), 'user-b');
  } finally {
    if (prevLocalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevLocalStorage;
  }
});

test('OrgService.slugify converts Vietnamese d/D and pads short company names', async () => {
  const { OrgService } = await import('../src/features/organizations/services/org-service.js');
  assert.equal(OrgService.slugify('Công ty Đạt Phát'), 'cong-ty-dat-phat');
  assert.equal(OrgService.slugify('Đoàn Đội 24h'), 'doan-doi-24h');
  assert.equal(OrgService.slugify('AI'), 'ai-org');
  assert.equal(OrgService.slugify('ĐĐ'), 'dd-org');
  assert.equal(OrgService.slugify('---'), '');
});

test('OrgService.createNewOrganization auto-resolves slug collisions when enabled', async () => {
  const { OrgService } = await import('../src/features/organizations/services/org-service.js');

  const attemptedSlugs = [];
  const autoRepo = {
    async createOrganization(name, slug) {
      attemptedSlugs.push(slug);
      if (attemptedSlugs.length === 1) {
        const dupErr = new Error('duplicate key value violates unique constraint "organizations_slug_key"');
        dupErr.code = '23505';
        throw dupErr;
      }
      return 'org-new-123';
    },
    async getMembership(orgId) {
      return { id: 'mem-1', organization_id: orgId, role: 'owner', status: 'active' };
    }
  };

  const created = await OrgService.createNewOrganization(
    'Công ty Đạt Phát',
    'cong-ty-dat-phat',
    'Asia/Ho_Chi_Minh',
    { autoResolveSlugCollision: true, repository: autoRepo }
  );

  assert.equal(attemptedSlugs.length, 2);
  assert.equal(attemptedSlugs[0], 'cong-ty-dat-phat');
  assert.match(attemptedSlugs[1], /^cong-ty-dat-phat-[a-z0-9]{4}$/);
  assert.equal(created.organizationId, 'org-new-123');
  assert.equal(created.slug, attemptedSlugs[1]);
  assert.equal(created.role, 'owner');

  const strictRepo = {
    async createOrganization() {
      const dupErr = new Error('duplicate key value violates unique constraint "organizations_slug_key"');
      dupErr.code = '23505';
      throw dupErr;
    }
  };
  await assert.rejects(
    () => OrgService.createNewOrganization('Công ty Đạt Phát', 'cong-ty-dat-phat', 'Asia/Ho_Chi_Minh', { repository: strictRepo }),
    /Đường dẫn workspace này đã được sử dụng/
  );
});
