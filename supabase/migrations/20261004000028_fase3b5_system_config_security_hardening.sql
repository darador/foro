-- ============================================================================
-- FOROFETICHE — FASE 3B.5: SYSTEM CONFIG SECURITY HARDENING
-- Migration: 20261004000028_fase3b5_system_config_security_hardening.sql
-- ============================================================================

-- 1. HARDENED SYNC_AI_MODERATION_CONFIG WITH EXPLICIT AUTHORIZATION CHECK & AUDIT LOGGING
CREATE OR REPLACE FUNCTION public.sync_ai_moderation_config(is_enabled BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_id UUID := auth.uid();
    is_privileged BOOLEAN;
    old_val TEXT;
    new_val TEXT;
BEGIN
    -- Explicit Authorization Check: caller MUST be admin or internal service role
    is_privileged := (
        session_user IN ('postgres', 'supabase_admin') OR
        current_setting('request.jwt.claim.role', true) = 'service_role' OR
        (caller_id IS NOT NULL AND public.is_admin(caller_id))
    );

    IF NOT is_privileged THEN
        RAISE EXCEPTION 'Acceso denegado. Solo los administradores pueden modificar la configuración del sistema.';
    END IF;

    SELECT value INTO old_val
    FROM public.system_config
    WHERE key = 'MODERATION_AI_ENABLED';

    new_val := CASE WHEN is_enabled THEN 'true' ELSE 'false' END;

    IF old_val IS DISTINCT FROM new_val THEN
        INSERT INTO public.system_config (key, value, updated_at)
        VALUES ('MODERATION_AI_ENABLED', new_val, now())
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = now();

        -- Audit log recording administrative configuration change
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

-- 2. REVOKE EXECUTE FROM PUBLIC, ANON, AUTHENTICATED
REVOKE EXECUTE ON FUNCTION public.sync_ai_moderation_config(BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_ai_moderation_config(BOOLEAN) TO service_role;

-- 3. VERIFY STRICT RLS POLICIES ON SYSTEM_CONFIG
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
