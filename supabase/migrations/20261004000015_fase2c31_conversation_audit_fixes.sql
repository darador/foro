-- ============================================================================
-- FOROFETICHE — FASE 2C-3.1: CORRECCIONES DE AUDITORÍA DE CONVERSACIONES
-- Migration: 20261004000015_fase2c31_conversation_audit_fixes.sql
-- ============================================================================

-- 1. CORREGIR POLÍTICA SELECT EN CONVERSATION_MEMBERS
-- Permite a un miembro leer los datos de todos los participantes de sus propias conversaciones,
-- pero le impidiendo consultar o enumerar miembros de conversaciones a las que no pertenece.

DROP POLICY IF EXISTS "Members view own conversation memberships" ON public.conversation_members;
DROP POLICY IF EXISTS "Members can view co-members of own conversations" ON public.conversation_members;

CREATE POLICY "Members can view co-members of own conversations"
    ON public.conversation_members FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_members cm
            WHERE cm.conversation_id = conversation_members.conversation_id
              AND cm.user_id = auth.uid()
        )
    );

-- 2. TRIGGER AUTOMÁTICO PARA ACTUALIZAR CONVERSATIONS.UPDATED_AT AL INSERTAR MENSAJE
-- Garantiza el ordenamiento por actividad en la bandeja de conversaciones sin otorgar UPDATE directo a los usuarios.

CREATE OR REPLACE FUNCTION public.handle_new_message_update_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.conversations
    SET updated_at = now()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_inserted_update_conversation ON public.messages;
CREATE TRIGGER on_message_inserted_update_conversation
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_message_update_conversation();
