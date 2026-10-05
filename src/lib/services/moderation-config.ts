import { createClient } from '@/lib/supabase/client';

/**
 * Client-safe helper to query single source of truth system_config table for MODERATION_AI_ENABLED.
 * DOES NOT import administrative server clients, server keys, or AI provider code.
 * MANDATORY FAIL-SAFE RULE: Defaults to true if setting key is missing or on error reading system_config.
 */
export async function isModerationAiEnabled(supabaseClient?: any): Promise<boolean> {
  const supabase = supabaseClient || createClient();
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
    // FAIL-SAFE: Default to true on exception
    return true;
  }
}
