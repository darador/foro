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
