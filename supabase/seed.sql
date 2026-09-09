-- WorkTree X — Development Seed Data
-- Creates baseline demonstration organizations, nodes, and tasks

-- 0. Ensure seed owner user exists in auth.users
INSERT INTO auth.users (id, email)
VALUES ('00000000-0000-0000-0000-000000000000', 'owner@fourgroup.vn')
ON CONFLICT (id) DO NOTHING;

-- 1. Demo Organization: Four Group
INSERT INTO organizations (id, name, slug, timezone, created_by)
VALUES ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Four Group', 'four-group', 'Asia/Ho_Chi_Minh', '00000000-0000-0000-0000-000000000000')
ON CONFLICT (id) DO NOTHING;

-- 2. Nodes under Four Group
INSERT INTO organization_nodes (id, organization_id, parent_id, name, type, sort_order) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', NULL, 'Toàn công ty', 'company', 1),
  ('a2222222-2222-2222-2222-222222222222', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'a1111111-1111-1111-1111-111111111111', 'Phòng Vận hành', 'department', 2),
  ('a3333333-3333-3333-3333-333333333333', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'a1111111-1111-1111-1111-111111111111', 'Khối Công nghệ', 'department', 3)
ON CONFLICT (id) DO NOTHING;
