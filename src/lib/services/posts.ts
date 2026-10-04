import { createClient } from '@/lib/supabase/server';
import type { PostType } from '@/types/database';

export interface PostFilterOptions {
  type?: PostType;
  categorySlug?: string;
  sortBy?: 'trending' | 'newest' | 'most_commented' | 'most_reacted';
  province?: string;
  city?: string;
  page?: number;
  limit?: number;
}

export async function getPosts(options: PostFilterOptions = {}) {
  const supabase = await createClient();
  const page = options.page || 1;
  const limit = options.limit || 15;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('posts')
    .select(`
      id,
      title,
      slug,
      content,
      type,
      province,
      city,
      status,
      views_count,
      reactions_count,
      comments_count,
      created_at,
      updated_at,
      author:profiles!posts_author_id_fkey(id, alias, avatar_url, profile_type, badges),
      category:categories!posts_category_id_fkey(id, name, slug),
      post_tags(
        tag:tags(id, name, slug)
      )
    `, { count: 'exact' })
    .eq('status', 'PUBLISHED');

  if (options.type) {
    query = query.eq('type', options.type);
  }

  if (options.province) {
    query = query.eq('province', options.province);
  }

  if (options.city) {
    query = query.eq('city', options.city);
  }

  if (options.categorySlug) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', options.categorySlug)
      .single();

    if (cat) {
      query = query.eq('category_id', cat.id);
    }
  }

  if (options.sortBy === 'newest') {
    query = query.order('created_at', { ascending: false });
  } else if (options.sortBy === 'most_commented') {
    query = query.order('comments_count', { ascending: false });
  } else if (options.sortBy === 'most_reacted') {
    query = query.order('reactions_count', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching posts:', error);
    return { posts: [], count: 0 };
  }

  return { posts: data || [], count: count || 0 };
}

export async function getPostBySlug(slug: string) {
  const supabase = await createClient();

  const { data: post, error } = await supabase
    .from('posts')
    .select(`
      id,
      title,
      slug,
      content,
      type,
      province,
      city,
      status,
      views_count,
      reactions_count,
      comments_count,
      created_at,
      updated_at,
      author:profiles!posts_author_id_fkey(id, alias, avatar_url, profile_type, badges, created_at),
      category:categories!posts_category_id_fkey(id, name, slug),
      post_tags(
        tag:tags(id, name, slug)
      )
    `)
    .eq('slug', slug)
    .single();

  if (error || !post) {
    return null;
  }

  try {
    await supabase.rpc('increment_post_views', { target_post_id: post.id });
  } catch {
    // Ignore RPC failure
  }

  return post;
}

export async function searchPosts(searchQuery: string, options: PostFilterOptions = {}) {
  const supabase = await createClient();
  const page = options.page || 1;
  const limit = options.limit || 15;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('posts')
    .select(`
      id,
      title,
      slug,
      content,
      type,
      province,
      city,
      status,
      views_count,
      reactions_count,
      comments_count,
      created_at,
      updated_at,
      author:profiles!posts_author_id_fkey(id, alias, avatar_url, profile_type, badges),
      category:categories!posts_category_id_fkey(id, name, slug),
      post_tags(
        tag:tags(id, name, slug)
      )
    `, { count: 'exact' })
    .eq('status', 'PUBLISHED');

  if (searchQuery.trim()) {
    query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
  }

  if (options.type) {
    query = query.eq('type', options.type);
  }

  if (options.categorySlug) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', options.categorySlug)
      .single();

    if (cat) {
      query = query.eq('category_id', cat.id);
    }
  }

  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error searching posts:', error);
    return { posts: [], count: 0 };
  }

  return { posts: data || [], count: count || 0 };
}
