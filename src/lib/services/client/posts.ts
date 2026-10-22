import { createClient } from '@/lib/supabase/client';
import { slugify, sanitizeHtml, normalizeTag } from '@/lib/sanitize';
import type { PostFormValues } from '@/lib/validations/post';
import type { Database } from '@/types/database';
import { isModerationAiEnabled } from '@/lib/services/moderation-config';

export async function createPost(formValues: PostFormValues, authorId: string) {
  const supabase = createClient();

  const isAiEnabled = await isModerationAiEnabled(supabase);

  const baseSlug = slugify(formValues.title);
  const uniqueSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 8)}`;
  const sanitizedContent = sanitizeHtml(formValues.content);

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      author_id: authorId,
      type: formValues.type,
      category_id: formValues.category_id,
      title: formValues.title.trim(),
      slug: uniqueSlug,
      content: sanitizedContent,
      province: formValues.province || null,
      city: formValues.city || null,
      status: isAiEnabled ? 'PENDING_REVIEW' : 'PUBLISHED',
    })
    .select()
    .single();

  if (error || !post) {
    throw new Error(error?.message || 'Error al crear la publicación');
  }

  if (formValues.tags && formValues.tags.length > 0) {
    for (const rawTag of formValues.tags) {
      const tagSlug = normalizeTag(rawTag);
      if (!tagSlug) continue;

      let { data: existingTag } = await supabase
        .from('tags')
        .select('id')
        .eq('slug', tagSlug)
        .single();

      if (!existingTag) {
        const { data: newTag } = await supabase
          .from('tags')
          .insert({
            name: rawTag.trim(),
            slug: tagSlug,
            status: 'ACTIVE',
          })
          .select('id')
          .single();

        existingTag = newTag;
      }

      if (existingTag) {
        await supabase.from('post_tags').insert({
          post_id: post.id,
          tag_id: existingTag.id,
        });
      }
    }
  }

  // Trigger server-side AI analysis (awaited safely so client navigation does not abort the request)
  try {
    const { runAiContentModerationAction } = await import('@/app/actions/moderation-ai');
    await runAiContentModerationAction({
      entityType: 'POST',
      entityId: post.id,
    });
  } catch (err) {
    console.error('AI moderation trigger error on post creation:', err);
  }

  return post;
}

export async function updatePost(postId: string, formValues: Partial<PostFormValues>, userId: string) {
  const supabase = createClient();

  // Do not mutate status directly from client on UPDATE:
  // 1) Migration 000008 revokes UPDATE(status) on public.posts from authenticated.
  // 2) Already-PUBLISHED posts remain editable by their author, while server-side
  //    AI moderation (record_ai_moderation_result) transitions REVIEW -> PENDING_REVIEW
  //    and CRITICAL -> HIDDEN.
  const updateData: Database['public']['Tables']['posts']['Update'] = {
    updated_at: new Date().toISOString(),
  };

  if (formValues.title) {
    updateData.title = formValues.title.trim();
  }

  if (formValues.content) {
    updateData.content = sanitizeHtml(formValues.content);
  }

  if (formValues.province !== undefined) {
    updateData.province = formValues.province;
  }

  if (formValues.city !== undefined) {
    updateData.city = formValues.city;
  }

  const { data: updatedPost, error } = await supabase
    .from('posts')
    .update(updateData)
    .eq('id', postId)
    .eq('author_id', userId)
    .select()
    .single();

  if (error || !updatedPost) {
    throw new Error(error?.message || 'Error al actualizar la publicación');
  }

  // Create sequential INTEGER content version for edition.
  // The DB trigger trg_assign_content_version_number (SECURITY DEFINER + advisory lock)
  // is the final authority on version_number, so the app does not depend on an
  // RLS-filtered SELECT or fail the already-committed post update if version persistence fails.
  let versionId: string | null = null;
  try {
    let nextVersionNumber = 1;
    try {
      const { data: latestVersion, error: versionSelectError } = await supabase
        .from('content_versions')
        .select('version_number')
        .eq('entity_type', 'POST')
        .eq('entity_id', updatedPost.id)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (versionSelectError) {
        console.warn(
          'Non-fatal warning reading latest post version (DB trigger will assign version_number):',
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
        'Non-fatal exception reading latest post version (DB trigger will assign version_number):',
        selectErr
      );
    }

    const { data: version, error: versionInsertError } = await supabase
      .from('content_versions')
      .insert({
        entity_type: 'POST',
        entity_id: updatedPost.id,
        version_number: nextVersionNumber,
        title: updatedPost.title,
        content: updatedPost.content,
        edited_by: userId,
      })
      .select('id')
      .maybeSingle();

    if (versionInsertError) {
      console.error(
        '[CONTENT_VERSION_PERSISTENCE_ERROR] Non-fatal error recording post content version:',
        {
          entityType: 'POST',
          entityId: updatedPost.id,
          editedBy: userId,
          error: versionInsertError.message,
        }
      );
    } else {
      versionId = version?.id || null;
    }
  } catch (versionErr) {
    console.error(
      '[CONTENT_VERSION_PERSISTENCE_ERROR] Non-fatal exception recording post content version:',
      {
        entityType: 'POST',
        entityId: updatedPost.id,
        editedBy: userId,
        error: versionErr,
      }
    );
  }

  // Trigger server-side AI analysis on post update (even if content_versions failed)
  try {
    const { runAiContentModerationAction } = await import('@/app/actions/moderation-ai');
    await runAiContentModerationAction({
      entityType: 'POST',
      entityId: updatedPost.id,
      versionId,
    });
  } catch (err) {
    console.error('AI moderation trigger error on post update:', err);
  }

  return updatedPost;
}

export async function softDeletePost(postId: string, userId: string) {
  const supabase = createClient();

  const { error } = await supabase.rpc('soft_delete_post', {
    target_post_id: postId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}
