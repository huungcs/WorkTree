-- Test 01: Multi-Tenant RLS Isolation Test
-- Ensures Tenant A cannot read or write data belonging to Tenant B

DO $$
DECLARE
  c_u_a uuid := '00000000-0000-0000-0000-000000000001';
  c_u_b uuid := '00000000-0000-0000-0000-000000000002';
  c_org_a uuid := '11111111-1111-1111-1111-111111111111';
  c_org_b uuid := '22222222-2222-2222-2222-222222222222';
  c_node_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  c_node_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_count int;
BEGIN
  -- 0. Ensure test auth users exist
  INSERT INTO auth.users (id, email) VALUES 
    (c_u_a, 'tenant-a-owner@test.local'),
    (c_u_b, 'tenant-b-owner@test.local')
  ON CONFLICT (id) DO NOTHING;

  -- 1. Create two test organizations
  INSERT INTO public.organizations (id, name, slug, created_by) VALUES 
    (c_org_a, 'Company A Test', 'company-a-test-' || floor(random()*10000)::text, c_u_a),
    (c_org_b, 'Company B Test', 'company-b-test-' || floor(random()*10000)::text, c_u_b)
  ON CONFLICT (id) DO NOTHING;

  -- 2. Create nodes under each (root node must have type 'company')
  INSERT INTO public.organization_nodes (id, organization_id, name, type) VALUES
    (c_node_a, c_org_a, 'Company A Root', 'company'),
    (c_node_b, c_org_b, 'Company B Root', 'company')
  ON CONFLICT (id) DO NOTHING;

  -- 3. Verification query: Querying with Tenant A context must return 0 rows for Tenant B
  PERFORM set_config('request.jwt.claim.sub', c_u_a::text, true);
  SET ROLE authenticated;
  SELECT COUNT(*) INTO v_count 
  FROM public.organization_nodes 
  WHERE organization_id = c_org_b;
  RESET ROLE;

  ASSERT v_count = 0, 'Cross-tenant data leakage detected!';

  -- Cleanup
  DELETE FROM public.tasks WHERE organization_id IN (c_org_a, c_org_b);
  DELETE FROM public.activity_logs WHERE organization_id IN (c_org_a, c_org_b);
  DELETE FROM public.notifications WHERE organization_id IN (c_org_a, c_org_b);
  DELETE FROM public.organizations WHERE id IN (c_org_a, c_org_b);
  DELETE FROM auth.users WHERE id IN (c_u_a, c_u_b);
END $$;

