import { Shield, Lock, AlertTriangle } from 'lucide-react';

export default function ReglasPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <Shield className="h-6 w-6 text-indigo-400" />
          Reglas de la Comunidad
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Para mantener ForoFetiche como un espacio anónimo, seguro y respetuoso entre adultos.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4 text-xs sm:text-sm text-zinc-300 leading-relaxed">
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          Reglas Estrictas de Convivencia
        </h2>
        <ol className="list-decimal list-inside space-y-3 text-zinc-400">
          <li>
            <strong className="text-zinc-200">Mayoría de Edad (+18):</strong> Acceso exclusivo para personas mayores de 18 años. Está estrictamente prohibido el ingreso o publicación por parte de menores.
          </li>
          <li>
            <strong className="text-zinc-200">Prohibición de Datos Personales (Doxxing):</strong> No publique números de teléfono, enlaces a WhatsApp/Telegram, direcciones de domicilio ni DNI.
          </li>
          <li>
            <strong className="text-zinc-200">Consentimiento y Respeto:</strong> Prohibido compartir contenido íntimo sin consentimiento, extorsión, coerción, amenazas o acoso.
          </li>
          <li>
            <strong className="text-zinc-200">Sin Marketplace ni Prostitución No Consensuada:</strong> No utilice el foro para compraventa de servicios prohibidos, spam ni estafas.
          </li>
          <li>
            <strong className="text-zinc-200">Anonimato y Privacidad:</strong> Respete el alias y la privacidad de los demás participantes.
          </li>
        </ol>
      </div>
    </div>
  );
}
