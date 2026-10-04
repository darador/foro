'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Shield, AlertTriangle, Clock, CheckCircle2, Filter, Eye, FileText, MessageSquare, User, Mail } from 'lucide-react';
import type { ModerationPriority, ReportStatus } from '@/types/database';
import type { ModerationCaseListItem } from '@/lib/services/moderation';

interface ModerationQueueViewProps {
  initialCases: ModerationCaseListItem[];
  totalCases: number;
}

export function ModerationQueueView({ initialCases, totalCases }: ModerationQueueViewProps) {
  const [cases, setCases] = useState<ModerationCaseListItem[]>(initialCases);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('ALL');

  // Filter cases in client state for fast responsive UI
  const filteredCases = cases.filter((c) => {
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (priorityFilter !== 'ALL' && c.priority !== priorityFilter) return false;
    if (targetTypeFilter !== 'ALL' && c.target_type !== targetTypeFilter) return false;
    return true;
  });

  const criticalCount = cases.filter((c) => c.priority === 'CRITICAL' && c.status !== 'RESOLVED').length;
  const openCount = cases.filter((c) => c.status === 'OPEN').length;
  const inReviewCount = cases.filter((c) => c.status === 'IN_REVIEW').length;

  const getPriorityBadge = (priority: ModerationPriority) => {
    switch (priority) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-950/80 text-red-400 border border-red-800/60">
            <AlertTriangle className="h-3 w-3" /> CRÍTICO
          </span>
        );
      case 'REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-400 border border-amber-800/60">
            REVISIÓN
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
            BAJO
          </span>
        );
    }
  };

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-yellow-950/60 text-yellow-400 border border-yellow-800/40">
            <Clock className="h-3 w-3" /> ABIERTO
          </span>
        );
      case 'IN_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-950/60 text-blue-400 border border-blue-800/40">
            <Shield className="h-3 w-3" /> EN REVISIÓN
          </span>
        );
      case 'WAITING_USER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-purple-950/60 text-purple-400 border border-purple-800/40">
            ESPERANDO USUARIO
          </span>
        );
      case 'ESCALATED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-orange-950/60 text-orange-400 border border-orange-800/40">
            ESCALADO
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
            <CheckCircle2 className="h-3 w-3" /> RESUELTO
          </span>
        );
      default:
        return <span className="text-xs text-zinc-400">{status}</span>;
    }
  };

  const getTargetIcon = (targetType: string | null) => {
    switch (targetType) {
      case 'POST':
        return <FileText className="h-4 w-4 text-indigo-400" />;
      case 'COMMENT':
        return <MessageSquare className="h-4 w-4 text-emerald-400" />;
      case 'PROFILE':
        return <User className="h-4 w-4 text-pink-400" />;
      case 'MESSAGE':
        return <Mail className="h-4 w-4 text-amber-400" />;
      default:
        return <Shield className="h-4 w-4 text-zinc-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Counters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Shield className="h-6 w-6 text-rose-500" />
            Bandeja de Moderación Base
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Gestión y revisión humana de contenidos reportados y sanciones a usuarios.
          </p>
        </div>

        {/* Counter Pills */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-red-950/50 border border-red-900/60 text-xs">
            <span className="text-red-400 font-bold text-sm block">{criticalCount}</span>
            <span className="text-red-300/80">Críticos pendientes</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-yellow-950/50 border border-yellow-900/60 text-xs">
            <span className="text-yellow-400 font-bold text-sm block">{openCount}</span>
            <span className="text-yellow-300/80">Sin asignar</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-blue-950/50 border border-blue-900/60 text-xs">
            <span className="text-blue-400 font-bold text-sm block">{inReviewCount}</span>
            <span className="text-blue-300/80">En revisión</span>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
          <Filter className="h-3.5 w-3.5 text-rose-400" />
          Filtros de Búsqueda
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Status Filter */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1 font-medium">Estado del Caso</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-rose-500"
            >
              <option value="ALL">Todos los estados</option>
              <option value="OPEN">Abierto (OPEN)</option>
              <option value="IN_REVIEW">En Revisión (IN_REVIEW)</option>
              <option value="WAITING_USER">Esperando Usuario (WAITING_USER)</option>
              <option value="ESCALATED">Escalado (ESCALATED)</option>
              <option value="RESOLVED">Resuelto (RESOLVED)</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1 font-medium">Prioridad de Riesgo</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-rose-500"
            >
              <option value="ALL">Todas las prioridades</option>
              <option value="CRITICAL">Crítico (CRITICAL)</option>
              <option value="REVIEW">Revisión (REVIEW)</option>
              <option value="LOW">Bajo (LOW)</option>
            </select>
          </div>

          {/* Target Type Filter */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1 font-medium">Tipo de Entidad</label>
            <select
              value={targetTypeFilter}
              onChange={(e) => setTargetTypeFilter(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-rose-500"
            >
              <option value="ALL">Todas las entidades</option>
              <option value="POST">Publicación (POST)</option>
              <option value="COMMENT">Comentario (COMMENT)</option>
              <option value="PROFILE">Perfil de Usuario (PROFILE)</option>
              <option value="MESSAGE">Mensaje Privado (MESSAGE)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Moderation Cases List */}
      <div className="space-y-3">
        {filteredCases.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
            <Shield className="mx-auto h-8 w-8 text-zinc-600 mb-2" />
            <p className="text-sm text-zinc-400 font-medium">
              No se encontraron casos de moderación que coincidan con los filtros seleccionados.
            </p>
          </div>
        ) : (
          filteredCases.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border p-4 transition ${
                item.priority === 'CRITICAL' && item.status !== 'RESOLVED'
                  ? 'border-red-900/80 bg-red-950/20 hover:border-red-700'
                  : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Case Info Header */}
                <div className="flex items-center gap-3">
                  {getPriorityBadge(item.priority)}
                  {getStatusBadge(item.status)}
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                    {getTargetIcon(item.target_type)}
                    <span>{item.target_type || 'ENTIDAD'}</span>
                  </div>
                </div>

                {/* Date and Action Link */}
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-zinc-500">
                    {new Date(item.created_at).toLocaleString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <Link
                    href={`/admin/moderacion/${item.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Revisar Caso
                  </Link>
                </div>
              </div>

              {/* Case Body */}
              <div className="mt-3 pt-3 border-t border-zinc-800/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-zinc-500 block">Reportes vinculados:</span>
                  <span className="text-zinc-200 font-semibold">{item.reports_count} reporte(s)</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Moderador asignado:</span>
                  <span className="text-zinc-200">
                    {item.assigned_moderator_alias ? `@${item.assigned_moderator_alias}` : 'Sin asignar'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Motivo inicial:</span>
                  <span className="text-zinc-300 font-medium">
                    {item.first_report?.reason || 'No especificado'}
                  </span>
                </div>
              </div>

              {item.first_report?.details && (
                <div className="mt-2 text-xs text-zinc-400 bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/40">
                  <span className="text-zinc-500 font-semibold mr-1">Detalle:</span>
                  &ldquo;{item.first_report.details}&rdquo;
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
