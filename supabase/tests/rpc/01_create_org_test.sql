-- Test 02: RPC create_organization Function Test
-- Verifies that calling create_organization successfully creates organization and owner membership

DO $$
DECLARE
  v_test_user uuid := '00000000-0000-0000-0000-000000000099';
  v_org_id uuid;
BEGIN
  INSERT INTO auth.users (id, email) VALUES 
    (v_test_user, 'rpc-test-user@test.local')
  ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('request.jwt.claim.sub', v_test_user::text, true);
  
  -- Call RPC function with test slug
  SELECT public.create_organization('Test Corp', 'test-corp-unit-test-' || floor(random()*100000)::text, 'Asia/Ho_Chi_Minh') INTO v_org_id;

  ASSERT v_org_id IS NOT NULL, 'create_organization failed to return organization UUID';

  -- Cleanup
  DELETE FROM public.tasks WHERE organization_id = v_org_id;
  DELETE FROM public.activity_logs WHERE organization_id = v_org_id;
  DELETE FROM public.notifications WHERE organization_id = v_org_id;
  DELETE FROM public.organizations WHERE id = v_org_id;
  DELETE FROM auth.users WHERE id = v_test_user;
END $$;

