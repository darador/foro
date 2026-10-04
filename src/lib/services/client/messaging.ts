import { createClient } from '@/lib/supabase/client';

export interface SendMessageRequestOptions {
  targetReceiverId: string;
  initialMessage: string;
}

/**
 * Calls the RPC create_message_request to validate and insert a message request (Client side).
 */
export async function sendRequest({ targetReceiverId, initialMessage }: SendMessageRequestOptions) {
  const supabase = createClient();

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
 * Calls the RPC accept_message_request to accept a pending request (Client side).
 */
export async function acceptRequest(requestId: string) {
  const supabase = createClient();

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
 * Calls the RPC reject_message_request to reject a pending request (Client side).
 */
export async function rejectRequest(requestId: string) {
  const supabase = createClient();

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
 * Calls the RPC block_message_request to mark request as BLOCKED and insert user_blocks entry (Client side).
 */
export async function blockRequest(requestId: string) {
  const supabase = createClient();

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
 * Calls RPC soft_delete_message to set deleted_at timestamp (Client side).
 */
export async function deleteMessage(messageId: string) {
  const supabase = createClient();

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
 * Inserts a new text message into a conversation (Client side).
 */
export async function sendMessageClient(conversationId: string, content: string) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Authentication required');

  const cleanContent = content.trim();
  if (!cleanContent || cleanContent.length > 2000) {
    throw new Error('El mensaje debe tener entre 1 y 2000 caracteres');
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: cleanContent,
    })
    .select(`
      id,
      conversation_id,
      sender_id,
      content,
      deleted_at,
      created_at,
      sender:profiles!messages_sender_id_fkey(id, alias, avatar_url)
    `)
    .single();

  if (error) {
    console.error('Error in sendMessageClient:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Fetches messages for a conversation (Client side re-fetch).
 */
export async function getConversationMessagesClient(conversationId: string, limit = 50) {
  const supabase = createClient();

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
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error in getConversationMessagesClient:', error);
    return [];
  }

  return (data || []).reverse();
}

