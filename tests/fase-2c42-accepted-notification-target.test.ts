import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FASE 2C-4.2 — Accepted Request Notification Target & Transactional Order Tests', () => {
  describe('Static Contract: accept_message_request Transactional Order', () => {
    it('verifies accept_message_request creates conversation and conversation_members BEFORE updating request status to ACCEPTED', () => {
      const migrationFile = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000019_fase2c42_fix_accepted_notification_target.sql'),
        'utf-8'
      );

      const convInsertIndex = migrationFile.indexOf('INSERT INTO public.conversations');
      const convMembersInsertIndex = migrationFile.indexOf('INSERT INTO public.conversation_members');
      const statusUpdateIndex = migrationFile.indexOf("SET status = 'ACCEPTED'");

      expect(convInsertIndex).toBeGreaterThan(-1);
      expect(convMembersInsertIndex).toBeGreaterThan(-1);
      expect(statusUpdateIndex).toBeGreaterThan(-1);

      // Both conversation and members MUST be inserted before message_requests status is updated to ACCEPTED
      expect(convInsertIndex).toBeLessThan(statusUpdateIndex);
      expect(convMembersInsertIndex).toBeLessThan(statusUpdateIndex);
    });

    it('verifies accept_message_request inserts exactly 2 members (sender and recipient)', () => {
      const migrationFile = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000019_fase2c42_fix_accepted_notification_target.sql'),
        'utf-8'
      );

      expect(migrationFile).toContain('(new_conv_id, req_record.sender_id, now())');
      expect(migrationFile).toContain('(new_conv_id, req_record.recipient_id, now())');
    });

    it('verifies accept_message_request checks if existing conversation already exists before creating a new one', () => {
      const migrationFile = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000019_fase2c42_fix_accepted_notification_target.sql'),
        'utf-8'
      );

      expect(migrationFile).toContain('SELECT id INTO existing_conv_id');
      expect(migrationFile).toContain('IF existing_conv_id IS NOT NULL THEN');
    });

    it('verifies accept_message_request validates recipient caller, PENDING status, and block check', () => {
      const migrationFile = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000019_fase2c42_fix_accepted_notification_target.sql'),
        'utf-8'
      );

      expect(migrationFile).toContain('IF req_record.recipient_id <> caller_id THEN');
      expect(migrationFile).toContain("IF req_record.status <> 'PENDING' THEN");
      expect(migrationFile).toContain('IF public.is_blocked_between(req_record.sender_id, req_record.recipient_id) THEN');
    });
  });

  describe('Static Contract: handle_message_request_notification Target Resolution', () => {
    it('verifies MESSAGE_REQUEST_ACCEPTED notification uses conversation.id and entity_type = CONVERSATION', () => {
      const migrationFile = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000019_fase2c42_fix_accepted_notification_target.sql'),
        'utf-8'
      );

      expect(migrationFile).toContain("SELECT id INTO assoc_conv_id\n        FROM public.conversations\n        WHERE request_id = NEW.id;");
      expect(migrationFile).toContain("IF assoc_conv_id IS NOT NULL THEN");
      expect(migrationFile).toContain("'MESSAGE_REQUEST_ACCEPTED'");
      expect(migrationFile).toContain("'CONVERSATION'");
      expect(migrationFile).toContain('assoc_conv_id');
    });

    it('verifies COALESCE(assoc_conv_id, NEW.id) fallback is REMOVED so ACCEPTED notifications never target request.id', () => {
      const migrationFile = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000019_fase2c42_fix_accepted_notification_target.sql'),
        'utf-8'
      );

      expect(migrationFile).not.toContain('COALESCE(assoc_conv_id, NEW.id)');
    });

    it('verifies trigger function EXECUTE remains revoked for clients', () => {
      const migrationFile = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000019_fase2c42_fix_accepted_notification_target.sql'),
        'utf-8'
      );

      expect(migrationFile).toContain('REVOKE EXECUTE ON FUNCTION public.handle_message_request_notification() FROM PUBLIC, anon, authenticated;');
    });
  });
});
