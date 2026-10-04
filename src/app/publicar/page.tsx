import { ShieldAlert, AlertTriangle } from 'lucide-react';

export default function PublicarPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Crear Publicación</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Comparte tu experiencia, haz una pregunta o publica una confesión anónima.
        </p>
      </div>

      {/* Pre-Publish Security Warning Box (Section 18 requirement) */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 text-xs space-y-2">
        <div className="flex items-center gap-2 font-semibold text-amber-400 text-sm">
          <AlertTriangle className="h-4 w-4" />
          Recordatorio de privacidad y seguridad
        </div>
        <p>Por favor, revisa tu publicación antes de enviar. Queda estrictamente prohibido incluir:</p>
        <ul className="list-disc list-inside space-y-1 text-amber-300/80">
          <li>Números de teléfono o enlaces directos a WhatsApp</li>
          <li>Direcciones de domicilio, coordenadas o ubicaciones exactas</li>
          <li>Números de DNI o datos personales de terceros</li>
          <li>Material íntimo o imágenes sin consentimiento explícito</li>
        </ul>
      </div>

      {/* Publication Form Mockup */}
      <form className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-2">
            Tipo de publicación
          </label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              className="rounded-lg border border-indigo-500 bg-indigo-500/10 py-2 text-xs font-medium text-indigo-300"
            >
              EXPERIENCIA
            </button>
            <button
              type="button"
              className="rounded-lg border border-zinc-800 bg-zinc-900 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200"
            >
              PREGUNTA
            </button>
            <button
              type="button"
              className="rounded-lg border border-zinc-800 bg-zinc-900 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200"
            >
              CONFESIÓN
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">
            Categoría
          </label>
          <select className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none">
            <option value="">Seleccionar categoría...</option>
            <option value="fetiches">Fetiches</option>
            <option value="bdsm">BDSM</option>
            <option value="swinger">Swinger</option>
            <option value="parejas">Parejas</option>
            <option value="encuentros">Encuentros</option>
            <option value="escorts">Escorts</option>
            <option value="lugares-y-eventos">Lugares y eventos</option>
            <option value="otros">Otros</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">
            Título
          </label>
          <input
            type="text"
            placeholder="Título claro y descriptivo..."
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">
            Contenido
          </label>
          <textarea
            rows={6}
            placeholder="Escribe tu relato o consulta..."
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-200 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">
            Tags (separados por comas)
          </label>
          <input
            type="text"
            placeholder="ej. fantasias, comunicación, consejos"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition shadow"
        >
          Publicar de forma anónima
        </button>
      </form>
    </div>
  );
}
