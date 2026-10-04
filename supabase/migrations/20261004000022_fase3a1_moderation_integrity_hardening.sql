-- ============================================================================
-- FOROFETICHE — FASE 3A.1: SECURITY & INTEGRITY CORRECTIONS
-- Migration: 20261004000022_fase3a1_moderation_integrity_hardening.sql
-- ============================================================================

-- 1. ACTUALIZAR SUBMIT_REPORT_WITH_CASE CON VALIDACIÓN REAL DE EXISTENCIA DE TARGET_ID
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

    -- Validar existencia real de target_id según target_type
    IF target_type_param = 'POST' THEN
        IF NOT EXISTS (SELECT 1 FROM public.posts WHERE id = target_id_param) THEN
            RAISE EXCEPTION 'Target post not found.';
        END IF;
    ELSIF target_type_param = 'COMMENT' THEN
        IF NOT EXISTS (SELECT 1 FROM public.comments WHERE id = target_id_param) THEN
            RAISE EXCEPTION 'Target comment not found.';
        END IF;
    ELSIF target_type_param = 'PROFILE' THEN
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_id_param) THEN
            RAISE EXCEPTION 'Target profile not found.';
        END IF;
    ELSIF target_type_param = 'MESSAGE' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.messages m
            WHERE m.id = target_id_param
              AND (
                m.sender_id = caller_id
                OR EXISTS (
                  SELECT 1 FROM public.conversation_members cm
                  WHERE cm.conversation_id = m.conversation_id
                    AND cm.user_id = caller_id
                )
              )
        ) THEN
            RAISE EXCEPTION 'Target message not found or unauthorized to report.';
        END IF;
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

REVOKE EXECUTE ON FUNCTION public.submit_report_with_case(TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_report_with_case(TEXT, UUID, TEXT, TEXT) TO authenticated;

-- 2. RPC ATÓMICA PARA ACCIÓN DE MODERACIÓN
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
    action_id_val UUID;
BEGIN
    caller_id := auth.uid();
    IF caller_id IS NULL OR NOT public.is_moderator(caller_id) THEN
        RAISE EXCEPTION 'Unauthorized: Moderator access required.';
    END IF;

    -- Obtener datos del caso
    SELECT target_type, target_id INTO target_type_val, target_id_val
    FROM public.moderation_cases
    WHERE id = case_id_param;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Case not found.';
    END IF;

    -- Modificar estado de contenido según corresponda
    IF target_type_val = 'POST' AND target_id_val IS NOT NULL THEN
        IF action_type_param = 'HIDE' THEN
            UPDATE public.posts SET status = 'HIDDEN', updated_at = now() WHERE id = target_id_val;
        ELSIF action_type_param = 'DELETE' THEN
            UPDATE public.posts SET status = 'DELETED', updated_at = now() WHERE id = target_id_val;
        ELSIF action_type_param = 'APPROVE' THEN
            UPDATE public.posts SET status = 'PUBLISHED', updated_at = now() WHERE id = target_id_val;
        END IF;
    ELSIF target_type_val = 'COMMENT' AND target_id_val IS NOT NULL THEN
        IF action_type_param = 'HIDE' THEN
            UPDATE public.comments SET status = 'HIDDEN', updated_at = now() WHERE id = target_id_val;
        ELSIF action_type_param = 'DELETE' THEN
            UPDATE public.comments SET status = 'DELETED', updated_at = now() WHERE id = target_id_val;
        ELSIF action_type_param = 'APPROVE' THEN
            UPDATE public.comments SET status = 'PUBLISHED', updated_at = now() WHERE id = target_id_val;
        END IF;
    END IF;

    -- Registrar la acción de moderación (derivar actor de caller_id)
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

    -- Actualizar estado del caso
    UPDATE public.moderation_cases
    SET status = new_case_status_param,
        notes = COALESCE(notes_param, notes),
        updated_at = now()
    WHERE id = case_id_param;

    -- Actualizar reportes vinculados
    UPDATE public.reports
    SET status = new_case_status_param,
        updated_at = now()
    WHERE case_id = case_id_param OR (target_type = target_type_val AND target_id = target_id_val);

    -- Registrar auditoría
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

-- 3. RPC ATÓMICA PARA APLICAR SANCIÓN A USUARIO
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
    caller_id := auth.uid();
    IF caller_id IS NULL OR NOT public.is_moderator(caller_id) THEN
        RAISE EXCEPTION 'Unauthorized: Moderator access required.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id_param) THEN
        RAISE EXCEPTION 'Target user not found.';
    END IF;

    -- Insertar la sanción (derivar actor de caller_id)
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
        expires_at_param,
        caller_id,
        now()
    )
    RETURNING id INTO sanction_id_val;

    -- Mapear acción a moderation_actions si hay caso asociado
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

    -- Registrar auditoría
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

