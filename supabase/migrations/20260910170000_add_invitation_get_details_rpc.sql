-- Migration: 20260910170000_add_invitation_get_details_rpc.sql
-- Purpose: Provide safe public lookup of invitation details (org name, email, employee name) by token for invited users.

create or replace function public.get_invitation_details(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash bytea;
  v_inv public.invitations%rowtype;
  v_org_name text;
  v_emp_name text;
  v_is_existing boolean := false;
begin
  if p_token is null or char_length(p_token) < 32 then
    return jsonb_build_object('valid', false, 'error', 'Mã mời không hợp lệ.');
  end if;

  v_hash := extensions.digest(p_token, 'sha256');

  select * into v_inv
  from public.invitations
  where token_hash = v_hash
  limit 1;

  if not found then
    return jsonb_build_object('valid', false, 'error', 'Không tìm thấy lời mời.');
  end if;

  if v_inv.status = 'accepted' then
    return jsonb_build_object('valid', false, 'error', 'Lời mời này đã được chấp nhận trước đó. Vui lòng đăng nhập.');
  end if;

  if v_inv.status = 'revoked' then
    return jsonb_build_object('valid', false, 'error', 'Lời mời này đã bị hủy bởi người quản trị.');
  end if;

  if v_inv.expires_at <= now() or v_inv.status = 'expired' then
    return jsonb_build_object('valid', false, 'error', 'Lời mời đã hết hạn. Vui lòng yêu cầu liên kết mới.');
  end if;

  -- Organization name
  select name into v_org_name
  from public.organizations
  where id = v_inv.organization_id;

  -- Employee name if linked
  if v_inv.employee_id is not null then
    select full_name into v_emp_name
    from public.employees
    where id = v_inv.employee_id;
  end if;

  -- Check if email already registered in auth.users
  select exists (
    select 1 from auth.users where lower(email) = lower(v_inv.email)
  ) into v_is_existing;

  return jsonb_build_object(
    'valid', true,
    'email', v_inv.email,
    'full_name', coalesce(v_emp_name, ''),
    'organization_id', v_inv.organization_id,
    'organization_name', coalesce(v_org_name, 'Tổ chức'),
    'role', v_inv.role,
    'is_existing_user', v_is_existing,
    'expires_at', v_inv.expires_at
  );
end;
$$;

revoke all on function public.get_invitation_details(text) from public;
grant execute on function public.get_invitation_details(text) to anon, authenticated;
