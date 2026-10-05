-- ============================================================================
-- FOROFETICHE — FASE 3C.1: SECURITY & INTEGRITY HARDENING
-- Migration: 20261004000031_fase3c1_human_moderation_hardening.sql
-- ============================================================================

-- 1. MODERATION_CASES — ELIMINAR ESCRITURA DIRECTA (DENY DIRECT INSERT/UPDATE/DELETE)
ALTER TABLE public.moderation_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only moderators can view and manage moderation cases" ON public.moderation_cases;
DROP POLICY IF EXISTS "Only moderators can view moderation cases" ON public.moderation_cases;
DROP POLICY IF EXISTS "No direct insert on moderation cases" ON public.moderation_cases;
DROP POLICY IF EXISTS "No direct update on moderation cases" ON public.moderation_cases;
DROP POLICY IF EXISTS "No direct delete on moderation cases" ON public.moderation_cases;

-- SELECT policy: Only moderators and admins can view moderation cases
CREATE POLICY "Only moderators can view moderation cases"
    ON public.moderation_cases FOR SELECT
    TO authenticated
    USING (public.is_moderator(auth.uid()) OR public.is_admin(auth.uid()));

-- DENY direct INSERT
CREATE POLICY "No direct insert on moderation cases"
    ON public.moderation_cases FOR INSERT
    TO authenticated
    WITH CHECK (false);

-- DENY direct UPDATE
CREATE POLICY "No direct update on moderation cases"
    ON public.moderation_cases FOR UPDATE
    TO authenticated
    USING (false);

-- DENY direct DELETE
CREATE POLICY "No direct delete on moderation cases"
    ON public.moderation_cases FOR DELETE
    TO authenticated
    USING (false);


-- 2. MESSAGES — AISLAMIENTO DE MENSAJES PRIVADOS (DROP GLOBAL MODERATOR POLICY)
DROP POLICY IF EXISTS "Moderators can view reported messages" ON public.messages;


