import Link from 'next/link';
import { MessageSquare, Flame, Shield, Compass, Lock, Clock, MessageCircle } from 'lucide-react';
import { getPosts } from '@/lib/services/posts';
import { PostCard } from '@/components/posts/PostCard';

interface HomePageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedParams = await searchParams;
  const tab = resolvedParams.tab || 'trending';

  const sortMap: Record<string, 'trending' | 'newest' | 'most_commented'> = {
    trending: 'trending',
    nuevos: 'newest',
    comentados: 'most_commented',
  };

  const currentSort = sortMap[tab] || 'trending';
  const { posts, count } = await getPosts({ sortBy: currentSort, limit: 20 });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-10 backdrop-blur-sm shadow-lg">
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
            <Lock className="h-3.5 w-3.5" />
            Comunidad 100% Anónima & Discreta
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
            Conversaciones y experiencias entre adultos.
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            Un espacio respetuoso para compartir relatos personales, realizar preguntas y conversar abiertamente sobre sexualidad y fetiches.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link
              href="/explorar"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs sm:text-sm font-medium text-white shadow hover:bg-indigo-500 transition"
            >
              <Compass className="h-4 w-4" />
              Explorar foro
            </Link>
            <Link
              href="/registro"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs sm:text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition"
            >
              Crear cuenta anónima
            </Link>
          </div>
        </div>
      </section>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Feed Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Feed Filter Tabs */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
              <Flame className="h-5 w-5 text-indigo-400" />
              Publicaciones
            </h2>

            <div className="flex items-center gap-1 rounded-lg bg-zinc-900/80 p-1 border border-zinc-800 text-xs font-medium">
              <Link
                href="/?tab=trending"
                className={`flex items-center gap-1 px-3 py-1 rounded-md transition ${
                  tab === 'trending' || !tab ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Flame className="h-3.5 w-3.5" />
                Tendencias
              </Link>
              <Link
                href="/?tab=nuevos"
                className={`flex items-center gap-1 px-3 py-1 rounded-md transition ${
                  tab === 'nuevos' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                Nuevos
              </Link>
              <Link
                href="/?tab=comentados"
                className={`flex items-center gap-1 px-3 py-1 rounded-md transition ${
                  tab === 'comentados' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Más comentados
              </Link>
            </div>
          </div>

          {/* Posts List */}
          {posts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-8 text-center space-y-3">
              <MessageSquare className="h-8 w-8 mx-auto text-zinc-600" />
              <p className="text-sm font-semibold text-zinc-300">Aún no hay publicaciones en esta sección</p>
              <p className="text-xs text-zinc-500">¡Sé el primero en compartir tu experiencia de forma anónima!</p>
              <div className="pt-2">
                <Link
                  href="/publicar"
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow hover:bg-indigo-500 transition"
                >
                  Crear publicación
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post as any} />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <Shield className="h-4 w-4 text-indigo-400" />
              Reglas de Privacidad & Seguridad
            </h3>
            <ul className="text-xs text-zinc-400 space-y-2 list-disc list-inside leading-relaxed">
              <li>Tu e-mail es 100% privado y jamás se publicará.</li>
              <li>Prohibido compartir números de teléfono o WhatsApp.</li>
              <li>No compartas direcciones ni domicilios exactos.</li>
              <li>Prohibido publicar material íntimo sin consentimiento.</li>
              <li>Solo para mayores de 18 años.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
