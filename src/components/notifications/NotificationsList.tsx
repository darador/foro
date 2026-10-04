'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  CheckCheck,
} from 'lucide-react';
import type { NotificationItem } from '@/lib/services/notifications';
import {
  markNotificationReadClient,
  markAllNotificationsReadClient,
} from '@/lib/services/client/notifications';
import { formatDate } from '@/lib/utils';

interface NotificationsListProps {
  initialNotifications: NotificationItem[];
  onItemClick?: () => void;
}

export function NotificationsList({
  initialNotifications,
  onItemClick,
}: NotificationsListProps) {
  const [notifications, setNotifications] =
    useState<NotificationItem[]>(initialNotifications);
  const [loadingAll, setLoadingAll] = useState(false);
  const router = useRouter();

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationReadClient(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
    } catch {
      // Ignore fallback
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || loadingAll) return;
    setLoadingAll(true);
    try {
      await markAllNotificationsReadClient();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
    } catch {
      // Ignore fallback
    } finally {
      setLoadingAll(false);
    }
  };

  const handleNavigate = async (n: NotificationItem) => {
    if (!n.read_at) {
      handleMarkRead(n.id);
    }
    if (onItemClick) {
      onItemClick();
    }

    let targetUrl = '/mensajes';
    if (n.entity_type === 'CONVERSATION') {
      targetUrl = `/mensajes/${n.entity_id}`;
    }

    router.push(targetUrl);
  };

  const renderNotificationContent = (n: NotificationItem) => {
    const actorAlias = n.actor?.alias || 'Alguien';

    switch (n.type) {
      case 'MESSAGE':
        return {
          icon: <MessageSquare className="h-4 w-4 text-indigo-400" />,
          text: `${actorAlias} te envió un mensaje.`,
        };
      case 'MESSAGE_REQUEST':
        return {
          icon: <Clock className="h-4 w-4 text-amber-400" />,
          text: `${actorAlias} quiere enviarte un mensaje.`,
        };
      case 'MESSAGE_REQUEST_ACCEPTED':
        return {
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
          text: `${actorAlias} aceptó tu solicitud de mensaje.`,
        };
      case 'MESSAGE_REQUEST_REJECTED':
        return {
          icon: <XCircle className="h-4 w-4 text-zinc-400" />,
          text: `${actorAlias} rechazó tu solicitud de mensaje.`,
        };
      default:
        return {
          icon: <Bell className="h-4 w-4 text-indigo-400" />,
          text: `${actorAlias} interactuó contigo.`,
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* List Header Actions */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-indigo-400" />
          <span className="text-xs font-semibold text-zinc-200">
            Notificaciones ({notifications.length})
          </span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/30">
              {unreadCount} sin leer
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={loadingAll}
            className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium transition disabled:opacity-50"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            <span>{loadingAll ? 'Cargando...' : 'Marcar todas leídas'}</span>
          </button>
        )}
      </div>

      {/* Notifications Items */}
      {notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-xs text-zinc-500 space-y-2">
          <Bell className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="text-sm font-medium text-zinc-300">No tenés notificaciones.</p>
          <p className="text-zinc-500">
            Te avisaremos cuando recibas mensajes o solicitudes en ForoFetiche.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[70vh] overflow-y-auto">
          {notifications.map((n) => {
            const { icon, text } = renderNotificationContent(n);
            const isUnread = !n.read_at;

            return (
              <div
                key={n.id}
                onClick={() => handleNavigate(n)}
                className={`group flex items-start justify-between gap-3 rounded-xl border p-3 cursor-pointer transition ${
                  isUnread
                    ? 'border-indigo-500/30 bg-indigo-950/20 hover:bg-indigo-900/30'
                    : 'border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-900/80'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-indigo-400 border border-zinc-700 overflow-hidden mt-0.5">
                    {n.actor?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={n.actor.avatar_url}
                        alt={n.actor.alias || 'Usuario'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-200 leading-snug flex items-center gap-1.5 flex-wrap">
                      <span className="shrink-0">{icon}</span>
                      <span>{text}</span>
                    </p>
                    <span className="text-[10px] text-zinc-500 block">
                      {formatDate(n.created_at)}
                    </span>
                  </div>
                </div>

                {isUnread && (
                  <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0 mt-2" title="Sin leer" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
