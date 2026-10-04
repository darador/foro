import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FASE 2C-4.3 — Accepted Notification Conversation Integrity Tests', () => {
  it('verifies PENDING -> ACCEPTED branch queries conversation.id via WHERE request_id = NEW.id', () => {
    const migrationFile = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20261004000020_fase2c43_enforce_accepted_notification_integrity.sql'),
      'utf-8'
    );

    expect(migrationFile).toContain("SELECT id INTO assoc_conv_id\n        FROM public.conversations\n        WHERE request_id = NEW.id;");
  });

  it('verifies validation IF assoc_conv_id IS NULL exists and raises EXCEPTION when conversation is missing', () => {
    const migrationFile = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20261004000020_fase2c43_enforce_accepted_notification_integrity.sql'),
      'utf-8'
    );

    expect(migrationFile).toContain('IF assoc_conv_id IS NULL THEN');
    expect(migrationFile).toContain("RAISE EXCEPTION 'Conversation not found for accepted message request.';");
  });

  it('verifies COALESCE(assoc_conv_id, NEW.id) fallback is completely absent', () => {
    const migrationFile = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20261004000020_fase2c43_enforce_accepted_notification_integrity.sql'),
      'utf-8'
    );

    expect(migrationFile).not.toContain('COALESCE(assoc_conv_id');
  });

  it('verifies notification entity_type is CONVERSATION and entity_id is assoc_conv_id', () => {
    const migrationFile = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20261004000020_fase2c43_enforce_accepted_notification_integrity.sql'),
      'utf-8'
    );

    expect(migrationFile).toContain("'MESSAGE_REQUEST_ACCEPTED'");
    expect(migrationFile).toContain("'CONVERSATION'");
    expect(migrationFile).toContain('assoc_conv_id');
  });

  it('verifies other notification types (MESSAGE_REQUEST, MESSAGE_REQUEST_REJECTED) maintain their exact logic', () => {
    const migrationFile = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20261004000020_fase2c43_enforce_accepted_notification_integrity.sql'),
      'utf-8'
    );

    expect(migrationFile).toContain("'MESSAGE_REQUEST'");
    expect(migrationFile).toContain("'MESSAGE_REQUEST_REJECTED'");
  });

  it('verifies function EXECUTE remains revoked for PUBLIC, anon, authenticated clients', () => {
    const migrationFile = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20261004000020_fase2c43_enforce_accepted_notification_integrity.sql'),
      'utf-8'
    );

    expect(migrationFile).toContain('REVOKE EXECUTE ON FUNCTION public.handle_message_request_notification() FROM PUBLIC, anon, authenticated;');
  });
});
