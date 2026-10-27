'use client';

import { useState } from 'react';
import { Reply, Edit3, Trash2, Shield, CornerDownRight } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { CommentForm } from './CommentForm';
import { ReactionButton } from '@/components/common/ReactionButton';
import { ReportModal } from '@/components/common/ReportModal';
import { BlockButton } from '@/components/common/BlockButton';
import { updateComment, softDeleteComment, type CommentNode } from '@/lib/services/comments';

interface CommentItemProps {
  comment: CommentNode;
  user?: { id: string; email_verified?: boolean } | null;
  onCommentUpdated?: () => void;
}

export function CommentItem({ comment, user, onCommentUpdated }: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [loading, setLoading] = useState(false);
  const [isDeleted, setIsDeleted] = useState(comment.status === 'DELETED');

  const isAuthor = user?.id === comment.author_id;

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editContent.trim()) return;

    setLoading(true);
    try {
      await updateComment(comment.id, editContent.trim(), user.id);
      comment.content = editContent.trim();
      setIsEditing(false);
      if (onCommentUpdated) onCommentUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al editar comentario.';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    if (!window.confirm('¿Estás seguro de eliminar tu comentario?')) return;

    setLoading(true);
    try {
      await softDeleteComment(comment.id, user.id);
      setIsDeleted(true);
      if (onCommentUpdated) onCommentUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar comentario.';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  if (isDeleted) {
    return (
      <div className="rounded-xl border border-[#2A2930] bg-[#111114]/40 p-3 text-xs text-[#726D7A] italic">
        [Comentario eliminado por el autor]
      </div>
    );
  }

  const authorInitial = comment.author?.alias ? comment.author.alias[0].toUpperCase() : 'A';

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-[#2A2930] bg-[#18181D]/80 p-4 sm:p-5 space-y-3 shadow-sm hover:border-[#383740] transition">
        {/* Author Header */}
        <div className="flex items-center justify-between text-xs text-[#AAA4B0]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-[#571F35] to-[#7553FF] text-[10px] font-bold text-white">
              {authorInitial}
            </div>
            <span className="font-semibold text-[#F5F2F5]">@{comment.author.alias}</span>
            <span className="text-[#383740]">•</span>
            <span className="text-[#726D7A]">{formatDate(comment.created_at)}</span>
            {comment.updated_at !== comment.created_at && (
              <span className="text-[10px] text-[#852D4C] italic">(Editado)</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isAuthor ? (
              <>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-[#726D7A] hover:text-[#AAA4B0] transition p-1"
                  title="Editar"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="text-[#726D7A] hover:text-red-400 transition p-1"
                  title="Eliminar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <ReportModal targetId={comment.id} targetType="COMMENT" user={user} />
                <BlockButton targetUserId={comment.author_id} targetAlias={comment.author.alias} user={user} />
              </>
            )}
          </div>
        </div>

        {/* Content or Edit Form */}
        {isEditing ? (
          <form onSubmit={handleEdit} className="space-y-3 pt-1">
            <textarea
              rows={3}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full rounded-xl border border-[#2A2930] bg-[#111114] p-3 text-xs sm:text-sm text-[#F5F2F5] focus:border-[#7553FF] focus:outline-none focus:ring-1 focus:ring-[#7553FF]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-lg border border-[#2A2930] bg-[#111114] px-3 py-1.5 text-xs text-[#AAA4B0] hover:text-[#F5F2F5]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-gradient-to-r from-[#852D4C] to-[#7553FF] px-4 py-1.5 text-xs font-semibold text-white shadow"
              >
                Guardar
              </button>
            </div>
          </form>
        ) : (
          <p className="text-xs sm:text-sm text-[#D6D0DC] leading-relaxed whitespace-pre-line font-normal">
            {comment.content}
          </p>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3 pt-2.5 border-t border-[#2A2930]/60 text-xs">
          <ReactionButton targetId={comment.id} targetType="COMMENT" initialCount={0} user={user} />

          {/* Limit depth to 3 levels per Section 15 */}
          {comment.depth < 3 && user && (
            <button
              onClick={() => setIsReplying(!isReplying)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#AAA4B0] hover:text-[#967EFF] transition"
            >
              <Reply className="h-3.5 w-3.5" />
              <span>Responder</span>
            </button>
          )}
        </div>
      </div>

      {/* Reply Form */}
      {isReplying && (
        <div className="pl-4 sm:pl-6 border-l-2 border-[#852D4C]/50 pt-2">
          <CommentForm
            postId={comment.post_id}
            parentId={comment.id}
            user={user}
            placeholder={`Respondiendo a @${comment.author.alias}...`}
            onSuccess={() => {
              setIsReplying(false);
              if (onCommentUpdated) onCommentUpdated();
            }}
            onCancel={() => setIsReplying(false)}
          />
        </div>
      )}

      {/* Nested Replies (Depth 1 -> 2 -> 3) */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="pl-4 sm:pl-6 border-l-2 border-[#2A2930] space-y-3 pt-2">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              user={user}
              onCommentUpdated={onCommentUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
}
