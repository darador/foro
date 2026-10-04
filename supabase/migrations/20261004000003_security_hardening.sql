-- ============================================================================
-- FOROFETICHE — DATABASE MIGRATION: FASE 1.1 SECURITY HARDENING
-- Non-destructive security patches, profile protection, RLS hardening,
-- moderation AI results table, messaging validation, and directory flag protection.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. HARDEN ADMIN ROLES EXPOSURE (Section 1)
-- ----------------------------------------------------------------------------
-- Remove public SELECT exposure of admin_roles table to normal authenticated users
DROP POLICY IF EXISTS "Admin roles are viewable by authenticated users" ON public.admin_roles;

-- Only admins can directly SELECT from admin_roles table.
-- Normal users check roles via SECURITY DEFINER functions: is_admin(), is_moderator(), is_superadmin(), get_user_role()
CREATE POLICY "Admin roles viewable only by admins"
    ON public.admin_roles FOR SELECT
    TO authenticated
    USING (public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 2. PROTECT READ-ONLY & DERIVED PROFILE FIELDS (Sections 2 & 3)
-- ----------------------------------------------------------------------------
-- Trigger function to prevent normal users from modifying email_verified, counters, and badges via UPDATE queries
CREATE OR REPLACE FUNCTION public.protect_profile_readonly_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Prevent manual modification of email_verified by non-system triggers
    IF (NEW.email_verified IS DISTINCT FROM OLD.email_verified) AND (current_user NOT IN ('postgres', 'supabase_admin')) THEN
        NEW.email_verified := OLD.email_verified;
    END IF;

    -- Prevent manual modification of counters by user updates
    IF (NEW.experiences_count IS DISTINCT FROM OLD.experiences_count) THEN
        NEW.experiences_count := OLD.experiences_count;
    END IF;

    IF (NEW.comments_count IS DISTINCT FROM OLD.comments_count) THEN
        NEW.comments_count := OLD.comments_count;
    END IF;

    IF (NEW.reactions_received IS DISTINCT FROM OLD.reactions_received) THEN
        NEW.reactions_received := OLD.reactions_received;
    END IF;

    -- Prevent manual modification of badges unless user is admin
    IF (NEW.badges IS DISTINCT FROM OLD.badges) AND NOT public.is_admin(auth.uid()) THEN
        NEW.badges := OLD.badges;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_readonly ON public.profiles;
CREATE TRIGGER trg_protect_profile_readonly
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_readonly_fields();

-- ----------------------------------------------------------------------------
-- 3. CREATE MODERATION AI RESULTS TABLE (Section 4)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moderation_ai_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.moderation_cases(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'REVIEW', 'CRITICAL')),
    flags TEXT[] DEFAULT '{}',
    confidence NUMERIC(5,4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.moderation_ai_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only moderators can view and create moderation AI results"
    ON public.moderation_ai_results FOR ALL
    TO authenticated
    USING (public.is_moderator(auth.uid()))
    WITH CHECK (public.is_moderator(auth.uid()));

-- ----------------------------------------------------------------------------
-- 4. HARDEN MESSAGING & BLOCK FLOW SERVER-SIDE (Section 5)
-- ----------------------------------------------------------------------------
-- Add message_request_id reference to conversations to strictly link conversation to accepted request
ALTER TABLE public.conversations 
    ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES public.message_requests(id) ON DELETE CASCADE;

-- Helper function to verify that messaging between users has an ACCEPTED request and NO active blocks
CREATE OR REPLACE FUNCTION public.can_send_message(target_conversation_id UUID, target_sender_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    conv_request_id UUID;
    req_status TEXT;
    is_blocked BOOLEAN;
BEGIN
    -- Check if sender is a member of the conversation
    IF NOT EXISTS (
        SELECT 1 FROM public.conversation_members
        WHERE conversation_id = target_conversation_id AND user_id = target_sender_id
    ) THEN
        RETURN FALSE;
    END IF;

    -- Get conversation's linked message request
    SELECT request_id INTO conv_request_id
    FROM public.conversations
    WHERE id = target_conversation_id;

    IF conv_request_id IS NULL THEN
        -- Fallback: Check if there is an ACCEPTED message request between conversation members
        SELECT status INTO req_status
        FROM public.message_requests mr
        WHERE (mr.sender_id = target_sender_id OR mr.recipient_id = target_sender_id)
          AND mr.status = 'ACCEPTED'
        LIMIT 1;

        IF req_status IS NULL THEN
            RETURN FALSE;
        END IF;
    ELSE
        SELECT status INTO req_status
        FROM public.message_requests
        WHERE id = conv_request_id;

        IF req_status <> 'ACCEPTED' THEN
            RETURN FALSE;
        END IF;
    END IF;

    -- Check for active blocks between any members of the conversation and sender
    SELECT EXISTS (
        SELECT 1 
        FROM public.conversation_members cm
        JOIN public.user_blocks ub 
          ON (ub.blocker_id = cm.user_id AND ub.blocked_id = target_sender_id)
          OR (ub.blocker_id = target_sender_id AND ub.blocked_id = cm.user_id)
        WHERE cm.conversation_id = target_conversation_id
          AND cm.user_id <> target_sender_id
    ) INTO is_blocked;

    IF is_blocked THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

-- Replace messaging INSERT policy with hardened check
DROP POLICY IF EXISTS "Conversation members can send messages" ON public.messages;
CREATE POLICY "Conversation members can send messages if request accepted and not blocked"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND public.can_send_message(conversation_id, auth.uid())
    );

-- ----------------------------------------------------------------------------
-- 5. REFORCE DIRECTORY_ENABLED FEATURE FLAG SERVER-SIDE (Section 6)
-- ----------------------------------------------------------------------------
-- Database-level feature flag setting function (defaults to FALSE)
CREATE OR REPLACE FUNCTION public.is_directory_enabled()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT FALSE; -- STRICTLY DISABLED SERVER-SIDE UNTIL LEGAL AUTHORIZATION
$$;

DROP POLICY IF EXISTS "Directory profiles viewable when directory enabled or by admin" ON public.directory_profiles;

CREATE POLICY "Directory profiles viewable only when enabled in DB or by admin"
    ON public.directory_profiles FOR SELECT
    USING (
        (public.is_directory_enabled() = true AND status = 'APPROVED')
        OR (auth.uid() IS NOT NULL AND public.is_admin(auth.uid()))
    );
