-- =============================================================================
-- Migration: 20260913230000_platform_admin_portal_v1.sql
-- Domain: Platform Super-Admin Operations Portal
-- Security: Strict security definer functions, authoritative platform_admins,
--           tenant suspension enforcement, audit logs, and violations/settings tables.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Canonical is_platform_admin() Capability
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins
    WHERE user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, anon;

-- -----------------------------------------------------------------------------
-- 2. Suspension Audit Columns on Organizations
-- -----------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suspension_reason text;

-- -----------------------------------------------------------------------------
-- 3. Tenant Suspension & Unsuspension RPCs with Security Audit
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_suspend_tenant(
  p_organization_id uuid,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid;
  v_org_name text;
BEGIN
  v_caller := auth.uid();

  -- Verify caller is a platform super-admin
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied: Platform Super-Admin privilege required';
  END IF;

  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'suspension reason is required';
  END IF;

  -- Get organization name
  SELECT name INTO v_org_name
  FROM public.organizations
  WHERE id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  -- Update organization status to suspended
  UPDATE public.organizations
  SET status = 'suspended',
      suspended_at = now(),
      suspended_by = v_caller,
      suspension_reason = trim(p_reason),
      updated_at = now()
  WHERE id = p_organization_id;

  -- Create security audit record
  INSERT INTO public.security_audit_logs (
    organization_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata,
    created_at
  ) VALUES (
    p_organization_id,
    v_caller,
    'TENANT_SUSPENDED',
    'organization',
    p_organization_id::text,
    jsonb_build_object(
      'organization_name', v_org_name,
      'reason', trim(p_reason),
      'performed_by', 'platform_admin'
    ),
    now()
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_unsuspend_tenant(
  p_organization_id uuid,
  p_reason text DEFAULT 'Phục hồi hoạt động bởi Platform Admin'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid;
  v_org_name text;
BEGIN
  v_caller := auth.uid();

  -- Verify caller is a platform super-admin
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied: Platform Super-Admin privilege required';
  END IF;

  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;

  -- Get organization name
  SELECT name INTO v_org_name
  FROM public.organizations
  WHERE id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  -- Update organization status to active
  UPDATE public.organizations
  SET status = 'active',
      suspended_at = NULL,
      suspended_by = NULL,
      suspension_reason = NULL,
      updated_at = now()
  WHERE id = p_organization_id;

  -- Create security audit record
  INSERT INTO public.security_audit_logs (
    organization_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata,
    created_at
  ) VALUES (
    p_organization_id,
    v_caller,
    'TENANT_UNSUSPENDED',
    'organization',
    p_organization_id::text,
    jsonb_build_object(
      'organization_name', v_org_name,
      'reason', coalesce(trim(p_reason), 'Reactivated by Platform Admin'),
      'performed_by', 'platform_admin'
    ),
    now()
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_suspend_tenant(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_unsuspend_tenant(uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Tenant Violations Model
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  summary text NOT NULL,
  details text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_violations ENABLE ROW LEVEL SECURITY;
-- No client policies for regular users. Only accessible via Platform Admin serverless function or service role.

CREATE INDEX IF NOT EXISTS tenant_violations_org_status_idx
  ON public.tenant_violations (organization_id, status, severity);

-- -----------------------------------------------------------------------------
-- 5. Platform Settings Model
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Seed initial platform settings if not existing
INSERT INTO public.platform_settings (key, value)
VALUES
  ('general', '{"platform_name": "WorkTree X", "main_domain": "worktree.nguyentronghuu.com", "support_email": "support@worktree.nguyentronghuu.com", "default_timezone": "Asia/Ho_Chi_Minh"}'::jsonb),
  ('tenant_policy', '{"allow_signup": true, "auto_trial": true, "require_email_verification": false, "soft_quota_warning": true}'::jsonb),
  ('security', '{"require_admin_mfa": false, "audit_all_actions": true, "session_lifetime_hours": 12}'::jsonb),
  ('default_limits', '{"max_users_per_tenant": 100, "default_storage_gb": 20, "max_file_mb": 50}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6. Ensure Primary Platform Admin Is Active
-- -----------------------------------------------------------------------------
INSERT INTO public.platform_admins (user_id)
SELECT id
FROM auth.users
WHERE lower(email) = lower('nguyentronghuu1905@gmail.com')
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
