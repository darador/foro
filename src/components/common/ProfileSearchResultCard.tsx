import Link from 'next/link';
import { User, MapPin, Award, Heart, MessageSquare } from 'lucide-react';
import type { PublicProfileSearchResult } from '@/lib/services/search';

interface ProfileSearchResultCardProps {
  profile: PublicProfileSearchResult;
}

export function ProfileSearchResultCard({ profile }: ProfileSearchResultCardProps) {
  const profileTypeLabel =
    profile.profile_type === 'COUPLE'
      ? 'Pareja'
      : profile.profile_type === 'GROUP'
      ? 'Grupo'
      : 'Individual';

  const profileTypeBadgeColor =
    profile.profile_type === 'COUPLE'
      ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      : profile.profile_type === 'GROUP'
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';

  return (
    <div className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition hover:border-zinc-700 hover:bg-zinc-900/90 shadow-sm">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-indigo-400 overflow-hidden font-semibold">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={profile.alias}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-5 w-5" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/perfil/${encodeURIComponent(profile.alias)}`}
                  className="text-sm font-semibold text-zinc-100 hover:text-indigo-400 hover:underline transition"
                >
                  @{profile.alias}
                </Link>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${profileTypeBadgeColor}`}
                >
                  {profileTypeLabel}
                </span>
              </div>

              {(profile.province || profile.city) && (
                <p className="flex items-center gap-1 text-[11px] text-zinc-400 mt-0.5">
                  <MapPin className="h-3 w-3 text-zinc-500" />
                  {[profile.city, profile.province].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>

        {profile.description && (
          <p className="text-xs text-zinc-300 line-clamp-2 italic">
            "{profile.description}"
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-zinc-800/80 pt-3 text-[11px] text-zinc-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3 text-zinc-500" />
            {profile.experiences_count} pub
          </span>
          <span className="flex items-center gap-1">
            <Heart className="h-3 w-3 text-rose-500/70" />
            {profile.reactions_received} reacc
          </span>
        </div>

        {profile.badges && profile.badges.length > 0 && (
          <div className="flex items-center gap-1 text-amber-400" title={profile.badges.join(', ')}>
            <Award className="h-3.5 w-3.5" />
            <span>{profile.badges.length}</span>
          </div>
        )}
      </div>
    </div>
  );
}
