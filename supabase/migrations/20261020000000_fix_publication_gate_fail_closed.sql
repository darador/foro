-- ============================================================================
-- FOROFETICHE — SECURITY FIX: PUBLICATION GATE FAIL-CLOSED (FASE 3C)
-- Migration: 20261020000000_fix_publication_gate_fail_closed.sql
-- Status: PREPARED FOR REVIEW ONLY — DO NOT APPLY UNTIL TESTED AND APPROVED
--
-- Fixes:
-- 1. NULL propagation in privilege detection inside enforce_publication_gate()
--    (SECURITY INVOKER) and sync_ai_moderation_config() (SECURITY DEFINER).
-- 2. Adds 'PENDING_REVIEW' to public.comments status CHECK constraint and
--    aligns record_ai_moderation_result() for COMMENT entities.
-- 3. Adds RLS defense in depth on INSERT for posts/comments while preserving
--    the ability for authors to UPDATE their own already-PUBLISHED content
--    without allowing promotion of non-PUBLISHED rows to PUBLISHED.
-- 4. Hardens apply_user_sanction() and protect_profile_readonly_fields()
--    against NULL ternary bypass and SECURITY DEFINER current_user pitfalls.
--
-- This migration intentionally does not alter historical migrations, existing
-- staging data, column grants, or status defaults.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ALLOW 'PENDING_REVIEW' IN public.comments.status CHECK CONSTRAINT
-- ----------------------------------------------------------------------------
ALTER TABLE public.comments
    DROP CONSTRAINT IF EXISTS comments_status_check;

ALTER TABLE public.comments
    ADD CONSTRAINT comments_status_check
    CHECK (status IN ('PENDING_REVIEW', 'PUBLISHED', 'HIDDEN', 'DELETED'));

-- ----------------------------------------------------------------------------
-- 2. FAIL-CLOSED PUBLICATION GATE TRIGGER FUNCTION (SECURITY INVOKER)
-- ----------------------------------------------------------------------------
-- Note on SECURITY INVOKER vs SECURITY DEFINER:
-- Do NOT use current_user IN ('postgres', 'supabase_admin') here: when this
-- trigger fires inside a SECURITY DEFINER RPC owned by postgres (such as
-- soft_delete_post), current_user becomes the function owner ('postgres').
-- However, current_user = 'service_role' IS safe because no SECURITY DEFINER
-- function is owned by service_role, and PostgREST sets role to service_role.
CREATE OR REPLACE FUNCTION public.enforce_publication_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    is_privileged BOOLEAN := FALSE;
    is_mod BOOLEAN := FALSE;
    ai_enabled BOOLEAN := TRUE;
    config_val TEXT;
