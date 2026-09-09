-- Migration: 20260910000000_link_employee_invitation.sql
-- Purpose: Support direct employee_id binding in create_invitation RPC, preventing duplicate employee rows
-- and removing dependency on fragile email matching.

-- Drop the old 6-argument signature to prevent ambiguous function call resolution in PostgreSQL
drop function if exists public.create_invitation(uuid, text, text, uuid, public.org_role, uuid[]);

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
  v_email text := lower(btrim(p_email));
  v_scope uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  v_actor_role := public.current_org_role(p_organization_id);
  if v_actor_role not in ('owner','admin') then raise exception 'Admin permission required'; end if;
  if p_role = 'owner' then raise exception 'Owner role must be transferred separately'; end if;
  if p_role = 'admin' and v_actor_role <> 'owner' then raise exception 'Only owner can invite another admin'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Invalid email'; end if;
  if char_length(btrim(p_full_name)) < 1 or char_length(btrim(p_full_name)) > 180 then raise exception 'Invalid employee name'; end if;

  if not exists (
    select 1 from public.organization_nodes
    where organization_id = p_organization_id
      and id = p_home_node_id
      and archived_at is null
  ) then raise exception 'Invalid department/team node'; end if;

  if p_role not in ('admin') and cardinality(p_scope_node_ids) = 0 then
    p_scope_node_ids := array[p_home_node_id];
  end if;

  foreach v_scope in array p_scope_node_ids loop
    if not exists (
      select 1 from public.organization_nodes
      where organization_id = p_organization_id and id = v_scope and archived_at is null
    ) then raise exception 'Scope node does not belong to organization'; end if;
  end loop;

  -- Canonical employee resolution:
  -- If explicit p_employee_id is provided, verify tenant ownership and existing membership
  if p_employee_id is not null then
    select id into v_employee
    from public.employees
    where organization_id = p_organization_id and id = p_employee_id;

    if v_employee is null then
      raise exception 'Employee does not belong to organization';
    end if;

    if exists (
      select 1 from public.organization_members
      where organization_id = p_organization_id and employee_id = v_employee and status = 'active'
    ) then
      raise exception 'This employee is already linked to an active account';
    end if;

    update public.employees
    set email = coalesce(email, v_email),
        full_name = coalesce(nullif(btrim(p_full_name), ''), full_name),
        home_node_id = coalesce(p_home_node_id, home_node_id),
        employment_status = 'active',
        updated_at = now()
    where organization_id = p_organization_id and id = v_employee;
  else
    -- Fallback: match by email or create new employee
    select id into v_employee
    from public.employees
    where organization_id = p_organization_id and lower(email) = v_email
    limit 1;

    if v_employee is null then
      insert into public.employees (organization_id, full_name, email, home_node_id, created_by)
      values (p_organization_id, btrim(p_full_name), v_email, p_home_node_id, v_actor)
      returning id into v_employee;
    else
      update public.employees
      set full_name = btrim(p_full_name), home_node_id = p_home_node_id, employment_status = 'active', updated_at = now()
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

  update public.invitations
  set status = 'revoked'
  where organization_id = p_organization_id
    and lower(email) = v_email
    and status = 'pending';

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
    jsonb_build_object('email', v_email, 'role', p_role::text)
  );

  return v_token;
end;
$$;

grant execute on function public.create_invitation(uuid, text, text, uuid, public.org_role, uuid[], uuid) to authenticated;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_inv public.invitations%rowtype;
  v_membership uuid;
  v_scope uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_token is null or char_length(p_token) < 32 then raise exception 'Invalid invitation token'; end if;

  select lower(email) into v_email from auth.users where id = v_user;
  if v_email is null then raise exception 'Authenticated user has no email'; end if;

  select * into v_inv
  from public.invitations
  where token_hash = extensions.digest(p_token, 'sha256')
    and status = 'pending'
  for update;

  if not found then raise exception 'Invitation not found or already used'; end if;
  if v_inv.expires_at <= now() then
    update public.invitations set status = 'expired' where id = v_inv.id;
    raise exception 'Invitation expired';
  end if;
  if lower(v_inv.email) <> v_email then raise exception 'Invitation email does not match signed-in user'; end if;

  insert into public.organization_members (organization_id, user_id, employee_id, role, status)
  values (v_inv.organization_id, v_user, v_inv.employee_id, v_inv.role, 'active')
  on conflict (organization_id, user_id)
  do update set employee_id = excluded.employee_id, role = excluded.role, status = 'active', updated_at = now()
  returning id into v_membership;

  delete from public.member_scopes where membership_id = v_membership;
  if v_inv.role not in ('owner','admin') then
    foreach v_scope in array v_inv.scope_node_ids loop
      insert into public.member_scopes (organization_id, membership_id, node_id, granted_by)
      values (v_inv.organization_id, v_membership, v_scope, v_inv.invited_by)
      on conflict do nothing;
    end loop;
  end if;

  update public.invitations
  set status = 'accepted', accepted_by = v_user, accepted_at = now()
  where id = v_inv.id;

  insert into public.security_audit_logs (organization_id, actor_user_id, action, target_type, target_id)
  values (v_inv.organization_id, v_user, 'invitation.accepted', 'membership', v_membership::text);

  return v_inv.organization_id;
end;
$$;

revoke all on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated;

