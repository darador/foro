-- ============================================================================
-- FOROFETICHE — FASE 2C-1: PRIVATE MESSAGING MODEL & SECURITY HARDENING
-- Migration: 20261004000010_fase2c1_private_messaging_security.sql
-- ============================================================================

-- 1. CREAR TABLA USER_SETTINGS SI NO EXISTE
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    message_policy TEXT NOT NULL DEFAULT 'EVERYONE' CHECK (message_policy IN ('EVERYONE', 'NOBODY')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings"
    ON public.user_settings FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings"
    ON public.user_settings FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings"
    ON public.user_settings FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- 2. AMPLIAR TABLA MESSAGE_REQUESTS
ALTER TABLE public.message_requests
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Índice único simétrico para evitar solicitudes activas duplicadas en ambas direcciones
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_message_request
    ON public.message_requests (LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id))
    WHERE status = 'PENDING';

-- 3. CAMPO DE ELIMINACIÓN LÓGICA EN MESSAGES Y CONSTRAINTS
ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_message_content_length'
    ) THEN
        ALTER TABLE public.messages ADD CONSTRAINT chk_message_content_length CHECK (char_length(content) <= 2000 AND char_length(content) > 0);
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 4. HELPER FUNCTION: DETECCIÓN DE BLOQUEOS RECIAPROCOS
CREATE OR REPLACE FUNCTION public.is_blocked_between(user_a UUID, user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_blocks
        WHERE (blocker_id = user_a AND blocked_id = user_b)
           OR (blocker_id = user_b AND blocked_id = user_a)
    );
$$;

-- 5. RPC SECURITY DEFINER TRANSACCIONALES CONTROLADAS

-- 5.1 CREAR SOLICITUD DE MENSAJE
CREATE OR REPLACE FUNCTION public.create_message_request(
    target_receiver_id UUID,
    initial_msg TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_id UUID;
    target_policy TEXT;
    new_request_id UUID;
    clean_msg TEXT;
BEGIN
    caller_id := auth.uid();
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF caller_id = target_receiver_id THEN
        RAISE EXCEPTION 'Cannot send message request to yourself.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_receiver_id) THEN
        RAISE EXCEPTION 'Target user profile not found.';
    END IF;

    SELECT COALESCE(
        (SELECT message_policy FROM public.user_settings WHERE user_id = target_receiver_id),
        'EVERYONE'
    ) INTO target_policy;

    IF target_policy = 'NOBODY' THEN
        RAISE EXCEPTION 'Target user does not accept message requests.';
    END IF;

    IF public.is_blocked_between(caller_id, target_receiver_id) THEN
        RAISE EXCEPTION 'Communication is blocked between these users.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.message_requests
        WHERE ((sender_id = caller_id AND recipient_id = target_receiver_id)
            OR (sender_id = target_receiver_id AND recipient_id = caller_id))
          AND status IN ('PENDING', 'ACCEPTED')
    ) THEN
        RAISE EXCEPTION 'An active message request or conversation already exists between these users.';
    END IF;

    clean_msg := trim(initial_msg);
    IF clean_msg IS NULL OR length(clean_msg) = 0 OR length(clean_msg) > 2000 THEN
        RAISE EXCEPTION 'Initial message content length must be between 1 and 2000 characters.';
    END IF;

    INSERT INTO public.message_requests (
        sender_id,
        recipient_id,
        initial_message,
        status,
        created_at,
        updated_at
    ) VALUES (
        caller_id,
        target_receiver_id,
        clean_msg,
        'PENDING',
        now(),
        now()
    )
    RETURNING id INTO new_request_id;

    RETURN new_request_id;
END;
$$;