BEGIN
    SELECT value
      INTO config_val
      FROM public.system_config
     WHERE key = 'MODERATION_AI_ENABLED';

    -- Missing/NULL config defaults to enabled (fail closed).
    IF config_val IS NOT NULL THEN
        ai_enabled := (config_val = 'true');
    END IF;

    is_privileged :=
        COALESCE(session_user IN ('postgres', 'supabase_admin'), FALSE)
        OR COALESCE(current_user = 'service_role', FALSE)
        OR COALESCE((auth.jwt() ->> 'role') = 'service_role', FALSE)
        OR COALESCE(
            current_setting('request.jwt.claim.role', TRUE) = 'service_role',
            FALSE
        );

    IF is_privileged IS TRUE THEN
        is_mod := TRUE;
    ELSIF auth.uid() IS NOT NULL THEN
        is_mod := COALESCE(public.is_moderator(auth.uid()) IS TRUE, FALSE);
    ELSE
        is_mod := FALSE;
    END IF;

    -- Explicit IS NOT TRUE prevents NULL from ever granting privileges.
    IF is_mod IS NOT TRUE THEN
        IF TG_OP = 'INSERT' THEN
            IF NEW.status IN ('HIDDEN', 'DELETED') THEN
                RAISE EXCEPTION 'Usuarios no moderadores no pueden insertar contenido directamente en estado %.', NEW.status;
            END IF;

            IF ai_enabled IS TRUE AND NEW.status = 'PUBLISHED' THEN
                RAISE EXCEPTION 'Usuarios no moderadores no pueden publicar directamente con estado PUBLISHED cuando la moderación automática está habilitada.';
            END IF;
        ELSIF TG_OP = 'UPDATE' THEN
            -- Prevent non-moderators from reactivating or mutating status of moderated/deleted rows
            IF OLD.status IN ('HIDDEN', 'DELETED')
               AND NEW.status IS DISTINCT FROM OLD.status THEN
                RAISE EXCEPTION 'Usuarios no moderadores no pueden reactivar ni cambiar el estado de contenido moderado o eliminado.';
            END IF;

            -- Prevent non-moderators from setting HIDDEN directly
            IF NEW.status = 'HIDDEN'
               AND OLD.status IS DISTINCT FROM 'HIDDEN' THEN
                RAISE EXCEPTION 'Usuarios no moderadores no pueden asignar estado HIDDEN directamente.';
            END IF;

            -- Prevent non-moderators from promoting non-PUBLISHED content to PUBLISHED
            -- while preserving edits to content that is already PUBLISHED (OLD.status = 'PUBLISHED').
            IF NEW.status = 'PUBLISHED'
               AND (OLD.status IS DISTINCT FROM 'PUBLISHED'
                    OR NEW.status IS DISTINCT FROM OLD.status) THEN
                RAISE EXCEPTION 'Usuarios no moderadores no pueden promover el estado de contenido a PUBLISHED.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_publication_gate_posts ON public.posts;
CREATE TRIGGER trg_enforce_publication_gate_posts
    BEFORE INSERT OR UPDATE ON public.posts
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_publication_gate();

DROP TRIGGER IF EXISTS trg_enforce_publication_gate_comments ON public.comments;
CREATE TRIGGER trg_enforce_publication_gate_comments
    BEFORE INSERT OR UPDATE ON public.comments
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_publication_gate();

REVOKE EXECUTE ON FUNCTION public.enforce_publication_gate() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. RLS DEFENSE IN DEPTH FOR POSTS & COMMENTS (INSERT & UPDATE)
-- ----------------------------------------------------------------------------
-- On INSERT: a non-moderator cannot insert a PUBLISHED row while AI moderation
-- is enabled (missing config defaults to enabled / fail-closed).
-- On UPDATE: ownership/moderator check is enforced via RLS, while status
-- promotion protection is enforced by enforce_publication_gate() (and column
-- privileges on posts), preserving the ability to edit already-PUBLISHED rows.

DROP POLICY IF EXISTS "Verified users can create posts" ON public.posts;
CREATE POLICY "Verified users can create posts"
    ON public.posts FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = author_id
        AND EXISTS (
            SELECT 1
              FROM public.profiles
             WHERE id = auth.uid()
               AND email_verified = TRUE
        )
        AND (
            status IS DISTINCT FROM 'PUBLISHED'
            OR public.is_moderator(auth.uid()) IS TRUE
            OR COALESCE(
                (SELECT value = 'true'
                   FROM public.system_config
                  WHERE key = 'MODERATION_AI_ENABLED'),
                TRUE
            ) IS FALSE
        )
    );

DROP POLICY IF EXISTS "Authors can update own posts" ON public.posts;
CREATE POLICY "Authors can update own posts"
    ON public.posts FOR UPDATE
    TO authenticated
    USING (
        author_id = auth.uid()
        OR public.is_moderator(auth.uid()) IS TRUE
    )
    WITH CHECK (
        author_id = auth.uid()
        OR public.is_moderator(auth.uid()) IS TRUE
    );

DROP POLICY IF EXISTS "Verified users can create comments" ON public.comments;
CREATE POLICY "Verified users can create comments"
    ON public.comments FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = author_id
        AND EXISTS (
            SELECT 1
              FROM public.profiles
             WHERE id = auth.uid()
               AND email_verified = TRUE
        )
        AND (
            status IS DISTINCT FROM 'PUBLISHED'
            OR public.is_moderator(auth.uid()) IS TRUE
            OR COALESCE(
                (SELECT value = 'true'
                   FROM public.system_config
                  WHERE key = 'MODERATION_AI_ENABLED'),
                TRUE
            ) IS FALSE
        )
    );

