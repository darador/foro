-- FOROFETICHE — FASE 2C-4.3
-- Restaurar la creación del mensaje inicial al aceptar una solicitud.
-- Corrige la regresión introducida en 000019.

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
    target_conv_id UUID;
BEGIN
    caller_id := auth.uid();

    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- 1. Obtener y bloquear la solicitud para actualización
    SELECT * INTO req_record
    FROM public.message_requests
    WHERE id = target_request_id
    FOR UPDATE;

    IF req_record.id IS NULL THEN
        RAISE EXCEPTION 'Message request not found.';
    END IF;

    -- 2. Validar que el caller sea el recipient
    IF req_record.recipient_id <> caller_id THEN
        RAISE EXCEPTION 'Only the recipient can accept a message request.';
    END IF;

    -- 3. Validar que el estado sea PENDING
    IF req_record.status <> 'PENDING' THEN
        RAISE EXCEPTION 'Only PENDING message requests can be accepted.';
    END IF;

    -- 4. Validar que no exista un bloqueo activo
    IF public.is_blocked_between(req_record.sender_id, req_record.recipient_id) THEN
        RAISE EXCEPTION 'Cannot accept request because communication is blocked.';
    END IF;

    -- 5. Crear la conversación y sus miembros antes de cambiar el status
    SELECT id INTO existing_conv_id
    FROM public.conversations
    WHERE request_id = target_request_id;

    IF existing_conv_id IS NOT NULL THEN
        target_conv_id := existing_conv_id;
    ELSE
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

        INSERT INTO public.conversation_members (
            conversation_id,
            user_id,
            joined_at
        )
        VALUES
            (new_conv_id, req_record.sender_id, now()),
            (new_conv_id, req_record.recipient_id, now())
        ON CONFLICT (conversation_id, user_id) DO NOTHING;

        target_conv_id := new_conv_id;
    END IF;

    -- 6. Actualizar message_requests a ACCEPTED.
    -- El trigger AFTER UPDATE encontrará la conversación ya existente.
    UPDATE public.message_requests
    SET status = 'ACCEPTED',
        resolved_at = now(),
        updated_at = now()
    WHERE id = target_request_id;

    -- 7. Crear el mensaje inicial enviado por quien inició la solicitud.
    INSERT INTO public.messages (
        conversation_id,
        sender_id,
        content,
        created_at
    ) VALUES (
        target_conv_id,
        req_record.sender_id,
        req_record.initial_message,
        now()
    );

    RETURN target_conv_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_message_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_message_request(UUID) TO authenticated;
