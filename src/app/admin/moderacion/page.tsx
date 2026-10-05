import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getModerationCases } from '@/lib/services/moderation';
import { ModerationQueueView } from '@/components/admin/ModerationQueueView';

export const metadata = {
  title: 'Moderación Base — Panel de Control',
};

export default async function ModerationQueuePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: isMod } = await supabase.rpc('is_moderator', { target_user_id: user.id });
  if (!isMod) {
    notFound();
  }

  const { cases, total } = await getModerationCases({ limit: 50, currentUserId: user.id });

  return <ModerationQueueView initialCases={cases} totalCases={total} currentUserId={user.id} />;
}
