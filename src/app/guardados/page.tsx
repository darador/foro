import Link from 'next/link';
import { Bookmark, Lock, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSavedPosts } from '@/lib/services/interactions';
import { formatDate } from '@/lib/utils';

export default async function GuardadosPage() {
  let user = null;
  try {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user) {
      user = authData.user;
    }
  } catch {
    // Ignore fallback
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center space-y-4">
        <Lock className="h-10 w-10 mx-auto text-indigo-400" />
        <h1 className="text-xl font-bold text-zinc-100">Guardados Privados</h1>
        <p className="text-xs text-zinc-400">
          Debes iniciar sesión para consultar tus publicaciones guardadas.
        </p>
        <div className="pt-2">
          <Link
            href="/login?redirectTo=/guardados"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow hover:bg-indigo-500 transition"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  const savedItems = await getSavedPosts(user.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Bookmark className="h-6 w-6 text-indigo-400" />
            Publicaciones Guardadas
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Lista privada de publicaciones guardadas. Solo tú puedes ver este contenido.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-300 font-medium">
          <Lock className="h-3.5 w-3.5" /> Privado
        </div>
      </div>

      {savedItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-8 text-center text-xs text-zinc-500 space-y-2">
          <p>No tienes publicaciones guardadas por el momento.</p>
          <Link href="/explorar" className="text-indigo-400 underline">
            Explorar publicaciones
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {savedItems.map((item: any) => {
            const p = item.post;
            if (!p) return null;

            return (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-zinc-700 hover:bg-zinc-900/60 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span className="rounded bg-zinc-800 px-2 py-0.5 font-medium text-zinc-300">
                      {p.category?.name || 'General'}
                    </span>
                    <span>•</span>
                    <span>@{p.author?.alias || 'Anónimo'}</span>
                    <span>•</span>
                    <span>Guardado el {formatDate(item.created_at)}</span>
                  </div>
                  <Link href={`/p/${p.slug}`}>
                    <h3 className="text-sm font-semibold text-zinc-100 hover:text-indigo-300 transition">
                      {p.title}
                    </h3>
                  </Link>
                </div>

                <Link
                  href={`/p/${p.slug}`}
                  className="p-2 text-zinc-400 hover:text-white transition"
                  title="Ver publicación"
                >
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
