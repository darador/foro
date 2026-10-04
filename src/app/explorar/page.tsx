import Link from 'next/link';
import { Search, Tag, Filter, Compass, SlidersHorizontal, Users, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { searchGlobal, getPopularTags } from '@/lib/services/search';
import { PostCard } from '@/components/posts/PostCard';
import { ProfileSearchResultCard } from '@/components/common/ProfileSearchResultCard';
import { createClient } from '@/lib/supabase/server';
import type { PostType } from '@/types/database';

interface ExplorarPageProps {
  searchParams: Promise<{
    q?: string;
    tipo?: string;
    categoria?: string;
    provincia?: string;
    ciudad?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function ExplorarPage({ searchParams }: ExplorarPageProps) {
  const resolvedParams = await searchParams;
  const q = resolvedParams.q || '';
  const tipo = (resolvedParams.tipo as PostType | 'ALL') || 'ALL';
  const categoria = resolvedParams.categoria || '';
  const provincia = resolvedParams.provincia || '';
  const ciudad = resolvedParams.ciudad || '';
  const sort = (resolvedParams.sort as any) || (q ? 'relevance' : 'newest');
  const currentPage = Math.max(1, parseInt(resolvedParams.page || '1', 10));
  const limit = 12;

  // Execute global search
  const { posts, count, profiles } = await searchGlobal(q, {
    type: tipo !== 'ALL' ? tipo : undefined,
    categorySlug: categoria || undefined,
    province: provincia || undefined,
    city: ciudad || undefined,
    sortBy: sort,
    page: currentPage,
    limit,
  });

  // Fetch Categories for Filter Bar
  let categories: Array<{ name: string; slug: string }> = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('categories').select('name, slug').order('name');
    if (data) categories = data;
  } catch {
    // Ignore fallback
  }

  // Fetch Popular Tags
  const popularTags = await getPopularTags(8);

  const totalPages = Math.ceil(count / limit);

  // Helper to build URL query strings safely
  const buildUrl = (newParams: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = {
      ...(q && { q }),
      ...(tipo && tipo !== 'ALL' && { tipo }),
      ...(categoria && { categoria }),
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

  const hasActiveFilters = Boolean(q || (tipo && tipo !== 'ALL') || categoria || provincia || ciudad);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <Compass className="h-6 w-6 text-indigo-400" />
          Explorar Comunidad
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Descubre publicaciones, experiencias, confesiones, usuarios y temas tendencia.
        </p>
      </div>

      {/* Main Search Input */}
      <form action="/explorar" method="GET" className="relative">
        <Search className="absolute left-4 top-3.5 h-5 w-5 text-zinc-500" />
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar publicaciones, temas, fetiches o usuarios (@alias)..."
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 py-3 pl-12 pr-10 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm transition"
        />
        {q && (
          <Link
            href={buildUrl({ q: undefined, page: 1 })}
            className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-200 transition p-1"
            title="Limpiar búsqueda"
          >
            <X className="h-4 w-4" />
          </Link>
        )}
        {tipo && tipo !== 'ALL' && <input type="hidden" name="tipo" value={tipo} />}
        {categoria && <input type="hidden" name="categoria" value={categoria} />}
        {provincia && <input type="hidden" name="provincia" value={provincia} />}
        {ciudad && <input type="hidden" name="ciudad" value={ciudad} />}
        {sort && <input type="hidden" name="sort" value={sort} />}
      </form>

      {/* Popular Tags */}
      {popularTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500 flex items-center gap-1 font-medium mr-1">
            <Tag className="h-3.5 w-3.5 text-indigo-400" /> Tags populares:
          </span>
          {popularTags.map((tag) => (
            <Link
              key={tag.slug}
              href={`/t/${encodeURIComponent(tag.slug)}`}
              className="rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:border-indigo-500 hover:text-indigo-300 hover:bg-zinc-800 transition"
            >
              #{tag.name} <span className="text-[10px] text-zinc-500">({tag.count})</span>
            </Link>
          ))}
        </div>
      )}

      {/* Primary Control Bar: Post Types & Sorting */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-y border-zinc-800 py-4">
        {/* Type Tabs */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className="text-zinc-500 flex items-center gap-1 mr-1">
            <Filter className="h-3.5 w-3.5 text-zinc-400" /> Tipo:
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
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
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
            <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400" /> Ordenar por:
          </span>
          <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
            {q && (
              <Link
                href={buildUrl({ sort: 'relevance', page: 1 })}
                className={`rounded-md px-2.5 py-1 transition ${
                  sort === 'relevance'
                    ? 'bg-zinc-800 text-indigo-400 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Relevancia
              </Link>
            )}
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

      {/* Category Pills */}
      {categories.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-zinc-400">Categorías</h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildUrl({ categoria: undefined, page: 1 })}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                !categoria
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300 font-semibold'
                  : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              Todas
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={buildUrl({ categoria: cat.slug, page: 1 })}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  categoria === cat.slug
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300 font-semibold'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
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
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>
            {count} {count === 1 ? 'publicación encontrada' : 'publicaciones encontradas'}
            {q ? ` para "${q}"` : ''}
          </span>

          {hasActiveFilters && (
            <Link
              href="/explorar"
              className="text-indigo-400 hover:underline flex items-center gap-1 font-medium"
            >
              <X className="h-3.5 w-3.5" /> Limpiar filtros
            </Link>
          )}
        </div>

        {posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center text-xs text-zinc-400 space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-zinc-500">
              <Search className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-zinc-200">
                No se encontraron publicaciones
              </p>
              <p className="text-zinc-500">
                Prueba buscando con palabras clave diferentes o eliminando los filtros seleccionados.
              </p>
            </div>
            {hasActiveFilters && (
              <div className="pt-2">
                <Link
                  href="/explorar"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition shadow"
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
