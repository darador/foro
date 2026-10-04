import Link from 'next/link';
import { isDirectoryEnabled } from '@/lib/config/feature-flags';
import { Home, Compass, PlusCircle, MessageSquare, User, ShieldAlert, Bookmark, Search } from 'lucide-react';

interface NavbarProps {
  user?: {
    alias?: string;
    email_verified?: boolean;
  } | null;
}

export function Navbar({ user }: NavbarProps) {
  const directoryActive = isDirectoryEnabled();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-zinc-100">
              Foro<span className="text-indigo-400">Fetiche</span>
            </span>
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
              18+
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-300">
            <Link href="/" className="transition hover:text-white flex items-center gap-1.5">
              <Home className="h-4 w-4 text-zinc-400" />
              Inicio
            </Link>
            <Link href="/explorar" className="transition hover:text-white flex items-center gap-1.5">
              <Compass className="h-4 w-4 text-zinc-400" />
              Explorar
            </Link>
            {directoryActive && (
              <Link href="/directorio" className="transition hover:text-white">
                Directorio
              </Link>
            )}
          </nav>
        </div>

        {/* Header Quick Search */}
        <form action="/explorar" method="GET" className="hidden lg:flex items-center relative w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            name="q"
            placeholder="Buscar en ForoFetiche..."
            className="w-full rounded-full border border-zinc-800 bg-zinc-900/90 py-1.5 pl-9 pr-3 text-xs text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
          />
        </form>

        {/* Action Controls & Auth */}
        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <>
              <Link
                href="/publicar"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow hover:bg-indigo-500 transition"
              >
                <PlusCircle className="h-4 w-4" />
                Publicar
              </Link>
              <Link
                href="/mensajes"
                className="p-2 text-zinc-400 hover:text-white transition rounded-md hover:bg-zinc-900"
                title="Mensajes"
              >
                <MessageSquare className="h-5 w-5" />
              </Link>
              <Link
                href="/guardados"
                className="p-2 text-zinc-400 hover:text-white transition rounded-md hover:bg-zinc-900"
                title="Guardados"
              >
                <Bookmark className="h-5 w-5" />
              </Link>
              <Link
                href="/perfil"
                className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800 transition"
              >
                <User className="h-4 w-4 text-indigo-400" />
                <span>{user.alias || 'Mi Perfil'}</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-zinc-300 hover:text-white transition px-3 py-2"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/registro"
                className="rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 transition"
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
