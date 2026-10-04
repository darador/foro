'use client';

import { useState } from 'react';
import { UserX } from 'lucide-react';
import { toggleBlockUser } from '@/lib/services/interactions';

interface BlockButtonProps {
  targetUserId: string;
  targetAlias: string;
  user?: { id: string } | null;
}

export function BlockButton({ targetUserId, targetAlias, user }: BlockButtonProps) {
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!user || user.id === targetUserId) {
    return null;
  }

  const handleClick = async () => {
    const confirmText = blocked
      ? `¿Deseas desbloquear a @${targetAlias}?`
      : `¿Estás seguro de bloquear a @${targetAlias}? No podrás interactuar ni recibir sus mensajes.`;

    if (!window.confirm(confirmText)) return;

    setLoading(true);

    try {
      const result = await toggleBlockUser(user.id, targetUserId);
      setBlocked(result.blocked);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cambiar estado de bloqueo.';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-1 text-xs transition ${
        blocked ? 'text-zinc-400 font-medium' : 'text-zinc-500 hover:text-red-400'
      }`}
      title={blocked ? 'Desbloquear usuario' : 'Bloquear usuario'}
    >
      <UserX className="h-3.5 w-3.5" />
      <span>{blocked ? 'Bloqueado' : 'Bloquear'}</span>
    </button>
  );
}
