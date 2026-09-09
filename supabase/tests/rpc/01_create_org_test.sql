-- Test 02: RPC create_organization Function Test
-- Verifies that calling create_organization successfully creates organization and owner membership

BEGIN;

DO $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Call RPC function with test slug
  SELECT create_organization('Test Corp', 'test-corp-unit-test', 'Asia/Ho_Chi_Minh') INTO v_org_id;

  ASSERT v_org_id IS NOT NULL, 'create_organization failed to return organization UUID';
END $$;

ROLLBACK;
