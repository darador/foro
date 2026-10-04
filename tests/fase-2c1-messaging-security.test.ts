import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Fase 2C-1 — Correcciones de Seguridad para Mensajería Privada', () => {
  const baseMigrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20261004000010_fase2c1_private_messaging_security.sql'
  );

  const correctionsMigrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20261004000011_fase2c1_messaging_security_corrections.sql'
  );

  const servicePath = path.join(
    process.cwd(),
    'src',
    'lib',
    'services',
    'messaging.ts'
  );

  it('Migration 20261004000011_fase2c1_messaging_security_corrections.sql exists', () => {
    expect(fs.existsSync(correctionsMigrationPath)).toBe(true);
  });

  describe('Static AST & SQL Contract Verification for Migration 000011 Corrections', () => {
    const sql = fs.readFileSync(correctionsMigrationPath, 'utf8');

    it('revokes direct INSERT and UPDATE policies on message_requests for normal users', () => {
      expect(sql).toContain('DROP POLICY IF EXISTS "Users can send message requests" ON public.message_requests;');
      expect(sql).toContain('DROP POLICY IF EXISTS "Recipients can update message requests" ON public.message_requests;');
      expect(sql).toContain('CREATE POLICY "No direct insert on message_requests"');
      expect(sql).toContain('CREATE POLICY "No direct update on message_requests"');
      expect(sql).toContain('WITH CHECK (false)');
      expect(sql).toContain('USING (false)');
    });

    it('creates symmetrical unique index covering both PENDING and ACCEPTED statuses', () => {
      expect(sql).toContain('idx_unique_active_or_accepted_message_request');
      expect(sql).toContain('LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id)');
      expect(sql).toContain("WHERE status IN ('PENDING', 'ACCEPTED')");
    });

    it('revokes execution on is_blocked_between from authenticated users as well', () => {
      expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.is_blocked_between(UUID, UUID) FROM PUBLIC, anon, authenticated;');
    });

    it('hardens can_send_message with SET search_path = public and strict validations', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.can_send_message');
      expect(sql).toContain('SET search_path = public');
      expect(sql).toContain("req_status <> 'ACCEPTED'");
      expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.can_send_message(UUID, UUID) FROM PUBLIC, anon;');
      expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.can_send_message(UUID, UUID) TO authenticated;');
    });

    it('accept_message_request converts initial_message into first message in messages table', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.accept_message_request');
      expect(sql).toContain('INSERT INTO public.messages');
      expect(sql).toContain('req_record.initial_message');
    });

    it('create_message_request strictly forces auth.uid() as sender and checks status IN (PENDING, ACCEPTED)', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.create_message_request');
      expect(sql).toContain('caller_id := auth.uid();');
      expect(sql).toContain("status IN ('PENDING', 'ACCEPTED')");
      expect(sql).toContain("target_policy = 'NOBODY'");
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
