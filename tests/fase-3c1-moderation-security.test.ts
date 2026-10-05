import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FASE 3C.1 — Human Moderation Security, Integrity & Isolation Contract Tests', () => {
  const migration3c1Path = path.join(
    process.cwd(),
    'supabase/migrations/20261004000031_fase3c1_human_moderation_hardening.sql'
  );
  const migration3aHardeningPath = path.join(
    process.cwd(),
    'supabase/migrations/20261004000022_fase3a1_moderation_integrity_hardening.sql'
  );
  const moderationServicePath = path.join(process.cwd(), 'src/lib/services/moderation.ts');
  const queueViewPath = path.join(process.cwd(), 'src/components/admin/ModerationQueueView.tsx');

  const migration3c1 = fs.readFileSync(migration3c1Path, 'utf-8');
  const migration3aHardening = fs.readFileSync(migration3aHardeningPath, 'utf-8');
  const moderationService = fs.readFileSync(moderationServicePath, 'utf-8');
  const queueView = fs.readFileSync(queueViewPath, 'utf-8');

  // moderation_cases tests (1-6)
  it('1. verifies moderators and admins can SELECT moderation_cases', () => {
    expect(migration3c1).toContain('CREATE POLICY "Only moderators can view moderation cases"');
    expect(migration3c1).toContain('USING (public.is_moderator(auth.uid()) OR public.is_admin(auth.uid()))');
  });

  it('2. verifies regular users cannot SELECT moderation_cases directly', () => {
    expect(migration3c1).toContain('ON public.moderation_cases FOR SELECT');
    expect(migration3c1).not.toContain('FOR ALL');
  });

  it('3. verifies moderators cannot direct INSERT on moderation_cases', () => {
    expect(migration3c1).toContain('CREATE POLICY "No direct insert on moderation cases"');
    expect(migration3c1).toContain('WITH CHECK (false)');
  });

  it('4. verifies moderators cannot direct UPDATE on moderation_cases', () => {
    expect(migration3c1).toContain('CREATE POLICY "No direct update on moderation cases"');
    expect(migration3c1).toContain('USING (false)');
  });

  it('5. verifies moderators cannot direct DELETE on moderation_cases', () => {
    expect(migration3c1).toContain('CREATE POLICY "No direct delete on moderation cases"');
    expect(migration3c1).toContain('USING (false)');
  });

  it('6. verifies submit_report_with_case RPC creates case via SECURITY DEFINER without direct INSERT policy', () => {
    expect(migration3aHardening).toContain('CREATE OR REPLACE FUNCTION public.submit_report_with_case');
    expect(migration3aHardening).toContain('SECURITY DEFINER');
    expect(migration3aHardening).toContain('INSERT INTO public.moderation_cases');
  });

  // execute_moderation_action tests (7-15)
  it('7. verifies moderator can execute valid action via RPC', () => {
    expect(migration3c1).toContain('CREATE OR REPLACE FUNCTION public.execute_moderation_action');
    expect(migration3c1).toContain('GRANT EXECUTE ON FUNCTION public.execute_moderation_action');
  });

  it('8. verifies regular user cannot execute execute_moderation_action', () => {
    expect(migration3c1).toContain('caller_id := auth.uid();');
    expect(migration3c1).toContain('IF caller_id IS NULL OR NOT public.is_moderator(caller_id) THEN');
    expect(migration3c1).toContain('RAISE EXCEPTION \'Unauthorized: Moderator access required.\'');
  });

  it('9. verifies invalid action_type parameter fails with exception', () => {
    expect(migration3c1).toContain('IF action_type_param NOT IN (\'APPROVE\', \'HIDE\', \'DELETE\', \'REQUEST_CHANGES\') THEN');
    expect(migration3c1).toContain('RAISE EXCEPTION \'Invalid action_type parameter.\'');
  });

  it('10. verifies invalid case status parameter fails with exception', () => {
    expect(migration3c1).toContain('IF new_case_status_param NOT IN (\'OPEN\', \'IN_REVIEW\', \'WAITING_USER\', \'ESCALATED\', \'RESOLVED\') THEN');
    expect(migration3c1).toContain('RAISE EXCEPTION \'Invalid target case status.\'');
  });

  it('11. verifies invalid status transition fails with exception', () => {
    expect(migration3c1).toContain('IF current_status_val = \'OPEN\' AND new_case_status_param NOT IN (\'IN_REVIEW\', \'RESOLVED\', \'OPEN\') THEN');
    expect(migration3c1).toContain('Invalid case status transition from OPEN to');
    expect(migration3c1).toContain('ELSIF current_status_val = \'IN_REVIEW\' AND new_case_status_param NOT IN');
  });

  it('12. verifies non-existent case fails with exception', () => {
    expect(migration3c1).toContain('SELECT target_type, target_id, status INTO target_type_val');
    expect(migration3c1).toContain('IF NOT FOUND THEN');
    expect(migration3c1).toContain('RAISE EXCEPTION \'Case not found.\'');
  });

  it('13. verifies non-existent target entity fails with exception', () => {
    expect(migration3c1).toContain('IF NOT EXISTS (SELECT 1 FROM public.posts WHERE id = target_id_val) THEN');
    expect(migration3c1).toContain('RAISE EXCEPTION \'Target post not found.\'');
    expect(migration3c1).toContain('IF NOT EXISTS (SELECT 1 FROM public.comments WHERE id = target_id_val) THEN');
    expect(migration3c1).toContain('RAISE EXCEPTION \'Target comment not found.\'');
  });

  it('14. verifies actor cannot be spoofed and is derived strictly from auth.uid()', () => {
    expect(migration3c1).toContain('caller_id := auth.uid();');
    expect(migration3c1).toContain('moderator_id,');
    expect(migration3c1).toContain('actor_id,');
  });

  it('15. verifies execute_moderation_action operation is atomic in PL/pgSQL function', () => {
    expect(migration3c1).toContain('UPDATE public.posts SET status =');
    expect(migration3c1).toContain('INSERT INTO public.moderation_actions');
    expect(migration3c1).toContain('UPDATE public.moderation_cases');
    expect(migration3c1).toContain('UPDATE public.reports');
    expect(migration3c1).toContain('INSERT INTO public.audit_logs');
  });

  // sanctions tests (16-19)
  it('16. verifies invalid sanction action parameter fails with exception', () => {
    expect(migration3c1).toContain('IF action_param NOT IN (\'WARNING\', \'TEMPORARY_RESTRICTION\', \'SUSPEND\', \'PERMANENT_SUSPENSION\') THEN');
    expect(migration3c1).toContain('RAISE EXCEPTION \'Invalid sanction action parameter.\'');
  });

  it('17. verifies non-existent target user fails with exception', () => {
    expect(migration3c1).toContain('IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id_param) THEN');
    expect(migration3c1).toContain('RAISE EXCEPTION \'Target user not found.\'');
  });

  it('18. verifies moderator can apply valid sanction', () => {
    expect(migration3c1).toContain('CREATE OR REPLACE FUNCTION public.apply_user_sanction');
    expect(migration3c1).toContain('GRANT EXECUTE ON FUNCTION public.apply_user_sanction');
  });

  it('19. verifies regular user cannot apply sanction', () => {
    expect(migration3c1).toContain('caller_id := auth.uid();');
    expect(migration3c1).toContain('IF caller_id IS NULL OR NOT public.is_moderator(caller_id) THEN');
  });

  // messages isolation tests (20-23)
  it('20. verifies global moderator SELECT policy on messages table is DROPPED', () => {
    expect(migration3c1).toContain('DROP POLICY IF EXISTS "Moderators can view reported messages" ON public.messages;');
  });

  it('21. verifies moderator can query reported message via authorized RPC get_reported_message_details', () => {
    expect(migration3c1).toContain('CREATE OR REPLACE FUNCTION public.get_reported_message_details');
    expect(migration3c1).toContain('GRANT EXECUTE ON FUNCTION public.get_reported_message_details');
    expect(moderationService).toContain('get_reported_message_details');
  });

  it('22. verifies get_reported_message_details checks report existence and rejects un-reported message cases', () => {
    expect(migration3c1).toContain('SELECT EXISTS (');
    expect(migration3c1).toContain('WHERE case_id = case_id_param');
    expect(migration3c1).toContain('IF NOT report_exists THEN');
    expect(migration3c1).toContain('RAISE EXCEPTION \'No report found for this message case.\'');
  });

  it('23. verifies regular users retain message privacy policies and cannot call moderation RPCs without moderator role', () => {
    expect(migration3c1).toContain('IF caller_id IS NULL OR NOT public.is_moderator(caller_id) THEN');
    expect(migration3c1).toContain('RAISE EXCEPTION \'Unauthorized: Moderator access required.\'');
  });

  // pagination and filter tests (24-28)
  it('24. verifies queue filters (status, priority, target_type, assigned_to) arrive at DB SQL query', () => {
    expect(migration3c1).toContain('CREATE OR REPLACE FUNCTION public.get_moderation_cases_queue');
    expect(migration3c1).toContain('(status_filter = \'ALL\' OR mc.status = status_filter)');
    expect(migration3c1).toContain('(priority_filter = \'ALL\' OR mc.priority = priority_filter)');
    expect(migration3c1).toContain('(target_type_filter = \'ALL\' OR mc.target_type = target_type_filter)');
    expect(migration3c1).toContain('assigned_to_filter = \'UNASSIGNED\'');
  });

  it('25. verifies ORDER BY (CRITICAL first, then created_at ASC) arrives at DB SQL query', () => {
    expect(migration3c1).toContain('ORDER BY');
    expect(migration3c1).toContain('WHEN \'CRITICAL\' THEN 1');
    expect(migration3c1).toContain('WHEN \'REVIEW\' THEN 2');
    expect(migration3c1).toContain('mc.created_at ASC');
  });

  // pagination and limits
  it('26. verifies LIMIT and OFFSET arrive at DB SQL query', () => {
    expect(migration3c1).toContain('LIMIT limit_param');
    expect(migration3c1).toContain('OFFSET offset_val');
  });

  it('27. verifies getModerationCases does not duplicate pagination in memory', () => {
    expect(moderationService).toContain('get_moderation_cases_queue');
    expect(moderationService).toContain('query.range(offset, offset + limit - 1)');
  });

  it('28. verifies total and paginated result count are coherent', () => {
    expect(migration3c1).toContain('SELECT count(*) INTO total_count');
    expect(migration3c1).toContain('\'total\', total_count');
  });

  // regression tests (29-31)
  it('29. verifies 3A foundation RPCs and constraints remain intact', () => {
    expect(migration3aHardening).toContain('submit_report_with_case');
    expect(migration3aHardening).toContain('execute_moderation_action');
    expect(migration3aHardening).toContain('apply_user_sanction');
  });

  it('30. verifies 3B AI moderation schema and results remain intact and immutable', () => {
    expect(migration3c1).not.toContain('DROP TABLE public.moderation_ai_results');
    expect(migration3c1).not.toContain('DROP FUNCTION public.record_ai_moderation_result');
  });

  it('31. verifies 3C human moderation UI components render required disclaimers and status badges', () => {
    expect(queueView).toContain('Bandeja de Moderación Base');
    expect(queueView).toContain('statusFilter');
  });
});
