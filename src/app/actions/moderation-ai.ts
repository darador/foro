'use server';

import { analyzeContentWithAi } from '@/lib/services/moderation-ai';

export async function runAiContentModerationAction(params: {
  entityType: 'POST' | 'COMMENT';
  entityId: string;
  versionId?: string | null;
}) {
  try {
    return await analyzeContentWithAi({
      entityType: params.entityType,
      entityId: params.entityId,
      versionId: params.versionId || null,
    });
  } catch (err: any) {
    console.error('Error running AI content moderation server action:', err);
    return { status: 'AI_UNAVAILABLE', result: null };
  }
}
