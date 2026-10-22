import { createClient } from '@/lib/supabase/client';
import { sanitizeHtml } from '@/lib/sanitize';
import type { CommentFormValues } from '@/lib/validations/comment';
import { isModerationAiEnabled } from '@/lib/services/moderation-config';

export async function createComment(formValues: CommentFormValues, authorId: string) {
  const supabase = createClient();

  const isAiEnabled = await isModerationAiEnabled(supabase);

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
      status: isAiEnabled ? 'PENDING_REVIEW' : 'PUBLISHED',
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

  // Trigger server-side AI analysis on comment creation
  try {
    const { runAiContentModerationAction } = await import('@/app/actions/moderation-ai');
    await runAiContentModerationAction({
      entityType: 'COMMENT',
      entityId: comment.id,
    });
  } catch (err) {
    console.error('AI moderation trigger error on comment creation:', err);
  }

  return comment;
}

export async function updateComment(commentId: string, content: string, userId: string) {
  const supabase = createClient();

  const sanitizedContent = sanitizeHtml(content);

  // Preserve current status on author edition so already-PUBLISHED comments
  // remain editable; server-side AI moderation (record_ai_moderation_result)
  // transitions REVIEW -> PENDING_REVIEW and CRITICAL -> HIDDEN.
  const updateData: { content: string; updated_at: string } = {
    content: sanitizedContent,
    updated_at: new Date().toISOString(),
  };

  const { data: updatedComment, error } = await supabase
    .from('comments')
    .update(updateData)
    .eq('id', commentId)
    .eq('author_id', userId)
    .select()
    .single();

  if (error || !updatedComment) {
    throw new Error(error?.message || 'Error al actualizar el comentario');
  }

  // Create sequential INTEGER content version for comment edition.
  // The DB trigger trg_assign_content_version_number (SECURITY DEFINER + advisory lock)
  // is the final authority on version_number, so the app does not depend on an
  // RLS-filtered SELECT or fail the already-committed comment update if version persistence fails.
  let versionId: string | null = null;
  try {
    let nextVersionNumber = 1;
    try {
      const { data: latestVersion, error: versionSelectError } = await supabase
        .from('content_versions')
        .select('version_number')
        .eq('entity_type', 'COMMENT')
        .eq('entity_id', updatedComment.id)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (versionSelectError) {
        console.warn(
          'Non-fatal warning reading latest comment version (DB trigger will assign version_number):',
          versionSelectError.message
        );
      } else if (
        typeof latestVersion?.version_number === 'number' &&
        Number.isInteger(latestVersion.version_number) &&
        latestVersion.version_number >= 0 &&
        latestVersion.version_number < 2147483647
      ) {
        nextVersionNumber = latestVersion.version_number + 1;
      }
    } catch (selectErr) {
      console.warn(
        'Non-fatal exception reading latest comment version (DB trigger will assign version_number):',
        selectErr
      );
    }

    const { data: version, error: versionInsertError } = await supabase
      .from('content_versions')
      .insert({
        entity_type: 'COMMENT',
        entity_id: updatedComment.id,
        version_number: nextVersionNumber,
        content: updatedComment.content,
        edited_by: userId,
      })
      .select('id')
      .maybeSingle();

    if (versionInsertError) {
      console.error(
        '[CONTENT_VERSION_PERSISTENCE_ERROR] Non-fatal error recording comment content version:',
        {
          entityType: 'COMMENT',
          entityId: updatedComment.id,
          editedBy: userId,
          error: versionInsertError.message,
        }
      );
    } else {
      versionId = version?.id || null;
    }
  } catch (versionErr) {
    console.error(
      '[CONTENT_VERSION_PERSISTENCE_ERROR] Non-fatal exception recording comment content version:',
      {
        entityType: 'COMMENT',
        entityId: updatedComment.id,
        editedBy: userId,
        error: versionErr,
      }
    );
  }

  // Trigger server-side AI analysis on comment update (even if content_versions failed)
  try {
    const { runAiContentModerationAction } = await import('@/app/actions/moderation-ai');
    await runAiContentModerationAction({
      entityType: 'COMMENT',
      entityId: updatedComment.id,
      versionId,
    });
  } catch (err) {
    console.error('AI moderation trigger error on comment update:', err);
  }

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
