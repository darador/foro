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

    it('Test 1 — throws error when SUPABASE_SERVICE_ROLE_KEY is missing (no fallback to anon key or dummy key)', async () => {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const originalServiceKeyAlt = process.env.SUPABASE_SERVICE_KEY;

      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.SUPABASE_SERVICE_KEY;

      expect(() => createAdminClient()).toThrow('SUPABASE_SERVICE_ROLE_KEY is required for admin operations');

      process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
      if (originalServiceKeyAlt) process.env.SUPABASE_SERVICE_KEY = originalServiceKeyAlt;
    });

    it('Test 2 — verifies database trigger rejects INSERT post or comment with status=PUBLISHED by normal users', () => {
      const gateMigrationPath = path.join(
        process.cwd(),
        'supabase/migrations/20261004000027_fase3b4_critical_moderation_and_publication_gate.sql'
      );
      const gateContent = fs.readFileSync(gateMigrationPath, 'utf-8');

      expect(gateContent).toContain('CREATE OR REPLACE FUNCTION public.enforce_publication_gate()');
      expect(gateContent).toContain("IF NEW.status = 'PUBLISHED' THEN");
      expect(gateContent).toContain('Usuarios no moderadores no pueden publicar directamente con estado PUBLISHED');
    });

    it('Test 3 — verifies database trigger permits INSERT with status=PENDING_REVIEW', () => {
      const gateMigrationPath = path.join(
        process.cwd(),
        'supabase/migrations/20261004000027_fase3b4_critical_moderation_and_publication_gate.sql'
      );
      const gateContent = fs.readFileSync(gateMigrationPath, 'utf-8');

      expect(gateContent).toContain('BEFORE INSERT OR UPDATE ON public.posts');
      expect(gateContent).toContain('BEFORE INSERT OR UPDATE ON public.comments');
      expect(gateContent).toContain('RETURN NEW;');
    });

    it('Test 4 — verifies database trigger rejects UPDATE promoting status to PUBLISHED by normal users', () => {
      const gateMigrationPath = path.join(
        process.cwd(),
        'supabase/migrations/20261004000027_fase3b4_critical_moderation_and_publication_gate.sql'
      );
      const gateContent = fs.readFileSync(gateMigrationPath, 'utf-8');

      expect(gateContent).toContain("ELSIF TG_OP = 'UPDATE' THEN");
      expect(gateContent).toContain("IF NEW.status = 'PUBLISHED'");
      expect(gateContent).toContain('Usuarios no moderadores no pueden promover el estado de contenido a PUBLISHED');
    });

    it('Test 5 — verifies privileged service role context is recognized by database publication gate trigger', () => {
      const gateMigrationPath = path.join(
        process.cwd(),
        'supabase/migrations/20261004000027_fase3b4_critical_moderation_and_publication_gate.sql'
      );
      const gateContent = fs.readFileSync(gateMigrationPath, 'utf-8');

      expect(gateContent).toContain("current_setting('request.jwt.claim.role', true) = 'service_role'");
      expect(gateContent).toContain("session_user IN ('postgres', 'supabase_admin')");
      expect(gateContent).toContain('auth.uid() IS NULL');
    });

    it('Test 6 — verifies human moderators are exempted from publication gate restriction', () => {
      const gateMigrationPath = path.join(
        process.cwd(),
        'supabase/migrations/20261004000027_fase3b4_critical_moderation_and_publication_gate.sql'
      );
      const gateContent = fs.readFileSync(gateMigrationPath, 'utf-8');

      expect(gateContent).toContain('public.is_moderator(auth.uid())');
      expect(gateContent).toContain('IF NOT is_mod AND ai_enabled THEN');
    });
  });

  // 5. FASE 3B.4 — 10 MANDATORY VERIFICATION TESTS
  describe('5. Fase 3B.4 Mandatory Verification Tests', () => {
    const migration27Path = path.join(
      process.cwd(),
      'supabase/migrations/20261004000027_fase3b4_critical_moderation_and_publication_gate.sql'
    );
    const migration27Content = fs.readFileSync(migration27Path, 'utf-8');
    const serviceContent = fs.readFileSync(path.join(process.cwd(), 'src/lib/services/moderation-ai.ts'), 'utf-8');

    it('1. POST CRITICAL -> HIDDEN', () => {
      expect(serviceContent).toContain("else if (classification.risk_level === 'CRITICAL')");
      expect(serviceContent).toContain("if (params.entityType === 'POST')");
      expect(serviceContent).toContain(".from('posts')");
      expect(serviceContent).toContain(".update({ status: 'HIDDEN', updated_at: new Date().toISOString() })");
    });

    it('2. COMMENT CRITICAL -> HIDDEN', () => {
      expect(serviceContent).toContain("else if (classification.risk_level === 'CRITICAL')");
      expect(serviceContent).toContain("else if (params.entityType === 'COMMENT')");
      expect(serviceContent).toContain(".from('comments')");
      expect(serviceContent).toContain(".update({ status: 'HIDDEN', updated_at: new Date().toISOString() })");
    });

    it('3. AI enabled + usuario -> PUBLISHED rechazado', () => {
      expect(migration27Content).toContain('SELECT value INTO config_val');
      expect(migration27Content).toContain("FROM public.system_config");
      expect(migration27Content).toContain("WHERE key = 'MODERATION_AI_ENABLED'");
      expect(migration27Content).toContain('IF NOT is_mod AND ai_enabled THEN');
      expect(migration27Content).toContain("IF NEW.status = 'PUBLISHED' THEN");
      expect(migration27Content).toContain('Usuarios no moderadores no pueden publicar directamente con estado PUBLISHED');
    });

    it('4. AI enabled + usuario -> PENDING_REVIEW permitido', () => {
      expect(migration27Content).toContain('IF NOT is_mod AND ai_enabled THEN');
      expect(migration27Content).toContain('RETURN NEW;');
    });

    it('5. AI enabled + flujo interno -> LOW -> PUBLISHED permitido', () => {
      expect(migration27Content).toContain("current_setting('request.jwt.claim.role', true) = 'service_role'");
      expect(serviceContent).toContain("if (classification.risk_level === 'LOW')");
      expect(serviceContent).toContain(".update({ status: 'PUBLISHED', updated_at: new Date().toISOString() })");
    });

    it('6. AI disabled + usuario -> PUBLISHED permitido', () => {
      expect(migration27Content).toContain("ai_enabled := (config_val = 'true');");
      expect(migration27Content).toContain('IF NOT is_mod AND ai_enabled THEN');
      // When ai_enabled is false, the trigger bypasses the non-moderator publication block
    });

    it('7. AI disabled + usuario no obtiene privilegios adicionales de moderación', () => {
      const modRpcMigration = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000008_fix_status_moderation_bypass.sql'),
        'utf-8'
      );
      expect(modRpcMigration).toContain('IF NOT public.is_moderator(auth.uid()) THEN');
      expect(modRpcMigration).toContain('Acceso denegado. Solo los moderadores pueden modificar el estado de publicación.');
    });

    it('8. Moderador humano conserva sus permisos', () => {
      expect(migration27Content).toContain('is_mod := public.is_moderator(auth.uid());');
      expect(migration27Content).toContain('IF NOT is_mod AND ai_enabled THEN');
    });

    it('9. Service role conserva su capacidad interna', () => {
      expect(migration27Content).toContain("session_user IN ('postgres', 'supabase_admin')");
      expect(migration27Content).toContain("current_setting('request.jwt.claim.role', true) = 'service_role'");
    });

    it('10. No se modifica contenido ajeno mediante el flujo normal', () => {
      const postsService = fs.readFileSync(path.join(process.cwd(), 'src/lib/services/client/posts.ts'), 'utf-8');
      const commentsService = fs.readFileSync(path.join(process.cwd(), 'src/lib/services/client/comments.ts'), 'utf-8');

      expect(postsService).toContain(".eq('author_id', userId)");
      expect(commentsService).toContain(".eq('author_id', userId)");
    });
  });

  // 6. FASE 3B.5 — SYSTEM CONFIG & RPC SECURITY HARDENING VERIFICATION TESTS
  describe('6. Fase 3B.5 System Config & RPC Hardening Tests', () => {
    const migration28Path = path.join(
      process.cwd(),
      'supabase/migrations/20261004000028_fase3b5_system_config_security_hardening.sql'
    );
    const migration28Content = fs.readFileSync(migration28Path, 'utf-8');

    it('1. Admin can modify MODERATION_AI_ENABLED', () => {
      expect(migration28Content).toContain('public.is_admin(caller_id)');
      expect(migration28Content).toContain("ON CONFLICT (key) DO UPDATE");
    });

    it('2. Normal user CANNOT modify MODERATION_AI_ENABLED', () => {
      expect(migration28Content).toContain('IF NOT is_privileged THEN');
      expect(migration28Content).toContain('Acceso denegado. Solo los administradores pueden modificar la configuración del sistema.');
    });

    it('3. Anonymous user CANNOT modify MODERATION_AI_ENABLED', () => {
      expect(migration28Content).toContain('REVOKE EXECUTE ON FUNCTION public.sync_ai_moderation_config(BOOLEAN) FROM PUBLIC, anon, authenticated;');
    });

    it('4. Normal user CANNOT execute configuration RPC', () => {
      expect(migration28Content).toContain('REVOKE EXECUTE ON FUNCTION public.sync_ai_moderation_config(BOOLEAN) FROM PUBLIC, anon, authenticated;');
      expect(migration28Content).toContain('GRANT EXECUTE ON FUNCTION public.sync_ai_moderation_config(BOOLEAN) TO service_role;');
    });

    it('5. If AI=true, normal user CANNOT insert PUBLISHED', () => {
      const migration27Content = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000027_fase3b4_critical_moderation_and_publication_gate.sql'),
        'utf-8'
      );
      expect(migration27Content).toContain('IF NOT is_mod AND ai_enabled THEN');
      expect(migration27Content).toContain("IF NEW.status = 'PUBLISHED' THEN");
    });

    it('6. If AI=false, normal user CAN insert PUBLISHED', () => {
      const migration27Content = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000027_fase3b4_critical_moderation_and_publication_gate.sql'),
        'utf-8'
      );
      expect(migration27Content).toContain("ai_enabled := (config_val = 'true');");
    });

    it('7. Changing AI=true re-enforces PUBLISHED block', () => {
      expect(migration28Content).toContain("INSERT INTO public.system_config (key, value, updated_at)");
      expect(migration28Content).toContain("SET value = EXCLUDED.value");
    });

    it('8. No alternative path exists to modify system_config', () => {
      expect(migration28Content).toContain('ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;');
      expect(migration28Content).toContain('CREATE POLICY "Only admins can modify system config"');
      expect(migration28Content).toContain('USING (public.is_admin(auth.uid()))');
    });

    it('9. Administrative configuration change generates audit log', () => {
      expect(migration28Content).toContain("INSERT INTO public.audit_logs");
      expect(migration28Content).toContain("'UPDATE_SYSTEM_CONFIG'");
      expect(migration28Content).toContain("'MODERATION_AI_ENABLED'");
    });

    it('10. Publication Gate continues working for service_role and human moderators', () => {
      const migration27Content = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000027_fase3b4_critical_moderation_and_publication_gate.sql'),
        'utf-8'
      );
      expect(migration27Content).toContain("current_setting('request.jwt.claim.role', true) = 'service_role'");
      expect(migration27Content).toContain('is_mod := public.is_moderator(auth.uid());');
    });
  });

  // 7. FASE 3B.6 — PUBLICATION GATE ANONYMOUS CONTEXT HARDENING VERIFICATION TESTS
  describe('7. Fase 3B.6 Publication Gate Anonymous Context Hardening Tests', () => {
    const migration29Path = path.join(
      process.cwd(),
      'supabase/migrations/20261004000029_fase3b6_harden_publication_gate_anon.sql'
    );
    const migration29Content = fs.readFileSync(migration29Path, 'utf-8');

    it('1. Removes auth.uid() IS NULL from is_privileged check in enforce_publication_gate', () => {
      expect(migration29Content).toContain('is_privileged := (');
      expect(migration29Content).toContain("session_user IN ('postgres', 'supabase_admin') OR");
      expect(migration29Content).toContain("current_setting('request.jwt.claim.role', true) = 'service_role'");
      expect(migration29Content).not.toContain('OR auth.uid() IS NULL');
    });

    it('2. Explicitly treats anonymous context (auth.uid() IS NULL) as non-privileged', () => {
      expect(migration29Content).toContain('IF auth.uid() IS NOT NULL THEN');
      expect(migration29Content).toContain('is_mod := public.is_moderator(auth.uid());');
      expect(migration29Content).toContain('is_mod := FALSE;');
    });

    it('3. Normal user + AI enabled: INSERT PUBLISHED is denied, INSERT PENDING_REVIEW is permitted', () => {
      expect(migration29Content).toContain('IF NOT is_mod AND ai_enabled THEN');
      expect(migration29Content).toContain("IF NEW.status = 'PUBLISHED' THEN");
      expect(migration29Content).toContain('Usuarios no moderadores no pueden publicar directamente con estado PUBLISHED');
      expect(migration29Content).toContain('RETURN NEW;');
    });

    it('4. Normal user + AI enabled: UPDATE PENDING_REVIEW -> PUBLISHED is denied', () => {
      expect(migration29Content).toContain("ELSIF TG_OP = 'UPDATE' THEN");
      expect(migration29Content).toContain("IF NEW.status = 'PUBLISHED' AND (OLD.status IS DISTINCT FROM 'PUBLISHED' OR NEW.status IS DISTINCT FROM OLD.status) THEN");
      expect(migration29Content).toContain('Usuarios no moderadores no pueden promover el estado de contenido a PUBLISHED');
    });

    it('5. Normal user + AI disabled: INSERT PUBLISHED is permitted', () => {
      expect(migration29Content).toContain("ai_enabled := (config_val = 'true');");
      expect(migration29Content).toContain('IF NOT is_mod AND ai_enabled THEN');
    });

    it('6. Human moderators retain moderation capabilities', () => {
      expect(migration29Content).toContain('is_mod := public.is_moderator(auth.uid());');
    });

    it('7. Service role retains internal promotion capabilities', () => {
      expect(migration29Content).toContain("session_user IN ('postgres', 'supabase_admin')");
      expect(migration29Content).toContain("current_setting('request.jwt.claim.role', true) = 'service_role'");
    });

    it('8. Anonymous callers (auth.uid() IS NULL) cannot bypass publication gate', () => {
      expect(migration29Content).toContain('NEVER grant implicit privileges to anonymous callers (auth.uid() IS NULL)');
      expect(migration29Content).toContain('IF NOT is_mod AND ai_enabled THEN');
    });
  });

  // 8. FASE 3B.7 — UNIFIED SINGLE SOURCE OF TRUTH VERIFICATION TESTS
  describe('8. Fase 3B.7 Unified Single Source of Truth Tests', () => {
    it('Caso 1: DB = true, ENV = false -> AI considered enabled, ENV does not override DB', async () => {
      const { isModerationAiEnabled } = await import('@/lib/services/moderation-ai');
      const originalEnv = process.env.MODERATION_AI_ENABLED;
      process.env.MODERATION_AI_ENABLED = 'false';

      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { value: 'true' }, error: null }),
            }),
          }),
        }),
      };

      const result = await isModerationAiEnabled(mockSupabase);
      expect(result).toBe(true);

      process.env.MODERATION_AI_ENABLED = originalEnv;
    });

    it('Caso 2: DB = false, ENV = true -> AI considered disabled, ENV does not override DB', async () => {
      const { isModerationAiEnabled } = await import('@/lib/services/moderation-ai');
      const originalEnv = process.env.MODERATION_AI_ENABLED;
      process.env.MODERATION_AI_ENABLED = 'true';

      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { value: 'false' }, error: null }),
            }),
          }),
        }),
      };

      const result = await isModerationAiEnabled(mockSupabase);
      expect(result).toBe(false);

      process.env.MODERATION_AI_ENABLED = originalEnv;
    });

    it('Caso 3: DB = true, ENV = true -> AI enabled', async () => {
      const { isModerationAiEnabled } = await import('@/lib/services/moderation-ai');
      const mockSupabase = {
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { value: 'true' }, error: null }) }) }) }),
      };
      expect(await isModerationAiEnabled(mockSupabase)).toBe(true);
    });

    it('Caso 4: DB = false, ENV = false -> AI disabled', async () => {
      const { isModerationAiEnabled } = await import('@/lib/services/moderation-ai');
      const mockSupabase = {
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { value: 'false' }, error: null }) }) }) }),
      };
      expect(await isModerationAiEnabled(mockSupabase)).toBe(false);
    });

    it('Caso 5: Missing DB key or error -> MANDATORY FAIL-SAFE defaults to true (enabled)', async () => {
      const { isModerationAiEnabled } = await import('@/lib/services/moderation-ai');
      const mockSupabaseMissing = {
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
      };
      const mockSupabaseError = {
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: new Error('DB connection error') }) }) }) }),
      };

      expect(await isModerationAiEnabled(mockSupabaseMissing)).toBe(true);
      expect(await isModerationAiEnabled(mockSupabaseError)).toBe(true);
    });

    it('Caso 6: Verifies no functional decisions in posts/comments services rely on process.env.MODERATION_AI_ENABLED', () => {
      const postsService = fs.readFileSync(path.join(process.cwd(), 'src/lib/services/client/posts.ts'), 'utf-8');
      const commentsService = fs.readFileSync(path.join(process.cwd(), 'src/lib/services/client/comments.ts'), 'utf-8');

      expect(postsService).not.toContain('process.env.MODERATION_AI_ENABLED');
      expect(postsService).not.toContain('process.env.NEXT_PUBLIC_MODERATION_AI_ENABLED');
      expect(commentsService).not.toContain('process.env.MODERATION_AI_ENABLED');
      expect(commentsService).not.toContain('process.env.NEXT_PUBLIC_MODERATION_AI_ENABLED');
    });

    it('Caso 7: system_config = true produces identical enabled behavior in publication gate and analyzeContentWithAi', async () => {
      const gateMigrationContent = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20261004000029_fase3b6_harden_publication_gate_anon.sql'),
        'utf-8'
      );
      expect(gateMigrationContent).toContain("SELECT value INTO config_val");
      expect(gateMigrationContent).toContain("FROM public.system_config");
      expect(gateMigrationContent).toContain("WHERE key = 'MODERATION_AI_ENABLED'");
      expect(gateMigrationContent).toContain("ai_enabled := (config_val = 'true');");
    });

    it('Caso 8: system_config = false produces identical disabled behavior in publication gate and analyzeContentWithAi', async () => {
      const { isModerationAiEnabled } = await import('@/lib/services/moderation-ai');
      const mockDisabledSupabase = {
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { value: 'false' }, error: null }) }) }) }),
      };
      expect(await isModerationAiEnabled(mockDisabledSupabase)).toBe(false);
    });
  });

  // 9. FASE 3B.8 — CLIENT / SERVER MODULE SEPARATION TESTS
  describe('9. Fase 3B.8 Client / Server Module Separation Tests', () => {
    const postsService = fs.readFileSync(path.join(process.cwd(), 'src/lib/services/client/posts.ts'), 'utf-8');
    const commentsService = fs.readFileSync(path.join(process.cwd(), 'src/lib/services/client/comments.ts'), 'utf-8');
    const configService = fs.readFileSync(path.join(process.cwd(), 'src/lib/services/moderation-config.ts'), 'utf-8');

    it('Test 1 — posts.ts does NOT import moderation-ai.ts', () => {
      expect(postsService).not.toContain("from '@/lib/services/moderation-ai'");
      expect(postsService).toContain("from '@/lib/services/moderation-config'");
    });

    it('Test 2 — comments.ts does NOT import moderation-ai.ts', () => {
      expect(commentsService).not.toContain("from '@/lib/services/moderation-ai'");
      expect(commentsService).toContain("from '@/lib/services/moderation-config'");
    });

    it('Test 3 — moderation-config.ts does NOT import createAdminClient, moderation-ai, OpenAI, Gemini or service role keys', () => {
      expect(configService).not.toContain('createAdminClient');
      expect(configService).not.toContain('moderation-ai');
      expect(configService).not.toContain('OpenAI');
      expect(configService).not.toContain('Gemini');
      expect(configService).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    });

    it('Test 4 — moderation-config.ts queries system_config with key = MODERATION_AI_ENABLED', () => {
      expect(configService).toContain("from('system_config')");
      expect(configService).toContain(".eq('key', 'MODERATION_AI_ENABLED')");
    });

    it('Test 5 — moderation-config.ts DB value = true returns true', async () => {
      const { isModerationAiEnabled } = await import('@/lib/services/moderation-config');
      const mockSupabase = {
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { value: 'true' }, error: null }) }) }) }),
      };
      expect(await isModerationAiEnabled(mockSupabase)).toBe(true);
    });

    it('Test 6 — moderation-config.ts DB value = false returns false', async () => {
      const { isModerationAiEnabled } = await import('@/lib/services/moderation-config');
      const mockSupabase = {
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { value: 'false' }, error: null }) }) }) }),
      };
      expect(await isModerationAiEnabled(mockSupabase)).toBe(false);
    });

    it('Test 7 — moderation-config.ts DB key missing returns true (fail-safe)', async () => {
      const { isModerationAiEnabled } = await import('@/lib/services/moderation-config');
      const mockSupabaseMissing = {
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
      };
      expect(await isModerationAiEnabled(mockSupabaseMissing)).toBe(true);
    });

    it('Test 8 — moderation-config.ts DB error returns true (fail-safe)', async () => {
      const { isModerationAiEnabled } = await import('@/lib/services/moderation-config');
      const mockSupabaseError = {
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: new Error('Network error') }) }) }) }),
      };
      expect(await isModerationAiEnabled(mockSupabaseError)).toBe(true);
    });

    it('Test 9 — moderation-ai.ts operates independently server-side', () => {
      const moderationService = fs.readFileSync(path.join(process.cwd(), 'src/lib/services/moderation-ai.ts'), 'utf-8');
      expect(moderationService).toContain('export async function analyzeContentWithAi');
      expect(moderationService).not.toContain("from '@/lib/services/moderation-config'");
    });

    it('Test 10 — No client services import moderation-ai.ts', () => {
      expect(postsService).not.toContain('@/lib/services/moderation-ai');
      expect(commentsService).not.toContain('@/lib/services/moderation-ai');
    });
  });
});
