import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Service Role client with elevated privileges.
 * NEVER expose or call this client on the browser side.
 */
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('CRITICAL SECURITY ERROR: Service Role client cannot be executed in the browser.');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'dummy-service-role-key';

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
