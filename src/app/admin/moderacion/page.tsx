import { getModerationCases } from '@/lib/services/moderation';
import { ModerationQueueView } from '@/components/admin/ModerationQueueView';

export const metadata = {
  title: 'Moderación Base — Panel de Control',
};

export default async function ModerationQueuePage() {
  const { cases, total } = await getModerationCases({ limit: 50 });

  return <ModerationQueueView initialCases={cases} totalCases={total} />;
}
