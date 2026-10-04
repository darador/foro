import { createClient } from '@/lib/supabase/server';
import { normalizeTag } from '@/lib/utils';
import type { PostType } from '@/types/database';

export interface GlobalSearchOptions {
  type?: PostType | 'ALL';
  categorySlug?: string;
  province?: string;
  city?: string;
  sortBy?: 'relevance' | 'newest' | 'most_commented' | 'most_reacted';
  page?: number;
  limit?: number;
}

export interface PublicProfileSearchResult {
  id: string;
  alias: string;
  avatar_url: string | null;
  profile_type: string;
  description: string | null;
  province: string | null;
  city: string | null;
  badges: string[];
  experiences_count: number;
  comments_count: number;
  reactions_received: number;
  created_at: string;
}

export interface TagStats {
  id: string;
  name: string;
  slug: string;
  totalPosts: number;
  countByType: {
    EXPERIENCE: number;
    QUESTION: number;
    CONFESSION: number;
  };
}

/**
 * Searches public profiles by alias (only profile_searchable = true).
 * Strictly omits sensitive user information.
 */
export async function searchProfiles(
  queryStr: string,
  limit: number = 6
): Promise<PublicProfileSearchResult[]> {
  const cleanQuery = queryStr.trim();
  if (!cleanQuery) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      alias,
      avatar_url,
      profile_type,
      description,
      province,
      city,
      badges,
      experiences_count,
      comments_count,
      reactions_received,
      created_at
    `)
    .eq('profile_searchable', true)
    .ilike('alias', `%${cleanQuery}%`)
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data as PublicProfileSearchResult[];
}

/**
 * Global search across published posts with relevance ranking, filters, and pagination.
 */
export async function searchGlobal(
  queryStr: string,
  options: GlobalSearchOptions = {}
) {
  const supabase = await createClient();
  const page = options.page && options.page > 0 ? options.page : 1;
  const limit = options.limit && options.limit > 0 ? options.limit : 15;
  const offset = (page - 1) * limit;
  const q = queryStr.trim();

  let query = supabase
    .from('posts')
    .select(
      `
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
    `,
      { count: 'exact' }
    )
    .eq('status', 'PUBLISHED');

  // Filter by Type
  if (options.type && options.type !== 'ALL') {
    query = query.eq('type', options.type);
  }

  // Filter by Category
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

  // Filter by Location
  if (options.province) {
    query = query.eq('province', options.province);
  }

  if (options.city) {
    query = query.eq('city', options.city);
  }

  // Text search filter
  if (q) {
    query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`);
  }

  // Sorting logic
  const sortBy = options.sortBy || (q ? 'relevance' : 'newest');

  if (sortBy === 'newest') {
    query = query.order('created_at', { ascending: false });
  } else if (sortBy === 'most_commented') {
    query = query.order('comments_count', { ascending: false });
  } else if (sortBy === 'most_reacted') {
    query = query.order('reactions_count', { ascending: false });
  } else {
    // Relevance default sorting
    query = query.order('created_at', { ascending: false });
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error || !data) {
    console.error('Error in searchGlobal:', error);
    return { posts: [], count: 0, profiles: [] };
  }

  let posts = data as any[];

  // Deterministic relevance sorting if query provided and sortBy is 'relevance'
  if (q && sortBy === 'relevance' && posts.length > 0) {
    const qLower = q.toLowerCase();
    posts = posts.map((post) => {
      let score = 0;
      const titleLower = (post.title || '').toLowerCase();
      const contentLower = (post.content || '').toLowerCase();

      // Exact title match
      if (titleLower === qLower) score += 100;
      // Title starts with query
      else if (titleLower.startsWith(qLower)) score += 60;
      // Title contains query
      else if (titleLower.includes(qLower)) score += 40;

      // Content contains query
      if (contentLower.includes(qLower)) score += 10;

      // Tag match
      if (post.post_tags && Array.isArray(post.post_tags)) {
        const hasTagMatch = post.post_tags.some(
          (pt: any) => pt.tag?.name?.toLowerCase().includes(qLower) || pt.tag?.slug?.toLowerCase().includes(qLower)
        );
        if (hasTagMatch) score += 50;
      }

      // Popularity boost
      score += (post.comments_count || 0) * 2 + (post.reactions_count || 0);

      return { post, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.post);
  }

  // Fetch matching user profiles if query exists
  let profiles: PublicProfileSearchResult[] = [];
  if (q) {
    profiles = await searchProfiles(q, 4);
  }

  return {
    posts,
    count: count || 0,
    profiles,
  };
}

/**
 * Gets popular tags ordered by post count.
 */
export async function getPopularTags(limit: number = 10) {
  const supabase = await createClient();

  const { data: postTags, error } = await supabase
    .from('post_tags')
    .select(`
      tag:tags(id, name, slug),
      post:posts!post_tags_post_id_fkey(status)
    `);

  if (error || !postTags) return [];

  const tagMap: Record<string, { id: string; name: string; slug: string; count: number }> = {};

  for (const item of postTags as any[]) {
    if (item.post?.status === 'PUBLISHED' && item.tag) {
      const tag = item.tag;
      if (!tagMap[tag.slug]) {
        tagMap[tag.slug] = { id: tag.id, name: tag.name, slug: tag.slug, count: 0 };
      }
      tagMap[tag.slug].count += 1;
    }
  }

  return Object.values(tagMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Fetch tag information and post count breakdown by type.
 */
export async function getTagWithStats(tagInput: string): Promise<TagStats | null> {
  const normalized = normalizeTag(tagInput);
  if (!normalized) return null;

  const supabase = await createClient();

  const { data: tag, error } = await supabase
    .from('tags')
    .select('id, name, slug')
    .eq('slug', normalized)
    .single();

  if (error || !tag) {
    return null;
  }

  // Fetch linked published posts
  const { data: postTags } = await supabase
    .from('post_tags')
    .select(`
      post:posts!post_tags_post_id_fkey(type, status)
    `)
    .eq('tag_id', tag.id);

  const countByType = {
    EXPERIENCE: 0,
    QUESTION: 0,
    CONFESSION: 0,
  };

  let totalPosts = 0;

  if (postTags) {
    for (const pt of postTags as any[]) {
      if (pt.post && pt.post.status === 'PUBLISHED') {
        totalPosts++;
        const type = pt.post.type as PostType;
        if (type in countByType) {
          countByType[type]++;
        }
      }
    }
  }

  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    totalPosts,
    countByType,
  };
}
