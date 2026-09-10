-- Migration: 20260910140000_notification_infrastructure.sql
-- Purpose: Implement Cloud Notification Infrastructure, Preferences, Push Device Registry,
--          Scheduled Reminder Jobs Queue, Manual Reminders, Domain Event Triggers,
--          and Secure User Realtime Notification Channels for WorkTree X Step 11.

-- =============================================================================
-- 1. PUBLIC.NOTIFICATIONS ENHANCEMENTS
-- =============================================================================
ALTER TABLE public.notifications 
  ADD COLUMN IF NOT EXISTS actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

CREATE INDEX IF NOT EXISTS notifications_user_org_idx 
  ON public.notifications (organization_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_task_idx 
  ON public.notifications (task_id) 
  WHERE task_id IS NOT NULL;

-- Ensure users can insert their own manual notifications if needed via RPC,
-- but standard inserts come from triggers/services.
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;

-- =============================================================================
-- 2. PUBLIC.NOTIFICATION_PREFERENCES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  task_assigned_push boolean NOT NULL DEFAULT true,
  due_soon_push boolean NOT NULL DEFAULT true,
  overdue_push boolean NOT NULL DEFAULT true,
  comment_push boolean NOT NULL DEFAULT true,
  manual_reminder_push boolean NOT NULL DEFAULT true,
  quiet_hours_enabled boolean NOT NULL DEFAULT false,
  quiet_hours_start text NOT NULL DEFAULT '22:00',
  quiet_hours_end text NOT NULL DEFAULT '07:00',
  timezone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_preferences_select_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_select_own" ON public.notification_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notification_preferences_insert_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_insert_own" ON public.notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notification_preferences_update_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_update_own" ON public.notification_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notification_preferences_delete_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_delete_own" ON public.notification_preferences
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;

-- =============================================================================
-- 3. PUBLIC.PUSH_DEVICES (Push Device Registry)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.push_devices (
  subscription_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'web',
  user_agent text,
  device_label text,
  enabled boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_devices_user_enabled_idx 
  ON public.push_devices (user_id, enabled);

ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_devices_select_own" ON public.push_devices;
CREATE POLICY "push_devices_select_own" ON public.push_devices
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "push_devices_insert_own" ON public.push_devices;
CREATE POLICY "push_devices_insert_own" ON public.push_devices
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "push_devices_update_own" ON public.push_devices;
CREATE POLICY "push_devices_update_own" ON public.push_devices
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "push_devices_delete_own" ON public.push_devices;
CREATE POLICY "push_devices_delete_own" ON public.push_devices
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_devices TO authenticated;

-- Secure device binding RPC to guarantee user_id derived from auth.uid()
-- and safely handle shared device re-binding (User A -> User B)
CREATE OR REPLACE FUNCTION public.register_push_device(
  p_subscription_id text,
  p_platform text DEFAULT 'web',
  p_user_agent text DEFAULT NULL,
  p_device_label text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to register push device';
  END IF;
  IF p_subscription_id IS NULL OR trim(p_subscription_id) = '' THEN
    RAISE EXCEPTION 'Subscription ID is required';
  END IF;

  INSERT INTO public.push_devices (
    subscription_id, user_id, platform, user_agent, device_label, enabled, last_seen_at
  )
  VALUES (
    p_subscription_id, v_user_id, COALESCE(p_platform, 'web'), p_user_agent, p_device_label, true, now()
  )
  ON CONFLICT (subscription_id) DO UPDATE
  SET user_id = v_user_id,
      platform = COALESCE(EXCLUDED.platform, public.push_devices.platform),
      user_agent = COALESCE(EXCLUDED.user_agent, public.push_devices.user_agent),
      device_label = COALESCE(EXCLUDED.device_label, public.push_devices.device_label),
      enabled = true,
      last_seen_at = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_row.subscription_id,
    'user_id', v_row.user_id,
    'enabled', v_row.enabled
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.unregister_push_device(
  p_subscription_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to unregister push device';
  END IF;

  UPDATE public.push_devices
  SET enabled = false, last_seen_at = now()
  WHERE subscription_id = p_subscription_id
    AND user_id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_push_device(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_push_device(text) TO authenticated;

-- =============================================================================
-- 4. PUBLIC.NOTIFICATION_JOBS (Delivery & Scheduled Reminders Queue)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id uuid REFERENCES public.notifications(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  job_type text NOT NULL, -- 'push_dispatch', 'due_soon_reminder', 'overdue_reminder', 'manual_reminder'
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempt_count int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  last_error_code text,
  last_error text,
  idempotency_key uuid NOT NULL DEFAULT gen_random_uuid(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_jobs_claim_idx 
  ON public.notification_jobs (status, scheduled_for ASC) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS notification_jobs_recipient_idx 
  ON public.notification_jobs (organization_id, recipient_user_id, status);

CREATE INDEX IF NOT EXISTS notification_jobs_task_idx 
  ON public.notification_jobs (task_id, job_type, status);

ALTER TABLE public.notification_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_jobs_select_own" ON public.notification_jobs;
CREATE POLICY "notification_jobs_select_own" ON public.notification_jobs
  FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid() AND public.is_org_member(organization_id));

GRANT SELECT ON public.notification_jobs TO authenticated;
GRANT ALL ON public.notification_jobs TO service_role;

-- RPC for Queue Claiming with FOR UPDATE SKIP LOCKED
CREATE OR REPLACE FUNCTION public.claim_notification_jobs(
  p_batch_size int DEFAULT 10
)
RETURNS SETOF public.notification_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id
    FROM public.notification_jobs
    WHERE status = 'pending'
      AND scheduled_for <= now()
    ORDER BY scheduled_for ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.notification_jobs j
  SET status = 'processing',
      attempt_count = j.attempt_count + 1,
      updated_at = now()
  FROM claimed
  WHERE j.id = claimed.id
  RETURNING j.*;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_notification_jobs(int) TO service_role;

-- =============================================================================
-- 5. PUBLIC.MANUAL_REMINDERS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.manual_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  creator_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  title text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT manual_reminders_title_len CHECK (char_length(title) BETWEEN 1 AND 240)
);

CREATE INDEX IF NOT EXISTS manual_reminders_org_time_idx 
  ON public.manual_reminders (organization_id, scheduled_for ASC) 
  WHERE status = 'pending';

ALTER TABLE public.manual_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manual_reminders_select" ON public.manual_reminders;
CREATE POLICY "manual_reminders_select" ON public.manual_reminders
  FOR SELECT TO authenticated
  USING (
    (creator_user_id = auth.uid() OR recipient_user_id = auth.uid())
    AND public.is_org_member(organization_id)
  );

DROP POLICY IF EXISTS "manual_reminders_insert" ON public.manual_reminders;
CREATE POLICY "manual_reminders_insert" ON public.manual_reminders
  FOR INSERT TO authenticated
  WITH CHECK (
    creator_user_id = auth.uid()
    AND public.is_org_member(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = manual_reminders.organization_id
        AND m.user_id = manual_reminders.recipient_user_id
        AND m.status = 'active'
    )
  );

DROP POLICY IF EXISTS "manual_reminders_update" ON public.manual_reminders;
CREATE POLICY "manual_reminders_update" ON public.manual_reminders
  FOR UPDATE TO authenticated
  USING (creator_user_id = auth.uid() AND public.is_org_member(organization_id))
  WITH CHECK (creator_user_id = auth.uid() AND public.is_org_member(organization_id));

DROP POLICY IF EXISTS "manual_reminders_delete" ON public.manual_reminders;
CREATE POLICY "manual_reminders_delete" ON public.manual_reminders
  FOR DELETE TO authenticated
  USING (creator_user_id = auth.uid() AND public.is_org_member(organization_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_reminders TO authenticated;

-- Trigger: When manual reminder is created, enqueue a notification_job
CREATE OR REPLACE FUNCTION public.enqueue_manual_reminder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.notification_jobs (
    organization_id,
    recipient_user_id,
    task_id,
    job_type,
    scheduled_for,
    status,
    metadata
  )
  VALUES (
    NEW.organization_id,
    NEW.recipient_user_id,
    NEW.task_id,
    'manual_reminder',
    NEW.scheduled_for,
    'pending',
    jsonb_build_object(
      'manual_reminder_id', NEW.id,
      'title', NEW.title,
      'creator_user_id', NEW.creator_user_id
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS manual_reminders_enqueue_job ON public.manual_reminders;
CREATE TRIGGER manual_reminders_enqueue_job
AFTER INSERT ON public.manual_reminders
FOR EACH ROW EXECUTE FUNCTION public.enqueue_manual_reminder();

-- =============================================================================
-- 6. DOMAIN EVENT TRIGGERS (Task Assignment, Comments, Due Reminders)
-- =============================================================================

-- 6.1. Task Assignment Trigger Enhancement (enqueue job + actor_user_id)
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid;
  v_notif_id uuid;
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.primary_assignee_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.primary_assignee_id IS NOT DISTINCT FROM OLD.primary_assignee_id THEN 
    RETURN NEW; 
  END IF;

  SELECT m.user_id INTO v_user
  FROM public.organization_members m
  WHERE m.organization_id = NEW.organization_id
    AND m.employee_id = NEW.primary_assignee_id
    AND m.status = 'active'
  LIMIT 1;

  -- Do not notify if assigned to self (unless explicitly triggered by system)
  IF v_user IS NOT NULL AND (v_actor IS NULL OR v_user IS DISTINCT FROM v_actor) THEN
    INSERT INTO public.notifications (
      organization_id, user_id, actor_user_id, kind, title, body, task_id, metadata
    )
    VALUES (
      NEW.organization_id,
      v_user,
      v_actor,
      'task_assigned',
      'Bạn được giao một công việc',
      NEW.title,
      NEW.id,
      jsonb_build_object('assignee_employee_id', NEW.primary_assignee_id)
    )
    RETURNING id INTO v_notif_id;

    -- Enqueue immediate push dispatch job
    INSERT INTO public.notification_jobs (
      organization_id, recipient_user_id, notification_id, task_id, job_type, scheduled_for, status
    )
    VALUES (
      NEW.organization_id, v_user, v_notif_id, NEW.id, 'push_dispatch', now(), 'pending'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 6.2. Task Comment Trigger
CREATE OR REPLACE FUNCTION public.notify_task_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_task record;
  v_recipient uuid;
  v_notif_id uuid;
  v_actor uuid := auth.uid();
BEGIN
  SELECT id, organization_id, title, primary_assignee_id INTO v_task
  FROM public.tasks
  WHERE id = NEW.task_id;

  IF NOT FOUND OR v_task.primary_assignee_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT m.user_id INTO v_recipient
  FROM public.organization_members m
  WHERE m.organization_id = v_task.organization_id
    AND m.employee_id = v_task.primary_assignee_id
    AND m.status = 'active'
  LIMIT 1;

  -- Do not notify comment author about their own comment
  IF v_recipient IS NOT NULL AND (v_actor IS NULL OR v_recipient IS DISTINCT FROM v_actor) THEN
    INSERT INTO public.notifications (
      organization_id, user_id, actor_user_id, kind, title, body, task_id, metadata
    )
    VALUES (
      v_task.organization_id,
      v_recipient,
      v_actor,
      'task_comment',
      'Bình luận mới trên công việc',
      v_task.title,
      v_task.id,
      jsonb_build_object('comment_id', NEW.id)
    )
    RETURNING id INTO v_notif_id;

    INSERT INTO public.notification_jobs (
      organization_id, recipient_user_id, notification_id, task_id, job_type, scheduled_for, status
    )
    VALUES (
      v_task.organization_id, v_recipient, v_notif_id, v_task.id, 'push_dispatch', now(), 'pending'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_comments_notify_trigger ON public.task_comments;
CREATE TRIGGER task_comments_notify_trigger
AFTER INSERT ON public.task_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_task_comment();

-- 6.3. Task Due Date Change & Cancellation Trigger
CREATE OR REPLACE FUNCTION public.handle_task_due_and_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_recipient uuid;
BEGIN
  -- If task completed or archived, cancel all future pending reminder jobs
  IF (NEW.status = 'Hoàn thành' OR NEW.archived_at IS NOT NULL) THEN
    UPDATE public.notification_jobs
    SET status = 'cancelled', updated_at = now()
    WHERE task_id = NEW.id
      AND status = 'pending'
      AND job_type IN ('due_soon_reminder', 'overdue_reminder');
    RETURN NEW;
  END IF;

  -- If due_date changed, cancel old reminders and schedule new due-soon reminder
  IF TG_OP = 'UPDATE' AND NEW.due_date IS DISTINCT FROM OLD.due_date THEN
    UPDATE public.notification_jobs
    SET status = 'cancelled', updated_at = now()
    WHERE task_id = NEW.id
      AND status = 'pending'
      AND job_type IN ('due_soon_reminder', 'overdue_reminder');

    IF NEW.due_date IS NOT NULL AND NEW.primary_assignee_id IS NOT NULL THEN
      SELECT m.user_id INTO v_recipient
      FROM public.organization_members m
      WHERE m.organization_id = NEW.organization_id
        AND m.employee_id = NEW.primary_assignee_id
        AND m.status = 'active'
      LIMIT 1;

      -- Schedule 24h prior reminder if due_date is in the future
      IF v_recipient IS NOT NULL AND (NEW.due_date::timestamptz - interval '24 hours') > now() THEN
        INSERT INTO public.notification_jobs (
          organization_id, recipient_user_id, task_id, job_type, scheduled_for, status, metadata
        )
        VALUES (
          NEW.organization_id,
          v_recipient,
          NEW.id,
          'due_soon_reminder',
          (NEW.due_date::timestamptz - interval '24 hours'),
          'pending',
          jsonb_build_object('due_date', NEW.due_date)
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_due_and_status_trigger ON public.tasks;
CREATE TRIGGER tasks_due_and_status_trigger
AFTER UPDATE OF due_date, status, archived_at ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.handle_task_due_and_status_change();

-- =============================================================================
-- 7. REALTIME MESSAGES AUTHORIZATION FOR USER NOTIFICATIONS
-- =============================================================================
DROP POLICY IF EXISTS "realtime_messages_select" ON realtime.messages;
CREATE POLICY "realtime_messages_select"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (
    topic LIKE 'org:%:workspace'
    AND public.is_org_member((split_part(topic, ':', 2))::uuid)
  )
  OR
  (
    topic LIKE 'task:%:%'
    AND public.can_read_task_id((split_part(topic, ':', 2))::uuid)
  )
  OR
  (
    topic LIKE 'user:%:notifications'
    AND (split_part(topic, ':', 2))::uuid = auth.uid()
  )
);

DROP POLICY IF EXISTS "realtime_messages_insert" ON realtime.messages;
CREATE POLICY "realtime_messages_insert"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (
    topic LIKE 'org:%:workspace'
    AND public.is_org_member((split_part(topic, ':', 2))::uuid)
  )
  OR
  (
    topic LIKE 'task:%:%'
    AND public.can_read_task_id((split_part(topic, ':', 2))::uuid)
  )
  OR
  (
    topic LIKE 'user:%:notifications'
    AND (split_part(topic, ':', 2))::uuid = auth.uid()
  )
);

GRANT SELECT, INSERT ON realtime.messages TO authenticated;
