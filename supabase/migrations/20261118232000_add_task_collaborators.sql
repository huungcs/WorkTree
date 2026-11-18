-- Migration: 20261118232000_add_task_collaborators.sql
-- Purpose: Add multi-person collaborator_ids ("Người liên quan") support to tasks,
--          update member visibility/collaboration helpers & RLS policies,
--          enforce tenant-safe collaborator validation in guard_task_write(),
--          and expose collaborator_ids via task_rollups view.

-- 1. Add collaborator_ids column + GIN index + bounded array length
alter table public.tasks
  add column if not exists collaborator_ids uuid[] not null default '{}';

alter table public.tasks
  drop constraint if exists tasks_collaborators_len;

alter table public.tasks
  add constraint tasks_collaborators_len check (cardinality(collaborator_ids) <= 30);

create index if not exists tasks_collaborators_gin_idx
  on public.tasks using gin (collaborator_ids);

-- 2. Update task access helpers (4-argument overloads + 3-argument compatibility wrappers)
create or replace function public.can_read_task_row(
  p_organization_id uuid,
  p_node_id uuid,
  p_primary_assignee_id uuid,
  p_collaborator_ids uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case
      when m.role in ('owner', 'admin') then true
      when m.role = 'member'
        and m.employee_id is not null
        and (
          m.employee_id = p_primary_assignee_id
          or m.employee_id = any(coalesce(p_collaborator_ids, '{}'))
        ) then true
      when not public.node_in_current_scope(p_organization_id, p_node_id) then false
      else true
    end,
    false
  )
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.organization_id = p_organization_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and o.status = 'active'
  limit 1
$$;

