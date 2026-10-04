import { createClient } from '@/lib/supabase/server';

export interface NotificationItem {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: 'MESSAGE' | 'MESSAGE_REQUEST' | 'MESSAGE_REQUEST_ACCEPTED' | 'MESSAGE_REQUEST_REJECTED';
  entity_type: 'CONVERSATION' | 'MESSAGE_REQUEST';
  entity_id: string;
  read_at: string | null;
  created_at: string;
  actor?: {
    id: string;
    alias: string;
    avatar_url: string | null;
  } | null;
}

/**
 * Fetches notifications for the current authenticated user.
 */
export async function getUserNotifications(limit = 30): Promise<NotificationItem[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select(`
      id,
      user_id,
      actor_id,
      type,
      entity_type,
      entity_id,
      read_at,
      created_at,
      actor:profiles!notifications_actor_id_fkey(id, alias, avatar_url)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  return (data || []) as NotificationItem[];
}

/**
 * Gets the count of unread notifications for the authenticated user.
 */
export async function getUnreadNotificationsCount(): Promise<number> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const { data, error } = await supabase.rpc('get_unread_notifications_count');

  if (error) {
    console.error('Error fetching unread notifications count:', error);
    return 0;
  }

  return typeof data === 'number' ? data : 0;
}

/**
 * Marks a specific notification as read.
 */
export async function markNotificationRead(notificationId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('mark_notification_read', {
    target_notification_id: notificationId,
  });

  if (error) {
    console.error('Error marking notification as read:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Marks all notifications of the authenticated user as read.
 */
export async function markAllNotificationsRead() {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('mark_all_notifications_read');

  if (error) {
    console.error('Error marking all notifications as read:', error);
    throw new Error(error.message);
  }

  return data;
}
