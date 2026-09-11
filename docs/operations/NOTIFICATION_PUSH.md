# WorkTree X — Notification Push Operations

## Required secrets

The browser only receives the OneSignal App ID. Keep the OneSignal REST API key and Supabase service-role key in trusted environments.

Configure Edge Function secrets:

```powershell
npx supabase secrets set ONESIGNAL_APP_ID="<onesignal-app-id>" ONESIGNAL_REST_API_KEY="<onesignal-rest-api-key>" --project-ref "<project-ref>"
```

Store the scheduler inputs in Supabase Vault through the SQL editor. These values must never be committed:

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'worktree_project_url');
select vault.create_secret('<service-role-key>', 'worktree_service_role_key');
```

Apply migrations, then deploy the function:

```powershell
npx supabase db push --project-ref "<project-ref>"
npx supabase functions deploy notification-dispatch --project-ref "<project-ref>"
```

The migration `20260911113000_schedule_notification_dispatch.sql` creates a one-minute cron job. The dispatcher accepts only a valid service-role bearer token, claims jobs atomically, and calls the current OneSignal Create Message endpoint with real subscription IDs.

## Verification

Run these read-only queries in the Supabase SQL editor:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'worktree-notification-dispatch';

select status, count(*)
from public.notification_jobs
group by status
order by status;

select id, status, attempt_count, last_error_code, scheduled_for, updated_at
from public.notification_jobs
order by created_at desc
limit 20;

select status_code, content, created
from net._http_response
order by created desc
limit 20;
```

A valid end-to-end test must show all of the following:

- the phone/browser has granted notification permission;
- `push_devices.subscription_id` is a real OneSignal subscription ID and `enabled = true`;
- a due queue row moves from `pending` to `sent`;
- the matching OneSignal request returns a message ID;
- the notification arrives while WorkTree is not the focused browser tab.

On iPhone/iPad, Web Push requires iOS/iPadOS 16.4 or later and WorkTree must be added to the Home Screen as a web app.

## Failure handling

- Missing Edge secrets: the function returns HTTP 503 and does not claim jobs.
- Invalid scheduler authorization: the function returns HTTP 401.
- OneSignal rejects a request: the job returns to `pending` with exponential backoff, then becomes `failed` after `max_attempts`.
- No active subscription or push disabled by the user: the dispatcher completes the job without claiming that a push was delivered; the in-app notification remains available.
- Event-driven `push_dispatch` jobs older than two hours are cancelled to prevent a notification burst after a prolonged outage. Scheduled/manual reminders are not discarded by this guard.

## Rollback

```sql
select cron.unschedule(jobid)
from cron.job
where jobname = 'worktree-notification-dispatch';

drop function if exists public.invoke_notification_dispatch();
```

After rollback, queued notifications remain in `notification_jobs` and can be dispatched after the scheduler is restored.
