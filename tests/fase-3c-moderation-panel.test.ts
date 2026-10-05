import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FASE 3C — Panel de Moderación Humana Integrity, Security & UI Contract Tests', () => {
  const migration3cPath = path.join(
    process.cwd(),
    'supabase/migrations/20261004000030_fase3c_human_moderation_panel.sql'
  );
  const migration3aHardeningPath = path.join(
    process.cwd(),
    'supabase/migrations/20261004000022_fase3a1_moderation_integrity_hardening.sql'
  );
  const moderationServicePath = path.join(process.cwd(), 'src/lib/services/moderation.ts');
  const clientModerationServicePath = path.join(process.cwd(), 'src/lib/services/client/moderation.ts');
  const queuePagePath = path.join(process.cwd(), 'src/app/admin/moderacion/page.tsx');
  const detailPagePath = path.join(process.cwd(), 'src/app/admin/moderacion/[caseId]/page.tsx');
  const queueViewPath = path.join(process.cwd(), 'src/components/admin/ModerationQueueView.tsx');
  const detailViewPath = path.join(process.cwd(), 'src/components/admin/ModerationCaseDetailView.tsx');

  const migration3c = fs.readFileSync(migration3cPath, 'utf-8');
  const migration3aHardening = fs.readFileSync(migration3aHardeningPath, 'utf-8');
  const moderationService = fs.readFileSync(moderationServicePath, 'utf-8');
  const clientModerationService = fs.readFileSync(clientModerationServicePath, 'utf-8');
  const queuePage = fs.readFileSync(queuePagePath, 'utf-8');
  const detailPage = fs.readFileSync(detailPagePath, 'utf-8');
  const queueView = fs.readFileSync(queueViewPath, 'utf-8');
  const detailView = fs.readFileSync(detailViewPath, 'utf-8');

  // 1. Access Control
  it('1. verifies server-side access control for MODERATOR, DIRECTORY_ADMIN, and SUPERADMIN in page layouts and DB RPC', () => {
    expect(migration3c).toContain('WHERE user_id = target_user_id AND role IN (\'SUPERADMIN\', \'DIRECTORY_ADMIN\', \'MODERATOR\')');
    expect(queuePage).toContain('is_moderator');
    expect(queuePage).toContain('notFound()');
    expect(detailPage).toContain('is_moderator');
    expect(detailPage).toContain('notFound()');
  });

  // 2. Status Filter
  it('2. verifies getModerationCases supports status filter (OPEN, IN_REVIEW, RESOLVED, DISMISSED, WAITING_USER, ESCALATED, ALL)', () => {
    expect(moderationService).toContain('options.status && options.status !== \'ALL\'');
    expect(queueView).toContain('statusFilter');
    expect(queueView).toContain('OPEN');
    expect(queueView).toContain('IN_REVIEW');
    expect(queueView).toContain('RESOLVED');
  });

  // 3. Priority Filter
  it('3. verifies getModerationCases supports priority filter (CRITICAL, REVIEW, LOW, ALL)', () => {
    expect(moderationService).toContain('options.priority && options.priority !== \'ALL\'');
    expect(queueView).toContain('priorityFilter');
    expect(queueView).toContain('CRITICAL');
    expect(queueView).toContain('REVIEW');
    expect(queueView).toContain('LOW');
  });

  // 4. Target Type Filter
  it('4. verifies getModerationCases supports target_type filter (POST, COMMENT, PROFILE, MESSAGE, ALL)', () => {
    expect(moderationService).toContain('options.targetType && options.targetType !== \'ALL\'');
    expect(queueView).toContain('targetTypeFilter');
    expect(queueView).toContain('POST');
    expect(queueView).toContain('COMMENT');
    expect(queueView).toContain('PROFILE');
    expect(queueView).toContain('MESSAGE');
  });

  // 5. Assigned To Filter
  it('5. verifies getModerationCases supports assigned_to filter (ME, UNASSIGNED, ALL)', () => {
    expect(moderationService).toContain('options.assignedTo && options.assignedTo !== \'ALL\'');
    expect(moderationService).toContain('options.assignedTo === \'UNASSIGNED\'');
    expect(moderationService).toContain('options.assignedTo === \'ME\'');
    expect(queueView).toContain('assignedToFilter');
  });

  // 6. Pagination
  it('6. verifies getModerationCases supports pagination (page, limit)', () => {
    expect(moderationService).toContain('const page = options.page || 1;');
    expect(moderationService).toContain('const limit = options.limit || 20;');
    expect(queueView).toContain('currentPage');
    expect(queueView).toContain('totalPages');
  });

  // 7. Detail View Target Entity
  it('7. verifies getModerationCaseDetail fetches target entity content, status, title, author, creation date', () => {
    expect(moderationService).toContain('targetEntity');
    expect(moderationService).toContain('targetAuthor');
    expect(detailView).toContain('Contenido Bajo Revisión');
  });

  // 8. Detail View Linked Reports
  it('8. verifies getModerationCaseDetail fetches linked reports with reporter alias, reason, and details', () => {
    expect(moderationService).toContain('.from(\'reports\')');
    expect(moderationService).toContain('reporter:profiles!reports_reporter_id_fkey');
    expect(detailView).toContain('Reportes Vinculados al Caso');
  });

  // 9. AI Signal Display
  it('9. verifies getModerationCaseDetail fetches AI moderation signal (risk_level, confidence, reason, flags, model)', () => {
    expect(moderationService).toContain('.from(\'moderation_ai_results\')');
    expect(detailView).toContain('Análisis Automático con IA');
    expect(detailView).toContain('ai.risk_level');
  });

  // 10. AI Signal Mandatory Disclaimer
  it('10. verifies UI includes mandatory disclaimer for AI classification signal', () => {
    expect(detailView).toContain(
      'La clasificación automática es una señal de asistencia'
    );
  });

  // 11. AI Signal Immutability
  it('11. verifies moderation_ai_results table is immutable and read-only for authenticated users', () => {
    expect(migration3c).toContain('No direct insert on moderation ai results');
    expect(migration3c).toContain('No direct update on moderation ai results');
    expect(migration3c).toContain('No direct delete on moderation ai results');
  });

  // 12. Moderation Action APPROVE
  it('12. verifies executeModerationAction supports APPROVE action (publishing content)', () => {
    expect(migration3aHardening).toContain('ELSIF action_type_param = \'APPROVE\' THEN');
    expect(migration3aHardening).toContain('UPDATE public.posts SET status = \'PUBLISHED\'');
    expect(detailView).toContain('value="APPROVE"');
  });

  // 13. Moderation Action REQUEST_CHANGES
  it('13. verifies executeModerationAction supports REQUEST_CHANGES action', () => {
    expect(detailView).toContain('value="REQUEST_CHANGES"');
    expect(clientModerationService).toContain('executeModerationActionClient');
  });

  // 14. Moderation Action HIDE
  it('14. verifies executeModerationAction supports HIDE action (hiding content)', () => {
    expect(migration3aHardening).toContain('IF action_type_param = \'HIDE\' THEN');
    expect(migration3aHardening).toContain('UPDATE public.posts SET status = \'HIDDEN\'');
    expect(detailView).toContain('value="HIDE"');
  });

  // 15. Moderation Action DELETE
  it('15. verifies executeModerationAction supports DELETE action (deleting content)', () => {
    expect(migration3aHardening).toContain('ELSIF action_type_param = \'DELETE\' THEN');
    expect(migration3aHardening).toContain('UPDATE public.posts SET status = \'DELETED\'');
    expect(detailView).toContain('value="DELETE"');
  });

  // 16. Content Action Security
  it('16. verifies executeModerationAction derives moderator ID strictly from auth.uid()', () => {
    expect(migration3aHardening).toContain('caller_id := auth.uid();');
    expect(migration3aHardening).toContain('IF caller_id IS NULL OR NOT public.is_moderator(caller_id) THEN');
    expect(migration3aHardening).toContain('moderator_id,');
  });

  // 17. User Sanction WARN
  it('17. verifies applyUserSanction supports WARNING sanction', () => {
    expect(migration3aHardening).toContain('WARN');
    expect(detailView).toContain('value="WARNING"');
  });

  // 18. User Sanction RESTRICT_POSTS
  it('18. verifies applyUserSanction supports TEMPORARY_RESTRICTION sanction', () => {
    expect(migration3aHardening).toContain('TEMPORARY_RESTRICTION');
    expect(detailView).toContain('value="TEMPORARY_RESTRICTION"');
  });

  // 19. User Sanction RESTRICT_MESSAGES
  it('19. verifies applyUserSanction supports restriction actions', () => {
    expect(clientModerationService).toContain('applyUserSanctionClient');
    expect(detailView).toContain('handleApplySanction');
  });

  // 20. User Sanction SUSPEND
  it('20. verifies applyUserSanction supports SUSPEND sanction', () => {
    expect(migration3aHardening).toContain('SUSPEND');
    expect(detailView).toContain('value="SUSPEND"');
  });

  // 21. User Sanction BAN
  it('21. verifies applyUserSanction supports PERMANENT_SUSPENSION sanction', () => {
    expect(migration3aHardening).toContain('PERMANENT_SUSPENSION');
    expect(detailView).toContain('value="PERMANENT_SUSPENSION"');
  });

  // 22. User Sanction Security
  it('22. verifies applyUserSanction derives creator ID strictly from auth.uid()', () => {
    expect(migration3aHardening).toContain('caller_id := auth.uid();');
    expect(migration3aHardening).toContain('created_by,');
  });

  // 23. Case Assignment
  it('23. verifies assignModerationCase assigns case to caller and advances status to IN_REVIEW', () => {
    expect(migration3aHardening).toContain('CREATE OR REPLACE FUNCTION public.assign_moderation_case');
    expect(migration3aHardening).toContain('assigned_moderator_id = caller_id');
    expect(migration3aHardening).toContain('next_status := CASE WHEN current_status = \'OPEN\' THEN \'IN_REVIEW\'');
  });

  // 24. Audit Logging & Append-Only RLS Security Contract
  it('24. verifies audit_logs and moderation tables enforce append-only policies and record all actions', () => {
    expect(migration3aHardening).toContain('INSERT INTO public.audit_logs');
    expect(migration3c).toContain('No direct update on moderation actions');
    expect(migration3c).toContain('No direct delete on moderation actions');
    expect(migration3c).toContain('No direct update on user moderation actions');
    expect(migration3c).toContain('No direct delete on user moderation actions');
    expect(migration3c).toContain('No direct insert on audit logs');
    expect(migration3c).toContain('No direct update on audit logs');
    expect(migration3c).toContain('No direct delete on audit logs');
  });
});
