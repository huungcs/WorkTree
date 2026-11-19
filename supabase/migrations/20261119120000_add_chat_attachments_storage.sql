-- Migration: 20261119120000_add_chat_attachments_storage.sql
-- Purpose: Enable private multi-tenant file/image attachments for internal chat
-- via Supabase Storage bucket 'chat-files' + strict participant RLS + send_chat_message p_attachments.

BEGIN;

-- 1. Provision private 'chat-files' storage bucket (max 25 MB per file)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-files', 'chat-files', false, 26214400)
ON CONFLICT (id) DO UPDATE
SET public = excluded.public,
    file_size_limit = excluded.file_size_limit;

-- 2. Storage access guard: <organization_uuid>/<conversation_uuid>/<filename>
CREATE OR REPLACE FUNCTION public.storage_chat_allowed(p_name text, p_write boolean DEFAULT false)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_parts text[];
  v_org uuid;
  v_conv uuid;
BEGIN
  v_parts := storage.foldername(p_name);
  IF cardinality(v_parts) < 2 THEN
    RETURN false;
  END IF;

  v_org := public.safe_uuid(v_parts[1]);
  v_conv := public.safe_uuid(v_parts[2]);
  IF v_org IS NULL OR v_conv IS NULL THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.chat_conversations c
    WHERE c.id = v_conv
      AND c.organization_id = v_org
      AND c.archived_at IS NULL
  ) THEN
    RETURN false;
  END IF;

  IF NOT public.is_org_member(v_org) OR NOT public.is_chat_participant(v_conv) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.storage_chat_allowed(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_chat_allowed(text, boolean) TO authenticated;

DROP POLICY IF EXISTS storage_chat_files_select ON storage.objects;
CREATE POLICY storage_chat_files_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-files'
  AND public.storage_chat_allowed(name, false)
);

DROP POLICY IF EXISTS storage_chat_files_insert ON storage.objects;
CREATE POLICY storage_chat_files_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-files'
  AND public.storage_chat_allowed(name, true)
);

DROP POLICY IF EXISTS storage_chat_files_delete ON storage.objects;
CREATE POLICY storage_chat_files_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-files'
  AND public.storage_chat_allowed(name, true)
  AND owner_id = auth.uid()::text
);

-- 3. Upgrade send_chat_message to support optional p_attachments jsonb array (up to 5 files)
DROP FUNCTION IF EXISTS public.send_chat_message(uuid, uuid, text, text, uuid);
DROP FUNCTION IF EXISTS public.send_chat_message(uuid, uuid, text, text, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.send_chat_message(
  p_organization_id uuid,
  p_conversation_id uuid,
  p_client_message_id text,
  p_text text,
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
  v_clean text := btrim(coalesce(p_text, ''));
  v_client_id text := nullif(btrim(coalesce(p_client_message_id, '')), '');
  v_atts jsonb := coalesce(p_attachments, '[]'::jsonb);
  v_has_atts boolean := false;
  v_kind text := 'text';
  v_body text;
  v_meta jsonb := '{}'::jsonb;
  v_att jsonb;
  v_prefix text;
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

  IF jsonb_typeof(v_atts) <> 'array' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Danh sách tệp đính kèm không hợp lệ';
  END IF;
  IF jsonb_array_length(v_atts) > 5 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Tối đa 5 tệp đính kèm mỗi tin nhắn';
  END IF;

  v_has_atts := jsonb_array_length(v_atts) > 0;
  IF v_has_atts THEN
    v_prefix := p_organization_id::text || '/' || p_conversation_id::text || '/';
    FOR v_att IN SELECT * FROM jsonb_array_elements(v_atts)
    LOOP
      IF jsonb_typeof(v_att) <> 'object'
         OR nullif(btrim(coalesce(v_att ->> 'storagePath', '')), '') IS NULL
         OR left(v_att ->> 'storagePath', length(v_prefix)) <> v_prefix
         OR position('..' IN (v_att ->> 'storagePath')) > 0 THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Đường dẫn tệp đính kèm không hợp lệ';
      END IF;
    END LOOP;
    v_kind := 'attachment';
    v_meta := jsonb_build_object('attachments', v_atts);
  END IF;

  IF NOT v_has_atts AND (char_length(v_clean) < 1 OR char_length(v_clean) > 10000) THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Tin nhắn cần có từ 1 đến 10.000 ký tự';
  END IF;
  IF char_length(v_clean) > 10000 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Tin nhắn tối đa 10.000 ký tự';
  END IF;

  v_body := CASE
    WHEN char_length(v_clean) > 0 THEN v_clean
    ELSE '📎 ' || coalesce(nullif(btrim(v_atts -> 0 ->> 'fileName'), ''), 'Tệp đính kèm')
  END;

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
    organization_id, conversation_id, sender_user_id, client_message_id, kind, body, reply_to_message_id, metadata
  )
  VALUES (
    p_organization_id, p_conversation_id, v_uid, v_client_id, v_kind, v_body, p_reply_to_message_id, v_meta
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

REVOKE ALL ON FUNCTION public.send_chat_message(uuid, uuid, text, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_chat_message(uuid, uuid, text, text, uuid, jsonb) TO authenticated;

COMMIT;