create or replace function public.can_read_task_row(
  p_organization_id uuid,
  p_node_id uuid,
  p_primary_assignee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_read_task_row(p_organization_id, p_node_id, p_primary_assignee_id, '{}'::uuid[])
$$;

create or replace function public.can_collaborate_task_row(
  p_organization_id uuid,
  p_node_id uuid,
  p_primary_assignee_id uuid,
  p_collaborator_ids uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case
      when m.role in ('owner', 'admin') then true
      when m.role = 'manager' then public.node_in_current_scope(p_organization_id, p_node_id)
      when m.role = 'member'
        and m.employee_id is not null
        and (
          m.employee_id = p_primary_assignee_id
          or m.employee_id = any(coalesce(p_collaborator_ids, '{}'))
        ) then true
      else false
    end,
    false
  )
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.organization_id = p_organization_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and o.status = 'active'
  limit 1
$$;

create or replace function public.can_collaborate_task_row(
  p_organization_id uuid,
  p_node_id uuid,
  p_primary_assignee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_collaborate_task_row(p_organization_id, p_node_id, p_primary_assignee_id, '{}'::uuid[])
$$;

create or replace function public.can_read_task_id(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.can_read_task_row(t.organization_id, t.node_id, t.primary_assignee_id, t.collaborator_ids),
    false
  )
  from public.tasks t
  where t.id = p_task_id
  limit 1
$$;

create or replace function public.can_collaborate_task_id(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.can_collaborate_task_row(t.organization_id, t.node_id, t.primary_assignee_id, t.collaborator_ids),
    false
  )
  from public.tasks t
  where t.id = p_task_id
  limit 1
$$;

create or replace function public.can_read_node(p_organization_id uuid, p_node_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case
      when m.role in ('owner','admin') then true
      when exists (
        select 1
        from public.member_scopes s
        where s.organization_id = p_organization_id
          and s.membership_id = m.id
          and (
            exists (
              select 1 from public.organization_node_closure c
              where c.organization_id = p_organization_id
                and c.ancestor_id = s.node_id
                and c.descendant_id = p_node_id
            )
            or exists (
              select 1 from public.organization_node_closure c
              where c.organization_id = p_organization_id
                and c.ancestor_id = p_node_id
                and c.descendant_id = s.node_id
            )
          )
      ) then true
      when m.role = 'member' and m.employee_id is not null and exists (
        select 1 from public.tasks tk
        where tk.organization_id = p_organization_id
          and tk.node_id = p_node_id
          and (
            tk.primary_assignee_id = m.employee_id
            or m.employee_id = any(coalesce(tk.collaborator_ids, '{}'))
          )
          and tk.archived_at is null
      ) then true
      else false
    end,
    false
  )
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.organization_id = p_organization_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and o.status = 'active'
  limit 1
$$;

revoke all on function public.can_read_task_row(uuid,uuid,uuid,uuid[]) from public;
revoke all on function public.can_collaborate_task_row(uuid,uuid,uuid,uuid[]) from public;
grant execute on function public.can_read_task_row(uuid,uuid,uuid,uuid[]) to authenticated;
grant execute on function public.can_collaborate_task_row(uuid,uuid,uuid,uuid[]) to authenticated;

-- 3. Update RLS policies on public.tasks to include collaborator_ids
drop policy if exists tasks_select_visible on public.tasks;
create policy tasks_select_visible on public.tasks
for select to authenticated
using (public.can_read_task_row(organization_id, node_id, primary_assignee_id, collaborator_ids));

drop policy if exists tasks_update_collaborator on public.tasks;
create policy tasks_update_collaborator on public.tasks
for update to authenticated
using (public.can_collaborate_task_row(organization_id, node_id, primary_assignee_id, collaborator_ids))
with check (public.can_collaborate_task_row(organization_id, node_id, primary_assignee_id, collaborator_ids));

-- 4. Update guard_task_write() trigger: validate collaborator_ids belong to same tenant & prevent member mutation
create or replace function public.guard_task_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.org_role;
  v_actor uuid := auth.uid();
  v_assignee_home uuid;
  v_collab_id uuid;
  v_clean_collabs uuid[] := '{}';
begin
  if tg_op = 'UPDATE' and new.organization_id <> old.organization_id then
    raise exception 'Cannot move a task to another organization';
  end if;

  if tg_op = 'UPDATE' and (new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at) then
    raise exception 'Task creator and creation time are immutable';
  end if;

  if tg_op = 'INSERT' and v_actor is not null then
    new.created_by := v_actor;
  end if;

  if new.start_date is not null and new.due_date is not null and new.start_date > new.due_date then
    raise exception 'Task start date cannot be after due date';
  end if;

  if new.primary_assignee_id is not null then
    select home_node_id into v_assignee_home
    from public.employees
    where organization_id = new.organization_id
      and id = new.primary_assignee_id
      and employment_status = 'active';
    if not found then
      raise exception 'Assignee does not exist or is inactive';
    end if;
  end if;

  new.collaborator_ids := coalesce(new.collaborator_ids, '{}');
  if cardinality(new.collaborator_ids) > 0 then
    foreach v_collab_id in array new.collaborator_ids loop
      if v_collab_id is not null
         and v_collab_id is distinct from new.primary_assignee_id
         and not (v_collab_id = any(v_clean_collabs)) then
        perform 1
        from public.employees
        where organization_id = new.organization_id
          and id = v_collab_id
          and employment_status = 'active';
        if not found then
          raise exception 'Collaborator does not exist or is inactive in this organization';
        end if;
        v_clean_collabs := array_append(v_clean_collabs, v_collab_id);
      end if;
    end loop;
    new.collaborator_ids := v_clean_collabs;
  end if;

  -- Trusted SQL/server operations may not carry auth.uid(); client requests do.
  if v_actor is not null then
    v_role := public.current_org_role(new.organization_id);

    if v_role is null then
      raise exception 'No active membership in organization';
    end if;

    if tg_op = 'INSERT' then
      if not public.can_manage_task_row(new.organization_id, new.node_id) then
        raise exception 'Not allowed to create tasks in this scope';
      end if;
      if new.primary_assignee_id is not null
         and v_role = 'manager'
         and not public.employee_in_current_scope(new.organization_id, new.primary_assignee_id) then
        raise exception 'Manager cannot assign outside granted scope';
      end if;
    else
      if v_role = 'member' then
        if not public.can_collaborate_task_row(old.organization_id, old.node_id, old.primary_assignee_id, old.collaborator_ids) then
          raise exception 'Member cannot update this task';
        end if;
        if new.node_id is distinct from old.node_id
          or new.primary_assignee_id is distinct from old.primary_assignee_id
          or new.collaborator_ids is distinct from old.collaborator_ids
          or new.title is distinct from old.title
          or new.description is distinct from old.description
          or new.priority is distinct from old.priority
          or new.start_date is distinct from old.start_date
          or new.due_date is distinct from old.due_date
          or new.estimate_minutes is distinct from old.estimate_minutes
          or new.auto_progress is distinct from old.auto_progress
          or new.tags is distinct from old.tags
          or new.archived_at is distinct from old.archived_at
          or new.created_by is distinct from old.created_by then
          raise exception 'Member can only update status/progress on the task row';
        end if;
      elsif v_role = 'manager' then
        if not public.can_manage_task_row(old.organization_id, old.node_id)
           or not public.can_manage_task_row(new.organization_id, new.node_id) then
          raise exception 'Manager cannot move/update task outside granted scope';
        end if;
        if new.primary_assignee_id is not null
           and not public.employee_in_current_scope(new.organization_id, new.primary_assignee_id) then
          raise exception 'Manager cannot assign outside granted scope';
        end if;
      elsif v_role not in ('owner','admin') then
        raise exception 'Role is read-only';
      end if;
    end if;
  end if;

  if new.auto_progress and new.status <> 'done' and new.id is not null then
    select case when count(*) = 0 then 0
                else round((count(*) filter (where is_done)::numeric / count(*)) * 100)::integer end
      into new.progress
    from public.task_checklist_items
    where task_id = new.id;
  end if;

  if new.status = 'done' then
    if new.auto_progress and new.id is not null and exists (
      select 1 from public.task_checklist_items c
      where c.task_id = new.id and c.is_done = false
    ) then
      raise exception 'Cannot complete an auto-progress task while checklist items are still open';
    end if;
    if new.id is not null and exists (
      select 1
      from public.task_dependencies d
      join public.tasks prerequisite
        on prerequisite.organization_id = d.organization_id
       and prerequisite.id = d.depends_on_task_id
      where d.organization_id = new.organization_id
        and d.task_id = new.id
        and prerequisite.status <> 'done'
        and prerequisite.archived_at is null
    ) then
      raise exception 'Cannot complete a task while dependencies are still open';
    end if;
    new.progress := 100;
    if new.completed_at is null then new.completed_at := now(); end if;
  else
    new.completed_at := null;
  end if;

  return new;
end;
$$;

-- 5. Rebuild task_rollups view so t.* exposes collaborator_ids
drop view if exists public.task_rollups;
create view public.task_rollups
with (security_invoker = true)
as
select
  t.*,
  coalesce((
    select sum(te.minutes)::bigint
    from public.task_time_entries te
    where te.task_id = t.id
  ), 0::bigint) as actual_minutes,
  (
    select count(*)::integer
    from public.task_checklist_items ci
    where ci.task_id = t.id
  ) as checklist_total,
  (
    select count(*)::integer
    from public.task_checklist_items ci
    where ci.task_id = t.id and ci.is_done
  ) as checklist_done,
  public.task_is_blocked(t.id) as is_blocked
from public.tasks t;

grant select on public.task_rollups to authenticated;