-- 3. RPC PARA LECTURA DE MENSAJE REPORTADO (ACCESO CONTROLADO DE MODERACIÓN)
CREATE OR REPLACE FUNCTION public.get_reported_message_details(
    case_id_param UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_id UUID;
    target_type_val TEXT;
    target_id_val UUID;
    report_exists BOOLEAN;
    msg_record RECORD;
    sender_alias_val TEXT;
    sender_avatar_val TEXT;
BEGIN
    caller_id := auth.uid();
    IF caller_id IS NULL OR NOT public.is_moderator(caller_id) THEN
        RAISE EXCEPTION 'Unauthorized: Moderator access required.';
    END IF;

    -- Obtener target_type y target_id del caso
    SELECT target_type, target_id INTO target_type_val, target_id_val
    FROM public.moderation_cases
    WHERE id = case_id_param;

    IF NOT FOUND OR target_type_val != 'MESSAGE' OR target_id_val IS NULL THEN
        RAISE EXCEPTION 'Invalid case or target is not a message.';
    END IF;

    -- Verificar que exista reporte vinculado al caso o target
    SELECT EXISTS (
        SELECT 1 FROM public.reports
        WHERE case_id = case_id_param
           OR (target_type = 'MESSAGE' AND target_id = target_id_val)
    ) INTO report_exists;

    IF NOT report_exists THEN
        RAISE EXCEPTION 'No report found for this message case.';
    END IF;

    -- Obtener datos del mensaje
    SELECT id, content, created_at, sender_id INTO msg_record
    FROM public.messages
    WHERE id = target_id_val;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Obtener perfil del remitente
    SELECT alias, avatar_url INTO sender_alias_val, sender_avatar_val
    FROM public.profiles
    WHERE id = msg_record.sender_id;

    RETURN jsonb_build_object(
        'id', msg_record.id,
        'content', msg_record.content,
        'created_at', msg_record.created_at,
        'sender_id', msg_record.sender_id,
        'sender', jsonb_build_object(
            'id', msg_record.sender_id,
            'alias', sender_alias_val,
            'avatar_url', sender_avatar_val
        )
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_reported_message_details(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_reported_message_details(UUID) TO authenticated;


-- 4. HARDEN EXECUTE_MODERATION_ACTION CON VALIDACIÓN ESTRICTA DE ACCIÓN Y TRANSICIÓN DE ESTADO
CREATE OR REPLACE FUNCTION public.execute_moderation_action(
    case_id_param UUID,
    action_type_param TEXT,
    reason_param TEXT,
    notes_param TEXT DEFAULT NULL,
    new_case_status_param TEXT DEFAULT 'RESOLVED'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_id UUID;
    target_type_val TEXT;
    target_id_val UUID;
    current_status_val TEXT;
    action_id_val UUID;
BEGIN
    -- 1. Validar actor
    caller_id := auth.uid();
    IF caller_id IS NULL OR NOT public.is_moderator(caller_id) THEN
        RAISE EXCEPTION 'Unauthorized: Moderator access required.';
    END IF;

    -- 2. Validar action_type
    IF action_type_param NOT IN ('APPROVE', 'HIDE', 'DELETE', 'REQUEST_CHANGES') THEN
        RAISE EXCEPTION 'Invalid action_type parameter.';
    END IF;

    -- 3. Validar motivo
    IF reason_param IS NULL OR trim(reason_param) = '' THEN
        RAISE EXCEPTION 'Reason parameter cannot be empty.';
    END IF;

    -- 4. Obtener datos y estado actual del caso
    SELECT target_type, target_id, status INTO target_type_val, target_id_val, current_status_val
    FROM public.moderation_cases
    WHERE id = case_id_param;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Case not found.';
    END IF;

    -- 5. Validar nuevo estado y matriz de transiciones válidas
    IF new_case_status_param NOT IN ('OPEN', 'IN_REVIEW', 'WAITING_USER', 'ESCALATED', 'RESOLVED') THEN
        RAISE EXCEPTION 'Invalid target case status.';
    END IF;

    IF current_status_val = 'OPEN' AND new_case_status_param NOT IN ('IN_REVIEW', 'RESOLVED', 'OPEN') THEN
        RAISE EXCEPTION 'Invalid case status transition from OPEN to %.', new_case_status_param;
    ELSIF current_status_val = 'IN_REVIEW' AND new_case_status_param NOT IN ('IN_REVIEW', 'WAITING_USER', 'ESCALATED', 'RESOLVED') THEN
        RAISE EXCEPTION 'Invalid case status transition from IN_REVIEW to %.', new_case_status_param;
    ELSIF current_status_val = 'WAITING_USER' AND new_case_status_param NOT IN ('WAITING_USER', 'IN_REVIEW', 'RESOLVED') THEN
        RAISE EXCEPTION 'Invalid case status transition from WAITING_USER to %.', new_case_status_param;
    ELSIF current_status_val = 'ESCALATED' AND new_case_status_param NOT IN ('ESCALATED', 'IN_REVIEW', 'RESOLVED') THEN
        RAISE EXCEPTION 'Invalid case status transition from ESCALATED to %.', new_case_status_param;
    END IF;

    -- 6. Validar existencia de target si target_id no es nulo
    IF target_type_val = 'POST' AND target_id_val IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.posts WHERE id = target_id_val) THEN
            RAISE EXCEPTION 'Target post not found.';
        END IF;

        IF action_type_param = 'HIDE' THEN
            UPDATE public.posts SET status = 'HIDDEN', updated_at = now() WHERE id = target_id_val;
        ELSIF action_type_param = 'DELETE' THEN
            UPDATE public.posts SET status = 'DELETED', updated_at = now() WHERE id = target_id_val;
        ELSIF action_type_param = 'APPROVE' THEN
            UPDATE public.posts SET status = 'PUBLISHED', updated_at = now() WHERE id = target_id_val;
        END IF;
    ELSIF target_type_val = 'COMMENT' AND target_id_val IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.comments WHERE id = target_id_val) THEN
            RAISE EXCEPTION 'Target comment not found.';
        END IF;

        IF action_type_param = 'HIDE' THEN
            UPDATE public.comments SET status = 'HIDDEN', updated_at = now() WHERE id = target_id_val;
        ELSIF action_type_param = 'DELETE' THEN
            UPDATE public.comments SET status = 'DELETED', updated_at = now() WHERE id = target_id_val;
        ELSIF action_type_param = 'APPROVE' THEN
            UPDATE public.comments SET status = 'PUBLISHED', updated_at = now() WHERE id = target_id_val;
        END IF;
    ELSIF target_type_val = 'PROFILE' AND target_id_val IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_id_val) THEN
            RAISE EXCEPTION 'Target profile not found.';
        END IF;
    ELSIF target_type_val = 'MESSAGE' AND target_id_val IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.messages WHERE id = target_id_val) THEN
            RAISE EXCEPTION 'Target message not found.';
        END IF;
    END IF;

    -- 7. Registrar la acción de moderación (derivar actor de caller_id)
    INSERT INTO public.moderation_actions (
        case_id,
        moderator_id,
        action_type,
        reason,
        created_at
    ) VALUES (
        case_id_param,
        caller_id,
        action_type_param,
        reason_param,
        now()
    )
    RETURNING id INTO action_id_val;

    -- 8. Actualizar estado del caso
    UPDATE public.moderation_cases
    SET status = new_case_status_param,
        notes = COALESCE(notes_param, notes),
        updated_at = now()
    WHERE id = case_id_param;

    -- 9. Actualizar reportes vinculados
    UPDATE public.reports
    SET status = new_case_status_param,
        updated_at = now()
    WHERE case_id = case_id_param OR (target_type = target_type_val AND target_id = target_id_val);

    -- 10. Registrar auditoría
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
        'MODERATION_' || action_type_param,
        COALESCE(target_type_val, 'MODERATION_CASE'),
        COALESCE(target_id_val, case_id_param),
        reason_param,
        jsonb_build_object('action_type', action_type_param, 'case_id', case_id_param, 'next_status', new_case_status_param),
        now()
    );

    RETURN action_id_val;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.execute_moderation_action(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_moderation_action(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;


-- 5. HARDEN APPLY_USER_SANCTION CON VALIDACIÓN DE ACCIÓN Y USUARIO EXISTENTE
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
BEGIN
    -- 1. Validar actor
    caller_id := auth.uid();
    IF caller_id IS NULL OR NOT public.is_moderator(caller_id) THEN
        RAISE EXCEPTION 'Unauthorized: Moderator access required.';
    END IF;

    -- 2. Validar tipo de sanción
    IF action_param NOT IN ('WARNING', 'TEMPORARY_RESTRICTION', 'SUSPEND', 'PERMANENT_SUSPENSION') THEN
        RAISE EXCEPTION 'Invalid sanction action parameter.';
    END IF;

    -- 3. Validar motivo
    IF reason_param IS NULL OR trim(reason_param) = '' THEN
        RAISE EXCEPTION 'Reason parameter cannot be empty.';
    END IF;

    -- 4. Validar existencia de usuario destino
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id_param) THEN
        RAISE EXCEPTION 'Target user not found.';
    END IF;

    -- 5. Validar caso si se proporciona
    IF case_id_param IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.moderation_cases WHERE id = case_id_param) THEN
            RAISE EXCEPTION 'Target case not found.';
        END IF;
    END IF;

    -- 6. Insertar sanción (derivar actor de caller_id)
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

    -- 7. Mapear acción a moderation_actions si hay caso asociado
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

    -- 8. Registrar auditoría
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


