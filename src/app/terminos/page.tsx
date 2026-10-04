import { Shield } from 'lucide-react';

export default function TerminosPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <Shield className="h-6 w-6 text-indigo-400" />
          Términos de Servicio
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Condiciones de uso para la comunidad ForoFetiche (+18).
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4 text-xs sm:text-sm text-zinc-300 leading-relaxed">
        <p>
          Al utilizar ForoFetiche aceptas cumplir con las reglas comunitarias, manteniendo el respeto y la discreción.
        </p>
      </div>
    </div>
  );
}
