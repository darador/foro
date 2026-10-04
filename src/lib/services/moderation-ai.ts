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

export async function analyzeContentWithAi(params: AnalyzeContentParams) {
  const supabase = createAdminClient();

  const isEnabled = process.env.MODERATION_AI_ENABLED === 'true';
  const modelName = process.env.MODERATION_AI_MODEL || 'foro-ai-v1';

  // 1. Fetch real content from server database (never trust client-supplied text/title)
  let title: string | null = null;
  let content = '';

  if (params.entityType === 'POST') {
    const { data: post, error: postErr } = await supabase
      .from('posts')
      .select('id, title, content, status')
      .eq('id', params.entityId)
      .maybeSingle();

    if (postErr || !post) {
      throw new Error(`Target post not found for AI analysis: ${params.entityId}`);
    }
    title = post.title;
    content = post.content;
  } else if (params.entityType === 'COMMENT') {
    const { data: comment, error: commErr } = await supabase
      .from('comments')
      .select('id, content, status')
      .eq('id', params.entityId)
      .maybeSingle();

    if (commErr || !comment) {
      throw new Error(`Target comment not found for AI analysis: ${params.entityId}`);
    }
    content = comment.content;
  }

  // 2. Real Database Idempotency Check: Don't analyze exact same version twice
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
  }

  // 3. Disabled Fallback: If AI is disabled in environment, return cleanly
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