-- 6. RPC PARA CONSULTA DE BANDEJA DE MODERACIÓN CON PAGINACIÓN Y FILTROS EN DB
CREATE OR REPLACE FUNCTION public.get_moderation_cases_queue(
    status_filter TEXT DEFAULT 'ALL',
    priority_filter TEXT DEFAULT 'ALL',
    target_type_filter TEXT DEFAULT 'ALL',
    assigned_to_filter TEXT DEFAULT 'ALL',
    current_user_id_param UUID DEFAULT NULL,
    page_param INT DEFAULT 1,
    limit_param INT DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_id UUID;
    offset_val INT;
    total_count INT;
    cases_result JSONB;
BEGIN
    caller_id := auth.uid();
    IF caller_id IS NULL OR NOT public.is_moderator(caller_id) THEN
        RAISE EXCEPTION 'Unauthorized: Moderator access required.';
    END IF;

    offset_val := (GREATEST(page_param, 1) - 1) * limit_param;

    -- Calcular conteo total filtrado
    SELECT count(*) INTO total_count
    FROM public.moderation_cases mc
    WHERE (status_filter = 'ALL' OR mc.status = status_filter)
      AND (priority_filter = 'ALL' OR mc.priority = priority_filter)
      AND (target_type_filter = 'ALL' OR mc.target_type = target_type_filter)
      AND (
          assigned_to_filter = 'ALL'
          OR (assigned_to_filter = 'UNASSIGNED' AND mc.assigned_moderator_id IS NULL)
          OR (assigned_to_filter = 'ME' AND mc.assigned_moderator_id = COALESCE(current_user_id_param, caller_id))
          OR (assigned_to_filter NOT IN ('ALL', 'UNASSIGNED', 'ME') AND mc.assigned_moderator_id = assigned_to_filter::UUID)
      );

    -- Obtener elementos ordenados por prioridad y fecha
    SELECT jsonb_agg(case_row) INTO cases_result
    FROM (
        SELECT 
            mc.id,
            mc.report_id,
            mc.target_type,
            mc.target_id,
            mc.assigned_moderator_id,
            mod_p.alias AS assigned_moderator_alias,
            mc.status,
            mc.priority,
            mc.notes,
            mc.created_at,
            mc.updated_at,
            (
                SELECT count(*) FROM public.reports r WHERE r.case_id = mc.id
            ) AS reports_count,
            (
                SELECT jsonb_build_object(
                    'reason', r.reason,
                    'details', r.details,
                    'reporter_alias', rep_p.alias
                )
                FROM public.reports r
                LEFT JOIN public.profiles rep_p ON rep_p.id = r.reporter_id
                WHERE r.case_id = mc.id
                ORDER BY r.created_at ASC
                LIMIT 1
            ) AS first_report,
            (
                SELECT jsonb_build_object(
                    'model', ai.model,
                    'risk_level', ai.risk_level,
                    'flags', ai.flags,
                    'confidence', ai.confidence,
                    'reason', ai.reason,
                    'created_at', ai.created_at
                )
                FROM public.moderation_ai_results ai
                WHERE ai.case_id = mc.id OR ai.entity_id = mc.target_id
                ORDER BY ai.created_at DESC
                LIMIT 1
            ) AS latest_ai_result
        FROM public.moderation_cases mc
        LEFT JOIN public.profiles mod_p ON mod_p.id = mc.assigned_moderator_id
        WHERE (status_filter = 'ALL' OR mc.status = status_filter)
          AND (priority_filter = 'ALL' OR mc.priority = priority_filter)
          AND (target_type_filter = 'ALL' OR mc.target_type = target_type_filter)
          AND (
              assigned_to_filter = 'ALL'
              OR (assigned_to_filter = 'UNASSIGNED' AND mc.assigned_moderator_id IS NULL)
              OR (assigned_to_filter = 'ME' AND mc.assigned_moderator_id = COALESCE(current_user_id_param, caller_id))
              OR (assigned_to_filter NOT IN ('ALL', 'UNASSIGNED', 'ME') AND mc.assigned_moderator_id = assigned_to_filter::UUID)
          )
        ORDER BY 
            CASE mc.priority
                WHEN 'CRITICAL' THEN 1
                WHEN 'REVIEW' THEN 2
                ELSE 3
            END ASC,
            mc.created_at ASC
        LIMIT limit_param
        OFFSET offset_val
    ) case_row;

    RETURN jsonb_build_object(
        'cases', COALESCE(cases_result, '[]'::jsonb),
        'total', total_count,
        'page', GREATEST(page_param, 1),
        'limit', limit_param
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_moderation_cases_queue(TEXT, TEXT, TEXT, TEXT, UUID, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_moderation_cases_queue(TEXT, TEXT, TEXT, TEXT, UUID, INT, INT) TO authenticated;
