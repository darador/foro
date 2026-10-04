'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Inbox,
  Send,
  User,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Clock,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';
import {
  acceptRequest,
  rejectRequest,
  blockRequest,
} from '@/lib/services/client/messaging';
import { ConfirmBlockModal } from './ConfirmBlockModal';
import { formatDate, truncateText } from '@/lib/utils';

interface RequestItem {
  id: string;
  sender_id: string;
  recipient_id: string;
  initial_message: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED';
  created_at: string;
  sender?: { id: string; alias: string; avatar_url: string | null } | null;
  recipient?: { id: string; alias: string; avatar_url: string | null } | null;
}

interface MessageRequestsListProps {
  initialRequests: RequestItem[];
  currentUserId: string;
}

export function MessageRequestsList({
  initialRequests,
  currentUserId,
}: MessageRequestsListProps) {
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
  const [requests, setRequests] = useState<RequestItem[]>(initialRequests);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);
  const [blockTarget, setBlockTarget] = useState<{ id: string; alias: string } | null>(null);

  const receivedRequests = requests.filter((r) => r.recipient_id === currentUserId);
  const sentRequests = requests.filter((r) => r.sender_id === currentUserId);

  const pendingReceivedCount = receivedRequests.filter((r) => r.status === 'PENDING').length;

  const handleAccept = async (requestId: string) => {
    setLoadingAction(requestId);
    setActionError(null);
    try {
      await acceptRequest(requestId);
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: 'ACCEPTED' } : r))
      );
    } catch (err: any) {
      setActionError({
        id: requestId,
        message: err?.message || 'No se pudo aceptar la solicitud.',
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setLoadingAction(requestId);
    setActionError(null);
    try {
      await rejectRequest(requestId);
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: 'REJECTED' } : r))
      );
    } catch (err: any) {
      setActionError({
        id: requestId,
        message: err?.message || 'No se pudo rechazar la solicitud.',
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleBlockSuccess = (requestId: string) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: 'BLOCKED' } : r))
    );
  };

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 text-xs font-medium">
        <button
          onClick={() => setActiveTab('received')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 transition ${
            activeTab === 'received'
              ? 'bg-indigo-600 text-white font-semibold shadow'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          <Inbox className="h-4 w-4" />
          Recibidas
          {pendingReceivedCount > 0 && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
              {pendingReceivedCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('sent')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 transition ${
            activeTab === 'sent'
              ? 'bg-indigo-600 text-white font-semibold shadow'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          <Send className="h-4 w-4" />
          Enviadas ({sentRequests.length})
        </button>
      </div>

      {/* Received Requests Tab */}
      {activeTab === 'received' && (
        <div className="space-y-4">
          {receivedRequests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center text-xs text-zinc-500 space-y-2">
              <Inbox className="mx-auto h-8 w-8 text-zinc-600" />
              <p className="text-sm font-medium text-zinc-300">No tenés solicitudes pendientes.</p>
              <p className="text-zinc-500">
                Las solicitudes enviadas por otros miembros de la comunidad aparecerán en esta sección.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {receivedRequests.map((req) => {
                const senderAlias = req.sender?.alias || 'Usuario';
                const isPending = req.status === 'PENDING';
                const isAccepted = req.status === 'ACCEPTED';
                const isRejected = req.status === 'REJECTED';
                const isBlocked = req.status === 'BLOCKED';
                const isLoading = loadingAction === req.id;

                return (
                  <div
                    key={req.id}
                    className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition hover:border-zinc-700/80"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-indigo-400 border border-zinc-700 font-semibold overflow-hidden">
                          {req.sender?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={req.sender.avatar_url}
                              alt={senderAlias}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <User className="h-5 w-5" />
                          )}
                        </div>

                        <div>
                          <Link
                            href={`/perfil/${encodeURIComponent(senderAlias)}`}
                            className="text-sm font-semibold text-zinc-100 hover:text-indigo-400 hover:underline transition"
                          >
                            @{senderAlias}
                          </Link>
                          <span className="text-[11px] text-zinc-500 block mt-0.5">
                            {formatDate(req.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Status Badges */}
                      {isAccepted && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aceptada
                        </span>
                      )}

                      {isRejected && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">
                          <XCircle className="h-3.5 w-3.5" /> Rechazada
                        </span>
                      )}

                      {isBlocked && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 text-[11px] font-medium text-rose-400">
                          <ShieldAlert className="h-3.5 w-3.5" /> Usuario bloqueado
                        </span>
                      )}

                      {isPending && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
                          <Clock className="h-3.5 w-3.5" /> Pendiente
                        </span>
                      )}
                    </div>

                    {/* Initial Message */}
                    <div className="rounded-lg bg-zinc-950/60 p-3 text-xs text-zinc-200 border border-zinc-800/60 leading-relaxed italic">
                      "{req.initial_message}"
                    </div>

                    {/* Error display */}
                    {actionError && actionError.id === req.id && (
                      <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{actionError.message}</span>
                      </div>
                    )}

                    {/* Action Controls for PENDING */}
                    {isPending && (
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-zinc-800/60">
                        <button
                          onClick={() => setBlockTarget({ id: req.id, alias: senderAlias })}
                          disabled={isLoading}
                          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition disabled:opacity-50"
                        >
                          Bloquear
                        </button>
                        <button
                          onClick={() => handleReject(req.id)}
                          disabled={isLoading}
                          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-50"
                        >
                          {isLoading ? 'Cargando...' : 'Rechazar'}
                        </button>
                        <button
                          onClick={() => handleAccept(req.id)}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white shadow hover:bg-indigo-500 transition disabled:opacity-50"
                        >
                          {isLoading ? (
                            'Aceptando...'
                          ) : (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Aceptar
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Feedback when ACCEPTED */}
                    {isAccepted && (
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-xs">
                        <span className="text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Solicitud aceptada. Ahora pueden enviarse mensajes.
                        </span>
                        <Link
                          href="/mensajes"
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 transition"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Ir a mensajes
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sent Requests Tab */}
      {activeTab === 'sent' && (
        <div className="space-y-4">
          {sentRequests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center text-xs text-zinc-500 space-y-2">
              <Send className="mx-auto h-8 w-8 text-zinc-600" />
              <p className="text-sm font-medium text-zinc-300">
                Todavía no enviaste ninguna solicitud de mensaje.
              </p>
              <p className="text-zinc-500">
                Podés enviar solicitudes de mensaje explorando la comunidad y visitando los perfiles públicos.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sentRequests.map((req) => {
                const recipientAlias = req.recipient?.alias || 'Usuario';
                const isPending = req.status === 'PENDING';
                const isAccepted = req.status === 'ACCEPTED';
                const isRejected = req.status === 'REJECTED';
                const isBlocked = req.status === 'BLOCKED';

                return (
                  <div
                    key={req.id}
                    className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition hover:border-zinc-700/80"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-indigo-400 border border-zinc-700 font-semibold overflow-hidden">
                          {req.recipient?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={req.recipient.avatar_url}
                              alt={recipientAlias}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <User className="h-5 w-5" />
                          )}
                        </div>

                        <div>
                          <Link
                            href={`/perfil/${encodeURIComponent(recipientAlias)}`}
                            className="text-sm font-semibold text-zinc-100 hover:text-indigo-400 hover:underline transition"
                          >
                            Para: @{recipientAlias}
                          </Link>
                          <span className="text-[11px] text-zinc-500 block mt-0.5">
                            {formatDate(req.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      {isPending && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
                          <Clock className="h-3.5 w-3.5" /> Pendiente
                        </span>
                      )}

                      {isAccepted && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aceptada
                        </span>
                      )}

                      {isRejected && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">
                          <XCircle className="h-3.5 w-3.5" /> Rechazada
                        </span>
                      )}

                      {isBlocked && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 text-[11px] font-medium text-rose-400">
                          <ShieldAlert className="h-3.5 w-3.5" /> Bloqueada
                        </span>
                      )}
                    </div>

                    <div className="rounded-lg bg-zinc-950/60 p-3 text-xs text-zinc-300 border border-zinc-800/60 italic">
                      "{truncateText(req.initial_message, 200)}"
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Block Modal */}
      {blockTarget && (
        <ConfirmBlockModal
          isOpen={Boolean(blockTarget)}
          onClose={() => setBlockTarget(null)}
          requestId={blockTarget.id}
          targetAlias={blockTarget.alias}
          onSuccess={() => handleBlockSuccess(blockTarget.id)}
        />
      )}
    </div>
  );
}
