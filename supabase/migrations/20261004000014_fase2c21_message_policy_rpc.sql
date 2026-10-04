-- ============================================================================
-- FOROFETICHE — FASE 2C-2.1: HELPER PARA CONSULTA SEGURA DE RECEPCIÓN DE MENSAJES
-- Migration: 20261004000014_fase2c21_message_policy_rpc.sql
-- ============================================================================

-- RPC segura para consultar únicamente si un usuario acepta solicitudes de mensajes (sin exponer user_settings)
CREATE OR REPLACE FUNCTION public.can_receive_message_request(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT message_policy FROM public.user_settings WHERE user_id = target_user_id),
        'EVERYONE'
    ) = 'EVERYONE';
$$;

REVOKE EXECUTE ON FUNCTION public.can_receive_message_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_receive_message_request(UUID) TO authenticated;
