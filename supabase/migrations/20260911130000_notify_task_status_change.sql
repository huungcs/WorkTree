-- Migration: 20260911130000_notify_task_status_change.sql
-- Module: Notifications
-- Purpose: Automatically notify task assignee and creator when a task status changes

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

  -- Human-friendly status labels in Vietnamese
  CASE NEW.status
    WHEN 'todo' THEN v_status_name := 'Chưa bắt đầu';
    WHEN 'in_progress' THEN v_status_name := 'Đang thực hiện';
    WHEN 'review' THEN v_status_name := 'Chờ duyệt';
    WHEN 'done' THEN v_status_name := 'Hoàn thành';
    WHEN 'cancelled' THEN v_status_name := 'Đã hủy';
    ELSE v_status_name := NEW.status::text;
  END CASE;

  -- Title & Kind customization
  IF NEW.status = 'done' THEN
    v_kind := 'task_completed';
    v_title := 'Công việc đã hoàn thành';
  ELSIF NEW.status = 'review' THEN
    v_kind := 'task_status_changed';
    v_title := 'Công việc chuyển sang chờ duyệt';
  ELSIF NEW.status = 'in_progress' THEN
    v_kind := 'task_status_changed';
    v_title := 'Công việc đang thực hiện';
  ELSE
    v_kind := 'task_status_changed';
    v_title := 'Cập nhật trạng thái: ' || v_status_name;
  END IF;

  v_body := NEW.title;

  -- 1. Identify primary assignee's auth.user
  IF NEW.primary_assignee_id IS NOT NULL THEN
    SELECT m.user_id INTO v_assignee_user
    FROM public.organization_members m
    WHERE m.organization_id = NEW.organization_id
      AND m.employee_id = NEW.primary_assignee_id
      AND m.status = 'active'
    LIMIT 1;
  END IF;

  -- 2. Identify task creator's auth.user
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
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    )
    RETURNING id INTO v_notif_id;

    INSERT INTO public.notification_jobs (
      organization_id, recipient_user_id, notification_id, task_id, job_type, scheduled_for, status
    )
    VALUES (
      NEW.organization_id, v_assignee_user, v_notif_id, NEW.id, 'push_dispatch', now(), 'pending'
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
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    )
    RETURNING id INTO v_notif_id;

    INSERT INTO public.notification_jobs (
      organization_id, recipient_user_id, notification_id, task_id, job_type, scheduled_for, status
    )
    VALUES (
      NEW.organization_id, v_creator_user, v_notif_id, NEW.id, 'push_dispatch', now(), 'pending'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_status_notify_trigger ON public.tasks;
CREATE TRIGGER tasks_status_notify_trigger
AFTER UPDATE OF status ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_status_change();
