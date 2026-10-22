import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

export const ALLOWED_AI_FLAGS = [
  'POSSIBLE_MINOR',
  'NON_CONSENSUAL_CONTENT',
  'PERSONAL_DATA',
  'THREAT',
  'EXTORTION',
  'HARASSMENT',
  'SPAM',
  'SEXUAL_CONTENT',
  'COERCION',
  'OTHER',
  'AI_UNAVAILABLE',
] as const;

export const ModerationAiFlagSchema = z.enum(ALLOWED_AI_FLAGS);
export type ModerationAiFlag = z.infer<typeof ModerationAiFlagSchema>;

export const ModerationAiResponseSchema = z
  .object({
    risk_level: z.enum(['LOW', 'REVIEW', 'CRITICAL']),
    flags: z.array(ModerationAiFlagSchema).default([]),
    confidence: z.number().min(0).max(1),
    reason: z.string().min(1).max(500),
  })
  .refine(
    (data) => {
      // Inconsistency check: LOW risk cannot contain critical violation flags
      if (data.risk_level === 'LOW') {
        const hasCriticalFlag = data.flags.some((f) =>
          ['POSSIBLE_MINOR', 'NON_CONSENSUAL_CONTENT', 'EXTORTION'].includes(f)
        );
        if (hasCriticalFlag) return false;
      }
      return true;
    },
    { message: 'Inconsistent AI classification: LOW risk level cannot include critical violation flags' }
  );

export type ModerationAiResponse = z.infer<typeof ModerationAiResponseSchema>;

export interface AnalyzeContentParams {
  entityType: 'POST' | 'COMMENT';
  entityId: string;
  versionId?: string | null;
}

export function buildSystemPrompt(): string {
  return `Eres un clasificador auxiliar de moderación para ForoFetiche, una comunidad adulta hispanohablante.

REGLAS DE CLASIFICACIÓN:
1. PERMITIDO (LOW):
   - Contenido sexual adulto consensuado: BDSM, swinger, trios, fetiches, confesiones, preguntas, opiniones, conversatorios sobre límites y consentimiento.
   - El sexo o lenguaje explícito entre adultos consensuados NO es una infracción ni genera flag de riesgo por sí solo.

2. REVISIÓN HUMANA (REVIEW):
   - Posible exposición no autorizada de datos personales (teléfonos, DNI, direcciones).
   - Acoso o lenguaje coercitivo ambiguo.
   - Amenazas dudosas o contexto sexual no claro.

3. RIESGO MÁXIMO (CRITICAL):
   - Posibles menores de edad (grooming, contenido o insinuaciones involucrando menores).
   - Contenido íntimo no consentido (porno venganza, filtración sin consentimiento).
   - Amenazas graves de violencia física o extorsión.

INSTRUCCIONES CLAVE:
- No inferir edad únicamente por apariencia, tono o estilo de escritura.
- No clasificar como CRITICAL únicamente porque el contenido sea sexual.
- Si existe duda razonable, utiliza REVIEW.
- La IA es una señal de asistencia para moderadores humanos, no un juez final.

Responde ÚNICAMENTE con un JSON válido con este esquema exacto:
{
  "risk_level": "LOW" | "REVIEW" | "CRITICAL",
  "flags": ["POSSIBLE_MINOR", "NON_CONSENSUAL_CONTENT", "PERSONAL_DATA", "THREAT", "EXTORTION", "HARASSMENT", "SPAM", "SEXUAL_CONTENT", "COERCION", "OTHER"],
  "confidence": 0.0 a 1.0,
  "reason": "Explicación breve y concisa"
}`;
}

/**
 * Helper to query single source of truth system_config table for MODERATION_AI_ENABLED.
 * MANDATORY FAIL-SAFE RULE: Defaults to true if setting key is missing or error reading system_config.
 */
