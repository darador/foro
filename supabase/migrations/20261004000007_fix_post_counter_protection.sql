-- ============================================================================
-- FOROFETICHE — DATABASE MIGRATION: FASE 2A POST COUNTER PROTECTION BLOCKER FIX
-- Column-Level Privileges & Trigger Hardening for posts counter fields.
-- Prevents direct user manipulation of views_count, reactions_count, and comments_count
-- via REST/PostgREST while preserving internal SECURITY DEFINER trigger/RPC updates.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. COLUMN-LEVEL PRIVILEGES FOR public.posts
-- ----------------------------------------------------------------------------
-- Revoke table-level INSERT and UPDATE privileges on public.posts from anon, authenticated, and PUBLIC
REVOKE INSERT, UPDATE ON public.posts FROM authenticated, anon, PUBLIC;

-- Grant INSERT privilege ONLY on user-editable columns to authenticated role
GRANT INSERT (
    id,
    author_id,
    type,
    category_id,
    title,
    slug,
    content,
    province,
    city,
    status,
    created_at,
    updated_at
) ON public.posts TO authenticated;

-- Grant UPDATE privilege ONLY on user-editable columns to authenticated role
GRANT UPDATE (
    title,
    slug,
    content,
    category_id,
    province,
    city,
    status,
    updated_at
) ON public.posts TO authenticated;

-- Explicitly maintain full privileges for service_role and postgres
GRANT ALL PRIVILEGES ON public.posts TO service_role, postgres;

-- ----------------------------------------------------------------------------
-- 2. HARDENED TRIGGER-LEVEL DEFENSE (protect_post_readonly_fields)
-- ----------------------------------------------------------------------------
-- Replace function without SECURITY DEFINER to correctly evaluate caller context (SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.protect_post_readonly_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    -- If update is initiated directly on posts (pg_trigger_depth() <= 1) by an unprivileged session_user
    IF (pg_trigger_depth() <= 1) AND (session_user NOT IN ('postgres', 'supabase_admin')) THEN
        IF (NEW.views_count IS DISTINCT FROM OLD.views_count) THEN
            NEW.views_count := OLD.views_count;
        END IF;

        IF (NEW.reactions_count IS DISTINCT FROM OLD.reactions_count) THEN
            NEW.reactions_count := OLD.reactions_count;
        END IF;

        IF (NEW.comments_count IS DISTINCT FROM OLD.comments_count) THEN
            NEW.comments_count := OLD.comments_count;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_post_readonly ON public.posts;
CREATE TRIGGER trg_protect_post_readonly
    BEFORE UPDATE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.protect_post_readonly_fields();
