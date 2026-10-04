-- ============================================================================
-- FOROFETICHE — DATABASE MIGRATION: FASE 2A SECURITY CORRECTIONS
-- Non-destructive post counter protection, comment status sync fixes,
-- SECURITY DEFINER search_path hardening, and RPC permission revocation.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROTECT POST READ-ONLY COUNTER FIELDS (views_count, reactions_count, comments_count)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_post_readonly_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Prevent manual user modification of views_count, reactions_count, and comments_count
    IF (NEW.views_count IS DISTINCT FROM OLD.views_count) AND (current_user NOT IN ('postgres', 'supabase_admin')) THEN
        NEW.views_count := OLD.views_count;
    END IF;

    IF (NEW.reactions_count IS DISTINCT FROM OLD.reactions_count) AND (current_user NOT IN ('postgres', 'supabase_admin')) THEN
        NEW.reactions_count := OLD.reactions_count;
    END IF;

    IF (NEW.comments_count IS DISTINCT FROM OLD.comments_count) AND (current_user NOT IN ('postgres', 'supabase_admin')) THEN
        NEW.comments_count := OLD.comments_count;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_post_readonly ON public.posts;
CREATE TRIGGER trg_protect_post_readonly
    BEFORE UPDATE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.protect_post_readonly_fields();

-- ----------------------------------------------------------------------------
-- 2. HARDEN COMMENT COUNTER SYNC TRIGGER (LISTEN TO UPDATE, FILTER PUBLISHED ONLY)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_comment_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW.status = 'PUBLISHED' THEN
            UPDATE public.posts
            SET comments_count = comments_count + 1
            WHERE id = NEW.post_id;

            UPDATE public.profiles
            SET comments_count = comments_count + 1
            WHERE id = NEW.author_id;
        END IF;
        RETURN NEW;

    ELSIF (TG_OP = 'UPDATE') THEN
        -- Case: PUBLISHED -> NOT PUBLISHED (HIDDEN or DELETED)
        IF OLD.status = 'PUBLISHED' AND NEW.status <> 'PUBLISHED' THEN
            UPDATE public.posts
            SET comments_count = GREATEST(0, comments_count - 1)
            WHERE id = NEW.post_id;

            UPDATE public.profiles
            SET comments_count = GREATEST(0, comments_count - 1)
            WHERE id = NEW.author_id;

        -- Case: NOT PUBLISHED (HIDDEN or DELETED) -> PUBLISHED
        ELSIF OLD.status <> 'PUBLISHED' AND NEW.status = 'PUBLISHED' THEN
            UPDATE public.posts
            SET comments_count = comments_count + 1
            WHERE id = NEW.post_id;

            UPDATE public.profiles
            SET comments_count = comments_count + 1
            WHERE id = NEW.author_id;
        END IF;
        RETURN NEW;

    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.status = 'PUBLISHED' THEN
            UPDATE public.posts
            SET comments_count = GREATEST(0, comments_count - 1)
            WHERE id = OLD.post_id;

            UPDATE public.profiles
            SET comments_count = GREATEST(0, comments_count - 1)
            WHERE id = OLD.author_id;
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_comment_counters ON public.comments;
CREATE TRIGGER trg_sync_comment_counters
    AFTER INSERT OR UPDATE OR DELETE ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.sync_comment_counters();

-- ----------------------------------------------------------------------------
-- 3. HARDEN SECURITY DEFINER SEARCH PATH & RPC EXPLICIT PERMISSIONS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_post_views(target_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.posts
    SET views_count = views_count + 1
    WHERE id = target_post_id AND status = 'PUBLISHED';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_post_views(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_post_views(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_post_views(UUID) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.increment_post_views(UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sync_reaction_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW.post_id IS NOT NULL THEN
            UPDATE public.posts
            SET reactions_count = reactions_count + 1
            WHERE id = NEW.post_id;

            UPDATE public.profiles
            SET reactions_received = reactions_received + 1
            WHERE id = (SELECT author_id FROM public.posts WHERE id = NEW.post_id);
        END IF;

        IF NEW.comment_id IS NOT NULL THEN
            UPDATE public.profiles
            SET reactions_received = reactions_received + 1
            WHERE id = (SELECT author_id FROM public.comments WHERE id = NEW.comment_id);
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.post_id IS NOT NULL THEN
            UPDATE public.posts
            SET reactions_count = GREATEST(0, reactions_count - 1)
            WHERE id = OLD.post_id;

            UPDATE public.profiles
            SET reactions_received = GREATEST(0, reactions_received - 1)
            WHERE id = (SELECT author_id FROM public.posts WHERE id = OLD.post_id);
        END IF;

        IF OLD.comment_id IS NOT NULL THEN
            UPDATE public.profiles
            SET reactions_received = GREATEST(0, reactions_received - 1)
            WHERE id = (SELECT author_id FROM public.comments WHERE id = OLD.comment_id);
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_post_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW.status = 'PUBLISHED' THEN
            UPDATE public.profiles
            SET experiences_count = experiences_count + 1
            WHERE id = NEW.author_id;
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF OLD.status <> 'PUBLISHED' AND NEW.status = 'PUBLISHED' THEN
            UPDATE public.profiles
            SET experiences_count = experiences_count + 1
            WHERE id = NEW.author_id;
        ELSIF OLD.status = 'PUBLISHED' AND NEW.status <> 'PUBLISHED' THEN
            UPDATE public.profiles
            SET experiences_count = GREATEST(0, experiences_count - 1)
            WHERE id = NEW.author_id;
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.status = 'PUBLISHED' THEN
            UPDATE public.profiles
            SET experiences_count = GREATEST(0, experiences_count - 1)
            WHERE id = OLD.author_id;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;
