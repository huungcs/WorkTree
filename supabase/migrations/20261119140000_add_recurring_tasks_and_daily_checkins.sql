-- Migration: 20261119140000_add_recurring_tasks_and_daily_checkins.sql
-- Purpose: Role/job-title/employee recurring task templates, idempotent execution
-- ledger, automatic daily generation (pg_cron + RPC), and 1-click daily check-ins.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) RECURRING TASK TEMPLATES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recurring_task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 240),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 10000),
  node_id uuid,
  assignment_mode text NOT NULL DEFAULT 'job_title'
    CHECK (assignment_mode IN ('job_title', 'org_role', 'employee')),
  target_job_title text
    CHECK (target_job_title IS NULL OR char_length(btrim(target_job_title)) BETWEEN 1 AND 120),
  target_org_role public.org_role,
  target_employee_id uuid,
  priority public.task_priority NOT NULL DEFAULT 'medium',
  estimate_minutes integer NOT NULL DEFAULT 30 CHECK (estimate_minutes >= 0 AND estimate_minutes <= 60000),
  tags text[] NOT NULL DEFAULT '{}' CHECK (cardinality(tags) <= 20),
  checklist_items jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(checklist_items) = 'array' AND jsonb_array_length(checklist_items) <= 30),
  cadence text NOT NULL DEFAULT 'daily'
    CHECK (cadence IN ('daily', 'weekdays', 'weekly', 'monthly')),
  days_of_week smallint[] NOT NULL DEFAULT '{1,2,3,4,5}'
    CHECK (cardinality(days_of_week) <= 7),
  day_of_month smallint
    CHECK (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 31),
  due_offset_days smallint NOT NULL DEFAULT 0 CHECK (due_offset_days BETWEEN 0 AND 30),
  timezone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh'
    CHECK (char_length(btrim(timezone)) BETWEEN 1 AND 64),
  is_active boolean NOT NULL DEFAULT true,
  last_generated_date date,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  CONSTRAINT recurring_templates_target_check CHECK (
    (assignment_mode = 'job_title' AND target_job_title IS NOT NULL)
    OR (assignment_mode = 'org_role' AND target_org_role IS NOT NULL)
    OR (assignment_mode = 'employee' AND target_employee_id IS NOT NULL)
  ),
  CONSTRAINT recurring_templates_node_fk
    FOREIGN KEY (organization_id, node_id)
    REFERENCES public.organization_nodes(organization_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT recurring_templates_emp_fk
    FOREIGN KEY (organization_id, target_employee_id)
    REFERENCES public.employees(organization_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS recurring_templates_org_active_idx
  ON public.recurring_task_templates (organization_id, is_active, created_at DESC);

DROP TRIGGER IF EXISTS recurring_task_templates_set_updated_at ON public.recurring_task_templates;
CREATE TRIGGER recurring_task_templates_set_updated_at
  BEFORE UPDATE ON public.recurring_task_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.guard_recurring_template_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role public.org_role;
  v_exists boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.organization_id <> OLD.organization_id THEN
      RAISE EXCEPTION 'Cannot move recurring template across organizations';
    END IF;
    IF NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Template creator and creation timestamp are immutable';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND v_actor IS NOT NULL THEN
    NEW.created_by := v_actor;
  END IF;

  NEW.title := btrim(COALESCE(NEW.title, ''));
  IF NEW.target_job_title IS NOT NULL THEN
    NEW.target_job_title := NULLIF(btrim(NEW.target_job_title), '');
  END IF;
  NEW.timezone := COALESCE(NULLIF(btrim(NEW.timezone), ''), 'Asia/Ho_Chi_Minh');

  IF NEW.assignment_mode = 'job_title' THEN
    NEW.target_org_role := NULL;
    NEW.target_employee_id := NULL;
  ELSIF NEW.assignment_mode = 'org_role' THEN
    NEW.target_job_title := NULL;
    NEW.target_employee_id := NULL;
  ELSIF NEW.assignment_mode = 'employee' THEN
    NEW.target_job_title := NULL;
    NEW.target_org_role := NULL;
  END IF;

  IF NEW.node_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.organization_nodes n
      WHERE n.organization_id = NEW.organization_id
        AND n.id = NEW.node_id
        AND n.archived_at IS NULL
    ) INTO v_exists;
    IF NOT v_exists THEN
      RAISE EXCEPTION 'Target organization unit does not exist or is archived';
    END IF;
  END IF;

  IF NEW.target_employee_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.organization_id = NEW.organization_id
        AND e.id = NEW.target_employee_id
        AND e.employment_status = 'active'
    ) INTO v_exists;
    IF NOT v_exists THEN
      RAISE EXCEPTION 'Target employee does not exist or is inactive';
    END IF;
  END IF;

  IF v_actor IS NOT NULL THEN
    v_role := public.current_org_role(NEW.organization_id);
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'No active membership in organization';
    END IF;
    IF v_role = 'manager' THEN
      IF NEW.node_id IS NULL OR NOT public.can_manage_task_row(NEW.organization_id, NEW.node_id) THEN
        RAISE EXCEPTION 'Manager must select a unit within granted scope';
      END IF;
      IF NEW.target_employee_id IS NOT NULL
         AND NOT public.employee_in_current_scope(NEW.organization_id, NEW.target_employee_id) THEN
        RAISE EXCEPTION 'Manager cannot target an employee outside granted scope';
      END IF;
    ELSIF v_role NOT IN ('owner', 'admin') THEN
      RAISE EXCEPTION 'Insufficient role to manage recurring task templates';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recurring_task_templates_guard_write ON public.recurring_task_templates;
