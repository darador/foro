import { Lock } from 'lucide-react';

export default function PrivacidadPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <Lock className="h-6 w-6 text-indigo-400" />
          Política de Privacidad
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Compromiso absoluto con el anonimato y la minimización de datos.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4 text-xs sm:text-sm text-zinc-300 leading-relaxed">
        <p>
          En ForoFetiche la información personal es tratada con la máxima confidencialidad y minimización.
        </p>
        <h2 className="text-sm font-semibold text-zinc-100">1. Datos Privados</h2>
        <p className="text-zinc-400">
          Tu dirección de correo electrónico es estrictamente privada. Jamás se publicará en el foro ni se compartirá con terceros.
        </p>
        <h2 className="text-sm font-semibold text-zinc-100">2. Identidad Pública</h2>
        <p className="text-zinc-400">
          Tu única identidad pública en la plataforma es tu alias elegido.
        </p>
      </div>
    </div>
  );
}
