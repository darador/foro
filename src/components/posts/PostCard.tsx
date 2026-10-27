'use client';

import Link from 'next/link';
import { MessageSquare, MapPin, ArrowRight, Sparkles } from 'lucide-react';
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
      badge: 'border-[#852D4C]/50 bg-[#571F35]/30 text-[#FFB6CF]',
    },
    QUESTION: {
      label: 'Pregunta',
      badge: 'border-[#7553FF]/40 bg-[#7553FF]/15 text-[#C4B5FD]',
    },
    CONFESSION: {
      label: 'Confesión',
      badge: 'border-[#9F1239]/50 bg-[#881337]/30 text-[#FECDD3]',
    },
  };

  const currentType = typeConfig[post.type] || typeConfig.EXPERIENCE;
  const authorInitial = post.author?.alias ? post.author.alias[0].toUpperCase() : 'A';

  return (
    <article className="group relative rounded-2xl border border-[#2A2930] bg-[#18181D]/75 p-5 sm:p-6 transition-all duration-200 hover:border-[#852D4C]/60 hover:bg-[#18181D] hover:shadow-[0_8px_30px_rgba(87,31,53,0.12)]">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs text-[#AAA4B0] mb-3.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Post Type Badge */}
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${currentType.badge}`}>
            {currentType.label}
          </span>

          {/* Category Pill */}
          <Link
            href={`/explorar?categoria=${post.category.slug}`}
            className="rounded-md border border-[#2A2930] bg-[#111114] px-2.5 py-0.5 text-[11px] font-medium text-[#AAA4B0] hover:text-[#F5F2F5] hover:border-[#383740] transition"
          >
            {post.category.name}
          </Link>

          <span className="text-[#383740]">•</span>

          {/* Author info */}
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-[#571F35] to-[#7553FF]/40 text-[10px] font-bold text-[#F5F2F5]">
              {authorInitial}
            </div>
            <span className="text-[#F5F2F5] font-medium">@{post.author.alias}</span>
          </div>

          <span className="text-[#383740]">•</span>
          <span className="text-[#726D7A]">{formatDate(post.created_at)}</span>
        </div>

        {(post.province || post.city) && (
          <span className="flex items-center gap-1 text-[11px] text-[#726D7A]">
            <MapPin className="h-3 w-3 text-[#571F35]" />
            {[post.city, post.province].filter(Boolean).join(', ')}
          </span>
        )}
      </div>

      {/* Title */}
      <Link href={`/p/${post.slug}`} className="block">
        <h2 className="text-base sm:text-lg font-semibold tracking-tight text-[#F5F2F5] group-hover:text-[#967EFF] transition-colors duration-150 line-clamp-2 leading-snug">
          {post.title}
        </h2>
      </Link>

      {/* Content Extract */}
      <p className="mt-2 text-xs sm:text-sm text-[#AAA4B0] line-clamp-3 leading-relaxed">
        {truncateText(post.content.replace(/<[^>]*>?/gm, ''), 220)}
      </p>

      {/* Tags */}
      {post.post_tags && post.post_tags.length > 0 && (
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {post.post_tags.map(({ tag }) => (
            <Link
              key={tag.slug}
              href={`/t/${tag.slug}`}
              className="text-[11px] text-[#AAA4B0] hover:text-[#967EFF] transition bg-[#111114] border border-[#2A2930] hover:border-[#383740] px-2 py-0.5 rounded-md"
            >
              #{tag.name}
            </Link>
          ))}
        </div>
      )}

      {/* Footer Metrics */}
      <div className="mt-4 flex items-center justify-between border-t border-[#2A2930]/80 pt-3.5 text-xs text-[#AAA4B0]">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-medium text-[#FFB6CF]">
            <span className="text-sm">🔥</span>
            <strong className="text-[#F5F2F5]">{post.reactions_count}</strong>
            <span className="hidden sm:inline text-[#AAA4B0]">Me interesa</span>
          </span>
          <Link
            href={`/p/${post.slug}#comentarios`}
            className="inline-flex items-center gap-1.5 text-[#AAA4B0] hover:text-[#F5F2F5] transition"
          >
            <MessageSquare className="h-3.5 w-3.5 text-[#726D7A]" />
            <strong className="text-[#F5F2F5]">{post.comments_count}</strong>
            <span className="hidden sm:inline">comentarios</span>
          </Link>
        </div>

        <Link
          href={`/p/${post.slug}`}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#967EFF] hover:text-[#B7A4FF] transition group-hover:translate-x-0.5 duration-150"
        >
          <span>Leer publicación</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </article>
  );
}