CREATE TRIGGER recurring_task_templates_guard_write
  BEFORE INSERT OR UPDATE OF
    organization_id, title, description, node_id, assignment_mode,
    target_job_title, target_org_role, target_employee_id, priority,
    estimate_minutes, tags, checklist_items, cadence, days_of_week,
    day_of_month, due_offset_days, timezone, is_active, created_by, created_at
  ON public.recurring_task_templates
  FOR EACH ROW EXECUTE FUNCTION public.guard_recurring_template_write();

-- -----------------------------------------------------------------------------
-- 2) RECURRING TASK RUNS (IDEMPOTENCY LEDGER)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recurring_task_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id uuid NOT NULL,
  run_date date NOT NULL,
  employee_id uuid,
  assignee_key text NOT NULL CHECK (char_length(btrim(assignee_key)) BETWEEN 1 AND 80),
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, run_date, assignee_key),
  CONSTRAINT recurring_runs_template_fk
    FOREIGN KEY (organization_id, template_id)
    REFERENCES public.recurring_task_templates(organization_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS recurring_runs_org_date_idx
  ON public.recurring_task_runs (organization_id, run_date DESC, created_at DESC);

-- -----------------------------------------------------------------------------
-- 3) DAILY CHECK-INS (1-CLICK DAILY REPORT)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id uuid,
  checkin_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date),
  mood text NOT NULL DEFAULT 'green' CHECK (mood IN ('green', 'amber', 'red')),
  completed_task_ids uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality(completed_task_ids) <= 100),
  in_progress_task_ids uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality(in_progress_task_ids) <= 100),
  minutes_logged integer NOT NULL DEFAULT 0 CHECK (minutes_logged >= 0 AND minutes_logged <= 1440),
  summary text NOT NULL DEFAULT '' CHECK (char_length(summary) <= 4000),
  blockers text NOT NULL DEFAULT '' CHECK (char_length(blockers) <= 2000),
  tomorrow_plan text NOT NULL DEFAULT '' CHECK (char_length(tomorrow_plan) <= 2000),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS daily_checkins_org_date_idx
  ON public.daily_checkins (organization_id, checkin_date DESC, submitted_at DESC);

