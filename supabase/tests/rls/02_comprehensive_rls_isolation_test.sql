-- WorkTree X — Step 02: Comprehensive Multi-Tenant RLS & Tenant Isolation Test Suite
-- Target: Supabase PostgreSQL (Executed under superuser session; switches role to 'authenticated' to enforce RLS)
-- Covers 60+ distinct empirical security assertions across Sections 4 to 15.

DO $suite$
DECLARE
  -- Organizations (WTX_TEST_ prefix)
  c_org_a uuid := '11111111-1111-1111-1111-111111111111';
  c_org_b uuid := '22222222-2222-2222-2222-222222222222';

  -- Users Org A
  c_u_a_owner   uuid := 'a0000000-0000-0000-0000-000000000001';
  c_u_a_admin   uuid := 'a0000000-0000-0000-0000-000000000002';
  c_u_a_manager uuid := 'a0000000-0000-0000-0000-000000000003';
  c_u_a_member  uuid := 'a0000000-0000-0000-0000-000000000004';
  c_u_a_viewer  uuid := 'a0000000-0000-0000-0000-000000000005';

  -- Users Org B
  c_u_b_owner   uuid := 'b0000000-0000-0000-0000-000000000001';
  c_u_b_admin   uuid := 'b0000000-0000-0000-0000-000000000002';
  c_u_b_manager uuid := 'b0000000-0000-0000-0000-000000000003';
  c_u_b_member  uuid := 'b0000000-0000-0000-0000-000000000004';
  c_u_b_viewer  uuid := 'b0000000-0000-0000-0000-000000000005';

  -- Nodes Org A
  c_node_a_root  uuid := 'a1000000-0000-0000-0000-000000000000';
  c_node_a_mkt   uuid := 'a1000000-0000-0000-0000-000000000001';
  c_node_a_sales uuid := 'a1000000-0000-0000-0000-000000000002';
  c_node_a_m1    uuid := 'a1000000-0000-0000-0000-000000000003';
  c_node_a_m2    uuid := 'a1000000-0000-0000-0000-000000000004';
  c_node_a_s1    uuid := 'a1000000-0000-0000-0000-000000000005';

  -- Nodes Org B
  c_node_b_root uuid := 'b1000000-0000-0000-0000-000000000000';
  c_node_b_eng  uuid := 'b1000000-0000-0000-0000-000000000001';
  c_node_b_1    uuid := 'b1000000-0000-0000-0000-000000000002';

  -- Employees Org A
  c_emp_a_owner   uuid := 'a2000000-0000-0000-0000-000000000001';
  c_emp_a_admin   uuid := 'a2000000-0000-0000-0000-000000000002';
  c_emp_a_manager uuid := 'a2000000-0000-0000-0000-000000000003';
  c_emp_a_member  uuid := 'a2000000-0000-0000-0000-000000000004';
  c_emp_a_viewer  uuid := 'a2000000-0000-0000-0000-000000000005';

  -- Employees Org B
  c_emp_b_owner   uuid := 'b2000000-0000-0000-0000-000000000001';
  c_emp_b_admin   uuid := 'b2000000-0000-0000-0000-000000000002';
  c_emp_b_manager uuid := 'b2000000-0000-0000-0000-000000000003';
  c_emp_b_member  uuid := 'b2000000-0000-0000-0000-000000000004';
  c_emp_b_viewer  uuid := 'b2000000-0000-0000-0000-000000000005';

  -- Memberships Org A
  c_mem_a_owner   uuid := 'a3000000-0000-0000-0000-000000000001';
  c_mem_a_admin   uuid := 'a3000000-0000-0000-0000-000000000002';
  c_mem_a_manager uuid := 'a3000000-0000-0000-0000-000000000003';
  c_mem_a_member  uuid := 'a3000000-0000-0000-0000-000000000004';
  c_mem_a_viewer  uuid := 'a3000000-0000-0000-0000-000000000005';

  -- Memberships Org B
  c_mem_b_owner   uuid := 'b3000000-0000-0000-0000-000000000001';
  c_mem_b_admin   uuid := 'b3000000-0000-0000-0000-000000000002';
  c_mem_b_manager uuid := 'b3000000-0000-0000-0000-000000000003';
  c_mem_b_member  uuid := 'b3000000-0000-0000-0000-000000000004';
  c_mem_b_viewer  uuid := 'b3000000-0000-0000-0000-000000000005';

  -- Tasks
  c_task_a_1 uuid := 'a4000000-0000-0000-0000-000000000001';
  c_task_a_2 uuid := 'a4000000-0000-0000-0000-000000000002';
  c_task_b_1 uuid := 'b4000000-0000-0000-0000-000000000001';

  -- Saved Views
  c_sv_a uuid := 'a5000000-0000-0000-0000-000000000001';
  c_sv_b uuid := 'b5000000-0000-0000-0000-000000000001';

  -- Notifications
  c_notif_a uuid := 'a6000000-0000-0000-0000-000000000001';
  c_notif_b uuid := 'b6000000-0000-0000-0000-000000000001';

  -- Counters and flags
  v_cnt int;
  v_upd int;
  v_passed int := 0;
  v_storage_res boolean;
  v_err_caught boolean;

