-- ============================================================================
-- FOROFETICHE — DATABASE MIGRATION: RLS POLICIES & SECURITY
-- Phase 1 Foundation
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directory_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directory_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directory_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_directory_links ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 1. PROFILES POLICIES
-- ----------------------------------------------------------------------------
-- Everyone (authenticated & anonymous) can view public profiles
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

-- Authenticated users can update ONLY their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 2. ADMIN ROLES POLICIES (Rule 41 & Rule 76)
-- ----------------------------------------------------------------------------
-- Authenticated users can view admin roles (for client authorization checks)
CREATE POLICY "Admin roles are viewable by authenticated users"
    ON public.admin_roles FOR SELECT
    TO authenticated
    USING (true);

-- ONLY SUPERADMIN can modify admin_roles
CREATE POLICY "Only superadmins can insert or update admin roles"
    ON public.admin_roles FOR ALL
    TO authenticated
    USING (public.is_superadmin(auth.uid()))
    WITH CHECK (public.is_superadmin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 3. CATEGORIES POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Categories are viewable by everyone"
    ON public.categories FOR SELECT
    USING (true);

CREATE POLICY "Only admins can manage categories"
    ON public.categories FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 4. POSTS POLICIES
-- ----------------------------------------------------------------------------
-- Anyone can view PUBLISHED posts
CREATE POLICY "Public can view published posts"
    ON public.posts FOR SELECT
    USING (
        status = 'PUBLISHED'
        OR (auth.uid() IS NOT NULL AND author_id = auth.uid())
        OR (auth.uid() IS NOT NULL AND public.is_moderator(auth.uid()))
    );

-- Verified authenticated users can insert posts (email_verified checked in server logic & RLS)
CREATE POLICY "Verified users can create posts"
    ON public.posts FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = author_id
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND email_verified = true
        )
    );

-- Authors can update their own posts (or moderators)
CREATE POLICY "Authors can update own posts"
    ON public.posts FOR UPDATE
    TO authenticated
    USING (
        author_id = auth.uid()
        OR public.is_moderator(auth.uid())
    )
    WITH CHECK (
        author_id = auth.uid()
        OR public.is_moderator(auth.uid())
    );

-- Authors can delete their own posts (or moderators)
CREATE POLICY "Authors can delete own posts"
    ON public.posts FOR DELETE
    TO authenticated
    USING (
        author_id = auth.uid()
        OR public.is_moderator(auth.uid())
    );

-- ----------------------------------------------------------------------------
-- 5. TAGS & POST_TAGS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Tags are viewable by everyone"
    ON public.tags FOR SELECT
    USING (true);

CREATE POLICY "Post tags are viewable by everyone"
    ON public.post_tags FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can create tags"
    ON public.tags FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authors can link post tags"
    ON public.post_tags FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.posts
            WHERE id = post_id AND author_id = auth.uid()
        )
        OR public.is_moderator(auth.uid())
    );

-- ----------------------------------------------------------------------------
-- 6. COMMENTS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Public can view published comments"
    ON public.comments FOR SELECT
    USING (
        status = 'PUBLISHED'
        OR (auth.uid() IS NOT NULL AND author_id = auth.uid())
        OR (auth.uid() IS NOT NULL AND public.is_moderator(auth.uid()))
    );

CREATE POLICY "Verified users can create comments"
    ON public.comments FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = author_id
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND email_verified = true
        )
    );

CREATE POLICY "Authors can update own comments"
    ON public.comments FOR UPDATE
    TO authenticated
    USING (
        author_id = auth.uid()
        OR public.is_moderator(auth.uid())
    );

CREATE POLICY "Authors can delete own comments"
    ON public.comments FOR DELETE
    TO authenticated
    USING (
        author_id = auth.uid()
        OR public.is_moderator(auth.uid())
    );

-- ----------------------------------------------------------------------------
-- 7. REACTIONS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Reactions viewable by everyone"
    ON public.reactions FOR SELECT
    USING (true);

CREATE POLICY "Verified users can create reactions"
    ON public.reactions FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND email_verified = true
        )
    );

CREATE POLICY "Users can delete own reactions"
    ON public.reactions FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 8. SAVED POSTS POLICIES (STRICTLY PRIVATE - RULE 27 & 41)
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can only view own saved posts"
    ON public.saved_posts FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can save posts for themselves"
    ON public.saved_posts FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove own saved posts"
    ON public.saved_posts FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 9. POST FOLLOWS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own post follows"
    ON public.post_follows FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can follow posts"
    ON public.post_follows FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can unfollow posts"
    ON public.post_follows FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 10. USER BLOCKS POLICIES (SERVER-SIDE ENFORCEMENT)
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view their active blocks"
    ON public.user_blocks FOR SELECT
    TO authenticated
    USING (blocker_id = auth.uid());

CREATE POLICY "Users can block other users"
    ON public.user_blocks FOR INSERT
    TO authenticated
    WITH CHECK (blocker_id = auth.uid() AND blocked_id <> auth.uid());

CREATE POLICY "Users can unblock users"
    ON public.user_blocks FOR DELETE
    TO authenticated
    USING (blocker_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 11. MESSAGING POLICIES (PRIVACY PROTECTED - RULE 31 & 41)
-- ----------------------------------------------------------------------------
CREATE POLICY "Message requests visible to sender and recipient"
    ON public.message_requests FOR SELECT
    TO authenticated
    USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Users can send message requests"
    ON public.message_requests FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND NOT EXISTS (
            SELECT 1 FROM public.user_blocks
            WHERE (blocker_id = recipient_id AND blocked_id = auth.uid())
               OR (blocker_id = auth.uid() AND blocked_id = recipient_id)
        )
    );

CREATE POLICY "Recipients can update message requests"
    ON public.message_requests FOR UPDATE
    TO authenticated
    USING (recipient_id = auth.uid() OR sender_id = auth.uid());

CREATE POLICY "Conversations viewable by members only"
    ON public.conversations FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_members
            WHERE conversation_id = id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Conversation members viewable by members only"
    ON public.conversation_members FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_members cm
            WHERE cm.conversation_id = conversation_id AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "Messages viewable by conversation members only"
    ON public.messages FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_members
            WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Conversation members can send messages"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.conversation_members
            WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- 12. REPORTS & MODERATION POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can submit reports"
    ON public.reports FOR INSERT
    TO authenticated
    WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Reporters can view their submitted reports"
    ON public.reports FOR SELECT
    TO authenticated
    USING (reporter_id = auth.uid() OR public.is_moderator(auth.uid()));

CREATE POLICY "Only moderators can view and manage moderation cases"
    ON public.moderation_cases FOR ALL
    TO authenticated
    USING (public.is_moderator(auth.uid()))
    WITH CHECK (public.is_moderator(auth.uid()));

CREATE POLICY "Only moderators can view and create moderation actions"
    ON public.moderation_actions FOR ALL
    TO authenticated
    USING (public.is_moderator(auth.uid()))
    WITH CHECK (public.is_moderator(auth.uid()));

CREATE POLICY "Only moderators can view content versions"
    ON public.content_versions FOR SELECT
    TO authenticated
    USING (public.is_moderator(auth.uid()));

-- ----------------------------------------------------------------------------
-- 13. AUDIT LOGS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Only admins can view audit logs"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 14. DIRECTORY POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Directory profiles viewable when directory enabled or by admin"
    ON public.directory_profiles FOR SELECT
    USING (status = 'APPROVED' OR (auth.uid() IS NOT NULL AND public.is_admin(auth.uid())));

CREATE POLICY "Admins can manage directory profiles"
    ON public.directory_profiles FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
