import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Fase 2C-1 — Corrección RLS de can_send_message & Hardening de Seguridad', () => {
  const rlsFixMigrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20261004000013_fase2c1_can_send_message_rls_fix.sql'
  );

  const stateHardeningMigrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20261004000012_fase2c1_final_state_hardening.sql'
  );

  const correctionsMigrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20261004000011_fase2c1_messaging_security_corrections.sql'
  );

  const baseMigrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20261004000010_fase2c1_private_messaging_security.sql'
  );

  const servicePath = path.join(
    process.cwd(),
    'src',
    'lib',
    'services',
    'messaging.ts'
  );

  it('Migration 20261004000013_fase2c1_can_send_message_rls_fix.sql exists', () => {
    expect(fs.existsSync(rlsFixMigrationPath)).toBe(true);
  });

  describe('Static AST & SQL Contract Verification for Migration 000013 (RLS Helper Fix)', () => {
    const sql13 = fs.readFileSync(rlsFixMigrationPath, 'utf8');

    it('creates is_conversation_active_for_user helper bound strictly to auth.uid() without user_id argument', () => {
      expect(sql13).toContain('CREATE OR REPLACE FUNCTION public.is_conversation_active_for_user(target_conversation_id UUID)');
      expect(sql13).toContain('caller_id := auth.uid();');
      expect(sql13).not.toContain('target_user_id UUID');
      expect(sql13).toContain("req_status <> 'ACCEPTED'");
    });

    it('grants execute on is_conversation_active_for_user only to authenticated for RLS evaluation', () => {
      expect(sql13).toContain('REVOKE EXECUTE ON FUNCTION public.is_conversation_active_for_user(UUID) FROM PUBLIC, anon;');
      expect(sql13).toContain('GRANT EXECUTE ON FUNCTION public.is_conversation_active_for_user(UUID) TO authenticated;');
    });

    it('ensures can_send_message remains revoked from PUBLIC, anon, AND authenticated', () => {
      expect(sql13).toContain('REVOKE EXECUTE ON FUNCTION public.can_send_message(UUID, UUID) FROM PUBLIC, anon, authenticated;');
    });

    it('rebinds messages SELECT and INSERT RLS policies to use is_conversation_active_for_user', () => {
      expect(sql13).toContain('CREATE POLICY "Conversation members can view messages"');
      expect(sql13).toContain('public.is_conversation_active_for_user(conversation_id)');
      expect(sql13).toContain('CREATE POLICY "Conversation members can send messages if request accepted and not blocked"');
      expect(sql13).toContain('sender_id = auth.uid()');
    });
  });

  describe('Static AST & SQL Contract Verification for State Machine (000012)', () => {
    const sql12 = fs.readFileSync(stateHardeningMigrationPath, 'utf8');

    it('enforces strict PENDING status check in block_message_request (rejecting ACCEPTED, REJECTED, BLOCKED transitions)', () => {
      expect(sql12).toContain('CREATE OR REPLACE FUNCTION public.block_message_request');
      expect(sql12).toContain("req_record.status <> 'PENDING'");
      expect(sql12).toContain("Only PENDING message requests can be blocked.");
    });
  });

  describe('State Machine & Privacy Contract Verification Across All Messaging Migrations', () => {
    const sql10 = fs.readFileSync(baseMigrationPath, 'utf8');
    const sql11 = fs.readFileSync(correctionsMigrationPath, 'utf8');
    const allSql = sql10 + '\n' + sql11 + '\n';

    it('create_message_request creates requests strictly in PENDING status', () => {
      expect(allSql).toContain("INSERT INTO public.message_requests");
      expect(allSql).toContain("'PENDING'");
    });

    it('accept_message_request requires status = PENDING before transitioning to ACCEPTED', () => {
      expect(allSql).toContain("req_record.status <> 'PENDING'");
      expect(allSql).toContain("Only PENDING message requests can be accepted.");
    });

    it('reject_message_request requires status = PENDING before transitioning to REJECTED', () => {
      expect(allSql).toContain("Only PENDING message requests can be rejected.");
    });

    it('direct mutations on message_requests are blocked via RLS', () => {
      expect(sql11).toContain('CREATE POLICY "No direct insert on message_requests"');
      expect(sql11).toContain('CREATE POLICY "No direct update on message_requests"');
      expect(sql11).toContain('WITH CHECK (false)');
      expect(sql11).toContain('USING (false)');
    });

    it('is_blocked_between is revoked from client execution', () => {
      expect(sql11).toContain('REVOKE EXECUTE ON FUNCTION public.is_blocked_between(UUID, UUID) FROM PUBLIC, anon, authenticated;');
    });
  });

  describe('Messaging Service Module Verification', () => {
    it('service file src/lib/services/messaging.ts exists and exports RPC wrapper methods', () => {
      expect(fs.existsSync(servicePath)).toBe(true);

      const serviceCode = fs.readFileSync(servicePath, 'utf8');

      expect(serviceCode).toContain('export async function sendRequest');
      expect(serviceCode).toContain('export async function acceptRequest');
      expect(serviceCode).toContain('export async function rejectRequest');
      expect(serviceCode).toContain('export async function blockRequest');
      expect(serviceCode).toContain('export async function getUserRequests');
      expect(serviceCode).toContain('export async function getConversationMessages');
      expect(serviceCode).toContain('export async function sendMessage');
      expect(serviceCode).toContain('export async function deleteMessage');
      expect(serviceCode).toContain('export async function updateMessagePolicy');
    });
  });
});
