-- ============================================================================
-- FOROFETICHE — FASE 3C.2: FINAL SECURITY HARDENING
-- Migration: 20261004000032_fase3c2_final_security_hardening.sql
-- ============================================================================

-- 1. RE-DEFINIR APPLY_USER_SANCTION CON VALIDACIÓN DE EXPIRES_AT E INTEGRIDAD CASE_ID ↔ TARGET_USER_ID
CREATE OR REPLACE FUNCTION public.apply_user_sanction(
    target_user_id_param UUID,
    action_param TEXT,
    reason_param TEXT,
    expires_at_param TIMESTAMPTZ DEFAULT NULL,
    case_id_param UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_id UUID;
    sanction_id_val UUID;
    mapped_action_type TEXT;
    case_target_type TEXT;
    case_target_id UUID;
    case_author_id UUID;
    is_valid_case_user BOOLEAN := false;
BEGIN
    -- 1. Validar actor (solamente moderador o admin)
    caller_id := auth.uid();
    IF caller_id IS NULL OR NOT public.is_moderator(caller_id) THEN
        RAISE EXCEPTION 'Unauthorized: Moderator access required.';
    END IF;

    -- 2. Validar tipo de sanción
    IF action_param NOT IN ('WARNING', 'TEMPORARY_RESTRICTION', 'SUSPEND', 'PERMANENT_SUSPENSION') THEN
        RAISE EXCEPTION 'Invalid sanction action parameter.';
    END IF;

    -- 3. Validar coherencia temporal de expires_at
    IF action_param = 'WARNING' THEN
        IF expires_at_param IS NOT NULL THEN
            RAISE EXCEPTION 'Warning sanction must not have an expiration date.';
        END IF;
    ELSIF action_param IN ('TEMPORARY_RESTRICTION', 'SUSPEND') THEN
        IF expires_at_param IS NULL THEN
            RAISE EXCEPTION 'Temporary sanction requires an expiration date.';
        END IF;
        IF expires_at_param <= now() THEN
            RAISE EXCEPTION 'Expiration date must be in the future.';
        END IF;
    ELSIF action_param = 'PERMANENT_SUSPENSION' THEN
        IF expires_at_param IS NOT NULL THEN
            RAISE EXCEPTION 'Permanent suspension sanction must not have an expiration date.';
        END IF;
    END IF;

    -- 4. Validar motivo
    IF reason_param IS NULL OR trim(reason_param) = '' THEN
        RAISE EXCEPTION 'Reason parameter cannot be empty.';
    END IF;

    -- 5. Validar existencia de usuario destino
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id_param) THEN
        RAISE EXCEPTION 'Target user not found.';
    END IF;

    -- 6. Validar integridad de case_id y pertenencia al target_user_id_param
    IF case_id_param IS NOT NULL THEN
        SELECT target_type, target_id INTO case_target_type, case_target_id
        FROM public.moderation_cases
        WHERE id = case_id_param;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Target case not found.';
        END IF;

        IF case_target_type = 'PROFILE' THEN
            is_valid_case_user := (case_target_id = target_user_id_param);
        ELSIF case_target_type = 'POST' THEN
            SELECT author_id INTO case_author_id FROM public.posts WHERE id = case_target_id;
            is_valid_case_user := (case_author_id = target_user_id_param);
        ELSIF case_target_type = 'COMMENT' THEN
            SELECT author_id INTO case_author_id FROM public.comments WHERE id = case_target_id;
            is_valid_case_user := (case_author_id = target_user_id_param);
        ELSIF case_target_type = 'MESSAGE' THEN
            SELECT sender_id INTO case_author_id FROM public.messages WHERE id = case_target_id;
            is_valid_case_user := (case_author_id = target_user_id_param);
        END IF;

        IF NOT is_valid_case_user THEN
            RAISE EXCEPTION 'Target user does not match the case target content author or profile.';
        END IF;
    END IF;

    -- 7. Insertar sanción (derivar actor de caller_id)
    INSERT INTO public.user_moderation_actions (
        user_id,
        action,
        reason,
        expires_at,
        created_by,
        created_at
    ) VALUES (
        target_user_id_param,
        action_param,
        reason_param,
        CASE WHEN action_param = 'PERMANENT_SUSPENSION' THEN NULL ELSE expires_at_param END,
        caller_id,
        now()
    )
    RETURNING id INTO sanction_id_val;

    -- 8. Mapear acción a moderation_actions si hay caso asociado
    IF case_id_param IS NOT NULL THEN
        IF action_param = 'TEMPORARY_RESTRICTION' THEN
            mapped_action_type := 'RESTRICT_POSTS';
        ELSIF action_param = 'SUSPEND' THEN
            mapped_action_type := 'SUSPEND';
        ELSIF action_param = 'PERMANENT_SUSPENSION' THEN
            mapped_action_type := 'BAN';
        ELSE
            mapped_action_type := 'WARN';
        END IF;

        INSERT INTO public.moderation_actions (
            case_id,
            moderator_id,
            action_type,
            target_user_id,
            reason,
            created_at
        ) VALUES (
            case_id_param,
            caller_id,
            mapped_action_type,
            target_user_id_param,
            reason_param,
            now()
        );
    END IF;

    -- 9. Registrar auditoría
    INSERT INTO public.audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        reason,
        new_data,
        created_at
    ) VALUES (
        caller_id,
        'USER_SANCTION_' || action_param,
        'USER',
        target_user_id_param,
        reason_param,
        jsonb_build_object('action', action_param, 'expires_at', expires_at_param, 'case_id', case_id_param),
        now()
    );

    RETURN sanction_id_val;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_user_sanction(UUID, TEXT, TEXT, TIMESTAMPTZ, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_user_sanction(UUID, TEXT, TEXT, TIMESTAMPTZ, UUID) TO authenticated;
