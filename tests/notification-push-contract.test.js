const { strict: assert } = require('node:assert');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

const projectRoot = join(__dirname, '..');
const read = relativePath => readFileSync(join(projectRoot, relativePath), 'utf8');

test('frontend initializes OneSignal before binding the authenticated user', () => {
  const app = read('src/app/app.js');
  const pushService = read('src/features/notifications/services/push-device-service.js');

  assert.match(
    app,
    /initOneSignal\(\)\s*\.then\(initialized => initialized \? PushDeviceService\.loginUser\(user\.id\) : false\)/
  );
  assert.match(pushService, /await oneSignalSdk\.login\(userId\)/);
  assert.match(pushService, /subscription\?\.optedIn !== true/);
});

test('frontend persists only real OneSignal subscription IDs', () => {
  const pushService = read('src/features/notifications/services/push-device-service.js');

  assert.match(pushService, /p_subscription_id: subscriptionId/);
  assert.doesNotMatch(pushService, /['"]web-['"]\s*\+\s*crypto\.randomUUID/);
  assert.doesNotMatch(pushService, /wtx_push_device_id/);
});

test('dispatcher matches the database push device contract and current OneSignal API', () => {
  const dispatcher = read('supabase/functions/notification-dispatch/index.ts');
  const migration = read('supabase/migrations/20260910140000_notification_infrastructure.sql');

  assert.match(migration, /subscription_id text PRIMARY KEY/);
  assert.match(migration, /enabled boolean NOT NULL DEFAULT true/);
  assert.match(dispatcher, /\.select\("subscription_id"\)/);
  assert.match(dispatcher, /\.eq\("enabled", true\)/);
  assert.match(dispatcher, /https:\/\/api\.onesignal\.com\/notifications/);
  assert.match(dispatcher, /include_subscription_ids: subscriptionIds/);
  assert.doesNotMatch(dispatcher, /include_player_ids/);
  assert.doesNotMatch(dispatcher, /Simulating delivery/);
});

test('dispatcher fails closed when server credentials or authorization are invalid', () => {
  const dispatcher = read('supabase/functions/notification-dispatch/index.ts');

  assert.match(dispatcher, /authorization !== `Bearer \$\{SUPABASE_SERVICE_ROLE_KEY\}`/);
  assert.match(dispatcher, /status: 401/);
  assert.match(dispatcher, /Notification dispatcher is not configured/);
  assert.match(dispatcher, /status: 503/);
  assert.match(dispatcher, /if \(!osData\?\.id\) throw new Error\("ONESIGNAL_NO_MESSAGE_ID"\)/);
  assert.match(dispatcher, /MAX_EVENT_PUSH_AGE_MS = 2 \* 60 \* 60 \* 1000/);
  assert.match(dispatcher, /last_error_code: "STALE_EVENT_PUSH"/);
});

test('scheduler invokes the dispatcher without committing secrets', () => {
  const scheduler = read('supabase/migrations/20260911113000_schedule_notification_dispatch.sql');

  assert.match(scheduler, /vault\.decrypted_secrets/);
  assert.match(scheduler, /worktree_project_url/);
  assert.match(scheduler, /worktree_service_role_key/);
  assert.match(scheduler, /'\* \* \* \* \*'/);
  assert.doesNotMatch(scheduler, /eyJ[a-zA-Z0-9_-]+\./);
});
