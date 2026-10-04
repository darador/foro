import Link from 'next/link';
import { Search, Tag, Filter, Compass } from 'lucide-react';
import { searchPosts } from '@/lib/services/posts';
import { PostCard } from '@/components/posts/PostCard';
import { createClient } from '@/lib/supabase/server';
import type { PostType } from '@/types/database';

interface ExplorarPageProps {
  searchParams: Promise<{
    q?: string;
    tipo?: string;
    categoria?: string;
    provincia?: string;
    ciudad?: string;
  }>;
}

export default async function ExplorarPage({ searchParams }: ExplorarPageProps) {
  const resolvedParams = await searchParams;
  const q = resolvedParams.q || '';
  const tipo = (resolvedParams.tipo as PostType) || undefined;
  const categoria = resolvedParams.categoria || undefined;
  const provincia = resolvedParams.provincia || undefined;

  const { posts, count } = await searchPosts(q, {
    type: tipo,
    categorySlug: categoria,
    province: provincia,
    limit: 20,
  });

  // Fetch Categories for Category Filter Bar
  let categories: Array<{ name: string; slug: string }> = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('categories').select('name, slug').order('name');
    if (data) categories = data;
  } catch {
    // Ignore fallback
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <Compass className="h-6 w-6 text-indigo-400" />
          Explorar Comunidad
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Busca por palabras clave, explora por tipo de contenido o filtra por categorías.
        </p>
      </div>

      {/* Search Input Bar */}
      <form action="/explorar" method="GET" className="relative">
        <Search className="absolute left-4 top-3.5 h-5 w-5 text-zinc-500" />
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar experiencias, preguntas, confesiones o palabras clave..."
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 py-3 pl-12 pr-4 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
        />
        {tipo && <input type="hidden" name="tipo" value={tipo} />}
        {categoria && <input type="hidden" name="categoria" value={categoria} />}
      </form>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        {/* Post Type Filters */}
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="text-zinc-500 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Tipo:
          </span>
          <Link
            href={`/explorar?${new URLSearchParams({ ...(q && { q }), ...(categoria && { categoria }) })}`}
            className={`rounded-lg px-3 py-1.5 transition ${
              !tipo ? 'bg-indigo-600 text-white font-semibold' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            Todos
          </Link>
          <Link
            href={`/explorar?${new URLSearchParams({ tipo: 'EXPERIENCE', ...(q && { q }), ...(categoria && { categoria }) })}`}
            className={`rounded-lg px-3 py-1.5 transition ${
              tipo === 'EXPERIENCE' ? 'bg-indigo-600 text-white font-semibold' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            Experiencias
          </Link>
          <Link
            href={`/explorar?${new URLSearchParams({ tipo: 'QUESTION', ...(q && { q }), ...(categoria && { categoria }) })}`}
            className={`rounded-lg px-3 py-1.5 transition ${
              tipo === 'QUESTION' ? 'bg-indigo-600 text-white font-semibold' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            Preguntas
          </Link>
          <Link
            href={`/explorar?${new URLSearchParams({ tipo: 'CONFESSION', ...(q && { q }), ...(categoria && { categoria }) })}`}
            className={`rounded-lg px-3 py-1.5 transition ${
              tipo === 'CONFESSION' ? 'bg-indigo-600 text-white font-semibold' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            Confesiones
          </Link>
        </div>
      </div>

      {/* Categories Grid */}
      {categories.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-indigo-400" /> Categorías
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/explorar?${new URLSearchParams({ ...(q && { q }), ...(tipo && { tipo }) })}`}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                !categoria
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                  : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              Todas las categorías
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/explorar?${new URLSearchParams({ categoria: cat.slug, ...(q && { q }), ...(tipo && { tipo }) })}`}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  categoria === cat.slug
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Search Results */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>{count} publicaciones encontradas</span>
        </div>

        {posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-8 text-center text-xs text-zinc-500 space-y-2">
            <p>No se encontraron publicaciones con los filtros seleccionados.</p>
            <Link href="/explorar" className="text-indigo-400 underline">
              Limpiar filtros
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post as any} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
