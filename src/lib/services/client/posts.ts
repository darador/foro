import { createClient } from '@/lib/supabase/client';
import { slugify, sanitizeHtml, normalizeTag } from '@/lib/sanitize';
import type { PostFormValues } from '@/lib/validations/post';
import type { Database } from '@/types/database';

export async function createPost(formValues: PostFormValues, authorId: string) {
  const supabase = createClient();

  const isAiEnabled =
    process.env.NEXT_PUBLIC_MODERATION_AI_ENABLED === 'true' ||
    process.env.MODERATION_AI_ENABLED === 'true';

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

  // Trigger server-side AI analysis asynchronously (server fetches real content from DB)
  import('@/app/actions/moderation-ai').then(({ runAiContentModerationAction }) => {
    runAiContentModerationAction({
      entityType: 'POST',
      entityId: post.id,
    }).catch((err) => console.error('AI moderation trigger error on post creation:', err));
  });

  return post;
}

export async function updatePost(postId: string, formValues: Partial<PostFormValues>, userId: string) {
  const supabase = createClient();

  const isAiEnabled =
    process.env.NEXT_PUBLIC_MODERATION_AI_ENABLED === 'true' ||
    process.env.MODERATION_AI_ENABLED === 'true';

  const updateData: Database['public']['Tables']['posts']['Update'] = {
    updated_at: new Date().toISOString(),
  };

  if (isAiEnabled) {
    updateData.status = 'PENDING_REVIEW';
  }

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

  if (error) {
    throw new Error(error.message);
  }

  // Create content version for edition
  const { data: version } = await supabase
    .from('content_versions')
    .insert({
      entity_type: 'POST',
      entity_id: updatedPost.id,
      version_number: Date.now(),
      title: updatedPost.title,
      content: updatedPost.content,
      edited_by: userId,
    })
    .select('id')
    .maybeSingle();

  // Trigger server-side AI analysis asynchronously on post update
  import('@/app/actions/moderation-ai').then(({ runAiContentModerationAction }) => {
    runAiContentModerationAction({
      entityType: 'POST',
      entityId: updatedPost.id,
      versionId: version?.id || null,
    }).catch((err) => console.error('AI moderation trigger error on post update:', err));
  });

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
