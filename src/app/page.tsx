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
import { createClient } from '@/lib/supabase/server';

interface HomePageProps {
  searchParams: Promise<{ tab?: string }>;
}

const DEFAULT_CATEGORIES = [
  { name: 'Fetiches', slug: 'fetiches', desc: 'Atracciones particulares y fetiches' },
  { name: 'BDSM', slug: 'bdsm', desc: 'Dominación, sumisión y prácticas consensuadas' },
  { name: 'Swinger', slug: 'swinger', desc: 'Estilo de vida swinger y parejas abiertas' },
  { name: 'Parejas', slug: 'parejas', desc: 'Fantasías, dinámicas y acuerdos' },
  { name: 'Encuentros', slug: 'encuentros', desc: 'Relatos y vivencias entre adultos' },
  { name: 'Relatos', slug: 'otros', desc: 'Confesiones y experiencias personales' },
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

  // Fetch real categories from database
  let categories = DEFAULT_CATEGORIES;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('categories')
      .select('name, slug, description')
      .order('name');
    if (data && data.length > 0) {
      categories = data.map((c) => ({
        name: c.name,
        slug: c.slug,
        desc: c.description || '',
      }));
    }
  } catch {
    // Graceful fallback to default categories
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-10">
      {/* Hero Principal: Dark Sensual Premium */}
      <section className="relative overflow-hidden rounded-3xl border border-[#2A2930] bg-[#111114] p-7 sm:p-12 shadow-[0_20px_50px_rgba(9,9,11,0.8)]">
        {/* Ambient Sensual Glows */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gradient-to-br from-[#852D4C]/25 to-[#7553FF]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-gradient-to-tr from-[#571F35]/30 to-transparent blur-3xl" />

        <div className="relative z-10 max-w-2xl space-y-4">
          {/* Subtle Community Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#852D4C]/40 bg-[#571F35]/25 px-3 py-1 text-xs font-medium text-[#FFB6CF] backdrop-blur-sm">
            <span className="flex h-1.5 w-1.5 rounded-full bg-[#FFB6CF] animate-pulse" />
            <span>Comunidad Adulta 18+</span>
            <span className="text-[#852D4C]">•</span>
            <span className="text-[#AAA4B0]">Privacidad & Consentimiento</span>
          </div>

          {/* Hero Title */}
          <h1 className="text-3xl font-extrabold tracking-tight text-[#F5F2F5] sm:text-5xl leading-[1.15]">
            Lo que te intriga también merece{' '}
            <span className="bg-gradient-to-r from-[#FFB6CF] via-[#D14979] to-[#967EFF] bg-clip-text text-transparent">
              un lugar donde hablarse.
            </span>
          </h1>

          {/* Hero Description */}
          <p className="text-sm sm:text-base text-[#AAA4B0] leading-relaxed max-w-xl">
            Un espacio para compartir experiencias, explorar intereses y conversar sin prejuicios.
            Con respeto, consentimiento y privacidad.
          </p>

          {/* Hero CTAs */}
          <div className="pt-3 flex flex-wrap items-center gap-3.5">
            <Link
              href="/explorar"
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#852D4C] to-[#7553FF] px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(133,45,76,0.3)] hover:from-[#9C3559] hover:to-[#8565FF] hover:shadow-[0_6px_25px_rgba(133,45,76,0.45)] transition-all duration-200"
            >
              <Compass className="h-4 w-4 transition-transform group-hover:rotate-12 duration-200" />
              <span>Explorar la comunidad</span>
            </Link>

            <Link
              href="/registro"
              className="inline-flex items-center gap-2 rounded-xl border border-[#2A2930] bg-[#18181D] px-5 py-3 text-sm font-medium text-[#F5F2F5] hover:border-[#852D4C]/60 hover:bg-[#201F26] transition-all duration-200 shadow-sm"
            >
              <EyeOff className="h-4 w-4 text-[#AAA4B0]" />
              <span>Crear mi identidad anónima</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Categorías Reales Destacadas */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#AAA4B0] flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#967EFF]" />
            Explorar por temática
          </h2>
          <Link
            href="/explorar"
            className="text-xs font-medium text-[#967EFF] hover:text-[#B7A4FF] transition flex items-center gap-1"
          >
            <span>Ver todo</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {categories.slice(0, 6).map((cat) => (
            <Link
              key={cat.slug}
              href={`/explorar?categoria=${cat.slug}`}
              className="group rounded-xl border border-[#2A2930] bg-[#18181D]/70 p-3.5 hover:border-[#852D4C]/60 hover:bg-[#18181D] transition-all duration-150 flex flex-col justify-between"
            >
              <span className="text-sm font-semibold text-[#F5F2F5] group-hover:text-[#FFB6CF] transition">
                {cat.name}
              </span>
              <span className="text-[11px] text-[#726D7A] line-clamp-1 mt-1">
                {cat.desc || 'Temas del foro'}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Feed Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Feed Filter Tabs */}
          <div className="flex items-center justify-between border-b border-[#2A2930] pb-3.5">
            <h2 className="text-base font-semibold text-[#F5F2F5] flex items-center gap-2">
              <Flame className="h-5 w-5 text-[#FFB6CF]" />
              Publicaciones
            </h2>

            <div className="flex items-center gap-1 rounded-xl bg-[#111114] p-1 border border-[#2A2930] text-xs font-medium">
              <Link
                href="/?tab=trending"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-150 ${
                  tab === 'trending' || !tab
                    ? 'bg-gradient-to-r from-[#852D4C] to-[#7553FF] text-white shadow-sm font-semibold'
                    : 'text-[#AAA4B0] hover:text-[#F5F2F5] hover:bg-[#18181D]'
                }`}
              >
                <Flame className="h-3.5 w-3.5" />
                <span>Tendencias</span>
              </Link>
              <Link
                href="/?tab=nuevos"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-150 ${
                  tab === 'nuevos'
                    ? 'bg-gradient-to-r from-[#852D4C] to-[#7553FF] text-white shadow-sm font-semibold'
                    : 'text-[#AAA4B0] hover:text-[#F5F2F5] hover:bg-[#18181D]'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>Nuevos</span>
              </Link>
              <Link
                href="/?tab=comentados"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-150 ${
                  tab === 'comentados'
                    ? 'bg-gradient-to-r from-[#852D4C] to-[#7553FF] text-white shadow-sm font-semibold'
                    : 'text-[#AAA4B0] hover:text-[#F5F2F5] hover:bg-[#18181D]'
                }`}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>Más comentados</span>
              </Link>
            </div>
          </div>

          {/* Posts List */}
          {posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#2A2930] bg-[#111114]/60 p-10 text-center space-y-3.5">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#18181D] text-[#726D7A]">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-[#F5F2F5]">
                Aún no hay publicaciones en esta sección
              </h3>
              <p className="text-xs text-[#AAA4B0] max-w-sm mx-auto leading-relaxed">
                Sé la primera persona en compartir una experiencia o abrir una conversación íntima y respetuosa.
              </p>
              <div className="pt-2">
                <Link
                  href="/publicar"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#852D4C] to-[#7553FF] px-4 py-2 text-xs font-semibold text-white shadow hover:from-[#9C3559] hover:to-[#8565FF] transition"
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

        {/* Sidebar Column */}
        <div className="space-y-6">
          {/* Panel de Privacidad y Seguridad */}
          <div className="rounded-2xl border border-[#2A2930] bg-[#111114] p-5 sm:p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-[#F5F2F5] flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#FFB6CF]" />
              Espacio Seguro & Privado
            </h3>
            <p className="text-xs text-[#AAA4B0] leading-relaxed">
              ForoFetiche protege tu intimidad para que puedas conversar con total tranquilidad:
            </p>

            <ul className="text-xs text-[#AAA4B0] space-y-2.5">
              <li className="flex items-start gap-2.5">
                <Lock className="h-3.5 w-3.5 text-[#967EFF] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#F5F2F5]">Email 100% privado:</strong> Tu correo nunca será visible ni compartido.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <EyeOff className="h-3.5 w-3.5 text-[#967EFF] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#F5F2F5]">Identidad por alias:</strong> Tu alias es tu único identificador público.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <HeartHandshake className="h-3.5 w-3.5 text-[#967EFF] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#F5F2F5]">Consentimiento estricto:</strong> Cero tolerancia a compartir datos de contacto o material sin consentimiento.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Shield className="h-3.5 w-3.5 text-[#967EFF] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#F5F2F5]">Exclusivo adultos:</strong> Acceso restringido únicamente a mayores de 18 años.
                </span>
              </li>
            </ul>

            <div className="pt-2 border-t border-[#2A2930] flex items-center justify-between text-[11px]">
              <Link href="/reglas" className="text-[#967EFF] hover:text-[#B7A4FF] transition underline">
                Reglas del foro
              </Link>
              <Link href="/privacidad" className="text-[#967EFF] hover:text-[#B7A4FF] transition underline">
                Política de privacidad
              </Link>
            </div>
          </div>

          {/* Quick Publish Invitation Card */}
          <div className="rounded-2xl border border-[#852D4C]/30 bg-gradient-to-b from-[#571F35]/20 to-[#111114] p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFB6CF]">
              Participá en la comunidad
            </h4>
            <p className="text-xs text-[#AAA4B0] leading-relaxed">
              ¿Tenés una duda íntima o una vivencia que quieras compartir desde el anonimato?
            </p>
            <Link
              href="/publicar"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#18181D] border border-[#2A2930] px-3.5 py-2.5 text-xs font-semibold text-[#F5F2F5] hover:border-[#852D4C] hover:bg-[#201F26] transition shadow-sm"
            >
              <Feather className="h-3.5 w-3.5 text-[#FFB6CF]" />
              <span>Escribir una publicación</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
