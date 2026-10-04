-- ============================================================================
-- FOROFETICHE — DATABASE MIGRATION: FASE 2A FIX POST STATUS MODERATION BYPASS
-- Revokes UPDATE permission on posts.status from authenticated role to prevent
-- authors from un-hiding moderated posts or altering status directly via PostgREST.
-- Author soft delete is encapsulated in dedicated SECURITY DEFINER RPC soft_delete_post.
-- Moderator status updates are encapsulated in SECURITY DEFINER RPC moderate_post_status.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. REVOKE UPDATE ON posts.status FROM authenticated
-- ----------------------------------------------------------------------------
REVOKE UPDATE ON public.posts FROM authenticated, anon, PUBLIC;

GRANT UPDATE (
    title,
    slug,
    content,
    category_id,
    province,
    city,
    updated_at
) ON public.posts TO authenticated;

-- Ensure service_role and postgres retain full privileges
GRANT ALL PRIVILEGES ON public.posts TO service_role, postgres;

-- ----------------------------------------------------------------------------
-- 2. AUTHOR SOFT DELETE RPC (soft_delete_post)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_post(target_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado.';
    END IF;

    -- Verify caller is the author of the post (or a moderator)
    IF NOT EXISTS (
        SELECT 1 FROM public.posts
        WHERE id = target_post_id
          AND (author_id = auth.uid() OR public.is_moderator(auth.uid()))
    ) THEN
        RAISE EXCEPTION 'No tienes permiso para eliminar esta publicación.';
    END IF;

    UPDATE public.posts
    SET status = 'DELETED',
        updated_at = now()
    WHERE id = target_post_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.soft_delete_post(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.soft_delete_post(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.soft_delete_post(UUID) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.soft_delete_post(UUID) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. MODERATOR POST STATUS RPC (moderate_post_status)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.moderate_post_status(target_post_id UUID, new_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_moderator(auth.uid()) THEN
        RAISE EXCEPTION 'Acceso denegado. Solo los moderadores pueden modificar el estado de publicación.';
    END IF;

    IF new_status NOT IN ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'HIDDEN', 'DELETED') THEN
        RAISE EXCEPTION 'Estado de publicación no válido.';
    END IF;

    UPDATE public.posts
    SET status = new_status,
        updated_at = now()
    WHERE id = target_post_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.moderate_post_status(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.moderate_post_status(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.moderate_post_status(UUID) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.moderate_post_status(UUID) TO authenticated, service_role;
