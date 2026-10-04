'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Inbox as InboxIcon,
  User,
  ShieldAlert,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { MessageRequestsList } from './MessageRequestsList';
import { formatDate, truncateText } from '@/lib/utils';

export interface ConversationItem {
  id: string;
  request_id: string;
  created_at: string;
  updated_at: string;
  otherUser: {
    id: string;
    alias: string;
    avatar_url: string | null;
  } | null;
  lastMessage: {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
    deleted_at: string | null;
  } | null;
  isBlocked: boolean;
}

interface ConversationsInboxProps {
  initialConversations: ConversationItem[];
  initialRequests: any[];
  currentUserId: string;
}

export function ConversationsInbox({
  initialConversations,
  initialRequests,
  currentUserId,
}: ConversationsInboxProps) {
  const [activeTab, setActiveTab] = useState<'conversations' | 'requests'>('conversations');
  const [conversations] = useState<ConversationItem[]>(initialConversations);

  const pendingRequestsCount = initialRequests.filter(
    (r) => r.recipient_id === currentUserId && r.status === 'PENDING'
  ).length;

  return (
    <div className="space-y-6">
      {/* Navigation Header Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 text-xs font-medium">
        <button
          onClick={() => setActiveTab('conversations')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 transition ${
            activeTab === 'conversations'
              ? 'bg-indigo-600 text-white font-semibold shadow'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          Conversaciones ({conversations.length})
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 transition ${
            activeTab === 'requests'
              ? 'bg-indigo-600 text-white font-semibold shadow'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          <InboxIcon className="h-4 w-4" />
          Solicitudes
          {pendingRequestsCount > 0 && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
              {pendingRequestsCount}
            </span>
          )}
        </button>
      </div>

      {/* Conversations Tab */}
      {activeTab === 'conversations' && (
        <div className="space-y-4">
          {conversations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center text-xs text-zinc-500 space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-indigo-400">
                <MessageSquare className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-300">
                  Todavía no tenés conversaciones activas.
                </p>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Cuando una solicitud de mensaje sea aceptada, la conversación aparecerá en este listado.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {conversations.map((conv) => {
                const otherAlias = conv.otherUser?.alias || 'Usuario';
                const hasLastMsg = Boolean(conv.lastMessage);
                const isMsgDeleted = Boolean(conv.lastMessage?.deleted_at);
                const isOwnMsg = conv.lastMessage?.sender_id === currentUserId;

                let msgPreview = 'Sin mensajes todavía.';
                if (hasLastMsg) {
                  if (isMsgDeleted) {
                    msgPreview = '[Mensaje eliminado]';
                  } else {
                    const prefix = isOwnMsg ? 'Vos: ' : '';
                    msgPreview = `${prefix}${conv.lastMessage?.content || ''}`;
                  }
                }

                return (
                  <Link
                    key={conv.id}
                    href={`/mensajes/${conv.id}`}
                    className="group flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition hover:border-indigo-500/40 hover:bg-zinc-900/80 shadow-sm"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-indigo-400 border border-zinc-700 font-semibold overflow-hidden">
                        {conv.otherUser?.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={conv.otherUser.avatar_url}
                            alt={otherAlias}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <User className="h-5 w-5" />
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-100 group-hover:text-indigo-400 transition truncate">
                            @{otherAlias}
                          </span>
                          {conv.isBlocked && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[10px] font-medium text-rose-400">
                              <ShieldAlert className="h-3 w-3" /> Bloqueado
                            </span>
                          )}
                        </div>

                        <p
                          className={`text-xs truncate ${
                            isMsgDeleted ? 'italic text-zinc-500' : 'text-zinc-400'
                          }`}
                        >
                          {truncateText(msgPreview, 100)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-xs text-zinc-500">
                      <span className="flex items-center gap-1 text-[11px]">
                        <Clock className="h-3 w-3" />
                        {formatDate(conv.lastMessage?.created_at || conv.updated_at)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-indigo-400 transition" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <MessageRequestsList initialRequests={initialRequests} currentUserId={currentUserId} />
      )}
    </div>
  );
}
