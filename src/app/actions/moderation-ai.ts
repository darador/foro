'use server';

import { analyzeContentWithAi } from '@/lib/services/moderation-ai';

export async function runAiContentModerationAction(params: {
  entityType: 'POST' | 'COMMENT';
  entityId: string;
  title?: string | null;
  content: string;
  versionId?: string | null;
}) {
  try {
    return await analyzeContentWithAi(params);
  } catch (err: any) {
    console.error('Error running AI content moderation server action:', err);
    return { status: 'AI_UNAVAILABLE', result: null };
  }
}
