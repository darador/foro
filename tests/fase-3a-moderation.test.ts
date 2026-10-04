import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FASE 3A — Moderación Base Contract & Implementation Tests', () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20261004000021_fase3a_moderation_foundation.sql'
  );
  const migrationContent = fs.readFileSync(migrationPath, 'utf-8');

  it('verifies user_moderation_actions table is created with valid sanction action check constraint', () => {
    expect(migrationContent).toContain('CREATE TABLE IF NOT EXISTS public.user_moderation_actions');
    expect(migrationContent).toContain("'WARNING', 'TEMPORARY_RESTRICTION', 'SUSPEND', 'PERMANENT_SUSPENSION'");
  });

  it('verifies reports and moderation_cases schema extensions', () => {
    expect(migrationContent).toContain('ALTER TABLE public.reports');
    expect(migrationContent).toContain('ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES public.moderation_cases(id)');
    expect(migrationContent).toContain('ALTER TABLE public.moderation_cases');
    expect(migrationContent).toContain("ADD COLUMN IF NOT EXISTS target_type TEXT CHECK (target_type IN ('POST', 'COMMENT', 'PROFILE', 'MESSAGE'))");
    expect(migrationContent).toContain('ADD COLUMN IF NOT EXISTS target_id UUID');
  });

  it('verifies moderation performance indexes are created', () => {
    expect(migrationContent).toContain('CREATE INDEX IF NOT EXISTS idx_reports_case_id');
    expect(migrationContent).toContain('CREATE INDEX IF NOT EXISTS idx_reports_target');
    expect(migrationContent).toContain('CREATE INDEX IF NOT EXISTS idx_moderation_cases_target');
    expect(migrationContent).toContain('CREATE INDEX IF NOT EXISTS idx_moderation_cases_priority_status');
    expect(migrationContent).toContain('CREATE INDEX IF NOT EXISTS idx_user_moderation_actions_user');
    expect(migrationContent).toContain('CREATE INDEX IF NOT EXISTS idx_content_versions_entity');
  });

  it('verifies RLS policies on moderation tables (user_moderation_actions, content_versions, audit_logs)', () => {
    expect(migrationContent).toContain('ALTER TABLE public.user_moderation_actions ENABLE ROW LEVEL SECURITY;');
    expect(migrationContent).toContain('ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;');
    expect(migrationContent).toContain('ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;');

    expect(migrationContent).toContain('Only moderators can view and manage user moderation actions');
    expect(migrationContent).toContain('public.is_moderator(auth.uid())');

    expect(migrationContent).toContain('Only moderators can view content versions');
    expect(migrationContent).toContain('No direct update on content versions');
    expect(migrationContent).toContain('No direct delete on content versions');
    expect(migrationContent).toContain('No direct insert on audit logs');
  });

  it('verifies submit_report_with_case RPC function logic and security settings', () => {
    expect(migrationContent).toContain('CREATE OR REPLACE FUNCTION public.submit_report_with_case');
    expect(migrationContent).toContain('SECURITY DEFINER');
    expect(migrationContent).toContain('SET search_path = public');
    expect(migrationContent).toContain("calc_risk := 'CRITICAL';");
    expect(migrationContent).toContain("UPDATE public.posts SET status = 'HIDDEN' WHERE id = target_id_param AND status = 'PUBLISHED';");
    expect(migrationContent).toContain("UPDATE public.comments SET status = 'HIDDEN' WHERE id = target_id_param AND status = 'PUBLISHED';");
    expect(migrationContent).toContain('REVOKE EXECUTE ON FUNCTION public.submit_report_with_case(TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon;');
    expect(migrationContent).toContain('GRANT EXECUTE ON FUNCTION public.submit_report_with_case(TEXT, UUID, TEXT, TEXT) TO authenticated;');
  });

  it('verifies src/lib/services/moderation.ts exists and exports required functions', () => {
    const servicePath = path.join(process.cwd(), 'src/lib/services/moderation.ts');
    expect(fs.existsSync(servicePath)).toBe(true);

    const serviceContent = fs.readFileSync(servicePath, 'utf-8');
    expect(serviceContent).toContain('export async function getModerationCases');
    expect(serviceContent).toContain('export async function getModerationCaseDetail');
    expect(serviceContent).toContain('export async function assignModerationCase');
    expect(serviceContent).toContain('export async function executeModerationAction');
    expect(serviceContent).toContain('export async function applyUserSanction');
    expect(serviceContent).toContain('export async function saveContentVersion');
  });

  it('verifies src/lib/services/client/moderation.ts exists for browser interactions', () => {
    const clientServicePath = path.join(process.cwd(), 'src/lib/services/client/moderation.ts');
    expect(fs.existsSync(clientServicePath)).toBe(true);

    const clientServiceContent = fs.readFileSync(clientServicePath, 'utf-8');
    expect(clientServiceContent).toContain('export async function assignModerationCaseClient');
    expect(clientServiceContent).toContain('export async function executeModerationActionClient');
    expect(clientServiceContent).toContain('export async function applyUserSanctionClient');
  });

  it('verifies admin moderation pages exist in app directory', () => {
    const queuePagePath = path.join(process.cwd(), 'src/app/admin/moderacion/page.tsx');
    const detailPagePath = path.join(process.cwd(), 'src/app/admin/moderacion/[caseId]/page.tsx');

    expect(fs.existsSync(queuePagePath)).toBe(true);
    expect(fs.existsSync(detailPagePath)).toBe(true);
  });
});
