import Link from 'next/link';
import { MessageSquare, Flame, Shield, Compass, Lock } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-10 mb-8 backdrop-blur-sm">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300 mb-4">
            <Lock className="h-3.5 w-3.5" />
            Comunidad 100% Anónima & Discreta
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Conversaciones y experiencias entre adultos.
          </h1>
          <p className="mt-3 text-base text-zinc-400">
            Un espacio respetuoso para compartir relatos, realizar preguntas y conversar abiertamente sobre sexualidad y fetiches.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/explorar"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow hover:bg-indigo-500 transition"
            >
              <Compass className="h-4 w-4" />
              Explorar foro
            </Link>
            <Link
              href="/registro"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition"
            >
              Crear cuenta anónima
            </Link>
          </div>
        </div>
      </section>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Feed Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
              <Flame className="h-5 w-5 text-indigo-400" />
              Publicaciones recientes
            </h2>
            <div className="text-xs text-zinc-400 flex gap-2">
              <span className="text-indigo-400 font-medium cursor-pointer">Tendencias</span>
              <span>•</span>
              <span className="cursor-pointer hover:text-zinc-200">Nuevos</span>
            </div>
          </div>

          {/* Placeholder Post Cards */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="rounded bg-zinc-800 px-2 py-0.5 font-medium text-zinc-300">
                Fetiches
              </span>
              <span>•</span>
              <span>Publicado por <strong className="text-zinc-300">@alias_anonimo</strong></span>
              <span>•</span>
              <span>Hace 2 horas</span>
            </div>
            <h3 className="text-base font-semibold text-zinc-100 hover:text-indigo-300 transition cursor-pointer">
              ¿Cómo abordaron por primera vez sus fantasías con su pareja?
            </h3>
            <p className="text-sm text-zinc-400 line-clamp-2">
              Me gustaría saber cómo fue la experiencia inicial al comunicar un fetiche particular. ¿Qué canales de comunicación les funcionaron mejor?
            </p>
            <div className="flex items-center gap-4 text-xs text-zinc-500 pt-2 border-t border-zinc-800/60">
              <span className="flex items-center gap-1 hover:text-zinc-300 cursor-pointer">
                🔥 14 Me interesa
              </span>
              <span className="flex items-center gap-1 hover:text-zinc-300 cursor-pointer">
                <MessageSquare className="h-3.5 w-3.5" /> 8 comentarios
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="rounded bg-zinc-800 px-2 py-0.5 font-medium text-zinc-300">
                BDSM
              </span>
              <span>•</span>
              <span>Publicado por <strong className="text-zinc-300">@sombra_09</strong></span>
              <span>•</span>
              <span>Hace 5 horas</span>
            </div>
            <h3 className="text-base font-semibold text-zinc-100 hover:text-indigo-300 transition cursor-pointer">
              Acuerdos y seguridad en la práctica consensuada
            </h3>
            <p className="text-sm text-zinc-400 line-clamp-2">
              Comparto algunas reflexiones sobre la importancia de establecer límites claros y palabras de seguridad previas a cualquier sesión...
            </p>
            <div className="flex items-center gap-4 text-xs text-zinc-500 pt-2 border-t border-zinc-800/60">
              <span className="flex items-center gap-1 hover:text-zinc-300 cursor-pointer">
                🔥 22 Me interesa
              </span>
              <span className="flex items-center gap-1 hover:text-zinc-300 cursor-pointer">
                <MessageSquare className="h-3.5 w-3.5" /> 15 comentarios
              </span>
            </div>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-indigo-400" />
              Reglas de Privacidad
            </h3>
            <ul className="text-xs text-zinc-400 space-y-2 list-disc list-inside">
              <li>Tu e-mail es 100% privado y jamás se publicará.</li>
              <li>No compartas números de teléfono, direcciones ni DNI.</li>
              <li>Prohibido publicar material íntimo sin consentimiento.</li>
              <li>Solo para mayores de 18 años.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
