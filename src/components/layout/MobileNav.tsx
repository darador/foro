'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, PlusCircle, MessageSquare, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Inicio', href: '/', icon: Home },
    { label: 'Explorar', href: '/explorar', icon: Compass },
    { label: 'Publicar', href: '/publicar', icon: PlusCircle, isPrimary: true },
    { label: 'Mensajes', href: '/mensajes', icon: MessageSquare },
    { label: 'Perfil', href: '/perfil', icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-lg md:hidden">
      <nav className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          if (item.isPrimary) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center -mt-4"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-900/40 hover:bg-indigo-500 transition">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="mt-1 text-[10px] font-medium text-zinc-400">
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center w-12 h-12 rounded-lg transition-colors',
                isActive ? 'text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium mt-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
