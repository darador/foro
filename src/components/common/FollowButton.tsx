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
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
        followed
          ? 'border-purple-500/50 bg-purple-500/10 text-purple-300'
          : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
      }`}
      title={followed ? 'Dejar de seguir esta publicación' : 'Seguir publicación para recibir novedades'}
    >
      <Bell className={`h-3.5 w-3.5 ${followed ? 'fill-purple-400 text-purple-400' : ''}`} />
      <span>{followed ? 'Siguiendo' : 'Seguir'}</span>
    </button>
  );
}
