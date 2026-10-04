import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Tag, Filter, SlidersHorizontal, ChevronLeft, ChevronRight, MessageSquare, HelpCircle, Heart } from 'lucide-react';
import { PostCard } from '@/components/posts/PostCard';
import { getTagWithStats } from '@/lib/services/search';
import { createClient } from '@/lib/supabase/server';
import { normalizeTag } from '@/lib/utils';
import type { PostType } from '@/types/database';

interface TagPageProps {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{
    tipo?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function TagPage({ params, searchParams }: TagPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const rawTag = resolvedParams.tag;
  const normalizedSlug = normalizeTag(rawTag);

  if (!normalizedSlug) {
    notFound();
  }

  const tagStats = await getTagWithStats(normalizedSlug);

  if (!tagStats) {
    notFound();
  }

  const tipo = (resolvedSearchParams.tipo as PostType | 'ALL') || 'ALL';
  const sort = resolvedSearchParams.sort || 'newest';
  const currentPage = Math.max(1, parseInt(resolvedSearchParams.page || '1', 10));
  const limit = 12;
  const offset = (currentPage - 1) * limit;

  const supabase = await createClient();

  // Query post_tags for this tag
  let query = supabase
    .from('post_tags')
    .select(
      `
      post:posts!post_tags_post_id_fkey(
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
      )
    `,
      { count: 'exact' }
    )
    .eq('tag_id', tagStats.id);

  const { data: postTags, count: totalCount } = await query;

  let posts = postTags
    ? postTags
        .map((pt: any) => pt.post)
        .filter((p: any) => p && p.status === 'PUBLISHED')
    : [];

  // Filter by type if requested
  if (tipo !== 'ALL') {
    posts = posts.filter((p: any) => p.type === tipo);
  }

  // Sort posts
  if (sort === 'most_commented') {
    posts.sort((a: any, b: any) => (b.comments_count || 0) - (a.comments_count || 0));
  } else if (sort === 'most_reacted') {
    posts.sort((a: any, b: any) => (b.reactions_count || 0) - (a.reactions_count || 0));
  } else {
    // newest
    posts.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  const filteredCount = posts.length;
  const paginatedPosts = posts.slice(offset, offset + limit);
  const totalPages = Math.ceil(filteredCount / limit);

  // Helper to build URL query parameters
  const buildUrl = (newParams: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams();
    const merged = {
      ...(tipo && tipo !== 'ALL' && { tipo }),
      ...(sort && sort !== 'newest' && { sort }),
      ...(currentPage > 1 && { page: currentPage.toString() }),
      ...newParams,
    };

    for (const [key, val] of Object.entries(merged)) {
      if (val !== undefined && val !== '' && val !== null) {
        search.set(key, String(val));
      }
    }
    const str = search.toString();
    return `/t/${encodeURIComponent(tagStats.slug)}${str ? `?${str}` : ''}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-zinc-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm">
            <Tag className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
              #{tagStats.name}
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              {tagStats.totalPosts} {tagStats.totalPosts === 1 ? 'publicación' : 'publicaciones'} etiquetadas con este tag
            </p>
          </div>
        </div>

        {/* Breakdown Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-zinc-400">
            <MessageSquare className="h-3.5 w-3.5 text-indigo-400" />
            {tagStats.countByType.EXPERIENCE} exp
          </span>
          <span className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-zinc-400">
            <HelpCircle className="h-3.5 w-3.5 text-purple-400" />
            {tagStats.countByType.QUESTION} preg
          </span>
          <span className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-zinc-400">
            <Heart className="h-3.5 w-3.5 text-rose-400" />
            {tagStats.countByType.CONFESSION} conf
          </span>
        </div>
      </div>

      {/* Control Bar: Filters & Sorting */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800 pb-4">
        {/* Type Filter */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className="text-zinc-500 flex items-center gap-1 mr-1">
            <Filter className="h-3.5 w-3.5 text-zinc-400" /> Filtrar tipo:
          </span>
          {[
            { id: 'ALL', label: 'Todos' },
            { id: 'EXPERIENCE', label: 'Experiencias' },
            { id: 'QUESTION', label: 'Preguntas' },
            { id: 'CONFESSION', label: 'Confesiones' },
          ].map((item) => {
            const isActive = tipo === item.id;
            return (
              <Link
                key={item.id}
                href={buildUrl({ tipo: item.id === 'ALL' ? undefined : item.id, page: 1 })}
                className={`rounded-lg px-3 py-1.5 transition ${
                  isActive
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-500 flex items-center gap-1 font-medium">
            <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400" /> Ordenar:
          </span>
          <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
            <Link
              href={buildUrl({ sort: 'newest', page: 1 })}
              className={`rounded-md px-2.5 py-1 transition ${
                sort === 'newest'
                  ? 'bg-zinc-800 text-indigo-400 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Más recientes
            </Link>
            <Link
              href={buildUrl({ sort: 'most_commented', page: 1 })}
              className={`rounded-md px-2.5 py-1 transition ${
                sort === 'most_commented'
                  ? 'bg-zinc-800 text-indigo-400 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Más comentados
            </Link>
            <Link
              href={buildUrl({ sort: 'most_reacted', page: 1 })}
              className={`rounded-md px-2.5 py-1 transition ${
                sort === 'most_reacted'
                  ? 'bg-zinc-800 text-indigo-400 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Más reacciones
            </Link>
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="space-y-4">
        {paginatedPosts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-12 text-center text-xs text-zinc-500 space-y-3">
            <p className="text-sm font-medium text-zinc-300">
              No hay publicaciones activas con este filtro para #{tagStats.name}
            </p>
            <Link href="/explorar" className="inline-block text-indigo-400 underline">
              Explorar otras publicaciones
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedPosts.map((post: any) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-800 pt-6 text-xs text-zinc-400">
          <span>
            Página {currentPage} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            {currentPage > 1 ? (
              <Link
                href={buildUrl({ page: currentPage - 1 })}
                className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-zinc-300 hover:border-zinc-700 hover:text-white transition"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Link>
            ) : (
              <button
                disabled
                className="flex items-center gap-1 rounded-lg border border-zinc-800/40 bg-zinc-950 px-3 py-1.5 text-zinc-600 cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
            )}

            {currentPage < totalPages ? (
              <Link
                href={buildUrl({ page: currentPage + 1 })}
                className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-zinc-300 hover:border-zinc-700 hover:text-white transition"
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <button
                disabled
                className="flex items-center gap-1 rounded-lg border border-zinc-800/40 bg-zinc-950 px-3 py-1.5 text-zinc-600 cursor-not-allowed"
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
