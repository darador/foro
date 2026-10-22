'use server';

import {
  analyzeContentWithAi,
  authorizeModerationRecoveryCaller,
  recoverStuckPendingReviewContent,
} from '@/lib/services/moderation-ai';

export async function runAiContentModerationAction(params: {
  entityType: 'POST' | 'COMMENT';
  entityId: string;
  versionId?: string | null;
}) {
  if (
    !params ||
    (params.entityType !== 'POST' && params.entityType !== 'COMMENT') ||
    typeof params.entityId !== 'string' ||
    params.entityId.trim().length === 0
  ) {
    return { status: 'INVALID_PARAMS', result: null };
  }

  try {
    return await analyzeContentWithAi({
      entityType: params.entityType,
      entityId: params.entityId,
      versionId: params.versionId || null,
    });
  } catch (err: any) {
    console.error('Error running AI content moderation server action:', err);
    const errMsg = String(err?.message || '');
    if (!errMsg.includes('not found for AI analysis')) {
      try {
        await recoverStuckPendingReviewContent({
          entityType: params.entityType,
          entityId: params.entityId,
          staleMinutes: 0,
        });
      } catch (recoveryErr: any) {
        console.error('Error in fail-closed recovery after AI moderation failure:', recoveryErr);
      }
    }
    return { status: 'AI_UNAVAILABLE', result: null };
  }
}

export async function recoverStuckPendingReviewAction(params?: {
  entityType?: 'POST' | 'COMMENT';
  entityId?: string;
  staleMinutes?: number;
  limit?: number;
}) {
  const auth = await authorizeModerationRecoveryCaller();
  if (!auth.authorized) {
    return {
      status: auth.status,
      summary: null,
    };
  }

  const sanitizedEntityType =
    params?.entityType === 'POST' || params?.entityType === 'COMMENT'
      ? params.entityType
      : undefined;
  const sanitizedEntityId =
    typeof params?.entityId === 'string' && params.entityId.trim().length > 0
      ? params.entityId.trim()
      : undefined;

  // General sweeps (without a specific entityId) enforce at least 1 minute of staleness
  // to avoid racing with active creations whose AI analysis is still in flight.
  const minStaleMinutes = sanitizedEntityId ? 0 : 1;
  const requestedStale =
    typeof params?.staleMinutes === 'number' && !Number.isNaN(params.staleMinutes)
      ? params.staleMinutes
      : 2;
  const sanitizedStaleMinutes = Math.max(minStaleMinutes, requestedStale);

  const requestedLimit =
    typeof params?.limit === 'number' && !Number.isNaN(params.limit)
      ? params.limit
      : 50;
  const sanitizedLimit = Math.min(100, Math.max(1, Math.trunc(requestedLimit)));

  try {
    const summary = await recoverStuckPendingReviewContent({
      entityType: sanitizedEntityType,
      entityId: sanitizedEntityId,
      staleMinutes: sanitizedStaleMinutes,
      limit: sanitizedLimit,
    });
    return { status: 'RECOVERED', summary };
  } catch (err: any) {
    console.error('Error running stuck pending review recovery action:', err);
    return { status: 'ERROR', summary: null };
  }
}
