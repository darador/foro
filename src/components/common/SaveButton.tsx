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
          ? 'border-[#7553FF]/60 bg-[#7553FF]/20 text-[#C4B5FD] shadow-sm'
          : 'border-[#2A2930] bg-[#18181D] text-[#AAA4B0] hover:border-[#383740] hover:text-[#F5F2F5]'
      }`}
      title={saved ? 'Quitar de guardados' : 'Guardar publicación (Privado)'}
    >
      <Bookmark className={`h-3.5 w-3.5 ${saved ? 'fill-[#967EFF] text-[#967EFF]' : ''}`} />
      <span>{saved ? 'Guardado' : 'Guardar'}</span>
    </button>
  );
}
