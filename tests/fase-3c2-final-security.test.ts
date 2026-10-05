import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FASE 3C.2 — Final Security Hardening Contract Tests', () => {
  const migration3c2Path = path.join(
    process.cwd(),
    'supabase/migrations/20261004000032_fase3c2_final_security_hardening.sql'
  );
  const moderationServicePath = path.join(process.cwd(), 'src/lib/services/moderation.ts');

  const migration3c2 = fs.readFileSync(migration3c2Path, 'utf-8');
  const moderationService = fs.readFileSync(moderationServicePath, 'utf-8');

  // 1. expires_at Sanction Validation Tests
  it('verifies apply_user_sanction enforces WARNING expires_at IS NULL rule', () => {
    expect(migration3c2).toContain('IF action_param = \'WARNING\' THEN');
    expect(migration3c2).toContain('IF expires_at_param IS NOT NULL THEN');
    expect(migration3c2).toContain('RAISE EXCEPTION \'Warning sanction must not have an expiration date.\'');
  });

  it('verifies apply_user_sanction enforces TEMPORARY_RESTRICTION and SUSPEND future expires_at rule', () => {
    expect(migration3c2).toContain('ELSIF action_param IN (\'TEMPORARY_RESTRICTION\', \'SUSPEND\') THEN');
    expect(migration3c2).toContain('IF expires_at_param IS NULL THEN');
    expect(migration3c2).toContain('RAISE EXCEPTION \'Temporary sanction requires an expiration date.\'');
    expect(migration3c2).toContain('IF expires_at_param <= now() THEN');
    expect(migration3c2).toContain('RAISE EXCEPTION \'Expiration date must be in the future.\'');
  });

  it('verifies apply_user_sanction enforces PERMANENT_SUSPENSION expires_at IS NULL rule', () => {
    expect(migration3c2).toContain('ELSIF action_param = \'PERMANENT_SUSPENSION\' THEN');
    expect(migration3c2).toContain('IF expires_at_param IS NOT NULL THEN');
    expect(migration3c2).toContain('RAISE EXCEPTION \'Permanent suspension sanction must not have an expiration date.\'');
  });

  // 2. case_id ↔ target_user_id Integrity Tests
  it('verifies apply_user_sanction validates case_id existence and user ownership/authorship integrity', () => {
    expect(migration3c2).toContain('IF case_id_param IS NOT NULL THEN');
    expect(migration3c2).toContain('SELECT target_type, target_id INTO case_target_type, case_target_id');
    expect(migration3c2).toContain('RAISE EXCEPTION \'Target case not found.\'');
    expect(migration3c2).toContain('IF case_target_type = \'PROFILE\' THEN');
    expect(migration3c2).toContain('ELSIF case_target_type = \'POST\' THEN');
    expect(migration3c2).toContain('SELECT author_id INTO case_author_id FROM public.posts');
    expect(migration3c2).toContain('ELSIF case_target_type = \'COMMENT\' THEN');
    expect(migration3c2).toContain('SELECT author_id INTO case_author_id FROM public.comments');
    expect(migration3c2).toContain('ELSIF case_target_type = \'MESSAGE\' THEN');
    expect(migration3c2).toContain('SELECT sender_id INTO case_author_id FROM public.messages');
    expect(migration3c2).toContain('IF NOT is_valid_case_user THEN');
    expect(migration3c2).toContain('RAISE EXCEPTION \'Target user does not match the case target content author or profile.\'');
  });

  // 3. Complete Removal of Direct Fallback to messages Table
  it('verifies moderation service uses EXCLUSIVELY get_reported_message_details RPC for message target detail with NO fallback to messages', () => {
    expect(moderationService).toContain('caseData.target_type === \'MESSAGE\'');
    expect(moderationService).toContain('get_reported_message_details');

    // Extract the block for caseData.target_type === 'MESSAGE'
    const messageBlockStart = moderationService.indexOf("caseData.target_type === 'MESSAGE'");
    const messageBlockEnd = moderationService.indexOf("Content version history", messageBlockStart);
    const messageBlock = moderationService.substring(messageBlockStart, messageBlockEnd);

    expect(messageBlock).not.toContain('.from(\'messages\')');
  });
});
