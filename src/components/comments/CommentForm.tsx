'use client';

import { useState } from 'react';
import { Send, CornerDownRight } from 'lucide-react';
import { createComment } from '@/lib/services/comments';

interface CommentFormProps {
  postId: string;
  parentId?: string | null;
  user?: { id: string; email_verified?: boolean } | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  placeholder?: string;
}

export function CommentForm({
  postId,
  parentId,
  user,
  onSuccess,
  onCancel,
  placeholder = 'Escribe un comentario respetuoso...',
}: CommentFormProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError('Debes iniciar sesión para comentar.');
      return;
    }

    if (user.email_verified === false) {
      setError('Debes verificar tu correo electrónico para comentar.');
      return;
    }

    if (content.trim().length < 3) {
      setError('El comentario debe tener al menos 3 caracteres.');
      return;
    }

    setLoading(true);

    try {
      await createComment(
        {
          post_id: postId,
          parent_id: parentId || null,
          content: content.trim(),
        },
        user.id
      );
      setContent('');
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al enviar el comentario.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="relative">
        <textarea
          rows={parentId ? 2 : 3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs sm:text-sm text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition shadow disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          <span>{loading ? 'Enviando...' : parentId ? 'Responder' : 'Comentar'}</span>
        </button>
      </div>
    </form>
  );
}
