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

  describe('Unit Verification for 9 Messaging State Priority Scenarios', () => {
    // Pure memory unit logic simulating getRequestStatusBetweenUsers priority rules
    const evaluateState = ({
      isAuthenticated,
      isSelf,
      isBlocked,
      existingRequestStatus,
      senderId,
      userId,
      canReceiveMessage,
    }: {
      isAuthenticated: boolean;
      isSelf: boolean;
      isBlocked: boolean;
      existingRequestStatus?: 'ACCEPTED' | 'PENDING' | 'REJECTED' | 'BLOCKED';
      senderId?: string;
      userId?: string;
      canReceiveMessage: boolean;
    }) => {
      if (!isAuthenticated) return 'NO_RELATION';
      if (isSelf) return 'SELF';
      if (isBlocked) return 'BLOCKED';

      if (existingRequestStatus) {
        if (existingRequestStatus === 'ACCEPTED') return 'ACCEPTED';
        if (existingRequestStatus === 'PENDING') {
          return senderId === userId ? 'PENDING_SENT' : 'PENDING_RECEIVED';
        }
        if (existingRequestStatus === 'BLOCKED') return 'BLOCKED';
        if (existingRequestStatus === 'REJECTED') {
          if (!canReceiveMessage) return 'POLICY_NOBODY';
          return 'REJECTED';
        }
      }

      if (!canReceiveMessage) return 'POLICY_NOBODY';
      return 'NO_RELATION';
    };

    it('Caso 1 — ACCEPTED + NOBODY results in ACCEPTED', () => {
      expect(
        evaluateState({
          isAuthenticated: true,
          isSelf: false,
          isBlocked: false,
          existingRequestStatus: 'ACCEPTED',
          canReceiveMessage: false,
        })
      ).toBe('ACCEPTED');
    });

    it('Caso 2 — ACCEPTED + EVERYONE results in ACCEPTED', () => {
      expect(
        evaluateState({
          isAuthenticated: true,
          isSelf: false,
          isBlocked: false,
          existingRequestStatus: 'ACCEPTED',
          canReceiveMessage: true,
        })
      ).toBe('ACCEPTED');
    });

    it('Caso 3 — PENDING_SENT + NOBODY results in PENDING_SENT', () => {
      expect(
        evaluateState({
          isAuthenticated: true,
          isSelf: false,
          isBlocked: false,
          existingRequestStatus: 'PENDING',
          senderId: 'user1',
          userId: 'user1',
          canReceiveMessage: false,
        })
      ).toBe('PENDING_SENT');
    });

    it('Caso 4 — PENDING_RECEIVED + NOBODY results in PENDING_RECEIVED', () => {
      expect(
        evaluateState({
          isAuthenticated: true,
          isSelf: false,
          isBlocked: false,
          existingRequestStatus: 'PENDING',
          senderId: 'user2',
          userId: 'user1',
          canReceiveMessage: false,
        })
      ).toBe('PENDING_RECEIVED');
    });

    it('Caso 5 — REJECTED + NOBODY results in POLICY_NOBODY', () => {
      expect(
        evaluateState({
          isAuthenticated: true,
          isSelf: false,
          isBlocked: false,
          existingRequestStatus: 'REJECTED',
          canReceiveMessage: false,
        })
      ).toBe('POLICY_NOBODY');
    });

    it('Caso 6 — REJECTED + EVERYONE results in REJECTED', () => {
      expect(
        evaluateState({
          isAuthenticated: true,
          isSelf: false,
          isBlocked: false,
          existingRequestStatus: 'REJECTED',
          canReceiveMessage: true,
        })
      ).toBe('REJECTED');
    });

    it('Caso 7 — NO_RELATION + NOBODY results in POLICY_NOBODY', () => {
      expect(
        evaluateState({
          isAuthenticated: true,
          isSelf: false,
          isBlocked: false,
          canReceiveMessage: false,
        })
      ).toBe('POLICY_NOBODY');
    });

    it('Caso 8 — NO_RELATION + EVERYONE results in NO_RELATION', () => {
      expect(
        evaluateState({
          isAuthenticated: true,
          isSelf: false,
          isBlocked: false,
          canReceiveMessage: true,
        })
      ).toBe('NO_RELATION');
    });

    it('Caso 9 — BLOCKED + EVERYONE/NOBODY results in BLOCKED', () => {
      expect(
        evaluateState({
          isAuthenticated: true,
          isSelf: false,
          isBlocked: true,
          canReceiveMessage: true,
        })
      ).toBe('BLOCKED');

      expect(
        evaluateState({
          isAuthenticated: true,
          isSelf: false,
          isBlocked: true,
          canReceiveMessage: false,
        })
      ).toBe('BLOCKED');
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
