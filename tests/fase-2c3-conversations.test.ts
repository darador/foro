import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FASE 2C-3 — Conversations & Chat Security & Contract Audits', () => {
  // 1. AST & Code Pattern Inspections
  describe('Contract Audit: Frontend Mutation Restrictions', () => {
    it('does not allow direct INSERT into conversations from frontend components or services', () => {
      const chatViewFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/messaging/ChatView.tsx'),
        'utf-8'
      );
      const messagingServiceFile = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/services/messaging.ts'),
        'utf-8'
      );

      // Frontend should never issue direct insert on conversations
      expect(chatViewFile).not.toContain(".from('conversations').insert");
      expect(messagingServiceFile).not.toContain(".from('conversations').insert");
    });

    it('does not allow direct INSERT into conversation_members from frontend components or services', () => {
      const chatViewFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/messaging/ChatView.tsx'),
        'utf-8'
      );
      const messagingServiceFile = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/services/messaging.ts'),
        'utf-8'
      );

      expect(chatViewFile).not.toContain(".from('conversation_members').insert");
      expect(messagingServiceFile).not.toContain(".from('conversation_members').insert");
    });

    it('always uses soft_delete_message RPC instead of direct SQL DELETE on messages', () => {
      const clientService = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/services/client/messaging.ts'),
        'utf-8'
      );
      const serverService = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/services/messaging.ts'),
        'utf-8'
      );

      expect(clientService).toContain("rpc('soft_delete_message'");
      expect(serverService).toContain("rpc('soft_delete_message'");
      expect(clientService).not.toContain(".from('messages').delete(");
      expect(serverService).not.toContain(".from('messages').delete(");
    });
  });

  // 2. Unit Validation Rules
  describe('Unit Validation: Message Content Rules', () => {
    function validateMessageContent(content: string): { valid: boolean; error?: string } {
      const clean = content.trim();
      if (!clean || clean.length === 0) {
        return { valid: false, error: 'El mensaje no puede estar vacío' };
      }
      if (clean.length > 2000) {
        return { valid: false, error: 'El mensaje no puede superar los 2000 caracteres' };
      }
      return { valid: true };
    }

    it('rejects empty message strings', () => {
      expect(validateMessageContent('')).toEqual({
        valid: false,
        error: 'El mensaje no puede estar vacío',
      });
      expect(validateMessageContent('   ')).toEqual({
        valid: false,
        error: 'El mensaje no puede estar vacío',
      });
    });

    it('rejects messages longer than 2000 characters', () => {
      const longMsg = 'a'.repeat(2001);
      expect(validateMessageContent(longMsg)).toEqual({
        valid: false,
        error: 'El mensaje no puede superar los 2000 caracteres',
      });
    });

    it('accepts valid text messages between 1 and 2000 characters', () => {
      expect(validateMessageContent('Hola, ¿cómo estás?')).toEqual({ valid: true });
      expect(validateMessageContent('a'.repeat(2000))).toEqual({ valid: true });
    });
  });

  // 3. Sender Verification & Authorization Integrity
  describe('Security Contract: Sender Identity & Access Protection', () => {
    it('requires sender_id to be obtained strictly from auth.uid() when sending messages', () => {
      const clientService = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/services/client/messaging.ts'),
        'utf-8'
      );

      // Must call auth.getUser() and use user.id
      expect(clientService).toContain('auth.getUser()');
      expect(clientService).toContain('sender_id: user.id');
    });

    it('verifies IDOR defense on /mensajes/[conversationId] server page', () => {
      const pageFile = fs.readFileSync(
        path.join(process.cwd(), 'src/app/mensajes/[conversationId]/page.tsx'),
        'utf-8'
      );

      // Must handle null conversation (unauthorized or missing) with generic generic message
      expect(pageFile).toContain('No tenés acceso a esta conversación');
      expect(pageFile).toContain('getConversationDetails(conversationId)');
    });
  });

  // 4. Migration & RLS Contract Inspection
  describe('Database Security Contract: RLS & Helper Integrity', () => {
    it('verifies RLS policies on messages enforce is_conversation_active_for_user', () => {
      const rlsFixMigration = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000013_fase2c1_can_send_message_rls_fix.sql'),
        'utf-8'
      );

      expect(rlsFixMigration).toContain('is_conversation_active_for_user');
      expect(rlsFixMigration).toContain('ON public.messages FOR SELECT');
      expect(rlsFixMigration).toContain('ON public.messages FOR INSERT');
    });

    it('verifies soft_delete_message RPC checks sender_id = auth.uid()', () => {
      const baseSecMigration = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000010_fase2c1_private_messaging_security.sql'),
        'utf-8'
      );

      expect(baseSecMigration).toContain('CREATE OR REPLACE FUNCTION public.soft_delete_message');
      expect(baseSecMigration).toContain('sender_id = caller_id');
      expect(baseSecMigration).toContain('SET deleted_at = now()');
    });
  });
});
