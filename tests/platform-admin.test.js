const { strict: assert } = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const SERVER_URL = 'http://localhost:8080';

async function fetchApi(path, options = {}) {
  const url = `${SERVER_URL}${path}`;
  const res = await fetch(url, options);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

test('Platform Admin Security Gate: Anonymous request is rejected with 401', async () => {
  const { status, data } = await fetchApi('/api/platform-admin?action=check');
  assert.equal(status, 401, 'Anon request must receive 401 Unauthorized');
  assert.equal(data.ok, false);
  assert.match(data.error, /(?:Authorization|đăng nhập)/i);
});

test('Platform Admin Security Gate: Invalid bearer token is rejected with 401', async () => {
  const { status, data } = await fetchApi('/api/platform-admin?action=check', {
    headers: { 'Authorization': 'Bearer fake_invalid_jwt_token_xyz' }
  });
  assert.equal(status, 401, 'Invalid token must receive 401 Unauthorized');
  assert.equal(data.ok, false);
});

test('Platform Admin Security Gate: Mutation without auth is rejected with 401', async () => {
  const { status, data } = await fetchApi('/api/platform-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'suspend-tenant',
      organizationId: '00000000-0000-0000-0000-000000000000',
      reason: 'Unauthorized test attack'
    })
  });
  assert.equal(status, 401, 'Anonymous mutation must receive 401');
  assert.equal(data.ok, false);
});

test('Frontend Bundle Secret Scan: No service_role or secret keys in client source code', () => {
  const clientDirs = [
    path.join(__dirname, '..', 'src'),
    path.join(__dirname, '..', 'js')
  ];

  const forbiddenPatterns = [
    /SUPABASE_SECRET_KEY/i,
    /service_role/i,
    /sb_secret_/i,
    /ONESIGNAL_REST_API_KEY/i
  ];

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (/\.(js|html|css|json)$/i.test(entry.name)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const pattern of forbiddenPatterns) {
          // Allow comment/doc references if any, but fail if assigned or exported
          const match = content.match(pattern);
          if (match) {
            // Check if it's an actual secret value rather than comment
            const line = content.split('\n').find(l => pattern.test(l));
            if (line && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
              assert.fail(`Secret leakage pattern "${pattern}" detected in client file: ${fullPath}\nLine: ${line}`);
            }
          }
        }
      }
    }
  }

  for (const d of clientDirs) {
    scanDir(d);
  }
});

test('Platform Admin Shell Architecture: Essential files exist and export required contracts', () => {
  const shellPath = path.join(__dirname, '..', 'src', 'features', 'platform-admin', 'ui', 'platform-admin-shell.js');
  const servicePath = path.join(__dirname, '..', 'src', 'features', 'platform-admin', 'services', 'platform-admin-service.js');
  const indexPath = path.join(__dirname, '..', 'src', 'features', 'platform-admin', 'index.js');
  const apiPath = path.join(__dirname, '..', 'api', 'platform-admin.js');

  assert.ok(fs.existsSync(shellPath), 'platform-admin-shell.js must exist');
  assert.ok(fs.existsSync(servicePath), 'platform-admin-service.js must exist');
  assert.ok(fs.existsSync(indexPath), 'platform-admin/index.js must exist');
  assert.ok(fs.existsSync(apiPath), 'api/platform-admin.js must exist');

  const shellContent = fs.readFileSync(shellPath, 'utf8');
  assert.match(shellContent, /export async function openPlatformAdminPortal/, 'Shell must export openPlatformAdminPortal');
  assert.match(shellContent, /export function closePlatformAdminPortal/, 'Shell must export closePlatformAdminPortal');
  assert.match(shellContent, /paConfirmDialog/, 'Shell must include suspension confirmation dialog');
  assert.match(shellContent, /paTenantDrawer/, 'Shell must include tenant detail drawer');

  const apiContent = fs.readFileSync(apiPath, 'utf8');
  assert.match(apiContent, /platform_admins/, 'API handler must verify platform_admins');
  assert.match(apiContent, /suspend-tenant/, 'API handler must support suspend-tenant');
  assert.match(apiContent, /unsuspend-tenant/, 'API handler must support unsuspend-tenant');
  assert.match(apiContent, /security_audit_logs/, 'API handler must audit platform mutations');
});
