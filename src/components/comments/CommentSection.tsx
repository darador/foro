'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { MessageSquare, Lock, Sparkles, Feather } from 'lucide-react';
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
    <section id="comentarios" className="space-y-6 border-t border-[#2A2930] pt-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-[#F5F2F5] flex items-center gap-2.5">
            <MessageSquare className="h-5 w-5 text-[#FFB6CF]" />
            Conversación ({comments.length})
          </h3>
          <p className="text-xs text-[#AAA4B0] mt-0.5">
            Comentarios y perspectivas compartidas por la comunidad
          </p>
        </div>
      </div>

      {/* Root Comment Form or Login Gate */}
      {user ? (
        <div className="rounded-2xl border border-[#2A2930] bg-[#111114] p-5 shadow-sm">
          <CommentForm postId={postId} user={user} onSuccess={loadComments} />
        </div>
      ) : (
        <div className="rounded-2xl border border-[#2A2930] bg-gradient-to-r from-[#18181D] to-[#111114] p-6 text-center space-y-3.5">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#571F35]/30 text-[#FFB6CF]">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#F5F2F5]">
              Unite a la conversación
            </h4>
            <p className="text-xs text-[#AAA4B0] max-w-md mx-auto mt-1 leading-relaxed">
              Iniciá sesión o creá tu identidad anónima para responder y aportar tus vivencias.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-1">
            <Link
              href="/login"
              className="rounded-xl border border-[#2A2930] bg-[#18181D] px-4 py-2 text-xs font-semibold text-[#F5F2F5] hover:bg-[#201F26] hover:border-[#383740] transition"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="rounded-xl bg-gradient-to-r from-[#852D4C] to-[#7553FF] px-4 py-2 text-xs font-semibold text-white shadow hover:from-[#9C3559] hover:to-[#8565FF] transition"
            >
              Crear cuenta anónima
            </Link>
          </div>
        </div>
      )}

      {/* Comment List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 space-y-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#852D4C] border-t-transparent" />
          <span className="text-xs text-[#AAA4B0]">Cargando conversación...</span>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-12 px-4 border border-dashed border-[#2A2930] bg-[#111114]/40 rounded-2xl space-y-2">
          <Feather className="h-8 w-8 mx-auto text-[#726D7A]" />
          <p className="text-sm font-semibold text-[#F5F2F5]">
            Aún no hay comentarios en esta publicación
          </p>
          <p className="text-xs text-[#AAA4B0] max-w-sm mx-auto">
            Sé la primera persona en compartir una perspectiva o vivencia con respeto y consentimiento.
          </p>
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
