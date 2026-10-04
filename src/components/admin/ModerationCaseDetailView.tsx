'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Shield,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowLeft,
  UserCheck,
  FileText,
  MessageSquare,
  User,
  Mail,
  History,
  AlertOctagon,
  Ban,
  Slash,
  EyeOff,
  Check,
  RotateCcw,
} from 'lucide-react';
import type {
  ModerationPriority,
  ReportStatus,
  UserSanctionAction,
  ModerationActionType,
} from '@/types/database';
import {
  assignModerationCaseClient,
  executeModerationActionClient,
  applyUserSanctionClient,
} from '@/lib/services/client/moderation';

interface ModerationCaseDetailViewProps {
  currentUserId: string;
  detail: {
    caseInfo: any;
    reports: any[];
    targetEntity: any;
    targetAuthor: any;
    contentVersions: any[];
    userSanctions: any[];
    authorTotalReportsCount: number;
    moderationActions: any[];
    auditLogs: any[];
  };
}

export function ModerationCaseDetailView({ currentUserId, detail }: ModerationCaseDetailViewProps) {
  const [caseObj, setCaseObj] = useState(detail.caseInfo);
  const [reports, setReports] = useState(detail.reports);
  const [targetEntity, setTargetEntity] = useState(detail.targetEntity);
  const [moderationActions, setModerationActions] = useState(detail.moderationActions);
  const [userSanctions, setUserSanctions] = useState(detail.userSanctions);
  const [auditLogs, setAuditLogs] = useState(detail.auditLogs);

  // Form states for Content Action
  const [contentActionType, setContentActionType] = useState<ModerationActionType>('APPROVE');
  const [contentActionReason, setContentActionReason] = useState('');
  const [caseNotes, setCaseNotes] = useState('');
  const [newCaseStatus, setNewCaseStatus] = useState<ReportStatus>('RESOLVED');
  const [isSubmittingContentAction, setIsSubmittingContentAction] = useState(false);

  // Form states for User Sanction
  const [sanctionAction, setSanctionAction] = useState<UserSanctionAction>('WARNING');
  const [sanctionReason, setSanctionReason] = useState('');
  const [sanctionExpiresAt, setSanctionExpiresAt] = useState('');
  const [isSubmittingSanction, setIsSubmittingSanction] = useState(false);

  // Assign Case State
  const [isAssigning, setIsAssigning] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAssignToMe = async () => {
    setIsAssigning(true);
    setMessage(null);
    try {
      const updated = await assignModerationCaseClient(caseObj.id, currentUserId);
      setCaseObj((prev: any) => ({
        ...prev,
        assigned_moderator_id: currentUserId,
        status: updated.status,
      }));
      setMessage({ type: 'success', text: 'Caso asignado correctamente.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error al asignar el caso.' });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleContentAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contentActionReason.trim()) {
      setMessage({ type: 'error', text: 'Debes ingresar un motivo para la acción de moderación.' });
      return;
    }

    setIsSubmittingContentAction(true);
    setMessage(null);

    try {
      const actionRes = await executeModerationActionClient({
        caseId: caseObj.id,
        moderatorId: currentUserId,
        actionType: contentActionType,
        reason: contentActionReason.trim(),
        notes: caseNotes.trim() || undefined,
        newCaseStatus,
      });

      // Update local state
      setCaseObj((prev: any) => ({
        ...prev,
        status: newCaseStatus,
        notes: caseNotes.trim() || prev.notes,
      }));

      setModerationActions((prev: any[]) => [actionRes, ...prev]);

      if (targetEntity && (caseObj.target_type === 'POST' || caseObj.target_type === 'COMMENT')) {
        let newStatus = targetEntity.status;
        if (contentActionType === 'HIDE') newStatus = 'HIDDEN';
        else if (contentActionType === 'DELETE') newStatus = 'DELETED';
        else if (contentActionType === 'APPROVE') newStatus = 'PUBLISHED';

        setTargetEntity((prev: any) => ({ ...prev, status: newStatus }));
      }

      setMessage({ type: 'success', text: 'Acción de moderación ejecutada correctamente.' });
      setContentActionReason('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error al ejecutar la acción de moderación.' });
    } finally {
      setIsSubmittingContentAction(false);
    }
  };

  const handleApplySanction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail.targetAuthor?.id) {
      setMessage({ type: 'error', text: 'No hay autor identificado para aplicar una sanción.' });
      return;
    }
    if (!sanctionReason.trim()) {
      setMessage({ type: 'error', text: 'Debes ingresar el motivo de la sanción.' });
      return;
    }

    setIsSubmittingSanction(true);
    setMessage(null);

    try {
      const sanctionRes = await applyUserSanctionClient({
        userId: detail.targetAuthor.id,
        createdBy: currentUserId,
        action: sanctionAction,
        reason: sanctionReason.trim(),
        expiresAt: sanctionExpiresAt || null,
        caseId: caseObj.id,
      });

      setUserSanctions((prev: any[]) => [sanctionRes, ...prev]);
      setMessage({ type: 'success', text: `Sanción (${sanctionAction}) aplicada al usuario.` });
      setSanctionReason('');
      setSanctionExpiresAt('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error al aplicar la sanción al usuario.' });
    } finally {
      setIsSubmittingSanction(false);
    }
  };

  const getPriorityBadge = (priority: ModerationPriority) => {
    switch (priority) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-950 text-red-400 border border-red-800">
            <AlertTriangle className="h-3.5 w-3.5" /> CRÍTICO
          </span>
        );
      case 'REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-400 border border-amber-800">
            REVISIÓN
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
            BAJO
          </span>
        );
    }
  };

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-yellow-950 text-yellow-400 border border-yellow-800">
            ABIERTO
          </span>
        );
      case 'IN_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-950 text-blue-400 border border-blue-800">
            EN REVISIÓN
          </span>
        );
      case 'WAITING_USER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-950 text-purple-400 border border-purple-800">
            ESPERANDO USUARIO
          </span>
        );
      case 'ESCALATED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-orange-950 text-orange-400 border border-orange-800">
            ESCALADO
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" /> RESUELTO
          </span>
        );
      default:
        return <span className="text-xs text-zinc-400">{status}</span>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Navigation */}
      <div>
        <Link
          href="/admin/moderacion"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a la Bandeja de Moderación
        </Link>
      </div>

      {/* Case Header Card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-zinc-100">Caso #{caseObj.id.slice(0, 8)}</h1>
              {getPriorityBadge(caseObj.priority)}
              {getStatusBadge(caseObj.status)}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Entidad: <span className="text-zinc-200 font-semibold">{caseObj.target_type}</span> | ID:{' '}
              <code className="text-zinc-300 font-mono">{caseObj.target_id || 'N/A'}</code>
            </p>
          </div>

          {/* Moderator Assignment Button */}
          <div>
            {caseObj.assigned_moderator_id === currentUserId ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-800/60 font-medium">
                <UserCheck className="h-4 w-4" /> Asignado a ti
              </span>
            ) : (
              <button
                onClick={handleAssignToMe}
                disabled={isAssigning}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition border border-zinc-700 disabled:opacity-50"
              >
                <UserCheck className="h-4 w-4 text-indigo-400" />
                {isAssigning ? 'Asignando...' : 'Asignármelo a mí'}
              </button>
            )}
          </div>
        </div>

        {/* Message Feedback */}
        {message && (
          <div
            className={`p-3 rounded-lg text-xs font-medium ${
              message.type === 'success'
                ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                : 'bg-red-950/80 border border-red-800 text-red-300'
            }`}
          >
            {message.text}
          </div>
        )}
      </div>

      {/* Target Entity Preview Section */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
        <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2 border-b border-zinc-800 pb-3">
          <FileText className="h-5 w-5 text-indigo-400" />
          Contenido Bajo Revisión ({caseObj.target_type})
        </h2>

        {targetEntity ? (
          <div className="space-y-3 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
            {caseObj.target_type === 'POST' && (
              <>
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="font-semibold text-zinc-200 text-sm">{targetEntity.title}</span>
                  <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                    Estado: {targetEntity.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {targetEntity.content}
                </p>
              </>
            )}

            {caseObj.target_type === 'COMMENT' && (
              <>
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Comentario en post: {targetEntity.post_id}</span>
                  <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                    Estado: {targetEntity.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {targetEntity.content}
                </p>
              </>
            )}

            {caseObj.target_type === 'PROFILE' && (
              <div className="text-xs space-y-1 text-zinc-300">
                <p>
                  <strong>Alias:</strong> @{targetEntity.alias}
                </p>
                <p>
                  <strong>Tipo de perfil:</strong> {targetEntity.profile_type}
                </p>
                <p>
                  <strong>Descripción:</strong> {targetEntity.description || 'Sin descripción'}
                </p>
              </div>
            )}

            {caseObj.target_type === 'MESSAGE' && (
              <div className="text-xs space-y-1 text-zinc-300">
                <p className="whitespace-pre-wrap">{targetEntity.content}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-zinc-500 italic">No se pudo cargar el contenido o fue eliminado.</p>
        )}
      </div>

      {/* Target Author & Sanction Context Section */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
        <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2 border-b border-zinc-800 pb-3">
          <User className="h-5 w-5 text-pink-400" />
          Contexto del Autor Reportado
        </h2>

        {detail.targetAuthor ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-2">
              <p className="text-zinc-200 font-bold text-sm">@{detail.targetAuthor.alias}</p>
              <p className="text-zinc-400">ID Usuario: {detail.targetAuthor.id}</p>
              <p className="text-zinc-400">
                Reportes acumulados realizados por este usuario: {detail.authorTotalReportsCount}
              </p>
            </div>

            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-2">
              <p className="text-zinc-200 font-bold text-xs uppercase tracking-wide">
                Historial de Sanciones Administrativas
              </p>
              {userSanctions.length === 0 ? (
                <p className="text-zinc-500 italic">Sin sanciones previas registradas.</p>
              ) : (
                <ul className="space-y-1.5">
                  {userSanctions.map((s: any) => (
                    <li key={s.id} className="text-zinc-300 border-b border-zinc-800/60 pb-1">
                      <span className="font-semibold text-rose-400">{s.action}:</span> {s.reason}{' '}
                      <span className="text-zinc-500 font-mono text-[10px]">
                        ({new Date(s.created_at).toLocaleDateString()})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-zinc-500 italic">Autor desconocido o sin contexto disponible.</p>
        )}
      </div>

      {/* Linked Reports Section */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
        <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2 border-b border-zinc-800 pb-3">
          <AlertOctagon className="h-5 w-5 text-amber-400" />
          Reportes Vinculados al Caso ({reports.length})
        </h2>

        {reports.length === 0 ? (
          <p className="text-xs text-zinc-500 italic">No hay reportes individuales vinculados.</p>
        ) : (
          <div className="space-y-2">
            {reports.map((r: any) => (
              <div key={r.id} className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-rose-400">Motivo: {r.reason}</span>
                  <span className="text-zinc-500 text-[11px]">
                    Reportado por: @{r.reporter?.alias || 'Anónimo'} —{' '}
                    {new Date(r.created_at).toLocaleString('es-AR')}
                  </span>
                </div>
                {r.details && <p className="text-zinc-300 italic">&ldquo;{r.details}&rdquo;</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Panel 1: Execute Content Moderation Action */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-4">
          <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Shield className="h-4 w-4 text-rose-500" />
            Acción de Moderación de Contenido
          </h2>

          <form onSubmit={handleContentAction} className="space-y-3 text-xs">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Acción sobre el contenido</label>
              <select
                value={contentActionType}
                onChange={(e) => setContentActionType(e.target.value as ModerationActionType)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-200 focus:outline-none focus:border-rose-500"
              >
                <option value="APPROVE">Aprobar / Mantener publicado (APPROVE)</option>
                <option value="HIDE">Ocultar contenido (HIDE)</option>
                <option value="DELETE">Eliminar contenido (DELETE)</option>
                <option value="REQUEST_CHANGES">Solicitar cambios al usuario (REQUEST_CHANGES)</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">Nuevo estado del caso</label>
              <select
                value={newCaseStatus}
                onChange={(e) => setNewCaseStatus(e.target.value as ReportStatus)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-200 focus:outline-none focus:border-rose-500"
              >
                <option value="RESOLVED">Resuelto (RESOLVED)</option>
                <option value="IN_REVIEW">En revisión (IN_REVIEW)</option>
                <option value="WAITING_USER">Esperando respuesta de usuario (WAITING_USER)</option>
                <option value="ESCALATED">Escalar caso (ESCALATED)</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">Motivo de la acción *</label>
              <textarea
                value={contentActionReason}
                onChange={(e) => setContentActionReason(e.target.value)}
                placeholder="Explicación detallada del fallo de moderación..."
                rows={3}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-200 focus:outline-none focus:border-rose-500"
                required
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">Notas internas del caso</label>
              <input
                type="text"
                value={caseNotes}
                onChange={(e) => setCaseNotes(e.target.value)}
                placeholder="Notas privadas para otros moderadores..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-200 focus:outline-none focus:border-rose-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingContentAction}
              className="w-full py-2 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition disabled:opacity-50"
            >
              {isSubmittingContentAction ? 'Ejecutando...' : 'Ejecutar Acción de Contenido'}
            </button>
          </form>
        </div>

        {/* Panel 2: Apply User Sanction */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-4">
          <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Ban className="h-4 w-4 text-amber-500" />
            Aplicar Sanción Administrativa al Usuario
          </h2>

          <form onSubmit={handleApplySanction} className="space-y-3 text-xs">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Tipo de Sanción</label>
              <select
                value={sanctionAction}
                onChange={(e) => setSanctionAction(e.target.value as UserSanctionAction)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-200 focus:outline-none focus:border-rose-500"
              >
                <option value="WARNING">Advertencia Formal (WARNING)</option>
                <option value="TEMPORARY_RESTRICTION">
                  Restricción Temporal de Publicación (TEMPORARY_RESTRICTION)
                </option>
                <option value="SUSPEND">Suspensión Temporal de Cuenta (SUSPEND)</option>
                <option value="PERMANENT_SUSPENSION">Expulsión Permanente / Baneo (PERMANENT_SUSPENSION)</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">Motivo de la Sanción *</label>
              <textarea
                value={sanctionReason}
                onChange={(e) => setSanctionReason(e.target.value)}
                placeholder="Fundamento normativo o de comunidad para la sanción..."
                rows={3}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-200 focus:outline-none focus:border-rose-500"
                required
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">Fecha de Expiración (Opcional)</label>
              <input
                type="datetime-local"
                value={sanctionExpiresAt}
                onChange={(e) => setSanctionExpiresAt(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-200 focus:outline-none focus:border-rose-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingSanction || !detail.targetAuthor?.id}
              className="w-full py-2 px-4 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition disabled:opacity-50"
            >
              {isSubmittingSanction ? 'Aplicando...' : 'Aplicar Sanción al Usuario'}
            </button>
          </form>
        </div>
      </div>

      {/* Audit Logs & Action History */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
        <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2 border-b border-zinc-800 pb-3">
          <History className="h-5 w-5 text-indigo-400" />
          Historial de Acciones y Auditoría
        </h2>

        {moderationActions.length === 0 ? (
          <p className="text-xs text-zinc-500 italic">No hay historial de acciones previas para este caso.</p>
        ) : (
          <div className="space-y-2">
            {moderationActions.map((act: any) => (
              <div key={act.id} className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 text-xs">
                <div className="flex items-center justify-between text-zinc-300 font-medium">
                  <span>Acción: {act.action_type}</span>
                  <span className="text-zinc-500 text-[11px]">
                    Moderador: @{act.moderator?.alias || act.moderator_id} —{' '}
                    {new Date(act.created_at).toLocaleString('es-AR')}
                  </span>
                </div>
                <p className="text-zinc-400 mt-1">Motivo: {act.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
