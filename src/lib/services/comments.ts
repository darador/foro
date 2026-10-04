import { createClient } from '@/lib/supabase/client';
import { sanitizeHtml } from '@/lib/sanitize';
import type { CommentFormValues } from '@/lib/validations/comment';

export interface CommentNode {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  status: string;
  depth: number;
  created_at: string;
  updated_at: string;
  author: {
    id: string;
    alias: string;
    avatar_url: string | null;
    badges: string[];
  };
  replies?: CommentNode[];
}

export async function getCommentsForPost(postId: string): Promise<CommentNode[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('comments')
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
    .eq('post_id', postId)
    .eq('status', 'PUBLISHED')
    .order('created_at', { ascending: true });

  if (error || !data) {
    console.error('Error fetching comments:', error);
    return [];
  }

  const commentMap = new Map<string, CommentNode>();
  const rootComments: CommentNode[] = [];

  data.forEach((item) => {
    const node: CommentNode = {
      id: item.id,
      post_id: item.post_id,
      author_id: item.author_id,
      parent_id: item.parent_id,
      content: item.content,
      status: item.status,
      depth: item.depth,
      created_at: item.created_at,
      updated_at: item.updated_at,
      author: Array.isArray(item.author) ? item.author[0] : item.author,
      replies: [],
    };
    commentMap.set(node.id, node);
  });

  data.forEach((item) => {
    const node = commentMap.get(item.id)!;
    if (node.parent_id && commentMap.has(node.parent_id)) {
      const parent = commentMap.get(node.parent_id)!;
      parent.replies = parent.replies || [];
      parent.replies.push(node);
    } else {
      rootComments.push(node);
    }
  });

  return rootComments;
}

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
