-- Migration: 20260911012000_process_due_manual_reminders.sql
-- Purpose: Safely process due manual reminders into in-app notifications
--          with atomic FOR UPDATE SKIP LOCKED concurrency control.

CREATE OR REPLACE FUNCTION public.process_due_manual_reminders(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count int := 0;
  v_reminders jsonb := '[]'::jsonb;
  v_row record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('processed', 0, 'reminders', '[]'::jsonb);
  END IF;

  FOR v_row IN
    SELECT *
    FROM public.manual_reminders
    WHERE organization_id = p_org_id
      AND recipient_user_id = v_user_id
      AND status = 'pending'
      AND scheduled_for <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Insert into public.notifications so it appears in the bell notification center
    INSERT INTO public.notifications (
      organization_id,
      user_id,
      actor_user_id,
      kind,
      title,
      body,
      task_id,
      metadata,
      created_at
    ) VALUES (
      v_row.organization_id,
      v_row.recipient_user_id,
      v_row.creator_user_id,
      'due_soon',
      'Nhắc việc: ' || v_row.title,
      'Đã đến giờ nhắc việc cá nhân bạn đã lên lịch: "' || v_row.title || '"',
      v_row.task_id,
      jsonb_build_object('manual_reminder_id', v_row.id, 'scheduled_for', v_row.scheduled_for),
      now()
    );

    -- Mark manual reminder as completed
    UPDATE public.manual_reminders
    SET status = 'completed'
    WHERE id = v_row.id;

    v_count := v_count + 1;
    v_reminders := v_reminders || jsonb_build_object(
      'id', v_row.id,
      'title', v_row.title,
      'scheduled_for', v_row.scheduled_for
    );
  END LOOP;

  RETURN jsonb_build_object(
    'processed', v_count,
    'reminders', v_reminders
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_due_manual_reminders(uuid) TO authenticated;
