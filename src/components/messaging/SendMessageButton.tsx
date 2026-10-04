'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Send, Clock, MessageSquare, ShieldOff, Check } from 'lucide-react';
import { SendMessageModal } from './SendMessageModal';
import type { MessagingRelationStatus } from '@/lib/services/messaging';

interface SendMessageButtonProps {
  targetUserId: string;
  targetAlias: string;
  initialRelationStatus?: MessagingRelationStatus;
}

export function SendMessageButton({
  targetUserId,
  targetAlias,
  initialRelationStatus = 'NO_RELATION',
}: SendMessageButtonProps) {
  const [relation, setRelation] = useState<MessagingRelationStatus>(initialRelationStatus);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (relation === 'SELF') {
    return null;
  }

  const handleSuccess = () => {
    setRelation('PENDING_SENT');
  };

  return (
    <>
      {relation === 'NO_RELATION' && (
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow hover:bg-indigo-500 transition"
        >
          <Send className="h-3.5 w-3.5" />
          Enviar mensaje
        </button>
      )}

      {relation === 'PENDING_SENT' && (
        <button
          disabled
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-400 cursor-default"
        >
          <Clock className="h-3.5 w-3.5 text-amber-400" />
          Solicitud pendiente
        </button>
      )}

      {relation === 'PENDING_RECEIVED' && (
        <Link
          href="/mensajes"
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-medium text-white shadow hover:bg-amber-500 transition"
        >
          <Clock className="h-3.5 w-3.5" />
          Responder solicitud
        </Link>
      )}

      {relation === 'ACCEPTED' && (
        <Link
          href="/mensajes"
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow hover:bg-indigo-500 transition"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Mensaje
        </Link>
      )}

      {relation === 'BLOCKED' && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-500">
          <ShieldOff className="h-3.5 w-3.5 text-rose-500/70" />
          No podés enviar mensajes
        </span>
      )}

      {relation === 'POLICY_NOBODY' && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-500">
          <ShieldOff className="h-3.5 w-3.5 text-zinc-600" />
          No acepta mensajes
        </span>
      )}

      <SendMessageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        targetUserId={targetUserId}
        targetAlias={targetAlias}
        onSuccess={handleSuccess}
      />
    </>
  );
}
