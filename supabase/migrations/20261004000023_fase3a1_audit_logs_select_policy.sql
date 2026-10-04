-- ============================================================================
-- FOROFETICHE — FASE 3A.1: CORRECCIÓN DE ACCESO A AUDIT LOGS PARA MODERADORES
-- Migration: 20261004000023_fase3a1_audit_logs_select_policy.sql
-- ============================================================================

-- Drop historical variants of SELECT policy on audit_logs
DROP POLICY IF EXISTS "Only admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Only moderators or admins can view audit logs" ON public.audit_logs;

-- Re-create single unified SELECT policy for moderators and admins
CREATE POLICY "Only moderators or admins can view audit logs"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (public.is_moderator(auth.uid()) OR public.is_admin(auth.uid()));
