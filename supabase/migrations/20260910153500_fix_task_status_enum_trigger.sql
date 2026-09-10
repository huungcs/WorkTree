-- Migration: 20260910153500_fix_task_status_enum_trigger.sql
-- Fix: Cast NEW.status to text or compare against valid 'done' enum value in handle_task_due_and_status_change()
-- Prevents "invalid input value for enum public.task_status: 'Hoàn thành'" error during task updates.

CREATE OR REPLACE FUNCTION public.handle_task_due_and_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_recipient uuid;
BEGIN
  -- If task completed ('done') or archived, cancel all future pending reminder jobs
  IF (NEW.status = 'done' OR NEW.archived_at IS NOT NULL) THEN
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
