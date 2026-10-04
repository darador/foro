import { User, Calendar, MapPin, Tag, Award, Shield } from 'lucide-react';

export default function PerfilPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
      {/* Profile Header */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800 text-indigo-400 border border-zinc-700">
              <User className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-zinc-100">@usuario_ejemplo</h1>
                <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-medium text-indigo-300 border border-indigo-500/30">
                  INDIVIDUAL
                </span>
              </div>
              <p className="text-xs text-zinc-400 flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-zinc-500" /> Miembro desde Octubre 2026
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-zinc-500" /> Buenos Aires, AR
                </span>
              </p>
            </div>
          </div>

          <button className="rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition">
            Editar perfil
          </button>
        </div>

        {/* Bio */}
        <div className="text-sm text-zinc-300 border-t border-zinc-800/80 pt-4">
          <p>
            Perfil anónimo en ForoFetiche. Interesado en compartir relatos respetuosos y aprender de las experiencias de la comunidad.
          </p>
        </div>

        {/* Activity Counters */}
        <div className="grid grid-cols-3 gap-3 border-t border-zinc-800/80 pt-4 text-center">
          <div className="rounded-lg bg-zinc-950/40 p-3 border border-zinc-800/60">
            <div className="text-lg font-bold text-zinc-100">12</div>
            <div className="text-[11px] text-zinc-400">Publicaciones</div>
          </div>
          <div className="rounded-lg bg-zinc-950/40 p-3 border border-zinc-800/60">
            <div className="text-lg font-bold text-zinc-100">45</div>
            <div className="text-[11px] text-zinc-400">Comentarios</div>
          </div>
          <div className="rounded-lg bg-zinc-950/40 p-3 border border-zinc-800/60">
            <div className="text-lg font-bold text-zinc-100">89</div>
            <div className="text-[11px] text-zinc-400">Me interesa recibidos</div>
          </div>
        </div>
      </div>
    </div>
  );
}
