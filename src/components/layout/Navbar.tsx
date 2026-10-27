import Link from 'next/link';
import { isDirectoryEnabled } from '@/lib/config/feature-flags';
import { Home, Compass, PlusCircle, MessageSquare, User, Bookmark, Search } from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';

interface NavbarProps {
  user?: {
    alias?: string;
    email_verified?: boolean;
  } | null;
}

export function Navbar({ user }: NavbarProps) {
  const directoryActive = isDirectoryEnabled();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#2A2930] bg-[#09090B]/85 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="group flex items-center gap-2.5 transition">
            <span className="text-xl font-bold tracking-tight text-[#F5F2F5]">
              Foro<span className="bg-gradient-to-r from-[#B23D66] to-[#967EFF] bg-clip-text text-transparent group-hover:from-[#D14979] group-hover:to-[#B7A4FF] transition-all">Fetiche</span>
            </span>
            <span className="rounded-md border border-[#852D4C]/40 bg-[#571F35]/25 px-1.5 py-0.5 text-[10px] font-semibold text-[#FFB6CF] tracking-wider uppercase">
              18+
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#AAA4B0]">
            <Link
              href="/"
              className="flex items-center gap-1.5 transition hover:text-[#F5F2F5]"
            >
              <Home className="h-4 w-4 text-[#726D7A]" />
              Inicio
            </Link>
            <Link
              href="/explorar"
              className="flex items-center gap-1.5 transition hover:text-[#F5F2F5]"
            >
              <Compass className="h-4 w-4 text-[#726D7A]" />
              Explorar
            </Link>
            {directoryActive && (
              <Link href="/directorio" className="transition hover:text-[#F5F2F5]">
                Directorio
              </Link>
            )}
          </nav>
        </div>

        {/* Header Quick Search */}
        <form action="/explorar" method="GET" className="hidden lg:flex items-center relative w-72">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-[#726D7A]" />
          <input
            type="text"
            name="q"
            placeholder="Buscar relatos, fetiches..."
            className="w-full rounded-full border border-[#2A2930] bg-[#111114] py-1.5 pl-9 pr-3 text-xs text-[#F5F2F5] placeholder-[#726D7A] transition focus:border-[#7553FF] focus:outline-none focus:ring-1 focus:ring-[#7553FF]/50 hover:border-[#383740]"
          />
        </form>

        {/* Action Controls & Auth */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <Link
                href="/publicar"
                className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#852D4C] to-[#7553FF] px-3.5 py-2 text-xs sm:text-sm font-medium text-white shadow-[0_2px_12px_rgba(133,45,76,0.25)] hover:from-[#9C3559] hover:to-[#8565FF] transition"
              >
                <PlusCircle className="h-4 w-4" />
                Publicar
              </Link>
              <NotificationBell />
              <Link
                href="/mensajes"
                className="p-2 text-[#AAA4B0] hover:text-[#F5F2F5] transition rounded-lg hover:bg-[#18181D]"
                title="Mensajes"
              >
                <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
              </Link>
              <Link
                href="/guardados"
                className="hidden sm:inline-flex p-2 text-[#AAA4B0] hover:text-[#F5F2F5] transition rounded-lg hover:bg-[#18181D]"
                title="Guardados"
              >
                <Bookmark className="h-4 w-4 sm:h-5 sm:w-5" />
              </Link>
              <Link
                href="/perfil"
                className="flex items-center gap-2 rounded-lg border border-[#2A2930] bg-[#18181D] px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-[#F5F2F5] hover:bg-[#201F26] hover:border-[#383740] transition"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#571F35] text-[10px] font-bold text-[#FFB6CF]">
                  {user.alias ? user.alias[0].toUpperCase() : 'U'}
                </div>
                <span className="max-w-[100px] truncate">{user.alias || 'Mi Perfil'}</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-xs sm:text-sm font-medium text-[#AAA4B0] hover:text-[#F5F2F5] transition px-2.5 sm:px-3 py-1.5"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/registro"
                className="rounded-lg border border-[#852D4C]/60 bg-[#571F35]/25 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-[#F5F2F5] hover:bg-[#852D4C]/35 hover:border-[#852D4C] transition shadow-sm"
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
