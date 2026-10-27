'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, PlusCircle, MessageSquare, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Inicio', href: '/', icon: Home },
    { label: 'Explorar', href: '/explorar', icon: Compass },
    { label: 'Publicar', href: '/publicar', icon: PlusCircle, isPrimary: true },
    { label: 'Avisos', href: '/notificaciones', icon: Bell },
    { label: 'Mensajes', href: '/mensajes', icon: MessageSquare },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border-color)] bg-[var(--bg-nav)]/95 backdrop-blur-lg md:hidden transition-colors duration-200">
      <nav className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          if (item.isPrimary) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center -mt-5"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-[var(--pink-primary)] to-[var(--violet-primary)] text-white shadow-lg hover:scale-105 transition-transform">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="mt-1 text-[10px] font-medium text-[var(--text-secondary)]">
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
                'flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-colors',
                isActive ? 'text-[var(--pink-primary)] font-semibold' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
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