-- 4. RPC ATÓMICA PARA ASIGNACIÓN DE CASO
CREATE OR REPLACE FUNCTION public.assign_moderation_case(
    case_id_param UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_id UUID;
    current_status TEXT;
    next_status TEXT;
BEGIN
    caller_id := auth.uid();
    IF caller_id IS NULL OR NOT public.is_moderator(caller_id) THEN
        RAISE EXCEPTION 'Unauthorized: Moderator access required.';
    END IF;

    SELECT status INTO current_status
    FROM public.moderation_cases
    WHERE id = case_id_param;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Case not found.';
    END IF;

    next_status := CASE WHEN current_status = 'OPEN' THEN 'IN_REVIEW' ELSE current_status END;

    UPDATE public.moderation_cases
    SET assigned_moderator_id = caller_id,
        status = next_status,
        updated_at = now()
    WHERE id = case_id_param;

    RETURN case_id_param;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_moderation_case(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_moderation_case(UUID) TO authenticated;

-- 5. REFORZAR POLÍTICAS RLS APPEND-ONLY Y AUTORÍA DE CONTENIDO
DROP POLICY IF EXISTS "Authors can insert content versions" ON public.content_versions;
CREATE POLICY "Authors can insert content versions"
    ON public.content_versions FOR INSERT
    TO authenticated
    WITH CHECK (
        edited_by = auth.uid()
        AND (
            (entity_type = 'POST' AND EXISTS (SELECT 1 FROM public.posts WHERE id = entity_id AND author_id = auth.uid()))
            OR
            (entity_type = 'COMMENT' AND EXISTS (SELECT 1 FROM public.comments WHERE id = entity_id AND author_id = auth.uid()))
            OR
            public.is_moderator(auth.uid())
        )
    );

DROP POLICY IF EXISTS "Only moderators can view and manage moderation actions" ON public.moderation_actions;
DROP POLICY IF EXISTS "Only moderators can view moderation actions" ON public.moderation_actions;
DROP POLICY IF EXISTS "Only moderators can insert moderation actions" ON public.moderation_actions;

CREATE POLICY "Only moderators can view moderation actions"
    ON public.moderation_actions FOR SELECT
    TO authenticated
    USING (public.is_moderator(auth.uid()));

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

DROP POLICY IF EXISTS "Only moderators can view and manage user moderation actions" ON public.user_moderation_actions;

CREATE POLICY "Only moderators can view user moderation actions"
    ON public.user_moderation_actions FOR SELECT
    TO authenticated
    USING (public.is_moderator(auth.uid()));

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

-- 6. ACCESO CONTROLADO DE MODERADORES A MENSAJES REPORTADOS
DROP POLICY IF EXISTS "Moderators can view reported messages" ON public.messages;
CREATE POLICY "Moderators can view reported messages"
    ON public.messages FOR SELECT
    TO authenticated
    USING (
        public.is_moderator(auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.moderation_cases mc
            WHERE mc.target_type = 'MESSAGE'
              AND mc.target_id = messages.id
        )
    );
