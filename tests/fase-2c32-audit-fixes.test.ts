import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FASE 2C-3.2 — Post-Audit Fixes Verification', () => {
  // 1. Non-recursive RLS for conversation_members via SECURITY DEFINER helper
  describe('Hallazgo 1: Non-recursive RLS for conversation_members', () => {
    it('verifies helper is_user_member_of_conversation is SECURITY DEFINER with search_path = public', () => {
      const migrationFile = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000016_fase2c32_conversation_members_rls_helper.sql'),
        'utf-8'
      );

      expect(migrationFile).toContain('CREATE OR REPLACE FUNCTION public.is_user_member_of_conversation');
      expect(migrationFile).toContain('SECURITY DEFINER');
      expect(migrationFile).toContain('STABLE');
      expect(migrationFile).toContain('SET search_path = public');
    });

    it('verifies Grants and Revokes on is_user_member_of_conversation helper', () => {
      const migrationFile = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000016_fase2c32_conversation_members_rls_helper.sql'),
        'utf-8'
      );

      expect(migrationFile).toContain('REVOKE EXECUTE ON FUNCTION public.is_user_member_of_conversation(UUID) FROM PUBLIC, anon');
      expect(migrationFile).toContain('GRANT EXECUTE ON FUNCTION public.is_user_member_of_conversation(UUID) TO authenticated');
    });

    it('verifies SELECT policy on conversation_members uses the SECURITY DEFINER helper to avoid RLS recursion', () => {
      const migrationFile = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000016_fase2c32_conversation_members_rls_helper.sql'),
        'utf-8'
      );

      expect(migrationFile).toContain('CREATE POLICY "Members can view co-members of own conversations"');
      expect(migrationFile).toContain('USING (\n        public.is_user_member_of_conversation(conversation_id)\n    )');
      // Must not contain recursive FROM query inside policy definition
      expect(migrationFile).not.toContain('FROM public.conversation_members cm');
    });
  });

  // 2. Blocking from ACCEPTED conversation
  describe('Hallazgo 2: Blocking from ACCEPTED Conversations', () => {
    it('verifies ChatView uses toggleBlockUser (user_blocks) when blocking from chat view', () => {
      const chatViewFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/messaging/ChatView.tsx'),
        'utf-8'
      );

      expect(chatViewFile).toContain('toggleBlockUser(currentUserId, otherUserId)');
      expect(chatViewFile).not.toContain('blockRequest(');
    });

    it('verifies block_message_request RPC strictly enforces PENDING -> BLOCKED state machine', () => {
      const blockRpcMigration = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000012_fase2c1_final_state_hardening.sql'),
        'utf-8'
      );

      expect(blockRpcMigration).toContain('CREATE OR REPLACE FUNCTION public.block_message_request');
      expect(blockRpcMigration).toContain("IF req_record.status <> 'PENDING' THEN");
      expect(blockRpcMigration).toContain("Only PENDING message requests can be blocked.");
    });

    it('verifies blocking prevents new message insertion via is_conversation_active_for_user RLS helper', () => {
      const rlsFixMigration = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000013_fase2c1_can_send_message_rls_fix.sql'),
        'utf-8'
      );

      expect(rlsFixMigration).toContain('is_conversation_active_for_user');
      expect(rlsFixMigration).toContain('JOIN public.user_blocks ub');
      expect(rlsFixMigration).toContain('IF is_blocked THEN\n        RETURN FALSE;');
    });

    it('verifies blocking prevents new message requests via create_message_request RPC', () => {
      const createReqMigration = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000010_fase2c1_private_messaging_security.sql'),
        'utf-8'
      );

      expect(createReqMigration).toContain('IF public.is_blocked_between(caller_id, target_receiver_id) THEN');
      expect(createReqMigration).toContain('Communication is blocked between these users.');
    });

    it('verifies blocking preserves conversation and message history without physical DELETEs', () => {
      const chatViewFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/messaging/ChatView.tsx'),
        'utf-8'
      );

      expect(chatViewFile).toContain('Esta conversación está bloqueada. No podés enviar nuevos mensajes.');
      expect(chatViewFile).not.toContain('deleteConversation');
    });
  });
});
