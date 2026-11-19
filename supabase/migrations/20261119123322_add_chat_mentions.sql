-- Mentions use the existing message metadata and notification RLS.
CREATE OR REPLACE FUNCTION public.protect_chat_message_mentions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.metadata ? 'mentions' THEN
        RAISE EXCEPTION 'FORBIDDEN';
      END IF;
    ELSIF NEW.metadata -> 'mentions' IS DISTINCT FROM OLD.metadata -> 'mentions'
       OR (OLD.metadata ? 'mentions' AND NEW.body IS DISTINCT FROM OLD.body) THEN
      RAISE EXCEPTION 'FORBIDDEN';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_chat_message_mentions() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER protect_chat_message_mentions
BEFORE INSERT OR UPDATE ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.protect_chat_message_mentions();

CREATE OR REPLACE FUNCTION public.send_chat_message_with_mentions(
  p_organization_id uuid,
  p_conversation_id uuid,
  p_client_message_id text,
  p_text text,
  p_mentions jsonb,
  p_reply_to_message_id uuid DEFAULT NULL,
  p_attachments jsonb DEFAULT '[]'::jsonb
)
RETURNS public.chat_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_msg public.chat_messages;
  v_item jsonb;
  v_user uuid;
  v_start integer;
  v_length integer;
  v_end integer := 0;
  v_recipients uuid[] := ARRAY[]::uuid[];
  v_mentions jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF NOT public.is_chat_participant(p_conversation_id) OR NOT EXISTS (
    SELECT 1 FROM public.chat_conversations
      WHERE organization_id = p_organization_id AND id = p_conversation_id AND type = 'group'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF jsonb_typeof(p_mentions) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Danh sách thành viên được nhắc không hợp lệ';
  END IF;
  IF jsonb_array_length(p_mentions) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Mỗi tin nhắn có thể nhắc tối đa 10 lượt';
  END IF;

  v_msg := public.send_chat_message(p_organization_id, p_conversation_id, p_client_message_id, p_text, p_reply_to_message_id, p_attachments);
  SELECT * INTO STRICT v_msg FROM public.chat_messages WHERE id = v_msg.id FOR UPDATE;
  IF v_msg.metadata ? 'mentions' THEN RETURN v_msg; END IF;
  IF v_msg.deleted_at IS NOT NULL OR v_msg.body IS DISTINCT FROM p_text THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Nội dung tin nhắn đã thay đổi';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_mentions)
  LOOP
    IF coalesce(v_item ->> 'userId', '') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
       OR coalesce(v_item ->> 'start', '') !~ '^[0-9]{1,5}$'
       OR coalesce(v_item ->> 'length', '') !~ '^[0-9]{1,5}$' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Vị trí nhắc tên không hợp lệ';
    END IF;
    v_user := (v_item ->> 'userId')::uuid;
    v_start := (v_item ->> 'start')::integer;
    v_length := (v_item ->> 'length')::integer;
    IF v_start < v_end OR v_length < 2 OR v_start + v_length > char_length(v_msg.body)
       OR substr(v_msg.body, v_start + 1, 1) <> '@' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Vị trí nhắc tên không hợp lệ';
    END IF;
    v_end := v_start + v_length;

    PERFORM 1
      FROM public.chat_participants AS cp
      JOIN public.organization_members AS m
        ON m.organization_id = cp.organization_id AND m.id = cp.membership_id AND m.user_id = cp.user_id
      WHERE cp.organization_id = p_organization_id AND cp.conversation_id = p_conversation_id
        AND cp.user_id = v_user AND cp.user_id <> v_uid AND cp.removed_at IS NULL AND m.status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Thành viên được nhắc không còn trong nhóm';
    END IF;
    IF NOT (v_user = ANY(v_recipients)) THEN v_recipients := array_append(v_recipients, v_user); END IF;
    v_mentions := v_mentions || jsonb_build_array(jsonb_build_object('userId', v_user, 'start', v_start, 'length', v_length));
  END LOOP;

  UPDATE public.chat_messages SET metadata = metadata || jsonb_build_object('mentions', v_mentions)
    WHERE id = v_msg.id RETURNING * INTO v_msg;

  INSERT INTO public.notifications (organization_id, user_id, actor_user_id, kind, title, body, metadata)
    SELECT p_organization_id, recipient, v_uid, 'chat_mention', 'Bạn được nhắc trong nhóm chat',
      'Mở cuộc trò chuyện để xem tin nhắn.',
      jsonb_build_object('conversation_id', p_conversation_id)
    FROM unnest(v_recipients) AS recipients(recipient);
  RETURN v_msg;
END;
$$;

REVOKE ALL ON FUNCTION public.send_chat_message_with_mentions(uuid, uuid, text, text, jsonb, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_chat_message_with_mentions(uuid, uuid, text, text, jsonb, uuid, jsonb) TO authenticated;
