-- ============================================================================
-- FOROFETICHE — FASE 2C-1: CORRECCIÓN DE POLÍTICAS RLS Y CAN_SEND_MESSAGE
-- Migration: 20261004000013_fase2c1_can_send_message_rls_fix.sql
-- ============================================================================

-- 1. HELPER ESPECÍFICO RLS (SIN PARÁMETRO USER_ID; APLICA STRICTAMENTE AUTH.UID())
CREATE OR REPLACE FUNCTION public.is_conversation_active_for_user(target_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    caller_id UUID;
    req_status TEXT;
    is_blocked BOOLEAN;
BEGIN
    caller_id := auth.uid();
    IF caller_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 1. El usuario autenticado debe ser miembro de la conversación
    IF NOT EXISTS (
        SELECT 1 FROM public.conversation_members
        WHERE conversation_id = target_conversation_id AND user_id = caller_id
    ) THEN
        RETURN FALSE;
    END IF;

    -- 2. La solicitud asociada debe estar en estado ACCEPTED
    SELECT mr.status INTO req_status
    FROM public.conversations c
    JOIN public.message_requests mr ON mr.id = c.request_id
    WHERE c.id = target_conversation_id;

    IF req_status IS NULL OR req_status <> 'ACCEPTED' THEN
        RETURN FALSE;
    END IF;

    -- 3. No debe existir un bloqueo activo entre miembros en user_blocks
    SELECT EXISTS (
        SELECT 1 
        FROM public.conversation_members cm
        JOIN public.user_blocks ub 
          ON (ub.blocker_id = cm.user_id AND ub.blocked_id = caller_id)
          OR (ub.blocker_id = caller_id AND ub.blocked_id = cm.user_id)
        WHERE cm.conversation_id = target_conversation_id
          AND cm.user_id <> caller_id
    ) INTO is_blocked;

    IF is_blocked THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

-- Permiso de ejecución sobre is_conversation_active_for_user otorgado a authenticated para evaluación de RLS
REVOKE EXECUTE ON FUNCTION public.is_conversation_active_for_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_active_for_user(UUID) TO authenticated;

-- Garantizar que can_send_message siga sin estar expuesto a authenticated/anon/PUBLIC
REVOKE EXECUTE ON FUNCTION public.can_send_message(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- 2. RE-VINCULAR POLÍTICAS RLS EN MESSAGES USANDO IS_CONVERSATION_ACTIVE_FOR_USER
DROP POLICY IF EXISTS "Conversation members can view messages" ON public.messages;
CREATE POLICY "Conversation members can view messages"
    ON public.messages FOR SELECT
    TO authenticated
    USING (
        public.is_conversation_active_for_user(conversation_id)
    );

DROP POLICY IF EXISTS "Conversation members can send messages if request accepted and not blocked" ON public.messages;
CREATE POLICY "Conversation members can send messages if request accepted and not blocked"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND public.is_conversation_active_for_user(conversation_id)
    );
