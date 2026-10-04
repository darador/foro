import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FASE 3A & 3A.1 — Moderación Base Integrity & Security Contract Tests', () => {
  const foundationMigrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20261004000021_fase3a_moderation_foundation.sql'
  );
  const hardeningMigrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20261004000022_fase3a1_moderation_integrity_hardening.sql'
  );

  const foundationContent = fs.readFileSync(foundationMigrationPath, 'utf-8');
  const hardeningContent = fs.readFileSync(hardeningMigrationPath, 'utf-8');

  it('verifies user_moderation_actions table is created with valid sanction action check constraint', () => {
    expect(foundationContent).toContain('CREATE TABLE IF NOT EXISTS public.user_moderation_actions');
    expect(foundationContent).toContain("'WARNING', 'TEMPORARY_RESTRICTION', 'SUSPEND', 'PERMANENT_SUSPENSION'");
  });

  it('verifies target_id validation for POST, COMMENT, PROFILE, and MESSAGE in submit_report_with_case RPC', () => {
    expect(hardeningContent).toContain("IF target_type_param = 'POST' THEN");
    expect(hardeningContent).toContain('SELECT 1 FROM public.posts WHERE id = target_id_param');

    expect(hardeningContent).toContain("ELSIF target_type_param = 'COMMENT' THEN");
    expect(hardeningContent).toContain('SELECT 1 FROM public.comments WHERE id = target_id_param');

    expect(hardeningContent).toContain("ELSIF target_type_param = 'PROFILE' THEN");
    expect(hardeningContent).toContain('SELECT 1 FROM public.profiles WHERE id = target_id_param');

    expect(hardeningContent).toContain("ELSIF target_type_param = 'MESSAGE' THEN");
    expect(hardeningContent).toContain('SELECT 1 FROM public.messages m');
    expect(hardeningContent).toContain('m.sender_id = caller_id');
    expect(hardeningContent).toContain('SELECT 1 FROM public.conversation_members cm');
  });

  it('verifies execute_moderation_action atomic RPC definition, SECURITY DEFINER, search_path, and actor derivation', () => {
    expect(hardeningContent).toContain('CREATE OR REPLACE FUNCTION public.execute_moderation_action');
    expect(hardeningContent).toContain('SECURITY DEFINER');
    expect(hardeningContent).toContain('SET search_path = public');
    expect(hardeningContent).toContain('caller_id := auth.uid();');
    expect(hardeningContent).toContain('public.is_moderator(caller_id)');
    expect(hardeningContent).toContain('UPDATE public.posts SET status =');
    expect(hardeningContent).toContain('UPDATE public.comments SET status =');
    expect(hardeningContent).toContain('INSERT INTO public.moderation_actions');
    expect(hardeningContent).toContain('UPDATE public.moderation_cases');
    expect(hardeningContent).toContain('UPDATE public.reports');
    expect(hardeningContent).toContain('INSERT INTO public.audit_logs');
  });

  it('verifies apply_user_sanction atomic RPC definition, SECURITY DEFINER, and actor derivation', () => {
    expect(hardeningContent).toContain('CREATE OR REPLACE FUNCTION public.apply_user_sanction');
    expect(hardeningContent).toContain('SECURITY DEFINER');
    expect(hardeningContent).toContain('SET search_path = public');
    expect(hardeningContent).toContain('caller_id := auth.uid();');
    expect(hardeningContent).toContain('INSERT INTO public.user_moderation_actions');
    expect(hardeningContent).toContain('INSERT INTO public.audit_logs');
  });

  it('verifies assign_moderation_case atomic RPC definition and actor derivation', () => {
    expect(hardeningContent).toContain('CREATE OR REPLACE FUNCTION public.assign_moderation_case');
    expect(hardeningContent).toContain('SECURITY DEFINER');
    expect(hardeningContent).toContain('SET search_path = public');
    expect(hardeningContent).toContain('caller_id := auth.uid();');
    expect(hardeningContent).toContain('UPDATE public.moderation_cases');
  });

  it('verifies content_versions RLS policy enforces true author or moderator check for INSERT', () => {
    expect(hardeningContent).toContain('CREATE POLICY "Authors can insert content versions"');
    expect(hardeningContent).toContain('edited_by = auth.uid()');
    expect(hardeningContent).toContain('author_id = auth.uid()');
    expect(hardeningContent).toContain('public.is_moderator(auth.uid())');
  });

  it('verifies append-only RLS policies for moderation_actions, user_moderation_actions, and audit_logs', () => {
    expect(hardeningContent).toContain('No direct update on moderation actions');
    expect(hardeningContent).toContain('No direct delete on moderation actions');
    expect(hardeningContent).toContain('No direct update on user moderation actions');
    expect(hardeningContent).toContain('No direct delete on user moderation actions');
    expect(hardeningContent).toContain('No direct insert on audit logs');
    expect(hardeningContent).toContain('No direct update on audit logs');
    expect(hardeningContent).toContain('No direct delete on audit logs');
  });

  it('verifies controlled message access RLS policy for moderators (only reported messages linked to a case)', () => {
    expect(hardeningContent).toContain('CREATE POLICY "Moderators can view reported messages"');
    expect(hardeningContent).toContain('ON public.messages FOR SELECT');
    expect(hardeningContent).toContain('public.is_moderator(auth.uid())');
    expect(hardeningContent).toContain("mc.target_type = 'MESSAGE'");
    expect(hardeningContent).toContain('mc.target_id = messages.id');
  });

  it('verifies RPC EXECUTE permissions are revoked from PUBLIC, anon and granted to authenticated', () => {
    expect(hardeningContent).toContain('REVOKE EXECUTE ON FUNCTION public.submit_report_with_case(TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon;');
    expect(hardeningContent).toContain('REVOKE EXECUTE ON FUNCTION public.execute_moderation_action(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;');
    expect(hardeningContent).toContain('REVOKE EXECUTE ON FUNCTION public.apply_user_sanction(UUID, TEXT, TEXT, TIMESTAMPTZ, UUID) FROM PUBLIC, anon;');
    expect(hardeningContent).toContain('REVOKE EXECUTE ON FUNCTION public.assign_moderation_case(UUID) FROM PUBLIC, anon;');
  });

  it('verifies src/lib/services/client/moderation.ts calls RPCs without accepting client-provided actor identity', () => {
    const clientServicePath = path.join(process.cwd(), 'src/lib/services/client/moderation.ts');
    const clientContent = fs.readFileSync(clientServicePath, 'utf-8');

    expect(clientContent).toContain("supabase.rpc('assign_moderation_case'");
    expect(clientContent).toContain("supabase.rpc('execute_moderation_action'");
    expect(clientContent).toContain("supabase.rpc('apply_user_sanction'");

    expect(clientContent).not.toContain('moderatorId:');
    expect(clientContent).not.toContain('createdBy:');
  });

  it('verifies src/lib/services/moderation.ts calculates reports RECEIVED against target author', () => {
    const serverServicePath = path.join(process.cwd(), 'src/lib/services/moderation.ts');
    const serverContent = fs.readFileSync(serverServicePath, 'utf-8');

    expect(serverContent).toContain('totalReceivedReports');
    expect(serverContent).toContain("target_type', 'PROFILE'");
    expect(serverContent).toContain("target_type', 'POST'");
    expect(serverContent).toContain("target_type', 'COMMENT'");
    expect(serverContent).not.toContain(".eq('reporter_id', targetAuthor.id)");
  });
});