DROP TRIGGER IF EXISTS daily_checkins_set_updated_at ON public.daily_checkins;
CREATE TRIGGER daily_checkins_set_updated_at
  BEFORE UPDATE ON public.daily_checkins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.guard_daily_checkin_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_emp_id uuid;
  v_emp_ok boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.organization_id <> OLD.organization_id
       OR NEW.user_id <> OLD.user_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Check-in organization, user, and creation timestamp are immutable';
    END IF;
  END IF;

  IF v_actor IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      NEW.user_id := v_actor;
    END IF;
    IF NOT public.is_org_member(NEW.organization_id) THEN
      RAISE EXCEPTION 'No active membership in organization';
    END IF;
    IF public.current_org_role(NEW.organization_id) = 'viewer' THEN
      RAISE EXCEPTION 'Viewer role cannot submit daily check-ins';
    END IF;
  END IF;

  IF NEW.employee_id IS NULL THEN
    SELECT om.employee_id
    INTO v_emp_id
    FROM public.organization_members om
    WHERE om.organization_id = NEW.organization_id
      AND om.user_id = NEW.user_id
      AND om.status = 'active'
    LIMIT 1;
    NEW.employee_id := v_emp_id;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.organization_id = NEW.organization_id
        AND e.id = NEW.employee_id
    ) INTO v_emp_ok;
    IF NOT v_emp_ok THEN
      RAISE EXCEPTION 'Check-in employee does not belong to organization';
    END IF;
  END IF;

  NEW.summary := COALESCE(NEW.summary, '');
  NEW.blockers := COALESCE(NEW.blockers, '');
  NEW.tomorrow_plan := COALESCE(NEW.tomorrow_plan, '');
  IF NEW.submitted_at IS NULL THEN
    NEW.submitted_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS daily_checkins_guard_write ON public.daily_checkins;
CREATE TRIGGER daily_checkins_guard_write
  BEFORE INSERT OR UPDATE ON public.daily_checkins
  FOR EACH ROW EXECUTE FUNCTION public.guard_daily_checkin_write();

-- -----------------------------------------------------------------------------
-- 4) RLS POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.recurring_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_task_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recurring_templates_select ON public.recurring_task_templates;
CREATE POLICY recurring_templates_select
  ON public.recurring_task_templates FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS recurring_templates_insert ON public.recurring_task_templates;
CREATE POLICY recurring_templates_insert
  ON public.recurring_task_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_org_role(organization_id) IN ('owner', 'admin')
    OR (
      public.current_org_role(organization_id) = 'manager'
      AND node_id IS NOT NULL
      AND public.can_manage_task_row(organization_id, node_id)
      AND (target_employee_id IS NULL OR public.employee_in_current_scope(organization_id, target_employee_id))
    )
  );

DROP POLICY IF EXISTS recurring_templates_update ON public.recurring_task_templates;
CREATE POLICY recurring_templates_update
  ON public.recurring_task_templates FOR UPDATE
  TO authenticated
  USING (
    public.current_org_role(organization_id) IN ('owner', 'admin')
    OR (
      public.current_org_role(organization_id) = 'manager'
      AND node_id IS NOT NULL
      AND public.can_manage_task_row(organization_id, node_id)
      AND (target_employee_id IS NULL OR public.employee_in_current_scope(organization_id, target_employee_id))
    )
  )
  WITH CHECK (
    public.current_org_role(organization_id) IN ('owner', 'admin')
    OR (
      public.current_org_role(organization_id) = 'manager'
      AND node_id IS NOT NULL
      AND public.can_manage_task_row(organization_id, node_id)
      AND (target_employee_id IS NULL OR public.employee_in_current_scope(organization_id, target_employee_id))
    )
  );

DROP POLICY IF EXISTS recurring_templates_delete ON public.recurring_task_templates;
CREATE POLICY recurring_templates_delete
  ON public.recurring_task_templates FOR DELETE
  TO authenticated
  USING (
    public.current_org_role(organization_id) IN ('owner', 'admin')
    OR (
      public.current_org_role(organization_id) = 'manager'
      AND node_id IS NOT NULL
      AND public.can_manage_task_row(organization_id, node_id)
    )
  );

DROP POLICY IF EXISTS recurring_runs_select ON public.recurring_task_runs;
CREATE POLICY recurring_runs_select
  ON public.recurring_task_runs FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS daily_checkins_select ON public.daily_checkins;
