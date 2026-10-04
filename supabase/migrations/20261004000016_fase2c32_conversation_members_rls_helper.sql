-- ============================================================================
-- FOROFETICHE — FASE 2C-3.2: HELPER DE SEGURIDAD PARA RLS DE CONVERSATION_MEMBERS
-- Migration: 20261004000016_fase2c32_conversation_members_rls_helper.sql
-- ============================================================================

-- 1. HELPER SECURITY DEFINER PARA COMPROBAR PERTENENCIA A CONVERSACIÓN SIN RECURSIÓN RLS
CREATE OR REPLACE FUNCTION public.is_user_member_of_conversation(target_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.conversation_members
        WHERE conversation_id = target_conversation_id
          AND user_id = auth.uid()
    );
$$;

-- Permisos sobre el helper
REVOKE EXECUTE ON FUNCTION public.is_user_member_of_conversation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_user_member_of_conversation(UUID) TO authenticated;

-- 2. RE-VINCULAR POLÍTICA SELECT EN CONVERSATION_MEMBERS USANDO EL HELPER
DROP POLICY IF EXISTS "Members view own conversation memberships" ON public.conversation_members;
DROP POLICY IF EXISTS "Members can view co-members of own conversations" ON public.conversation_members;

CREATE POLICY "Members can view co-members of own conversations"
    ON public.conversation_members FOR SELECT
    TO authenticated
    USING (
        public.is_user_member_of_conversation(conversation_id)
    );
