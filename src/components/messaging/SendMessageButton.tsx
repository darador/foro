'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Send, Clock, MessageSquare, ShieldOff, LogIn } from 'lucide-react';
import { SendMessageModal } from './SendMessageModal';
import type { MessagingRelationStatus } from '@/lib/services/messaging';

interface SendMessageButtonProps {
  targetUserId: string;
  targetAlias: string;
  initialRelationStatus?: MessagingRelationStatus;
  conversationId?: string;
  isAuthenticated?: boolean;
}

export function SendMessageButton({
  targetUserId,
  targetAlias,
  initialRelationStatus = 'NO_RELATION',
  conversationId,
  isAuthenticated = true,
}: SendMessageButtonProps) {
  const [relation, setRelation] = useState<MessagingRelationStatus>(initialRelationStatus);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 1. Unauthenticated Visitors
  if (!isAuthenticated) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
      >
        <LogIn className="h-3.5 w-3.5 text-indigo-400" />
        Iniciá sesión para enviar mensajes
      </Link>
    );
  }

  // 2. Self Profile
  if (relation === 'SELF') {
    return null;
  }

  const handleSuccess = () => {
    setRelation('PENDING_SENT');
  };

  return (
    <>
      {/* 3. Blocked */}
      {relation === 'BLOCKED' && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-500">
          <ShieldOff className="h-3.5 w-3.5 text-rose-500/70" />
          No podés enviar mensajes
        </span>
      )}

      {/* 4. Policy Nobody */}
      {relation === 'POLICY_NOBODY' && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-500">
          <ShieldOff className="h-3.5 w-3.5 text-zinc-600" />
          No acepta mensajes
        </span>
      )}

      {/* 5. Accepted Conversation */}
      {relation === 'ACCEPTED' && (
        <Link
          href={conversationId ? `/mensajes/${conversationId}` : '/mensajes'}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow hover:bg-indigo-500 transition"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Mensaje
        </Link>
      )}

      {/* 6. Pending Sent */}
      {relation === 'PENDING_SENT' && (
        <button
          disabled
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-400 cursor-default"
        >
          <Clock className="h-3.5 w-3.5 text-amber-400" />
          Solicitud pendiente
        </button>
      )}

      {/* 7. Pending Received */}
      {relation === 'PENDING_RECEIVED' && (
        <Link
          href="/mensajes"
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-medium text-white shadow hover:bg-amber-500 transition"
        >
          <Clock className="h-3.5 w-3.5" />
          Responder solicitud
        </Link>
      )}

      {/* 8 & 9. Rejected or No Relation (Allows sending a new request) */}
      {(relation === 'NO_RELATION' || relation === 'REJECTED') && (
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow hover:bg-indigo-500 transition"
        >
          <Send className="h-3.5 w-3.5" />
          Enviar mensaje
        </button>
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
