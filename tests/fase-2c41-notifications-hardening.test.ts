import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FASE 2C-4.1 — Notification Integrity & Permission Hardening Tests', () => {
  describe('Static Contract: Column-Level UPDATE Privilege on notifications', () => {
    it('verifies general UPDATE on public.notifications is REVOKED from PUBLIC, anon, authenticated', () => {
      const migrationFile = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000018_fase2c41_notifications_security_hardening.sql'),
        'utf-8'
      );

      expect(migrationFile).toContain('REVOKE UPDATE ON public.notifications FROM PUBLIC, anon, authenticated;');
    });

    it('verifies UPDATE is GRANTED to authenticated strictly on read_at column', () => {
      const migrationFile = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000018_fase2c41_notifications_security_hardening.sql'),
        'utf-8'
      );

      expect(migrationFile).toContain('GRANT UPDATE (read_at) ON public.notifications TO authenticated;');
    });

    it('verifies non-read_at columns (actor_id, type, entity_type, entity_id, user_id, created_at) do NOT receive UPDATE grants', () => {
      const migrationFile = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000018_fase2c41_notifications_security_hardening.sql'),
        'utf-8'
      );

      expect(migrationFile).not.toContain('GRANT UPDATE (actor_id');
      expect(migrationFile).not.toContain('GRANT UPDATE (type');
      expect(migrationFile).not.toContain('GRANT UPDATE (entity_id');
      expect(migrationFile).not.toContain('GRANT UPDATE (user_id');
      expect(migrationFile).not.toContain('GRANT UPDATE (created_at');
    });
  });

  describe('Static Contract: Internal Trigger Function Grants', () => {
    it('verifies EXECUTE on handle_message_request_notification is REVOKED from PUBLIC, anon, authenticated', () => {
      const migrationFile = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000018_fase2c41_notifications_security_hardening.sql'),
        'utf-8'
      );

      expect(migrationFile).toContain(
        'REVOKE EXECUTE ON FUNCTION public.handle_message_request_notification() FROM PUBLIC, anon, authenticated;'
      );
    });

    it('verifies EXECUTE on handle_new_message_notification is REVOKED from PUBLIC, anon, authenticated', () => {
      const migrationFile = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000018_fase2c41_notifications_security_hardening.sql'),
        'utf-8'
      );

      expect(migrationFile).toContain(
        'REVOKE EXECUTE ON FUNCTION public.handle_new_message_notification() FROM PUBLIC, anon, authenticated;'
      );
    });
  });

  describe('Static Contract: Client RPC Grants', () => {
    it('verifies mark_notification_read, mark_all_notifications_read, get_unread_notifications_count allow authenticated and revoke anon', () => {
      const migrationFile = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000018_fase2c41_notifications_security_hardening.sql'),
        'utf-8'
      );

      expect(migrationFile).toContain('REVOKE EXECUTE ON FUNCTION public.mark_notification_read(UUID) FROM PUBLIC, anon;');
      expect(migrationFile).toContain('GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;');
      expect(migrationFile).toContain('REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC, anon;');
      expect(migrationFile).toContain('GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;');
      expect(migrationFile).toContain('REVOKE EXECUTE ON FUNCTION public.get_unread_notifications_count() FROM PUBLIC, anon;');
      expect(migrationFile).toContain('GRANT EXECUTE ON FUNCTION public.get_unread_notifications_count() TO authenticated;');
    });
  });
});