-- 5.2 ACEPTAR SOLICITUD DE MENSAJE Y CREAR CONVERSACIÓN ATÓMICAMENTE
CREATE OR REPLACE FUNCTION public.accept_message_request(
    target_request_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_id UUID;
    req_record RECORD;
    existing_conv_id UUID;
    new_conv_id UUID;
BEGIN
    caller_id := auth.uid();
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO req_record
    FROM public.message_requests
    WHERE id = target_request_id
    FOR UPDATE;

    IF req_record.id IS NULL THEN
        RAISE EXCEPTION 'Message request not found.';
    END IF;

    IF req_record.recipient_id <> caller_id THEN
        RAISE EXCEPTION 'Only the recipient can accept a message request.';
    END IF;

    IF req_record.status <> 'PENDING' THEN
        RAISE EXCEPTION 'Only PENDING message requests can be accepted.';
    END IF;

    IF public.is_blocked_between(req_record.sender_id, req_record.recipient_id) THEN
        RAISE EXCEPTION 'Cannot accept request because communication is blocked.';
    END IF;

    UPDATE public.message_requests
    SET status = 'ACCEPTED',
        resolved_at = now(),
        updated_at = now()
    WHERE id = target_request_id;

    SELECT id INTO existing_conv_id
    FROM public.conversations
    WHERE request_id = target_request_id;

    IF existing_conv_id IS NOT NULL THEN
        RETURN existing_conv_id;
    END IF;

    INSERT INTO public.conversations (
        request_id,
        created_at,
        updated_at
    ) VALUES (
        target_request_id,
        now(),
        now()
    )
    RETURNING id INTO new_conv_id;

    INSERT INTO public.conversation_members (conversation_id, user_id, joined_at)
    VALUES
        (new_conv_id, req_record.sender_id, now()),
        (new_conv_id, req_record.recipient_id, now())
    ON CONFLICT (conversation_id, user_id) DO NOTHING;

    RETURN new_conv_id;
END;
$$;

-- 5.3 RECHAZAR SOLICITUD DE MENSAJE
CREATE OR REPLACE FUNCTION public.reject_message_request(
    target_request_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_id UUID;
    req_record RECORD;
BEGIN
    caller_id := auth.uid();
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO req_record
    FROM public.message_requests
    WHERE id = target_request_id
    FOR UPDATE;

    IF req_record.id IS NULL THEN
        RAISE EXCEPTION 'Message request not found.';
    END IF;

    IF req_record.recipient_id <> caller_id THEN
        RAISE EXCEPTION 'Only the recipient can reject a message request.';
    END IF;

    IF req_record.status <> 'PENDING' THEN
        RAISE EXCEPTION 'Only PENDING message requests can be rejected.';
    END IF;

    UPDATE public.message_requests
    SET status = 'REJECTED',
        resolved_at = now(),
        updated_at = now()
    WHERE id = target_request_id;

    RETURN TRUE;
END;
$$;

-- 5.4 BLOQUEAR SOLICITUD DE MENSAJE
CREATE OR REPLACE FUNCTION public.block_message_request(
    target_request_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_id UUID;
    req_record RECORD;
    other_user_id UUID;
BEGIN
    caller_id := auth.uid();
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO req_record
    FROM public.message_requests
    WHERE id = target_request_id
    FOR UPDATE;

    IF req_record.id IS NULL THEN
        RAISE EXCEPTION 'Message request not found.';
    END IF;

    IF req_record.sender_id = caller_id THEN
        other_user_id := req_record.recipient_id;
    ELSIF req_record.recipient_id = caller_id THEN
        other_user_id := req_record.sender_id;
    ELSE
        RAISE EXCEPTION 'Not a participant of this message request.';
    END IF;

    UPDATE public.message_requests
    SET status = 'BLOCKED',
        resolved_at = now(),
        updated_at = now()
    WHERE id = target_request_id;

    INSERT INTO public.user_blocks (blocker_id, blocked_id, created_at)
    VALUES (caller_id, other_user_id, now())
    ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

    RETURN TRUE;
END;
$$;

-- 5.5 ELIMINACIÓN LÓGICA DE MENSAJE PROPIO
CREATE OR REPLACE FUNCTION public.soft_delete_message(
    target_message_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_id UUID;
BEGIN
    caller_id := auth.uid();
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    UPDATE public.messages
    SET deleted_at = now()
    WHERE id = target_message_id
      AND sender_id = caller_id
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Message not found, already deleted, or unauthorized.';
    END IF;

    RETURN TRUE;
END;
$$;

-- 6. ASIGNACIÓN DE GRANTS Y REVOKE SOBRE RPCS
REVOKE EXECUTE ON FUNCTION public.is_blocked_between FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_blocked_between TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_message_request FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_message_request TO authenticated;

REVOKE EXECUTE ON FUNCTION public.accept_message_request FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_message_request TO authenticated;

REVOKE EXECUTE ON FUNCTION public.reject_message_request FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_message_request TO authenticated;

REVOKE EXECUTE ON FUNCTION public.block_message_request FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.block_message_request TO authenticated;

REVOKE EXECUTE ON FUNCTION public.soft_delete_message FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_message TO authenticated;

-- 7. REFORZAR POLÍTICAS RLS DE MENSAJERÍA
-- Conversations
DROP POLICY IF EXISTS "Conversation members can view conversations" ON public.conversations;
CREATE POLICY "Conversation members can view conversations"
    ON public.conversations FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_members cm
            WHERE cm.conversation_id = id AND cm.user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM public.message_requests mr
            WHERE mr.id = request_id AND mr.status = 'ACCEPTED'
        )
    );

DROP POLICY IF EXISTS "No direct insert on conversations" ON public.conversations;
CREATE POLICY "No direct insert on conversations"
    ON public.conversations FOR INSERT
    TO authenticated
    WITH CHECK (false);

DROP POLICY IF EXISTS "No direct update on conversations" ON public.conversations;
CREATE POLICY "No direct update on conversations"
    ON public.conversations FOR UPDATE
    TO authenticated
    USING (false);

-- Conversation Members
DROP POLICY IF EXISTS "Members view own conversation memberships" ON public.conversation_members;
CREATE POLICY "Members view own conversation memberships"
    ON public.conversation_members FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "No direct insert on conversation_members" ON public.conversation_members;
CREATE POLICY "No direct insert on conversation_members"
    ON public.conversation_members FOR INSERT
    TO authenticated
    WITH CHECK (false);

DROP POLICY IF EXISTS "No direct update on conversation_members" ON public.conversation_members;
CREATE POLICY "No direct update on conversation_members"
    ON public.conversation_members FOR UPDATE
    TO authenticated
    USING (false);

DROP POLICY IF EXISTS "No direct delete on conversation_members" ON public.conversation_members;
CREATE POLICY "No direct delete on conversation_members"
    ON public.conversation_members FOR DELETE
    TO authenticated
    USING (false);

-- Messages SELECT & UPDATE & DELETE
DROP POLICY IF EXISTS "Conversation members can view messages" ON public.messages;
CREATE POLICY "Conversation members can view messages"
    ON public.messages FOR SELECT
    TO authenticated
    USING (
        sender_id = auth.uid()
        OR (
            EXISTS (
                SELECT 1 FROM public.conversation_members cm
                WHERE cm.conversation_id = messages.conversation_id AND cm.user_id = auth.uid()
            )
            AND public.can_send_message(messages.conversation_id, auth.uid())
        )
    );

DROP POLICY IF EXISTS "No direct update on messages" ON public.messages;
CREATE POLICY "No direct update on messages"
    ON public.messages FOR UPDATE
    TO authenticated
    USING (false);

DROP POLICY IF EXISTS "No direct delete on messages" ON public.messages;
CREATE POLICY "No direct delete on messages"
    ON public.messages FOR DELETE
    TO authenticated
    USING (false);
