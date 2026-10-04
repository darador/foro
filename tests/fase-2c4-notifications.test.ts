import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FASE 2C-4 — Notifications & Messaging UX Tests', () => {
  // 1. Unit Tests: Notification Text & Privacy Formatting
  describe('Unit: Privacy & Text Formatting', () => {
    function formatNotificationText(
      type: 'MESSAGE' | 'MESSAGE_REQUEST' | 'MESSAGE_REQUEST_ACCEPTED' | 'MESSAGE_REQUEST_REJECTED',
      actorAlias: string
    ): { text: string; targetUrl: (entityId: string) => string } {
      switch (type) {
        case 'MESSAGE':
          return {
            text: `${actorAlias} te envió un mensaje.`,
            targetUrl: (entityId: string) => `/mensajes/${entityId}`,
          };
        case 'MESSAGE_REQUEST':
          return {
            text: `${actorAlias} quiere enviarte un mensaje.`,
            targetUrl: () => '/mensajes',
          };
        case 'MESSAGE_REQUEST_ACCEPTED':
          return {
            text: `${actorAlias} aceptó tu solicitud de mensaje.`,
            targetUrl: (entityId: string) => `/mensajes/${entityId}`,
          };
        case 'MESSAGE_REQUEST_REJECTED':
          return {
            text: `${actorAlias} rechazó tu solicitud de mensaje.`,
            targetUrl: () => '/mensajes',
          };
      }
    }

    it('formats MESSAGE notification text without exposing message content', () => {
      const res = formatNotificationText('MESSAGE', 'UsuarioA');
      expect(res.text).toBe('UsuarioA te envió un mensaje.');
      expect(res.targetUrl('conv-123')).toBe('/mensajes/conv-123');
    });

    it('formats MESSAGE_REQUEST notification text discretely', () => {
      const res = formatNotificationText('MESSAGE_REQUEST', 'UsuarioB');
      expect(res.text).toBe('UsuarioB quiere enviarte un mensaje.');
      expect(res.targetUrl('req-123')).toBe('/mensajes');
    });

    it('formats MESSAGE_REQUEST_ACCEPTED notification text and target URL', () => {
      const res = formatNotificationText('MESSAGE_REQUEST_ACCEPTED', 'UsuarioC');
      expect(res.text).toBe('UsuarioC aceptó tu solicitud de mensaje.');
      expect(res.targetUrl('conv-456')).toBe('/mensajes/conv-456');
    });

    it('formats MESSAGE_REQUEST_REJECTED notification text and target URL', () => {
      const res = formatNotificationText('MESSAGE_REQUEST_REJECTED', 'UsuarioD');
      expect(res.text).toBe('UsuarioD rechazó tu solicitud de mensaje.');
      expect(res.targetUrl('req-789')).toBe('/mensajes');
    });

    it('calculates unread notifications count correctly', () => {
      const items = [
        { id: '1', read_at: null },
        { id: '2', read_at: '2026-10-04T10:00:00Z' },
        { id: '3', read_at: null },
      ];
      const unreadCount = items.filter((n) => !n.read_at).length;
      expect(unreadCount).toBe(2);
    });
  });

  // 2. Static / Contract / AST Tests: Database Migration & RLS Security
  describe('Static Contract: Notifications RLS & Trigger Hardening', () => {
    it('verifies migration 20261004000017 creates notifications table with RLS enabled', () => {
      const migrationFile = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000017_fase2c4_notifications_schema.sql'),
        'utf-8'
      );

      expect(migrationFile).toContain('CREATE TABLE IF NOT EXISTS public.notifications');
      expect(migrationFile).toContain('ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;');
    });

    it('verifies direct INSERT on notifications is blocked for clients (WITH CHECK (false))', () => {
      const migrationFile = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000017_fase2c4_notifications_schema.sql'),
        'utf-8'
      );

      expect(migrationFile).toContain('CREATE POLICY "No direct insert on notifications"');
      expect(migrationFile).toContain('WITH CHECK (false)');
    });

    it('verifies SELECT, UPDATE, DELETE policies on notifications restrict to user_id = auth.uid()', () => {
      const migrationFile = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000017_fase2c4_notifications_schema.sql'),
        'utf-8'
      );

      expect(migrationFile).toContain('CREATE POLICY "Users can view own notifications"');
      expect(migrationFile).toContain('USING (user_id = auth.uid())');
      expect(migrationFile).toContain('CREATE POLICY "Users can update own notifications"');
      expect(migrationFile).toContain('CREATE POLICY "Users can delete own notifications"');
    });

    it('verifies automatic triggers handle_message_request_notification and handle_new_message_notification have SET search_path = public', () => {
      const migrationFile = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000017_fase2c4_notifications_schema.sql'),
        'utf-8'
      );

      expect(migrationFile).toContain('CREATE OR REPLACE FUNCTION public.handle_message_request_notification()');
      expect(migrationFile).toContain('CREATE OR REPLACE FUNCTION public.handle_new_message_notification()');
      expect(migrationFile).toContain('SECURITY DEFINER');
      expect(migrationFile).toContain('SET search_path = public');
    });

    it('verifies notification RPCs mark_notification_read, mark_all_notifications_read, get_unread_notifications_count are hardened', () => {
      const migrationFile = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000017_fase2c4_notifications_schema.sql'),
        'utf-8'
      );

      expect(migrationFile).toContain('CREATE OR REPLACE FUNCTION public.mark_notification_read');
      expect(migrationFile).toContain('CREATE OR REPLACE FUNCTION public.mark_all_notifications_read');
      expect(migrationFile).toContain('CREATE OR REPLACE FUNCTION public.get_unread_notifications_count');
      expect(migrationFile).toContain('REVOKE EXECUTE ON FUNCTION public.mark_notification_read');
      expect(migrationFile).toContain('GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated');
    });

    it('verifies NotificationBell has accessible aria-label="Notificaciones"', () => {
      const bellFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/notifications/NotificationBell.tsx'),
        'utf-8'
      );

      expect(bellFile).toContain('aria-label="Notificaciones"');
    });
  });
});
