-- ============================================================================
-- FOROFETICHE — FASE 3B.1: SECURITY & FLOW HARDENING FOR AI MODERATION
-- Migration: 20261004000025_fase3b1_moderation_ai_hardening.sql
-- ============================================================================

-- 1. UNIQUE INDEX DE IDEMPOTENCIA POR VERSIÓN DE CONTENIDO
CREATE UNIQUE INDEX IF NOT EXISTS uq_moderation_ai_results_version
    ON public.moderation_ai_results(entity_type, entity_id, content_version_id)
    WHERE content_version_id IS NOT NULL;

-- 2. REVOCAR EXECUTE DIRECTO A CLIENTES AUTENTICADOS (EVITAR LLAMADAS ARBITRARIAS DESDE NAVEGADOR)
REVOKE EXECUTE ON FUNCTION public.record_ai_moderation_result(TEXT, UUID, UUID, TEXT, TEXT, TEXT[], NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;

-- 3. REDEFINIR RPC RECORD_AI_MODERATION_RESULT CON VALIDACIÓN ESTRICTA DE ENTIDAD Y VERSIÓN
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
    existing_ai_id UUID;
    ai_result_id UUID;
BEGIN
    -- Validaciones de entidad
    IF entity_type_param = 'POST' THEN
        IF NOT EXISTS (SELECT 1 FROM public.posts WHERE id = entity_id_param) THEN
            RAISE EXCEPTION 'Target post not found for AI analysis.';
        END IF;
    ELSIF entity_type_param = 'COMMENT' THEN
        IF NOT EXISTS (SELECT 1 FROM public.comments WHERE id = entity_id_param) THEN
            RAISE EXCEPTION 'Target comment not found for AI analysis.';
        END IF;
    ELSE
        RAISE EXCEPTION 'Invalid entity_type for AI analysis.';
    END IF;

    -- Validar versión si fue provista
    IF content_version_id_param IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.content_versions
            WHERE id = content_version_id_param
              AND entity_type = entity_type_param
              AND entity_id = entity_id_param
        ) THEN
            RAISE EXCEPTION 'Content version not found or mismatched with entity.';
        END IF;

        -- Idempotencia real DB: si la misma versión ya fue analizada, retornar el id existente
        SELECT id INTO existing_ai_id
        FROM public.moderation_ai_results
        WHERE entity_type = entity_type_param
          AND entity_id = entity_id_param
          AND content_version_id = content_version_id_param
        LIMIT 1;

        IF existing_ai_id IS NOT NULL THEN
            RETURN existing_ai_id;
        END IF;
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
    ON CONFLICT (entity_type, entity_id, content_version_id) WHERE content_version_id IS NOT NULL
    DO UPDATE SET created_at = moderation_ai_results.created_at
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

-- Revocar permisos EXECUTE explícitamente
REVOKE EXECUTE ON FUNCTION public.record_ai_moderation_result(TEXT, UUID, UUID, TEXT, TEXT, TEXT[], NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
