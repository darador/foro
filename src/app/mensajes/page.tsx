import { MessageSquare, ShieldCheck } from 'lucide-react';

export default function MensajesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Mensajes Privados</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Mensajería privada basada en solicitudes. Texto plano únicamente.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-indigo-400">
          <MessageSquare className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-zinc-200">Buzón de Mensajes</h3>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          Los mensajes requieren que la contraparte acepte tu solicitud antes de iniciar la conversación. No se permiten fotos ni archivos multimedia.
        </p>
        <div className="inline-flex items-center gap-1.5 text-xs text-zinc-500 pt-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          Conversaciones protegidas y privadas
        </div>
      </div>
    </div>
  );
}
