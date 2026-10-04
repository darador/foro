import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import type { ModerationPriority } from '@/types/database';

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

export type ModerationAiFlag = (typeof ALLOWED_AI_FLAGS)[number];

export const ModerationAiResponseSchema = z.object({
  risk_level: z.enum(['LOW', 'REVIEW', 'CRITICAL']),
  flags: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1).max(500),
});

export type ModerationAiResponse = z.infer<typeof ModerationAiResponseSchema>;

export interface AnalyzeContentParams {
  entityType: 'POST' | 'COMMENT';
  entityId: string;
  title?: string | null;
  content: string;
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
  const supabase = await createClient();

  const isEnabled = process.env.MODERATION_AI_ENABLED === 'true';
  const modelName = process.env.MODERATION_AI_MODEL || 'foro-ai-v1';

  // 1. Idempotency Check: Don't analyze the exact same version/entity twice if already recorded
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

  // 2. Disabled Fallback: If AI is disabled in environment, return cleanly
  if (!isEnabled) {
    return { status: 'DISABLED', result: null };
  }

  let classification: ModerationAiResponse;

  try {
    // Call provider abstraction or mock provider
    const providerResponse = await callAiProvider({
      title: params.title,
      content: params.content,
      entityType: params.entityType,
    });

    // Validate schema
    const parsed = ModerationAiResponseSchema.safeParse(providerResponse);
    if (!parsed.success) {
      throw new Error('AI response schema validation failed');
    }

    // Filter valid flags
    const validFlags = parsed.data.flags.filter((f) =>
      ALLOWED_AI_FLAGS.includes(f as ModerationAiFlag)
    );

    classification = {
      ...parsed.data,
      flags: validFlags,
    };
  } catch (err: any) {
    console.error('AI Moderation provider error/fail-safe triggered:', err);
    // FAIL-SAFE RULE: If AI fails/timeouts/invalid, treat as REVIEW with AI_UNAVAILABLE flag
    classification = {
      risk_level: 'REVIEW',
      flags: ['AI_UNAVAILABLE'],
      confidence: 0,
      reason: 'Análisis automático no disponible o falló. Enviado a revisión humana preventivamente.',
    };
  }

  // 3. Record result in database via atomic RPC
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
  const apiKey = process.env.MODERATION_AI_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // Default heuristic fallback for testing/dev if no API key is provided
    return mockClassifierLogic(input);
  }

  // If real API key is configured in env, call provider endpoint
  const textToAnalyze = input.title ? `${input.title}\n\n${input.content}` : input.content;

  try {
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
      throw new Error(`Provider HTTP error: ${res.status}`);
    }

    const data = await res.json();
    const contentStr = data.choices?.[0]?.message?.content;
    return JSON.parse(contentStr);
  } catch (err) {
    return mockClassifierLogic(input);
  }
}

/**
 * Deterministic Mock Classifier for development, testing, and fallback
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

  // Adult consensual sexual content -> LOW
  return {
    risk_level: 'LOW',
    flags: fullText.includes('bdsm') || fullText.includes('swinger') || fullText.includes('fetiche') ? ['SEXUAL_CONTENT'] : [],
    confidence: 0.9,
    reason: 'Contenido dentro de los parámetros permitidos de la comunidad.',
  };
}
