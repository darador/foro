'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import { CommentForm } from './CommentForm';
import { CommentItem } from './CommentItem';
import { getCommentsForPost, type CommentNode } from '@/lib/services/comments';

interface CommentSectionProps {
  postId: string;
  user?: { id: string; email_verified?: boolean } | null;
}

export function CommentSection({ postId, user }: CommentSectionProps) {
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [loading, setLoading] = useState(true);

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCommentsForPost(postId);
      setComments(data);
    } catch (err) {
      console.error('Error loading comments:', err);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  return (
    <section id="comentarios" className="space-y-6 border-t border-zinc-800 pt-8">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-indigo-400" />
          Comentarios ({comments.length})
        </h3>
      </div>

      {/* Root Comment Form */}
      {user ? (
        <CommentForm postId={postId} user={user} onSuccess={loadComments} />
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-center text-xs text-zinc-400">
          Inicia sesión para participar en los comentarios.
        </div>
      )}

      {/* Comment List */}
      {loading ? (
        <div className="text-center text-xs text-zinc-500 py-6">Cargando comentarios...</div>
      ) : comments.length === 0 ? (
        <div className="text-center text-xs text-zinc-500 py-6 border border-dashed border-zinc-800/80 rounded-xl">
          Sé el primero en compartir un comentario respetuoso.
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              user={user}
              onCommentUpdated={loadComments}
            />
          ))}
        </div>
      )}
    </section>
  );
}
