'use client';

import { useState } from 'react';
import { togglePostReaction, toggleCommentReaction } from '@/lib/services/reactions';

interface ReactionButtonProps {
  targetId: string;
  targetType: 'POST' | 'COMMENT';
  initialCount: number;
  initialReacted?: boolean;
  user?: { id: string } | null;
}

export function ReactionButton({
  targetId,
  targetType,
  initialCount,
  initialReacted = false,
  user,
}: ReactionButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [reacted, setReacted] = useState(initialReacted);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!user) {
      alert('Debes iniciar sesión para reaccionar.');
      return;
    }

    // Optimistic UI update
    const previousReacted = reacted;
    const previousCount = count;

    setReacted(!previousReacted);
    setCount(previousReacted ? Math.max(0, count - 1) : count + 1);
    setLoading(true);

    try {
      if (targetType === 'POST') {
        const result = await togglePostReaction(targetId, user.id);
        setReacted(result.reacted);
      } else {
        const result = await toggleCommentReaction(targetId, user.id);
        setReacted(result.reacted);
      }
    } catch {
      // Revert on error
      setReacted(previousReacted);
      setCount(previousCount);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
        reacted
          ? 'border-amber-500/50 bg-amber-500/10 text-amber-300 shadow-sm'
          : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
      }`}
    >
      <span>🔥</span>
      <span>Me interesa</span>
      <span className="font-bold text-zinc-200">{count}</span>
    </button>
  );
}
