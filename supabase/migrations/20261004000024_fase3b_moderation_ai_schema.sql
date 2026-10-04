-- ============================================================================
-- FOROFETICHE — FASE 3B: MODERACIÓN AUTOMÁTICA CON IA
-- Migration: 20261004000024_fase3b_moderation_ai_schema.sql
-- ============================================================================

-- 1. ADAPTAR TABLA MODERATION_AI_RESULTS
ALTER TABLE public.moderation_ai_results
    ALTER COLUMN case_id DROP NOT NULL;

ALTER TABLE public.moderation_ai_results
    ADD COLUMN IF NOT EXISTS entity_type TEXT CHECK (entity_type IN ('POST', 'COMMENT')),
    ADD COLUMN IF NOT EXISTS entity_id UUID,
    ADD COLUMN IF NOT EXISTS content_version_id UUID REFERENCES public.content_versions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reason TEXT;

-- 2. ÍNDICES DE DESEMPAPEÑO E IDEMPOTENCIA
CREATE INDEX IF NOT EXISTS idx_moderation_ai_results_entity
    ON public.moderation_ai_results(entity_type, entity_id, content_version_id);

CREATE INDEX IF NOT EXISTS idx_moderation_ai_results_case
    ON public.moderation_ai_results(case_id);

-- 3. REFORZAR POLÍTICAS RLS (SOLO MODERADORES/ADMINS PUEDEN VER, CLIENTE NO PUEDE INSERTAR/UPDATE/DELETE DIRECTO)
ALTER TABLE public.moderation_ai_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only moderators can view and create moderation AI results" ON public.moderation_ai_results;
DROP POLICY IF EXISTS "Only moderators can view moderation AI results" ON public.moderation_ai_results;
DROP POLICY IF EXISTS "No direct insert on moderation AI results" ON public.moderation_ai_results;
DROP POLICY IF EXISTS "No direct update on moderation AI results" ON public.moderation_ai_results;
DROP POLICY IF EXISTS "No direct delete on moderation AI results" ON public.moderation_ai_results;

CREATE POLICY "Only moderators can view moderation AI results"
    ON public.moderation_ai_results FOR SELECT
    TO authenticated
    USING (public.is_moderator(auth.uid()) OR public.is_admin(auth.uid()));

CREATE POLICY "No direct insert on moderation AI results"
    ON public.moderation_ai_results FOR INSERT
    TO authenticated
    WITH CHECK (false);

CREATE POLICY "No direct update on moderation AI results"
    ON public.moderation_ai_results FOR UPDATE
    TO authenticated
    USING (false);

CREATE POLICY "No direct delete on moderation AI results"
    ON public.moderation_ai_results FOR DELETE
    TO authenticated
    USING (false);

-- 4. RPC SECURITY DEFINER PARA REGISTRAR RESULTADO DE IA Y ACCIÓN AUTOMÁTICA
CREATE OR REPLACE FUNCTION public.record_ai_moderation_result(
    entity_type_param TEXT,
    entity_id_param UUID,
    content_version_id_param UUID,
    model_param TEXT,
    risk_level_param TEXT,
    flags_param TEXT[],
    confidence_param NUMERIC,
    reason_param TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_case_id UUID;
    existing_case_id UUID;
    ai_result_id UUID;
BEGIN
    -- Validaciones de parámetros
    IF entity_type_param NOT IN ('POST', 'COMMENT') THEN
        RAISE EXCEPTION 'Invalid entity_type for AI analysis.';
    END IF;

    IF risk_level_param NOT IN ('LOW', 'REVIEW', 'CRITICAL') THEN
        RAISE EXCEPTION 'Invalid risk_level.';
    END IF;

    -- Manejo de creación/asociación de caso de moderación si es REVIEW o CRITICAL
    IF risk_level_param IN ('REVIEW', 'CRITICAL') THEN
        -- Buscar si ya existe un caso abierto para esta entidad
        SELECT id INTO existing_case_id
        FROM public.moderation_cases
        WHERE target_type = entity_type_param
          AND target_id = entity_id_param
          AND status IN ('OPEN', 'IN_REVIEW', 'WAITING_USER', 'ESCALATED')
        ORDER BY created_at DESC
        LIMIT 1;

        IF existing_case_id IS NOT NULL THEN
            new_case_id := existing_case_id;

            IF risk_level_param = 'CRITICAL' THEN
                UPDATE public.moderation_cases
                SET priority = 'CRITICAL', updated_at = now()
                WHERE id = existing_case_id;
            END IF;
        ELSE
            -- Crear nuevo caso de moderación derivado de la señal de IA
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
                entity_type_param,
                entity_id_param,
                'OPEN',
                risk_level_param,
                now(),
                now()
            )
            RETURNING id INTO new_case_id;
        END IF;

        -- Ocultamiento preventivo si el riesgo es CRITICAL
        IF risk_level_param = 'CRITICAL' THEN
            IF entity_type_param = 'POST' THEN
                UPDATE public.posts SET status = 'HIDDEN', updated_at = now() WHERE id = entity_id_param AND status IN ('PUBLISHED', 'DRAFT', 'PENDING_REVIEW');
            ELSIF entity_type_param = 'COMMENT' THEN
                UPDATE public.comments SET status = 'HIDDEN', updated_at = now() WHERE id = entity_id_param AND status = 'PUBLISHED';
            END IF;
        ELSIF risk_level_param = 'REVIEW' THEN
            IF entity_type_param = 'POST' THEN
                UPDATE public.posts SET status = 'PENDING_REVIEW', updated_at = now() WHERE id = entity_id_param AND status = 'PUBLISHED';
            END IF;
        END IF;
    END IF;

    -- Insertar el registro de IA
    INSERT INTO public.moderation_ai_results (
        case_id,
        entity_type,
        entity_id,
        content_version_id,
        model,
        risk_level,
        flags,
        confidence,
        reason,
        created_at
    ) VALUES (
        new_case_id,
        entity_type_param,
        entity_id_param,
        content_version_id_param,
        model_param,
        risk_level_param,
        flags_param,
        confidence_param,
        reason_param,
        now()
    )
    RETURNING id INTO ai_result_id;

    -- Registrar auditoría si hubo señal REVIEW o CRITICAL
    IF risk_level_param IN ('REVIEW', 'CRITICAL') THEN
        INSERT INTO public.audit_logs (
            actor_id,
            action,
            entity_type,
            entity_id,
            reason,
            new_data,
            created_at
        ) VALUES (
            NULL,
            'AI_CLASSIFICATION_' || risk_level_param,
            entity_type_param,
            entity_id_param,
            reason_param,
            jsonb_build_object(
                'risk_level', risk_level_param,
                'flags', flags_param,
                'confidence', confidence_param,
                'case_id', new_case_id
            ),
            now()
        );
    END IF;

    RETURN ai_result_id;
END;
$$;

-- Permisos sobre RPC
REVOKE EXECUTE ON FUNCTION public.record_ai_moderation_result(TEXT, UUID, UUID, TEXT, TEXT, TEXT[], NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_ai_moderation_result(TEXT, UUID, UUID, TEXT, TEXT, TEXT[], NUMERIC, TEXT) TO authenticated;
