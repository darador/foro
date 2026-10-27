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
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition duration-150 ${
        saved
          ? 'border-[var(--violet-primary)] bg-[var(--violet-primary)]/15 text-[var(--violet-primary)] shadow-sm'
          : 'border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:text-[var(--text-primary)]'
      }`}
      title={saved ? 'Quitar de guardados' : 'Guardar publicación (Privado)'}
    >
      <Bookmark className={`h-3.5 w-3.5 ${saved ? 'fill-[var(--violet-primary)] text-[var(--violet-primary)]' : ''}`} />
      <span>{saved ? 'Guardado' : 'Guardar'}</span>
    </button>
  );
}
