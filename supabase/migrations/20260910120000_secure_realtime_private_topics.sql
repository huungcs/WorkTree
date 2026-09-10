-- Migration: 20260910120000_secure_realtime_private_topics.sql
-- Purpose: Enforce channel-level authorization policies on realtime.messages
-- to ensure strict tenant and task scope isolation on private channels (protecting DELETE, UPDATE, and INSERT events).

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "realtime_messages_select" ON realtime.messages;
CREATE POLICY "realtime_messages_select"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (
    topic LIKE 'org:%:workspace'
    AND public.is_org_member((split_part(topic, ':', 2))::uuid)
  )
  OR
  (
    topic LIKE 'task:%:%'
    AND public.can_read_task_id((split_part(topic, ':', 2))::uuid)
  )
);

DROP POLICY IF EXISTS "realtime_messages_insert" ON realtime.messages;
CREATE POLICY "realtime_messages_insert"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (
    topic LIKE 'org:%:workspace'
    AND public.is_org_member((split_part(topic, ':', 2))::uuid)
  )
  OR
  (
    topic LIKE 'task:%:%'
    AND public.can_read_task_id((split_part(topic, ':', 2))::uuid)
  )
);

GRANT SELECT, INSERT ON realtime.messages TO authenticated;
