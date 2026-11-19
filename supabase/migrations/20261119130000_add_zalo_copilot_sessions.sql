-- WorkTree X: Persistent multi-turn session & confirmation store for Zalo AI Copilot
-- Stores short-term conversation context and pending 2-step confirmation actions
-- across stateless serverless webhooks (Vercel cold starts) with strict service_role isolation.

CREATE TABLE IF NOT EXISTS public.zalo_copilot_sessions (
  chat_id text PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  last_message_id text,
  recent_messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  pending_action jsonb,
  pending_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS zalo_copilot_sessions_org_idx
  ON public.zalo_copilot_sessions (organization_id, updated_at DESC);

ALTER TABLE public.zalo_copilot_sessions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.zalo_copilot_sessions IS
  'Server-side only (service_role) session history and pending 2-step write confirmations for Zalo Bot AI Copilot.';
