-- ============================================================================
-- FOROFETICHE — FASE 3B.3: PUBLICATION GATE SERVER-SIDE GUARANTEE MIGRATION
-- Migration: 20261004000026_fase3b3_publication_gate_hardening.sql
-- ============================================================================

-- Trigger function enforcing server-side publication gate protection
CREATE OR REPLACE FUNCTION public.enforce_publication_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    is_privileged BOOLEAN;
    is_mod BOOLEAN;
BEGIN
    -- Evaluate whether session context is privileged (service_role / postgres / internal system calls)
    is_privileged := (
        session_user IN ('postgres', 'supabase_admin') OR
        current_setting('request.jwt.claim.role', true) = 'service_role' OR
        auth.uid() IS NULL
    );

    IF NOT is_privileged THEN
        is_mod := public.is_moderator(auth.uid());
    ELSE
        is_mod := TRUE;
    END IF;

    -- If caller is a normal user (not service role and not moderator)
    IF NOT is_mod THEN
        IF TG_OP = 'INSERT' THEN
            -- Non-moderators CANNOT insert directly with status = 'PUBLISHED'
            IF NEW.status = 'PUBLISHED' THEN
                RAISE EXCEPTION 'Usuarios no moderadores no pueden publicar directamente con estado PUBLISHED cuando la moderación automática está habilitada.';
            END IF;
        ELSIF TG_OP = 'UPDATE' THEN
            -- Non-moderators CANNOT update/promote status to 'PUBLISHED'
            IF NEW.status = 'PUBLISHED' AND (OLD.status IS DISTINCT FROM 'PUBLISHED' OR NEW.status IS DISTINCT FROM OLD.status) THEN
                RAISE EXCEPTION 'Usuarios no moderadores no pueden promover el estado de contenido a PUBLISHED.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Apply trigger to posts
DROP TRIGGER IF EXISTS trg_enforce_publication_gate_posts ON public.posts;
CREATE TRIGGER trg_enforce_publication_gate_posts
    BEFORE INSERT OR UPDATE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.enforce_publication_gate();

-- Apply trigger to comments
DROP TRIGGER IF EXISTS trg_enforce_publication_gate_comments ON public.comments;
CREATE TRIGGER trg_enforce_publication_gate_comments
    BEFORE INSERT OR UPDATE ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.enforce_publication_gate();