export async function isModerationAiEnabled(supabaseClient?: any): Promise<boolean> {
  const supabase = supabaseClient || createAdminClient();
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'MODERATION_AI_ENABLED')
      .maybeSingle();

    if (error || !data || data.value === undefined || data.value === null) {
      // FAIL-SAFE: Default to true to prevent moderation bypass
      return true;
    }

    return data.value === 'true';
  } catch {
    // FAIL-SAFE: Default to true on error
    return true;
  }
}

export async function analyzeContentWithAi(params: AnalyzeContentParams) {
  const supabase = createAdminClient();

  const isEnabled = await isModerationAiEnabled(supabase);
  const modelName = process.env.MODERATION_AI_MODEL || 'foro-ai-v1';

  // 1. Fetch real content from server database (never trust client-supplied text/title)
  let title: string | null = null;
  let content = '';
  let entityUpdatedAt: string | null = null;

  if (params.entityType === 'POST') {
    const { data: post, error: postErr } = await supabase
      .from('posts')
      .select('id, title, content, status, updated_at')
      .eq('id', params.entityId)
      .maybeSingle();

    if (postErr || !post) {
      throw new Error(`Target post not found for AI analysis: ${params.entityId}`);
    }
    title = post.title;
    content = post.content;
    entityUpdatedAt = post.updated_at || null;
  } else if (params.entityType === 'COMMENT') {
    const { data: comment, error: commErr } = await supabase
      .from('comments')
      .select('id, content, status, updated_at')
      .eq('id', params.entityId)
      .maybeSingle();

    if (commErr || !comment) {
      throw new Error(`Target comment not found for AI analysis: ${params.entityId}`);
    }
    content = comment.content;
    entityUpdatedAt = comment.updated_at || null;
  }

  // 2. Real Database Idempotency Check: Don't analyze exact same version or unmodified creation twice
  if (params.versionId) {
    const { data: existing } = await supabase
      .from('moderation_ai_results')
      .select('id, case_id, risk_level, flags, confidence, reason, created_at')
      .eq('entity_type', params.entityType)
      .eq('entity_id', params.entityId)
      .eq('content_version_id', params.versionId)
      .maybeSingle();

    if (existing) {
      return { status: 'CACHED', result: existing };
    }
  } else {
    const { data: existingInitial } = await supabase
      .from('moderation_ai_results')
      .select('id, case_id, risk_level, flags, confidence, reason, created_at')
      .eq('entity_type', params.entityType)
      .eq('entity_id', params.entityId)
      .is('content_version_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (
      existingInitial &&
      (!entityUpdatedAt ||
        !existingInitial.created_at ||
        new Date(existingInitial.created_at).getTime() >= new Date(entityUpdatedAt).getTime())
    ) {
      return { status: 'CACHED', result: existingInitial };
    }
  }

  // 3. Disabled Fallback: If AI is disabled in system_config, return cleanly
  if (!isEnabled) {
    return { status: 'DISABLED', result: null };
  }

  let classification: ModerationAiResponse;

  try {
    // Call provider abstraction (No silent fallback to mock in production!)
    const rawProviderResponse = await callAiProvider({
      title,
      content,
      entityType: params.entityType,
    });

    // Strict Zod schema & business consistency validation
    const parsed = ModerationAiResponseSchema.safeParse(rawProviderResponse);
    if (!parsed.success) {
      console.error('AI response Zod schema validation failed:', parsed.error.format());
      throw new Error('AI response schema validation failed');
    }

    classification = parsed.data;
  } catch (err: any) {
    console.error('AI Moderation provider error or fail-safe triggered:', err.message);
    // MANDATORY FAIL-SAFE RULE: Provider error = REVIEW + AI_UNAVAILABLE + confidence 0
    classification = {
      risk_level: 'REVIEW',
      flags: ['AI_UNAVAILABLE'],
      confidence: 0,
      reason: 'Análisis automático no disponible o falló. Enviado a revisión humana preventivamente.',
    };
  }

  // 4. Record result in database via atomic RPC (executed server-side)
  const { data: aiResultId, error: rpcError } = await supabase.rpc('record_ai_moderation_result', {
    entity_type_param: params.entityType,
    entity_id_param: params.entityId,
    content_version_id_param: params.versionId || null,
    model_param: modelName,
    risk_level_param: classification.risk_level,
    flags_param: classification.flags,
    confidence_param: classification.confidence,
    reason_param: classification.reason,
  });

  if (rpcError) {
    console.error('Error recording AI moderation result RPC:', rpcError);
    throw new Error(`Failed to record AI result: ${rpcError.message}`);
  }

  // 5. Update post/comment status based on risk_level
  if (classification.risk_level === 'LOW') {
    if (params.entityType === 'POST') {
      await supabase
        .from('posts')
        .update({ status: 'PUBLISHED', updated_at: new Date().toISOString() })
        .eq('id', params.entityId)
        .eq('status', 'PENDING_REVIEW');
    } else if (params.entityType === 'COMMENT') {
      await supabase
        .from('comments')
        .update({ status: 'PUBLISHED', updated_at: new Date().toISOString() })
        .eq('id', params.entityId)
        .eq('status', 'PENDING_REVIEW');
    }
  } else if (classification.risk_level === 'CRITICAL') {
    if (params.entityType === 'POST') {
      await supabase
        .from('posts')
        .update({ status: 'HIDDEN', updated_at: new Date().toISOString() })
        .eq('id', params.entityId)
        .in('status', ['PUBLISHED', 'PENDING_REVIEW', 'DRAFT']);
    } else if (params.entityType === 'COMMENT') {
      await supabase
        .from('comments')
        .update({ status: 'HIDDEN', updated_at: new Date().toISOString() })
        .eq('id', params.entityId)
        .in('status', ['PUBLISHED', 'PENDING_REVIEW']);
    }
  }

  return {
    status: classification.flags.includes('AI_UNAVAILABLE') ? 'AI_UNAVAILABLE' : 'SUCCESS',
    aiResultId,
    classification,
  };
}

