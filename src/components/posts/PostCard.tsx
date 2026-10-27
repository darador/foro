'use client';

import Link from 'next/link';
import { MessageSquare, MapPin, ArrowRight } from 'lucide-react';
import { formatDate, truncateText } from '@/lib/utils';

interface PostCardProps {
  post: {
    id: string;
    title: string;
    slug: string;
    content: string;
    type: 'EXPERIENCE' | 'QUESTION' | 'CONFESSION';
    province?: string | null;
    city?: string | null;
    created_at: string;
    reactions_count: number;
    comments_count: number;
    author: {
      id: string;
      alias: string;
      profile_type: string;
      badges?: string[];
    };
    category: {
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
}

export function PostCard({ post }: PostCardProps) {
  const typeConfig = {
    EXPERIENCE: {
      label: 'Experiencia',
      badge: 'border-[var(--pink-primary)]/30 bg-[var(--badge-bg)] text-[var(--pink-primary)]',
    },
    QUESTION: {
      label: 'Pregunta',
      badge: 'border-[var(--violet-primary)]/30 bg-[var(--selection-bg)] text-[var(--violet-primary)]',
    },
    CONFESSION: {
      label: 'Confesión',
      badge: 'border-[var(--pink-dark)]/30 bg-[var(--badge-bg)] text-[var(--pink-dark)]',
    },
  };

  const currentType = typeConfig[post.type] || typeConfig.EXPERIENCE;
  const authorInitial = post.author?.alias ? post.author.alias[0].toUpperCase() : 'A';

  return (
    <article className="group relative rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 sm:p-5 transition-all duration-200 hover:border-[var(--pink-primary)] shadow-[var(--card-shadow)]">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs text-[var(--text-secondary)] mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Post Type Badge */}
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${currentType.badge}`}>
            {currentType.label}
          </span>

          {/* Category Pill */}
          <Link
            href={`/explorar?categoria=${post.category.slug}`}
            className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--pink-primary)] transition"
          >
            {post.category.name}
          </Link>

          <span className="text-[var(--border-color)]">•</span>

          {/* Author info */}
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-[var(--pink-primary)] to-[var(--violet-primary)] text-[10px] font-bold text-white">
              {authorInitial}
            </div>
            <span className="text-[var(--text-primary)] font-semibold">@{post.author.alias}</span>
          </div>

          <span className="text-[var(--border-color)]">•</span>
          <span className="text-[var(--text-muted)]">{formatDate(post.created_at)}</span>
        </div>

        {(post.province || post.city) && (
          <span className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
            <MapPin className="h-3 w-3 text-[var(--pink-primary)]" />
            {[post.city, post.province].filter(Boolean).join(', ')}
          </span>
        )}
      </div>

      {/* Title */}
      <Link href={`/p/${post.slug}`} className="block">
        <h2 className="text-base sm:text-lg font-bold tracking-tight text-[var(--text-primary)] group-hover:text-[var(--pink-primary)] transition-colors duration-150 line-clamp-2 leading-snug">
          {post.title}
        </h2>
      </Link>

      {/* Content Extract */}
      <p className="mt-2 text-xs sm:text-sm text-[var(--text-secondary)] line-clamp-3 leading-relaxed">
        {truncateText(post.content.replace(/<[^>]*>?/gm, ''), 220)}
      </p>

      {/* Tags */}
      {post.post_tags && post.post_tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {post.post_tags.map(({ tag }) => (
            <Link
              key={tag.slug}
              href={`/t/${tag.slug}`}
              className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--pink-primary)] transition bg-[var(--bg-secondary)] border border-[var(--border-color)] px-2.5 py-0.5 rounded-md"
            >
              #{tag.name}
            </Link>
          ))}
        </div>
      )}

      {/* Footer Metrics */}
      <div className="mt-4 flex items-center justify-between border-t border-[var(--border-color)] pt-3 text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-medium text-[var(--pink-primary)]">
            <span className="text-sm">🔥</span>
            <strong className="text-[var(--text-primary)]">{post.reactions_count}</strong>
            <span className="hidden sm:inline text-[var(--text-secondary)]">Me interesa</span>
          </span>
          <Link
            href={`/p/${post.slug}#comentarios`}
            className="inline-flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
          >
            <MessageSquare className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <strong className="text-[var(--text-primary)]">{post.comments_count}</strong>
            <span className="hidden sm:inline">comentarios</span>
          </Link>
        </div>

        <Link
          href={`/p/${post.slug}`}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--pink-primary)] hover:underline transition group-hover:translate-x-0.5 duration-150"
        >
          <span>Leer publicación</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </article>
  );
}
