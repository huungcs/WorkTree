-- Allow managers to invite member/viewer accounts only inside their granted subtree.
-- Owner/admin behavior remains unchanged. This RPC is the authoritative boundary;
-- the UI restrictions are convenience only.

create or replace function public.create_invitation(
  p_organization_id uuid,
  p_email text,
  p_full_name text,
  p_home_node_id uuid,
  p_role public.org_role default 'member',
  p_scope_node_ids uuid[] default '{}',
  p_employee_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role public.org_role;
  v_token text;
  v_employee uuid;
  v_employee_home uuid;
  v_employee_status public.membership_status;
  v_employee_email text;
  v_email text := lower(btrim(p_email));
  v_scope uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;

  v_actor_role := public.current_org_role(p_organization_id);
  if v_actor_role not in ('owner','admin','manager') then
    raise exception 'Invitation permission required';
  end if;
  if p_role = 'owner' then raise exception 'Owner role must be transferred separately'; end if;
  if p_role = 'admin' and v_actor_role <> 'owner' then raise exception 'Only owner can invite another admin'; end if;

  if v_actor_role = 'manager' and p_role not in ('member','viewer') then
    raise exception 'Manager can only invite member or viewer roles';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Invalid email'; end if;
  if char_length(btrim(p_full_name)) < 1 or char_length(btrim(p_full_name)) > 180 then raise exception 'Invalid employee name'; end if;

  if not exists (
    select 1 from public.organization_nodes
    where organization_id = p_organization_id
      and id = p_home_node_id
      and archived_at is null
  ) then raise exception 'Invalid department/team node'; end if;

  if v_actor_role = 'manager'
     and not public.node_in_current_scope(p_organization_id, p_home_node_id) then
    raise exception 'Manager cannot invite outside granted scope';
  end if;

  if p_role <> 'admin' and coalesce(cardinality(p_scope_node_ids), 0) = 0 then
    p_scope_node_ids := array[p_home_node_id];
  end if;

  foreach v_scope in array p_scope_node_ids loop
    if not exists (
      select 1 from public.organization_nodes
      where organization_id = p_organization_id and id = v_scope and archived_at is null
    ) then raise exception 'Scope node does not belong to organization'; end if;

    if v_actor_role = 'manager'
       and not public.node_in_current_scope(p_organization_id, v_scope) then
      raise exception 'Manager cannot grant scope outside granted scope';
    end if;
  end loop;

  if p_employee_id is not null then
    select id, home_node_id, employment_status, lower(email)
      into v_employee, v_employee_home, v_employee_status, v_employee_email
    from public.employees
    where organization_id = p_organization_id and id = p_employee_id;

    if v_employee is null then raise exception 'Employee does not belong to organization'; end if;
    if v_actor_role = 'manager' then
      if v_employee_status <> 'active' then raise exception 'Manager can only invite active employees'; end if;
      if v_employee_home is null
         or not public.node_in_current_scope(p_organization_id, v_employee_home) then
        raise exception 'Manager cannot invite employee outside granted scope';
      end if;
      if p_home_node_id is distinct from v_employee_home then
        raise exception 'Manager cannot move employee while inviting';
      end if;
      if v_employee_email is not null and v_employee_email <> v_email then
        raise exception 'Manager cannot change employee email while inviting';
      end if;
    end if;

    if exists (
      select 1 from public.organization_members
      where organization_id = p_organization_id and employee_id = v_employee and status = 'active'
    ) then raise exception 'This employee is already linked to an active account'; end if;

    if v_actor_role in ('owner','admin') then
      update public.employees
      set email = coalesce(email, v_email),
          full_name = coalesce(nullif(btrim(p_full_name), ''), full_name),
          home_node_id = coalesce(p_home_node_id, home_node_id),
          employment_status = 'active',
          updated_at = now()
      where organization_id = p_organization_id and id = v_employee;
    else
      -- Managers may fill a missing email, but cannot change personnel profile or placement.
      update public.employees
      set email = coalesce(email, v_email), updated_at = now()
      where organization_id = p_organization_id and id = v_employee;
    end if;
  else
    select id, home_node_id, employment_status, lower(email)
      into v_employee, v_employee_home, v_employee_status, v_employee_email
    from public.employees
    where organization_id = p_organization_id and lower(email) = v_email
    limit 1;

    if v_employee is null then
      insert into public.employees (organization_id, full_name, email, home_node_id, created_by)
      values (p_organization_id, btrim(p_full_name), v_email, p_home_node_id, v_actor)
      returning id into v_employee;
    elsif v_actor_role = 'manager' then
      if v_employee_status <> 'active'
         or v_employee_home is null
         or not public.node_in_current_scope(p_organization_id, v_employee_home) then
        raise exception 'Manager cannot invite employee outside granted scope';
      end if;
      if p_home_node_id is distinct from v_employee_home then
        raise exception 'Manager cannot move employee while inviting';
      end if;
    else
      update public.employees
      set full_name = btrim(p_full_name), home_node_id = p_home_node_id,
          employment_status = 'active', updated_at = now()
      where organization_id = p_organization_id and id = v_employee;
    end if;
  end if;

  if exists (
    select 1
    from public.organization_members m
    join auth.users u on u.id = m.user_id
    where m.organization_id = p_organization_id
      and lower(u.email) = v_email
      and m.status = 'active'
  ) then raise exception 'This email is already an active member'; end if;

  if v_actor_role = 'manager' and exists (
    select 1 from public.invitations
    where organization_id = p_organization_id
      and lower(email) = v_email
      and status = 'pending'
      and invited_by <> v_actor
  ) then raise exception 'A pending invitation is already managed by an administrator'; end if;

  update public.invitations
  set status = 'revoked'
  where organization_id = p_organization_id
    and lower(email) = v_email
    and status = 'pending'
    and (v_actor_role in ('owner','admin') or invited_by = v_actor);

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.invitations (
    organization_id, email, employee_id, role, scope_node_ids,
    token_hash, status, invited_by, expires_at
  ) values (
    p_organization_id, v_email, v_employee, p_role, coalesce(p_scope_node_ids,'{}'),
    extensions.digest(v_token, 'sha256'), 'pending', v_actor, now() + interval '7 days'
  );

  insert into public.security_audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
  values (
    p_organization_id, v_actor, 'invitation.created', 'employee', v_employee::text,
    jsonb_build_object(
      'email', v_email,
      'role', p_role::text,
      'actor_role', v_actor_role::text,
      'scope_node_ids', to_jsonb(coalesce(p_scope_node_ids, '{}'))
    )
  );

  return v_token;
end;
$$;

revoke all on function public.create_invitation(uuid, text, text, uuid, public.org_role, uuid[], uuid) from public;
grant execute on function public.create_invitation(uuid, text, text, uuid, public.org_role, uuid[], uuid) to authenticated;

-- Managers need account state only for employees they can already read in their scope.
drop policy if exists members_select_self_or_admin on public.organization_members;
create policy members_select_self_admin_or_scoped_manager on public.organization_members
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_org_admin(organization_id)
  or (
    public.current_org_role(organization_id) = 'manager'
    and employee_id is not null
    and public.employee_in_current_scope(organization_id, employee_id)
  )
);

drop policy if exists invitations_select_admin on public.invitations;
create policy invitations_select_admin_or_scoped_manager on public.invitations
for select to authenticated
using (
  public.is_org_admin(organization_id)
  or (
    public.current_org_role(organization_id) = 'manager'
    and role in ('member','viewer')
    and employee_id is not null
    and public.employee_in_current_scope(organization_id, employee_id)
  )
);