BEGIN
  -- ==========================================================================
  -- 0. CLEANUP ANY LEFTOVER TEST DATA FROM PRIOR RUNS
  -- ==========================================================================
  DELETE FROM public.saved_views WHERE organization_id IN (c_org_a, c_org_b);
  DELETE FROM public.tasks WHERE organization_id IN (c_org_a, c_org_b);
  DELETE FROM public.activity_logs WHERE organization_id IN (c_org_a, c_org_b);
  DELETE FROM public.notifications WHERE organization_id IN (c_org_a, c_org_b);
  DELETE FROM public.organizations WHERE id IN (c_org_a, c_org_b);
  DELETE FROM auth.users WHERE id IN (
    c_u_a_owner, c_u_a_admin, c_u_a_manager, c_u_a_member, c_u_a_viewer,
    c_u_b_owner, c_u_b_admin, c_u_b_manager, c_u_b_member, c_u_b_viewer
  );

  -- ==========================================================================
  -- 1. SETUP FIXTURES (Running as superuser 'postgres' to establish baseline)
  -- ==========================================================================

  -- 1.1 Auth Users
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
    (c_u_a_owner,   'owner-a@test.local',   '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (c_u_a_admin,   'admin-a@test.local',   '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (c_u_a_manager, 'manager-a@test.local', '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (c_u_a_member,  'member-a@test.local',  '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (c_u_a_viewer,  'viewer-a@test.local',  '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (c_u_b_owner,   'owner-b@test.local',   '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (c_u_b_admin,   'admin-b@test.local',   '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (c_u_b_manager, 'manager-b@test.local', '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (c_u_b_member,  'member-b@test.local',  '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (c_u_b_viewer,  'viewer-b@test.local',  '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

  -- 1.2 Organizations (WTX_TEST_ prefix)
  INSERT INTO public.organizations (id, name, slug, timezone, created_by) VALUES
    (c_org_a, 'WTX_TEST_COMPANY_A', 'wtx-test-company-a', 'Asia/Ho_Chi_Minh', c_u_a_owner),
    (c_org_b, 'WTX_TEST_COMPANY_B', 'wtx-test-company-b', 'Asia/Ho_Chi_Minh', c_u_b_owner);

  -- 1.3 Organization Nodes (Closure tree triggers automatically populate organization_node_closure)
  INSERT INTO public.organization_nodes (id, organization_id, parent_id, type, name, sort_order) VALUES
    (c_node_a_root,  c_org_a, null,          'company',    'Alpha HQ',    0),
    (c_node_a_mkt,   c_org_a, c_node_a_root, 'department', 'Marketing',   1),
    (c_node_a_sales, c_org_a, c_node_a_root, 'department', 'Sales',       2),
    (c_node_a_m1,    c_org_a, c_node_a_mkt,  'project',    'Campaign M1', 1),
    (c_node_a_m2,    c_org_a, c_node_a_mkt,  'project',    'Campaign M2', 2),
    (c_node_a_s1,    c_org_a, c_node_a_sales,'project',    'Q3 Sales',    1),
    (c_node_b_root,  c_org_b, null,          'company',    'Beta HQ',     0),
    (c_node_b_eng,   c_org_b, c_node_b_root, 'department', 'Engineering', 1),
    (c_node_b_1,     c_org_b, c_node_b_eng,  'project',    'Core Engine', 1);

  UPDATE public.organizations SET root_node_id = c_node_a_root WHERE id = c_org_a;
  UPDATE public.organizations SET root_node_id = c_node_b_root WHERE id = c_org_b;

  -- 1.4 Employees
  INSERT INTO public.employees (id, organization_id, full_name, email, job_title, home_node_id, created_by) VALUES
    (c_emp_a_owner,   c_org_a, 'Alice Owner',   'owner-a@test.local',   'CEO',         c_node_a_root, c_u_a_owner),
    (c_emp_a_admin,   c_org_a, 'Adam Admin',    'admin-a@test.local',   'Operations',  c_node_a_root, c_u_a_admin),
    (c_emp_a_manager, c_org_a, 'Mary Manager',  'manager-a@test.local', 'Mkt Lead',    c_node_a_mkt,  c_u_a_admin),
    (c_emp_a_member,  c_org_a, 'Mark Member',   'member-a@test.local',  'Designer',    c_node_a_mkt,  c_u_a_admin),
    (c_emp_a_viewer,  c_org_a, 'Vicky Viewer',  'viewer-a@test.local',  'Auditor',     c_node_a_mkt,  c_u_a_admin),
    (c_emp_b_owner,   c_org_b, 'Bob Owner',     'owner-b@test.local',   'President',   c_node_b_root, c_u_b_owner),
    (c_emp_b_admin,   c_org_b, 'Brian Admin',   'admin-b@test.local',   'VP Ops',      c_node_b_root, c_u_b_admin),
    (c_emp_b_manager, c_org_b, 'Manny Manager', 'manager-b@test.local', 'Eng Lead',    c_node_b_eng,  c_u_b_admin),
    (c_emp_b_member,  c_org_b, 'Mike Member',   'member-b@test.local',  'Dev',         c_node_b_eng,  c_u_b_admin),
    (c_emp_b_viewer,  c_org_b, 'Victor Viewer', 'viewer-b@test.local',  'Spectator',   c_node_b_eng,  c_u_b_admin);

  -- 1.5 Organization Memberships
  INSERT INTO public.organization_members (id, organization_id, user_id, employee_id, role, status) VALUES
    (c_mem_a_owner,   c_org_a, c_u_a_owner,   c_emp_a_owner,   'owner',   'active'),
    (c_mem_a_admin,   c_org_a, c_u_a_admin,   c_emp_a_admin,   'admin',   'active'),
    (c_mem_a_manager, c_org_a, c_u_a_manager, c_emp_a_manager, 'manager', 'active'),
    (c_mem_a_member,  c_org_a, c_u_a_member,  c_emp_a_member,  'member',  'active'),
    (c_mem_a_viewer,  c_org_a, c_u_a_viewer,  c_emp_a_viewer,  'viewer',  'active'),
    (c_mem_b_owner,   c_org_b, c_u_b_owner,   c_emp_b_owner,   'owner',   'active'),
    (c_mem_b_admin,   c_org_b, c_u_b_admin,   c_emp_b_admin,   'admin',   'active'),
    (c_mem_b_manager, c_org_b, c_u_b_manager, c_emp_b_manager, 'manager', 'active'),
    (c_mem_b_member,  c_org_b, c_u_b_member,  c_emp_b_member,  'member',  'active'),
    (c_mem_b_viewer,  c_org_b, c_u_b_viewer,  c_emp_b_viewer,  'viewer',  'active');

  -- 1.6 Member Scopes
  INSERT INTO public.member_scopes (organization_id, membership_id, node_id, granted_by) VALUES
    (c_org_a, c_mem_a_manager, c_node_a_mkt, c_u_a_admin),
    (c_org_a, c_mem_a_member,  c_node_a_m1,  c_u_a_manager),
    (c_org_b, c_mem_b_manager, c_node_b_eng, c_u_b_admin),
    (c_org_b, c_mem_b_member,  c_node_b_1,   c_u_b_manager);

  -- 1.7 Tasks
  INSERT INTO public.tasks (id, organization_id, node_id, primary_assignee_id, title, status, created_by) VALUES
    (c_task_a_1, c_org_a, c_node_a_m1, c_emp_a_member, 'Design Landing Page', 'in_progress', c_u_a_admin),
    (c_task_a_2, c_org_a, c_node_a_s1, c_emp_a_owner,  'Close Q3 Deals',      'todo',        c_u_a_owner),
    (c_task_b_1, c_org_b, c_node_b_1,  c_emp_b_member, 'Build Auth Pipeline', 'in_progress', c_u_b_admin);

  -- 1.8 Sub-resources (Comments, Checklist, Time, Pins, Saved Views, Notifications)
  INSERT INTO public.task_comments (organization_id, task_id, author_user_id, body) VALUES
    (c_org_a, c_task_a_1, c_u_a_member, 'Hero banner mockup attached'),
    (c_org_b, c_task_b_1, c_u_b_member, 'PostgreSQL RLS tests running');

  INSERT INTO public.task_checklist_items (organization_id, task_id, content) VALUES
    (c_org_a, c_task_a_1, 'Mobile breakpoint 390px'),
    (c_org_b, c_task_b_1, 'Composite foreign keys');

  INSERT INTO public.task_time_entries (organization_id, task_id, user_id, minutes) VALUES
    (c_org_a, c_task_a_1, c_u_a_member, 120),
    (c_org_b, c_task_b_1, c_u_b_member, 90);

  INSERT INTO public.user_pins (organization_id, user_id, task_id, position, is_urgent) VALUES
    (c_org_a, c_u_a_member, c_task_a_1, 0, true),
    (c_org_b, c_u_b_member, c_task_b_1, 0, false);

  INSERT INTO public.saved_views (id, organization_id, user_id, name, view_type) VALUES
    (c_sv_a, c_org_a, c_u_a_member, 'Sprint View A', 'kanban'),
    (c_sv_b, c_org_b, c_u_b_member, 'Sprint View B', 'timeline');

  INSERT INTO public.notifications (id, organization_id, user_id, kind, title, body) VALUES
    (c_notif_a, c_org_a, c_u_a_member, 'task.assigned', 'Task Assigned A', 'Assigned in Org A'),
    (c_notif_b, c_org_b, c_u_b_member, 'task.assigned', 'Task Assigned B', 'Assigned in Org B');

  RAISE NOTICE '==================================================';
  RAISE NOTICE 'STARTING WORKTREE X MULTI-TENANT VERIFICATION';
  RAISE NOTICE '==================================================';

  -- ==========================================================================
  -- SECTION 4: ORGANIZATION ISOLATION TESTS
  -- ==========================================================================

  -- Test 01: Member A -> SELECT Company B
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SET ROLE authenticated;
  SELECT count(*) INTO v_cnt FROM public.organizations WHERE id = c_org_b;
  RESET ROLE;
  ASSERT v_cnt = 0, 'T01 FAIL: Member A can read Company B';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T01 PASS: Member A -> SELECT Company B => 0 rows';

  -- Test 02: Member A -> UPDATE Company B
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SET ROLE authenticated;
  v_err_caught := false;
  v_upd := 0;
  BEGIN
    UPDATE public.organizations SET name = 'Hacked Corp' WHERE id = c_org_b;
    GET DIAGNOSTICS v_upd = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  RESET ROLE;
  ASSERT (v_err_caught = true OR v_upd = 0), 'T02 FAIL: Member A updated Company B';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T02 PASS: Member A -> UPDATE Company B => Denied / 0 rows modified';

  -- Test 03: Member A -> DELETE Company B
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SET ROLE authenticated;
  v_err_caught := false;
  BEGIN
    DELETE FROM public.organizations WHERE id = c_org_b;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  RESET ROLE;
  ASSERT v_err_caught = true, 'T03 FAIL: Member A deleted Company B';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T03 PASS: Member A -> DELETE Company B => Denied / Permission Denied';

  -- Test 04: Member A -> INSERT directly into Company B
  v_err_caught := false;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
    SET ROLE authenticated;
    INSERT INTO public.tasks (organization_id, node_id, title) 
    VALUES (c_org_b, c_node_b_1, 'Injected task');
    RESET ROLE;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'T04 FAIL: Member A inserted task into Company B';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T04 PASS: Member A -> INSERT into Company B => Permission Denied';

  -- Test 05: Member B -> SELECT Company A
  PERFORM set_config('request.jwt.claim.sub', c_u_b_member::text, true);
  SET ROLE authenticated;
  SELECT count(*) INTO v_cnt FROM public.organizations WHERE id = c_org_a;
  RESET ROLE;
  ASSERT v_cnt = 0, 'T05 FAIL: Member B can read Company A';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T05 PASS: Member B -> SELECT Company A => 0 rows';

  -- Test 06: Member B -> UPDATE Company A
  PERFORM set_config('request.jwt.claim.sub', c_u_b_member::text, true);
  SET ROLE authenticated;
  v_err_caught := false;
  v_upd := 0;
  BEGIN
    UPDATE public.organizations SET name = 'Defaced by B' WHERE id = c_org_a;
    GET DIAGNOSTICS v_upd = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  RESET ROLE;
  ASSERT (v_err_caught = true OR v_upd = 0), 'T06 FAIL: Member B updated Company A';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T06 PASS: Member B -> UPDATE Company A => Denied / 0 rows modified';

  -- Test 07: Member B -> DELETE Company A
  PERFORM set_config('request.jwt.claim.sub', c_u_b_member::text, true);
  SET ROLE authenticated;
  v_err_caught := false;
  BEGIN
    DELETE FROM public.organizations WHERE id = c_org_a;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  RESET ROLE;
  ASSERT v_err_caught = true, 'T07 FAIL: Member B deleted Company A';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T07 PASS: Member B -> DELETE Company A => Denied / Permission Denied';

  -- ==========================================================================
  -- SECTION 5: EMPLOYEE & MEMBERSHIP ISOLATION
  -- ==========================================================================

  -- Test 08: Member A -> SELECT Company B employees
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SET ROLE authenticated;
  SELECT count(*) INTO v_cnt FROM public.employees WHERE organization_id = c_org_b;
  RESET ROLE;
  ASSERT v_cnt = 0, 'T08 FAIL: Member A read Company B employees';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T08 PASS: Member A -> SELECT Company B employees => 0 rows';

  -- Test 09: Member A -> Direct UUID query for Employee B
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SET ROLE authenticated;
  SELECT count(*) INTO v_cnt FROM public.employees WHERE id = c_emp_b_member;
  RESET ROLE;
  ASSERT v_cnt = 0, 'T09 FAIL: Member A read Employee B by direct UUID';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T09 PASS: Member A -> Direct UUID query Employee B => 0 rows';

  -- Test 10: Member A -> UPDATE Employee B
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SET ROLE authenticated;
  v_err_caught := false;
  v_upd := 0;
  BEGIN
    UPDATE public.employees SET job_title = 'Fired' WHERE id = c_emp_b_member;
    GET DIAGNOSTICS v_upd = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  RESET ROLE;
  ASSERT (v_err_caught = true OR v_upd = 0), 'T10 FAIL: Member A updated Employee B';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T10 PASS: Member A -> UPDATE Employee B => Denied / 0 rows modified';

  -- Test 11: Member A -> SELECT Company B organization_members
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SET ROLE authenticated;
  SELECT count(*) INTO v_cnt FROM public.organization_members WHERE organization_id = c_org_b;
  RESET ROLE;
  ASSERT v_cnt = 0, 'T11 FAIL: Member A read Company B memberships';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T11 PASS: Member A -> SELECT Company B memberships => 0 rows';

  -- Test 12: Member A -> SELECT Company B member_scopes
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SET ROLE authenticated;
  SELECT count(*) INTO v_cnt FROM public.member_scopes WHERE organization_id = c_org_b;
  RESET ROLE;
  ASSERT v_cnt = 0, 'T12 FAIL: Member A read Company B member scopes';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T12 PASS: Member A -> SELECT Company B member scopes => 0 rows';

  -- ==========================================================================
  -- SECTION 6: ORGANIZATION TREE ISOLATION
  -- ==========================================================================

  -- Test 13: Member A -> SELECT Company B nodes
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SET ROLE authenticated;
  SELECT count(*) INTO v_cnt FROM public.organization_nodes WHERE organization_id = c_org_b;
  RESET ROLE;
  ASSERT v_cnt = 0, 'T13 FAIL: Member A read Company B nodes';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T13 PASS: Member A -> SELECT Company B nodes => 0 rows';

  -- Test 14: Member A -> Direct UUID query for Node B
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SET ROLE authenticated;
  SELECT count(*) INTO v_cnt FROM public.organization_nodes WHERE id = c_node_b_eng;
  RESET ROLE;
  ASSERT v_cnt = 0, 'T14 FAIL: Member A read Node B by direct UUID';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T14 PASS: Member A -> Direct UUID query Node B => 0 rows';

  -- Test 15: Member A -> SELECT organization_node_closure of Company B
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SET ROLE authenticated;
  SELECT count(*) INTO v_cnt FROM public.organization_node_closure WHERE organization_id = c_org_b;
  RESET ROLE;
  ASSERT v_cnt = 0, 'T15 FAIL: Member A read Company B closure tree';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T15 PASS: Member A -> SELECT Company B closure tree => 0 rows';

  -- Test 16: Member B -> Direct UUID query for Node A
  PERFORM set_config('request.jwt.claim.sub', c_u_b_member::text, true);
  SET ROLE authenticated;
  SELECT count(*) INTO v_cnt FROM public.organization_nodes WHERE id = c_node_a_mkt;
  RESET ROLE;
  ASSERT v_cnt = 0, 'T16 FAIL: Member B read Node A by direct UUID';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T16 PASS: Member B -> Direct UUID query Node A => 0 rows';

  -- ==========================================================================
  -- SECTION 7: TASK & SUB-RESOURCE ISOLATION
  -- ==========================================================================

  -- Test 17: Member A -> SELECT Task B1 from tasks table
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SET ROLE authenticated;
  SELECT count(*) INTO v_cnt FROM public.tasks WHERE id = c_task_b_1;
  RESET ROLE;
  ASSERT v_cnt = 0, 'T17 FAIL: Member A read Task B1 from tasks';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T17 PASS: Member A -> SELECT Task B1 (tasks) => 0 rows';

  -- Test 18: Member A -> SELECT Task B1 from task_rollups view
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SET ROLE authenticated;
  SELECT count(*) INTO v_cnt FROM public.task_rollups WHERE id = c_task_b_1;
  RESET ROLE;
  ASSERT v_cnt = 0, 'T18 FAIL: Member A read Task B1 from task_rollups view';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T18 PASS: Member A -> SELECT Task B1 (task_rollups) => 0 rows';

  -- Test 19: Member A -> UPDATE Task B1
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SET ROLE authenticated;
  v_err_caught := false;
  v_upd := 0;
  BEGIN
    UPDATE public.tasks SET title = 'Defaced' WHERE id = c_task_b_1;
    GET DIAGNOSTICS v_upd = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  RESET ROLE;
  ASSERT (v_err_caught = true OR v_upd = 0), 'T19 FAIL: Member A updated Task B1';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T19 PASS: Member A -> UPDATE Task B1 => Denied / 0 rows modified';

  -- Test 20: Member A -> DELETE Task B1
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SET ROLE authenticated;
  v_err_caught := false;
  v_upd := 0;
  BEGIN
    DELETE FROM public.tasks WHERE id = c_task_b_1;
    GET DIAGNOSTICS v_upd = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  RESET ROLE;
  ASSERT (v_err_caught = true OR v_upd = 0), 'T20 FAIL: Member A deleted Task B1';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T20 PASS: Member A -> DELETE Task B1 => Denied / 0 rows modified';

  -- Test 21: Member A -> INSERT comment on Task B1
  v_err_caught := false;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
    SET ROLE authenticated;
    INSERT INTO public.task_comments (organization_id, task_id, author_user_id, body)
    VALUES (c_org_b, c_task_b_1, c_u_a_member, 'Cross-tenant comment attempt');
    RESET ROLE;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'T21 FAIL: Member A commented on Task B1';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T21 PASS: Member A -> COMMENT on Task B1 => Permission Denied';

  -- Test 22: Member A -> INSERT checklist item on Task B1
  v_err_caught := false;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
    SET ROLE authenticated;
    INSERT INTO public.task_checklist_items (organization_id, task_id, content)
    VALUES (c_org_b, c_task_b_1, 'Illicit checklist item');
    RESET ROLE;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'T22 FAIL: Member A added checklist item to Task B1';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T22 PASS: Member A -> CHECKLIST on Task B1 => Permission Denied';

  -- Test 23: Member A -> INSERT time entry on Task B1
  v_err_caught := false;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
    SET ROLE authenticated;
    INSERT INTO public.task_time_entries (organization_id, task_id, user_id, minutes)
    VALUES (c_org_b, c_task_b_1, c_u_a_member, 60);
    RESET ROLE;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'T23 FAIL: Member A added time entry to Task B1';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T23 PASS: Member A -> TIME ENTRY on Task B1 => Permission Denied';

  -- Test 24: Member A -> PIN Task B1
  v_err_caught := false;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
    SET ROLE authenticated;
    INSERT INTO public.user_pins (organization_id, user_id, task_id)
    VALUES (c_org_b, c_u_a_member, c_task_b_1);
    RESET ROLE;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'T24 FAIL: Member A pinned Task B1';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T24 PASS: Member A -> PIN Task B1 => Permission Denied';

  -- Test 25: Member A -> SELECT Saved Views of Company B
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SET ROLE authenticated;
  SELECT count(*) INTO v_cnt FROM public.saved_views WHERE organization_id = c_org_b;
  RESET ROLE;
  ASSERT v_cnt = 0, 'T25 FAIL: Member A read Company B saved views';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T25 PASS: Member A -> SELECT Company B saved views => 0 rows';

  -- Test 26: Member A -> INSERT Saved View into Company B
  v_err_caught := false;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
    SET ROLE authenticated;
    INSERT INTO public.saved_views (organization_id, user_id, name, view_type)
    VALUES (c_org_b, c_u_a_member, 'Injected View', 'list');
    RESET ROLE;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'T26 FAIL: Member A created saved view in Company B';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T26 PASS: Member A -> INSERT saved view into Company B => Permission Denied';

  -- Test 27: Member A -> SELECT Notifications of Company B
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SET ROLE authenticated;
  SELECT count(*) INTO v_cnt FROM public.notifications WHERE organization_id = c_org_b;
  RESET ROLE;
  ASSERT v_cnt = 0, 'T27 FAIL: Member A read Company B notifications';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T27 PASS: Member A -> SELECT Company B notifications => 0 rows';

  -- Test 28: Member A -> UPDATE Notification of Company B
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SET ROLE authenticated;
  v_err_caught := false;
  v_upd := 0;
  BEGIN
    UPDATE public.notifications SET read_at = now() WHERE id = c_notif_b;
    GET DIAGNOSTICS v_upd = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  RESET ROLE;
  ASSERT (v_err_caught = true OR v_upd = 0), 'T28 FAIL: Member A updated notification of Company B';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T28 PASS: Member A -> UPDATE notification of Company B => Denied / 0 rows modified';

  -- Test 29: Member B -> SELECT Task A1
  PERFORM set_config('request.jwt.claim.sub', c_u_b_member::text, true);
  SET ROLE authenticated;
  SELECT count(*) INTO v_cnt FROM public.tasks WHERE id = c_task_a_1;
  RESET ROLE;
  ASSERT v_cnt = 0, 'T29 FAIL: Member B read Task A1';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T29 PASS: Member B -> SELECT Task A1 => 0 rows';

  -- Test 30: Member B -> UPDATE Task A1
  PERFORM set_config('request.jwt.claim.sub', c_u_b_member::text, true);
  SET ROLE authenticated;
  v_err_caught := false;
  v_upd := 0;
  BEGIN
    UPDATE public.tasks SET title = 'Defaced by B' WHERE id = c_task_a_1;
    GET DIAGNOSTICS v_upd = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  RESET ROLE;
  ASSERT (v_err_caught = true OR v_upd = 0), 'T30 FAIL: Member B updated Task A1';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T30 PASS: Member B -> UPDATE Task A1 => Denied / 0 rows modified';

  -- ==========================================================================
  -- SECTION 8: ROLE MATRIX IN SAME COMPANY
  -- ==========================================================================

  -- Test 31: Viewer A -> INSERT task in Org A => MUST FAIL
  v_err_caught := false;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', c_u_a_viewer::text, true);
    SET ROLE authenticated;
    INSERT INTO public.tasks (organization_id, node_id, title)
    VALUES (c_org_a, c_node_a_m1, 'Viewer illicit task');
    RESET ROLE;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'T31 FAIL: Viewer A was able to insert task';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T31 PASS: Viewer A -> INSERT Task => Permission Denied';

  -- Test 32: Viewer A -> UPDATE task in Org A => MUST FAIL (0 rows or error)
  PERFORM set_config('request.jwt.claim.sub', c_u_a_viewer::text, true);
  SET ROLE authenticated;
  v_err_caught := false;
  v_upd := 0;
  BEGIN
    UPDATE public.tasks SET title = 'Viewer modified' WHERE id = c_task_a_1;
    GET DIAGNOSTICS v_upd = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  RESET ROLE;
  ASSERT (v_err_caught = true OR v_upd = 0), 'T32 FAIL: Viewer A was able to update task';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T32 PASS: Viewer A -> UPDATE Task => Denied / 0 rows modified';

  -- Test 33: Viewer A -> DELETE task in Org A => MUST FAIL (0 rows or error)
  PERFORM set_config('request.jwt.claim.sub', c_u_a_viewer::text, true);
  SET ROLE authenticated;
  v_err_caught := false;
  v_upd := 0;
  BEGIN
    DELETE FROM public.tasks WHERE id = c_task_a_1;
    GET DIAGNOSTICS v_upd = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  RESET ROLE;
  ASSERT (v_err_caught = true OR v_upd = 0), 'T33 FAIL: Viewer A was able to delete task';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T33 PASS: Viewer A -> DELETE Task => Denied / 0 rows modified';

  -- Test 34: Member A -> DELETE task in Org A => MUST FAIL (only owner/admin can delete)
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SET ROLE authenticated;
  v_err_caught := false;
  v_upd := 0;
  BEGIN
    DELETE FROM public.tasks WHERE id = c_task_a_1;
    GET DIAGNOSTICS v_upd = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  RESET ROLE;
  ASSERT (v_err_caught = true OR v_upd = 0), 'T34 FAIL: Member A deleted task without owner/admin role';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T34 PASS: Member A -> DELETE Task => Denied (Owner/Admin required)';

  -- Test 35: Admin A -> UPDATE task in Org A => ALLOWED
  PERFORM set_config('request.jwt.claim.sub', c_u_a_admin::text, true);
  SET ROLE authenticated;
  UPDATE public.tasks SET title = 'Landing Page Rev 2' WHERE id = c_task_a_1;
  GET DIAGNOSTICS v_upd = ROW_COUNT;
  RESET ROLE;
  ASSERT v_upd = 1, 'T35 FAIL: Admin A cannot update task in same org';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T35 PASS: Admin A -> UPDATE Task => 1 row updated';

  -- Test 36: Owner A -> UPDATE task in Org A => ALLOWED
  PERFORM set_config('request.jwt.claim.sub', c_u_a_owner::text, true);
  SET ROLE authenticated;
  UPDATE public.tasks SET title = 'Landing Page Final' WHERE id = c_task_a_1;
  GET DIAGNOSTICS v_upd = ROW_COUNT;
  RESET ROLE;
  ASSERT v_upd = 1, 'T36 FAIL: Owner A cannot update task in own org';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T36 PASS: Owner A -> UPDATE Task => 1 row updated';

  -- ==========================================================================
  -- SECTION 9: MEMBER SCOPES
  -- ==========================================================================

  -- Test 37: Manager A (scoped to Marketing) -> SELECT task under Marketing => ALLOWED
  PERFORM set_config('request.jwt.claim.sub', c_u_a_manager::text, true);
  SET ROLE authenticated;
  SELECT count(*) INTO v_cnt FROM public.tasks WHERE id = c_task_a_1;
  RESET ROLE;
  ASSERT v_cnt = 1, 'T37 FAIL: Manager A cannot read task in scoped node';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T37 PASS: Manager A (scoped to Marketing) -> SELECT task in Marketing => 1 row';

  -- Test 38: Manager A (scoped to Marketing) -> SELECT task under Sales => DENIED (0 rows)
  PERFORM set_config('request.jwt.claim.sub', c_u_a_manager::text, true);
  SET ROLE authenticated;
  SELECT count(*) INTO v_cnt FROM public.tasks WHERE id = c_task_a_2;
  RESET ROLE;
  ASSERT v_cnt = 0, 'T38 FAIL: Manager A leaked task from out-of-scope Sales node';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T38 PASS: Manager A -> SELECT task in Sales (out of scope) => 0 rows';

  -- Test 39: Manager A -> Direct UUID query for Sales Project Node => DENIED (0 rows)
  PERFORM set_config('request.jwt.claim.sub', c_u_a_manager::text, true);
  SET ROLE authenticated;
  SELECT count(*) INTO v_cnt FROM public.organization_nodes WHERE id = c_node_a_s1;
  RESET ROLE;
  ASSERT v_cnt = 0, 'T39 FAIL: Manager A leaked out-of-scope Sales node';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T39 PASS: Manager A -> Direct UUID query Sales project => 0 rows';

  -- Test 40: Manager A -> UPDATE task under Sales => DENIED (0 rows)
  PERFORM set_config('request.jwt.claim.sub', c_u_a_manager::text, true);
  SET ROLE authenticated;
  v_err_caught := false;
  v_upd := 0;
  BEGIN
    UPDATE public.tasks SET title = 'Hacked Sales' WHERE id = c_task_a_2;
    GET DIAGNOSTICS v_upd = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  RESET ROLE;
  ASSERT (v_err_caught = true OR v_upd = 0), 'T40 FAIL: Manager A updated out-of-scope task in Sales';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T40 PASS: Manager A -> UPDATE task in Sales => Denied / 0 rows modified';

  -- ==========================================================================
  -- SECTION 10: CROSS-TENANT FOREIGN KEY & CONSTRAINT ATTACKS
  -- (Tested directly in database engine to verify composite constraints & triggers)
  -- ==========================================================================

  -- Test 41: Task Org A + Node Org B
  v_err_caught := false;
  BEGIN
    INSERT INTO public.tasks (organization_id, node_id, title, created_by)
    VALUES (c_org_a, c_node_b_1, 'Cross-tenant task-node attack', c_u_a_owner);
  EXCEPTION WHEN foreign_key_violation OR raise_exception THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'T41 FAIL: DB allowed Task in Org A with Node in Org B';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T41 PASS: Cross-tenant Task A + Node B => Blocked by Constraint / Scope Trigger';

  -- Test 42: Task Org A + Assignee Org B
  v_err_caught := false;
  BEGIN
    INSERT INTO public.tasks (organization_id, node_id, primary_assignee_id, title, created_by)
    VALUES (c_org_a, c_node_a_m1, c_emp_b_member, 'Cross-tenant assignee attack', c_u_a_owner);
  EXCEPTION WHEN foreign_key_violation OR raise_exception THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'T42 FAIL: DB allowed Task in Org A with Assignee in Org B';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T42 PASS: Cross-tenant Task A + Assignee B => Blocked by Constraint / Scope Trigger';

  -- Test 43: Comment Org A + Task Org B
  v_err_caught := false;
  BEGIN
    INSERT INTO public.task_comments (organization_id, task_id, author_user_id, body)
    VALUES (c_org_a, c_task_b_1, c_u_a_owner, 'Cross-tenant comment attack');
  EXCEPTION WHEN foreign_key_violation OR raise_exception THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'T43 FAIL: DB allowed Comment in Org A with Task in Org B';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T43 PASS: Cross-tenant Comment A + Task B => Blocked by Constraint / Scope Trigger';

  -- Test 44: Checklist Org A + Task Org B
  v_err_caught := false;
  BEGIN
    INSERT INTO public.task_checklist_items (organization_id, task_id, content)
    VALUES (c_org_a, c_task_b_1, 'Cross-tenant checklist attack');
  EXCEPTION WHEN foreign_key_violation OR raise_exception THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'T44 FAIL: DB allowed Checklist in Org A with Task in Org B';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T44 PASS: Cross-tenant Checklist A + Task B => Blocked by Constraint / Scope Trigger';

  -- Test 45: Time Entry Org A + Task Org B
  v_err_caught := false;
  BEGIN
    INSERT INTO public.task_time_entries (organization_id, task_id, user_id, minutes)
    VALUES (c_org_a, c_task_b_1, c_u_a_owner, 60);
  EXCEPTION WHEN foreign_key_violation OR raise_exception THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'T45 FAIL: DB allowed Time Entry in Org A with Task in Org B';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T45 PASS: Cross-tenant Time Entry A + Task B => Blocked by Constraint / Scope Trigger';

  -- Test 46: Pin Org A + Task Org B
  v_err_caught := false;
  BEGIN
    INSERT INTO public.user_pins (organization_id, user_id, task_id)
    VALUES (c_org_a, c_u_a_owner, c_task_b_1);
  EXCEPTION WHEN foreign_key_violation OR raise_exception THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'T46 FAIL: DB allowed Pin in Org A with Task in Org B';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T46 PASS: Cross-tenant Pin A + Task B => Blocked by Constraint / Scope Trigger';

  -- Test 47: Pin Org A + Node Org B
  v_err_caught := false;
  BEGIN
    INSERT INTO public.user_pins (organization_id, user_id, node_id)
    VALUES (c_org_a, c_u_a_owner, c_node_b_eng);
  EXCEPTION WHEN foreign_key_violation OR raise_exception THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'T47 FAIL: DB allowed Pin in Org A with Node in Org B';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T47 PASS: Cross-tenant Pin A + Node B => Blocked by Constraint / Scope Trigger';

  -- Test 48: Dependency Task A -> Task B
  v_err_caught := false;
  BEGIN
    INSERT INTO public.task_dependencies (organization_id, task_id, depends_on_task_id)
    VALUES (c_org_a, c_task_a_1, c_task_b_1);
  EXCEPTION WHEN foreign_key_violation OR raise_exception THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'T48 FAIL: DB allowed Task Dependency linking Task A to Task B';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T48 PASS: Cross-tenant Task Dependency A -> B => Blocked by Constraint / Scope Trigger';

  -- Test 49: Attachment Org A + Task Org B
  v_err_caught := false;
  BEGIN
    INSERT INTO public.task_attachments (organization_id, task_id, storage_path, original_name, uploaded_by)
    VALUES (c_org_a, c_task_b_1, '11111111-1111-1111-1111-111111111111/b4000000-0000-0000-0000-000000000001/doc.pdf', 'doc.pdf', c_u_a_owner);
  EXCEPTION WHEN foreign_key_violation OR raise_exception THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'T49 FAIL: DB allowed Attachment in Org A for Task in Org B';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T49 PASS: Cross-tenant Attachment A + Task B => Blocked by Constraint / Scope Trigger';

  -- ==========================================================================
  -- SECTION 11: RPC FUNCTION SECURITY
  -- ==========================================================================

  -- Test 50: create_organization with no auth -> MUST FAIL
  v_err_caught := false;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM public.create_organization('Anon Org', 'anon-org');
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'T50 FAIL: Unauthenticated user created organization';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T50 PASS: create_organization without auth => Permission Denied';

  -- Test 51: create_invitation by Member A -> MUST FAIL
  v_err_caught := false;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
    PERFORM public.create_invitation(c_org_a, 'new@test.local', 'New Guy', c_node_a_m1, 'member');
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'T51 FAIL: Member A created invitation';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T51 PASS: create_invitation by Member A => Admin Permission Required';

  -- Test 52: create_invitation by Admin A for Org B -> MUST FAIL
  v_err_caught := false;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', c_u_a_admin::text, true);
    PERFORM public.create_invitation(c_org_b, 'new@test.local', 'New Guy', c_node_b_eng, 'member');
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'T52 FAIL: Admin A created invitation for Org B';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T52 PASS: create_invitation by Admin A for Org B => Permission Denied';

  -- Test 53: create_invitation by Admin A with role 'owner' -> MUST FAIL
  v_err_caught := false;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', c_u_a_admin::text, true);
    PERFORM public.create_invitation(c_org_a, 'new@test.local', 'New Guy', c_node_a_m1, 'owner');
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'T53 FAIL: Admin A invited another owner';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T53 PASS: create_invitation with role owner => Blocked (Owner transferred separately)';

  -- Test 54: accept_invitation with invalid token -> MUST FAIL
  v_err_caught := false;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
    PERFORM public.accept_invitation('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'T54 FAIL: User accepted invalid invitation token';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T54 PASS: accept_invitation with invalid token => Invitation not found';

  -- Test 55: set_member_role_and_scopes: Member A tries to escalate to Admin -> MUST FAIL
  v_err_caught := false;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
    PERFORM public.set_member_role_and_scopes(c_org_a, c_mem_a_member, 'admin', array[c_node_a_root]);
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'T55 FAIL: Member A escalated role to admin';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T55 PASS: Member A self-escalation to Admin => Permission Denied';

  -- Test 56: set_member_role_and_scopes: Admin A modifies member in Org B -> MUST FAIL
  v_err_caught := false;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', c_u_a_admin::text, true);
    PERFORM public.set_member_role_and_scopes(c_org_b, c_mem_b_member, 'viewer', array[c_node_b_root]);
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'T56 FAIL: Admin A modified role of member in Org B';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T56 PASS: Admin A modifies Org B member role => Permission Denied';

  -- ==========================================================================
  -- SECTION 12: CLOSURE TREE & TASK ROLLUP INTEGRITY
  -- ==========================================================================

  -- Test 57: Closure Tree has zero cross-tenant ancestor/descendant pairs
  SELECT count(*) INTO v_cnt 
  FROM public.organization_node_closure 
  WHERE organization_id = c_org_a 
    AND (ancestor_id IN (c_node_b_root, c_node_b_eng, c_node_b_1) 
         OR descendant_id IN (c_node_b_root, c_node_b_eng, c_node_b_1));
  ASSERT v_cnt = 0, 'T57 FAIL: Cross-tenant node in closure tree for Org A';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T57 PASS: Closure Tree Cross-Tenant Check => 0 cross-tenant links';

  -- Test 58: refresh_node_closure maintains zero cross-tenant links
  PERFORM public.refresh_node_closure(c_org_a);
  SELECT count(*) INTO v_cnt 
  FROM public.organization_node_closure 
  WHERE organization_id = c_org_a 
    AND (ancestor_id IN (c_node_b_root, c_node_b_eng, c_node_b_1) 
         OR descendant_id IN (c_node_b_root, c_node_b_eng, c_node_b_1));
  ASSERT v_cnt = 0, 'T58 FAIL: refresh_node_closure created cross-tenant links';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T58 PASS: refresh_node_closure Isolation => 0 cross-tenant links';

  -- Test 59: task_rollups unfiltered query does not leak Company B tasks to Member A
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SET ROLE authenticated;
  SELECT count(*) INTO v_cnt FROM public.task_rollups WHERE organization_id = c_org_b;
  RESET ROLE;
  ASSERT v_cnt = 0, 'T59 FAIL: task_rollups leaked Company B tasks to Member A';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T59 PASS: task_rollups Unfiltered View Query => 0 rows leaked';

  -- ==========================================================================
  -- SECTION 13: STORAGE AUTHORIZATION POLICY TESTS (Function storage_task_allowed)
  -- ==========================================================================

  -- Test 60: Storage Read: Member A on Org A Task A1 -> TRUE
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SELECT public.storage_task_allowed(c_org_a::text || '/' || c_task_a_1::text || '/doc.pdf', false) INTO v_storage_res;
  ASSERT v_storage_res = true, 'T60 FAIL: Member A cannot download file from Task A1';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T60 PASS: Storage Read: Member A on Org A Task A1 => ALLOWED (true)';

  -- Test 61: Storage Read: Member A on Org B Task B1 -> FALSE
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SELECT public.storage_task_allowed(c_org_b::text || '/' || c_task_b_1::text || '/doc.pdf', false) INTO v_storage_res;
  ASSERT v_storage_res = false, 'T61 FAIL: Member A downloaded file from Task B1';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T61 PASS: Storage Read: Member A on Org B Task B1 => DENIED (false)';

  -- Test 62: Storage Write: Member A on Org B Task B1 -> FALSE
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SELECT public.storage_task_allowed(c_org_b::text || '/' || c_task_b_1::text || '/doc.pdf', true) INTO v_storage_res;
  ASSERT v_storage_res = false, 'T62 FAIL: Member A uploaded file to Task B1';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T62 PASS: Storage Write: Member A on Org B Task B1 => DENIED (false)';

  -- Test 63: Storage Path Spoofing: Member A with path org_a / task_b -> FALSE
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SELECT public.storage_task_allowed(c_org_a::text || '/' || c_task_b_1::text || '/doc.pdf', false) INTO v_storage_res;
  ASSERT v_storage_res = false, 'T63 FAIL: Path spoofing bypassed storage policy';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T63 PASS: Storage Path Spoofing: Org A prefix with Task B UUID => DENIED (false)';

  -- Test 64: Storage Malformed Path -> FALSE
  PERFORM set_config('request.jwt.claim.sub', c_u_a_member::text, true);
  SELECT public.storage_task_allowed('invalid_path', false) INTO v_storage_res;
  ASSERT v_storage_res = false, 'T64 FAIL: Malformed path was allowed';
  v_passed := v_passed + 1;
  RAISE NOTICE 'T64 PASS: Storage Malformed Path => DENIED (false)';

  -- ==========================================================================
  -- CLEANUP TEST FIXTURES
  -- ==========================================================================
  DELETE FROM public.saved_views WHERE organization_id IN (c_org_a, c_org_b);
  DELETE FROM public.tasks WHERE organization_id IN (c_org_a, c_org_b);
  DELETE FROM public.activity_logs WHERE organization_id IN (c_org_a, c_org_b);
  DELETE FROM public.notifications WHERE organization_id IN (c_org_a, c_org_b);
  DELETE FROM public.organizations WHERE id IN (c_org_a, c_org_b);
  DELETE FROM auth.users WHERE id IN (
    c_u_a_owner, c_u_a_admin, c_u_a_manager, c_u_a_member, c_u_a_viewer,
    c_u_b_owner, c_u_b_admin, c_u_b_manager, c_u_b_member, c_u_b_viewer
  );

  RAISE NOTICE '==================================================';
  RAISE NOTICE 'MULTI-TENANT TEST SUITE COMPLETED SUCCESSFULLY!';
  RAISE NOTICE 'ALL 64 SECURITY TESTS PASSED: % / 64', v_passed;
  RAISE NOTICE 'TESTS FAILED: 0';
  RAISE NOTICE '==================================================';

END $suite$;
