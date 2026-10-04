'use client';

import Link from 'next/link';
import { MessageSquare, Flame, MapPin, Bookmark, ShieldCheck } from 'lucide-react';
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
  const typeLabels = {
    EXPERIENCE: { label: 'Experiencia', bg: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' },
    QUESTION: { label: 'Pregunta', bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
    CONFESSION: { label: 'Confesión', bg: 'bg-purple-500/10 text-purple-300 border-purple-500/20' },
  };

  const currentType = typeLabels[post.type] || typeLabels.EXPERIENCE;

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6 transition hover:border-zinc-700/80 hover:bg-zinc-900/60 shadow-sm">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${currentType.bg}`}>
            {currentType.label}
          </span>
          <Link
            href={`/explorar?categoria=${post.category.slug}`}
            className="rounded bg-zinc-800/80 px-2 py-0.5 font-medium text-zinc-300 hover:bg-zinc-700 transition"
          >
            {post.category.name}
          </Link>
          <span>•</span>
          <span className="text-zinc-300 font-medium">@{post.author.alias}</span>
          <span>•</span>
          <span>{formatDate(post.created_at)}</span>
        </div>

        {(post.province || post.city) && (
          <span className="flex items-center gap-1 text-[11px] text-zinc-500">
            <MapPin className="h-3 w-3" />
            {[post.city, post.province].filter(Boolean).join(', ')}
          </span>
        )}
      </div>

      {/* Title */}
      <Link href={`/p/${post.slug}`}>
        <h2 className="text-base sm:text-lg font-semibold text-zinc-100 hover:text-indigo-300 transition line-clamp-2">
          {post.title}
        </h2>
      </Link>

      {/* Extract */}
      <p className="mt-2 text-xs sm:text-sm text-zinc-400 line-clamp-3 leading-relaxed">
        {truncateText(post.content.replace(/<[^>]*>?/gm, ''), 220)}
      </p>

      {/* Tags */}
      {post.post_tags && post.post_tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {post.post_tags.map(({ tag }) => (
            <Link
              key={tag.slug}
              href={`/t/${tag.slug}`}
              className="text-[11px] text-zinc-400 hover:text-indigo-300 transition bg-zinc-950/60 border border-zinc-800/80 px-2 py-0.5 rounded"
            >
              #{tag.name}
            </Link>
          ))}
        </div>
      )}

      {/* Footer Metrics */}
      <div className="mt-4 flex items-center justify-between border-t border-zinc-800/60 pt-3 text-xs text-zinc-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 font-medium text-amber-400/90">
            🔥 <strong className="text-zinc-200">{post.reactions_count}</strong> Me interesa
          </span>
          <Link href={`/p/${post.slug}#comentarios`} className="flex items-center gap-1 hover:text-zinc-200 transition">
            <MessageSquare className="h-3.5 w-3.5 text-zinc-500" />
            <strong className="text-zinc-200">{post.comments_count}</strong> comentarios
          </Link>
        </div>

        <Link
          href={`/p/${post.slug}`}
          className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition"
        >
          Leer publicación →
        </Link>
      </div>
    </article>
  );
}
