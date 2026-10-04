import Link from 'next/link';
import { ShieldAlert, ArrowLeft, LogIn } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getConversationDetails, getConversationMessages } from '@/lib/services/messaging';
import { ChatView } from '@/components/messaging/ChatView';

interface ConversationPageProps {
  params: Promise<{
    conversationId: string;
  }>;
}

export default async function ConversationPage({ params }: ConversationPageProps) {
  const { conversationId } = await params;

  let user = null;
  let conversation = null;
  let initialMessages: any[] = [];

  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (authUser) {
      user = authUser;
      conversation = await getConversationDetails(conversationId);
      if (conversation) {
        initialMessages = await getConversationMessages(conversationId);
      }
    }
  } catch {
    // Fallback if error occurs
  }

  // Unauthorized or non-member view (Generic message to prevent IDOR scanning)
  if (!user || !conversation) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-6">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 space-y-4 shadow-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-rose-400 border border-zinc-700">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-zinc-100">
              No tenés acceso a esta conversación
            </h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              La conversación no existe o no tenés los permisos requeridos para acceder a ella.
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Link
              href="/mensajes"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver a mensajes
            </Link>
            {!user && (
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition shadow"
              >
                <LogIn className="h-3.5 w-3.5" />
                Iniciar sesión
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <ChatView
        conversation={conversation}
        initialMessages={initialMessages}
        currentUserId={user.id}
      />
    </div>
  );
}
