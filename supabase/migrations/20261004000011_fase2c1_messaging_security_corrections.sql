-- ============================================================================
-- FOROFETICHE — FASE 2C-1: CORRECCIONES DE SEGURIDAD PARA MENSAJERÍA PRIVADA
-- Migration: 20261004000011_fase2c1_messaging_security_corrections.sql
-- ============================================================================

-- 1. ELIMINAR Y BLOQUEAR MUTACIONES DIRECTAS SOBRE MESSAGE_REQUESTS
DROP POLICY IF EXISTS "Users can send message requests" ON public.message_requests;
DROP POLICY IF EXISTS "Recipients can update message requests" ON public.message_requests;
DROP POLICY IF EXISTS "No direct insert on message_requests" ON public.message_requests;
DROP POLICY IF EXISTS "No direct update on message_requests" ON public.message_requests;
DROP POLICY IF EXISTS "No direct delete on message_requests" ON public.message_requests;

-- Solo lectura para participantes
DROP POLICY IF EXISTS "Message requests visible to sender and recipient" ON public.message_requests;
CREATE POLICY "Message requests visible to sender and recipient"
    ON public.message_requests FOR SELECT
    TO authenticated
    USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "No direct insert on message_requests"
    ON public.message_requests FOR INSERT
    TO authenticated
    WITH CHECK (false);

CREATE POLICY "No direct update on message_requests"
    ON public.message_requests FOR UPDATE
    TO authenticated
    USING (false);

CREATE POLICY "No direct delete on message_requests"
    ON public.message_requests FOR DELETE
    TO authenticated
    USING (false);

-- 2. REFORZAR ÍNDICE ÚNICO SIMÉTRICO PARA PENDING Y ACCEPTED (EVITAR CARRERAS)
DROP INDEX IF EXISTS public.idx_unique_active_message_request;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_or_accepted_message_request
    ON public.message_requests (LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id))
    WHERE status IN ('PENDING', 'ACCEPTED');

-- 3. REVOCAR ACCESO DIRECTO DE CLIENTE A IS_BLOCKED_BETWEEN
REVOKE EXECUTE ON FUNCTION public.is_blocked_between(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- 4. HARDENING DE CAN_SEND_MESSAGE CON SET SEARCH_PATH = PUBLIC Y VALIDACIÓN COMPLETA
CREATE OR REPLACE FUNCTION public.can_send_message(target_conversation_id UUID, target_sender_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    conv_request_id UUID;
    req_status TEXT;
    is_blocked BOOLEAN;
    req_sender_id UUID;
    req_recipient_id UUID;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.conversation_members
        WHERE conversation_id = target_conversation_id AND user_id = target_sender_id
    ) THEN
        RETURN FALSE;
    END IF;

    SELECT request_id INTO conv_request_id
    FROM public.conversations
    WHERE id = target_conversation_id;

    IF conv_request_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT status, sender_id, recipient_id INTO req_status, req_sender_id, req_recipient_id
    FROM public.message_requests
    WHERE id = conv_request_id;

    IF req_status IS NULL OR req_status <> 'ACCEPTED' THEN
        RETURN FALSE;
    END IF;

    IF NOT (
        (target_sender_id = req_sender_id OR target_sender_id = req_recipient_id)
        AND EXISTS (
            SELECT 1 FROM public.conversation_members cm
            WHERE cm.conversation_id = target_conversation_id
              AND cm.user_id IN (req_sender_id, req_recipient_id)
        )
    ) THEN
        RETURN FALSE;
    END IF;

    SELECT EXISTS (
        SELECT 1 
        FROM public.conversation_members cm
        JOIN public.user_blocks ub 
          ON (ub.blocker_id = cm.user_id AND ub.blocked_id = target_sender_id)
          OR (ub.blocker_id = target_sender_id AND ub.blocked_id = cm.user_id)
        WHERE cm.conversation_id = target_conversation_id
          AND cm.user_id <> target_sender_id
    ) INTO is_blocked;

    IF is_blocked THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_send_message(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_send_message(UUID, UUID) TO authenticated;

-- 5. ACTUALIZAR CREATE_MESSAGE_REQUEST (SENDER_ID FORZADO DESDE AUTH.UID())
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

-- 6. ACTUALIZAR ACCEPT_MESSAGE_REQUEST (CONVERSIÓN ATÓMICA DE INITIAL_MESSAGE EN PRIMER MENSAJE)
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

    -- Insertar initial_message como primer registro en messages
    INSERT INTO public.messages (
        conversation_id,
        sender_id,
        content,
        created_at
    ) VALUES (
        new_conv_id,
        req_record.sender_id,
        req_record.initial_message,
        now()
    );

    RETURN new_conv_id;
END;
$$;
