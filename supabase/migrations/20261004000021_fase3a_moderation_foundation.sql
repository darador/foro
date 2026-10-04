-- ============================================================================
-- FOROFETICHE — FASE 3A: MODERACIÓN BASE
-- Migration: 20261004000021_fase3a_moderation_foundation.sql
-- ============================================================================

-- 1. CREAR TABLA USER_MODERATION_ACTIONS (SANCIONES ADMINISTRATIVAS A USUARIOS)
CREATE TABLE IF NOT EXISTS public.user_moderation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('WARNING', 'TEMPORARY_RESTRICTION', 'SUSPEND', 'PERMANENT_SUSPENSION')),
    reason TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. AMPLIAR TABLA REPORTS Y MODERATION_CASES
ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES public.moderation_cases(id) ON DELETE SET NULL;

ALTER TABLE public.moderation_cases
    ADD COLUMN IF NOT EXISTS target_type TEXT CHECK (target_type IN ('POST', 'COMMENT', 'PROFILE', 'MESSAGE')),
    ADD COLUMN IF NOT EXISTS target_id UUID;

-- 3. ÍNDICES DE MODERACIÓN
CREATE INDEX IF NOT EXISTS idx_reports_case_id ON public.reports(case_id);
CREATE INDEX IF NOT EXISTS idx_reports_target ON public.reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_target ON public.moderation_cases(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_priority_status ON public.moderation_cases(priority, status, created_at);
CREATE INDEX IF NOT EXISTS idx_user_moderation_actions_user ON public.user_moderation_actions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_versions_entity ON public.content_versions(entity_type, entity_id, version_number DESC);

-- 4. REFORZAR POLÍTICAS RLS EN TABLAS DE MODERACIÓN
ALTER TABLE public.user_moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- User Moderation Actions
DROP POLICY IF EXISTS "Only moderators can view and manage user moderation actions" ON public.user_moderation_actions;
CREATE POLICY "Only moderators can view and manage user moderation actions"
    ON public.user_moderation_actions FOR ALL
    TO authenticated
    USING (public.is_moderator(auth.uid()))
    WITH CHECK (public.is_moderator(auth.uid()));

-- Content Versions
DROP POLICY IF EXISTS "Authors can insert content versions" ON public.content_versions;
CREATE POLICY "Authors can insert content versions"
    ON public.content_versions FOR INSERT
    TO authenticated
    WITH CHECK (edited_by = auth.uid());

DROP POLICY IF EXISTS "Only moderators can view content versions" ON public.content_versions;
CREATE POLICY "Only moderators can view content versions"
    ON public.content_versions FOR SELECT
    TO authenticated
    USING (public.is_moderator(auth.uid()));

DROP POLICY IF EXISTS "No direct update on content versions" ON public.content_versions;
CREATE POLICY "No direct update on content versions"
    ON public.content_versions FOR UPDATE
    TO authenticated
    USING (false);

DROP POLICY IF EXISTS "No direct delete on content versions" ON public.content_versions;
CREATE POLICY "No direct delete on content versions"
    ON public.content_versions FOR DELETE
    TO authenticated
    USING (false);

-- Audit Logs
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

-- 5. RPC SECURITY DEFINER PARA CREACIÓN DE REPORTES Y ASOCIACIÓN AUTOMÁTICA DE CASOS
CREATE OR REPLACE FUNCTION public.submit_report_with_case(
    target_type_param TEXT,
    target_id_param UUID,
    reason_param TEXT,
    details_param TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_id UUID;
    calc_risk TEXT;
    existing_case_id UUID;
    new_case_id UUID;
    final_case_id UUID;
    new_report_id UUID;
BEGIN
    caller_id := auth.uid();
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- Validar target_type
    IF target_type_param NOT IN ('POST', 'COMMENT', 'PROFILE', 'MESSAGE') THEN
        RAISE EXCEPTION 'Invalid target_type.';
    END IF;

    -- Determinar riesgo / prioridad
    IF reason_param IN ('MINOR', 'POSSIBLE_MINOR', 'NON_CONSENSUAL', 'NON_CONSENSUAL_CONTENT', 'THREAT', 'THREATS_EXTORTION', 'EXTORTION') THEN
        calc_risk := 'CRITICAL';
    ELSIF reason_param IN ('PERSONAL_DATA', 'HARASSMENT') THEN
        calc_risk := 'REVIEW';
    ELSE
        calc_risk := 'LOW';
    END IF;

    -- Ocultamiento preventivo si es reporte CRITICAL en POST o COMMENT
    IF calc_risk = 'CRITICAL' THEN
        IF target_type_param = 'POST' THEN
            UPDATE public.posts SET status = 'HIDDEN' WHERE id = target_id_param AND status = 'PUBLISHED';
        ELSIF target_type_param = 'COMMENT' THEN
            UPDATE public.comments SET status = 'HIDDEN' WHERE id = target_id_param AND status = 'PUBLISHED';
        END IF;
    END IF;

    -- Buscar si ya existe un caso abierto para este target
    SELECT id INTO existing_case_id
    FROM public.moderation_cases
    WHERE target_type = target_type_param
      AND target_id = target_id_param
      AND status IN ('OPEN', 'IN_REVIEW', 'WAITING_USER', 'ESCALATED')
    ORDER BY created_at DESC
    LIMIT 1;

    IF existing_case_id IS NOT NULL THEN
        final_case_id := existing_case_id;

        -- Elevar prioridad a CRITICAL si el nuevo reporte es crítico
        IF calc_risk = 'CRITICAL' THEN
            UPDATE public.moderation_cases
            SET priority = 'CRITICAL', updated_at = now()
            WHERE id = existing_case_id;
        END IF;
    ELSE
        -- Crear nuevo caso de moderación
        INSERT INTO public.moderation_cases (
            report_id,
            target_type,
            target_id,
            status,
            priority,
            created_at,
            updated_at
        ) VALUES (
            NULL,
            target_type_param,
            target_id_param,
            'OPEN',
            calc_risk,
            now(),
            now()
        )
        RETURNING id INTO new_case_id;

        final_case_id := new_case_id;
    END IF;

    -- Insertar reporte vinculado al caso
    INSERT INTO public.reports (
        reporter_id,
        target_type,
        target_id,
        reason,
        details,
        status,
        case_id,
        created_at,
        updated_at
    ) VALUES (
        caller_id,
        target_type_param,
        target_id_param,
        reason_param,
        details_param,
        'OPEN',
        final_case_id,
        now(),
        now()
    )
    RETURNING id INTO new_report_id;

    -- Vincular report_id inicial si la fila del caso aún tiene report_id nulo
    UPDATE public.moderation_cases
    SET report_id = new_report_id
    WHERE id = final_case_id AND report_id IS NULL;

    RETURN new_report_id;
END;
$$;

-- Permisos sobre submit_report_with_case
REVOKE EXECUTE ON FUNCTION public.submit_report_with_case(TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_report_with_case(TEXT, UUID, TEXT, TEXT) TO authenticated;
