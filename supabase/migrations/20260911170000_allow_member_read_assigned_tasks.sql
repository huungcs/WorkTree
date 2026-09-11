-- Migration: 20260911170000_allow_member_read_assigned_tasks.sql
-- Purpose: Allow assigned members to view, read, and collaborate on tasks explicitly
--          assigned to them by owners/managers, even if the task is housed in a project/node
--          outside their default department scope. This preserves full tenant isolation
--          while fixing notification navigation and task execution for employees.

-- 1. Update can_read_task_row to allow members to read tasks assigned to them
CREATE OR REPLACE FUNCTION public.can_read_task_row(
  p_organization_id uuid,
  p_node_id uuid,
  p_primary_assignee_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(
    CASE
      WHEN m.role IN ('owner','admin') THEN true
      -- If the member is explicitly the primary assignee, they can always read their assigned task
      WHEN m.role = 'member' AND m.employee_id IS NOT NULL AND m.employee_id = p_primary_assignee_id THEN true
      -- Otherwise, enforce department scope boundary
      WHEN NOT public.node_in_current_scope(p_organization_id, p_node_id) THEN false
      ELSE true
    END,
    false
  )
  FROM public.organization_members m
  JOIN public.organizations o ON o.id = m.organization_id
  WHERE m.organization_id = p_organization_id
    AND m.user_id = auth.uid()
    AND m.status = 'active'
    AND o.status = 'active'
  LIMIT 1
$$;

-- 2. Update can_collaborate_task_row so assigned members can update task progress/status
CREATE OR REPLACE FUNCTION public.can_collaborate_task_row(
  p_organization_id uuid,
  p_node_id uuid,
  p_primary_assignee_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(
    CASE
      WHEN m.role IN ('owner','admin') THEN true
      WHEN m.role = 'manager' THEN public.node_in_current_scope(p_organization_id, p_node_id)
      -- Assigned member can collaborate (update status, progress, checklist) on their own assigned task
      WHEN m.role = 'member' AND m.employee_id IS NOT NULL AND m.employee_id = p_primary_assignee_id THEN true
      ELSE false
    END,
    false
  )
  FROM public.organization_members m
  JOIN public.organizations o ON o.id = m.organization_id
  WHERE m.organization_id = p_organization_id
    AND m.user_id = auth.uid()
    AND m.status = 'active'
    AND o.status = 'active'
  LIMIT 1
$$;

-- 3. Update can_read_node so assigned members can read the name/breadcrumb of the node where their task resides
CREATE OR REPLACE FUNCTION public.can_read_node(p_organization_id uuid, p_node_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(
    CASE
      WHEN m.role IN ('owner','admin') THEN true
      -- Scoped nodes and their hierarchy
      WHEN EXISTS (
        SELECT 1
        FROM public.member_scopes s
        WHERE s.organization_id = p_organization_id
          AND s.membership_id = m.id
          AND (
            EXISTS (
              SELECT 1 FROM public.organization_node_closure c
              WHERE c.organization_id = p_organization_id
                AND c.ancestor_id = s.node_id
                AND c.descendant_id = p_node_id
            )
            OR EXISTS (
              SELECT 1 FROM public.organization_node_closure c
              WHERE c.organization_id = p_organization_id
                AND c.ancestor_id = p_node_id
                AND c.descendant_id = s.node_id
            )
          )
      ) THEN true
      -- Allow reading node if member has an active assigned task in this node
      WHEN m.role = 'member' AND m.employee_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.tasks tk
        WHERE tk.organization_id = p_organization_id
          AND tk.node_id = p_node_id
          AND tk.primary_assignee_id = m.employee_id
          AND tk.archived_at IS NULL
      ) THEN true
      ELSE false
    END,
    false
  )
  FROM public.organization_members m
  JOIN public.organizations o ON o.id = m.organization_id
  WHERE m.organization_id = p_organization_id
    AND m.user_id = auth.uid()
    AND m.status = 'active'
    AND o.status = 'active'
  LIMIT 1
$$;
