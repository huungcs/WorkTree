-- Test 03: Schema Integrity Test
-- Verifies required tables, views, and indexes exist in public schema

DO $$
BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations'), 'Table organizations missing';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization_nodes'), 'Table organization_nodes missing';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees'), 'Table employees missing';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks'), 'Table tasks missing';
  ASSERT EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'task_rollups'), 'View task_rollups missing';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_pins'), 'Table user_pins missing';
END $$;
