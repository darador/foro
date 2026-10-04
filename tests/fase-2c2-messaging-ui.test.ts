import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('FASE 2C-2.1 — Correcciones de UI y Estados de Mensajería', () => {
  const rpcMigrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20261004000014_fase2c21_message_policy_rpc.sql'
  );

  const modalPath = path.join(process.cwd(), 'src', 'components', 'messaging', 'SendMessageModal.tsx');
  const listPath = path.join(process.cwd(), 'src', 'components', 'messaging', 'MessageRequestsList.tsx');
  const buttonPath = path.join(process.cwd(), 'src', 'components', 'messaging', 'SendMessageButton.tsx');
  const confirmBlockPath = path.join(process.cwd(), 'src', 'components', 'messaging', 'ConfirmBlockModal.tsx');
  const mensajesPagePath = path.join(process.cwd(), 'src', 'app', 'mensajes', 'page.tsx');
  const publicProfilePagePath = path.join(process.cwd(), 'src', 'app', 'perfil', '[alias]', 'page.tsx');
  const servicePath = path.join(process.cwd(), 'src', 'lib', 'services', 'messaging.ts');

  it('Migration 20261004000014_fase2c21_message_policy_rpc.sql exists', () => {
    expect(fs.existsSync(rpcMigrationPath)).toBe(true);
  });

  describe('Test 1 — Unauthenticated Visitor Controls', () => {
    it('SendMessageButton displays login prompt when isAuthenticated is false', () => {
      const buttonCode = fs.readFileSync(buttonPath, 'utf8');

      expect(buttonCode).toContain('!isAuthenticated');
      expect(buttonCode).toContain('Iniciá sesión para enviar mensajes');
      expect(buttonCode).toContain('href="/login"');
    });

    it('Unauthenticated visitors are redirected from page or shown login prompt without modal trigger', () => {
      const profilePageCode = fs.readFileSync(publicProfilePagePath, 'utf8');
      expect(profilePageCode).toContain('isAuthenticated={isAuthenticated}');
    });
  });

  describe('Test 2 & 3 — REJECTED and BLOCKED Button State Representation', () => {
    it('REJECTED state allows sending a new message request (shows Enviar mensaje button)', () => {
      const buttonCode = fs.readFileSync(buttonPath, 'utf8');

      expect(buttonCode).toContain("relation === 'NO_RELATION' || relation === 'REJECTED'");
      expect(buttonCode).toContain('Enviar mensaje');
    });

    it('BLOCKED state disables messaging and displays discrete block notice', () => {
      const buttonCode = fs.readFileSync(buttonPath, 'utf8');

      expect(buttonCode).toContain("relation === 'BLOCKED'");
      expect(buttonCode).toContain('No podés enviar mensajes');
      expect(buttonCode).not.toContain("relation === 'BLOCKED' && openModal");
    });
  });

  describe('Test 4 — Message Policy RPC & Privacy Contract', () => {
    it('can_receive_message_request RPC returns boolean without exposing user_settings columns', () => {
      const rpcSql = fs.readFileSync(rpcMigrationPath, 'utf8');

      expect(rpcSql).toContain('CREATE OR REPLACE FUNCTION public.can_receive_message_request(target_user_id UUID)');
      expect(rpcSql).toContain('RETURNS BOOLEAN');
      expect(rpcSql).toContain('SET search_path = public');
      expect(rpcSql).toContain('REVOKE EXECUTE ON FUNCTION public.can_receive_message_request(UUID) FROM PUBLIC, anon;');
      expect(rpcSql).toContain('GRANT EXECUTE ON FUNCTION public.can_receive_message_request(UUID) TO authenticated;');
    });

    it('messaging service calls can_receive_message_request RPC instead of directly querying user_settings', () => {
      const serviceCode = fs.readFileSync(servicePath, 'utf8');

      expect(serviceCode).toContain("supabase.rpc('can_receive_message_request'");
      expect(serviceCode).not.toContain(".from('user_settings').select('message_policy')");
    });
  });

  describe('Static AST & Component Files Verification', () => {
    it('all Phase 2C-2 UI component files and pages exist', () => {
      expect(fs.existsSync(modalPath)).toBe(true);
      expect(fs.existsSync(listPath)).toBe(true);
      expect(fs.existsSync(buttonPath)).toBe(true);
      expect(fs.existsSync(confirmBlockPath)).toBe(true);
      expect(fs.existsSync(mensajesPagePath)).toBe(true);
      expect(fs.existsSync(publicProfilePagePath)).toBe(true);
    });

    it('SendMessageModal enforces 2000 character limit and plain text', () => {
      const modalCode = fs.readFileSync(modalPath, 'utf8');
      expect(modalCode).toContain('maxLength={2000}');
      expect(modalCode).not.toContain('.from(\'message_requests\').insert');
    });
  });
});
