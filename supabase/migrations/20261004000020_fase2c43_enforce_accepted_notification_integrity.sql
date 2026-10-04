-- ============================================================================
-- FOROFETICHE — FASE 2C-4.3: INTEGRIDAD DE NOTIFICACIÓN ACCEPTED
-- Migration: 20261004000020_fase2c43_enforce_accepted_notification_integrity.sql
-- ============================================================================

-- Modificar handle_message_request_notification para requerir estrictamente conversation.id al aceptar solicitud.
-- Si assoc_conv_id es NULL en el evento PENDING -> ACCEPTED, lanza EXCEPTION provocando rollback transaccional.

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

        IF assoc_conv_id IS NULL THEN
            RAISE EXCEPTION 'Conversation not found for accepted message request.';
        END IF;

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
