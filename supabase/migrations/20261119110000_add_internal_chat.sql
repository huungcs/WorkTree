-- Migration: 20261119110000_add_internal_chat.sql
-- Purpose: Multi-tenant internal Chat backend (chat_conversations, chat_participants, chat_messages),
-- atomic direct/group RPCs, idempotent clientMessageId messaging, strict non-recursive RLS,
-- and scoped Realtime policies.

BEGIN;

-- 1. Tables
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('direct', 'group')),
  direct_key text,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  pinned_message_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  CONSTRAINT chat_conversations_title_len CHECK (char_length(title) <= 120),
  CONSTRAINT chat_conversations_desc_len CHECK (char_length(description) <= 500),
  CONSTRAINT chat_conversations_direct_key_check CHECK (
    (type = 'direct' AND direct_key IS NOT NULL)
    OR (type = 'group' AND direct_key IS NULL AND char_length(btrim(title)) BETWEEN 1 AND 120)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_conversations_direct_uidx
  ON public.chat_conversations (organization_id, direct_key)
  WHERE type = 'direct' AND direct_key IS NOT NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS chat_conversations_org_updated_idx
  ON public.chat_conversations (organization_id, updated_at DESC)
  WHERE archived_at IS NULL;

DROP TRIGGER IF EXISTS chat_conversations_set_updated_at ON public.chat_conversations;
CREATE TRIGGER chat_conversations_set_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.chat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  user_id uuid NOT NULL,
  group_role text NOT NULL DEFAULT 'member' CHECK (group_role IN ('owner', 'admin', 'member')),
  pinned boolean NOT NULL DEFAULT false,
  muted boolean NOT NULL DEFAULT false,
  last_read_message_id uuid,
  last_read_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id),
  CONSTRAINT chat_participants_conv_fk
    FOREIGN KEY (organization_id, conversation_id)
    REFERENCES public.chat_conversations(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT chat_participants_member_id_fk
    FOREIGN KEY (organization_id, membership_id)
    REFERENCES public.organization_members(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT chat_participants_member_user_fk
    FOREIGN KEY (organization_id, user_id)
    REFERENCES public.organization_members(organization_id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS chat_participants_user_active_idx
  ON public.chat_participants (user_id, organization_id, conversation_id)
  WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS chat_participants_conv_active_idx
  ON public.chat_participants (conversation_id, joined_at)
  WHERE removed_at IS NULL;

DROP TRIGGER IF EXISTS chat_participants_set_updated_at ON public.chat_participants;
CREATE TRIGGER chat_participants_set_updated_at
  BEFORE UPDATE ON public.chat_participants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_message_id text,
  kind text NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'attachment', 'task_reference', 'system')),
  body text NOT NULL DEFAULT '',
  reply_to_message_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  reactions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  UNIQUE (organization_id, conversation_id, id),
  CONSTRAINT chat_messages_conv_fk
    FOREIGN KEY (organization_id, conversation_id)
    REFERENCES public.chat_conversations(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT chat_messages_reply_fk
    FOREIGN KEY (organization_id, conversation_id, reply_to_message_id)
    REFERENCES public.chat_messages(organization_id, conversation_id, id) ON DELETE SET NULL,
  CONSTRAINT chat_messages_body_len CHECK (char_length(body) <= 10000),
  CONSTRAINT chat_messages_text_required CHECK (
    kind <> 'text' OR char_length(btrim(body)) BETWEEN 1 AND 10000
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_idempotency_uidx
  ON public.chat_messages (organization_id, conversation_id, sender_user_id, client_message_id)
  WHERE client_message_id IS NOT NULL AND sender_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS chat_messages_conv_created_idx
  ON public.chat_messages (conversation_id, created_at DESC, id DESC);

ALTER TABLE public.chat_conversations
  DROP CONSTRAINT IF EXISTS chat_conversations_pinned_msg_fk;
ALTER TABLE public.chat_conversations
  ADD CONSTRAINT chat_conversations_pinned_msg_fk
  FOREIGN KEY (organization_id, id, pinned_message_id)
  REFERENCES public.chat_messages(organization_id, conversation_id, id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.chat_participants
  DROP CONSTRAINT IF EXISTS chat_participants_last_read_fk;
ALTER TABLE public.chat_participants
  ADD CONSTRAINT chat_participants_last_read_fk
  FOREIGN KEY (organization_id, conversation_id, last_read_message_id)
  REFERENCES public.chat_messages(organization_id, conversation_id, id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- 2. Security Definer Helpers (Non-recursive, fail-closed on NULL auth.uid())
CREATE OR REPLACE FUNCTION public.is_chat_participant(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR p_conversation_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.chat_participants cp
      JOIN public.chat_conversations c ON c.id = cp.conversation_id AND c.organization_id = cp.organization_id
      JOIN public.organization_members m ON m.id = cp.membership_id AND m.organization_id = cp.organization_id
      JOIN public.organizations o ON o.id = cp.organization_id
      WHERE cp.conversation_id = p_conversation_id
        AND cp.user_id = auth.uid()
        AND cp.removed_at IS NULL
        AND c.archived_at IS NULL
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND o.status = 'active'
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.is_chat_group_manager(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR p_conversation_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.chat_participants cp
      JOIN public.chat_conversations c ON c.id = cp.conversation_id AND c.organization_id = cp.organization_id
      JOIN public.organization_members m ON m.id = cp.membership_id AND m.organization_id = cp.organization_id
      JOIN public.organizations o ON o.id = cp.organization_id
      WHERE cp.conversation_id = p_conversation_id
        AND cp.user_id = auth.uid()
        AND cp.removed_at IS NULL
        AND cp.group_role IN ('owner', 'admin')
        AND c.type = 'group'
        AND c.archived_at IS NULL
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND o.status = 'active'
    )
  END
$$;

REVOKE ALL ON FUNCTION public.is_chat_participant(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_chat_group_manager(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_chat_participant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_chat_group_manager(uuid) TO authenticated;

-- 3. Authoritative RLS Policies (No admin backdoor into private chats; strict tenant & participant lock)
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.chat_conversations, public.chat_participants, public.chat_messages FROM PUBLIC, anon;

DROP POLICY IF EXISTS "chat_conversations_select_participant" ON public.chat_conversations;
CREATE POLICY "chat_conversations_select_participant" ON public.chat_conversations
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND public.is_chat_participant(id)
  );

DROP POLICY IF EXISTS "chat_conversations_update_manager" ON public.chat_conversations;
CREATE POLICY "chat_conversations_update_manager" ON public.chat_conversations
  FOR UPDATE TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND public.is_chat_participant(id)
    AND (type = 'direct' OR public.is_chat_group_manager(id))
  )
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.is_chat_participant(id)
    AND (type = 'direct' OR public.is_chat_group_manager(id))
  );

DROP POLICY IF EXISTS "chat_participants_select_member" ON public.chat_participants;
CREATE POLICY "chat_participants_select_member" ON public.chat_participants
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND public.is_chat_participant(conversation_id)
    AND removed_at IS NULL
  );

DROP POLICY IF EXISTS "chat_participants_update_self_prefs" ON public.chat_participants;
CREATE POLICY "chat_participants_update_self_prefs" ON public.chat_participants
  FOR UPDATE TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND user_id = auth.uid()
    AND removed_at IS NULL
  )
  WITH CHECK (
    public.is_org_member(organization_id)
    AND user_id = auth.uid()
    AND removed_at IS NULL
  );

DROP POLICY IF EXISTS "chat_messages_select_participant" ON public.chat_messages;
CREATE POLICY "chat_messages_select_participant" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND public.is_chat_participant(conversation_id)
  );

DROP POLICY IF EXISTS "chat_messages_insert_participant" ON public.chat_messages;
CREATE POLICY "chat_messages_insert_participant" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.is_chat_participant(conversation_id)
    AND sender_user_id = auth.uid()
    AND kind <> 'system'
  );

DROP POLICY IF EXISTS "chat_messages_update_author" ON public.chat_messages;
CREATE POLICY "chat_messages_update_author" ON public.chat_messages
  FOR UPDATE TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND public.is_chat_participant(conversation_id)
    AND sender_user_id = auth.uid()
  )
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.is_chat_participant(conversation_id)
    AND sender_user_id = auth.uid()
  );

