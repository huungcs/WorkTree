-- Migration: 20261118223000_add_worktree_mcp_servers.sql
-- Purpose: Add WorkTree X MCP Server registry and call logs with strict multi-tenant RLS.

BEGIN;

CREATE TABLE IF NOT EXISTS public.mcp_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  key_encrypted text,
  permissions text[] NOT NULL DEFAULT ARRAY['read','create','update','status','comment','checklist'],
  scope_node_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','revoked')),
  rate_limit_per_min integer NOT NULL DEFAULT 60 CHECK (rate_limit_per_min BETWEEN 10 AND 600),
  last_used_at timestamptz,
  last_client text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mcp_servers_org_owner_idx
  ON public.mcp_servers (organization_id, owner_user_id, status, created_at DESC);

DROP TRIGGER IF EXISTS mcp_servers_set_updated_at ON public.mcp_servers;
CREATE TRIGGER mcp_servers_set_updated_at
  BEFORE UPDATE ON public.mcp_servers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.mcp_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  mcp_id uuid REFERENCES public.mcp_servers(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  method text NOT NULL,
  tool_name text,
  action_kind text NOT NULL DEFAULT 'protocol',
  status text NOT NULL,
  client_info text,
  request_args jsonb,
  response_summary jsonb,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mcp_call_logs_org_time_idx
  ON public.mcp_call_logs (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS mcp_call_logs_mcp_time_idx
  ON public.mcp_call_logs (mcp_id, created_at DESC)
  WHERE mcp_id IS NOT NULL;

ALTER TABLE public.mcp_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mcp_servers_select_own_or_admin" ON public.mcp_servers;
CREATE POLICY "mcp_servers_select_own_or_admin" ON public.mcp_servers
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND (owner_user_id = auth.uid() OR public.is_org_admin(organization_id))
  );

DROP POLICY IF EXISTS "mcp_servers_insert_own" ON public.mcp_servers;
CREATE POLICY "mcp_servers_insert_own" ON public.mcp_servers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id)
    AND owner_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "mcp_servers_update_own_or_admin" ON public.mcp_servers;
CREATE POLICY "mcp_servers_update_own_or_admin" ON public.mcp_servers
  FOR UPDATE TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND (owner_user_id = auth.uid() OR public.is_org_admin(organization_id))
  )
  WITH CHECK (
    public.is_org_member(organization_id)
    AND (owner_user_id = auth.uid() OR public.is_org_admin(organization_id))
  );

DROP POLICY IF EXISTS "mcp_servers_delete_own_or_admin" ON public.mcp_servers;
CREATE POLICY "mcp_servers_delete_own_or_admin" ON public.mcp_servers
  FOR DELETE TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND (owner_user_id = auth.uid() OR public.is_org_admin(organization_id))
  );

DROP POLICY IF EXISTS "mcp_call_logs_select_own_or_admin" ON public.mcp_call_logs;
CREATE POLICY "mcp_call_logs_select_own_or_admin" ON public.mcp_call_logs
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND (actor_user_id = auth.uid() OR public.is_org_admin(organization_id))
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_servers TO authenticated;
GRANT ALL ON public.mcp_servers TO service_role;

GRANT SELECT ON public.mcp_call_logs TO authenticated;
GRANT ALL ON public.mcp_call_logs TO service_role;

COMMIT;
