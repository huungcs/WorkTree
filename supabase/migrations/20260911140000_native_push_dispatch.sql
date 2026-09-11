-- 20260911140000_native_push_dispatch.sql
-- Native server-side OneSignal Web Push dispatch via pg_net & Supabase Vault.
-- Enables real-time push delivery to locked/closed devices with zero latency.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 1. Trigger function to dispatch OneSignal push
CREATE OR REPLACE FUNCTION public.dispatch_onesignal_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_app_id text;
  v_api_key text;
  v_devices jsonb;
BEGIN
  -- 1. Retrieve OneSignal credentials securely from Supabase Vault
  SELECT decrypted_secret INTO v_app_id
  FROM vault.decrypted_secrets
  WHERE name = 'onesignal_app_id'
  LIMIT 1;

  SELECT decrypted_secret INTO v_api_key
  FROM vault.decrypted_secrets
  WHERE name = 'onesignal_rest_api_key'
  LIMIT 1;

  IF v_app_id IS NULL OR v_api_key IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2. Find recipient's active push devices (only real UUID subscription IDs)
  SELECT jsonb_agg(subscription_id) INTO v_devices
  FROM public.push_devices
  WHERE user_id = NEW.user_id
    AND enabled = true
    AND subscription_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  IF v_devices IS NULL OR jsonb_array_length(v_devices) = 0 THEN
    RETURN NEW;
  END IF;

  -- 3. Post notification immediately to OneSignal via pg_net
  PERFORM net.http_post(
    url := 'https://api.onesignal.com/notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Key ' || v_api_key
    ),
    body := jsonb_build_object(
      'app_id', v_app_id,
      'include_subscription_ids', v_devices,
      'headings', jsonb_build_object('en', NEW.title),
      'contents', jsonb_build_object('en', COALESCE(NEW.body, 'Bạn có thông báo mới trên WorkTree X')),
      'url', 'https://worktree.nguyentronghuu.com',
      'chrome_web_icon', 'https://worktree.nguyentronghuu.com/assets/icon-192.png',
      'data', jsonb_build_object(
        'url', 'https://worktree.nguyentronghuu.com',
        'taskId', NEW.task_id,
        'notificationId', NEW.id
      )
    ),
    timeout_milliseconds := 10000
  );

  -- 4. Mark any associated notification_jobs as sent
  UPDATE public.notification_jobs
  SET status = 'sent', updated_at = now()
  WHERE notification_id = NEW.id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block database inserts on push notification network errors
  RAISE WARNING 'OneSignal push dispatch error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 2. Bind trigger to notifications table
DROP TRIGGER IF EXISTS trg_notifications_dispatch_onesignal ON public.notifications;
CREATE TRIGGER trg_notifications_dispatch_onesignal
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.dispatch_onesignal_notification();
