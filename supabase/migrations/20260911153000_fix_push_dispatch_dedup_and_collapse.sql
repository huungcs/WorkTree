-- Migration: 20260911153000_fix_push_dispatch_dedup_and_collapse.sql
-- Module: Notifications & Push Dispatch
-- Purpose: Prevent notification spam/stacking by using task-scoped collapse_id & web_push_topic,
--          ensure WorkTree branding icon is always present, and prevent duplicate background polling.

-- 1. Update dispatch_onesignal_notification with task-scoped collapse topic & icons
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
  v_topic text;
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

  -- 3. Scope topic to task so subsequent status updates replace previous notifications for the same task
  IF NEW.task_id IS NOT NULL THEN
    v_topic := 'task_' || NEW.task_id::text;
  ELSE
    v_topic := 'notif_' || NEW.id::text;
  END IF;

  -- 4. Post notification immediately to OneSignal via pg_net
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
      'priority', 10,
      'ttl', 259200,
      'web_push_topic', v_topic,
      'collapse_id', v_topic,
      'url', 'https://worktree.nguyentronghuu.com',
      'chrome_web_icon', 'https://worktree.nguyentronghuu.com/assets/icon-192.png',
      'chrome_web_badge', 'https://worktree.nguyentronghuu.com/assets/icon-192.png',
      'data', jsonb_build_object(
        'url', 'https://worktree.nguyentronghuu.com',
        'taskId', NEW.task_id,
        'notificationId', NEW.id
      )
    ),
    timeout_milliseconds := 10000
  );

  -- 5. Mark any associated notification_jobs as sent
  UPDATE public.notification_jobs
  SET status = 'sent', updated_at = now()
  WHERE notification_id = NEW.id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'OneSignal push dispatch error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 2. Update notify_task_status_change so it marks notification_jobs as sent upon insertion
CREATE OR REPLACE FUNCTION public.notify_task_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_assignee_user uuid;
  v_creator_user uuid;
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_status_name text;
  v_title text;
  v_body text;
  v_kind text;
  v_notif_id uuid;
BEGIN
  -- Only fire when status actually changes
  IF TG_OP <> 'UPDATE' OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- 1. Identify actor display name
  IF v_actor IS NOT NULL THEN
    SELECT COALESCE(e.full_name, p.display_name, 'Một thành viên') INTO v_actor_name
    FROM public.profiles p
    LEFT JOIN public.organization_members m ON m.user_id = p.id AND m.organization_id = NEW.organization_id AND m.status = 'active'
    LEFT JOIN public.employees e ON e.id = m.employee_id
    WHERE p.id = v_actor
    LIMIT 1;
  END IF;

  IF v_actor_name IS NULL OR v_actor_name = '' THEN
    v_actor_name := 'Người quản lý';
  END IF;

  -- Human-friendly status labels in Vietnamese
  CASE NEW.status
    WHEN 'todo' THEN v_status_name := 'Chưa bắt đầu';
    WHEN 'in_progress' THEN v_status_name := 'Đang thực hiện';
    WHEN 'review' THEN v_status_name := 'Chờ duyệt';
    WHEN 'done' THEN v_status_name := 'Hoàn thành';
    WHEN 'cancelled' THEN v_status_name := 'Đã hủy';
    ELSE v_status_name := NEW.status::text;
  END CASE;

  -- Title & Kind customization with actor name
  IF NEW.status = 'done' THEN
    v_kind := 'task_completed';
    v_title := v_actor_name || ' đã đánh dấu Hoàn thành';
  ELSIF NEW.status = 'review' THEN
    v_kind := 'task_status_changed';
    v_title := v_actor_name || ' đã chuyển sang Chờ duyệt';
  ELSIF NEW.status = 'in_progress' THEN
    v_kind := 'task_status_changed';
    v_title := v_actor_name || ' đã chuyển sang Đang thực hiện';
  ELSE
    v_kind := 'task_status_changed';
    v_title := v_actor_name || ' đã chuyển sang ' || v_status_name;
  END IF;

  v_body := NEW.title;

  -- 2. Identify primary assignee's auth.user
  IF NEW.primary_assignee_id IS NOT NULL THEN
    SELECT m.user_id INTO v_assignee_user
    FROM public.organization_members m
    WHERE m.organization_id = NEW.organization_id
      AND m.employee_id = NEW.primary_assignee_id
      AND m.status = 'active'
    LIMIT 1;
  END IF;

  -- 3. Identify task creator's auth.user
  v_creator_user := NEW.created_by;

  -- Notify Assignee (if actor is not the assignee)
  IF v_assignee_user IS NOT NULL AND (v_actor IS NULL OR v_assignee_user IS DISTINCT FROM v_actor) THEN
    INSERT INTO public.notifications (
      organization_id, user_id, actor_user_id, kind, title, body, task_id, metadata
    )
    VALUES (
      NEW.organization_id,
      v_assignee_user,
      v_actor,
      v_kind,
      v_title,
      v_body,
      NEW.id,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'actor_name', v_actor_name)
    )
    RETURNING id INTO v_notif_id;

    -- Native trigger trg_notifications_dispatch_onesignal sends push immediately; record job as 'sent'
    INSERT INTO public.notification_jobs (
      organization_id, recipient_user_id, notification_id, task_id, job_type, scheduled_for, status
    )
    VALUES (
      NEW.organization_id, v_assignee_user, v_notif_id, NEW.id, 'push_dispatch', now(), 'sent'
    );
  END IF;

  -- Notify Creator (if actor is not the creator, and creator is not same as assignee already notified)
  IF v_creator_user IS NOT NULL 
     AND (v_actor IS NULL OR v_creator_user IS DISTINCT FROM v_actor)
     AND (v_assignee_user IS NULL OR v_creator_user IS DISTINCT FROM v_assignee_user) THEN
    INSERT INTO public.notifications (
      organization_id, user_id, actor_user_id, kind, title, body, task_id, metadata
    )
    VALUES (
      NEW.organization_id,
      v_creator_user,
      v_actor,
      v_kind,
      v_title,
      v_body,
      NEW.id,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'actor_name', v_actor_name)
    )
    RETURNING id INTO v_notif_id;

    INSERT INTO public.notification_jobs (
      organization_id, recipient_user_id, notification_id, task_id, job_type, scheduled_for, status
    )
    VALUES (
      NEW.organization_id, v_creator_user, v_notif_id, NEW.id, 'push_dispatch', now(), 'sent'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Clear backlog of un-dispatched pending jobs to prevent blast replays
UPDATE public.notification_jobs
SET status = 'sent', updated_at = now()
WHERE status = 'pending';
