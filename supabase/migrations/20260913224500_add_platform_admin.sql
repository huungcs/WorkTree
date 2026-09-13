-- Migration: 20260913224500_add_platform_admin.sql
-- Domain: Platform Super-Admin
-- Purpose: Grant platform admin access to primary system operator and add helper RPC if needed.

-- Grant platform admin privilege to owner account
INSERT INTO public.platform_admins (user_id)
SELECT id
FROM auth.users
WHERE lower(email) = lower('nguyentronghuu1905@gmail.com')
ON CONFLICT (user_id) DO NOTHING;
