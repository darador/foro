import Link from 'next/link';
import { MessageSquare, ShieldCheck, LogIn } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getUserRequests, getUserConversations } from '@/lib/services/messaging';
import { ConversationsInbox } from '@/components/messaging/ConversationsInbox';

export default async function MensajesPage() {
  let user = null;
  let requests: any[] = [];
  let conversations: any[] = [];

  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (authUser) {
      user = authUser;
      [requests, conversations] = await Promise.all([
        getUserRequests(),
        getUserConversations(),
      ]);
    }
  } catch {
    // Fallback if not authenticated or error
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-indigo-400" />
            Mensajería Privada
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Bandeja de entrada de conversaciones y solicitudes de mensajes.
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg w-fit">
          <ShieldCheck className="h-4 w-4" />
          <span>Protegido por RLS</span>
        </div>
      </div>

      {/* Main Content */}
      {!user ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-12 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-indigo-400">
            <LogIn className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-zinc-200">
              Iniciá sesión para ver tus mensajes
            </h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              Para enviar mensajes y gestionar conversaciones privadas debés estar registrado en ForoFetiche.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition shadow"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      ) : (
        <ConversationsInbox
          initialConversations={conversations}
          initialRequests={requests}
          currentUserId={user.id}
        />
      )}
    </div>
  );
}
