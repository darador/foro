import Link from 'next/link';
import {
  MessageSquare,
  Flame,
  Shield,
  Compass,
  Lock,
  Clock,
  MessageCircle,
  EyeOff,
  Sparkles,
  ArrowRight,
  HeartHandshake,
  Feather,
} from 'lucide-react';
import { getPosts } from '@/lib/services/posts';
import { PostCard } from '@/components/posts/PostCard';

interface HomePageProps {
  searchParams: Promise<{ tab?: string }>;
}

const FEATURED_CATEGORIES = [
  {
    name: 'BDSM',
    slug: 'bdsm',
    desc: 'Dominación, sumisión y bondage.',
  },
  {
    name: 'Encuentros',
    slug: 'encuentros',
    desc: 'Relatos, preguntas y vivencias.',
  },
  {
    name: 'Escorts',
    slug: 'escorts',
    desc: 'Experiencias, preguntas y debates.',
  },
  {
    name: 'Fetiches',
    slug: 'fetiches',
    desc: 'Conversaciones y experiencias.',
  },
  {
    name: 'Lugares y eventos',
    slug: 'lugares-y-eventos',
    desc: 'Clubes, fiestas privadas y encuentros.',
  },
  {
    name: 'Otros',
    slug: 'otros',
    desc: 'Otras conversaciones adultas.',
  },
];

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedParams = await searchParams;
  const tab = resolvedParams.tab || 'trending';

  const sortMap: Record<string, 'trending' | 'newest' | 'most_commented'> = {
    trending: 'trending',
    nuevos: 'newest',
    comentados: 'most_commented',
  };

  const currentSort = sortMap[tab] || 'trending';
  const { posts } = await getPosts({ sortBy: currentSort, limit: 20 });

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 space-y-9">
      {/* Hero Principal */}
      <section
        style={{ background: 'var(--hero-bg)' }}
        className="relative overflow-hidden rounded-[20px] border border-[var(--border-color)] p-7 sm:p-9 lg:p-10 min-h-[320px] sm:min-h-[338px] flex flex-col justify-center transition-colors duration-200 shadow-[var(--card-shadow)]"
      >
        <div className="relative z-10 max-w-xl space-y-4">
          {/* Subtle Top Tags */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center rounded-full border border-[var(--border-color)] bg-[var(--badge-bg)] px-3 py-1 text-xs font-semibold text-[var(--pink-primary)]">
              Comunidad Adulta 18+
            </span>
            <span className="inline-flex items-center rounded-full border border-[var(--border-color)] bg-[var(--bg-card)]/80 backdrop-blur-sm px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
              Privacidad & Consentimiento
            </span>
          </div>

          {/* Hero Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold tracking-tight text-[var(--text-primary)] leading-[1.12]">
            Lo que te intriga también merece{' '}
            <span className="bg-gradient-to-r from-[var(--pink-primary)] to-[var(--violet-primary)] bg-clip-text text-transparent">
              un lugar donde hablarse.
            </span>
          </h1>

          {/* Hero Description */}
          <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed max-w-[440px]">
            Un espacio para compartir experiencias, explorar intereses y conversar sin prejuicios.
            Con respeto, consentimiento y privacidad.
          </p>

          {/* Hero Action Buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link
              href="/explorar"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--btn-gradient-from)] to-[var(--btn-gradient-to)] px-5 py-3 text-sm font-semibold text-white shadow-md hover:opacity-95 transition active:scale-[0.98]"
            >
              <Compass className="h-4 w-4" />
              <span>Explorar la comunidad</span>
            </Link>

            <Link
              href="/registro"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--pink-primary)] shadow-sm transition active:scale-[0.98]"
            >
              <EyeOff className="h-4 w-4 text-[var(--text-muted)]" />
              <span>Crear mi identidad anónima</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Explorar por Temática */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--pink-primary)]" />
            <span>EXPLORAR POR TEMÁTICA</span>
          </h2>
          <Link
            href="/explorar"
            className="text-xs font-semibold text-[var(--pink-primary)] hover:underline transition flex items-center gap-1"
          >
            <span>Ver todo →</span>
          </Link>
        </div>

        {/* 6 Category Cards in one row on Desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {FEATURED_CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/explorar?categoria=${cat.slug}`}
              className="group rounded-[10px] border border-[var(--border-color)] bg-[var(--bg-card)] p-3.5 hover:border-[var(--violet-primary)]/50 hover:bg-[var(--bg-secondary)] shadow-[var(--card-shadow)] transition-all duration-150 flex flex-col justify-between"
            >
              <div>
                <span className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--pink-primary)] transition">
                  {cat.name}
                </span>
                <p className="text-xs text-[var(--text-secondary)] truncate mt-1">
                  {cat.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Main Content Grid: Publicaciones (68%) & Panel Lateral (32%) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Feed (68%) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Feed Header & Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] pb-3">
            <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Flame className="h-5 w-5 text-[var(--pink-primary)]" />
              <span>Publicaciones</span>
            </h2>

            {/* Segmented Filter Control */}
            <div className="flex items-center gap-1 rounded-xl bg-[var(--bg-secondary)] p-1 border border-[var(--border-color)] text-xs font-medium">
              <Link
                href="/?tab=trending"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition duration-150 ${
                  tab === 'trending' || !tab
                    ? 'bg-gradient-to-r from-[var(--btn-gradient-from)] to-[var(--btn-gradient-to)] text-white shadow-sm font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                }`}
              >
                <Flame className="h-3.5 w-3.5" />
                <span>Tendencias</span>
              </Link>
              <Link
                href="/?tab=nuevos"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition duration-150 ${
                  tab === 'nuevos'
                    ? 'bg-gradient-to-r from-[var(--btn-gradient-from)] to-[var(--btn-gradient-to)] text-white shadow-sm font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>Nuevos</span>
              </Link>
              <Link
                href="/?tab=comentados"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition duration-150 ${
                  tab === 'comentados'
                    ? 'bg-gradient-to-r from-[var(--btn-gradient-from)] to-[var(--btn-gradient-to)] text-white shadow-sm font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                }`}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>Más comentados</span>
              </Link>
            </div>
          </div>

          {/* Posts List */}
          {posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-card)] p-10 text-center space-y-3.5 shadow-[var(--card-shadow)]">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Aún no hay publicaciones en esta sección
              </h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">
                Sé la primera persona en compartir una experiencia o abrir una conversación con respeto.
              </p>
              <div className="pt-2">
                <Link
                  href="/publicar"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--btn-gradient-from)] to-[var(--btn-gradient-to)] px-4 py-2 text-xs font-semibold text-white shadow hover:opacity-95 transition"
                >
                  <Feather className="h-3.5 w-3.5" />
                  <span>Crear publicación</span>
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

        {/* Right Column: Sidebar (32%) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Card: Espacio Seguro & Privado */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 sm:p-6 space-y-4 shadow-[var(--card-shadow)] transition-colors duration-200">
            <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Shield className="h-5 w-5 text-[var(--pink-primary)]" />
              <span>Espacio Seguro & Privado</span>
            </h3>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              ForoFetiche busca proteger tu intimidad para que puedas conversar con confianza.
            </p>

            <div className="space-y-3.5 pt-1">
              {/* Item 1: Email Privado */}
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-secondary)] text-[var(--pink-primary)] shrink-0 mt-0.5">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[var(--text-primary)]">Email privado</h4>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-tight mt-0.5">
                    Tu correo nunca será visible públicamente.
                  </p>
                </div>
              </div>

              {/* Item 2: Identidad por Alias */}
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-secondary)] text-[var(--pink-primary)] shrink-0 mt-0.5">
                  <EyeOff className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[var(--text-primary)]">Identidad por alias</h4>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-tight mt-0.5">
                    Tu alias es tu identificador público.
                  </p>
                </div>
              </div>

              {/* Item 3: Consentimiento Estricto */}
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-secondary)] text-[var(--pink-primary)] shrink-0 mt-0.5">
                  <HeartHandshake className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[var(--text-primary)]">Consentimiento estricto</h4>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-tight mt-0.5">
                    Cada persona decide qué compartir y con quién.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--border-color)] flex items-center justify-between text-[11px]">
              <Link href="/reglas" className="text-[var(--pink-primary)] hover:underline font-medium">
                Reglas del foro
              </Link>
              <Link href="/privacidad" className="text-[var(--pink-primary)] hover:underline font-medium">
                Política de privacidad
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
