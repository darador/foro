import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  ModerationAiResponseSchema,
  buildSystemPrompt,
  mockClassifierLogic,
  ALLOWED_AI_FLAGS,
} from '@/lib/services/moderation-ai';

describe('FASE 3B & 3B.1 — Moderación Automática con IA Integrity & Security Tests', () => {
  const schemaMigrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20261004000024_fase3b_moderation_ai_schema.sql'
  );
  const hardeningMigrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20261004000025_fase3b1_moderation_ai_hardening.sql'
  );

  const schemaContent = fs.readFileSync(schemaMigrationPath, 'utf-8');
  const hardeningContent = fs.readFileSync(hardeningMigrationPath, 'utf-8');

  // 1. CLASSIFIER VALIDATIONS & FAIL-SAFE RULES
  describe('1. Classifier Schema & Strict Validation Rules', () => {
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

    it('rejects inconsistent LOW risk with critical flags', () => {
      const inconsistentLow = {
        risk_level: 'LOW',
        flags: ['POSSIBLE_MINOR'],
        confidence: 0.9,
        reason: 'Experiencia sexual.',
      };
      expect(() => ModerationAiResponseSchema.parse(inconsistentLow)).toThrow();
    });

    it('rejects invalid flags not in ALLOWED_AI_FLAGS', () => {
      const invalidFlag = {
        risk_level: 'LOW',
        flags: ['UNKNOWN_CUSTOM_FLAG'],
        confidence: 0.8,
        reason: 'Test',
      };
      expect(() => ModerationAiResponseSchema.parse(invalidFlag)).toThrow();
    });

    it('validates REVIEW risk response with AI_UNAVAILABLE flag for fail-safe', () => {
      const failSafeResponse = {
        risk_level: 'REVIEW',
        flags: ['AI_UNAVAILABLE'],
        confidence: 0,
        reason: 'Análisis automático no disponible o falló.',
      };
      const res = ModerationAiResponseSchema.parse(failSafeResponse);
      expect(res.risk_level).toBe('REVIEW');
      expect(res.flags).toContain('AI_UNAVAILABLE');
    });
  });

  // 2. AUTHORIZATION & DB SCHEMA HARDENING
  describe('2. Authorization, RLS, and Database Constraints', () => {
    it('verifies record_ai_moderation_result EXECUTE permission is revoked from PUBLIC, anon, AND authenticated clients', () => {
      expect(hardeningContent).toContain(
        'REVOKE EXECUTE ON FUNCTION public.record_ai_moderation_result(TEXT, UUID, UUID, TEXT, TEXT, TEXT[], NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;'
      );
    });

    it('verifies unique idempotency index uq_moderation_ai_results_version on content_version_id', () => {
      expect(hardeningContent).toContain('CREATE UNIQUE INDEX IF NOT EXISTS uq_moderation_ai_results_version');
      expect(hardeningContent).toContain('ON public.moderation_ai_results(entity_type, entity_id, content_version_id)');
      expect(hardeningContent).toContain('WHERE content_version_id IS NOT NULL');
    });

    it('verifies record_ai_moderation_result RPC validates target entity and content version existence', () => {
      expect(hardeningContent).toContain('SELECT 1 FROM public.posts WHERE id = entity_id_param');
      expect(hardeningContent).toContain('SELECT 1 FROM public.comments WHERE id = entity_id_param');
      expect(hardeningContent).toContain('SELECT 1 FROM public.content_versions');
    });

    it('verifies RLS policies restrict moderation_ai_results to moderators/admins and block direct client mutation', () => {
      expect(schemaContent).toContain('ALTER TABLE public.moderation_ai_results ENABLE ROW LEVEL SECURITY;');
      expect(schemaContent).toContain('CREATE POLICY "Only moderators can view moderation AI results"');
      expect(schemaContent).toContain('USING (public.is_moderator(auth.uid()) OR public.is_admin(auth.uid()))');
      expect(schemaContent).toContain('CREATE POLICY "No direct insert on moderation AI results"');
    });
  });

  // 3. SERVER ACTION & CLIENT DISPATCH INTEGRATION
  describe('3. Server Action Security & Client Service Dispatch', () => {
    it('verifies server action accepts ONLY entityType, entityId, versionId (client cannot control text, title, or classification)', () => {
      const actionPath = path.join(process.cwd(), 'src/app/actions/moderation-ai.ts');
      const actionContent = fs.readFileSync(actionPath, 'utf-8');

      expect(actionContent).toContain("'use server'");
      expect(actionContent).toContain('runAiContentModerationAction');
      expect(actionContent).not.toContain('title:');
      expect(actionContent).not.toContain('content:');
      expect(actionContent).not.toContain('risk_level');
    });

    it('verifies moderation-ai.ts server service fetches real content from DB and uses createAdminClient', () => {
      const servicePath = path.join(process.cwd(), 'src/lib/services/moderation-ai.ts');
      const serviceContent = fs.readFileSync(servicePath, 'utf-8');

      expect(serviceContent).toContain("from('posts')");
      expect(serviceContent).toContain("from('comments')");
      expect(serviceContent).toContain("import { createAdminClient } from '@/lib/supabase/admin';");
      expect(serviceContent).toContain('createAdminClient()');
    });
  });

  // 4. PRIVILEGED EXECUTION CONTEXT & PUBLICATION GATE HARDENING
  describe('4. Privileged AI Execution Context & Publication Gate', () => {
    it('verifies createAdminClient prevents client-side execution in browser context', () => {
      const adminPath = path.join(process.cwd(), 'src/lib/supabase/admin.ts');
      const adminContent = fs.readFileSync(adminPath, 'utf-8');

      expect(adminContent).toContain("typeof window !== 'undefined'");
      expect(adminContent).toContain('Service Role client cannot be executed in the browser.');
    });

    it('verifies createPost and createComment use PENDING_REVIEW when AI is enabled', () => {
      const postsService = fs.readFileSync(path.join(process.cwd(), 'src/lib/services/client/posts.ts'), 'utf-8');
      const commentsService = fs.readFileSync(path.join(process.cwd(), 'src/lib/services/client/comments.ts'), 'utf-8');

      expect(postsService).toContain("status: isAiEnabled ? 'PENDING_REVIEW' : 'PUBLISHED'");
      expect(commentsService).toContain("status: isAiEnabled ? 'PENDING_REVIEW' : 'PUBLISHED'");
    });

    it('verifies updatePost and updateComment reset status to PENDING_REVIEW on edition when AI is enabled', () => {
      const postsService = fs.readFileSync(path.join(process.cwd(), 'src/lib/services/client/posts.ts'), 'utf-8');
      const commentsService = fs.readFileSync(path.join(process.cwd(), 'src/lib/services/client/comments.ts'), 'utf-8');

      expect(postsService).toContain("updateData.status = 'PENDING_REVIEW'");
      expect(commentsService).toContain("updateData.status = 'PENDING_REVIEW'");
    });

    it('verifies analyzeContentWithAi updates posts and comments status to PUBLISHED on LOW risk', () => {
      const serviceContent = fs.readFileSync(path.join(process.cwd(), 'src/lib/services/moderation-ai.ts'), 'utf-8');

      expect(serviceContent).toContain("if (classification.risk_level === 'LOW')");
      expect(serviceContent).toContain(".update({ status: 'PUBLISHED', updated_at: new Date().toISOString() })");
      expect(serviceContent).toContain(".eq('status', 'PENDING_REVIEW')");
    });
  });
});
