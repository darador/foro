import { Users, FileText, Flag, ShieldAlert } from 'lucide-react';

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Dashboard Administrativo</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Visión general del estado del foro, casos de moderación y métricas de seguridad.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Usuarios Registrados</span>
            <Users className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-100 mt-2">1,248</div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Publicaciones Activas</span>
            <FileText className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-100 mt-2">4,892</div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Reportes Pendientes</span>
            <Flag className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-100 mt-2">3</div>
        </div>
      </div>

      {/* Recent Moderation Activity */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-indigo-400" />
          Alertas de Moderación Recientes
        </h2>
        <div className="text-xs text-zinc-500 text-center py-6 border border-dashed border-zinc-800 rounded-lg">
          No hay alertas críticas pendientes de revisión.
        </div>
      </div>
    </div>
  );
}
