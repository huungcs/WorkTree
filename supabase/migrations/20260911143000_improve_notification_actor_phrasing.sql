-- Migration: 20260911143000_improve_notification_actor_phrasing.sql
-- Module: Notifications
-- Purpose: Personalize notification titles with the actor's full name (e.g. "Nguyễn Trọng Hữu đã chuyển sang Chờ duyệt")

-- 1. Function: notify_task_status_change
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
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'actor_name', v_actor_name)
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

-- 2. Function: notify_task_assignment
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid;
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_title text;
BEGIN
  IF NEW.primary_assignee_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.primary_assignee_id IS NOT DISTINCT FROM OLD.primary_assignee_id THEN RETURN NEW; END IF;

  -- 1. Identify actor display name
  IF v_actor IS NOT NULL THEN
    SELECT COALESCE(e.full_name, p.display_name, 'Một thành viên') INTO v_actor_name
    FROM public.profiles p
    LEFT JOIN public.organization_members m ON m.user_id = p.id AND m.organization_id = NEW.organization_id AND m.status = 'active'
    LEFT JOIN public.employees e ON e.id = m.employee_id
    WHERE p.id = v_actor
    LIMIT 1;
  END IF;

  IF v_actor_name IS NOT NULL AND v_actor_name <> '' THEN
    v_title := v_actor_name || ' đã giao việc cho bạn';
  ELSE
    v_title := 'Bạn được giao một công việc mới';
  END IF;

  SELECT m.user_id INTO v_user
  FROM public.organization_members m
  WHERE m.organization_id = NEW.organization_id
    AND m.employee_id = NEW.primary_assignee_id
    AND m.status = 'active'
  LIMIT 1;

  IF v_user IS NOT NULL AND (v_actor IS NULL OR v_user IS DISTINCT FROM v_actor) THEN
    INSERT INTO public.notifications (organization_id, user_id, actor_user_id, kind, title, body, task_id, metadata)
    VALUES (
      NEW.organization_id,
      v_user,
      v_actor,
      'task_assigned',
      v_title,
      NEW.title,
      NEW.id,
      jsonb_build_object('assignee_employee_id', NEW.primary_assignee_id, 'actor_name', v_actor_name)
    );
  END IF;

  RETURN NEW;
END;
$$;
