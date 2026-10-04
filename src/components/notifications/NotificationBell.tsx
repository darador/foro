'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import {
  getUserNotificationsClient,
  getUnreadNotificationsCountClient,
} from '@/lib/services/client/notifications';
import { NotificationsList } from './NotificationsList';
import type { NotificationItem } from '@/lib/services/notifications';

interface NotificationBellProps {
  initialUnreadCount?: number;
}

export function NotificationBell({ initialUnreadCount = 0 }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState<number>(initialUnreadCount);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch unread count on mount if not provided
  useEffect(() => {
    let isMounted = true;
    getUnreadNotificationsCountClient().then((count) => {
      if (isMounted) setUnreadCount(count);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggle = async () => {
    if (!isOpen) {
      setLoading(true);
      try {
        const list = await getUserNotificationsClient(20);
        setNotifications(list);
        const unread = list.filter((n) => !n.read_at).length;
        setUnreadCount(unread);
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    }
    setIsOpen((prev) => !prev);
  };

  const badgeDisplay = unreadCount > 9 ? '9+' : unreadCount;

  return (
    <div className="relative" ref={containerRef}>
      {/* Desktop Bell Button */}
      <button
        onClick={handleToggle}
        aria-label="Notificaciones"
        title="Notificaciones"
        className="relative p-2 text-zinc-400 hover:text-white transition rounded-md hover:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white shadow ring-2 ring-zinc-950">
            {badgeDisplay}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
          {loading ? (
            <div className="py-8 text-center text-xs text-zinc-400 space-y-2">
              <Bell className="h-6 w-6 mx-auto animate-pulse text-indigo-400" />
              <p>Cargando notificaciones...</p>
            </div>
          ) : (
            <NotificationsList
              initialNotifications={notifications}
              onItemClick={() => setIsOpen(false)}
            />
          )}

          <div className="pt-3 border-t border-zinc-800 text-center">
            <Link
              href="/notificaciones"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
            >
              Ver todas las notificaciones
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
