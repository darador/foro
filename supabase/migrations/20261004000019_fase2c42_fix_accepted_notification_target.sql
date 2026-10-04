-- ============================================================================
-- FOROFETICHE — FASE 2C-4.2: CORRECCIÓN DE ORDEN TRANSACCIONAL Y TARGET DE NOTIFICACIÓN
-- Migration: 20261004000019_fase2c42_fix_accepted_notification_target.sql
-- ============================================================================

-- 1. CORREGIR ORDEN TRANSACCIONAL EN ACCEPT_MESSAGE_REQUEST
-- Garantizar que conversation y conversation_members se creen ANTES de actualizar el status a ACCEPTED.
-- Esto permite que el trigger handle_message_request_notification encuentre conversation.id durante el UPDATE.

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

    -- 5. Crear la conversación y sus miembros ANTES de cambiar el status a ACCEPTED
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

        INSERT INTO public.conversation_members (conversation_id, user_id, joined_at)
        VALUES
            (new_conv_id, req_record.sender_id, now()),
            (new_conv_id, req_record.recipient_id, now())
        ON CONFLICT (conversation_id, user_id) DO NOTHING;

        target_conv_id := new_conv_id;
    END IF;

    -- 6. Actualizar message_requests a ACCEPTED (activa el trigger AFTER UPDATE con la conversación ya existente)
    UPDATE public.message_requests
    SET status = 'ACCEPTED',
        resolved_at = now(),
        updated_at = now()
    WHERE id = target_request_id;

    RETURN target_conv_id;
END;
$$;


-- 2. ELIMINAR EL FALLBACK INCORRECTO EN HANDLE_MESSAGE_REQUEST_NOTIFICATION
-- Garantiza que MESSAGE_REQUEST_ACCEPTED apunte ESTRICTAMENTE a conversation.id.

CREATE OR REPLACE FUNCTION public.handle_message_request_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    assoc_conv_id UUID;
BEGIN
    -- Caso 1: Nueva solicitud creada (status PENDING) -> Notificar al recipient
    IF TG_OP = 'INSERT' AND NEW.status = 'PENDING' THEN
        INSERT INTO public.notifications (
            user_id,
            actor_id,
            type,
            entity_type,
            entity_id,
            created_at
        ) VALUES (
            NEW.recipient_id,
            NEW.sender_id,
            'MESSAGE_REQUEST',
            'MESSAGE_REQUEST',
            NEW.id,
            now()
        ) ON CONFLICT DO NOTHING;
    END IF;

    -- Caso 2: Solicitud actualizada de PENDING -> ACCEPTED -> Notificar al sender con entity_id = conversation.id
    IF TG_OP = 'UPDATE' AND OLD.status = 'PENDING' AND NEW.status = 'ACCEPTED' THEN
        SELECT id INTO assoc_conv_id
        FROM public.conversations
        WHERE request_id = NEW.id;

        IF assoc_conv_id IS NOT NULL THEN
            INSERT INTO public.notifications (
                user_id,
                actor_id,
                type,
                entity_type,
                entity_id,
                created_at
            ) VALUES (
                NEW.sender_id,
                NEW.recipient_id,
                'MESSAGE_REQUEST_ACCEPTED',
                'CONVERSATION',
                assoc_conv_id,
                now()
            ) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    -- Caso 3: Solicitud actualizada de PENDING -> REJECTED -> Notificar al sender
    IF TG_OP = 'UPDATE' AND OLD.status = 'PENDING' AND NEW.status = 'REJECTED' THEN
        INSERT INTO public.notifications (
            user_id,
            actor_id,
            type,
            entity_type,
            entity_id,
            created_at
        ) VALUES (
            NEW.sender_id,
            NEW.recipient_id,
            'MESSAGE_REQUEST_REJECTED',
            'MESSAGE_REQUEST',
            NEW.id,
            now()
        ) ON CONFLICT DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

-- Mantener la revocación de EXECUTE explícita a clientes
REVOKE EXECUTE ON FUNCTION public.handle_message_request_notification() FROM PUBLIC, anon, authenticated;
