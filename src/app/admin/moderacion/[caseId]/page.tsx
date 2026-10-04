import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getModerationCaseDetail } from '@/lib/services/moderation';
import { ModerationCaseDetailView } from '@/components/admin/ModerationCaseDetailView';

export const metadata = {
  title: 'Detalle de Caso de Moderación — Panel de Control',
};

interface CasePageProps {
  params: Promise<{
    caseId: string;
  }>;
}

export default async function ModerationCaseDetailPage({ params }: CasePageProps) {
  const { caseId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const currentUserId = user?.id || '';

  const detail = await getModerationCaseDetail(caseId);

  if (!detail) {
    notFound();
  }

  return <ModerationCaseDetailView currentUserId={currentUserId} detail={detail} />;
}
