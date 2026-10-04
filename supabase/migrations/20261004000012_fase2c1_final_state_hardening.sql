-- ============================================================================
-- FOROFETICHE — FASE 2C-1: MÁQUINA DE ESTADOS Y HARDENING FINAL DE MENSAJERÍA
-- Migration: 20261004000012_fase2c1_final_state_hardening.sql
-- ============================================================================

-- 1. CORREGIR BLOCK_MESSAGE_REQUEST PARA EXIGIR STRICTAMENTE STATUS = 'PENDING'
CREATE OR REPLACE FUNCTION public.block_message_request(
    target_request_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_id UUID;
    req_record RECORD;
    other_user_id UUID;
BEGIN
    caller_id := auth.uid();
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO req_record
    FROM public.message_requests
    WHERE id = target_request_id
    FOR UPDATE;

    IF req_record.id IS NULL THEN
        RAISE EXCEPTION 'Message request not found.';
    END IF;

    IF req_record.sender_id = caller_id THEN
        other_user_id := req_record.recipient_id;
    ELSIF req_record.recipient_id = caller_id THEN
        other_user_id := req_record.sender_id;
    ELSE
        RAISE EXCEPTION 'Not a participant of this message request.';
    END IF;

    -- Validación estricta de la máquina de estados: Solo PENDING -> BLOCKED
    IF req_record.status <> 'PENDING' THEN
        RAISE EXCEPTION 'Only PENDING message requests can be blocked.';
    END IF;

    UPDATE public.message_requests
    SET status = 'BLOCKED',
        resolved_at = now(),
        updated_at = now()
    WHERE id = target_request_id;

    -- Registrar el bloqueo en user_blocks
    INSERT INTO public.user_blocks (blocker_id, blocked_id, created_at)
    VALUES (caller_id, other_user_id, now())
    ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

    RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.block_message_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.block_message_request(UUID) TO authenticated;

-- 2. REVOCAR ACCESO PÚBLICO/DIRECTO A CAN_SEND_MESSAGE (CONSERVAR SOLO COMO HELPER INTERNO DE RLS)
REVOKE EXECUTE ON FUNCTION public.can_send_message(UUID, UUID) FROM PUBLIC, anon, authenticated;
