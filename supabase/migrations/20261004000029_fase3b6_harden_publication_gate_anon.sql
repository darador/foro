-- ============================================================================
-- FOROFETICHE — FASE 3B.6: HARDEN PUBLICATION GATE ANONYMOUS CONTEXT
-- Migration: 20261004000029_fase3b6_harden_publication_gate_anon.sql
-- ============================================================================

-- Redefine enforce_publication_gate() removing any auth.uid() IS NULL privilege fallback
CREATE OR REPLACE FUNCTION public.enforce_publication_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    is_privileged BOOLEAN;
    is_mod BOOLEAN;
    ai_enabled BOOLEAN := true;
    config_val TEXT;
BEGIN
    -- Query single source of truth system config for AI moderation mode
    SELECT value INTO config_val
    FROM public.system_config
    WHERE key = 'MODERATION_AI_ENABLED';

    IF config_val IS NOT NULL THEN
        ai_enabled := (config_val = 'true');
    END IF;

    -- Evaluate whether session context is privileged (postgres/supabase_admin or service_role ONLY)
    -- NEVER grant implicit privileges to anonymous callers (auth.uid() IS NULL)
    is_privileged := (
        session_user IN ('postgres', 'supabase_admin') OR
        current_setting('request.jwt.claim.role', true) = 'service_role'
    );

    IF NOT is_privileged THEN
        IF auth.uid() IS NOT NULL THEN
            is_mod := public.is_moderator(auth.uid());
        ELSE
            is_mod := FALSE;
        END IF;
    ELSE
        is_mod := TRUE;
    END IF;

    -- If caller is a non-privileged normal or anonymous user AND AI moderation is enabled
    IF NOT is_mod AND ai_enabled THEN
        IF TG_OP = 'INSERT' THEN
            -- Non-moderators and anonymous callers CANNOT insert directly with status = 'PUBLISHED' when AI is enabled
            IF NEW.status = 'PUBLISHED' THEN
                RAISE EXCEPTION 'Usuarios no moderadores no pueden publicar directamente con estado PUBLISHED cuando la moderación automática está habilitada.';
            END IF;
        ELSIF TG_OP = 'UPDATE' THEN
            -- Non-moderators and anonymous callers CANNOT update/promote status to 'PUBLISHED' when AI is enabled
            IF NEW.status = 'PUBLISHED' AND (OLD.status IS DISTINCT FROM 'PUBLISHED' OR NEW.status IS DISTINCT FROM OLD.status) THEN
                RAISE EXCEPTION 'Usuarios no moderadores no pueden promover el estado de contenido a PUBLISHED.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Re-apply trigger to posts
DROP TRIGGER IF EXISTS trg_enforce_publication_gate_posts ON public.posts;
CREATE TRIGGER trg_enforce_publication_gate_posts
    BEFORE INSERT OR UPDATE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.enforce_publication_gate();

-- Re-apply trigger to comments
DROP TRIGGER IF EXISTS trg_enforce_publication_gate_comments ON public.comments;
CREATE TRIGGER trg_enforce_publication_gate_comments
    BEFORE INSERT OR UPDATE ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.enforce_publication_gate();