CREATE POLICY daily_checkins_select
  ON public.daily_checkins FOR SELECT
  TO authenticated
  USING (
    (user_id = auth.uid() AND public.is_org_member(organization_id))
    OR public.is_org_admin(organization_id)
    OR (
      public.current_org_role(organization_id) = 'manager'
      AND employee_id IS NOT NULL
      AND public.employee_in_current_scope(organization_id, employee_id)
    )
  );

DROP POLICY IF EXISTS daily_checkins_insert ON public.daily_checkins;
CREATE POLICY daily_checkins_insert
  ON public.daily_checkins FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_org_member(organization_id)
    AND public.current_org_role(organization_id) <> 'viewer'
  );

DROP POLICY IF EXISTS daily_checkins_update ON public.daily_checkins;
CREATE POLICY daily_checkins_update
  ON public.daily_checkins FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND public.is_org_member(organization_id)
    AND public.current_org_role(organization_id) <> 'viewer'
  )
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_org_member(organization_id)
    AND public.current_org_role(organization_id) <> 'viewer'
  );

DROP POLICY IF EXISTS daily_checkins_delete ON public.daily_checkins;
CREATE POLICY daily_checkins_delete
  ON public.daily_checkins FOR DELETE
  TO authenticated
  USING (
    (user_id = auth.uid() AND public.is_org_member(organization_id))
    OR public.is_org_admin(organization_id)
  );

