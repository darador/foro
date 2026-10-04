import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Fase 2C-1 — Modelo de Datos y Seguridad para Mensajería Privada', () => {
  const migrationPath = path.join(
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

  it('Migration 20261004000010_fase2c1_private_messaging_security.sql exists', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  describe('Static AST & SQL Contract Verification for Migration 000010', () => {
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    it('creates user_settings table with message_policy column and RLS', () => {
      expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.user_settings');
      expect(migrationSql).toContain("message_policy TEXT NOT NULL DEFAULT 'EVERYONE'");
      expect(migrationSql).toContain("CHECK (message_policy IN ('EVERYONE', 'NOBODY'))");
      expect(migrationSql).toContain('ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;');
    });

    it('creates symmetric unique index on active PENDING message_requests', () => {
      expect(migrationSql).toContain('idx_unique_active_message_request');
      expect(migrationSql).toContain('LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id)');
      expect(migrationSql).toContain("WHERE status = 'PENDING'");
    });

    it('adds resolved_at to message_requests and deleted_at to messages', () => {
      expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;');
      expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;');
      expect(migrationSql).toContain('chk_message_content_length');
    });

    it('implements is_blocked_between helper with SET search_path = public', () => {
      expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.is_blocked_between');
      expect(migrationSql).toContain('SET search_path = public');
    });

    it('implements SECURITY DEFINER RPCs with SET search_path = public', () => {
      const rpcs = [
        'create_message_request',
        'accept_message_request',
        'reject_message_request',
        'block_message_request',
        'soft_delete_message',
      ];

      for (const rpc of rpcs) {
        expect(migrationSql).toContain(`CREATE OR REPLACE FUNCTION public.${rpc}`);
      }

      // Check search_path count matches SECURITY DEFINER functions count
      const searchPathCount = (migrationSql.match(/SET search_path = public/g) || []).length;
      expect(searchPathCount).toBeGreaterThanOrEqual(6);
    });

    it('revokes execute grants from PUBLIC/anon and grants only to authenticated', () => {
      expect(migrationSql).toContain('REVOKE EXECUTE ON FUNCTION public.create_message_request FROM PUBLIC, anon;');
      expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.create_message_request TO authenticated;');
      expect(migrationSql).toContain('REVOKE EXECUTE ON FUNCTION public.accept_message_request FROM PUBLIC, anon;');
      expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.accept_message_request TO authenticated;');
    });

    it('enforces RLS blocking direct INSERT/UPDATE/DELETE on conversations and members', () => {
      expect(migrationSql).toContain('No direct insert on conversations');
      expect(migrationSql).toContain('No direct update on conversations');
      expect(migrationSql).toContain('No direct insert on conversation_members');
      expect(migrationSql).toContain('No direct update on conversation_members');
      expect(migrationSql).toContain('No direct delete on conversation_members');
      expect(migrationSql).toContain('No direct update on messages');
      expect(migrationSql).toContain('No direct delete on messages');
    });
  });

  describe('Messaging Service Module', () => {
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
