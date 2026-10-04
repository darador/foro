import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FASE 1.1 — SECURITY HARDENING: RLS & Policy Audit', () => {
  const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
  
  const getMigrationSql = (filename: string) => {
    return fs.readFileSync(path.join(migrationsDir, filename), 'utf-8');
  };

  const initialSchemaSql = getMigrationSql('20261004000000_initial_schema.sql');
  const initialRlsSql = getMigrationSql('20261004000001_rls_policies.sql');
  const hardeningSql = getMigrationSql('20261004000003_security_hardening.sql');
  
  const allSql = `${initialSchemaSql}\n${initialRlsSql}\n${hardeningSql}`;

  test('1. PROTEGER admin_roles: Normal user CANNOT select admin_roles table', () => {
    // Must drop the open SELECT policy ON admin_roles
    expect(hardeningSql).toContain('DROP POLICY IF EXISTS "Admin roles are viewable by authenticated users" ON public.admin_roles');
    // Must restrict direct SELECT to is_admin
    expect(hardeningSql).toContain('public.is_admin(auth.uid())');
    // Must NOT allow unrestricted USING (true) for SELECT on admin_roles
    expect(hardeningSql).not.toContain('"Admin roles viewable only by admins"\n    ON public.admin_roles FOR SELECT\n    TO authenticated\n    USING (true)');
  });

  test('2. PROTEGER email_verified: Cannot be modified by manual user updates', () => {
    // Must have trigger function protect_profile_readonly_fields
    expect(hardeningSql).toContain('FUNCTION public.protect_profile_readonly_fields');
    expect(hardeningSql).toContain('NEW.email_verified := OLD.email_verified');
    expect(hardeningSql).toContain('BEFORE UPDATE ON public.profiles');
  });

  test('3. PROTEGER CONTADORES Y BADGES: Derived fields locked by trigger', () => {
    expect(hardeningSql).toContain('NEW.experiences_count := OLD.experiences_count');
    expect(hardeningSql).toContain('NEW.comments_count := OLD.comments_count');
    expect(hardeningSql).toContain('NEW.reactions_received := OLD.reactions_received');
    expect(hardeningSql).toContain('NEW.badges := OLD.badges');
  });

  test('4. CREAR moderation_ai_results: Table created with strict RLS', () => {
    expect(hardeningSql).toContain('CREATE TABLE IF NOT EXISTS public.moderation_ai_results');
    expect(hardeningSql).toContain('ALTER TABLE public.moderation_ai_results ENABLE ROW LEVEL SECURITY');
    expect(hardeningSql).toContain('public.is_moderator(auth.uid())');
  });

  test('5. BLINDAR MESSAGING: Requires ACCEPTED request & NO active blocks', () => {
    expect(hardeningSql).toContain('FUNCTION public.can_send_message');
    expect(hardeningSql).toContain('mr.status = \'ACCEPTED\'');
    expect(hardeningSql).toContain('ub.blocker_id = cm.user_id');
    expect(hardeningSql).toContain('public.can_send_message(conversation_id, auth.uid())');
  });

  test('6. REFORZAR DIRECTORY_ENABLED: Server-side database function defaults to FALSE', () => {
    expect(hardeningSql).toContain('FUNCTION public.is_directory_enabled()');
    expect(hardeningSql).toContain('SELECT FALSE;');
    expect(hardeningSql).toContain('public.is_directory_enabled() = true');
  });

  test('7. SERVICE ROLE AUDIT: Ensures service role key is server-only', () => {
    const adminTs = fs.readFileSync(path.resolve(__dirname, '../src/lib/supabase/admin.ts'), 'utf-8');
    expect(adminTs).toContain('typeof window !== \'undefined\'');
    expect(adminTs).toContain('CRITICAL SECURITY ERROR');
    expect(adminTs).not.toContain('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
  });
});
