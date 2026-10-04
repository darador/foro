'use client';

import { useState } from 'react';
import { X, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { sendRequest } from '@/lib/services/client/messaging';

interface SendMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string;
  targetAlias: string;
  onSuccess?: () => void;
}

export function SendMessageModal({
  isOpen,
  onClose,
  targetUserId,
  targetAlias,
  onSuccess,
}: SendMessageModalProps) {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMessage = message.trim();

    if (!cleanMessage) {
      setError('El mensaje no puede estar vacío.');
      return;
    }

    if (cleanMessage.length > 2000) {
      setError('El mensaje no puede superar los 2000 caracteres.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await sendRequest({
        targetReceiverId: targetUserId,
        initialMessage: cleanMessage,
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setMessage('');
        onClose();
        if (onSuccess) onSuccess();
      }, 1500);
    } catch (err: any) {
      const errMsg = err?.message || '';

      if (errMsg.includes('blocked') || errMsg.includes('Communication is blocked')) {
        setError('No podés enviar mensajes a este usuario.');
      } else if (errMsg.includes('does not accept') || errMsg.includes('NOBODY')) {
        setError('Este usuario no acepta solicitudes de mensaje.');
      } else if (errMsg.includes('already exists')) {
        setError('Ya existe una solicitud o conversación entre ustedes.');
      } else {
        setError('No se pudo enviar la solicitud. Intentá nuevamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl space-y-5 relative">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-800/80 pb-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Send className="h-5 w-5 text-indigo-400" />
              Enviar mensaje
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Estás enviando una solicitud de mensaje a{' '}
              <span className="font-semibold text-zinc-200">@{targetAlias}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content / Form */}
        {success ? (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-6 text-center space-y-2">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
            <p className="text-sm font-medium text-emerald-300">Solicitud enviada exitosamente</p>
            <p className="text-xs text-zinc-400">
              @{targetAlias} recibirá tu solicitud y podrá aceptarla para comenzar a hablar.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="message" className="text-xs font-medium text-zinc-300">
                Mensaje inicial (Texto plano)
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escribí el primer mensaje..."
                rows={4}
                maxLength={2000}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition resize-none"
              />
              <div className="flex justify-end text-[11px] text-zinc-500">
                {message.length} / 2000
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-zinc-800/80 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !message.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow hover:bg-indigo-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span>Enviando...</span>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Enviar solicitud
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
