-- Migration: 20261119103000_add_task_share_links.sql
-- Purpose: Secure external task sharing links with scoped permissions (no delete),
-- optional PIN & expiry, organization-level kill-switch, and guest/internal comment tracking.

BEGIN;

-- 1. Organization-level external task sharing toggle (Admins can disable globally)
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS allow_external_task_share boolean NOT NULL DEFAULT true;

-- 2. Task external share links table (tenant-locked via composite FK to public.tasks)
CREATE TABLE IF NOT EXISTS public.task_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  task_id uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Link chia sẻ công việc'
    CHECK (char_length(btrim(label)) BETWEEN 1 AND 120),
  permission text NOT NULL DEFAULT 'view'
    CHECK (permission IN ('view', 'comment', 'edit_progress')),
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  token_encrypted text,
  pin_hash text,
  hide_internal_comments boolean NOT NULL DEFAULT true,
  allow_checklist_toggle boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'revoked')),
  expires_at timestamptz,
  view_count integer NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  last_accessed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_share_links_task_fk
    FOREIGN KEY (organization_id, task_id)
    REFERENCES public.tasks(organization_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS task_share_links_org_task_idx
  ON public.task_share_links (organization_id, task_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS task_share_links_active_hash_idx
  ON public.task_share_links (token_hash)
  WHERE status = 'active';

DROP TRIGGER IF EXISTS task_share_links_set_updated_at ON public.task_share_links;
CREATE TRIGGER task_share_links_set_updated_at
  BEFORE UPDATE ON public.task_share_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.guard_task_share_link_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.organization_id <> OLD.organization_id
     OR NEW.task_id <> OLD.task_id
     OR NEW.created_by <> OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Task share link tenant, task, creator, and creation timestamp are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_share_links_guard_update ON public.task_share_links;
CREATE TRIGGER task_share_links_guard_update
  BEFORE UPDATE ON public.task_share_links
  FOR EACH ROW EXECUTE FUNCTION public.guard_task_share_link_update();

-- 3. Guest & internal visibility support on task_comments
ALTER TABLE public.task_comments
  ALTER COLUMN author_user_id DROP NOT NULL;

ALTER TABLE public.task_comments
  ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guest_author_name text,
  ADD COLUMN IF NOT EXISTS share_link_id uuid REFERENCES public.task_share_links(id) ON DELETE SET NULL;

ALTER TABLE public.task_comments
  DROP CONSTRAINT IF EXISTS task_comments_author_or_guest_check;

ALTER TABLE public.task_comments
  ADD CONSTRAINT task_comments_author_or_guest_check
  CHECK (
    (author_user_id IS NOT NULL AND guest_author_name IS NULL)
    OR (
      author_user_id IS NULL
      AND char_length(btrim(coalesce(guest_author_name, ''))) BETWEEN 1 AND 80
      AND share_link_id IS NOT NULL
      AND is_internal = false
    )
  );

CREATE INDEX IF NOT EXISTS task_comments_visibility_idx
  ON public.task_comments (organization_id, task_id, is_internal, created_at);

CREATE OR REPLACE FUNCTION public.guard_comment_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND auth.uid() IS NOT NULL THEN
    NEW.author_user_id := auth.uid();
    NEW.guest_author_name := NULL;
    NEW.share_link_id := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.organization_id <> OLD.organization_id
       OR NEW.task_id <> OLD.task_id
       OR NEW.author_user_id IS DISTINCT FROM OLD.author_user_id
       OR NEW.guest_author_name IS DISTINCT FROM OLD.guest_author_name
       OR NEW.share_link_id IS DISTINCT FROM OLD.share_link_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Comment task/author/creation fields are immutable';
    END IF;
    IF NEW.body IS DISTINCT FROM OLD.body THEN
      NEW.edited_at := now();
    ELSE
      NEW.edited_at := OLD.edited_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_comment_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.activity_logs (organization_id, actor_user_id, action, task_id, summary, metadata)
  VALUES (
    NEW.organization_id,
    COALESCE(auth.uid(), NEW.author_user_id),
    'comment.created',
    NEW.task_id,
    CASE
      WHEN NEW.guest_author_name IS NOT NULL THEN 'Khách (' || btrim(NEW.guest_author_name) || ') thêm bình luận'
      ELSE 'Thêm bình luận'
    END,
    CASE
      WHEN NEW.guest_author_name IS NOT NULL THEN jsonb_build_object('guest_author_name', btrim(NEW.guest_author_name), 'share_link_id', NEW.share_link_id)
      ELSE '{}'::jsonb
    END
  );
  RETURN NEW;
END;
$$;

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
  v_actor uuid := COALESCE(NEW.author_user_id, auth.uid());
  v_title text;
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

  v_title := CASE
    WHEN NEW.guest_author_name IS NOT NULL THEN 'Khách ' || btrim(NEW.guest_author_name) || ' đã bình luận trên công việc'
    ELSE 'Bình luận mới trên công việc'
  END;

  IF v_recipient IS NOT NULL AND (v_actor IS NULL OR v_recipient IS DISTINCT FROM v_actor) THEN
    INSERT INTO public.notifications (
      organization_id, user_id, actor_user_id, kind, title, body, task_id, metadata
    )
    VALUES (
      v_task.organization_id,
      v_recipient,
      v_actor,
      'task_comment',
      v_title,
      v_task.title,
      v_task.id,
      jsonb_build_object('comment_id', NEW.id, 'is_guest', NEW.guest_author_name IS NOT NULL)
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

-- 4. Strict Row-Level Security on task_share_links (NO anon access at all)
ALTER TABLE public.task_share_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.task_share_links FROM PUBLIC, anon;

DROP POLICY IF EXISTS "task_share_links_select_scoped" ON public.task_share_links;
CREATE POLICY "task_share_links_select_scoped" ON public.task_share_links
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND public.can_read_task_id(task_id)
    AND (created_by = auth.uid() OR public.can_manage_task_id(task_id))
  );

DROP POLICY IF EXISTS "task_share_links_insert_collaborator" ON public.task_share_links;
CREATE POLICY "task_share_links_insert_collaborator" ON public.task_share_links
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id)
    AND created_by = auth.uid()
    AND public.can_collaborate_task_id(task_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.organization_settings s
      WHERE s.organization_id = task_share_links.organization_id
        AND s.allow_external_task_share = false
    )
  );

DROP POLICY IF EXISTS "task_share_links_update_owner_or_manager" ON public.task_share_links;
CREATE POLICY "task_share_links_update_owner_or_manager" ON public.task_share_links
  FOR UPDATE TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND (created_by = auth.uid() OR public.can_manage_task_id(task_id))
  )
  WITH CHECK (
    public.is_org_member(organization_id)
    AND (created_by = auth.uid() OR public.can_manage_task_id(task_id))
  );

DROP POLICY IF EXISTS "task_share_links_delete_owner_or_manager" ON public.task_share_links;
CREATE POLICY "task_share_links_delete_owner_or_manager" ON public.task_share_links
  FOR DELETE TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND (created_by = auth.uid() OR public.can_manage_task_id(task_id))
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_share_links TO authenticated;
GRANT ALL ON public.task_share_links TO service_role;

COMMIT;
