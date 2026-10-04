-- ============================================================================
-- FOROFETICHE — DATABASE MIGRATION: INITIAL SCHEMA
-- Phase 1 Foundation
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ----------------------------------------------------------------------------
-- 1. PROFILES & USER IDENTITIES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    alias TEXT UNIQUE NOT NULL,
    alias_last_changed_at TIMESTAMPTZ DEFAULT now(),
    profile_type TEXT NOT NULL DEFAULT 'INDIVIDUAL' CHECK (profile_type IN ('INDIVIDUAL', 'COUPLE', 'GROUP')),
    description TEXT CHECK (char_length(description) <= 500),
    province TEXT,
    city TEXT,
    tags TEXT[] DEFAULT '{}',
    avatar_url TEXT,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    experiences_count INTEGER NOT NULL DEFAULT 0,
    comments_count INTEGER NOT NULL DEFAULT 0,
    reactions_received INTEGER NOT NULL DEFAULT 0,
    badges TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for alias searches
CREATE INDEX IF NOT EXISTS idx_profiles_alias ON public.profiles(alias);
CREATE INDEX IF NOT EXISTS idx_profiles_location ON public.profiles(province, city);

-- ----------------------------------------------------------------------------
-- 2. ADMIN & MODERATION ROLES (SEPARATE FROM PROFILES - RULES 40 & 76)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'MODERATOR', 'DIRECTORY_ADMIN', 'SUPERADMIN')),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by UUID REFERENCES auth.users(id)
);

-- Security Helper Functions for Role Checking
CREATE OR REPLACE FUNCTION public.get_user_role(target_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT COALESCE(
        (SELECT role FROM public.admin_roles WHERE user_id = target_user_id),
        'USER'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admin_roles 
        WHERE user_id = target_user_id AND role IN ('SUPERADMIN', 'DIRECTORY_ADMIN')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_moderator(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admin_roles 
        WHERE user_id = target_user_id AND role IN ('SUPERADMIN', 'MODERATOR')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admin_roles 
        WHERE user_id = target_user_id AND role = 'SUPERADMIN'
    );
$$;

-- Automatic Profile Creation Trigger on Sign Up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    raw_alias TEXT;
BEGIN
    raw_alias := COALESCE(
        NEW.raw_user_meta_data->>'alias',
        'usuario_' || substring(NEW.id::text from 1 for 8)
    );

    INSERT INTO public.profiles (
        id,
        alias,
        email_verified,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        raw_alias,
        COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        email_verified = EXCLUDED.email_verified,
        updated_at = now();

    -- Assign default USER role in admin_roles
    INSERT INTO public.admin_roles (user_id, role)
    VALUES (NEW.id, 'USER')
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to keep email_verified synced when auth.users is updated
CREATE OR REPLACE FUNCTION public.sync_user_email_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.profiles
    SET email_verified = (NEW.email_confirmed_at IS NOT NULL),
        updated_at = now()
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE OF email_confirmed_at ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.sync_user_email_verified();

-- ----------------------------------------------------------------------------
-- 3. CATEGORIES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. POSTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('EXPERIENCE', 'QUESTION', 'CONFESSION')),
    category_id UUID NOT NULL REFERENCES public.categories(id),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    province TEXT,
    city TEXT,
    status TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'HIDDEN', 'DELETED')),
    views_count INTEGER NOT NULL DEFAULT 0,
    reactions_count INTEGER NOT NULL DEFAULT 0,
    comments_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_category ON public.posts(category_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_fts ON public.posts USING gin (
    to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(content, ''))
);

-- ----------------------------------------------------------------------------
-- 5. TAGS & POST_TAGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.post_tags (
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

-- ----------------------------------------------------------------------------
-- 6. COMMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('PUBLISHED', 'HIDDEN', 'DELETED')),
    depth INTEGER NOT NULL DEFAULT 1 CHECK (depth <= 3),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON public.comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON public.comments(parent_id);

-- ----------------------------------------------------------------------------
-- 7. REACTIONS (🔥 ME_INTERESA)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'ME_INTERESA' CHECK (type = 'ME_INTERESA'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_target CHECK (
        (post_id IS NOT NULL AND comment_id IS NULL) OR
        (post_id IS NULL AND comment_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_post_reaction ON public.reactions(user_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_comment_reaction ON public.reactions(user_id, comment_id) WHERE comment_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 8. SAVED POSTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_posts (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, post_id)
);

-- ----------------------------------------------------------------------------
-- 9. POST FOLLOWS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.post_follows (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, post_id)
);

-- ----------------------------------------------------------------------------
-- 10. USER BLOCKS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_blocks (
    blocker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id),
    CONSTRAINT chk_self_block CHECK (blocker_id <> blocked_id)
);

-- ----------------------------------------------------------------------------
-- 11. MESSAGING FOUNDATION
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    initial_message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'BLOCKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_self_message CHECK (sender_id <> recipient_id)
);

CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_members (
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 12. MODERATION & REPORTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('POST', 'COMMENT', 'PROFILE', 'MESSAGE')),
    target_id UUID NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN (
        'MINOR', 'NON_CONSENSUAL', 'PERSONAL_DATA', 'THREAT',
        'EXTORTION', 'HARASSMENT', 'SPAM', 'OTHER'
    )),
    details TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_REVIEW', 'WAITING_USER', 'ESCALATED', 'RESOLVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.moderation_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
    assigned_moderator_id UUID REFERENCES public.profiles(id),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_REVIEW', 'WAITING_USER', 'ESCALATED', 'RESOLVED')),
    priority TEXT NOT NULL DEFAULT 'LOW' CHECK (priority IN ('LOW', 'REVIEW', 'CRITICAL')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.moderation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES public.moderation_cases(id),
    moderator_id UUID NOT NULL REFERENCES public.profiles(id),
    action_type TEXT NOT NULL CHECK (action_type IN (
        'APPROVE', 'REQUEST_CHANGES', 'HIDE', 'DELETE',
        'WARN', 'RESTRICT_POSTS', 'RESTRICT_MESSAGES', 'SUSPEND', 'BAN'
    )),
    target_user_id UUID REFERENCES public.profiles(id),
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.content_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('POST', 'COMMENT')),
    entity_id UUID NOT NULL,
    version_number INTEGER NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    edited_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 13. AUDIT LOGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- ----------------------------------------------------------------------------
-- 14. DIRECTORY MODULE (INACTIVE BY DEFAULT VIA FEATURE FLAG)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.directory_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('PROFESSIONAL', 'PLACE', 'EVENT')),
    display_name TEXT NOT NULL,
    description TEXT,
    province TEXT,
    city TEXT,
    external_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN')),
    claimed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.directory_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    directory_profile_id UUID NOT NULL REFERENCES public.directory_profiles(id) ON DELETE CASCADE,
    claimant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    verification_method TEXT NOT NULL CHECK (verification_method IN ('PHONE', 'MANUAL')),
    evidence_text TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_INFO')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.directory_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    directory_profile_id UUID NOT NULL REFERENCES public.directory_profiles(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    complainant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.post_directory_links (
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    directory_profile_id UUID REFERENCES public.directory_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id, directory_profile_id)
);