-- -----------------------------------------------------------------------------
-- 5) SCHEDULE MATCHING & TASK GENERATOR RPCS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_recurring_template_due(
  p_cadence text,
  p_days_of_week smallint[],
  p_day_of_month smallint,
  p_local_date date
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_isodow smallint;
  v_dom smallint;
  v_last_dom smallint;
BEGIN
  IF p_local_date IS NULL THEN
    RETURN false;
  END IF;

  v_isodow := EXTRACT(ISODOW FROM p_local_date)::smallint;
  v_dom := EXTRACT(DAY FROM p_local_date)::smallint;
  v_last_dom := EXTRACT(
    DAY FROM (date_trunc('month', p_local_date)::date + INTERVAL '1 month - 1 day')::date
  )::smallint;

  CASE COALESCE(p_cadence, 'daily')
    WHEN 'daily' THEN
      RETURN true;
    WHEN 'weekdays' THEN
      RETURN v_isodow BETWEEN 1 AND 5;
    WHEN 'weekly' THEN
      RETURN v_isodow = ANY(COALESCE(p_days_of_week, ARRAY[1]::smallint[]));
    WHEN 'monthly' THEN
      RETURN v_dom = LEAST(COALESCE(p_day_of_month, 1), v_last_dom);
    ELSE
      RETURN false;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_recurring_tasks_for_org(
  p_organization_id uuid,
  p_target_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role public.org_role;
  v_root_node_id uuid;
  v_fallback_creator uuid;
  v_tpl record;
  v_target record;
  v_local_date date;
  v_resolved_node_id uuid;
  v_task_tags text[];
  v_new_task_id uuid;
  v_created int := 0;
  v_skipped int := 0;
  v_task_ids uuid[] := '{}';
  v_item_text text;
  v_item_idx int;
  v_lock_key integer;
BEGIN
  IF p_organization_id IS NULL THEN
    RETURN jsonb_build_object('created', 0, 'skipped', 0, 'task_ids', '[]'::jsonb);
  END IF;

  IF v_uid IS NOT NULL THEN
    v_role := public.current_org_role(p_organization_id);
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'No active membership in organization';
    END IF;
    IF v_role NOT IN ('owner', 'admin', 'manager') THEN
      RETURN jsonb_build_object(
        'created', 0,
        'skipped', 0,
        'task_ids', '[]'::jsonb,
        'reason', 'delegated_to_cron'
      );
    END IF;
  END IF;

  SELECT id
  INTO v_root_node_id
  FROM public.organization_nodes
  WHERE organization_id = p_organization_id
    AND archived_at IS NULL
  ORDER BY (parent_id IS NOT NULL) ASC, created_at ASC
  LIMIT 1;

  IF v_root_node_id IS NULL THEN
    RETURN jsonb_build_object(
      'created', 0,
      'skipped', 0,
      'task_ids', '[]'::jsonb,
      'reason', 'no_active_nodes'
    );
  END IF;

  SELECT om.user_id
  INTO v_fallback_creator
  FROM public.organization_members om
  WHERE om.organization_id = p_organization_id
    AND om.status = 'active'
  ORDER BY (CASE om.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END), om.created_at ASC
  LIMIT 1;

  FOR v_tpl IN
    SELECT *
    FROM public.recurring_task_templates t
    WHERE t.organization_id = p_organization_id
      AND t.is_active = true
    ORDER BY t.created_at ASC
  LOOP
    v_local_date := COALESCE(
      p_target_date,
      (now() AT TIME ZONE COALESCE(NULLIF(v_tpl.timezone, ''), 'Asia/Ho_Chi_Minh'))::date
    );

    IF NOT public.is_recurring_template_due(
      v_tpl.cadence,
      v_tpl.days_of_week,
      v_tpl.day_of_month,
      v_local_date
    ) THEN
      CONTINUE;
    END IF;

    FOR v_target IN
      SELECT
        e.id AS employee_id,
        e.home_node_id AS home_node_id,
        ('emp_' || e.id::text) AS assignee_key
      FROM public.employees e
      WHERE v_tpl.assignment_mode = 'employee'
        AND e.organization_id = p_organization_id
        AND e.id = v_tpl.target_employee_id
        AND e.employment_status = 'active'

      UNION ALL

      SELECT
        e.id AS employee_id,
        e.home_node_id AS home_node_id,
        ('emp_' || e.id::text) AS assignee_key
      FROM public.employees e
      WHERE v_tpl.assignment_mode = 'job_title'
        AND e.organization_id = p_organization_id
        AND e.employment_status = 'active'
        AND lower(btrim(COALESCE(e.job_title, ''))) = lower(btrim(COALESCE(v_tpl.target_job_title, '')))

      UNION ALL

      SELECT
        e.id AS employee_id,
        e.home_node_id AS home_node_id,
        COALESCE('emp_' || e.id::text, 'usr_' || om.user_id::text) AS assignee_key
      FROM public.organization_members om
      LEFT JOIN public.employees e
        ON e.organization_id = om.organization_id
       AND e.id = om.employee_id
       AND e.employment_status = 'active'
      WHERE v_tpl.assignment_mode = 'org_role'
        AND om.organization_id = p_organization_id
        AND om.status = 'active'
        AND om.role = v_tpl.target_org_role
        AND (om.employee_id IS NULL OR e.id IS NOT NULL)
    LOOP
      v_resolved_node_id := COALESCE(v_tpl.node_id, v_target.home_node_id, v_root_node_id);

      IF v_resolved_node_id IS NULL THEN
        CONTINUE;
      END IF;

      -- Ensure non-archived node resolution fallback
      IF NOT EXISTS (
        SELECT 1 FROM public.organization_nodes n
        WHERE n.organization_id = p_organization_id
          AND n.id = v_resolved_node_id
          AND n.archived_at IS NULL
      ) THEN
        v_resolved_node_id := v_root_node_id;
      END IF;

      IF v_uid IS NOT NULL AND v_role = 'manager' THEN
        IF NOT public.can_manage_task_row(p_organization_id, v_resolved_node_id) THEN
          CONTINUE;
        END IF;
        IF v_target.employee_id IS NOT NULL
           AND NOT public.employee_in_current_scope(p_organization_id, v_target.employee_id) THEN
          CONTINUE;
        END IF;
      END IF;

      v_lock_key := hashtext(v_tpl.id::text || ':' || v_local_date::text || ':' || v_target.assignee_key);
      PERFORM pg_advisory_xact_lock(v_lock_key);

      IF EXISTS (
        SELECT 1 FROM public.recurring_task_runs r
        WHERE r.template_id = v_tpl.id
          AND r.run_date = v_local_date
          AND r.assignee_key = v_target.assignee_key
      ) THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      SELECT COALESCE(array_agg(tag_val), '{}'::text[])
      INTO v_task_tags
      FROM (
        SELECT DISTINCT NULLIF(btrim(tag_raw), '') AS tag_val
        FROM unnest(COALESCE(v_tpl.tags, '{}'::text[]) || ARRAY['recurring']) AS tag_raw
        WHERE NULLIF(btrim(tag_raw), '') IS NOT NULL
        LIMIT 20
      ) s;

      INSERT INTO public.tasks (
        organization_id,
        node_id,
        primary_assignee_id,
        title,
        description,
        status,
        priority,
        start_date,
        due_date,
        estimate_minutes,
        progress,
        auto_progress,
        tags,
        created_by
      ) VALUES (
        p_organization_id,
        v_resolved_node_id,
        v_target.employee_id,
        v_tpl.title,
        v_tpl.description,
        'todo',
        v_tpl.priority,
        v_local_date,
        v_local_date + v_tpl.due_offset_days,
        v_tpl.estimate_minutes,
        0,
        false,
        v_task_tags,
        COALESCE(v_uid, v_tpl.created_by, v_fallback_creator)
      )
      RETURNING id INTO v_new_task_id;

      IF jsonb_array_length(v_tpl.checklist_items) > 0 THEN
        v_item_idx := 0;
        FOR v_item_text IN
          SELECT NULLIF(btrim(elem), '')
          FROM jsonb_array_elements_text(v_tpl.checklist_items) AS elem
        LOOP
          IF v_item_text IS NOT NULL THEN
            INSERT INTO public.task_checklist_items (
              organization_id,
              task_id,
              content,
              is_done,
              sort_order,
              created_by
            ) VALUES (
              p_organization_id,
              v_new_task_id,
              left(v_item_text, 400),
              false,
              v_item_idx,
              COALESCE(v_uid, v_tpl.created_by, v_fallback_creator)
            );
            v_item_idx := v_item_idx + 1;
          END IF;
        END LOOP;
      END IF;

      INSERT INTO public.recurring_task_runs (
        organization_id,
        template_id,
        run_date,
        employee_id,
        assignee_key,
        task_id
      ) VALUES (
        p_organization_id,
        v_tpl.id,
        v_local_date,
        v_target.employee_id,
        v_target.assignee_key,
        v_new_task_id
      )
      ON CONFLICT (template_id, run_date, assignee_key) DO NOTHING;

      UPDATE public.recurring_task_templates
      SET last_generated_date = v_local_date
      WHERE id = v_tpl.id
        AND (last_generated_date IS NULL OR last_generated_date < v_local_date);

      v_created := v_created + 1;
      v_task_ids := array_append(v_task_ids, v_new_task_id);
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'created', v_created,
    'skipped', v_skipped,
    'task_ids', to_jsonb(v_task_ids),
    'run_date', COALESCE(p_target_date, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_recurring_template_due(text, smallint[], smallint, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.generate_recurring_tasks_for_org(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_recurring_template_due(text, smallint[], smallint, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_recurring_tasks_for_org(uuid, date) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6) GLOBAL CRON HELPER & SCHEDULE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_all_due_recurring_tasks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_org_res jsonb;
  v_total_created int := 0;
  v_orgs_processed int := 0;
BEGIN
  FOR v_org_id IN
    SELECT DISTINCT organization_id
    FROM public.recurring_task_templates
    WHERE is_active = true
  LOOP
    v_org_res := public.generate_recurring_tasks_for_org(v_org_id, NULL);
    v_total_created := v_total_created + COALESCE((v_org_res ->> 'created')::int, 0);
    v_orgs_processed := v_orgs_processed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'orgs_processed', v_orgs_processed,
    'total_created', v_total_created,
    'executed_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_all_due_recurring_tasks() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_all_due_recurring_tasks() FROM anon;
REVOKE ALL ON FUNCTION public.generate_all_due_recurring_tasks() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.generate_all_due_recurring_tasks() TO service_role;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT jobid
    INTO v_job_id
    FROM cron.job
    WHERE jobname = 'worktree-generate-daily-recurring-tasks'
    LIMIT 1;

    IF v_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_job_id);
    END IF;

    PERFORM cron.schedule(
      'worktree-generate-daily-recurring-tasks',
      '5 * * * *',
      'SELECT public.generate_all_due_recurring_tasks();'
    );
  END IF;
END;
$$;

COMMIT;
