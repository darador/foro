'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin, Share2, Edit3, Trash2, Check, ArrowLeft, Clock } from 'lucide-react';
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

  const typeConfig = {
    EXPERIENCE: {
      label: 'Experiencia',
      badge: 'border-[var(--pink-primary)]/40 bg-[var(--pink-primary)]/10 text-[var(--pink-primary)]',
    },
    QUESTION: {
      label: 'Pregunta',
      badge: 'border-[var(--violet-primary)]/40 bg-[var(--violet-primary)]/10 text-[var(--violet-primary)]',
    },
    CONFESSION: {
      label: 'Confesión',
      badge: 'border-[var(--pink-dark)]/40 bg-[var(--pink-dark)]/10 text-[var(--pink-dark)]',
    },
  };

  const currentType = typeConfig[post.type] || typeConfig.EXPERIENCE;
  const authorInitial = post.author?.alias ? post.author.alias[0].toUpperCase() : 'A';

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
    <div className="space-y-8">
      {/* Top Navigation / Breadcrumb */}
      <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 hover:text-[var(--text-primary)] transition group"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
          <span>Volver al inicio</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href={`/explorar?categoria=${post.category.slug}`}
            className="text-[var(--pink-primary)] hover:underline transition font-semibold"
          >
            {post.category.name}
          </Link>
          <span className="text-[var(--border-color)]">/</span>
          <span className="text-[var(--text-muted)] truncate max-w-[200px]">{post.title}</span>
        </div>
      </div>

      {/* Main Publication Article */}
      <article className="relative overflow-hidden rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 sm:p-10 shadow-sm space-y-7 transition-colors duration-200">
        {/* Header Info Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-secondary)] border-b border-[var(--border-color)] pb-5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold tracking-wide ${currentType.badge}`}>
              {currentType.label}
            </span>
            <Link
              href={`/explorar?categoria=${post.category.slug}`}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-0.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--pink-primary)] transition"
            >
              {post.category.name}
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--pink-primary)] transition"
              title="Copiar enlace directo"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Share2 className="h-3.5 w-3.5" />}
              <span>{copied ? '¡Copiado!' : 'Compartir'}</span>
            </button>

            {isAuthor ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--pink-primary)] transition"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Editar</span>
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/20 transition disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Eliminar</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <ReportModal targetId={post.id} targetType="POST" user={user} />
                <BlockButton targetUserId={post.author_id} targetAlias={post.author.alias} user={user} />
              </div>
            )}
          </div>
        </div>

        {/* Author Card: Anonymous & Respectful */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-tr from-[var(--pink-primary)] to-[var(--violet-primary)] p-[2px]">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-[var(--bg-card)] text-sm font-bold text-[var(--text-primary)]">
                {authorInitial}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[var(--text-primary)] text-sm sm:text-base">@{post.author.alias}</span>
                <span className="rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-0.5 text-[10px] font-semibold tracking-wider text-[var(--text-secondary)] uppercase">
                  {post.author.profile_type}
                </span>
              </div>
              <div className="text-[11px] text-[var(--text-muted)] flex flex-wrap items-center gap-2 mt-0.5">
                <span>Miembro desde {formatDate(post.author.created_at)}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDate(post.created_at)}
                </span>
                {post.updated_at !== post.created_at && (
                  <span className="italic text-[var(--pink-primary)]">(Editado)</span>
                )}
              </div>
            </div>
          </div>

          {(post.province || post.city) && (
            <div className="flex items-center gap-1.5 text-[var(--text-secondary)] text-xs bg-[var(--bg-card)] px-3 py-1.5 rounded-xl border border-[var(--border-color)]">
              <MapPin className="h-3.5 w-3.5 text-[var(--pink-primary)]" />
              <span>{[post.city, post.province].filter(Boolean).join(', ')}</span>
            </div>
          )}
        </div>

        {/* Content or Edit Form */}
        {isEditing ? (
          <form onSubmit={handleEdit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                Título de la publicación
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--violet-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                Contenido
              </label>
              <textarea
                rows={10}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 text-sm text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--violet-primary)] leading-relaxed"
              />
            </div>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-gradient-to-r from-[var(--btn-gradient-from)] to-[var(--btn-gradient-to)] px-5 py-2 text-xs font-semibold text-white shadow hover:opacity-95 transition disabled:opacity-50"
              >
                {loading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6 pt-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[var(--text-primary)] leading-snug">
              {post.title}
            </h1>
            <div className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed whitespace-pre-line space-y-4 font-normal">
              {post.content}
            </div>
          </div>
        )}

        {/* Tags */}
        {post.post_tags && post.post_tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-4 border-t border-[var(--border-color)]">
            {post.post_tags.map(({ tag }) => (
              <Link
                key={tag.slug}
                href={`/t/${tag.slug}`}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--pink-primary)] transition bg-[var(--bg-secondary)] border border-[var(--border-color)] px-3 py-1 rounded-xl"
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        )}

        {/* Action Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-color)] pt-5">
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
      </article>

      {/* Comment Section */}
      <CommentSection postId={post.id} user={user} />
    </div>
  );
}
