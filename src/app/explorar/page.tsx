import Link from 'next/link';
import { Search, Tag, Filter, Compass, SlidersHorizontal, Users, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { searchGlobal, getPopularTags } from '@/lib/services/search';
import { PostCard } from '@/components/posts/PostCard';
import { ProfileSearchResultCard } from '@/components/common/ProfileSearchResultCard';
import { LocationFilter } from '@/components/common/LocationFilter';
import { createClient } from '@/lib/supabase/server';
import type { PostType } from '@/types/database';

interface ExplorarPageProps {
  searchParams: Promise<{
    q?: string;
    tipo?: string;
    categoria?: string;
    ubicacion?: string;
    provincia?: string;
    ciudad?: string;
    sort?: string;
    page?: string;
  }>;
}

const MVP_CATEGORIES = [
  { name: 'Fetiches', slug: 'fetiches' },
  { name: 'BDSM', slug: 'bdsm' },
  { name: 'Encuentros', slug: 'encuentros' },
  { name: 'Parejas', slug: 'parejas' },
  { name: 'Swinger', slug: 'swinger' },
  { name: 'Escorts', slug: 'escorts' },
  { name: 'Masajes eróticos', slug: 'masajes-eroticos' },
  { name: 'Sexo virtual', slug: 'sexo-virtual' },
  { name: 'Lugares y eventos', slug: 'lugares-y-eventos' },
  { name: 'Otros', slug: 'otros' },
];

export default async function ExplorarPage({ searchParams }: ExplorarPageProps) {
  const resolvedParams = await searchParams;
  const q = resolvedParams.q || '';
  const tipo = (resolvedParams.tipo as PostType | 'ALL') || 'ALL';
  const categoria = resolvedParams.categoria || '';
  const ubicacion = resolvedParams.ubicacion || '';
  const provincia = resolvedParams.provincia || '';
  const ciudad = resolvedParams.ciudad || '';
  const sort = (resolvedParams.sort as any) || (q ? 'relevance' : 'newest');
  const currentPage = Math.max(1, parseInt(resolvedParams.page || '1', 10));
  const limit = 12;

  // Execute global search with all combined filters
  const { posts, count, profiles } = await searchGlobal(q, {
    type: tipo !== 'ALL' ? tipo : undefined,
    categorySlug: categoria || undefined,
    location: ubicacion || undefined,
    province: provincia || undefined,
    city: ciudad || undefined,
    sortBy: sort,
    page: currentPage,
    limit,
  });

  // Fetch Categories for Filter Bar (merging with official MVP categories)
  let categories: Array<{ name: string; slug: string }> = [...MVP_CATEGORIES];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('categories').select('name, slug').order('name');
    if (data && data.length > 0) {
      // Create a map to avoid duplicates and ensure all official categories are present
      const map = new Map<string, string>();
      MVP_CATEGORIES.forEach((c) => map.set(c.slug, c.name));
      data.forEach((c: { name: string; slug: string }) => map.set(c.slug, c.name));
      categories = Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
    }
  } catch {
    // Keep fallback MVP categories
  }

  // Fetch Popular Tags
  const popularTags = await getPopularTags(8);

  const totalPages = Math.ceil(count / limit);

  // Helper to build URL query strings safely while preserving all active filters
  const buildUrl = (newParams: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = {
      ...(q && { q }),
      ...(tipo && tipo !== 'ALL' && { tipo }),
      ...(categoria && { categoria }),
      ...(ubicacion && { ubicacion }),
      ...(provincia && { provincia }),
      ...(ciudad && { ciudad }),
      ...(sort && sort !== 'newest' && { sort }),
      ...(currentPage > 1 && { page: currentPage.toString() }),
      ...newParams,
    };

    for (const [key, val] of Object.entries(merged)) {
      if (val !== undefined && val !== '' && val !== null) {
        params.set(key, String(val));
      }
    }
    const str = params.toString();
    return str ? `/explorar?${str}` : '/explorar';
  };

  const hasActiveFilters = Boolean(q || (tipo && tipo !== 'ALL') || categoria || ubicacion || provincia || ciudad);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#211B29] dark:text-zinc-100 flex items-center gap-2.5">
          <Compass className="h-6 w-6 sm:h-7 sm:w-7 text-[var(--violet-primary)] dark:text-indigo-400" />
          Explorar comunidad
        </h1>
        <p className="text-xs sm:text-sm text-[#62596C] dark:text-zinc-400 mt-1.5">
          Descubrí experiencias, preguntas y conversaciones de la comunidad
        </p>
      </div>

      {/* Main Search Input */}
      <form action="/explorar" method="GET" className="relative">
        <Search className="absolute left-4 top-3.5 h-5 w-5 text-[#777080] dark:text-zinc-500" />
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar publicaciones, temas, fetiches o usuarios (@alias)..."
          className="w-full rounded-xl border border-[#E3DDE9] bg-[#FFFFFF] py-3 pl-12 pr-10 text-xs sm:text-sm text-[#211B29] placeholder-[#777080] focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/40 transition shadow-none dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500 dark:shadow-sm"
        />
        {q && (
          <Link
            href={buildUrl({ q: undefined, page: 1 })}
            className="absolute right-3 top-3 text-[#777080] hover:text-[#211B29] dark:text-zinc-400 dark:hover:text-zinc-200 transition p-1"
            title="Limpiar búsqueda"
          >
            <X className="h-4 w-4" />
          </Link>
        )}
        {tipo && tipo !== 'ALL' && <input type="hidden" name="tipo" value={tipo} />}
        {categoria && <input type="hidden" name="categoria" value={categoria} />}
        {ubicacion && <input type="hidden" name="ubicacion" value={ubicacion} />}
        {provincia && <input type="hidden" name="provincia" value={provincia} />}
        {ciudad && <input type="hidden" name="ciudad" value={ciudad} />}
        {sort && <input type="hidden" name="sort" value={sort} />}
      </form>

      {/* Popular Tags */}
      {popularTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#62596C] dark:text-zinc-500 flex items-center gap-1 font-medium mr-1">
            <Tag className="h-3.5 w-3.5 text-[var(--violet-primary)] dark:text-indigo-400" /> Tags populares:
          </span>
          {popularTags.map((tag) => (
            <Link
              key={tag.slug}
              href={`/t/${encodeURIComponent(tag.slug)}`}
              className="rounded-full border border-[#E3DDE9] bg-white px-2.5 py-1 text-[11px] font-medium text-[#62596C] hover:border-[var(--violet-primary)] hover:text-[var(--violet-primary)] hover:bg-[#F7F3FA] transition dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-300 dark:hover:bg-zinc-800"
            >
              #{tag.name} <span className="text-[10px] text-[#777080] dark:text-zinc-500">({tag.count})</span>
            </Link>
          ))}
        </div>
      )}

      {/* Primary Control Bar: Post Types, Location & Sorting */}
      <div className="flex flex-col gap-4 border-y border-[#E3DDE9] dark:border-zinc-800 py-4">
        {/* Type Tabs */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className="text-[#62596C] dark:text-zinc-500 flex items-center gap-1 mr-1">
            <Filter className="h-3.5 w-3.5 text-[#777080] dark:text-zinc-400" /> Tipo:
          </span>
          {[
            { id: 'ALL', label: 'Todos' },
            { id: 'EXPERIENCE', label: 'Experiencias' },
            { id: 'QUESTION', label: 'Preguntas' },
            { id: 'CONFESSION', label: 'Confesiones' },
            { id: 'DEBATE', label: 'Debates' },
          ].map((item) => {
            const isActive = tipo === item.id;
            return (
              <Link
                key={item.id}
                href={buildUrl({ tipo: item.id === 'ALL' ? undefined : item.id, page: 1 })}
                className={`rounded-full px-3 py-1.5 transition-all duration-150 border ${
                  isActive
                    ? 'bg-[#F0E7FC] border-[#8B5CF6] text-[#6D28D9] font-semibold dark:bg-indigo-600 dark:border-indigo-600 dark:text-white dark:font-semibold dark:shadow-sm'
                    : 'bg-white border-[#E3DDE9] text-[#62596C] hover:bg-[#F7F3FA] hover:border-[#DDD6FE] hover:text-[#6D28D9] dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:border-zinc-700'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Secondary Row: Location Filter & Sort Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
          {/* Location Filter */}
          <LocationFilter currentLocation={ubicacion} baseUrl={buildUrl({ ubicacion: undefined, page: 1 })} />

          {/* Sort Selector */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#62596C] dark:text-zinc-500 flex items-center gap-1 font-medium whitespace-nowrap">
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#777080] dark:text-zinc-400" /> Ordenar por:
            </span>
            <div className="flex items-center gap-1.5 rounded-lg border border-[#E3DDE9] bg-white/70 p-1 dark:border-zinc-800 dark:bg-zinc-900 dark:p-0.5">
              {q && (
                <Link
                  href={buildUrl({ sort: 'relevance', page: 1 })}
                  className={`rounded-md px-2.5 py-1 text-xs transition-all duration-150 border ${
                    sort === 'relevance'
                      ? 'bg-[#F0E7FC] border-[#8B5CF6] text-[#6D28D9] font-semibold dark:bg-zinc-800 dark:border-transparent dark:text-indigo-400 dark:font-semibold'
                      : 'bg-white border-[#E3DDE9] text-[#62596C] hover:bg-[#F7F3FA] hover:border-[#DDD6FE] hover:text-[#6D28D9] dark:bg-transparent dark:border-transparent dark:text-zinc-400 dark:hover:text-zinc-200'
                  }`}
                >
                  Relevancia
                </Link>
              )}
              <Link
                href={buildUrl({ sort: 'newest', page: 1 })}
                className={`rounded-md px-2.5 py-1 text-xs transition-all duration-150 border ${
                  sort === 'newest'
                    ? 'bg-[#F0E7FC] border-[#8B5CF6] text-[#6D28D9] font-semibold dark:bg-zinc-800 dark:border-transparent dark:text-indigo-400 dark:font-semibold'
                    : 'bg-white border-[#E3DDE9] text-[#62596C] hover:bg-[#F7F3FA] hover:border-[#DDD6FE] hover:text-[#6D28D9] dark:bg-transparent dark:border-transparent dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                Más recientes
              </Link>
              <Link
                href={buildUrl({ sort: 'most_commented', page: 1 })}
                className={`rounded-md px-2.5 py-1 text-xs transition-all duration-150 border ${
                  sort === 'most_commented'
                    ? 'bg-[#F0E7FC] border-[#8B5CF6] text-[#6D28D9] font-semibold dark:bg-zinc-800 dark:border-transparent dark:text-indigo-400 dark:font-semibold'
                    : 'bg-white border-[#E3DDE9] text-[#62596C] hover:bg-[#F7F3FA] hover:border-[#DDD6FE] hover:text-[#6D28D9] dark:bg-transparent dark:border-transparent dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                Más comentados
              </Link>
              <Link
                href={buildUrl({ sort: 'most_reacted', page: 1 })}
                className={`rounded-md px-2.5 py-1 text-xs transition-all duration-150 border ${
                  sort === 'most_reacted'
                    ? 'bg-[#F0E7FC] border-[#8B5CF6] text-[#6D28D9] font-semibold dark:bg-zinc-800 dark:border-transparent dark:text-indigo-400 dark:font-semibold'
                    : 'bg-white border-[#E3DDE9] text-[#62596C] hover:bg-[#F7F3FA] hover:border-[#DDD6FE] hover:text-[#6D28D9] dark:bg-transparent dark:border-transparent dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                Más reacciones
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Category Pills (with responsive mobile scroll) */}
      {categories.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-[#62596C] dark:text-zinc-400">Categorías</h2>
          <div className="flex overflow-x-auto sm:flex-wrap gap-2 pb-1.5 -mx-4 px-4 sm:mx-0 sm:px-0">
            <Link
              href={buildUrl({ categoria: undefined, page: 1 })}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150 whitespace-nowrap shrink-0 ${
                !categoria
                  ? 'bg-[#FCE7F3] border-[#E879A8] text-[#9D174D] font-semibold dark:border-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-300 dark:font-semibold'
                  : 'bg-white border-[#E3DDE9] text-[#62596C] hover:bg-[#FDF2F8] hover:border-[#F9A8D4] hover:text-[#9D174D] dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              Todas
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={buildUrl({ categoria: cat.slug, page: 1 })}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150 whitespace-nowrap shrink-0 ${
                  categoria === cat.slug
                    ? 'bg-[#FCE7F3] border-[#E879A8] text-[#9D174D] font-semibold dark:border-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-300 dark:font-semibold'
                    : 'bg-white border-[#E3DDE9] text-[#62596C] hover:bg-[#FDF2F8] hover:border-[#F9A8D4] hover:text-[#9D174D] dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-200'
                }`}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* User Profiles Search Section */}
      {profiles && profiles.length > 0 && (
        <div className="space-y-3 rounded-xl border border-indigo-500/20 bg-indigo-950/10 p-4">
          <h2 className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
            <Users className="h-4 w-4" /> Usuarios encontrados ({profiles.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {profiles.map((profile) => (
              <ProfileSearchResultCard key={profile.id} profile={profile} />
            ))}
          </div>
        </div>
      )}

      {/* Search Results Summary & Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-[#62596C] dark:text-zinc-400">
          <span>
            {count} {count === 1 ? 'publicación encontrada' : 'publicaciones encontradas'}
            {q ? ` para "${q}"` : ''}
          </span>

          {hasActiveFilters && (
            <Link
              href="/explorar"
              className="text-[var(--pink-primary)] dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
            >
              <X className="h-3.5 w-3.5" /> Limpiar filtros
            </Link>
          )}
        </div>

        {posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-card)] p-12 text-center text-xs text-[var(--text-secondary)] space-y-4 shadow-[var(--card-shadow)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-[var(--text-muted)]">
              <Search className="h-6 w-6" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                Todavía no hay publicaciones con estos filtros
              </p>
              <p className="text-[var(--text-secondary)]">
                Probá con otra categoría o cambiá los criterios de búsqueda.
              </p>
            </div>
            {hasActiveFilters && (
              <div className="pt-2">
                <Link
                  href="/explorar"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--btn-gradient-from)] to-[var(--btn-gradient-to)] px-4 py-2 text-xs font-medium text-white hover:opacity-95 transition shadow"
                >
                  Ver todas las publicaciones
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post as any} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[var(--border-color)] pt-6 text-xs text-[var(--text-secondary)]">
          <span>
            Página {currentPage} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            {currentPage > 1 ? (
              <Link
                href={buildUrl({ page: currentPage - 1 })}
                className="flex items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-1.5 text-[var(--text-primary)] hover:border-[var(--pink-primary)] transition"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Link>
            ) : (
              <button
                disabled
                className="flex items-center gap-1 rounded-lg border border-[var(--border-color)]/40 bg-[var(--bg-secondary)]/50 px-3 py-1.5 text-[var(--text-muted)] cursor-not-allowed opacity-60"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
            )}

            {currentPage < totalPages ? (
              <Link
                href={buildUrl({ page: currentPage + 1 })}
                className="flex items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-1.5 text-[var(--text-primary)] hover:border-[var(--pink-primary)] transition"
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <button
                disabled
                className="flex items-center gap-1 rounded-lg border border-[var(--border-color)]/40 bg-[var(--bg-secondary)]/50 px-3 py-1.5 text-[var(--text-muted)] cursor-not-allowed opacity-60"
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
