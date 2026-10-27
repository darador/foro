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
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-medium transition duration-150 ${
        reacted
          ? 'border-[var(--pink-primary)] bg-[var(--pink-primary)]/15 text-[var(--pink-primary)] shadow-sm'
          : 'border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--pink-primary)] hover:text-[var(--text-primary)]'
      }`}
    >
      <span className="text-sm">🔥</span>
      <span>Me interesa</span>
      <span className="font-bold text-[var(--text-primary)] ml-0.5">{count}</span>
    </button>
  );
}
