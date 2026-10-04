'use client';

import { useState } from 'react';
import { Flag, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { submitReport } from '@/lib/services/interactions';
import type { ReportReason } from '@/types/database';

interface ReportModalProps {
  targetId: string;
  targetType: 'POST' | 'COMMENT' | 'PROFILE' | 'MESSAGE';
  user?: { id: string } | null;
}

export function ReportModal({ targetId, targetType, user }: ReportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('OTHER');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportReasons: Array<{ value: ReportReason; label: string }> = [
    { value: 'MINOR', label: 'Posible menor de edad' },
    { value: 'NON_CONSENSUAL', label: 'Contenido íntimo no consentido' },
    { value: 'PERSONAL_DATA', label: 'Datos personales / Doxxing' },
    { value: 'THREAT', label: 'Amenaza grave' },
    { value: 'EXTORTION', label: 'Extorsión / Coerción' },
    { value: 'HARASSMENT', label: 'Acoso / Hostigamiento' },
    { value: 'SPAM', label: 'Spam / Fraude' },
    { value: 'OTHER', label: 'Otro motivo' },
  ];

  const handleOpen = () => {
    if (!user) {
      alert('Debes iniciar sesión para reportar contenido.');
      return;
    }
    setIsOpen(true);
    setSuccess(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      await submitReport({
        reporterId: user.id,
        targetType,
        targetId,
        reason,
        details: details.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
      }, 1800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al enviar el reporte.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400 transition"
        title="Reportar este contenido"
      >
        <Flag className="h-3.5 w-3.5" />
        <span>Reportar</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Reportar contenido
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {success ? (
              <div className="py-6 text-center text-xs text-emerald-400 space-y-2">
                <CheckCircle className="h-8 w-8 mx-auto text-emerald-400" />
                <p className="font-semibold text-sm">Reporte enviado correctamente</p>
                <p className="text-zinc-400">
                  Nuestro equipo de moderación revisará la publicación. Gracias por mantener la comunidad segura.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Motivo del reporte
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as ReportReason)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
                  >
                    {reportReasons.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Detalles adicionales (Opcional)
                  </label>
                  <textarea
                    rows={3}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Explica brevemente por qué infringe las reglas..."
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-500 transition shadow disabled:opacity-50"
                  >
                    {loading ? 'Enviando...' : 'Enviar Reporte'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
