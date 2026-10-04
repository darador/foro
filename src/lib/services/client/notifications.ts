import { createClient } from '@/lib/supabase/client';
import type { NotificationItem } from '../notifications';

/**
 * Fetches notifications for current user (Client side).
 */
export async function getUserNotificationsClient(limit = 30): Promise<NotificationItem[]> {
  const supabase = createClient();

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
    console.error('Error fetching notifications client:', error);
    return [];
  }

  return (data || []) as NotificationItem[];
}

/**
 * Gets count of unread notifications for current user (Client side).
 */
export async function getUnreadNotificationsCountClient(): Promise<number> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const { data, error } = await supabase.rpc('get_unread_notifications_count');

  if (error) {
    console.error('Error fetching unread count client:', error);
    return 0;
  }

  return typeof data === 'number' ? data : 0;
}

/**
 * Marks a notification as read (Client side).
 */
export async function markNotificationReadClient(notificationId: string) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('mark_notification_read', {
    target_notification_id: notificationId,
  });

  if (error) {
    console.error('Error marking notification read client:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Marks all notifications as read (Client side).
 */
export async function markAllNotificationsReadClient() {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('mark_all_notifications_read');

  if (error) {
    console.error('Error marking all notifications read client:', error);
    throw new Error(error.message);
  }

  return data;
}
