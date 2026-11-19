BEGIN;

DO $$
DECLARE
  sender uuid := gen_random_uuid();
  teammate uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  team_org uuid := gen_random_uuid();
  other_org uuid := gen_random_uuid();
  group_id uuid := gen_random_uuid();
  other_group uuid := gen_random_uuid();
  mentions jsonb;
  result public.chat_messages;
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (sender, sender || '@mention.test'),
    (teammate, teammate || '@mention.test'),
    (outsider, outsider || '@mention.test');
  INSERT INTO public.organizations (id, name, slug, created_by) VALUES
    (team_org, 'Chat test', 'mention-' || team_org, sender),
    (other_org, 'Other tenant', 'mention-' || other_org, outsider);
  INSERT INTO public.organization_members (organization_id, user_id, role, status) VALUES
    (team_org, sender, 'owner', 'active'),
    (team_org, teammate, 'member', 'active'),
    (other_org, outsider, 'owner', 'active')
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  INSERT INTO public.chat_conversations (id, organization_id, type, title) VALUES
    (group_id, team_org, 'group', 'QA'),
    (other_group, other_org, 'group', 'Other QA');
  INSERT INTO public.chat_participants (organization_id, conversation_id, membership_id, user_id)
    SELECT organization_id, CASE WHEN organization_id = team_org THEN group_id ELSE other_group END, id, user_id
      FROM public.organization_members WHERE organization_id IN (team_org, other_org);

  PERFORM set_config('request.jwt.claim.sub', sender::text, true);
  SET LOCAL ROLE authenticated;
  mentions := jsonb_build_array(
    jsonb_build_object('userId', teammate, 'start', 2, 'length', 2),
    jsonb_build_object('userId', teammate, 'start', 5, 'length', 2)
  );
  result := public.send_chat_message_with_mentions(team_org, group_id, 'test-mentions', '😊 @A @A', mentions);
  ASSERT result.metadata -> 'mentions' = mentions;
  ASSERT (public.send_chat_message_with_mentions(team_org, group_id, 'test-mentions', '😊 @A @A', mentions)).id = result.id;
  BEGIN
    PERFORM public.send_chat_message_with_mentions(
      team_org, group_id, 'invalid-target', '@A', jsonb_build_array(jsonb_build_object('userId', outsider, 'start', 0, 'length', 2))
    );
    RAISE EXCEPTION 'Expected outside recipient to be rejected';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'VALIDATION_ERROR:%', SQLERRM;
  END;
  BEGIN
    PERFORM public.send_chat_message_with_mentions(other_org, other_group, 'invalid-tenant', '😊 @A @A', mentions);
    RAISE EXCEPTION 'Expected cross-tenant group to be rejected';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM = 'FORBIDDEN', SQLERRM;
  END;
  ASSERT NOT EXISTS (SELECT 1 FROM public.notifications WHERE kind = 'chat_mention' AND organization_id = team_org);
  PERFORM set_config('request.jwt.claim.sub', teammate::text, true);
  ASSERT (SELECT count(*) FROM public.notifications WHERE kind = 'chat_mention' AND organization_id = team_org) = 1;
  RESET ROLE;
  ASSERT NOT EXISTS (SELECT 1 FROM public.chat_messages WHERE client_message_id IN ('invalid-target', 'invalid-tenant'));
END;
$$;

ROLLBACK;