DROP POLICY IF EXISTS "Authors can update own comments" ON public.comments;
CREATE POLICY "Authors can update own comments"
    ON public.comments FOR UPDATE
    TO authenticated
    USING (
        author_id = auth.uid()
        OR public.is_moderator(auth.uid()) IS TRUE
    )
    WITH CHECK (
        author_id = auth.uid()
        OR public.is_moderator(auth.uid()) IS TRUE
    );

-- ----------------------------------------------------------------------------
-- 4. ALIGN record_ai_moderation_result() FOR COMMENTS IN PENDING_REVIEW / REVIEW
-- ----------------------------------------------------------------------------
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
    -- Serializar por entidad dentro de la transacción para evitar creación concurrente de casos duplicados
    PERFORM pg_advisory_xact_lock(
        hashtext('record_ai_moderation_result:' || COALESCE(entity_type_param, '')),
        hashtext(COALESCE(entity_id_param::text, ''))
    );

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

    IF content_version_id_param IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.content_versions
            WHERE id = content_version_id_param
              AND entity_type = entity_type_param
              AND entity_id = entity_id_param
        ) THEN
            RAISE EXCEPTION 'Content version not found or mismatched with entity.';
        END IF;

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

    IF risk_level_param IN ('REVIEW', 'CRITICAL') THEN
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

        IF risk_level_param = 'CRITICAL' THEN
            IF entity_type_param = 'POST' THEN
                UPDATE public.posts
                   SET status = 'HIDDEN', updated_at = now()
                 WHERE id = entity_id_param
                   AND status IN ('PUBLISHED', 'DRAFT', 'PENDING_REVIEW');
            ELSIF entity_type_param = 'COMMENT' THEN
                UPDATE public.comments
                   SET status = 'HIDDEN', updated_at = now()
                 WHERE id = entity_id_param
                   AND status IN ('PUBLISHED', 'PENDING_REVIEW');
            END IF;
        ELSIF risk_level_param = 'REVIEW' THEN
            IF entity_type_param = 'POST' THEN
                UPDATE public.posts
                   SET status = 'PENDING_REVIEW', updated_at = now()
                 WHERE id = entity_id_param
                   AND status = 'PUBLISHED';
            ELSIF entity_type_param = 'COMMENT' THEN
                UPDATE public.comments
                   SET status = 'PENDING_REVIEW', updated_at = now()
                 WHERE id = entity_id_param
                   AND status = 'PUBLISHED';
            END IF;
        END IF;
    END IF;

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
            entity_id_param::text,
            reason_param,
            jsonb_build_object(
                'ai_result_id', ai_result_id,
                'case_id', new_case_id,
                'model', model_param,
                'risk_level', risk_level_param,
                'flags', flags_param,
                'confidence', confidence_param
            ),
            now()
        );
    END IF;

    RETURN ai_result_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_ai_moderation_result(TEXT, UUID, UUID, TEXT, TEXT, TEXT[], NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_moderation_result(TEXT, UUID, UUID, TEXT, TEXT, TEXT[], NUMERIC, TEXT) TO service_role;

-- ----------------------------------------------------------------------------
-- 5. HARDEN sync_ai_moderation_config(), apply_user_sanction(), AND
--    protect_profile_readonly_fields() AGAINST NULL TERNARY BYPASS
-- ----------------------------------------------------------------------------

-- 5.1 sync_ai_moderation_config (SECURITY DEFINER):
-- Do NOT use current_user here because inside SECURITY DEFINER it evaluates to
-- the function owner. Use NULL-safe COALESCE on session_user, JWT role, and is_admin().
CREATE OR REPLACE FUNCTION public.sync_ai_moderation_config(is_enabled BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_id UUID := auth.uid();
    is_privileged BOOLEAN := FALSE;
    old_val TEXT;
    new_val TEXT;
BEGIN
    is_privileged :=
        COALESCE(session_user IN ('postgres', 'supabase_admin'), FALSE)
        OR COALESCE((auth.jwt() ->> 'role') = 'service_role', FALSE)
        OR COALESCE(
            current_setting('request.jwt.claim.role', TRUE) = 'service_role',
            FALSE
        )
        OR COALESCE(
            CASE WHEN caller_id IS NOT NULL THEN public.is_admin(caller_id) IS TRUE ELSE FALSE END,
            FALSE
        );

    IF is_privileged IS NOT TRUE THEN
        RAISE EXCEPTION 'Acceso denegado. Solo los administradores pueden modificar la configuración del sistema.';
    END IF;

    SELECT value INTO old_val
    FROM public.system_config
    WHERE key = 'MODERATION_AI_ENABLED';

    new_val := CASE WHEN is_enabled IS TRUE THEN 'true' ELSE 'false' END;

    IF old_val IS DISTINCT FROM new_val THEN
        INSERT INTO public.system_config (key, value, updated_at)
        VALUES ('MODERATION_AI_ENABLED', new_val, now())
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = now();

        INSERT INTO public.audit_logs (
            actor_id,
            action,
            entity_type,
            entity_id,
            reason,
            old_data,
            new_data,
            created_at
        ) VALUES (
            caller_id,
            'UPDATE_SYSTEM_CONFIG',
            'SYSTEM_CONFIG',
            'MODERATION_AI_ENABLED',
            'Cambio de configuración de moderación por IA',
            jsonb_build_object('key', 'MODERATION_AI_ENABLED', 'value', COALESCE(old_val, 'false')),
            jsonb_build_object('key', 'MODERATION_AI_ENABLED', 'value', new_val),
            now()
        );
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_ai_moderation_config(BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_ai_moderation_config(BOOLEAN) TO service_role;

-- 5.2 apply_user_sanction (SECURITY DEFINER):
-- Preserves 20261004000032_fase3c2_final_security_hardening.sql implementation,
-- hardening only is_valid_case_user with COALESCE(..., FALSE) and IS NOT TRUE.
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
    -- 1. Validar actor (solamente moderador o admin, fail-closed ante NULL)
    caller_id := auth.uid();
    IF caller_id IS NULL OR COALESCE(public.is_moderator(caller_id) IS TRUE, FALSE) IS NOT TRUE THEN
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

    -- 6. Validar integridad de case_id y pertenencia al target_user_id_param (NULL-safe fail-closed)
    IF case_id_param IS NOT NULL THEN
        SELECT target_type, target_id INTO case_target_type, case_target_id
        FROM public.moderation_cases
        WHERE id = case_id_param;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Target case not found.';
        END IF;

        IF case_target_type = 'PROFILE' THEN
            is_valid_case_user := COALESCE(case_target_id = target_user_id_param, FALSE);
        ELSIF case_target_type = 'POST' THEN
            SELECT author_id INTO case_author_id FROM public.posts WHERE id = case_target_id;
            is_valid_case_user := COALESCE(case_author_id = target_user_id_param, FALSE);
        ELSIF case_target_type = 'COMMENT' THEN
            SELECT author_id INTO case_author_id FROM public.comments WHERE id = case_target_id;
            is_valid_case_user := COALESCE(case_author_id = target_user_id_param, FALSE);
        ELSIF case_target_type = 'MESSAGE' THEN
            SELECT sender_id INTO case_author_id FROM public.messages WHERE id = case_target_id;
            is_valid_case_user := COALESCE(case_author_id = target_user_id_param, FALSE);
        ELSE
            is_valid_case_user := FALSE;
        END IF;

        IF is_valid_case_user IS NOT TRUE THEN
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

-- 5.3 protect_profile_readonly_fields (SECURITY INVOKER):
-- Replace SECURITY DEFINER (where current_user was always 'postgres') with
-- SECURITY INVOKER so unprivileged users cannot spoof email_verified = TRUE.
CREATE OR REPLACE FUNCTION public.protect_profile_readonly_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    is_privileged BOOLEAN := FALSE;
BEGIN
    is_privileged :=
        COALESCE(session_user IN ('postgres', 'supabase_admin'), FALSE)
        OR COALESCE(current_user = 'service_role', FALSE)
        OR COALESCE((auth.jwt() ->> 'role') = 'service_role', FALSE)
        OR COALESCE(
            current_setting('request.jwt.claim.role', TRUE) = 'service_role',
            FALSE
        );

    -- Direct updates on profiles (pg_trigger_depth() <= 1) by unprivileged callers
    -- cannot modify email_verified or derived counters.
    IF (pg_trigger_depth() <= 1) AND (is_privileged IS NOT TRUE) THEN
        IF (NEW.email_verified IS DISTINCT FROM OLD.email_verified) THEN
            NEW.email_verified := OLD.email_verified;
        END IF;

        IF (NEW.experiences_count IS DISTINCT FROM OLD.experiences_count) THEN
            NEW.experiences_count := OLD.experiences_count;
        END IF;

        IF (NEW.comments_count IS DISTINCT FROM OLD.comments_count) THEN
            NEW.comments_count := OLD.comments_count;
        END IF;

        IF (NEW.reactions_received IS DISTINCT FROM OLD.reactions_received) THEN
            NEW.reactions_received := OLD.reactions_received;
        END IF;
    END IF;

    -- Prevent manual modification of badges unless caller is privileged or admin
    IF (NEW.badges IS DISTINCT FROM OLD.badges)
       AND (is_privileged IS NOT TRUE)
       AND (CASE WHEN auth.uid() IS NOT NULL THEN COALESCE(public.is_admin(auth.uid()) IS TRUE, FALSE) ELSE FALSE END IS NOT TRUE) THEN
        NEW.badges := OLD.badges;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_profile_readonly_fields() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. CONTENT VERSIONS: OWN-VERSION SELECT RLS & SEQUENTIAL INTEGER VERSIONING
-- ----------------------------------------------------------------------------
-- 6.1 Allow authors to SELECT only their own content_versions rows (edited_by = auth.uid()
--     on their own POST or COMMENT) so INSERT ... RETURNING id and version_number lookup
--     succeed without exposing versions created by other users or moderators.
--     The existing "Only moderators can view content versions" policy from 000021
--     remains intact for moderators.
DROP POLICY IF EXISTS "Authors can view own content versions" ON public.content_versions;
CREATE POLICY "Authors can view own content versions"
    ON public.content_versions FOR SELECT
    TO authenticated
    USING (
        edited_by = auth.uid()
        AND (
            (
                entity_type = 'POST'
                AND EXISTS (
                    SELECT 1
                      FROM public.posts
                     WHERE id = entity_id
                       AND author_id = auth.uid()
                )
            )
            OR (
                entity_type = 'COMMENT'
                AND EXISTS (
                    SELECT 1
                      FROM public.comments
                     WHERE id = entity_id
                       AND author_id = auth.uid()
                )
            )
        )
    );

-- 6.2 Enforce collision-free sequential 32-bit INTEGER version_number per (entity_type, entity_id)
CREATE OR REPLACE FUNCTION public.assign_content_version_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    max_version INTEGER;
BEGIN
    PERFORM pg_advisory_xact_lock(
        hashtext('content_versions:' || COALESCE(NEW.entity_type, '') || ':' || COALESCE(NEW.entity_id::text, ''))
    );

    SELECT COALESCE(MAX(version_number), 0)
      INTO max_version
      FROM public.content_versions
     WHERE entity_type = NEW.entity_type
       AND entity_id = NEW.entity_id;

    IF NEW.version_number IS NULL OR NEW.version_number <= max_version THEN
        NEW.version_number := max_version + 1;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_content_version_number() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_assign_content_version_number ON public.content_versions;
CREATE TRIGGER trg_assign_content_version_number
    BEFORE INSERT ON public.content_versions
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_content_version_number();
