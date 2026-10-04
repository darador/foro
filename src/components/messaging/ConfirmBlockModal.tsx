'use client';

import { useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { blockRequest } from '@/lib/services/client/messaging';

interface ConfirmBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: string;
  targetAlias: string;
  onSuccess?: () => void;
}

export function ConfirmBlockModal({
  isOpen,
  onClose,
  requestId,
  targetAlias,
  onSuccess,
}: ConfirmBlockModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirmBlock = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await blockRequest(requestId);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.message || 'No se pudo completar el bloqueo. Intentá nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl space-y-4 relative">
        <div className="flex items-start justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2 text-rose-400 font-semibold text-base">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span>¿Bloquear a @{targetAlias}?</span>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed">
          No podrá enviarte nuevas solicitudes de mensaje ni comunicarse con vos en la comunidad.
        </p>

        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmBlock}
            disabled={isSubmitting}
            className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-medium text-white shadow hover:bg-rose-500 transition disabled:opacity-50"
          >
            {isSubmitting ? 'Bloqueando...' : 'Bloquear'}
          </button>
        </div>
      </div>
    </div>
  );
}
