import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FASE 2C-3.1 — Audit Fixes & Security Verification', () => {
  // 1. Hallazgo 1: RLS on conversation_members
  describe('Hallazgo 1: RLS policy for conversation_members', () => {
    it('verifies migration 20261004000015 updates SELECT policy to allow co-members of own conversations', () => {
      const migrationFile = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000015_fase2c31_conversation_audit_fixes.sql'),
        'utf-8'
      );

      expect(migrationFile).toContain('Members can view co-members of own conversations');
      expect(migrationFile).toContain('cm.conversation_id = conversation_members.conversation_id');
      expect(migrationFile).toContain('cm.user_id = auth.uid()');
    });

    it('verifies direct INSERT, UPDATE, DELETE on conversation_members remain blocked', () => {
      const baseMigration = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000010_fase2c1_private_messaging_security.sql'),
        'utf-8'
      );

      expect(baseMigration).toContain('No direct insert on conversation_members');
      expect(baseMigration).toContain('No direct update on conversation_members');
      expect(baseMigration).toContain('No direct delete on conversation_members');
    });
  });

  // 2. Hallazgo 2: Trigger for conversations.updated_at
  describe('Hallazgo 2: Trigger for updating conversations.updated_at', () => {
    it('verifies trigger function handle_new_message_update_conversation exists in migration 15', () => {
      const migrationFile = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000015_fase2c31_conversation_audit_fixes.sql'),
        'utf-8'
      );

      expect(migrationFile).toContain('CREATE OR REPLACE FUNCTION public.handle_new_message_update_conversation()');
      expect(migrationFile).toContain('UPDATE public.conversations');
      expect(migrationFile).toContain('SET updated_at = now()');
      expect(migrationFile).toContain('AFTER INSERT ON public.messages');
    });

    it('verifies direct UPDATE on conversations remains disallowed for normal users', () => {
      const baseMigration = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000010_fase2c1_private_messaging_security.sql'),
        'utf-8'
      );

      expect(baseMigration).toContain('No direct update on conversations');
      expect(baseMigration).toContain('USING (false)');
    });
  });

  // 3. Hallazgo 3: Message History Limit
  describe('Hallazgo 3: Message History Limit Protection', () => {
    it('verifies getConversationMessages limits results to 50 latest messages and reverses array', () => {
      const messagingService = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/services/messaging.ts'),
        'utf-8'
      );

      expect(messagingService).toContain('export async function getConversationMessages(conversationId: string, limit = 50)');
      expect(messagingService).toContain(".order('created_at', { ascending: false })");
      expect(messagingService).toContain('.limit(limit)');
      expect(messagingService).toContain('.reverse()');
    });

    it('verifies getConversationMessagesClient limits results to 50 latest messages and reverses array', () => {
      const clientService = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/services/client/messaging.ts'),
        'utf-8'
      );

      expect(clientService).toContain('export async function getConversationMessagesClient(conversationId: string, limit = 50)');
      expect(clientService).toContain(".order('created_at', { ascending: false })");
      expect(clientService).toContain('.limit(limit)');
      expect(clientService).toContain('.reverse()');
    });
  });

  // 4. Hallazgo 4: Block System Alignment
  describe('Hallazgo 4: Blocking from Conversation Integrity', () => {
    it('verifies ChatView uses toggleBlockUser when blocking from active conversation', () => {
      const chatViewFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/messaging/ChatView.tsx'),
        'utf-8'
      );

      expect(chatViewFile).toContain('toggleBlockUser(currentUserId, otherUserId)');
    });

    it('verifies blocking does not physically delete conversation or message history', () => {
      const blockRpcMigration = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000010_fase2c1_private_messaging_security.sql'),
        'utf-8'
      );

      // block_message_request updates status to BLOCKED and inserts into user_blocks without DELETE
      expect(blockRpcMigration).toContain('CREATE OR REPLACE FUNCTION public.block_message_request');
      expect(blockRpcMigration).toContain("SET status = 'BLOCKED'");
      expect(blockRpcMigration).toContain('INSERT INTO public.user_blocks');
      expect(blockRpcMigration).not.toContain('DELETE FROM public.messages');
      expect(blockRpcMigration).not.toContain('DELETE FROM public.conversations');
    });
  });
});
