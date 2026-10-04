-- ============================================================================
-- FOROFETICHE — FASE 3B.4: CRITICAL MODERATION & COHERENT PUBLICATION GATE MIGRATION
-- Migration: 20261004000027_fase3b4_critical_moderation_and_publication_gate.sql
-- ============================================================================

-- 1. SINGLE SOURCE OF TRUTH SERVER SYSTEM CONFIG TABLE
CREATE TABLE IF NOT EXISTS public.system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System config viewable by everyone" ON public.system_config;
CREATE POLICY "System config viewable by everyone"
    ON public.system_config FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Only admins can modify system config" ON public.system_config;
CREATE POLICY "Only admins can modify system config"
    ON public.system_config FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.system_config (key, value)
VALUES ('MODERATION_AI_ENABLED', 'true')
ON CONFLICT (key) DO NOTHING;

-- 2. HELPER RPC TO SYNC SERVER CONFIG (SECURITY DEFINER FOR SYSTEM SYNC)
CREATE OR REPLACE FUNCTION public.sync_ai_moderation_config(is_enabled BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.system_config (key, value, updated_at)
    VALUES ('MODERATION_AI_ENABLED', CASE WHEN is_enabled THEN 'true' ELSE 'false' END, now())
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now();
END;
$$;

-- 3. RE-DEFINE PUBLICATION GATE TRIGGER TO RESPECT AI ENABLED/DISABLED MODE
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

    -- Evaluate whether session context is privileged (service_role / postgres / background system RPC)
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

    -- If caller is a normal user AND AI moderation is enabled
    IF NOT is_mod AND ai_enabled THEN
        IF TG_OP = 'INSERT' THEN
            -- Non-moderators CANNOT insert directly with status = 'PUBLISHED' when AI is enabled
            IF NEW.status = 'PUBLISHED' THEN
                RAISE EXCEPTION 'Usuarios no moderadores no pueden publicar directamente con estado PUBLISHED cuando la moderación automática está habilitada.';
            END IF;
        ELSIF TG_OP = 'UPDATE' THEN
            -- Non-moderators CANNOT update/promote status to 'PUBLISHED' when AI is enabled
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