GRANT SELECT, UPDATE ON public.chat_conversations TO authenticated;
GRANT SELECT, UPDATE ON public.chat_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_conversations, public.chat_participants, public.chat_messages TO service_role;

-- 4. Atomic Multi-Tenant Chat RPCs
CREATE OR REPLACE FUNCTION public.list_chat_eligible_participants(
  p_organization_id uuid,
  p_query text DEFAULT ''
)
RETURNS TABLE (
  membership_id uuid,
  user_id uuid,
  employee_id uuid,
  display_name text,
  role_label text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_search text := lower(btrim(coalesce(p_query, '')));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;
  IF NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN QUERY
  SELECT
    m.id AS membership_id,
    m.user_id,
    m.employee_id,
    COALESCE(NULLIF(btrim(e.full_name), ''), NULLIF(btrim(p.display_name), ''), 'Thành viên')::text AS display_name,
    COALESCE(
      NULLIF(btrim(e.title), ''),
      CASE m.role::text
        WHEN 'owner' THEN 'Chủ sở hữu'
        WHEN 'admin' THEN 'Quản trị viên'
        WHEN 'manager' THEN 'Quản lý'
        WHEN 'viewer' THEN 'Chỉ xem'
        ELSE 'Nhân viên'
      END
    )::text AS role_label
  FROM public.organization_members m
  LEFT JOIN public.employees e ON e.id = m.employee_id AND e.organization_id = m.organization_id
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.organization_id = p_organization_id
    AND m.status = 'active'
    AND (
      v_search = ''
      OR lower(COALESCE(e.full_name, p.display_name, '')) LIKE '%' || v_search || '%'
      OR lower(COALESCE(e.title, '')) LIKE '%' || v_search || '%'
    )
  ORDER BY (m.user_id = v_uid) DESC, COALESCE(e.full_name, p.display_name, 'Thành viên') ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_direct_chat(
  p_organization_id uuid,
  p_target_membership_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_caller_mem uuid;
  v_target_user uuid;
  v_direct_key text;
  v_conv_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;
  IF NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT id INTO v_caller_mem
  FROM public.organization_members
  WHERE organization_id = p_organization_id AND user_id = v_uid AND status = 'active'
  LIMIT 1;
  IF v_caller_mem IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT user_id INTO v_target_user
  FROM public.organization_members
  WHERE organization_id = p_organization_id AND id = p_target_membership_id AND status = 'active'
  LIMIT 1;
  IF v_target_user IS NULL OR v_target_user = v_uid THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Người nhận không hợp lệ';
  END IF;

  IF v_uid::text < v_target_user::text THEN
    v_direct_key := v_uid::text || ':' || v_target_user::text;
  ELSE
    v_direct_key := v_target_user::text || ':' || v_uid::text;
  END IF;

  INSERT INTO public.chat_conversations (organization_id, type, direct_key, title, created_by)
  VALUES (p_organization_id, 'direct', v_direct_key, '', v_uid)
  ON CONFLICT (organization_id, direct_key)
    WHERE type = 'direct' AND direct_key IS NOT NULL AND archived_at IS NULL
    DO NOTHING
  RETURNING id INTO v_conv_id;

  IF v_conv_id IS NULL THEN
    SELECT id INTO v_conv_id
    FROM public.chat_conversations
    WHERE organization_id = p_organization_id
      AND type = 'direct'
      AND direct_key = v_direct_key
      AND archived_at IS NULL
    LIMIT 1;
  END IF;

  INSERT INTO public.chat_participants (organization_id, conversation_id, membership_id, user_id, group_role)
  VALUES
    (p_organization_id, v_conv_id, v_caller_mem, v_uid, 'member'),
    (p_organization_id, v_conv_id, p_target_membership_id, v_target_user, 'member')
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET removed_at = NULL;

  RETURN v_conv_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_chat_group(
  p_organization_id uuid,
  p_name text,
  p_description text DEFAULT '',
  p_participant_membership_ids uuid[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_caller_mem uuid;
  v_caller_name text;
  v_conv_id uuid;
  v_title text := btrim(coalesce(p_name, ''));
  v_desc text := btrim(coalesce(p_description, ''));
  v_mem record;
  v_added int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;
  IF NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF char_length(v_title) < 1 OR char_length(v_title) > 100 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Tên nhóm phải từ 1 đến 100 ký tự';
  END IF;
  IF char_length(v_desc) > 500 THEN
    v_desc := left(v_desc, 500);
  END IF;

  SELECT m.id, COALESCE(NULLIF(btrim(e.full_name), ''), NULLIF(btrim(p.display_name), ''), 'Một thành viên')
  INTO v_caller_mem, v_caller_name
  FROM public.organization_members m
  LEFT JOIN public.employees e ON e.id = m.employee_id AND e.organization_id = m.organization_id
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.organization_id = p_organization_id AND m.user_id = v_uid AND m.status = 'active'
  LIMIT 1;
  IF v_caller_mem IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  INSERT INTO public.chat_conversations (organization_id, type, title, description, created_by)
  VALUES (p_organization_id, 'group', v_title, v_desc, v_uid)
  RETURNING id INTO v_conv_id;

  INSERT INTO public.chat_participants (organization_id, conversation_id, membership_id, user_id, group_role)
  VALUES (p_organization_id, v_conv_id, v_caller_mem, v_uid, 'owner');

  FOR v_mem IN
    SELECT DISTINCT m.id AS membership_id, m.user_id
    FROM public.organization_members m
    WHERE m.organization_id = p_organization_id
      AND m.id = ANY(coalesce(p_participant_membership_ids, '{}'))
      AND m.user_id <> v_uid
      AND m.status = 'active'
  LOOP
    INSERT INTO public.chat_participants (organization_id, conversation_id, membership_id, user_id, group_role)
    VALUES (p_organization_id, v_conv_id, v_mem.membership_id, v_mem.user_id, 'member')
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
    v_added := v_added + 1;
  END LOOP;

  IF v_added = 0 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Chọn ít nhất 1 thành viên hợp lệ trong tổ chức';
  END IF;

  INSERT INTO public.chat_messages (organization_id, conversation_id, sender_user_id, kind, body)
  VALUES (p_organization_id, v_conv_id, NULL, 'system', v_caller_name || ' đã tạo nhóm ' || v_title);

  RETURN v_conv_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_chat_participants(
  p_organization_id uuid,
  p_conversation_id uuid,
  p_membership_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_mem record;
  v_count int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;
  IF NOT public.is_chat_group_manager(p_conversation_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  FOR v_mem IN
    SELECT DISTINCT m.id AS membership_id, m.user_id
    FROM public.organization_members m
    WHERE m.organization_id = p_organization_id
      AND m.id = ANY(coalesce(p_membership_ids, '{}'))
      AND m.status = 'active'
  LOOP
    INSERT INTO public.chat_participants (organization_id, conversation_id, membership_id, user_id, group_role)
    VALUES (p_organization_id, p_conversation_id, v_mem.membership_id, v_mem.user_id, 'member')
    ON CONFLICT (conversation_id, user_id) DO UPDATE SET removed_at = NULL;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_chat_message(
  p_organization_id uuid,
  p_conversation_id uuid,
  p_client_message_id text,
  p_text text,
  p_reply_to_message_id uuid DEFAULT NULL
)
RETURNS public.chat_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clean text := btrim(coalesce(p_text, ''));
  v_client_id text := nullif(btrim(coalesce(p_client_message_id, '')), '');
  v_msg public.chat_messages;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;
  IF NOT public.is_org_member(p_organization_id) OR NOT public.is_chat_participant(p_conversation_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Thiếu clientMessageId';
  END IF;
  IF char_length(v_clean) < 1 OR char_length(v_clean) > 10000 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Tin nhắn cần có từ 1 đến 10.000 ký tự';
  END IF;

  IF p_reply_to_message_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.chat_messages
    WHERE id = p_reply_to_message_id
      AND organization_id = p_organization_id
      AND conversation_id = p_conversation_id
  ) THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Tin nhắn trả lời không hợp lệ';
  END IF;

  SELECT * INTO v_msg
  FROM public.chat_messages
  WHERE organization_id = p_organization_id
    AND conversation_id = p_conversation_id
    AND sender_user_id = v_uid
    AND client_message_id = v_client_id
  LIMIT 1;

  IF FOUND THEN
    RETURN v_msg;
  END IF;

  INSERT INTO public.chat_messages (
    organization_id, conversation_id, sender_user_id, client_message_id, kind, body, reply_to_message_id
  )
  VALUES (
    p_organization_id, p_conversation_id, v_uid, v_client_id, 'text', v_clean, p_reply_to_message_id
  )
  ON CONFLICT (organization_id, conversation_id, sender_user_id, client_message_id)
    WHERE client_message_id IS NOT NULL AND sender_user_id IS NOT NULL
    DO NOTHING
  RETURNING * INTO v_msg;

  IF NOT FOUND THEN
    SELECT * INTO v_msg
    FROM public.chat_messages
    WHERE organization_id = p_organization_id
      AND conversation_id = p_conversation_id
      AND sender_user_id = v_uid
      AND client_message_id = v_client_id
    LIMIT 1;
    RETURN v_msg;
  END IF;

  UPDATE public.chat_conversations
  SET updated_at = now()
  WHERE id = p_conversation_id AND organization_id = p_organization_id;

  UPDATE public.chat_participants
  SET last_read_message_id = v_msg.id,
      last_read_at = v_msg.created_at
  WHERE conversation_id = p_conversation_id AND user_id = v_uid AND removed_at IS NULL;

  RETURN v_msg;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_chat_read(
  p_organization_id uuid,
  p_conversation_id uuid,
  p_message_id uuid DEFAULT NULL
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_msg_created timestamptz;
  v_cur_read_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF NOT public.is_chat_participant(p_conversation_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT last_read_at INTO v_cur_read_at
  FROM public.chat_participants
  WHERE organization_id = p_organization_id
    AND conversation_id = p_conversation_id
    AND user_id = v_uid
    AND removed_at IS NULL
  LIMIT 1;

  IF p_message_id IS NOT NULL THEN
    SELECT created_at INTO v_msg_created
    FROM public.chat_messages
    WHERE organization_id = p_organization_id
      AND conversation_id = p_conversation_id
      AND id = p_message_id
    LIMIT 1;
    IF v_msg_created IS NULL THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Tin nhắn không hợp lệ';
    END IF;
  ELSE
    SELECT created_at INTO v_msg_created
    FROM public.chat_messages
    WHERE organization_id = p_organization_id
      AND conversation_id = p_conversation_id
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_msg_created IS NULL THEN
    RETURN v_cur_read_at;
  END IF;

  -- Monotonic read cursor: never move backwards
  IF v_cur_read_at IS NULL OR v_msg_created > v_cur_read_at THEN
    UPDATE public.chat_participants
    SET last_read_message_id = coalesce(p_message_id, last_read_message_id),
        last_read_at = v_msg_created
    WHERE organization_id = p_organization_id
      AND conversation_id = p_conversation_id
      AND user_id = v_uid
      AND removed_at IS NULL;
    RETURN v_msg_created;
  END IF;

  RETURN v_cur_read_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_chat_reaction(
  p_organization_id uuid,
  p_conversation_id uuid,
  p_message_id uuid,
  p_emoji text
)
RETURNS public.chat_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_msg public.chat_messages;
  v_reactions jsonb;
  v_new_reactions jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_user_ids jsonb;
  v_found boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF NOT public.is_chat_participant(p_conversation_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_emoji NOT IN ('👍', '❤️', '🎉', '👀') THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Cảm xúc không hợp lệ';
  END IF;

  SELECT * INTO v_msg
  FROM public.chat_messages
  WHERE id = p_message_id
    AND organization_id = p_organization_id
    AND conversation_id = p_conversation_id
    AND deleted_at IS NULL
    AND kind <> 'system'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  v_reactions := coalesce(v_msg.reactions, '[]'::jsonb);

  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_reactions)
  LOOP
    IF v_elem ->> 'emoji' = p_emoji THEN
      v_found := true;
      v_user_ids := coalesce(v_elem -> 'userIds', '[]'::jsonb);
      IF v_user_ids ? v_uid::text THEN
        SELECT coalesce(jsonb_agg(val), '[]'::jsonb) INTO v_user_ids
        FROM jsonb_array_elements_text(v_user_ids) val
        WHERE val <> v_uid::text;
      ELSE
        v_user_ids := v_user_ids || jsonb_build_array(v_uid::text);
      END IF;
      IF jsonb_array_length(v_user_ids) > 0 THEN
        v_new_reactions := v_new_reactions || jsonb_build_array(jsonb_build_object('emoji', p_emoji, 'userIds', v_user_ids));
      END IF;
    ELSE
      v_new_reactions := v_new_reactions || jsonb_build_array(v_elem);
    END IF;
  END LOOP;

  IF NOT v_found THEN
    v_new_reactions := v_new_reactions || jsonb_build_array(jsonb_build_object('emoji', p_emoji, 'userIds', jsonb_build_array(v_uid::text)));
  END IF;

  UPDATE public.chat_messages
  SET reactions = v_new_reactions
  WHERE id = p_message_id
  RETURNING * INTO v_msg;

  RETURN v_msg;
END;
$$;

CREATE OR REPLACE FUNCTION public.pin_chat_message(
  p_organization_id uuid,
  p_conversation_id uuid,
  p_message_id uuid
)
RETURNS public.chat_conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_conv public.chat_conversations;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF NOT public.is_chat_participant(p_conversation_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chat_messages
    WHERE id = p_message_id
      AND organization_id = p_organization_id
      AND conversation_id = p_conversation_id
      AND deleted_at IS NULL
      AND kind <> 'system'
  ) THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Tin nhắn ghim không hợp lệ';
  END IF;

  UPDATE public.chat_conversations
  SET pinned_message_id = p_message_id
  WHERE id = p_conversation_id AND organization_id = p_organization_id
  RETURNING * INTO v_conv;

  RETURN v_conv;
END;
$$;

REVOKE ALL ON FUNCTION public.list_chat_eligible_participants(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_or_create_direct_chat(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_chat_group(uuid, text, text, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_chat_participants(uuid, uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_chat_message(uuid, uuid, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_chat_read(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.toggle_chat_reaction(uuid, uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pin_chat_message(uuid, uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.list_chat_eligible_participants(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_chat(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_chat_group(uuid, text, text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_chat_participants(uuid, uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_chat_message(uuid, uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_chat_read(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_chat_reaction(uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pin_chat_message(uuid, uuid, uuid) TO authenticated;

-- 5. Enable Supabase Realtime & scoped private chat topics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END $$;

ALTER TABLE public.chat_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.chat_participants REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "realtime_messages_select" ON realtime.messages;
CREATE POLICY "realtime_messages_select"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (
    topic LIKE 'org:%:workspace'
    AND split_part(topic, ':', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_org_member((split_part(topic, ':', 2))::uuid)
  )
  OR
  (
    topic LIKE 'task:%:%'
    AND split_part(topic, ':', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.can_read_task_id((split_part(topic, ':', 2))::uuid)
  )
  OR
  (
    topic LIKE 'chat:%:%'
    AND split_part(topic, ':', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_chat_participant((split_part(topic, ':', 2))::uuid)
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
    AND split_part(topic, ':', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_org_member((split_part(topic, ':', 2))::uuid)
  )
  OR
  (
    topic LIKE 'task:%:%'
    AND split_part(topic, ':', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.can_read_task_id((split_part(topic, ':', 2))::uuid)
  )
  OR
  (
    topic LIKE 'chat:%:%'
    AND split_part(topic, ':', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_chat_participant((split_part(topic, ':', 2))::uuid)
  )
);

COMMIT;
