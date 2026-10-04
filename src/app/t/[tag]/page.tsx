import { notFound } from 'next/navigation';
import { Tag } from 'lucide-react';
import { PostCard } from '@/components/posts/PostCard';
import { createClient } from '@/lib/supabase/server';

interface TagPageProps {
  params: Promise<{ tag: string }>;
}

export default async function TagPage({ params }: TagPageProps) {
  const resolvedParams = await params;
  const tagSlug = resolvedParams.tag.toLowerCase();

  const supabase = await createClient();

  // Find tag
  const { data: tagData } = await supabase
    .from('tags')
    .select('id, name, slug')
    .eq('slug', tagSlug)
    .single();

  if (!tagData) {
    notFound();
  }

  // Fetch posts linked to this tag
  const { data: postTags } = await supabase
    .from('post_tags')
    .select(`
      post:posts!post_tags_post_id_fkey(
        id,
        title,
        slug,
        content,
        type,
        province,
        city,
        status,
        created_at,
        reactions_count,
        comments_count,
        author:profiles!posts_author_id_fkey(id, alias, avatar_url, profile_type, badges),
        category:categories!posts_category_id_fkey(id, name, slug),
        post_tags(
          tag:tags(id, name, slug)
        )
      )
    `)
    .eq('tag_id', tagData.id);

  const posts = postTags
    ? postTags
        .map((pt: any) => pt.post)
        .filter((p: any) => p && p.status === 'PUBLISHED')
    : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <Tag className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">#{tagData.name}</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {posts.length} publicaciones etiquetadas con este tag
          </p>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-8 text-center text-xs text-zinc-500">
          No hay publicaciones activas asociadas a este tag.
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post: any) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
