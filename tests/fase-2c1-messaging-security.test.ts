import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Fase 2C-1 — Máquina de Estados y Hardening Final de Mensajería', () => {
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

  it('Migration 20261004000012_fase2c1_final_state_hardening.sql exists', () => {
    expect(fs.existsSync(stateHardeningMigrationPath)).toBe(true);
  });

  describe('Static AST & SQL Contract Verification for Migration 000012', () => {
    const sql12 = fs.readFileSync(stateHardeningMigrationPath, 'utf8');

    it('enforces strict PENDING status check in block_message_request', () => {
      expect(sql12).toContain('CREATE OR REPLACE FUNCTION public.block_message_request');
      expect(sql12).toContain("req_record.status <> 'PENDING'");
      expect(sql12).toContain("Only PENDING message requests can be blocked.");
    });

    it('revokes execution of can_send_message from PUBLIC, anon, AND authenticated', () => {
      expect(sql12).toContain('REVOKE EXECUTE ON FUNCTION public.can_send_message(UUID, UUID) FROM PUBLIC, anon, authenticated;');
    });
  });

  describe('State Machine & Transitions Verification Across RPC Definitions', () => {
    const sql11 = fs.readFileSync(correctionsMigrationPath, 'utf8');
    const sql10 = fs.readFileSync(baseMigrationPath, 'utf8');
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
