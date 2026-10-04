import { notFound } from 'next/navigation';
import { User, Calendar, MapPin, Award, MessageSquare, Heart, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getRequestStatusBetweenUsers } from '@/lib/services/messaging';
import { SendMessageButton } from '@/components/messaging/SendMessageButton';
import { formatDate } from '@/lib/utils';

interface PublicProfilePageProps {
  params: Promise<{ alias: string }>;
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const resolvedParams = await params;
  let rawAlias = resolvedParams.alias;

  try {
    rawAlias = decodeURIComponent(rawAlias);
  } catch {
    // Ignore decode error
  }

  const cleanAlias = rawAlias.trim().replace(/^@+/, '');

  if (!cleanAlias) {
    notFound();
  }

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      id,
      alias,
      avatar_url,
      profile_type,
      description,
      province,
      city,
      badges,
      experiences_count,
      comments_count,
      reactions_received,
      created_at
    `)
    .ilike('alias', cleanAlias)
    .single();

  if (!profile) {
    notFound();
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(authUser);

  // Fetch messaging relationship status
  const { status: relationStatus } = await getRequestStatusBetweenUsers(profile.id);

  const profileTypeLabel =
    profile.profile_type === 'COUPLE'
      ? 'Pareja'
      : profile.profile_type === 'GROUP'
      ? 'Grupo'
      : 'Individual';

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
      {/* Profile Card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800 text-indigo-400 border border-zinc-700 font-semibold overflow-hidden">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={profile.alias}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-8 w-8" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-zinc-100">@{profile.alias}</h1>
                <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-medium text-indigo-300 border border-indigo-500/20">
                  {profileTypeLabel}
                </span>
              </div>

              <p className="text-xs text-zinc-400 flex flex-wrap items-center gap-3 mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-zinc-500" /> Miembro desde{' '}
                  {formatDate(profile.created_at)}
                </span>
                {(profile.city || profile.province) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                    {[profile.city, profile.province].filter(Boolean).join(', ')}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Action Control: Send Message Button */}
          <div>
            <SendMessageButton
              targetUserId={profile.id}
              targetAlias={profile.alias}
              initialRelationStatus={relationStatus}
              isAuthenticated={isAuthenticated}
            />
          </div>
        </div>

        {/* Bio */}
        {profile.description && (
          <div className="text-sm text-zinc-300 border-t border-zinc-800/80 pt-4 leading-relaxed">
            <p className="italic">"{profile.description}"</p>
          </div>
        )}

        {/* Badges */}
        {profile.badges && profile.badges.length > 0 && (
          <div className="border-t border-zinc-800/80 pt-4 space-y-2">
            <h3 className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
              <Award className="h-4 w-4 text-amber-400" /> Insignias y reconocimientos
            </h3>
            <div className="flex flex-wrap gap-2">
              {profile.badges.map((badge, idx) => (
                <span
                  key={idx}
                  className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Activity Counters */}
        <div className="grid grid-cols-3 gap-3 border-t border-zinc-800/80 pt-4 text-center">
          <div className="rounded-lg bg-zinc-950/40 p-3 border border-zinc-800/60 space-y-1">
            <div className="flex items-center justify-center gap-1 text-sm font-bold text-zinc-100">
              <FileText className="h-4 w-4 text-indigo-400" />
              {profile.experiences_count}
            </div>
            <div className="text-[11px] text-zinc-400">Publicaciones</div>
          </div>

          <div className="rounded-lg bg-zinc-950/40 p-3 border border-zinc-800/60 space-y-1">
            <div className="flex items-center justify-center gap-1 text-sm font-bold text-zinc-100">
              <MessageSquare className="h-4 w-4 text-purple-400" />
              {profile.comments_count}
            </div>
            <div className="text-[11px] text-zinc-400">Comentarios</div>
          </div>

          <div className="rounded-lg bg-zinc-950/40 p-3 border border-zinc-800/60 space-y-1">
            <div className="flex items-center justify-center gap-1 text-sm font-bold text-zinc-100">
              <Heart className="h-4 w-4 text-rose-400" />
              {profile.reactions_received}
            </div>
            <div className="text-[11px] text-zinc-400">Reacciones</div>
          </div>
        </div>
      </div>
    </div>
  );
}
