'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isDirectoryEnabled } from '@/lib/config/feature-flags';
import { Home, Compass, PlusCircle, MessageSquare, User, Bookmark, Search } from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ThemeSelector } from '@/components/common/ThemeSelector';

interface NavbarProps {
  user?: {
    alias?: string;
    email_verified?: boolean;
  } | null;
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const directoryActive = isDirectoryEnabled();

  const isHomeActive = pathname === '/';
  const isExplorarActive = pathname?.startsWith('/explorar');

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border-color)] bg-[var(--bg-nav)]/95 backdrop-blur-md transition-colors duration-200">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8 gap-4">
        {/* Brand & Main Nav Links */}
        <div className="flex items-center gap-6 shrink-0">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-xl font-bold tracking-tight text-[var(--text-primary)] transition">
              Foro<span className="text-[var(--pink-primary)]">Fetiche</span>
            </span>
            <span className="rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--pink-primary)] tracking-wider">
              18+
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-2 text-sm font-medium">
            <Link
              href="/"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                isHomeActive
                  ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]/60'
              }`}
            >
              <Home className="h-4 w-4" />
              <span>Inicio</span>
            </Link>
            <Link
              href="/explorar"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                isExplorarActive
                  ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]/60'
              }`}
            >
              <Compass className="h-4 w-4" />
              <span>Explorar</span>
            </Link>
            {directoryActive && (
              <Link
                href="/directorio"
                className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
              >
                Directorio
              </Link>
            )}
          </nav>
        </div>

        {/* Center Quick Search (Desktop ~320px) */}
        <div className="hidden lg:flex flex-1 justify-center max-w-sm">
          <form action="/explorar" method="GET" className="relative w-full">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="text"
              name="q"
              placeholder="Buscar relatos, fetiches..."
              className="w-full rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)] py-1.5 pl-9 pr-4 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] transition focus:border-[var(--pink-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--violet-primary)]"
            />
          </form>
        </div>

        {/* Right Actions: Theme Selector & Auth Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <ThemeSelector />

          {user ? (
            <>
              <Link
                href="/publicar"
                className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--pink-primary)] to-[var(--violet-primary)] px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:opacity-95 transition"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Publicar</span>
              </Link>
              <NotificationBell />
              <Link
                href="/mensajes"
                className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition rounded-xl hover:bg-[var(--bg-secondary)]"
                title="Mensajes"
              >
                <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
              </Link>
              <Link
                href="/guardados"
                className="hidden sm:inline-flex p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition rounded-xl hover:bg-[var(--bg-secondary)]"
                title="Guardados"
              >
                <Bookmark className="h-4 w-4 sm:h-5 sm:w-5" />
              </Link>
              <Link
                href="/perfil"
                className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-[var(--text-primary)] hover:border-[var(--pink-primary)] transition"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-[var(--pink-primary)] to-[var(--violet-primary)] text-[10px] font-bold text-white">
                  {user.alias ? user.alias[0].toUpperCase() : 'U'}
                </div>
                <span className="max-w-[90px] truncate">{user.alias || 'Mi Perfil'}</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-xs sm:text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition px-2.5 sm:px-3 py-1.5"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/registro"
                className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--pink-primary)] hover:bg-[var(--bg-secondary)] transition shadow-sm"
              >
                Registrarse
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
