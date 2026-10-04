'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Send,
  User,
  ShieldOff,
  Trash2,
  AlertCircle,
  Flag,
  Loader2,
} from 'lucide-react';
import { sendMessageClient, deleteMessage, blockRequest } from '@/lib/services/client/messaging';
import { toggleBlockUser } from '@/lib/services/interactions';
import { ReportModal } from '@/components/common/ReportModal';
import { formatDate } from '@/lib/utils';

export interface MessageItem {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  deleted_at: string | null;
  created_at: string;
  sender?: {
    id: string;
    alias: string;
    avatar_url: string | null;
  } | null;
}

export interface ConversationDetails {
  id: string;
  request_id: string;
  requestStatus: string;
  created_at: string;
  updated_at: string;
  otherUser: {
    id: string;
    alias: string;
    avatar_url: string | null;
  } | null;
  isBlocked: boolean;
}

interface ChatViewProps {
  conversation: ConversationDetails;
  initialMessages: MessageItem[];
  currentUserId: string;
}

export function ChatView({
  conversation,
  initialMessages,
  currentUserId,
}: ChatViewProps) {
  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(conversation.isBlocked);
  const [blocking, setBlocking] = useState(false);
  const [confirmBlockOpen, setConfirmBlockOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const otherAlias = conversation.otherUser?.alias || 'Usuario';
  const otherUserId = conversation.otherUser?.id || '';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanContent = input.trim();
    if (!cleanContent || sending || isBlocked) return;

    if (cleanContent.length > 2000) {
      setSendError('El mensaje no puede superar los 2000 caracteres');
      return;
    }

    setSending(true);
    setSendError(null);

    try {
      const newMsg = await sendMessageClient(conversation.id, cleanContent);
      setMessages((prev) => [...prev, newMsg]);
      setInput('');
    } catch (err: any) {
      setSendError(err?.message || 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (deletingId) return;
    setDeletingId(messageId);
    try {
      await deleteMessage(messageId);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, deleted_at: new Date().toISOString() } : msg
        )
      );
    } catch (err: any) {
      alert(err?.message || 'Error al eliminar mensaje');
    } finally {
      setDeletingId(null);
    }
  };

  const handleBlockUserToggle = async () => {
    if (!otherUserId || blocking) return;
    setBlocking(true);
    try {
      if (conversation.request_id) {
        await blockRequest(conversation.request_id);
      } else {
        await toggleBlockUser(currentUserId, otherUserId);
      }
      setIsBlocked(true);
      setConfirmBlockOpen(false);
    } catch (err: any) {
      alert(err?.message || 'Error al bloquear usuario');
    } finally {
      setBlocking(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-w-4xl mx-auto rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl overflow-hidden">
      {/* Conversation Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-4 py-3 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/mensajes"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition"
            title="Volver a mensajes"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-indigo-400 border border-zinc-700 font-semibold overflow-hidden shrink-0">
              {conversation.otherUser?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={conversation.otherUser.avatar_url}
                  alt={otherAlias}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-4 w-4" />
              )}
            </div>

            <div>
              <Link
                href={`/perfil/${encodeURIComponent(otherAlias)}`}
                className="text-sm font-semibold text-zinc-100 hover:text-indigo-400 transition"
              >
                @{otherAlias}
              </Link>
              {isBlocked && (
                <span className="block text-[10px] font-medium text-rose-400">
                  Bloqueado
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Report Conversation button using ReportModal */}
          <ReportModal
            targetId={conversation.id}
            targetType="MESSAGE"
            user={{ id: currentUserId }}
          />

          {/* Block User button */}
          {!isBlocked && (
            <button
              onClick={() => setConfirmBlockOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition"
            >
              <ShieldOff className="h-3.5 w-3.5" />
              <span>Bloquear</span>
            </button>
          )}
        </div>
      </div>

      {/* Message Thread Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-950/40">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-2 text-zinc-500 text-xs">
            <div className="h-10 w-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-indigo-400">
              <Send className="h-4 w-4" />
            </div>
            <p className="text-sm font-medium text-zinc-300">
              Todavía no hay mensajes.
            </p>
            <p className="text-zinc-500 max-w-xs">
              Iniciá la conversación enviando un mensaje a @{otherAlias}.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === currentUserId;
            const isDeleted = Boolean(msg.deleted_at);

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`group relative max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm shadow-sm space-y-1 ${
                    isOwn
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-zinc-900 text-zinc-200 border border-zinc-800 rounded-bl-none'
                  }`}
                >
                  <div className="break-words leading-relaxed">
                    {isDeleted ? (
                      <span className="italic text-zinc-400 text-xs">
                        [Mensaje eliminado]
                      </span>
                    ) : (
                      msg.content
                    )}
                  </div>

                  <div
                    className={`flex items-center justify-between gap-2 text-[10px] ${
                      isOwn ? 'text-indigo-200' : 'text-zinc-500'
                    }`}
                  >
                    <span>{formatDate(msg.created_at)}</span>

                    {/* Delete Action for Own Active Messages */}
                    {isOwn && !isDeleted && (
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        disabled={deletingId === msg.id}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-300 transition p-0.5 ml-2"
                        title="Eliminar mensaje"
                      >
                        {deletingId === msg.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Blocked Notice */}
      {isBlocked && (
        <div className="flex items-center justify-center gap-2 border-t border-zinc-800 bg-rose-950/20 px-4 py-2.5 text-xs text-rose-300">
          <ShieldOff className="h-4 w-4 shrink-0" />
          <span>Esta conversación está bloqueada. No podés enviar nuevos mensajes.</span>
        </div>
      )}

      {/* Error Banner */}
      {sendError && (
        <div className="flex items-center gap-2 border-t border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{sendError}</span>
        </div>
      )}

      {/* Composer Section */}
      <form
        onSubmit={handleSend}
        className="border-t border-zinc-800 bg-zinc-900/90 p-3 flex flex-col gap-2 shrink-0"
      >
        <div className="flex items-center gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            placeholder={
              isBlocked ? 'Conversación bloqueada' : 'Escribí un mensaje...'
            }
            disabled={isBlocked || sending}
            rows={1}
            maxLength={2000}
            className="flex-1 resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />

          <button
            type="submit"
            disabled={!input.trim() || sending || isBlocked}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow hover:bg-indigo-500 transition disabled:opacity-40 disabled:hover:bg-indigo-600 shrink-0"
            title="Enviar mensaje"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between text-[10px] text-zinc-500 px-1">
          <span>Presioná Enter para enviar</span>
          <span className={input.length > 1900 ? 'text-amber-400 font-semibold' : ''}>
            {input.length} / 2000
          </span>
        </div>
      </form>

      {/* Confirm Block Modal */}
      {confirmBlockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <ShieldOff className="h-6 w-6" />
              <h3 className="text-sm font-semibold text-zinc-100">
                ¿Bloquear a @{otherAlias}?
              </h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              No podrás recibir ni enviar más mensajes con este usuario. Se conservará el historial existente.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmBlockOpen(false)}
                disabled={blocking}
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBlockUserToggle}
                disabled={blocking}
                className="rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-rose-500 transition shadow disabled:opacity-50"
              >
                {blocking ? 'Bloqueando...' : 'Confirmar bloqueo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
