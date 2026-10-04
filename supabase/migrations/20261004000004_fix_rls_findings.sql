-- ============================================================================
-- FOROFETICHE — DATABASE MIGRATION: FASE 1.2 FIX RLS FINDINGS
-- Non-destructive fixes for can_send_message() fallback & get_user_role() RPC exposure
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FIX VULNERABILITY IN can_send_message() (Hallazgo 1)
-- ----------------------------------------------------------------------------
-- Strict rules:
-- 1. Sender must be member of conversation
-- 2. conv_request_id MUST NOT BE NULL (If NULL -> RETURN FALSE)
-- 3. conv_request_id MUST correspond to a message_request with status = 'ACCEPTED'
--    where the request sender & recipient match the conversation members.
-- 4. NO active blocks between conversation members and sender.

CREATE OR REPLACE FUNCTION public.can_send_message(target_conversation_id UUID, target_sender_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    conv_request_id UUID;
    req_status TEXT;
    req_sender_id UUID;
    req_recipient_id UUID;
    other_member_id UUID;
    is_blocked BOOLEAN;
BEGIN
    -- 1. Must be a member of the conversation
    IF NOT EXISTS (
        SELECT 1 FROM public.conversation_members
        WHERE conversation_id = target_conversation_id AND user_id = target_sender_id
    ) THEN
        RETURN FALSE;
    END IF;

    -- 2. Get conversation's linked message_request ID
    SELECT request_id INTO conv_request_id
    FROM public.conversations
    WHERE id = target_conversation_id;

    -- STRICT RULE: If request_id IS NULL -> RETURN FALSE immediately. NO FALLBACK!
    IF conv_request_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 3. Get the linked request details
    SELECT status, sender_id, recipient_id 
    INTO req_status, req_sender_id, req_recipient_id
    FROM public.message_requests
    WHERE id = conv_request_id;

    -- Request must exist and be ACCEPTED
    IF req_status IS NULL OR req_status <> 'ACCEPTED' THEN
        RETURN FALSE;
    END IF;

    -- Get the other member of the conversation
    SELECT user_id INTO other_member_id
    FROM public.conversation_members
    WHERE conversation_id = target_conversation_id AND user_id <> target_sender_id
    LIMIT 1;

    -- The request MUST match the exact participants (target_sender_id & other_member_id)
    IF NOT (
        (req_sender_id = target_sender_id AND req_recipient_id = other_member_id) OR
        (req_recipient_id = target_sender_id AND req_sender_id = other_member_id)
    ) THEN
        RETURN FALSE;
    END IF;

    -- 4. Check for active blocks between conversation members and sender
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

-- Ensure messaging INSERT policy uses the updated can_send_message function
DROP POLICY IF EXISTS "Conversation members can send messages if request accepted and not blocked" ON public.messages;
CREATE POLICY "Conversation members can send messages if request accepted and not blocked"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND public.can_send_message(conversation_id, auth.uid())
    );

-- ----------------------------------------------------------------------------
-- 2. FIX ROLE EXPOSURE IN get_user_role() (Hallazgo 2)
-- ----------------------------------------------------------------------------
-- Revoke execution of get_user_role from PUBLIC, authenticated, and anon roles
REVOKE EXECUTE ON FUNCTION public.get_user_role(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(UUID) FROM anon;

-- Explicitly GRANT execution ONLY to service_role
GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO service_role;
