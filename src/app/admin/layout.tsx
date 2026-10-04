import Link from 'next/link';
import { Shield, Users, FileText, Flag, MessageSquare, Folder, History, Settings, LayoutDashboard } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const adminNav = [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { label: 'Usuarios', href: '/admin/usuarios', icon: Users },
    { label: 'Publicaciones', href: '/admin/publicaciones', icon: FileText },
    { label: 'Comentarios', href: '/admin/comentarios', icon: MessageSquare },
    { label: 'Reportes', href: '/admin/reportes', icon: Flag },
    { label: 'Moderación', href: '/admin/moderacion', icon: Shield },
    { label: 'Directorio', href: '/admin/directorio', icon: Folder },
    { label: 'Auditoría', href: '/admin/auditoria', icon: History },
    { label: 'Configuración', href: '/admin/configuracion', icon: Settings },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Admin Sidebar */}
        <aside className="w-full lg:w-64 shrink-0">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 font-semibold text-zinc-100 text-sm">
              <Shield className="h-4 w-4 text-indigo-400" />
              Panel de Control
            </div>
            <nav className="space-y-1 text-xs">
              {adminNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition font-medium"
                  >
                    <Icon className="h-4 w-4 text-zinc-500" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Admin Main Content */}
        <main className="flex-1 space-y-6">{children}</main>
      </div>
    </div>
  );
}
