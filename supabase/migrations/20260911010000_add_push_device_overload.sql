-- Migration: 20260911010000_add_push_device_overload.sql
-- Purpose: Support backward-compatible push device registration signatures

CREATE OR REPLACE FUNCTION public.register_push_device(
  p_player_id text,
  p_device_type text DEFAULT 'web',
  p_push_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN public.register_push_device(
    p_subscription_id := p_player_id,
    p_platform := COALESCE(p_device_type, 'web'),
    p_user_agent := NULL,
    p_device_label := NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_push_device(text, text, text) TO authenticated;
