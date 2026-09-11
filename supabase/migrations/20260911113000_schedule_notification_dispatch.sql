-- Schedule the notification queue dispatcher without storing deployment secrets
-- in source control. Before this migration is applied in an environment, provision
-- the Vault secrets documented in docs/operations/NOTIFICATION_PUSH.md.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.invoke_notification_dispatch()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_url text;
  v_service_role_key text;
BEGIN
  SELECT decrypted_secret
  INTO v_project_url
  FROM vault.decrypted_secrets
  WHERE name = 'worktree_project_url'
  LIMIT 1;

  SELECT decrypted_secret
  INTO v_service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'worktree_service_role_key'
  LIMIT 1;

  IF v_project_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE WARNING 'Notification dispatcher skipped: required Vault secrets are missing';
    RETURN NULL;
  END IF;

  RETURN net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/notification-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object('batch_size', 50),
    timeout_milliseconds := 15000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_notification_dispatch() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoke_notification_dispatch() FROM anon;
REVOKE ALL ON FUNCTION public.invoke_notification_dispatch() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_notification_dispatch() TO service_role;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid
  INTO v_job_id
  FROM cron.job
  WHERE jobname = 'worktree-notification-dispatch'
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'worktree-notification-dispatch',
    '* * * * *',
    'SELECT public.invoke_notification_dispatch();'
  );
END;
$$;

COMMENT ON FUNCTION public.invoke_notification_dispatch() IS
  'Invokes the authenticated notification-dispatch Edge Function using secrets stored in Supabase Vault.';
