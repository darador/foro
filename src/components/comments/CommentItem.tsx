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
      <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-3 text-xs text-zinc-600 italic">
        [Comentario eliminado por el autor]
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-2">
        {/* Author Header */}
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-200">@{comment.author.alias}</span>
            <span>•</span>
            <span className="text-zinc-500">{formatDate(comment.created_at)}</span>
            {comment.updated_at !== comment.created_at && (
              <span className="text-[10px] text-zinc-500 italic">(Editado)</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isAuthor ? (
              <>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-zinc-500 hover:text-zinc-300 transition"
                  title="Editar"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="text-zinc-500 hover:text-red-400 transition"
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
          <form onSubmit={handleEdit} className="space-y-2 pt-1">
            <textarea
              rows={2}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded border border-zinc-800 px-2 py-1 text-xs text-zinc-400"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white"
              >
                Guardar
              </button>
            </div>
          </form>
        ) : (
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
            {comment.content}
          </p>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3 pt-2 border-t border-zinc-800/40 text-xs">
          <ReactionButton targetId={comment.id} targetType="COMMENT" initialCount={0} user={user} />

          {/* Limit depth to 3 levels per Section 15 */}
          {comment.depth < 3 && user && (
            <button
              onClick={() => setIsReplying(!isReplying)}
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition"
            >
              <Reply className="h-3.5 w-3.5" />
              <span>Responder</span>
            </button>
          )}
        </div>
      </div>

      {/* Reply Form */}
      {isReplying && (
        <div className="pl-4 sm:pl-6 border-l-2 border-indigo-500/40 pt-2">
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
        <div className="pl-4 sm:pl-6 border-l-2 border-zinc-800/60 space-y-3 pt-2">
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
