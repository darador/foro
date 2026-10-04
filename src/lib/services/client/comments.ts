import { createClient } from '@/lib/supabase/client';
import { sanitizeHtml } from '@/lib/sanitize';
import type { CommentFormValues } from '@/lib/validations/comment';

export async function createComment(formValues: CommentFormValues, authorId: string) {
  const supabase = createClient();

  let depth = 1;

  if (formValues.parent_id) {
    const { data: parentComment } = await supabase
      .from('comments')
      .select('depth')
      .eq('id', formValues.parent_id)
      .single();

    if (parentComment) {
      depth = Math.min(3, parentComment.depth + 1);
    }
  }

  const sanitizedContent = sanitizeHtml(formValues.content);

  const { data: comment, error } = await supabase
    .from('comments')
    .insert({
      post_id: formValues.post_id,
      author_id: authorId,
      parent_id: formValues.parent_id || null,
      content: sanitizedContent,
      depth,
      status: 'PUBLISHED',
    })
    .select(`
      id,
      post_id,
      author_id,
      parent_id,
      content,
      status,
      depth,
      created_at,
      updated_at,
      author:profiles!comments_author_id_fkey(id, alias, avatar_url, badges)
    `)
    .single();

  if (error || !comment) {
    throw new Error(error?.message || 'Error al publicar el comentario');
  }

  // Trigger server-side AI analysis asynchronously on comment creation
  import('@/app/actions/moderation-ai').then(({ runAiContentModerationAction }) => {
    runAiContentModerationAction({
      entityType: 'COMMENT',
      entityId: comment.id,
      content: comment.content,
    }).catch((err) => console.error('AI moderation trigger error on comment creation:', err));
  });

  return comment;
}

export async function updateComment(commentId: string, content: string, userId: string) {
  const supabase = createClient();

  const sanitizedContent = sanitizeHtml(content);

  const { data: updatedComment, error } = await supabase
    .from('comments')
    .update({
      content: sanitizedContent,
      updated_at: new Date().toISOString(),
    })
    .eq('id', commentId)
    .eq('author_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Trigger server-side AI analysis asynchronously on comment update
  import('@/app/actions/moderation-ai').then(({ runAiContentModerationAction }) => {
    runAiContentModerationAction({
      entityType: 'COMMENT',
      entityId: updatedComment.id,
      content: updatedComment.content,
    }).catch((err) => console.error('AI moderation trigger error on comment update:', err));
  });

  return updatedComment;
}

export async function softDeleteComment(commentId: string, userId: string) {
  const supabase = createClient();

  const { error } = await supabase
    .from('comments')
    .update({
      status: 'DELETED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', commentId)
    .eq('author_id', userId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}
