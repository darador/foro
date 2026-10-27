'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { toggleFollowPost } from '@/lib/services/interactions';

interface FollowButtonProps {
  postId: string;
  initialFollowed?: boolean;
  user?: { id: string } | null;
}

export function FollowButton({ postId, initialFollowed = false, user }: FollowButtonProps) {
  const [followed, setFollowed] = useState(initialFollowed);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!user) {
      alert('Debes iniciar sesión para seguir publicaciones.');
      return;
    }

    const previousFollowed = followed;
    setFollowed(!previousFollowed);
    setLoading(true);

    try {
      const result = await toggleFollowPost(postId, user.id);
      setFollowed(result.followed);
    } catch {
      setFollowed(previousFollowed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition duration-150 ${
        followed
          ? 'border-[var(--pink-primary)] bg-[var(--pink-primary)]/15 text-[var(--pink-primary)] shadow-sm'
          : 'border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:text-[var(--text-primary)]'
      }`}
      title={followed ? 'Dejar de seguir esta publicación' : 'Seguir publicación para recibir novedades'}
    >
      <Bell className={`h-3.5 w-3.5 ${followed ? 'fill-[var(--pink-primary)] text-[var(--pink-primary)]' : ''}`} />
      <span>{followed ? 'Siguiendo' : 'Seguir'}</span>
    </button>
  );
}
