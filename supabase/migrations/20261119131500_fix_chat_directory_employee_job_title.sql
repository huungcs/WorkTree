-- Use the canonical employees.job_title column in the chat directory RPC.
CREATE OR REPLACE FUNCTION public.list_chat_eligible_participants(
  p_organization_id uuid,
  p_query text DEFAULT ''
)
RETURNS TABLE (
  membership_id uuid,
  user_id uuid,
  employee_id uuid,
  display_name text,
  role_label text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_search text := lower(btrim(coalesce(p_query, '')));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;
  IF NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN QUERY
  SELECT
    m.id AS membership_id,
    m.user_id,
    m.employee_id,
    COALESCE(NULLIF(btrim(e.full_name), ''), NULLIF(btrim(p.display_name), ''), 'Thành viên')::text AS display_name,
    COALESCE(
      NULLIF(btrim(e.job_title), ''),
      CASE m.role::text
        WHEN 'owner' THEN 'Chủ sở hữu'
        WHEN 'admin' THEN 'Quản trị viên'
        WHEN 'manager' THEN 'Quản lý'
        WHEN 'viewer' THEN 'Chỉ xem'
        ELSE 'Nhân viên'
      END
    )::text AS role_label
  FROM public.organization_members m
  LEFT JOIN public.employees e ON e.id = m.employee_id AND e.organization_id = m.organization_id
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.organization_id = p_organization_id
    AND m.status = 'active'
    AND (
      v_search = ''
      OR lower(COALESCE(e.full_name, p.display_name, '')) LIKE '%' || v_search || '%'
      OR lower(COALESCE(e.job_title, '')) LIKE '%' || v_search || '%'
    )
  ORDER BY (m.user_id = v_uid) DESC, COALESCE(e.full_name, p.display_name, 'Thành viên') ASC;
END;
$$;
