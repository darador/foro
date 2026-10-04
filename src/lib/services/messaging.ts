import { createClient } from '@/lib/supabase/server';

export interface SendMessageRequestOptions {
  targetReceiverId: string;
  initialMessage: string;
}

/**
  * Calls the RPC create_message_request to validate and insert a message request.
  */
export async function sendRequest({ targetReceiverId, initialMessage }: SendMessageRequestOptions) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('create_message_request', {
    target_receiver_id: targetReceiverId,
    initial_msg: initialMessage,
  });

  if (error) {
    console.error('Error in sendRequest:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
  * Calls the RPC accept_message_request to accept a pending request and create a conversation.
  */
export async function acceptRequest(requestId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('accept_message_request', {
    target_request_id: requestId,
  });

  if (error) {
    console.error('Error in acceptRequest:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
  * Calls the RPC reject_message_request to reject a pending message request.
  */
export async function rejectRequest(requestId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('reject_message_request', {
    target_request_id: requestId,
  });

  if (error) {
    console.error('Error in rejectRequest:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
  * Calls the RPC block_message_request to mark request as BLOCKED and insert user_blocks entry.
  */
export async function blockRequest(requestId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('block_message_request', {
    target_request_id: requestId,
  });

  if (error) {
    console.error('Error in blockRequest:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
  * Fetches message requests where the current user is sender or recipient.
  */
export async function getUserRequests() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from('message_requests')
    .select(`
      id,
      sender_id,
      recipient_id,
      initial_message,
      status,
      resolved_at,
      created_at,
      updated_at,
      sender:profiles!message_requests_sender_id_fkey(id, alias, avatar_url),
      recipient:profiles!message_requests_recipient_id_fkey(id, alias, avatar_url)
    `)
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error in getUserRequests:', error);
    return [];
  }

  return data || [];
}

/**
  * Fetches messages for a conversation where current user is a member.
  */
export async function getConversationMessages(conversationId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('messages')
    .select(`
      id,
      conversation_id,
      sender_id,
      content,
      deleted_at,
      created_at,
      sender:profiles!messages_sender_id_fkey(id, alias, avatar_url)
    `)
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error in getConversationMessages:', error);
    return [];
  }

  return data || [];
}

/**
  * Inserts a message into a conversation.
  */
export async function sendMessage(conversationId: string, content: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Authentication required');

  const cleanContent = content.trim();
  if (!cleanContent || cleanContent.length > 2000) {
    throw new Error('Message content must be between 1 and 2000 characters');
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: cleanContent,
    })
    .select()
    .single();

  if (error) {
    console.error('Error in sendMessage:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
  * Calls RPC soft_delete_message to set deleted_at timestamp.
  */
export async function deleteMessage(messageId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('soft_delete_message', {
    target_message_id: messageId,
  });

  if (error) {
    console.error('Error in deleteMessage:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
  * Updates user's message policy settings (EVERYONE | NOBODY).
  */
export async function updateMessagePolicy(policy: 'EVERYONE' | 'NOBODY') {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Authentication required');

  const { data, error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: user.id,
      message_policy: policy,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error in updateMessagePolicy:', error);
    throw new Error(error.message);
  }

  return data;
}

export type MessagingRelationStatus =
  | 'SELF'
  | 'NO_RELATION'
  | 'PENDING_SENT'
  | 'PENDING_RECEIVED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'BLOCKED'
  | 'POLICY_NOBODY';

/**
 * Determines the messaging relationship status between the authenticated user and a target user.
 * Prioritizes active relationships (ACCEPTED, PENDING, BLOCKED) over target user's message_policy settings.
 */
export async function getRequestStatusBetweenUsers(targetUserId: string): Promise<{
  status: MessagingRelationStatus;
  requestId?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Unauthenticated Visitor
  if (!user) return { status: 'NO_RELATION' };
  // 2. Self Profile
  if (user.id === targetUserId) return { status: 'SELF' };

  // 3. Check blocks (Takes absolute precedence)
  const { data: blocks } = await supabase
    .from('user_blocks')
    .select('blocker_id, blocked_id')
    .or(
      `and(blocker_id.eq.${user.id},blocked_id.eq.${targetUserId}),and(blocker_id.eq.${targetUserId},blocked_id.eq.${user.id})`
    );

  if (blocks && blocks.length > 0) {
    return { status: 'BLOCKED' };
  }

  // 4. Check existing message requests
  const { data: requests } = await supabase
    .from('message_requests')
    .select('id, sender_id, recipient_id, status')
    .or(
      `and(sender_id.eq.${user.id},recipient_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},recipient_id.eq.${user.id})`
    )
    .order('created_at', { ascending: false })
    .limit(1);

  if (requests && requests.length > 0) {
    const req = requests[0];
    if (req.status === 'ACCEPTED') {
      return { status: 'ACCEPTED', requestId: req.id };
    }
    if (req.status === 'PENDING') {
      if (req.sender_id === user.id) {
        return { status: 'PENDING_SENT', requestId: req.id };
      } else {
        return { status: 'PENDING_RECEIVED', requestId: req.id };
      }
    }
    if (req.status === 'BLOCKED') {
      return { status: 'BLOCKED', requestId: req.id };
    }
    if (req.status === 'REJECTED') {
      // For REJECTED status, check target user's message_policy before allowing a new request
      const { data: canReceive } = await supabase.rpc('can_receive_message_request', {
        target_user_id: targetUserId,
      });

      if (canReceive === false) {
        return { status: 'POLICY_NOBODY', requestId: req.id };
      }
      return { status: 'REJECTED', requestId: req.id };
    }
  }

  // 5. No existing relationship -> Check target user's message_policy
  const { data: canReceive } = await supabase.rpc('can_receive_message_request', {
    target_user_id: targetUserId,
  });

  if (canReceive === false) {
    return { status: 'POLICY_NOBODY' };
  }

  return { status: 'NO_RELATION' };
}

