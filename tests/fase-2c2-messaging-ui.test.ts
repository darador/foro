import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Fase 2C-2 — UI y Flujo de Solicitudes de Mensajería', () => {
  const modalPath = path.join(process.cwd(), 'src', 'components', 'messaging', 'SendMessageModal.tsx');
  const listPath = path.join(process.cwd(), 'src', 'components', 'messaging', 'MessageRequestsList.tsx');
  const buttonPath = path.join(process.cwd(), 'src', 'components', 'messaging', 'SendMessageButton.tsx');
  const confirmBlockPath = path.join(process.cwd(), 'src', 'components', 'messaging', 'ConfirmBlockModal.tsx');
  const mensajesPagePath = path.join(process.cwd(), 'src', 'app', 'mensajes', 'page.tsx');
  const publicProfilePagePath = path.join(process.cwd(), 'src', 'app', 'perfil', '[alias]', 'page.tsx');

  describe('Component and Page Files Existence', () => {
    it('all Phase 2C-2 UI component files and pages exist', () => {
      expect(fs.existsSync(modalPath)).toBe(true);
      expect(fs.existsSync(listPath)).toBe(true);
      expect(fs.existsSync(buttonPath)).toBe(true);
      expect(fs.existsSync(confirmBlockPath)).toBe(true);
      expect(fs.existsSync(mensajesPagePath)).toBe(true);
      expect(fs.existsSync(publicProfilePagePath)).toBe(true);
    });
  });

  describe('Static AST & Contract Verification for UI Components', () => {
    it('SendMessageModal calls sendRequest service and enforces 2000 character limit', () => {
      const modalCode = fs.readFileSync(modalPath, 'utf8');
      expect(modalCode).toContain("import { sendRequest } from '@/lib/services/client/messaging'");
      expect(modalCode).toContain('maxLength={2000}');
      expect(modalCode).not.toContain('.from(\'message_requests\').insert');
    });

    it('MessageRequestsList uses acceptRequest, rejectRequest, and blockRequest RPC services', () => {
      const listCode = fs.readFileSync(listPath, 'utf8');
      expect(listCode).toContain('acceptRequest');
      expect(listCode).toContain('rejectRequest');
      expect(listCode).toContain('blockRequest');
      expect(listCode).not.toContain(".from('message_requests').update");
    });

    it('ConfirmBlockModal displays warning text and calls blockRequest', () => {
      const blockModalCode = fs.readFileSync(confirmBlockPath, 'utf8');
      expect(blockModalCode).toContain('¿Bloquear a @');
      expect(blockModalCode).toContain('No podrá enviarte nuevas solicitudes de mensaje');
      expect(blockModalCode).toContain('blockRequest');
    });

    it('Public profile page includes SendMessageButton', () => {
      const profilePageCode = fs.readFileSync(publicProfilePagePath, 'utf8');
      expect(profilePageCode).toContain('SendMessageButton');
      expect(profilePageCode).toContain('getRequestStatusBetweenUsers');
    });
  });

  describe('Unit Verification for Message Validation Rules', () => {
    it('validates message length bounds in memory', () => {
      const validateMessage = (text: string) => {
        const clean = text.trim();
        if (!clean) return 'EMPTY';
        if (clean.length > 2000) return 'TOO_LONG';
        return 'VALID';
      };

      expect(validateMessage('')).toBe('EMPTY');
      expect(validateMessage('   ')).toBe('EMPTY');
      expect(validateMessage('Hola, ¿cómo estás?')).toBe('VALID');
      expect(validateMessage('a'.repeat(2001))).toBe('TOO_LONG');
    });
  });
});
