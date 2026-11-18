-- Migration: 20261119021000_add_platform_ai_settings.sql
-- Purpose: Store platform-wide AI provider endpoint, encrypted/server-only API key,
--          and default/fallback models in Supabase Database so serverless deployments
--          do not depend on extra AI_* environment variables.
-- Security: RLS enabled with ZERO client policies; anon/authenticated privileges
--           explicitly revoked. Only trusted backend code using service_role
--           (api/ai.js, api/platform-admin.js) may read or update this table.

BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_ai_settings (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  provider text NOT NULL DEFAULT 'xpiki' CHECK (char_length(btrim(provider)) BETWEEN 1 AND 64),
  api_base_url text NOT NULL DEFAULT 'https://api.xpiki.com/v1/chat/completions',
  api_key text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT 'claude-opus-5' CHECK (char_length(btrim(model)) BETWEEN 1 AND 120),
  fallback_model text NOT NULL DEFAULT 'claude-opus-4-6',
  is_enabled boolean NOT NULL DEFAULT true,
  timeout_ms integer NOT NULL DEFAULT 22000 CHECK (timeout_ms BETWEEN 3000 AND 60000),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS platform_ai_settings_set_updated_at ON public.platform_ai_settings;
CREATE TRIGGER platform_ai_settings_set_updated_at
  BEFORE UPDATE ON public.platform_ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.platform_ai_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.platform_ai_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.platform_ai_settings TO service_role;

INSERT INTO public.platform_ai_settings (
  id,
  provider,
  api_base_url,
  api_key,
  model,
  fallback_model,
  is_enabled
) VALUES (
  'default',
  'xpiki',
  'https://api.xpiki.com/v1/chat/completions',
  '',
  'claude-opus-5',
  'claude-opus-4-6',
  true
) ON CONFLICT (id) DO NOTHING;

COMMIT;
