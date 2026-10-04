-- ============================================================================
-- FOROFETICHE — FASE 2C-4.1: HARDENING DE INTEGRIDAD DE NOTIFICACIONES
-- Migration: 20261004000018_fase2c41_notifications_security_hardening.sql
-- ============================================================================

-- 1. HARDENING DE PERMISOS DE UPDATE A NIVEL DE COLUMNA SOBRE PUBLIC.NOTIFICATIONS
-- Revocar UPDATE general a nivel de tabla para evitar que los usuarios modifiquen actor_id, type, entity_type, entity_id, user_id o created_at.
REVOKE UPDATE ON public.notifications FROM PUBLIC, anon, authenticated;

-- Otorgar UPDATE a usuarios autenticados ÚNICAMENTE sobre la columna read_at
GRANT UPDATE (read_at) ON public.notifications TO authenticated;

-- 2. HARDENING DE FUNCIONES TRIGGER INTERNAS DE NOTIFICACIONES
-- Revocar EXECUTE explícitamente a clientes (PUBLIC, anon, authenticated) para evitar ejecuciones arbitrarias vía RPC.
REVOKE EXECUTE ON FUNCTION public.handle_message_request_notification() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_message_notification() FROM PUBLIC, anon, authenticated;

-- 3. REFORZAR GRANTS SOBRE RPCS CONTROLADAS DE CLIENTE
REVOKE EXECUTE ON FUNCTION public.mark_notification_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_unread_notifications_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unread_notifications_count() TO authenticated;
