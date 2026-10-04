'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin, Calendar, Share2, Edit3, Trash2, Check } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { ReactionButton } from '@/components/common/ReactionButton';
import { SaveButton } from '@/components/common/SaveButton';
import { FollowButton } from '@/components/common/FollowButton';
import { ReportModal } from '@/components/common/ReportModal';
import { BlockButton } from '@/components/common/BlockButton';
import { CommentSection } from '@/components/comments/CommentSection';
import { softDeletePost, updatePost } from '@/lib/services/client/posts';

interface PostDetailProps {
  post: {
    id: string;
    title: string;
    slug: string;
    content: string;
    type: 'EXPERIENCE' | 'QUESTION' | 'CONFESSION';
    province?: string | null;
    city?: string | null;
    created_at: string;
    updated_at: string;
    reactions_count: number;
    comments_count: number;
    author_id: string;
    author: {
      id: string;
      alias: string;
      profile_type: string;
      badges?: string[];
      created_at: string;
    };
    category: {
      id: string;
      name: string;
      slug: string;
    };
    post_tags?: Array<{
      tag: {
        name: string;
        slug: string;
      };
    }>;
  };
  user?: { id: string; email_verified?: boolean } | null;
}

export function PostDetail({ post, user }: PostDetailProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editContent, setEditContent] = useState(post.content);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const isAuthor = user?.id === post.author_id;

  const typeLabels = {
    EXPERIENCE: { label: 'Experiencia', bg: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' },
    QUESTION: { label: 'Pregunta', bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
    CONFESSION: { label: 'Confesión', bg: 'bg-purple-500/10 text-purple-300 border-purple-500/20' },
  };

  const currentType = typeLabels[post.type] || typeLabels.EXPERIENCE;

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editTitle.trim() || !editContent.trim()) return;

    setLoading(true);
    try {
      await updatePost(post.id, { title: editTitle, content: editContent }, user.id);
      post.title = editTitle.trim();
      post.content = editContent.trim();
      setIsEditing(false);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar la publicación.';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    if (!window.confirm('¿Estás seguro de eliminar esta publicación?')) return;

    setLoading(true);
    try {
      await softDeletePost(post.id, user.id);
      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar la publicación.';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className="space-y-6">
      {/* Header Info */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400 border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded-full border px-3 py-0.5 font-medium ${currentType.bg}`}>
              {currentType.label}
            </span>
            <Link
              href={`/explorar?categoria=${post.category.slug}`}
              className="rounded bg-zinc-800 px-2.5 py-0.5 font-medium text-zinc-300 hover:bg-zinc-700 transition"
            >
              {post.category.name}
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition"
              title="Copiar enlace público"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
              <span>{copied ? '¡Copiado!' : 'Compartir'}</span>
            </button>

            {isAuthor ? (
              <>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Editar</span>
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="inline-flex items-center gap-1 text-zinc-400 hover:text-red-400 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Eliminar</span>
                </button>
              </>
            ) : (
              <>
                <ReportModal targetId={post.id} targetType="POST" user={user} />
                <BlockButton targetUserId={post.author_id} targetAlias={post.author.alias} user={user} />
              </>
            )}
          </div>
        </div>

        {/* Author Card */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-indigo-400 font-bold text-sm">
              @{post.author.alias[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-200 text-sm">@{post.author.alias}</span>
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                  {post.author.profile_type}
                </span>
              </div>
              <div className="text-[11px] text-zinc-500 flex items-center gap-3 mt-0.5">
                <span>Miembro desde {formatDate(post.author.created_at)}</span>
                <span>•</span>
                <span>Publicado {formatDate(post.created_at)}</span>
                {post.updated_at !== post.created_at && (
                  <span className="italic text-zinc-500">(Editado)</span>
                )}
              </div>
            </div>
          </div>

          {(post.province || post.city) && (
            <div className="flex items-center gap-1 text-zinc-400 text-xs">
              <MapPin className="h-3.5 w-3.5 text-zinc-500" />
              {[post.city, post.province].filter(Boolean).join(', ')}
            </div>
          )}
        </div>

        {/* Content or Edit Form */}
        {isEditing ? (
          <form onSubmit={handleEdit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Título</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Contenido</label>
              <textarea
                rows={8}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-lg border border-zinc-800 px-4 py-1.5 text-xs text-zinc-400"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white shadow"
              >
                Guardar cambios
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 pt-2">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 leading-tight">
              {post.title}
            </h1>
            <div className="prose prose-invert max-w-none text-sm sm:text-base text-zinc-300 leading-relaxed whitespace-pre-line">
              {post.content}
            </div>
          </div>
        )}

        {/* Tags */}
        {post.post_tags && post.post_tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-4 border-t border-zinc-800/80">
            {post.post_tags.map(({ tag }) => (
              <Link
                key={tag.slug}
                href={`/t/${tag.slug}`}
                className="text-xs text-zinc-400 hover:text-indigo-300 transition bg-zinc-950 border border-zinc-800 px-2.5 py-1 rounded-md"
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        )}

        {/* Action Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
          <ReactionButton
            targetId={post.id}
            targetType="POST"
            initialCount={post.reactions_count}
            user={user}
          />

          <div className="flex items-center gap-2">
            <SaveButton postId={post.id} user={user} />
            <FollowButton postId={post.id} user={user} />
          </div>
        </div>
      </div>

      {/* Comment Section */}
      <CommentSection postId={post.id} user={user} />
    </article>
  );
}
