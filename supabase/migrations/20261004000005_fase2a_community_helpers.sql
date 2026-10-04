-- ============================================================================
-- FOROFETICHE — DATABASE MIGRATION: FASE 2A COMMUNITY HELPERS
-- Automatic counter synchronization triggers & helper RPCs for posts, comments,
-- reactions, and profiles.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. POST VIEWS INCREMENT RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_post_views(target_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.posts
    SET views_count = views_count + 1
    WHERE id = target_post_id AND status = 'PUBLISHED';
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. REACTION COUNTER SYNC TRIGGER
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_reaction_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

DROP TRIGGER IF EXISTS trg_sync_reaction_counters ON public.reactions;
CREATE TRIGGER trg_sync_reaction_counters
    AFTER INSERT OR DELETE ON public.reactions
    FOR EACH ROW EXECUTE FUNCTION public.sync_reaction_counters();

-- ----------------------------------------------------------------------------
-- 3. COMMENT COUNTER SYNC TRIGGER
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_comment_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.posts
        SET comments_count = comments_count + 1
        WHERE id = NEW.post_id;

        UPDATE public.profiles
        SET comments_count = comments_count + 1
        WHERE id = NEW.author_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.posts
        SET comments_count = GREATEST(0, comments_count - 1)
        WHERE id = OLD.post_id;

        UPDATE public.profiles
        SET comments_count = GREATEST(0, comments_count - 1)
        WHERE id = OLD.author_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_comment_counters ON public.comments;
CREATE TRIGGER trg_sync_comment_counters
    AFTER INSERT OR DELETE ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.sync_comment_counters();

-- ----------------------------------------------------------------------------
-- 4. POST COUNTER SYNC TRIGGER
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_post_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

DROP TRIGGER IF EXISTS trg_sync_post_counters ON public.posts;
CREATE TRIGGER trg_sync_post_counters
    AFTER INSERT OR UPDATE OR DELETE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.sync_post_counters();
