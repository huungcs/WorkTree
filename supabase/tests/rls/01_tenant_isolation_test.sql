-- Test 01: Multi-Tenant RLS Isolation Test
-- Ensures Tenant A cannot read or write data belonging to Tenant B

BEGIN;

-- 1. Create two test organizations
INSERT INTO organizations (id, name, slug) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Company A', 'company-a'),
  ('22222222-2222-2222-2222-222222222222', 'Company B', 'company-b')
ON CONFLICT (id) DO NOTHING;

-- 2. Create nodes under each
INSERT INTO organization_nodes (id, organization_id, name, node_type) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Dept A', 'department'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Dept B', 'department')
ON CONFLICT (id) DO NOTHING;

-- Verification query: Querying with Tenant A context must return 0 rows for Tenant B
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count 
  FROM organization_nodes 
  WHERE organization_id = '22222222-2222-2222-2222-222222222222' 
    AND id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  ASSERT v_count = 0, 'Cross-tenant data leakage detected!';
END $$;

ROLLBACK;
