-- 20260913213000_add_employee_zalo_integration.sql
-- WorkTree X: Add phone number and Zalo Bot integration to employees
-- Enables 1-touch pairing by phone and zero-cost automated task notifications.

-- 1. Add columns to public.employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS zalo_chat_id text,
  ADD COLUMN IF NOT EXISTS zalo_linked_at timestamptz;

-- 2. Constraints & Indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employees_phone_len'
  ) THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_phone_len CHECK (phone IS NULL OR char_length(phone) BETWEEN 9 AND 25);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS employees_phone_idx
  ON public.employees (organization_id, phone)
  WHERE phone IS NOT NULL AND employment_status = 'active';

CREATE INDEX IF NOT EXISTS employees_zalo_chat_id_idx
  ON public.employees (zalo_chat_id)
  WHERE zalo_chat_id IS NOT NULL;

-- 3. RPC Function: Pair Employee Zalo by Phone
CREATE OR REPLACE FUNCTION public.pair_employee_zalo_by_phone(
  p_phone text,
  p_zalo_chat_id text,
  p_display_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_clean_phone text;
  v_emp record;
BEGIN
  IF p_phone IS NULL OR trim(p_phone) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'empty_phone',
      'message', 'Vui lòng cung cấp số điện thoại.'
    );
  END IF;

  -- Normalize phone: remove non-digits
  v_clean_phone := regexp_replace(p_phone, '[^0-9+]', '', 'g');
  -- Convert +84 or 84 to 0
  IF v_clean_phone ~ '^\+84' THEN
    v_clean_phone := '0' || substring(v_clean_phone from 4);
  ELSIF v_clean_phone ~ '^84' AND char_length(v_clean_phone) >= 11 THEN
    v_clean_phone := '0' || substring(v_clean_phone from 3);
  END IF;

  IF char_length(v_clean_phone) < 9 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_phone',
      'message', 'Số điện thoại không hợp lệ (cần ít nhất 9 số).'
    );
  END IF;

  -- Locate matching employee
  SELECT e.id, e.organization_id, e.full_name, o.name AS org_name
  INTO v_emp
  FROM public.employees e
  JOIN public.organizations o ON o.id = e.organization_id
  WHERE (
    e.phone = v_clean_phone 
    OR regexp_replace(COALESCE(e.phone, ''), '[^0-9]', '', 'g') = v_clean_phone
    OR (v_clean_phone ~ '^0' AND regexp_replace(COALESCE(e.phone, ''), '[^0-9]', '', 'g') = '84' || substring(v_clean_phone from 2))
  )
    AND e.employment_status = 'active'
  ORDER BY e.updated_at DESC
  LIMIT 1;

  IF v_emp IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'not_found',
      'phone', v_clean_phone,
      'message', 'Không tìm thấy nhân viên nào có số điện thoại ' || v_clean_phone || ' trong hệ thống WorkTree X.'
    );
  END IF;

  -- Update employee
  UPDATE public.employees
  SET zalo_chat_id = p_zalo_chat_id,
      zalo_linked_at = now(),
      updated_at = now()
  WHERE id = v_emp.id;

  RETURN jsonb_build_object(
    'success', true,
    'employee_id', v_emp.id,
    'organization_id', v_emp.organization_id,
    'full_name', v_emp.full_name,
    'organization_name', v_emp.org_name,
    'phone', v_clean_phone,
    'zalo_chat_id', p_zalo_chat_id,
    'message', 'Liên kết Zalo thành công!'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pair_employee_zalo_by_phone(text, text, text) TO authenticated, service_role, anon;

-- 4. RPC Function: Unlink Employee Zalo
CREATE OR REPLACE FUNCTION public.unlink_employee_zalo(p_employee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT organization_id INTO v_org_id FROM public.employees WHERE id = p_employee_id;
  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Nhân viên không tồn tại.');
  END IF;

  -- Verify permissions: must be org member and either owner/admin or the employee themselves
  IF NOT (
    public.has_org_role(v_org_id, 'owner') 
    OR public.has_org_role(v_org_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = v_org_id 
        AND om.user_id = auth.uid() 
        AND om.employee_id = p_employee_id
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied to unlink Zalo for this employee';
  END IF;

  UPDATE public.employees
  SET zalo_chat_id = NULL,
      zalo_linked_at = NULL,
      updated_at = now()
  WHERE id = p_employee_id;

  RETURN jsonb_build_object('success', true, 'message', 'Đã hủy liên kết Zalo thành công.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlink_employee_zalo(uuid) TO authenticated, service_role;
