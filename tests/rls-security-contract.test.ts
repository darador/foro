import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FASE 1.1 — SECURITY HARDENING: Forbidden vs Allowed Operations Verification', () => {
  const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
  
  const getSql = (file: string) => fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
  const initialRls = getSql('20261004000001_rls_policies.sql');
  const hardeningRls = getSql('20261004000003_security_hardening.sql');

  describe('FORBIDDEN OPERATIONS (Normal users MUST NOT be able to):', () => {
    test('1. Normal user CANNOT read admin_roles', () => {
      expect(hardeningRls).toContain('CREATE POLICY "Admin roles viewable only by admins"');
      expect(hardeningRls).toContain('USING (public.is_admin(auth.uid()))');
    });

    test('2. Normal user CANNOT modify admin_roles', () => {
      expect(initialRls).toContain('CREATE POLICY "Only superadmins can insert or update admin roles"');
      expect(initialRls).toContain('public.is_superadmin(auth.uid())');
    });

    test('3. Normal user CANNOT modify email_verified, badges, or counters', () => {
      expect(hardeningRls).toContain('NEW.email_verified := OLD.email_verified');
      expect(hardeningRls).toContain('NEW.experiences_count := OLD.experiences_count');
      expect(hardeningRls).toContain('NEW.comments_count := OLD.comments_count');
      expect(hardeningRls).toContain('NEW.reactions_received := OLD.reactions_received');
      expect(hardeningRls).toContain('NEW.badges := OLD.badges');
    });

    test('4. Normal user CANNOT read audit_logs', () => {
      expect(initialRls).toContain('CREATE POLICY "Only admins can view audit logs"');
      expect(initialRls).toContain('ON public.audit_logs FOR SELECT');
      expect(initialRls).toContain('public.is_admin(auth.uid())');
    });

    test('5. Normal user CANNOT read moderation cases, actions, or AI results', () => {
      expect(initialRls).toContain('CREATE POLICY "Only moderators can view and manage moderation cases"');
      expect(initialRls).toContain('CREATE POLICY "Only moderators can view and create moderation actions"');
      expect(hardeningRls).toContain('CREATE POLICY "Only moderators can view and create moderation AI results"');
    });

    test('6. Normal user CANNOT read saved_posts or messages of other users', () => {
      expect(initialRls).toContain('CREATE POLICY "Users can only view own saved posts"');
      expect(initialRls).toContain('USING (user_id = auth.uid())');
      expect(initialRls).toContain('CREATE POLICY "Messages viewable by conversation members only"');
    });

    test('7. Normal user CANNOT send messages without accepted request or if blocked', () => {
      expect(hardeningRls).toContain('public.can_send_message(conversation_id, auth.uid())');
    });

    test('8. Normal user CANNOT access directory when DIRECTORY_ENABLED=false', () => {
      expect(hardeningRls).toContain('public.is_directory_enabled() = true');
    });
  });

  describe('ALLOWED OPERATIONS (Normal users CAN):', () => {
    test('1. Modify own allowed profile fields', () => {
      expect(initialRls).toContain('CREATE POLICY "Users can update own profile"');
      expect(initialRls).toContain('USING (auth.uid() = id)');
    });

    test('2. Read published content & categories', () => {
      expect(initialRls).toContain('CREATE POLICY "Public can view published posts"');
      expect(initialRls).toContain('status = \'PUBLISHED\'');
    });

    test('3. Create content, comments, and reactions if email_verified=true', () => {
      expect(initialRls).toContain('email_verified = true');
    });

    test('4. Manage own saved posts, follows, and blocks', () => {
      expect(initialRls).toContain('CREATE POLICY "Users can save posts for themselves"');
      expect(initialRls).toContain('CREATE POLICY "Users can follow posts"');
      expect(initialRls).toContain('CREATE POLICY "Users can block other users"');
    });
  });
});
