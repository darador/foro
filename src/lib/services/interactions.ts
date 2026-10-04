import { createClient } from '@/lib/supabase/client';
import type { ReportReason } from '@/types/database';

export async function toggleSavePost(postId: string, userId: string): Promise<{ saved: boolean }> {
  const supabase = createClient();

  const { data: existing } = await supabase
    .from('saved_posts')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    await supabase.from('saved_posts').delete().eq('post_id', postId).eq('user_id', userId);
    return { saved: false };
  } else {
    await supabase.from('saved_posts').insert({
      post_id: postId,
      user_id: userId,
    });
    return { saved: true };
  }
}

export async function getSavedPosts(userId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('saved_posts')
    .select(`
      created_at,
      post:posts!saved_posts_post_id_fkey(
        id,
        title,
        slug,
        type,
        content,
        created_at,
        category:categories!posts_category_id_fkey(name, slug),
        author:profiles!posts_author_id_fkey(alias)
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching saved posts:', error);
    return [];
  }

  return data || [];
}

export async function toggleFollowPost(postId: string, userId: string): Promise<{ followed: boolean }> {
  const supabase = createClient();

  const { data: existing } = await supabase
    .from('post_follows')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    await supabase.from('post_follows').delete().eq('post_id', postId).eq('user_id', userId);
    return { followed: false };
  } else {
    await supabase.from('post_follows').insert({
      post_id: postId,
      user_id: userId,
    });
    return { followed: true };
  }
}

export async function submitReport(params: {
  reporterId: string;
  targetType: 'POST' | 'COMMENT' | 'PROFILE' | 'MESSAGE';
  targetId: string;
  reason: ReportReason;
  details?: string;
}) {
  const supabase = createClient();

  const { data: rpcReportId, error: rpcError } = await supabase.rpc('submit_report_with_case', {
    target_type_param: params.targetType,
    target_id_param: params.targetId,
    reason_param: params.reason,
    details_param: params.details || null,
  });

  if (!rpcError && rpcReportId) {
    const { data: reportData } = await supabase
      .from('reports')
      .select()
      .eq('id', rpcReportId)
      .maybeSingle();

    if (reportData) return reportData;
    return {
      id: rpcReportId,
      reporter_id: params.reporterId,
      target_type: params.targetType,
      target_id: params.targetId,
      reason: params.reason,
      details: params.details || null,
      status: 'OPEN',
      case_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: params.reporterId,
      target_type: params.targetType,
      target_id: params.targetId,
      reason: params.reason,
      details: params.details || null,
      status: 'OPEN',
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function toggleBlockUser(blockerId: string, blockedId: string): Promise<{ blocked: boolean }> {
  const supabase = createClient();

  if (blockerId === blockedId) {
    throw new Error('No puedes bloquearte a ti mismo.');
  }

  const { data: existing } = await supabase
    .from('user_blocks')
    .select('blocker_id')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
    .maybeSingle();

  if (existing) {
    await supabase.from('user_blocks').delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId);
    return { blocked: false };
  } else {
    await supabase.from('user_blocks').insert({
      blocker_id: blockerId,
      blocked_id: blockedId,
    });
    return { blocked: true };
  }
}
