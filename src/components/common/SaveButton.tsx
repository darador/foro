'use client';

import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import { toggleSavePost } from '@/lib/services/interactions';

interface SaveButtonProps {
  postId: string;
  initialSaved?: boolean;
  user?: { id: string } | null;
}

export function SaveButton({ postId, initialSaved = false, user }: SaveButtonProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!user) {
      alert('Debes iniciar sesión para guardar publicaciones.');
      return;
    }

    const previousSaved = saved;
    setSaved(!previousSaved);
    setLoading(true);

    try {
      const result = await toggleSavePost(postId, user.id);
      setSaved(result.saved);
    } catch {
      setSaved(previousSaved);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
        saved
          ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
          : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
      }`}
      title={saved ? 'Quitar de guardados' : 'Guardar publicación (Privado)'}
    >
      <Bookmark className={`h-3.5 w-3.5 ${saved ? 'fill-indigo-400 text-indigo-400' : ''}`} />
      <span>{saved ? 'Guardado' : 'Guardar'}</span>
    </button>
  );
}