/**
 * Provider Call Abstraction
 */
async function callAiProvider(input: {
  title?: string | null;
  content: string;
  entityType: 'POST' | 'COMMENT';
}): Promise<any> {
  const provider = process.env.MODERATION_AI_PROVIDER;
  const apiKey = process.env.MODERATION_AI_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;

  // Use mock ONLY in test or explicit mock environment
  if (provider === 'mock' || process.env.NODE_ENV === 'test') {
    return mockClassifierLogic(input);
  }

  // If no API key configured in production when AI is enabled -> Throw error to trigger FAIL-SAFE
  if (!apiKey) {
    throw new Error('AI API Key is missing for production provider');
  }

  const textToAnalyze = input.title ? `${input.title}\n\n${input.content}` : input.content;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.MODERATION_AI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: textToAnalyze },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    throw new Error(`Provider HTTP error ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  const contentStr = data.choices?.[0]?.message?.content;
  if (!contentStr) {
    throw new Error('Empty response content from provider');
  }

  return JSON.parse(contentStr);
}

/**
 * Deterministic Mock Classifier for development and test suites only
 */
export function mockClassifierLogic(input: {
  title?: string | null;
  content: string;
  entityType: 'POST' | 'COMMENT';
}): ModerationAiResponse {
  const fullText = (input.title ? `${input.title} ${input.content}` : input.content).toLowerCase();

  if (
    fullText.includes('menor') ||
    fullText.includes('nube') ||
    fullText.includes('cp') ||
    fullText.includes('filtrado sin permiso') ||
    fullText.includes('amenaza de muerte')
  ) {
    return {
      risk_level: 'CRITICAL',
      flags: ['POSSIBLE_MINOR', 'NON_CONSENSUAL_CONTENT'],
      confidence: 0.95,
      reason: 'Se detectaron palabras clave de alto riesgo de seguridad.',
    };
  }

  if (
    fullText.includes('telefono') ||
    fullText.includes('dni') ||
    fullText.includes('direccion') ||
    fullText.includes('acoso')
  ) {
    return {
      risk_level: 'REVIEW',
      flags: ['PERSONAL_DATA', 'HARASSMENT'],
      confidence: 0.85,
      reason: 'Se detectaron posibles datos personales o señales de acoso.',
    };
  }

  return {
    risk_level: 'LOW',
    flags: fullText.includes('bdsm') || fullText.includes('swinger') || fullText.includes('fetiche') ? ['SEXUAL_CONTENT'] : [],
    confidence: 0.9,
    reason: 'Contenido dentro de los parámetros permitidos de la comunidad.',
  };
}

export interface RecoverStuckPendingReviewOptions {
  entityType?: 'POST' | 'COMMENT';
  entityId?: string;
  staleMinutes?: number;
  limit?: number;
  supabaseClient?: any;
}

export interface RecoverStuckPendingReviewSummary {
  scannedPosts: number;
  scannedComments: number;
  recoveredPostIds: string[];
  recoveredCommentIds: string[];
  skippedAlreadyQueuedIds: string[];
  errors: Array<{ entityType: 'POST' | 'COMMENT'; entityId: string; error: string }>;
}

export interface ModerationRecoveryAuthorizationResult {
  authorized: boolean;
  status: 'AUTHORIZED' | 'UNAUTHORIZED' | 'FORBIDDEN';
  userId: string | null;
}

/**
 * Verifies that a Server Action caller requesting manual/general recovery of
 * PENDING_REVIEW content is an authenticated moderator or administrator.
 *
 * - Anonymous callers (no user session) -> UNAUTHORIZED (fail-closed)
 * - Authenticated users without moderator/admin privileges -> FORBIDDEN (fail-closed)
 * - Authenticated moderators or administrators -> AUTHORIZED
 */
export async function authorizeModerationRecoveryCaller(
  serverSupabaseClient?: any
): Promise<ModerationRecoveryAuthorizationResult> {
  try {
    const supabase =
      serverSupabaseClient ||
      (await (await import('@/lib/supabase/server')).createClient());

    const { data: authData, error: authError } = await supabase.auth.getUser();
    const userId = authData?.user?.id || null;

    if (authError || !userId) {
      return {
        authorized: false,
        status: 'UNAUTHORIZED',
        userId: null,
      };
    }

    let isModerator = false;
    let isAdmin = false;

    try {
      const { data: modResult, error: modErr } = await supabase.rpc('is_moderator', {
        user_id: userId,
      });
      if (!modErr && modResult === true) {
        isModerator = true;
      }
    } catch {
      isModerator = false;
    }

    if (!isModerator) {
      try {
        const { data: adminResult, error: adminErr } = await supabase.rpc('is_admin', {
          user_id: userId,
        });
        if (!adminErr && adminResult === true) {
          isAdmin = true;
        }
      } catch {
        isAdmin = false;
      }
    }

    if (!isModerator && !isAdmin) {
      return {
        authorized: false,
        status: 'FORBIDDEN',
        userId,
      };
    }

    return {
      authorized: true,
      status: 'AUTHORIZED',
      userId,
    };
  } catch {
    return {
      authorized: false,
      status: 'UNAUTHORIZED',
      userId: null,
    };
  }
}

// Per-entity in-flight lock map to serialize concurrent recovery calls within the same server process
const inFlightRecoveryLocks = new Map<string, Promise<void>>();

async function withEntityRecoveryLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existingLock = inFlightRecoveryLocks.get(key);
  if (existingLock) {
    try {
      await existingLock;
    } catch {
      // Ignore error from previous holder and proceed to re-check state
    }
  }

  let releaseLock!: () => void;
  const currentLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  inFlightRecoveryLocks.set(key, currentLock);

  try {
    return await fn();
  } finally {
    releaseLock();
    if (inFlightRecoveryLocks.get(key) === currentLock) {
      inFlightRecoveryLocks.delete(key);
    }
  }
}

/**
 * Fail-closed recovery mechanism for posts and comments stuck in PENDING_REVIEW
 * when asynchronous AI moderation failed, timed out, or was interrupted.
 *
 * Security invariants:
 * 1. NEVER promotes content to PUBLISHED automatically (always escalates as REVIEW + AI_UNAVAILABLE).
 * 2. NEVER duplicates open moderation cases or AI moderation results (idempotent check + per-entity lock + DB advisory lock).
 */
export async function recoverStuckPendingReviewContent(
  options?: RecoverStuckPendingReviewOptions
): Promise<RecoverStuckPendingReviewSummary> {
  const supabase = options?.supabaseClient || createAdminClient();
  const rawStale = typeof options?.staleMinutes === 'number' && !Number.isNaN(options.staleMinutes)
    ? options.staleMinutes
    : 2;
  const staleMinutes = Math.max(0, rawStale);
  const rawLimit = typeof options?.limit === 'number' && !Number.isNaN(options.limit)
    ? options.limit
    : 50;
  const limit = Math.min(100, Math.max(1, Math.trunc(rawLimit)));
  const cutoffIso = new Date(Date.now() - staleMinutes * 60_000).toISOString();
  const modelName = process.env.MODERATION_AI_MODEL || 'foro-ai-v1';

  const summary: RecoverStuckPendingReviewSummary = {
    scannedPosts: 0,
    scannedComments: 0,
    recoveredPostIds: [],
    recoveredCommentIds: [],
    skippedAlreadyQueuedIds: [],
    errors: [],
  };

  const candidates: Array<{ entityType: 'POST' | 'COMMENT'; entityId: string }> = [];

  if (!options?.entityType || options.entityType === 'POST') {
    let postQuery = supabase
      .from('posts')
      .select('id, created_at')
      .eq('status', 'PENDING_REVIEW')
      .lte('created_at', cutoffIso)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (options?.entityId) {
      postQuery = postQuery.eq('id', options.entityId);
    }

    const { data: pendingPosts, error: postsErr } = await postQuery;
    if (postsErr) {
      summary.errors.push({
        entityType: 'POST',
        entityId: options?.entityId || 'QUERY_POSTS',
        error: postsErr.message,
      });
    } else if (pendingPosts) {
      summary.scannedPosts = pendingPosts.length;
      for (const p of pendingPosts) {
        candidates.push({ entityType: 'POST', entityId: p.id });
      }
    }
  }

  if (!options?.entityType || options.entityType === 'COMMENT') {
    let commentQuery = supabase
      .from('comments')
      .select('id, created_at')
      .eq('status', 'PENDING_REVIEW')
      .lte('created_at', cutoffIso)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (options?.entityId) {
      commentQuery = commentQuery.eq('id', options.entityId);
    }

    const { data: pendingComments, error: commentsErr } = await commentQuery;
    if (commentsErr) {
      summary.errors.push({
        entityType: 'COMMENT',
        entityId: options?.entityId || 'QUERY_COMMENTS',
        error: commentsErr.message,
      });
    } else if (pendingComments) {
      summary.scannedComments = pendingComments.length;
      for (const c of pendingComments) {
        candidates.push({ entityType: 'COMMENT', entityId: c.id });
      }
    }
  }

  for (const item of candidates) {
    const lockKey = `${item.entityType}:${item.entityId}`;
    await withEntityRecoveryLock(lockKey, async () => {
      try {
        const { data: activeCase, error: caseErr } = await supabase
          .from('moderation_cases')
          .select('id, status')
          .eq('target_type', item.entityType)
          .eq('target_id', item.entityId)
          .in('status', ['OPEN', 'IN_REVIEW', 'WAITING_USER', 'ESCALATED'])
          .limit(1)
          .maybeSingle();

        if (caseErr) {
          summary.errors.push({
            entityType: item.entityType,
            entityId: item.entityId,
            error: caseErr.message,
          });
          return;
        }

        if (activeCase) {
          summary.skippedAlreadyQueuedIds.push(item.entityId);
          return;
        }

        const { data: existingAiResult, error: aiResErr } = await supabase
          .from('moderation_ai_results')
          .select('id, case_id, risk_level')
          .eq('entity_type', item.entityType)
          .eq('entity_id', item.entityId)
          .limit(1)
          .maybeSingle();

        if (aiResErr) {
          summary.errors.push({
            entityType: item.entityType,
            entityId: item.entityId,
            error: aiResErr.message,
          });
          return;
        }

        if (existingAiResult?.case_id) {
          summary.skippedAlreadyQueuedIds.push(item.entityId);
          return;
        }

        const { error: rpcError } = await supabase.rpc('record_ai_moderation_result', {
          entity_type_param: item.entityType,
          entity_id_param: item.entityId,
          content_version_id_param: null,
          model_param: modelName,
          risk_level_param: 'REVIEW',
          flags_param: ['AI_UNAVAILABLE'],
          confidence_param: 0,
          reason_param:
            'Recuperación fail-closed: contenido en PENDING_REVIEW sin resultado de moderación automática. Escalado preventivamente a revisión humana.',
        });

        if (rpcError) {
          summary.errors.push({
            entityType: item.entityType,
            entityId: item.entityId,
            error: rpcError.message,
          });
          return;
        }

        if (item.entityType === 'POST') {
          summary.recoveredPostIds.push(item.entityId);
        } else {
          summary.recoveredCommentIds.push(item.entityId);
        }
      } catch (err: any) {
        summary.errors.push({
          entityType: item.entityType,
          entityId: item.entityId,
          error: err?.message || 'Unknown recovery error',
        });
      }
    });
  }

  return summary;
}

export interface ReconcileContentVersionsOptions {
  entityType?: 'POST' | 'COMMENT';
  entityId?: string;
  limit?: number;
  supabaseClient?: any;
}

export interface ReconcileContentVersionsSummary {
  repairedPostIds: string[];
  repairedCommentIds: string[];
  alreadySyncedIds: string[];
  errors: Array<{ entityType: 'POST' | 'COMMENT'; entityId: string; error: string }>;
}

/**
 * Safely detects and repairs incomplete version histories in `public.content_versions`
 * when a post or comment was updated in `public.posts` / `public.comments`
 * (`updated_at > created_at`) but the client-side `content_versions` insert failed.
 *
 * - Relies on PostgreSQL trigger `trg_assign_content_version_number` (`assign_content_version_number()`)
 *   as the final authority on `version_number`.
 * - Records an observable entry in `public.audit_logs` (`CONTENT_VERSION_RECONCILED`).
 */
export async function reconcileMissingContentVersions(
  options?: ReconcileContentVersionsOptions
): Promise<ReconcileContentVersionsSummary> {
  const supabase = options?.supabaseClient || createAdminClient();
  const limit = Math.min(100, Math.max(1, Math.trunc(options?.limit ?? 50)));

  const summary: ReconcileContentVersionsSummary = {
    repairedPostIds: [],
    repairedCommentIds: [],
    alreadySyncedIds: [],
    errors: [],
  };

  if (!options?.entityType || options.entityType === 'POST') {
    let postQuery = supabase
      .from('posts')
      .select('id, author_id, title, content, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (options?.entityId) {
      postQuery = postQuery.eq('id', options.entityId);
    }

    const { data: posts, error: postsErr } = await postQuery;
    if (postsErr) {
      summary.errors.push({
        entityType: 'POST',
        entityId: options?.entityId || 'QUERY_POSTS',
        error: postsErr.message,
      });
    } else if (posts) {
      for (const post of posts) {
        const isEdited =
          post.created_at &&
          post.updated_at &&
          new Date(post.updated_at).getTime() > new Date(post.created_at).getTime();

        if (!isEdited && !options?.entityId) {
          continue;
        }

        const { data: latestVer, error: verErr } = await supabase
          .from('content_versions')
          .select('id, version_number, title, content')
          .eq('entity_type', 'POST')
          .eq('entity_id', post.id)
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (verErr) {
          summary.errors.push({
            entityType: 'POST',
            entityId: post.id,
            error: verErr.message,
          });
          continue;
        }

        if (
          latestVer &&
          latestVer.title === post.title &&
          latestVer.content === post.content
        ) {
          summary.alreadySyncedIds.push(post.id);
          continue;
        }

        if (!isEdited && !latestVer) {
          summary.alreadySyncedIds.push(post.id);
          continue;
        }

        const proposedVersion =
          typeof latestVer?.version_number === 'number' && latestVer.version_number >= 1
            ? latestVer.version_number + 1
            : 1;

        const { data: insertedVer, error: insertErr } = await supabase
          .from('content_versions')
          .insert({
            entity_type: 'POST',
            entity_id: post.id,
            version_number: proposedVersion,
            title: post.title,
            content: post.content,
            edited_by: post.author_id,
          })
          .select('id, version_number')
          .maybeSingle();

        if (insertErr) {
          summary.errors.push({
            entityType: 'POST',
            entityId: post.id,
            error: insertErr.message,
          });
          continue;
        }

        await supabase.from('audit_logs').insert({
          actor_id: post.author_id,
          action: 'CONTENT_VERSION_RECONCILED',
          entity_type: 'POST',
          entity_id: post.id,
          reason: 'Reparación de historial en content_versions tras fallo de persistencia en cliente',
          new_data: {
            repaired_version_id: insertedVer?.id || null,
            repaired_version_number: insertedVer?.version_number || proposedVersion,
          },
        });

        summary.repairedPostIds.push(post.id);
      }
    }
  }

  if (!options?.entityType || options.entityType === 'COMMENT') {
    let commentQuery = supabase
      .from('comments')
      .select('id, author_id, content, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (options?.entityId) {
      commentQuery = commentQuery.eq('id', options.entityId);
    }

    const { data: comments, error: commErr } = await commentQuery;
    if (commErr) {
      summary.errors.push({
        entityType: 'COMMENT',
        entityId: options?.entityId || 'QUERY_COMMENTS',
        error: commErr.message,
      });
    } else if (comments) {
      for (const comment of comments) {
        const isEdited =
          comment.created_at &&
          comment.updated_at &&
          new Date(comment.updated_at).getTime() > new Date(comment.created_at).getTime();

        if (!isEdited && !options?.entityId) {
          continue;
        }

        const { data: latestVer, error: verErr } = await supabase
          .from('content_versions')
          .select('id, version_number, content')
          .eq('entity_type', 'COMMENT')
          .eq('entity_id', comment.id)
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (verErr) {
          summary.errors.push({
            entityType: 'COMMENT',
            entityId: comment.id,
            error: verErr.message,
          });
          continue;
        }

        if (latestVer && latestVer.content === comment.content) {
          summary.alreadySyncedIds.push(comment.id);
          continue;
        }

        if (!isEdited && !latestVer) {
          summary.alreadySyncedIds.push(comment.id);
          continue;
        }

        const proposedVersion =
          typeof latestVer?.version_number === 'number' && latestVer.version_number >= 1
            ? latestVer.version_number + 1
            : 1;

        const { data: insertedVer, error: insertErr } = await supabase
          .from('content_versions')
          .insert({
            entity_type: 'COMMENT',
            entity_id: comment.id,
            version_number: proposedVersion,
            content: comment.content,
            edited_by: comment.author_id,
          })
          .select('id, version_number')
          .maybeSingle();

        if (insertErr) {
          summary.errors.push({
            entityType: 'COMMENT',
            entityId: comment.id,
            error: insertErr.message,
          });
          continue;
        }

        await supabase.from('audit_logs').insert({
          actor_id: comment.author_id,
          action: 'CONTENT_VERSION_RECONCILED',
          entity_type: 'COMMENT',
          entity_id: comment.id,
          reason: 'Reparación de historial en content_versions tras fallo de persistencia en cliente',
          new_data: {
            repaired_version_id: insertedVer?.id || null,
            repaired_version_number: insertedVer?.version_number || proposedVersion,
          },
        });

        summary.repairedCommentIds.push(comment.id);
      }
    }
  }

  return summary;
}
