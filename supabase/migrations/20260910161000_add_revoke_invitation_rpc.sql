-- Migration: Add revoke_invitation and revoke_employee_invitation RPCs
-- Date: 2026-09-10
-- Purpose: Allow organization owners/admins to revoke pending employee invitations

create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations%rowtype;
  v_actor_role public.org_role;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_inv from public.invitations where id = p_invitation_id for update;
  if not found then raise exception 'Invitation not found'; end if;
  v_actor_role := public.current_org_role(v_inv.organization_id);
  if v_actor_role not in ('owner','admin') then raise exception 'Admin permission required'; end if;

  update public.invitations
  set status = 'revoked'
  where id = p_invitation_id;

  insert into public.security_audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
  values (
    v_inv.organization_id, auth.uid(), 'invitation.revoked', 'invitation', p_invitation_id::text,
    jsonb_build_object('email', v_inv.email, 'employee_id', v_inv.employee_id::text)
  );
end;
$$;

create or replace function public.revoke_employee_invitation(p_organization_id uuid, p_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role public.org_role;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  v_actor_role := public.current_org_role(p_organization_id);
  if v_actor_role not in ('owner','admin') then raise exception 'Admin permission required'; end if;

  update public.invitations
  set status = 'revoked'
  where organization_id = p_organization_id
    and employee_id = p_employee_id
    and status = 'pending';

  insert into public.security_audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
  values (
    p_organization_id, auth.uid(), 'invitation.revoked', 'employee', p_employee_id::text,
    jsonb_build_object('organization_id', p_organization_id::text, 'employee_id', p_employee_id::text)
  );
end;
$$;

grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.revoke_employee_invitation(uuid, uuid) to authenticated;
