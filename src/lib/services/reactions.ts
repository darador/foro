import { createClient } from '@/lib/supabase/client';

export async function togglePostReaction(postId: string, userId: string): Promise<{ reacted: boolean }> {
  const supabase = createClient();

  const { data: existing } = await supabase
    .from('reactions')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    await supabase.from('reactions').delete().eq('id', existing.id);
    return { reacted: false };
  } else {
    await supabase.from('reactions').insert({
      post_id: postId,
      user_id: userId,
      type: 'ME_INTERESA',
    });
    return { reacted: true };
  }
}

export async function toggleCommentReaction(commentId: string, userId: string): Promise<{ reacted: boolean }> {
  const supabase = createClient();

  const { data: existing } = await supabase
    .from('reactions')
    .select('id')
    .eq('comment_id', commentId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    await supabase.from('reactions').delete().eq('id', existing.id);
    return { reacted: false };
  } else {
    await supabase.from('reactions').insert({
      comment_id: commentId,
      user_id: userId,
      type: 'ME_INTERESA',
    });
    return { reacted: true };
  }
}

export async function getUserReactionsForPost(postId: string, userId?: string) {
  if (!userId) return false;
  const supabase = createClient();

  const { data } = await supabase
    .from('reactions')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  return !!data;
}
