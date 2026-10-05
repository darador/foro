-- ============================================================================
-- FOROFETICHE — FASE 3C: PANEL DE MODERACIÓN HUMANA
-- Migration: 20261004000030_fase3c_human_moderation_panel.sql
-- ============================================================================

-- 1. ACTUALIZAR IS_MODERATOR PARA INCLUIR DIRECTORY_ADMIN, MODERATOR Y SUPERADMIN
CREATE OR REPLACE FUNCTION public.is_moderator(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admin_roles 
        WHERE user_id = target_user_id AND role IN ('SUPERADMIN', 'DIRECTORY_ADMIN', 'MODERATOR')
    );
$$;

REVOKE EXECUTE ON FUNCTION public.is_moderator(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_moderator(UUID) TO authenticated, service_role;

-- 2. REFORZAR POLÍTICAS RLS PARA ACCESO DE MODERADORES A TABLAS DE MODERACIÓN
ALTER TABLE public.moderation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_ai_results ENABLE ROW LEVEL SECURITY;

-- Moderation Cases
DROP POLICY IF EXISTS "Only moderators can view and manage moderation cases" ON public.moderation_cases;
CREATE POLICY "Only moderators can view and manage moderation cases"
    ON public.moderation_cases FOR ALL
    TO authenticated
    USING (public.is_moderator(auth.uid()))
    WITH CHECK (public.is_moderator(auth.uid()));

-- Reports
DROP POLICY IF EXISTS "Only moderators can view all reports" ON public.reports;
CREATE POLICY "Only moderators can view all reports"
    ON public.reports FOR SELECT
    TO authenticated
    USING (reporter_id = auth.uid() OR public.is_moderator(auth.uid()));

-- Moderation Actions (Append-Only)
DROP POLICY IF EXISTS "Only moderators can view moderation actions" ON public.moderation_actions;
CREATE POLICY "Only moderators can view moderation actions"
    ON public.moderation_actions FOR SELECT
    TO authenticated
    USING (public.is_moderator(auth.uid()));

DROP POLICY IF EXISTS "Only moderators can insert moderation actions" ON public.moderation_actions;
CREATE POLICY "Only moderators can insert moderation actions"
    ON public.moderation_actions FOR INSERT
    TO authenticated
    WITH CHECK (public.is_moderator(auth.uid()) AND moderator_id = auth.uid());

DROP POLICY IF EXISTS "No direct update on moderation actions" ON public.moderation_actions;
CREATE POLICY "No direct update on moderation actions"
    ON public.moderation_actions FOR UPDATE
    TO authenticated
    USING (false);

DROP POLICY IF EXISTS "No direct delete on moderation actions" ON public.moderation_actions;
CREATE POLICY "No direct delete on moderation actions"
    ON public.moderation_actions FOR DELETE
    TO authenticated
    USING (false);

-- User Moderation Actions (Append-Only)
DROP POLICY IF EXISTS "Only moderators can view user moderation actions" ON public.user_moderation_actions;
CREATE POLICY "Only moderators can view user moderation actions"
    ON public.user_moderation_actions FOR SELECT
    TO authenticated
    USING (public.is_moderator(auth.uid()));

DROP POLICY IF EXISTS "Only moderators can insert user moderation actions" ON public.user_moderation_actions;
CREATE POLICY "Only moderators can insert user moderation actions"
    ON public.user_moderation_actions FOR INSERT
    TO authenticated
    WITH CHECK (public.is_moderator(auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "No direct update on user moderation actions" ON public.user_moderation_actions;
CREATE POLICY "No direct update on user moderation actions"
    ON public.user_moderation_actions FOR UPDATE
    TO authenticated
    USING (false);

DROP POLICY IF EXISTS "No direct delete on user moderation actions" ON public.user_moderation_actions;
CREATE POLICY "No direct delete on user moderation actions"
    ON public.user_moderation_actions FOR DELETE
    TO authenticated
    USING (false);

-- Audit Logs (Read for moderators, insert strictly via SECURITY DEFINER RPCs)
DROP POLICY IF EXISTS "Only moderators or admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Only moderators or admins can view audit logs"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (public.is_moderator(auth.uid()) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "No direct insert on audit logs" ON public.audit_logs;
CREATE POLICY "No direct insert on audit logs"
    ON public.audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (false);

DROP POLICY IF EXISTS "No direct update on audit logs" ON public.audit_logs;
CREATE POLICY "No direct update on audit logs"
    ON public.audit_logs FOR UPDATE
    TO authenticated
    USING (false);

DROP POLICY IF EXISTS "No direct delete on audit logs" ON public.audit_logs;
CREATE POLICY "No direct delete on audit logs"
    ON public.audit_logs FOR DELETE
    TO authenticated
    USING (false);

-- Moderation AI Results (Immutable, viewable by moderators)
DROP POLICY IF EXISTS "Only moderators or admins can view moderation ai results" ON public.moderation_ai_results;
CREATE POLICY "Only moderators or admins can view moderation ai results"
    ON public.moderation_ai_results FOR SELECT
    TO authenticated
    USING (public.is_moderator(auth.uid()) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "No direct insert on moderation ai results" ON public.moderation_ai_results;
CREATE POLICY "No direct insert on moderation ai results"
    ON public.moderation_ai_results FOR INSERT
    TO authenticated
    WITH CHECK (false);

DROP POLICY IF EXISTS "No direct update on moderation ai results" ON public.moderation_ai_results;
CREATE POLICY "No direct update on moderation ai results"
    ON public.moderation_ai_results FOR UPDATE
    TO authenticated
    USING (false);

DROP POLICY IF EXISTS "No direct delete on moderation ai results" ON public.moderation_ai_results;
CREATE POLICY "No direct delete on moderation ai results"
    ON public.moderation_ai_results FOR DELETE
    TO authenticated
    USING (false);
