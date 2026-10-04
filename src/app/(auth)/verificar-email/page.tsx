import Link from 'next/link';
import { Mail, CheckCircle, ShieldAlert } from 'lucide-react';

export default function VerificarEmailPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center space-y-6">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
        <Mail className="h-8 w-8" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-100">Verifica tu correo electrónico</h1>
        <p className="text-xs text-zinc-400">
          Hemos enviado un enlace de confirmación a tu e-mail para habilitar todas las interacciones en la comunidad.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-left text-xs text-zinc-400 space-y-2">
        <div className="font-semibold text-zinc-300 flex items-center gap-1.5">
          <ShieldAlert className="h-4 w-4 text-amber-400" />
          Mientras tu e-mail no esté verificado:
        </div>
        <ul className="list-disc list-inside space-y-1 text-zinc-400">
          <li>Puedes navegar, leer historias y buscar contenido.</li>
          <li>No podrás publicar, comentar, reaccionar ni enviar mensajes.</li>
        </ul>
      </div>

      <div className="pt-4">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700 px-5 py-2.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition"
        >
          Volver al Inicio
        </Link>
      </div>
    </div>
  );
}
