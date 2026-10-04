import { Bookmark, Lock } from 'lucide-react';

export default function GuardadosPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Bookmark className="h-6 w-6 text-indigo-400" />
            Publicaciones Guardadas
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Lista privada de experiencias guardadas. Solo tú puedes ver este contenido.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
          <Lock className="h-3.5 w-3.5 text-indigo-400" /> Privado
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-zinc-500 text-xs">
        No tienes publicaciones guardadas por el momento.
      </div>
    </div>
  );
}
