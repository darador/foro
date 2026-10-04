-- ============================================================================
-- FOROFETICHE — FASE 2C-4: NOTIFICATIONS SCHEMA & AUTOMATIC TRIGGERS
-- Migration: 20261004000017_fase2c4_notifications_schema.sql
-- ============================================================================

-- 1. CREAR TABLA NOTIFICATIONS SI NO EXISTE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN (
        'MESSAGE',
        'MESSAGE_REQUEST',
        'MESSAGE_REQUEST_ACCEPTED',
        'MESSAGE_REQUEST_REJECTED'
    )),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('CONVERSATION', 'MESSAGE_REQUEST')),
    entity_id UUID NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ÍNDICES Y CONSTRAINTS DE UNICIDAD PARA EVITAR NOTIFICACIONES DUPLICADAS
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_notification_request
    ON public.notifications (user_id, actor_id, type, entity_id)
    WHERE type IN ('MESSAGE_REQUEST', 'MESSAGE_REQUEST_ACCEPTED', 'MESSAGE_REQUEST_REJECTED');

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON public.notifications (user_id) WHERE read_at IS NULL;

-- 2. POLÍTICAS RLS EN NOTIFICATIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "No direct insert on notifications" ON public.notifications;
CREATE POLICY "No direct insert on notifications"
    ON public.notifications FOR INSERT
    TO authenticated
    WITH CHECK (false);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
    ON public.notifications FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());


-- 3. TRIGGERS AUTOMÁTICOS SECURITY DEFINER PARA CREACIÓN DE NOTIFICACIONES

-- 3.1 Trigger en message_requests (MESSAGE_REQUEST, MESSAGE_REQUEST_ACCEPTED, MESSAGE_REQUEST_REJECTED)
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

    -- Caso 2: Solicitud actualizada de PENDING -> ACCEPTED -> Notificar al sender
    IF TG_OP = 'UPDATE' AND OLD.status = 'PENDING' AND NEW.status = 'ACCEPTED' THEN
        -- Buscar conversation_id vinculada a esta solicitud
        SELECT id INTO assoc_conv_id
        FROM public.conversations
        WHERE request_id = NEW.id;

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
            COALESCE(assoc_conv_id, NEW.id),
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

DROP TRIGGER IF EXISTS on_message_request_notification ON public.message_requests;
CREATE TRIGGER on_message_request_notification
    AFTER INSERT OR UPDATE ON public.message_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_message_request_notification();


-- 3.2 Trigger en messages (MESSAGE)
CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    member_record RECORD;
BEGIN
    -- Notificar a todos los miembros de la conversación excepto al sender del mensaje
    FOR member_record IN
        SELECT user_id
        FROM public.conversation_members
        WHERE conversation_id = NEW.conversation_id
          AND user_id <> NEW.sender_id
    LOOP
        INSERT INTO public.notifications (
            user_id,
            actor_id,
            type,
            entity_type,
            entity_id,
            created_at
        ) VALUES (
            member_record.user_id,
            NEW.sender_id,
            'MESSAGE',
            'CONVERSATION',
            NEW.conversation_id,
            now()
        );
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_message_notification ON public.messages;
CREATE TRIGGER on_new_message_notification
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_message_notification();


-- 4. RPCS PARA GESTIÓN DE NOTIFICACIONES CONTROLADAS

-- 4.1 Marcar una notificación como leída
CREATE OR REPLACE FUNCTION public.mark_notification_read(target_notification_id UUID)
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

    UPDATE public.notifications
    SET read_at = now()
    WHERE id = target_notification_id
      AND user_id = caller_id
      AND read_at IS NULL;

    RETURN TRUE;
END;
$$;

-- 4.2 Marcar todas las notificaciones del usuario como leídas
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
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

    UPDATE public.notifications
    SET read_at = now()
    WHERE user_id = caller_id
      AND read_at IS NULL;

    RETURN TRUE;
END;
$$;

-- 4.3 Obtener contador de notificaciones no leídas
CREATE OR REPLACE FUNCTION public.get_unread_notifications_count()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT count(*)::integer
    FROM public.notifications
    WHERE user_id = auth.uid()
      AND read_at IS NULL;
$$;

-- Permisos sobre RPCs
REVOKE EXECUTE ON FUNCTION public.mark_notification_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_unread_notifications_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unread_notifications_count() TO authenticated;
