import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  ModerationAiResponseSchema,
  buildSystemPrompt,
  mockClassifierLogic,
  ALLOWED_AI_FLAGS,
} from '@/lib/services/moderation-ai';

describe('FASE 3B — Moderación Automática con IA Unit & Contract Tests', () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20261004000024_fase3b_moderation_ai_schema.sql'
  );
  const migrationContent = fs.readFileSync(migrationPath, 'utf-8');

  // 1. CLASSIFIER VALIDATIONS (ZOD SCHEMA & MOCK LOGIC)
  describe('1. Classifier Schema & Logic', () => {
    it('validates LOW risk response correctly', () => {
      const validLow = {
        risk_level: 'LOW',
        flags: ['SEXUAL_CONTENT'],
        confidence: 0.9,
        reason: 'Experiencia sexual adulta consensuada.',
      };
      const res = ModerationAiResponseSchema.parse(validLow);
      expect(res.risk_level).toBe('LOW');
      expect(res.confidence).toBe(0.9);
    });

    it('validates REVIEW risk response correctly', () => {
      const validReview = {
        risk_level: 'REVIEW',
        flags: ['PERSONAL_DATA'],
        confidence: 0.85,
        reason: 'Posibles datos personales expuestos.',
      };
      const res = ModerationAiResponseSchema.parse(validReview);
      expect(res.risk_level).toBe('REVIEW');
    });

    it('validates CRITICAL risk response correctly', () => {
      const validCritical = {
        risk_level: 'CRITICAL',
        flags: ['POSSIBLE_MINOR'],
        confidence: 0.98,
        reason: 'Mención o contexto sospechoso sobre menor de edad.',
      };
      const res = ModerationAiResponseSchema.parse(validCritical);
      expect(res.risk_level).toBe('CRITICAL');
    });

    it('rejects invalid confidence outside 0..1', () => {
      const invalidConf = {
        risk_level: 'LOW',
        flags: [],
        confidence: 1.5,
        reason: 'Test',
      };
      expect(() => ModerationAiResponseSchema.parse(invalidConf)).toThrow();
    });

    it('rejects invalid risk_level', () => {
      const invalidRisk = {
        risk_level: 'BAN_USER',
        flags: [],
        confidence: 0.8,
        reason: 'Test',
      };
      expect(() => ModerationAiResponseSchema.parse(invalidRisk)).toThrow();
    });

    it('differentiates consensual adult sexuality (LOW) from prohibited content (CRITICAL/REVIEW)', () => {
      const adultPost = mockClassifierLogic({
        entityType: 'POST',
        title: 'Experiencia Swinger y BDSM',
        content: 'Anoche compartimos una experiencia BDSM consensuada en una fiesta swinger.',
      });

      expect(adultPost.risk_level).toBe('LOW');
      expect(adultPost.flags).toContain('SEXUAL_CONTENT');

      const criticalPost = mockClassifierLogic({
        entityType: 'POST',
        title: 'Fotos de menor',
        content: 'Comparto fotos de un menor de edad en la nube.',
      });

      expect(criticalPost.risk_level).toBe('CRITICAL');
      expect(criticalPost.flags).toContain('POSSIBLE_MINOR');
    });

    it('system prompt enforces adult sexuality is permitted and forbids automatic bans', () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain('ForoFetiche, una comunidad adulta');
      expect(prompt).toContain('BDSM, swinger, trios, fetiches');
      expect(prompt).toContain('La IA es una señal de asistencia');
      expect(prompt).not.toContain('BAN');
      expect(prompt).not.toContain('DELETE');
    });
  });

  // 2. SCHEMA & MIGRATION CONTRACT TESTS
  describe('2. Database Schema & RLS Policies', () => {
    it('verifies moderation_ai_results schema extensions (content_version_id, entity_type, entity_id, reason)', () => {
      expect(migrationContent).toContain('ALTER TABLE public.moderation_ai_results');
      expect(migrationContent).toContain('ALTER COLUMN case_id DROP NOT NULL');
      expect(migrationContent).toContain("ADD COLUMN IF NOT EXISTS entity_type TEXT CHECK (entity_type IN ('POST', 'COMMENT'))");
      expect(migrationContent).toContain('ADD COLUMN IF NOT EXISTS entity_id UUID');
      expect(migrationContent).toContain('ADD COLUMN IF NOT EXISTS content_version_id UUID REFERENCES public.content_versions(id)');
      expect(migrationContent).toContain('ADD COLUMN IF NOT EXISTS reason TEXT');
    });

    it('verifies performance and idempotency indexes exist', () => {
      expect(migrationContent).toContain('CREATE INDEX IF NOT EXISTS idx_moderation_ai_results_entity');
      expect(migrationContent).toContain('CREATE INDEX IF NOT EXISTS idx_moderation_ai_results_case');
    });

    it('verifies RLS policies restrict moderation_ai_results to moderators/admins and block direct client mutation', () => {
      expect(migrationContent).toContain('ALTER TABLE public.moderation_ai_results ENABLE ROW LEVEL SECURITY;');
      expect(migrationContent).toContain('CREATE POLICY "Only moderators can view moderation AI results"');
      expect(migrationContent).toContain('USING (public.is_moderator(auth.uid()) OR public.is_admin(auth.uid()))');
      expect(migrationContent).toContain('CREATE POLICY "No direct insert on moderation AI results"');
      expect(migrationContent).toContain('CREATE POLICY "No direct update on moderation AI results"');
      expect(migrationContent).toContain('CREATE POLICY "No direct delete on moderation AI results"');
    });

    it('verifies record_ai_moderation_result RPC logic and security settings', () => {
      expect(migrationContent).toContain('CREATE OR REPLACE FUNCTION public.record_ai_moderation_result');
      expect(migrationContent).toContain('SECURITY DEFINER');
      expect(migrationContent).toContain('SET search_path = public');
      expect(migrationContent).toContain("UPDATE public.posts SET status = 'HIDDEN'");
      expect(migrationContent).toContain("UPDATE public.comments SET status = 'HIDDEN'");
      expect(migrationContent).toContain("UPDATE public.posts SET status = 'PENDING_REVIEW'");
      expect(migrationContent).toContain('INSERT INTO public.audit_logs');
      expect(migrationContent).toContain('REVOKE EXECUTE ON FUNCTION public.record_ai_moderation_result');
      expect(migrationContent).toContain('GRANT EXECUTE ON FUNCTION public.record_ai_moderation_result');
    });
  });

  // 3. SERVER ACTION & SERVICE INTEGRATION
  describe('3. Server Service & Client Triggering', () => {
    it('verifies server action src/app/actions/moderation-ai.ts runs 100% server-side', () => {
      const actionPath = path.join(process.cwd(), 'src/app/actions/moderation-ai.ts');
      expect(fs.existsSync(actionPath)).toBe(true);

      const actionContent = fs.readFileSync(actionPath, 'utf-8');
      expect(actionContent).toContain("'use server'");
      expect(actionContent).toContain('runAiContentModerationAction');
    });

    it('verifies client post and comment services trigger AI moderation server action asynchronously', () => {
      const clientPostsPath = path.join(process.cwd(), 'src/lib/services/client/posts.ts');
      const clientCommentsPath = path.join(process.cwd(), 'src/lib/services/client/comments.ts');

      const postsContent = fs.readFileSync(clientPostsPath, 'utf-8');
      const commentsContent = fs.readFileSync(clientCommentsPath, 'utf-8');

      expect(postsContent).toContain('runAiContentModerationAction');
      expect(commentsContent).toContain('runAiContentModerationAction');
    });
  });
});
