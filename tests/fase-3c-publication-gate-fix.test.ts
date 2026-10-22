import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const mockSupabaseFrom = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  }),
}));

vi.mock('@/app/actions/moderation-ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/actions/moderation-ai')>();
  return {
    ...actual,
    runAiContentModerationAction: vi.fn().mockResolvedValue({ success: true }),
  };
});

/**
 * FASE 3C — SUITE DE VERIFICACIÓN DE LA CORRECCIÓN FAIL-CLOSED DEL PUBLICATION GATE
 *
 * Cubre:
 * 1. Reproducción exacta de la lógica ternaria SQL/PLpgSQL bajo contexto PostgREST
 *    (usuarios autenticados, moderadores, service_role, superuser y anónimos).
 * 2. Verificación contractual de la migración 20261020000000_fix_publication_gate_fail_closed.sql
 *    contra las migraciones 000000–000034 (SECURITY INVOKER vs SECURITY DEFINER,
 *    constraints de comments.status, RLS INSERT vs UPDATE, permisos por columna 000007/000008).
 * 3. Simulación funcional de la compuerta y políticas para creación, edición de contenido
 *    propio ya publicado, intento de promoción a PUBLISHED, aprobación por moderador,
 *    moderación automática por IA (LOW, REVIEW, CRITICAL) y modo IA deshabilitada.
 * 4. Alineación de los servicios de aplicación (comments.ts, client/comments.ts, client/posts.ts).
 */

type SqlBool = boolean | null;

function sqlEq(a: string | null, b: string | null): SqlBool {
  if (a === null || b === null) return null;
  return a === b;
}

function sqlIn(val: string | null, list: string[]): SqlBool {
  if (val === null) return null;
  return list.includes(val);
}

function sqlOr(a: SqlBool, b: SqlBool): SqlBool {
  if (a === true || b === true) return true;
  if (a === null || b === null) return null;
  return false;
}

function sqlNot(a: SqlBool): SqlBool {
  if (a === null) return null;
  return !a;
}

function sqlCoalesce(val: SqlBool, fallback: boolean): boolean {
  return val === null ? fallback : val;
}

interface PostgrestSessionContext {
  session_user: string;
  current_user: string;
  jwt_role: string | null; // auth.jwt() ->> 'role' (from request.jwt.claims JSON)
  legacy_guc_role: string | null; // current_setting('request.jwt.claim.role', true)
  auth_uid: string | null;
  is_moderator_db: boolean;
  is_admin_db: boolean;
  email_verified: boolean;
}

/**
 * Simulates the vulnerable 000029 enforce_publication_gate() privilege logic
 */
function evaluateVulnerable000029IsMod(ctx: PostgrestSessionContext): boolean {
  const is_privileged: SqlBool = sqlOr(
    sqlIn(ctx.session_user, ['postgres', 'supabase_admin']),
    sqlEq(ctx.legacy_guc_role, 'service_role')
  );

  // In PL/pgSQL: IF NOT is_privileged THEN ... ELSE is_mod := TRUE; END IF;
  if (sqlNot(is_privileged) === true) {
    if (ctx.auth_uid !== null) {
      return ctx.is_moderator_db;
    }
    return false;
  } else {
    return true;
  }
}

/**
 * Simulates the fixed 20261020000000 enforce_publication_gate() privilege logic
 */
function evaluateFixedPublicationGateIsMod(ctx: PostgrestSessionContext): boolean {
  const is_privileged: boolean =
    sqlCoalesce(sqlIn(ctx.session_user, ['postgres', 'supabase_admin']), false) ||
    sqlCoalesce(sqlEq(ctx.current_user, 'service_role'), false) ||
    sqlCoalesce(sqlEq(ctx.jwt_role, 'service_role'), false) ||
    sqlCoalesce(sqlEq(ctx.legacy_guc_role, 'service_role'), false);

  if (is_privileged === true) {
    return true;
  }
  return sqlCoalesce(ctx.auth_uid !== null && ctx.is_moderator_db === true, false);
}

/**
 * Simulates the full fixed Publication Gate + RLS + Column Grants decision for posts & comments
 */
function simulatePublicationGateOperation(params: {
  ctx: PostgrestSessionContext;
  entity: 'POST' | 'COMMENT';
  op: 'INSERT' | 'UPDATE';
  aiConfigValue: string | null; // 'true', 'false', or null
  oldStatus?: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'HIDDEN' | 'DELETED';
  newStatus: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'HIDDEN' | 'DELETED';
  explicitlyUpdatesStatusColumn?: boolean;
  isOwner?: boolean;
  viaSecurityDefinerRpc?: 'NONE' | 'EXECUTE_MODERATION_ACTION' | 'RECORD_AI_MODERATION_RESULT' | 'SOFT_DELETE_POST';
}): { allowed: boolean; reason?: string } {
  const {
    ctx,
    entity,
    op,
    aiConfigValue,
    oldStatus,
    newStatus,
    explicitlyUpdatesStatusColumn = false,
    isOwner = true,
    viaSecurityDefinerRpc = 'NONE',
  } = params;

  const ai_enabled = aiConfigValue !== null ? aiConfigValue === 'true' : true;

  // 1. Check table/column grants for direct PostgREST calls (when not inside a SECURITY DEFINER RPC)
  if (viaSecurityDefinerRpc === 'NONE') {
    if (ctx.current_user === 'anon') {
      return { allowed: false, reason: '42501: permission denied for role anon' };
    }
    if (
      entity === 'POST' &&
      op === 'UPDATE' &&
      ctx.current_user === 'authenticated' &&
      explicitlyUpdatesStatusColumn
    ) {
      // Migration 000008 revoked UPDATE(status) on public.posts from authenticated
      return { allowed: false, reason: '42501: permission denied for column status of table posts (000008)' };
    }
  }

  // 2. Check comments status constraint
  if (entity === 'COMMENT') {
    const allowedCommentStatuses = ['PENDING_REVIEW', 'PUBLISHED', 'HIDDEN', 'DELETED'];
    if (!allowedCommentStatuses.includes(newStatus)) {
      return { allowed: false, reason: '23514: new row for relation "comments" violates check constraint "comments_status_check"' };
    }
  }

  // 3. Evaluate BEFORE INSERT OR UPDATE trigger: enforce_publication_gate() (SECURITY INVOKER)
  // Inside a SECURITY DEFINER RPC owned by postgres, current_user is 'postgres',
  // while session_user remains 'authenticator' and auth.uid()/auth.jwt() remain the caller's.
  const triggerCtx: PostgrestSessionContext =
    viaSecurityDefinerRpc === 'NONE'
      ? ctx
      : {
          ...ctx,
          current_user: 'postgres',
        };

  const is_mod = evaluateFixedPublicationGateIsMod(triggerCtx);

  if (is_mod !== true) {
    if (op === 'INSERT') {
      if (newStatus === 'HIDDEN' || newStatus === 'DELETED') {
        return {
          allowed: false,
          reason: `P0001: Usuarios no moderadores no pueden insertar contenido directamente en estado ${newStatus}.`,
        };
      }
      if (ai_enabled === true && newStatus === 'PUBLISHED') {
        return {
          allowed: false,
          reason:
            'P0001: Usuarios no moderadores no pueden publicar directamente con estado PUBLISHED cuando la moderación automática está habilitada.',
        };
      }
    } else if (op === 'UPDATE') {
      if ((oldStatus === 'HIDDEN' || oldStatus === 'DELETED') && newStatus !== oldStatus) {
        return {
          allowed: false,
          reason:
            'P0001: Usuarios no moderadores no pueden reactivar ni cambiar el estado de contenido moderado o eliminado.',
        };
      }
      if (newStatus === 'HIDDEN' && oldStatus !== 'HIDDEN') {
        return {
          allowed: false,
          reason: 'P0001: Usuarios no moderadores no pueden asignar estado HIDDEN directamente.',
        };
      }
      if (newStatus === 'PUBLISHED' && oldStatus !== 'PUBLISHED') {
        return {
          allowed: false,
          reason: 'P0001: Usuarios no moderadores no pueden promover el estado de contenido a PUBLISHED.',
        };
      }
    }
  }

  // 4. Evaluate RLS policies (applies when current_user is authenticated, not bypassed by SECURITY DEFINER or service_role)
  if (viaSecurityDefinerRpc === 'NONE' && ctx.current_user === 'authenticated') {
    if (op === 'INSERT') {
      const rlsInsertPass =
        ctx.auth_uid !== null &&
        isOwner &&
        ctx.email_verified === true &&
        (newStatus !== 'PUBLISHED' || ctx.is_moderator_db === true || ai_enabled === false);

      if (!rlsInsertPass) {
        return { allowed: false, reason: '42501: new row violates row-level security policy (FOR INSERT)' };
      }
    } else if (op === 'UPDATE') {
      const rlsUpdatePass = ctx.auth_uid !== null && (isOwner || ctx.is_moderator_db === true);
      if (!rlsUpdatePass) {
        return { allowed: false, reason: '42501: new row violates row-level security policy (FOR UPDATE)' };
      }
    }
  }

  return { allowed: true };
}

describe('FASE 3C — Corrección Fail-Closed del Publication Gate y Funciones de Privilegio', () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20261020000000_fix_publication_gate_fail_closed.sql'
  );
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

  // Contextos reales de PostgREST en Supabase
  const normalUserCtx: PostgrestSessionContext = {
    session_user: 'authenticator',
    current_user: 'authenticated',
    jwt_role: 'authenticated',
    legacy_guc_role: null, // En PostgREST moderno request.jwt.claim.role no se define (es NULL)
    auth_uid: '11111111-1111-4111-8111-111111111111',
    is_moderator_db: false,
    is_admin_db: false,
    email_verified: true,
  };

  const moderatorUserCtx: PostgrestSessionContext = {
    session_user: 'authenticator',
    current_user: 'authenticated',
    jwt_role: 'authenticated',
    legacy_guc_role: null,
    auth_uid: '22222222-2222-4222-8222-222222222222',
    is_moderator_db: true,
    is_admin_db: false,
    email_verified: true,
  };

  const serviceRoleCtx: PostgrestSessionContext = {
    session_user: 'authenticator',
    current_user: 'service_role',
    jwt_role: 'service_role',
    legacy_guc_role: null,
    auth_uid: null,
    is_moderator_db: false,
    is_admin_db: false,
    email_verified: false,
  };

  const anonUserCtx: PostgrestSessionContext = {
    session_user: 'authenticator',
    current_user: 'anon',
    jwt_role: 'anon',
    legacy_guc_role: null,
    auth_uid: null,
    is_moderator_db: false,
    is_admin_db: false,
    email_verified: false,
  };

  const postgresAdminCtx: PostgrestSessionContext = {
    session_user: 'postgres',
    current_user: 'postgres',
    jwt_role: null,
    legacy_guc_role: null,
    auth_uid: null,
    is_moderator_db: false,
    is_admin_db: false,
    email_verified: false,
  };

  describe('1. Demostración de la Causa Raíz (Lógica Ternaria NULL) y Verificación de la Corrección', () => {
    it('reproduce el bypass en 000029: cuando request.jwt.claim.role es NULL, la versión previa otorgaba is_mod = TRUE a usuarios normales y anónimos', () => {
      expect(evaluateVulnerable000029IsMod(normalUserCtx)).toBe(true);
      expect(evaluateVulnerable000029IsMod(anonUserCtx)).toBe(true);
    });

    it('verifica que la función corregida evalúa is_mod = FALSE para usuarios autenticados no moderadores y para anónimos (fail-closed)', () => {
      expect(evaluateFixedPublicationGateIsMod(normalUserCtx)).toBe(false);
      expect(evaluateFixedPublicationGateIsMod(anonUserCtx)).toBe(false);
    });

    it('verifica que la función corregida evalúa is_mod = TRUE únicamente para moderadores reales, service_role y postgres/supabase_admin', () => {
      expect(evaluateFixedPublicationGateIsMod(moderatorUserCtx)).toBe(true);
      expect(evaluateFixedPublicationGateIsMod(serviceRoleCtx)).toBe(true);
      expect(evaluateFixedPublicationGateIsMod(postgresAdminCtx)).toBe(true);
    });

    it('verifica que dentro de una RPC SECURITY DEFINER (current_user = postgres), un usuario normal NO adquiere privilegios en enforce_publication_gate()', () => {
      const normalUserInsideSecurityDefiner: PostgrestSessionContext = {
        ...normalUserCtx,
        current_user: 'postgres', // Owner de la RPC SECURITY DEFINER
      };
      expect(evaluateFixedPublicationGateIsMod(normalUserInsideSecurityDefiner)).toBe(false);
    });
  });

  describe('2. Verificación Contractual de la Migración 20261020000000_fix_publication_gate_fail_closed.sql', () => {
    it('corrige el constraint comments_status_check para admitir PENDING_REVIEW', () => {
      expect(migrationSql).toContain('ALTER TABLE public.comments');
      expect(migrationSql).toContain('DROP CONSTRAINT IF EXISTS comments_status_check;');
      expect(migrationSql).toContain(
        "CHECK (status IN ('PENDING_REVIEW', 'PUBLISHED', 'HIDDEN', 'DELETED'))"
      );
    });

    it('define enforce_publication_gate() como SECURITY INVOKER con evaluación NULL-safe, separación IF para auth.uid() y REVOKE EXECUTE explícito', () => {
      const gateSection = migrationSql
        .split('CREATE OR REPLACE FUNCTION public.enforce_publication_gate()')[1]
        .split('-- 3. RLS DEFENSE IN DEPTH')[0];
      const gateFnBlock = gateSection.split('DROP TRIGGER IF EXISTS trg_enforce_publication_gate_posts')[0];

      expect(gateFnBlock).toContain('SECURITY INVOKER');
      expect(gateFnBlock).toContain('SET search_path = public');
      expect(gateFnBlock).toContain("COALESCE(session_user IN ('postgres', 'supabase_admin'), FALSE)");
      expect(gateFnBlock).toContain("COALESCE(current_user = 'service_role', FALSE)");
      expect(gateFnBlock).toContain("COALESCE((auth.jwt() ->> 'role') = 'service_role', FALSE)");
      expect(gateFnBlock).not.toContain("current_user IN ('postgres', 'supabase_admin')");
      expect(gateFnBlock).toContain('ELSIF auth.uid() IS NOT NULL THEN');
      expect(gateFnBlock).toContain('is_mod := COALESCE(public.is_moderator(auth.uid()) IS TRUE, FALSE);');
      expect(gateFnBlock).toContain('IF is_mod IS NOT TRUE THEN');
      expect(gateSection).toContain(
        'REVOKE EXECUTE ON FUNCTION public.enforce_publication_gate() FROM PUBLIC, anon, authenticated;'
      );
    });

    it('restringe status != PUBLISHED en las políticas RLS FOR INSERT pero conserva la edición de contenido ya PUBLISHED en FOR UPDATE', () => {
      const insertPostsPolicy = migrationSql
        .split('CREATE POLICY "Verified users can create posts"')[1]
        .split('DROP POLICY IF EXISTS "Authors can update own posts"')[0];
      const updatePostsPolicy = migrationSql
        .split('CREATE POLICY "Authors can update own posts"')[1]
        .split('DROP POLICY IF EXISTS "Verified users can create comments"')[0];

      const insertCommentsPolicy = migrationSql
        .split('CREATE POLICY "Verified users can create comments"')[1]
        .split('DROP POLICY IF EXISTS "Authors can update own comments"')[0];
      const updateCommentsPolicy = migrationSql
        .split('CREATE POLICY "Authors can update own comments"')[1]
        .split('-- 4. ALIGN record_ai_moderation_result()')[0];

      expect(insertPostsPolicy).toContain("status IS DISTINCT FROM 'PUBLISHED'");
      expect(insertCommentsPolicy).toContain("status IS DISTINCT FROM 'PUBLISHED'");

      // FOR UPDATE no debe bloquear filas cuyo NEW.status sigue siendo PUBLISHED
      expect(updatePostsPolicy).not.toContain("status IS DISTINCT FROM 'PUBLISHED'");
      expect(updateCommentsPolicy).not.toContain("status IS DISTINCT FROM 'PUBLISHED'");
    });

    it('actualiza record_ai_moderation_result() para manejar comentarios en PENDING_REVIEW (CRITICAL) y transición a PENDING_REVIEW (REVIEW)', () => {
      const recordAiBlock = migrationSql
        .split('CREATE OR REPLACE FUNCTION public.record_ai_moderation_result(')[1]
        .split('CREATE OR REPLACE FUNCTION public.sync_ai_moderation_config(')[0];

      expect(recordAiBlock).toContain("ELSIF entity_type_param = 'COMMENT' THEN");
      expect(recordAiBlock).toContain("AND status IN ('PUBLISHED', 'PENDING_REVIEW');");
      expect(recordAiBlock).toContain("SET status = 'PENDING_REVIEW', updated_at = now()");
      expect(recordAiBlock).toContain("'AI_CLASSIFICATION_' || risk_level_param");
    });

    it('endurece sync_ai_moderation_config(), apply_user_sanction() (preservando 000032) y protect_profile_readonly_fields() contra propagación NULL', () => {
      const syncConfigBlock = migrationSql
        .split('CREATE OR REPLACE FUNCTION public.sync_ai_moderation_config(')[1]
        .split('CREATE OR REPLACE FUNCTION public.apply_user_sanction(')[0];
      const sanctionBlock = migrationSql
        .split('CREATE OR REPLACE FUNCTION public.apply_user_sanction(')[1]
        .split('CREATE OR REPLACE FUNCTION public.protect_profile_readonly_fields()')[0];
      const profileBlock = migrationSql
        .split('CREATE OR REPLACE FUNCTION public.protect_profile_readonly_fields()')[1]
        .split('-- 6. CONTENT VERSIONS')[0];

      expect(syncConfigBlock).toContain('SECURITY DEFINER');
      expect(syncConfigBlock).not.toContain('current_user');
      expect(syncConfigBlock).toContain('IF is_privileged IS NOT TRUE THEN');

      // Preserves 000032 schema, actions, moderation_actions mapping, and 5-parameter signature
      expect(sanctionBlock).toContain(
        "IF action_param NOT IN ('WARNING', 'TEMPORARY_RESTRICTION', 'SUSPEND', 'PERMANENT_SUSPENSION') THEN"
      );
      expect(sanctionBlock).toContain('INSERT INTO public.user_moderation_actions (');
      expect(sanctionBlock).toContain('action,');
      expect(sanctionBlock).not.toContain('action_type,\n        reason,\n        expires_at,\n        created_by');
      expect(sanctionBlock).toContain('INSERT INTO public.moderation_actions (');
      expect(sanctionBlock).toContain('COALESCE(case_target_id = target_user_id_param, FALSE)');
      expect(sanctionBlock).toContain('COALESCE(case_author_id = target_user_id_param, FALSE)');
      expect(sanctionBlock).toContain('IF is_valid_case_user IS NOT TRUE THEN');
      expect(sanctionBlock).not.toContain(
        'REVOKE EXECUTE ON FUNCTION public.apply_user_sanction(UUID, TEXT, TIMESTAMPTZ, UUID)'
      );
      expect(sanctionBlock).toContain(
        'REVOKE EXECUTE ON FUNCTION public.apply_user_sanction(UUID, TEXT, TEXT, TIMESTAMPTZ, UUID) FROM PUBLIC, anon;'
      );
      expect(sanctionBlock).toContain(
        'GRANT EXECUTE ON FUNCTION public.apply_user_sanction(UUID, TEXT, TEXT, TIMESTAMPTZ, UUID) TO authenticated;'
      );

      expect(profileBlock).toContain('SECURITY INVOKER');
      expect(profileBlock).toContain('IF (pg_trigger_depth() <= 1) AND (is_privileged IS NOT TRUE) THEN');
    });
  });

  describe('3. Pruebas de Escenarios PostgREST (Creación, Edición, Moderación Humana, IA y Modo IA Deshabilitada)', () => {
    it('PG-01 & PG-08 (Creación con IA habilitada): usuario autenticado no moderador NO puede insertar post ni comentario en PUBLISHED, pero SÍ en PENDING_REVIEW', () => {
      // Intento de INSERT con status = PUBLISHED -> RECHAZADO
      expect(
        simulatePublicationGateOperation({
          ctx: normalUserCtx,
          entity: 'POST',
          op: 'INSERT',
          aiConfigValue: 'true',
          newStatus: 'PUBLISHED',
        }).allowed
      ).toBe(false);

      expect(
        simulatePublicationGateOperation({
          ctx: normalUserCtx,
          entity: 'COMMENT',
          op: 'INSERT',
          aiConfigValue: 'true',
          newStatus: 'PUBLISHED',
        }).allowed
      ).toBe(false);

      // INSERT con status = PENDING_REVIEW -> PERMITIDO
      expect(
        simulatePublicationGateOperation({
          ctx: normalUserCtx,
          entity: 'POST',
          op: 'INSERT',
          aiConfigValue: 'true',
          newStatus: 'PENDING_REVIEW',
        }).allowed
      ).toBe(true);

      expect(
        simulatePublicationGateOperation({
          ctx: normalUserCtx,
          entity: 'COMMENT',
          op: 'INSERT',
          aiConfigValue: 'true',
          newStatus: 'PENDING_REVIEW',
        }).allowed
      ).toBe(true);
    });

    it('PG-03 & PG-04 (Edición): autor no moderador PUEDE editar su propio post o comentario ya PUBLISHED, pero NO puede promover uno PENDING_REVIEW/HIDDEN/DELETED a PUBLISHED', () => {
      // Editar título/contenido de post propio ya PUBLISHED (sin tocar columna status) -> PERMITIDO
      expect(
        simulatePublicationGateOperation({
          ctx: normalUserCtx,
          entity: 'POST',
          op: 'UPDATE',
          aiConfigValue: 'true',
          oldStatus: 'PUBLISHED',
          newStatus: 'PUBLISHED',
          explicitlyUpdatesStatusColumn: false,
        }).allowed
      ).toBe(true);

      // Editar contenido de comentario propio ya PUBLISHED -> PERMITIDO
      expect(
        simulatePublicationGateOperation({
          ctx: normalUserCtx,
          entity: 'COMMENT',
          op: 'UPDATE',
          aiConfigValue: 'true',
          oldStatus: 'PUBLISHED',
          newStatus: 'PUBLISHED',
          explicitlyUpdatesStatusColumn: false,
        }).allowed
      ).toBe(true);

      // Intentar promover post propio de PENDING_REVIEW a PUBLISHED -> RECHAZADO (por 000008 y por trigger)
      expect(
        simulatePublicationGateOperation({
          ctx: normalUserCtx,
          entity: 'POST',
          op: 'UPDATE',
          aiConfigValue: 'true',
          oldStatus: 'PENDING_REVIEW',
          newStatus: 'PUBLISHED',
          explicitlyUpdatesStatusColumn: true,
        }).allowed
      ).toBe(false);

      // Intentar promover comentario propio de PENDING_REVIEW a PUBLISHED -> RECHAZADO (por trigger)
      expect(
        simulatePublicationGateOperation({
          ctx: normalUserCtx,
          entity: 'COMMENT',
          op: 'UPDATE',
          aiConfigValue: 'true',
          oldStatus: 'PENDING_REVIEW',
          newStatus: 'PUBLISHED',
          explicitlyUpdatesStatusColumn: true,
        }).allowed
      ).toBe(false);

      // Intentar reactivar comentario HIDDEN a PENDING_REVIEW o PUBLISHED -> RECHAZADO
      expect(
        simulatePublicationGateOperation({
          ctx: normalUserCtx,
          entity: 'COMMENT',
          op: 'UPDATE',
          aiConfigValue: 'true',
          oldStatus: 'HIDDEN',
          newStatus: 'PENDING_REVIEW',
          explicitlyUpdatesStatusColumn: true,
        }).allowed
      ).toBe(false);
    });

    it('PG-05 (Aprobación por moderación humana): moderador PUEDE aprobar contenido de PENDING_REVIEW a PUBLISHED mediante RPC o directamente', () => {
      expect(
        simulatePublicationGateOperation({
          ctx: moderatorUserCtx,
          entity: 'POST',
          op: 'UPDATE',
          aiConfigValue: 'true',
          oldStatus: 'PENDING_REVIEW',
          newStatus: 'PUBLISHED',
          viaSecurityDefinerRpc: 'EXECUTE_MODERATION_ACTION',
        }).allowed
      ).toBe(true);

      expect(
        simulatePublicationGateOperation({
          ctx: moderatorUserCtx,
          entity: 'COMMENT',
          op: 'UPDATE',
          aiConfigValue: 'true',
          oldStatus: 'PENDING_REVIEW',
          newStatus: 'PUBLISHED',
          viaSecurityDefinerRpc: 'EXECUTE_MODERATION_ACTION',
        }).allowed
      ).toBe(true);
    });

    it('PG-06 (Moderación automática con service_role): service_role PUEDE promover de PENDING_REVIEW a PUBLISHED (LOW risk) y ocultar en CRITICAL', () => {
      expect(
        simulatePublicationGateOperation({
          ctx: serviceRoleCtx,
          entity: 'POST',
          op: 'UPDATE',
          aiConfigValue: 'true',
          oldStatus: 'PENDING_REVIEW',
          newStatus: 'PUBLISHED',
        }).allowed
      ).toBe(true);

      expect(
        simulatePublicationGateOperation({
          ctx: serviceRoleCtx,
          entity: 'COMMENT',
          op: 'UPDATE',
          aiConfigValue: 'true',
          oldStatus: 'PENDING_REVIEW',
          newStatus: 'PUBLISHED',
        }).allowed
      ).toBe(true);

      expect(
        simulatePublicationGateOperation({
          ctx: serviceRoleCtx,
          entity: 'COMMENT',
          op: 'UPDATE',
          aiConfigValue: 'true',
          oldStatus: 'PENDING_REVIEW',
          newStatus: 'HIDDEN',
          viaSecurityDefinerRpc: 'RECORD_AI_MODERATION_RESULT',
        }).allowed
      ).toBe(true);
    });

    it('PG-07 (Usuarios anónimos): anon NO puede insertar ni actualizar publicaciones ni comentarios bajo ninguna configuración', () => {
      expect(
        simulatePublicationGateOperation({
          ctx: anonUserCtx,
          entity: 'POST',
          op: 'INSERT',
          aiConfigValue: 'false',
          newStatus: 'PUBLISHED',
        }).allowed
      ).toBe(false);

      expect(
        simulatePublicationGateOperation({
          ctx: anonUserCtx,
          entity: 'COMMENT',
          op: 'INSERT',
          aiConfigValue: 'false',
          newStatus: 'PUBLISHED',
        }).allowed
      ).toBe(false);
    });

    it('PG-10 (Modo IA deshabilitada): usuario verificado PUEDE insertar con status = PUBLISHED, pero NO puede promover filas PENDING_REVIEW/HIDDEN/DELETED a PUBLISHED en UPDATE', () => {
      expect(
        simulatePublicationGateOperation({
          ctx: normalUserCtx,
          entity: 'POST',
          op: 'INSERT',
          aiConfigValue: 'false',
          newStatus: 'PUBLISHED',
        }).allowed
      ).toBe(true);

      expect(
        simulatePublicationGateOperation({
          ctx: normalUserCtx,
          entity: 'COMMENT',
          op: 'INSERT',
          aiConfigValue: 'false',
          newStatus: 'PUBLISHED',
        }).allowed
      ).toBe(true);

      // Incluso con IA deshabilitada, un usuario no moderador no puede auto-promover un comentario HIDDEN o PENDING_REVIEW a PUBLISHED
      expect(
        simulatePublicationGateOperation({
          ctx: normalUserCtx,
          entity: 'COMMENT',
          op: 'UPDATE',
          aiConfigValue: 'false',
          oldStatus: 'PENDING_REVIEW',
          newStatus: 'PUBLISHED',
          explicitlyUpdatesStatusColumn: true,
        }).allowed
      ).toBe(false);

      expect(
        simulatePublicationGateOperation({
          ctx: normalUserCtx,
          entity: 'COMMENT',
          op: 'UPDATE',
          aiConfigValue: 'false',
          oldStatus: 'HIDDEN',
          newStatus: 'PUBLISHED',
          explicitlyUpdatesStatusColumn: true,
        }).allowed
      ).toBe(false);
    });
  });

  describe('4. Alineación de Servicios de Comentarios y Publicaciones con el Esquema', () => {
    it('verifica que src/lib/services/comments.ts (usado por CommentForm) consulta isModerationAiEnabled y usa PENDING_REVIEW cuando AI está activa', () => {
      const commentsService = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/services/comments.ts'),
        'utf-8'
      );
      expect(commentsService).toContain("import { isModerationAiEnabled } from '@/lib/services/moderation-config';");
      expect(commentsService).toContain("status: isAiEnabled ? 'PENDING_REVIEW' : 'PUBLISHED'");
      expect(commentsService).toContain('runAiContentModerationAction');
    });

    it('verifica que updatePost no incluye status en updateData para no contradecir REVOKE UPDATE(status) de la migración 000008', () => {
      const clientPostsService = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/services/client/posts.ts'),
        'utf-8'
      );
      expect(clientPostsService).not.toContain("updateData.status =");
    });

    it('ejecuta updatePost y updateComment verificando que version_number es un INTEGER secuencial válido (nunca Date.now()) y propaga el ID de la versión a moderación IA', async () => {
      const insertedVersions: Array<Record<string, unknown>> = [];

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'posts') {
          return {
            update: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    single: async () => ({
                      data: {
                        id: 'post-uuid-1',
                        title: 'Título editado',
                        content: 'Contenido editado',
                        status: 'PUBLISHED',
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'comments') {
          return {
            update: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    single: async () => ({
                      data: {
                        id: 'comment-uuid-1',
                        content: 'Comentario editado',
                        status: 'PUBLISHED',
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'content_versions') {
          return {
            select: () => ({
              eq: (_col1: string, entityType: string) => ({
                eq: (_col2: string, entityId: string) => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => {
                        const matching = insertedVersions.filter(
                          (v) => v.entity_type === entityType && v.entity_id === entityId
                        );
                        if (matching.length === 0) return { data: null, error: null };
                        const maxVer = Math.max(
                          ...matching.map((v) => Number(v.version_number))
                        );
                        return { data: { version_number: maxVer }, error: null };
                      },
                    }),
                  }),
                }),
              }),
            }),
            insert: (payload: Record<string, unknown>) => {
              insertedVersions.push(payload);
              return {
                select: () => ({
                  maybeSingle: async () => ({
                    data: { id: `version-${insertedVersions.length}` },
                    error: null,
                  }),
                }),
              };
            },
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      });

      const { updatePost } = await import('@/lib/services/client/posts');
      const { updateComment: updateCommentServer } = await import('@/lib/services/comments');
      const { updateComment: updateCommentClient } = await import('@/lib/services/client/comments');

      // 1ra y 2da edición de Post -> version_number = 1, luego 2
      await updatePost('post-uuid-1', { title: 'Título editado 1', content: 'Texto 1' }, 'user-1');
      await updatePost('post-uuid-1', { title: 'Título editado 2', content: 'Texto 2' }, 'user-1');

      // 1ra edición en comments.ts y 2da edición en client/comments.ts -> version_number = 1, luego 2
      await updateCommentServer('comment-uuid-1', 'Comentario editado 1', 'user-1');
      await updateCommentClient('comment-uuid-1', 'Comentario editado 2', 'user-1');

      expect(insertedVersions).toHaveLength(4);
      for (const ver of insertedVersions) {
        const vn = ver.version_number as number;
        expect(Number.isInteger(vn)).toBe(true);
        expect(vn).toBeGreaterThanOrEqual(1);
        expect(vn).toBeLessThanOrEqual(2147483647); // PostgreSQL INT4 max
      }
      expect(insertedVersions[0].version_number).toBe(1);
      expect(insertedVersions[1].version_number).toBe(2);
      expect(insertedVersions[2].version_number).toBe(1);
      expect(insertedVersions[3].version_number).toBe(2);
    });

    it('verifica el aislamiento RLS de content_versions (autor lee/retorna solo sus propias versiones; moderador lee todas; trigger previene colisiones)', () => {
      // Simulador de RLS SELECT en content_versions (000021 + 20261020000000) y trigger assign_content_version_number
      const canSelectContentVersion = (params: {
        callerUid: string;
        isModerator: boolean;
        versionRow: { edited_by: string; entity_type: 'POST' | 'COMMENT'; entity_id: string };
        entityAuthorId: string;
      }): boolean => {
        // Policy 1: "Only moderators can view content versions" (000021)
        if (params.isModerator) return true;
        // Policy 2: "Authors can view own content versions" (20261020000000)
        return (
          params.versionRow.edited_by === params.callerUid &&
          params.entityAuthorId === params.callerUid
        );
      };

      // Autor puede leer (y ejecutar INSERT ... RETURNING id) su propia versión de su propio post/comentario
      expect(
        canSelectContentVersion({
          callerUid: 'author-1',
          isModerator: false,
          versionRow: { edited_by: 'author-1', entity_type: 'COMMENT', entity_id: 'c-1' },
          entityAuthorId: 'author-1',
        })
      ).toBe(true);

      // Autor NO puede leer versiones de otro usuario
      expect(
        canSelectContentVersion({
          callerUid: 'other-user',
          isModerator: false,
          versionRow: { edited_by: 'author-1', entity_type: 'COMMENT', entity_id: 'c-1' },
          entityAuthorId: 'author-1',
        })
      ).toBe(false);

      // Autor NO puede leer una versión creada por un moderador sobre su post
      expect(
        canSelectContentVersion({
          callerUid: 'author-1',
          isModerator: false,
          versionRow: { edited_by: 'mod-1', entity_type: 'POST', entity_id: 'p-1' },
          entityAuthorId: 'author-1',
        })
      ).toBe(false);

      // Moderador PUEDE leer cualquier versión
      expect(
        canSelectContentVersion({
          callerUid: 'mod-1',
          isModerator: true,
          versionRow: { edited_by: 'author-1', entity_type: 'COMMENT', entity_id: 'c-1' },
          entityAuthorId: 'author-1',
        })
      ).toBe(true);

      // Trigger assign_content_version_number resuelve colisiones cuando ya existe una versión previa (p. ej. de moderador o edición concurrente)
      const assignVersionTrigger = (existingMax: number, proposedVersion: number | null): number => {
        if (proposedVersion === null || proposedVersion <= existingMax) {
          return existingMax + 1;
        }
        return proposedVersion;
      };

      expect(assignVersionTrigger(0, 1)).toBe(1);
      expect(assignVersionTrigger(1, 1)).toBe(2); // Evita colisión si el cliente propuso 1 pero ya existía 1
      expect(assignVersionTrigger(3, null)).toBe(4);
    });
  });

  describe('5. Verificación del Procedimiento de Recuperación Segura (supabase/rollback/20261020000000_rollback_publication_gate.sql)', () => {
    const rollbackPath = path.join(
      process.cwd(),
      'supabase/rollback/20261020000000_rollback_publication_gate.sql'
    );
    const rollbackSql = fs.readFileSync(rollbackPath, 'utf-8');

    it('RB-01: está aislado fuera de supabase/migrations/, exige guardrail explícito de confirmación y prohíbe operaciones destructivas', () => {
      const migrationsFiles = fs.readdirSync(path.join(process.cwd(), 'supabase/migrations'));
      expect(migrationsFiles.some((f) => f.includes('rollback'))).toBe(false);
      expect(rollbackSql).toContain("current_setting('app.confirm_rollback_20261020000000', TRUE)");
      expect(rollbackSql).toContain("IF confirm_val <> 'CONFIRM_ROLLBACK' THEN");

      const executableSql = rollbackSql
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n');
      expect(executableSql).not.toMatch(/DROP\s+TABLE/i);
      expect(executableSql).not.toMatch(/TRUNCATE/i);
    });

    it('RB-02: NO reintroduce implementaciones vulnerables en enforce_publication_gate(), sync_ai_moderation_config(), apply_user_sanction() ni protect_profile_readonly_fields()', () => {
      const gateBlock = rollbackSql
        .split('CREATE OR REPLACE FUNCTION public.enforce_publication_gate()')[1]
        .split('DROP TRIGGER IF EXISTS trg_enforce_publication_gate_posts')[0];
      const syncConfigBlock = rollbackSql
        .split('CREATE OR REPLACE FUNCTION public.sync_ai_moderation_config(')[1]
        .split('CREATE OR REPLACE FUNCTION public.apply_user_sanction(')[0];
      const sanctionBlock = rollbackSql
        .split('CREATE OR REPLACE FUNCTION public.apply_user_sanction(')[1]
        .split('CREATE OR REPLACE FUNCTION public.protect_profile_readonly_fields()')[0];
      const profileBlock = rollbackSql
        .split('CREATE OR REPLACE FUNCTION public.protect_profile_readonly_fields()')[1]
        .split('DROP POLICY IF EXISTS "Authors can view own content versions"')[0];

      // 1. enforce_publication_gate(): SECURITY INVOKER + NULL-safe COALESCE + ELSIF auth.uid() IS NOT NULL + IS NOT TRUE
      expect(gateBlock).toContain('SECURITY INVOKER');
      expect(gateBlock).toContain('SET search_path = public');
      expect(gateBlock).toContain("COALESCE(session_user IN ('postgres', 'supabase_admin'), FALSE)");
      expect(gateBlock).toContain('ELSIF auth.uid() IS NOT NULL THEN');
      expect(gateBlock).toContain('IF (is_mod IS NOT TRUE) AND (ai_enabled IS TRUE) THEN');
      expect(gateBlock).not.toContain('IF NOT is_privileged THEN');

      // 2. sync_ai_moderation_config(): SECURITY DEFINER + NULL-safe COALESCE + IF is_privileged IS NOT TRUE THEN
      expect(syncConfigBlock).toContain('SECURITY DEFINER');
      expect(syncConfigBlock).toContain('SET search_path = public');
      expect(syncConfigBlock).toContain("COALESCE(session_user IN ('postgres', 'supabase_admin'), FALSE)");
      expect(syncConfigBlock).toContain("COALESCE((auth.jwt() ->> 'role') = 'service_role', FALSE)");
      expect(syncConfigBlock).toContain('IF is_privileged IS NOT TRUE THEN');
      expect(syncConfigBlock).not.toContain('IF NOT is_privileged THEN');

      // 3. apply_user_sanction(): SECURITY DEFINER + 000032 5-arg contract + NULL-safe COALESCE on case_author_id + IF is_valid_case_user IS NOT TRUE THEN
      expect(sanctionBlock).toContain('SECURITY DEFINER');
      expect(sanctionBlock).toContain('SET search_path = public');
      expect(sanctionBlock).toContain(
        'IF caller_id IS NULL OR COALESCE(public.is_moderator(caller_id) IS TRUE, FALSE) IS NOT TRUE THEN'
      );
      expect(sanctionBlock).toContain('COALESCE(case_target_id = target_user_id_param, FALSE)');
      expect(sanctionBlock).toContain('COALESCE(case_author_id = target_user_id_param, FALSE)');
      expect(sanctionBlock).toContain('IF is_valid_case_user IS NOT TRUE THEN');
      expect(sanctionBlock).not.toContain('IF NOT is_valid_case_user THEN');

      // 4. protect_profile_readonly_fields(): SECURITY INVOKER + pg_trigger_depth() <= 1 + is_privileged IS NOT TRUE + REVOKE EXECUTE
      expect(profileBlock).toContain('SECURITY INVOKER');
      expect(profileBlock).toContain('SET search_path = public');
      expect(profileBlock).not.toContain('SECURITY DEFINER');
      expect(profileBlock).not.toContain("current_user NOT IN ('postgres', 'supabase_admin')");
      expect(profileBlock).toContain('IF (pg_trigger_depth() <= 1) AND (is_privileged IS NOT TRUE) THEN');
      expect(profileBlock).toContain(
        'REVOKE EXECUTE ON FUNCTION public.protect_profile_readonly_fields() FROM PUBLIC, anon, authenticated;'
      );
    });

    it('RB-03: preserva edición de contenido, política SELECT propia en content_versions, trigger secuencial y moderación de comentarios en PENDING_REVIEW', () => {
      // No debe eliminar la política de lectura propia ni el trigger de numeración secuencial en content_versions
      expect(rollbackSql).toContain('CREATE POLICY "Authors can view own content versions"');
      expect(rollbackSql).toContain('ON public.content_versions FOR SELECT');
      expect(rollbackSql).toContain('CREATE OR REPLACE FUNCTION public.assign_content_version_number()');
      expect(rollbackSql).toContain('CREATE TRIGGER trg_assign_content_version_number');
      expect(rollbackSql).not.toContain('DROP POLICY IF EXISTS "Only moderators can view content versions"');
      expect(rollbackSql).not.toContain('DROP POLICY IF EXISTS "Authors can insert content versions"');

      // Conserva PENDING_REVIEW en comments_status_check de forma incondicional
      const constraintBlock = rollbackSql
        .split('-- 1. PRESERVAR COMPATIBILIDAD DE comments_status_check')[1]
        .split('-- 2. RECUPERACIÓN FAIL-CLOSED DE enforce_publication_gate()')[0];
      expect(constraintBlock).toContain(
        "CHECK (status IN ('PENDING_REVIEW', 'PUBLISHED', 'HIDDEN', 'DELETED'))"
      );
      expect(constraintBlock).not.toContain("CHECK (status IN ('PUBLISHED', 'HIDDEN', 'DELETED'))");

      // Conserva las transiciones de comentarios en record_ai_moderation_result() y restaura AI_CLASSIFICATION_
      const recordAiRollback = rollbackSql
        .split('CREATE OR REPLACE FUNCTION public.record_ai_moderation_result(')[1]
        .split('CREATE OR REPLACE FUNCTION public.sync_ai_moderation_config(')[0];
      expect(recordAiRollback).toContain("AND status IN ('PUBLISHED', 'PENDING_REVIEW');");
      expect(recordAiRollback).toContain("ELSIF entity_type_param = 'COMMENT' THEN");
      expect(recordAiRollback).toContain("SET status = 'PENDING_REVIEW', updated_at = now()");
      expect(recordAiRollback).toContain("'AI_CLASSIFICATION_' || risk_level_param");
    });

    it('RB-04: NO elimina automáticamente version = 20261020000000 de supabase_migrations.schema_migrations salvo confirmación explícita separada', () => {
      const schemaMigrationsBlock = rollbackSql.split(
        '-- 10. GESTIÓN CONTROLADA DE supabase_migrations.schema_migrations'
      )[1];
      expect(schemaMigrationsBlock).toContain(
        "current_setting('app.unregister_schema_migration_20261020000000', TRUE)"
      );
      expect(schemaMigrationsBlock).toContain("IF unregister_val = 'CONFIRM_UNREGISTER' THEN");
      expect(schemaMigrationsBlock).toContain("WHERE version = '20261020000000';");
    });

    it('RB-05: verifica en el bloque post-recuperación atributos de catálogo (prosecdef, proconfig, owner, has_function_privilege, tgenabled, pg_get_constraintdef, pg_policies e invariancia de conteos)', () => {
      const postCheckBlock = rollbackSql
        .split('-- 9. VERIFICACIONES AUTOMÁTICAS EXHAUSTIVAS POST-RECUPERACIÓN')[1]
        .split('-- 10. GESTIÓN CONTROLADA DE supabase_migrations.schema_migrations')[0];

      expect(postCheckBlock).toContain('p.prosecdef = fn_record.expected_secdef');
      expect(postCheckBlock).toContain("r.rolname IN ('postgres', 'supabase_admin')");
      expect(postCheckBlock).toContain("COALESCE('search_path=public' = ANY(p.proconfig), FALSE)");
      expect(postCheckBlock).toContain("has_function_privilege('anon', 'public.enforce_publication_gate()', 'EXECUTE')");
      expect(postCheckBlock).toContain("has_function_privilege('service_role', 'public.record_ai_moderation_result(text,uuid,uuid,text,text,text[],numeric,text)', 'EXECUTE')");
      expect(postCheckBlock).toContain("has_function_privilege('authenticated', 'public.apply_user_sanction(uuid,text,text,timestamp with time zone,uuid)', 'EXECUTE')");
      expect(postCheckBlock).toContain("position('PENDING_REVIEW' in constraint_def) = 0");
      expect(postCheckBlock).toContain("tgenabled = 'O'");
      expect(postCheckBlock).toContain("policyname = 'Authors can view own content versions'");
      expect(postCheckBlock).toContain("current_setting('app.pre_count_incident_posts', TRUE)");
      expect(postCheckBlock).toContain("current_setting('app.pre_hash_incident_posts', TRUE)");
      expect(postCheckBlock).toContain("current_setting('app.pre_count_posts', TRUE)");
      expect(postCheckBlock).toContain("current_setting('app.pre_hash_posts', TRUE)");
      expect(postCheckBlock).toContain("current_setting('app.pre_count_comments', TRUE)");
      expect(postCheckBlock).toContain("current_setting('app.pre_hash_comments', TRUE)");
      expect(postCheckBlock).toContain("current_setting('app.pre_hash_profiles', TRUE)");
      expect(postCheckBlock).toContain("current_setting('app.pre_hash_content_versions', TRUE)");
      expect(postCheckBlock).toContain("current_setting('app.pre_hash_moderation_cases', TRUE)");
      expect(postCheckBlock).toContain("current_setting('app.pre_hash_moderation_actions', TRUE)");
      expect(postCheckBlock).toContain("current_setting('app.pre_hash_user_moderation_actions', TRUE)");
      expect(postCheckBlock).toContain("current_setting('app.pre_hash_audit_logs', TRUE)");
    });
  });

  describe('6. Moderación Asíncrona, Resiliencia ante Fallos y Recuperación Fail-Closed (recoverStuckPendingReviewContent)', () => {
    it('AM-01: createPost, updatePost, createComment y updateComment esperan (await) runAiContentModerationAction dentro de try/catch y no fallan si la Server Action rechaza', async () => {
      const moderationActionMod = await import('@/app/actions/moderation-ai');
      const spyModeration = vi
        .spyOn(moderationActionMod, 'runAiContentModerationAction')
        .mockRejectedValueOnce(new Error('Network timeout on createPost'))
        .mockRejectedValueOnce(new Error('Network timeout on updatePost'))
        .mockRejectedValueOnce(new Error('Network timeout on createComment'))
        .mockRejectedValueOnce(new Error('Network timeout on updateComment'));

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'system_config') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { value: 'true' }, error: null }),
              }),
            }),
          };
        }
        if (table === 'posts') {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'post-resilient-1',
                    slug: 'post-resilient-1',
                    title: 'Post Resiliente',
                    content: 'Contenido de prueba',
                    status: 'PENDING_REVIEW',
                  },
                  error: null,
                }),
              }),
            }),
            update: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    single: async () => ({
                      data: {
                        id: 'post-resilient-1',
                        title: 'Post Resiliente Editado',
                        content: 'Contenido editado',
                        status: 'PENDING_REVIEW',
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'comments') {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'comment-resilient-1',
                    post_id: 'post-resilient-1',
                    author_id: 'user-1',
                    parent_id: null,
                    content: 'Comentario resiliente',
                    status: 'PENDING_REVIEW',
                    depth: 1,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    author: { id: 'user-1', alias: 'user1', avatar_url: null, badges: [] },
                  },
                  error: null,
                }),
              }),
            }),
            update: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    single: async () => ({
                      data: {
                        id: 'comment-resilient-1',
                        content: 'Comentario resiliente editado',
                        status: 'PENDING_REVIEW',
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'content_versions') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: { version_number: 1 }, error: null }),
                    }),
                  }),
                }),
              }),
            }),
            insert: () => ({
              select: () => ({
                maybeSingle: async () => ({ data: { id: 'ver-resilient-1' }, error: null }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      });

      const { createPost, updatePost } = await import('@/lib/services/client/posts');
      const { createComment, updateComment } = await import('@/lib/services/client/comments');

      const createdPost = await createPost(
        {
          title: 'Post Resiliente',
          content: 'Contenido de prueba',
          type: 'EXPERIENCE',
          category_id: 'cat-1',
          tags: [],
        } as any,
        'user-1'
      );
      expect(createdPost.id).toBe('post-resilient-1');
      expect(createdPost.status).toBe('PENDING_REVIEW');

      const editedPost = await updatePost(
        'post-resilient-1',
        { title: 'Post Resiliente Editado', content: 'Contenido editado' },
        'user-1'
      );
      expect(editedPost.id).toBe('post-resilient-1');

      const createdComment = await createComment(
        { post_id: 'post-resilient-1', content: 'Comentario resiliente' },
        'user-1'
      );
      expect(createdComment.id).toBe('comment-resilient-1');
      expect(createdComment.status).toBe('PENDING_REVIEW');

      const editedComment = await updateComment(
        'comment-resilient-1',
        'Comentario resiliente editado',
        'user-1'
      );
      expect(editedComment.id).toBe('comment-resilient-1');

      expect(spyModeration).toHaveBeenCalledTimes(4);
      spyModeration.mockRestore();
    });

    it('AM-02 & AM-03: recoverStuckPendingReviewContent detecta posts y comentarios huérfanos en PENDING_REVIEW, los escala fail-closed a REVIEW (AI_UNAVAILABLE) y NUNCA auto-publica ni duplica casos', async () => {
      const { recoverStuckPendingReviewContent } = await import('@/lib/services/moderation-ai');

      const openCases = new Map<string, { id: string; status: string }>();
      const aiResults = new Map<string, { id: string; case_id: string | null; risk_level: string }>();
      const rpcCalls: Array<Record<string, unknown>> = [];
      const tableUpdates: Array<{ table: string; payload: unknown }> = [];

      // Simulamos 2 posts en PENDING_REVIEW (uno huérfano, otro ya en cola con caso OPEN)
      // y 1 comentario huérfano en PENDING_REVIEW
      openCases.set('POST:post-already-queued', { id: 'case-existing-1', status: 'OPEN' });

      const mockAdminSupabase = {
        from: (table: string) => {
          if (table === 'posts') {
            return {
              select: () => ({
                eq: () => ({
                  lte: () => ({
                    order: () => ({
                      limit: async () => ({
                        data: [
                          { id: 'post-orphan-1', created_at: '2026-10-20T10:00:00Z' },
                          { id: 'post-already-queued', created_at: '2026-10-20T10:01:00Z' },
                        ],
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
              update: (payload: unknown) => {
                tableUpdates.push({ table: 'posts', payload });
                return { eq: () => ({ eq: async () => ({ data: null, error: null }) }) };
              },
            };
          }
          if (table === 'comments') {
            return {
              select: () => ({
                eq: () => ({
                  lte: () => ({
                    order: () => ({
                      limit: async () => ({
                        data: [{ id: 'comment-orphan-1', created_at: '2026-10-20T10:02:00Z' }],
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
              update: (payload: unknown) => {
                tableUpdates.push({ table: 'comments', payload });
                return { eq: () => ({ eq: async () => ({ data: null, error: null }) }) };
              },
            };
          }
          if (table === 'moderation_cases') {
            return {
              select: () => ({
                eq: (_c1: string, targetType: string) => ({
                  eq: (_c2: string, targetId: string) => ({
                    in: () => ({
                      limit: () => ({
                        maybeSingle: async () => ({
                          data: openCases.get(`${targetType}:${targetId}`) || null,
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === 'moderation_ai_results') {
            return {
              select: () => ({
                eq: (_c1: string, entityType: string) => ({
                  eq: (_c2: string, entityId: string) => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: aiResults.get(`${entityType}:${entityId}`) || null,
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          throw new Error(`Unexpected table in recovery test: ${table}`);
        },
        rpc: async (fnName: string, args: Record<string, unknown>) => {
          expect(fnName).toBe('record_ai_moderation_result');
          rpcCalls.push(args);
          const key = `${args.entity_type_param}:${args.entity_id_param}`;
          const newCaseId = `case-recovered-${rpcCalls.length}`;
          openCases.set(key, { id: newCaseId, status: 'OPEN' });
          aiResults.set(key, {
            id: `ai-res-${rpcCalls.length}`,
            case_id: newCaseId,
            risk_level: String(args.risk_level_param),
          });
          return { data: `ai-res-${rpcCalls.length}`, error: null };
        },
      };

      // 1ra ejecución: recupera post-orphan-1 y comment-orphan-1, y omite post-already-queued
      const run1 = await recoverStuckPendingReviewContent({
        staleMinutes: 0,
        supabaseClient: mockAdminSupabase,
      });

      expect(run1.scannedPosts).toBe(2);
      expect(run1.scannedComments).toBe(1);
      expect(run1.recoveredPostIds).toEqual(['post-orphan-1']);
      expect(run1.recoveredCommentIds).toEqual(['comment-orphan-1']);
      expect(run1.skippedAlreadyQueuedIds).toEqual(['post-already-queued']);
      expect(run1.errors).toHaveLength(0);

      // Verificación de seguridad: NUNCA auto-publica (jamás hace update a PUBLISHED ni envía risk_level = LOW)
      expect(tableUpdates).toHaveLength(0);
      expect(rpcCalls).toHaveLength(2);
      for (const call of rpcCalls) {
        expect(call.risk_level_param).toBe('REVIEW');
        expect(call.flags_param).toEqual(['AI_UNAVAILABLE']);
        expect(call.confidence_param).toBe(0);
      }

      // 2da ejecución inmediata sobre los mismos ítems: 100% idempotente, 0 llamadas RPC adicionales
      const run2 = await recoverStuckPendingReviewContent({
        staleMinutes: 0,
        supabaseClient: mockAdminSupabase,
      });

      expect(run2.recoveredPostIds).toHaveLength(0);
      expect(run2.recoveredCommentIds).toHaveLength(0);
      expect(run2.skippedAlreadyQueuedIds).toEqual([
        'post-orphan-1',
        'post-already-queued',
        'comment-orphan-1',
      ]);
      expect(rpcCalls).toHaveLength(2); // Sin duplicados
    });

    it('AM-04: autorización estricta en recoverStuckPendingReviewAction y authorizeModerationRecoveryCaller (bloquea anónimos y autenticados no moderadores, permite moderadores)', async () => {
      const { authorizeModerationRecoveryCaller } = await import('@/lib/services/moderation-ai');
      const { recoverStuckPendingReviewAction } = await import('@/app/actions/moderation-ai');

      // 1. Caso Anónimo (sin sesión auth.getUser)
      const mockAnonClient = {
        auth: {
          getUser: async () => ({ data: { user: null }, error: new Error('Auth session missing') }),
        },
      };
      const anonAuth = await authorizeModerationRecoveryCaller(mockAnonClient);
      expect(anonAuth.authorized).toBe(false);
      expect(anonAuth.status).toBe('UNAUTHORIZED');

      // 2. Caso Usuario Autenticado Normal (no moderador, no admin)
      const mockUserClient = {
        auth: {
          getUser: async () => ({
            data: { user: { id: 'user-normal-uuid' } },
            error: null,
          }),
        },
        rpc: async (fn: string) => {
          if (fn === 'is_moderator' || fn === 'is_admin') {
            return { data: false, error: null };
          }
          return { data: null, error: null };
        },
      };
      const userAuth = await authorizeModerationRecoveryCaller(mockUserClient);
      expect(userAuth.authorized).toBe(false);
      expect(userAuth.status).toBe('FORBIDDEN');

      // 3. Caso Moderador Autenticado
      const mockModClient = {
        auth: {
          getUser: async () => ({
            data: { user: { id: 'mod-uuid' } },
            error: null,
          }),
        },
        rpc: async (fn: string) => {
          if (fn === 'is_moderator') return { data: true, error: null };
          if (fn === 'is_admin') return { data: false, error: null };
          return { data: null, error: null };
        },
      };
      const modAuth = await authorizeModerationRecoveryCaller(mockModClient);
      expect(modAuth.authorized).toBe(true);
      expect(modAuth.status).toBe('AUTHORIZED');
    });

    it('AM-05: llamadas concurrentes a recoverStuckPendingReviewContent se serializan por entidad sin duplicar RPC ni casos', async () => {
      const { recoverStuckPendingReviewContent } = await import('@/lib/services/moderation-ai');

      let rpcInvocations = 0;
      const createdCaseIds: string[] = [];

      const mockAdmin = {
        from: (table: string) => {
          if (table === 'posts') {
            return {
              select: () => ({
                eq: () => ({
                  lte: () => ({
                    order: () => ({
                      limit: () => ({
                        eq: async () => ({
                          data: [{ id: 'post-race-1', created_at: '2026-10-20T10:00:00Z' }],
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === 'moderation_cases') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    in: () => ({
                      limit: () => ({
                        maybeSingle: async () => {
                          if (createdCaseIds.length > 0) {
                            return { data: { id: createdCaseIds[0], status: 'OPEN' }, error: null };
                          }
                          return { data: null, error: null };
                        },
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === 'moderation_ai_results') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    limit: () => ({
                      maybeSingle: async () => {
                        if (createdCaseIds.length > 0) {
                          return { data: { id: 'ai-1', case_id: createdCaseIds[0] }, error: null };
                        }
                        return { data: null, error: null };
                      },
                    }),
                  }),
                }),
              }),
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        },
        rpc: async (fn: string) => {
          if (fn === 'record_ai_moderation_result') {
            rpcInvocations++;
            // Simulamos pequeña latencia asíncrona
            await new Promise((resolve) => setTimeout(resolve, 20));
            const newCase = `case-race-${rpcInvocations}`;
            createdCaseIds.push(newCase);
            return { data: `ai-race-${rpcInvocations}`, error: null };
          }
          return { data: null, error: null };
        },
      };

      // Lanzamos 3 recuperaciones concurrentes para el mismo post
      const [r1, r2, r3] = await Promise.all([
        recoverStuckPendingReviewContent({
          entityType: 'POST',
          entityId: 'post-race-1',
          staleMinutes: 0,
          supabaseClient: mockAdmin,
        }),
        recoverStuckPendingReviewContent({
          entityType: 'POST',
          entityId: 'post-race-1',
          staleMinutes: 0,
          supabaseClient: mockAdmin,
        }),
        recoverStuckPendingReviewContent({
          entityType: 'POST',
          entityId: 'post-race-1',
          staleMinutes: 0,
          supabaseClient: mockAdmin,
        }),
      ]);

      expect(rpcInvocations).toBe(1);
      const totalRecovered = r1.recoveredPostIds.length + r2.recoveredPostIds.length + r3.recoveredPostIds.length;
      const totalSkipped = r1.skippedAlreadyQueuedIds.length + r2.skippedAlreadyQueuedIds.length + r3.skippedAlreadyQueuedIds.length;
      expect(totalRecovered).toBe(1);
      expect(totalSkipped).toBe(2);
    });
  });

  describe('7. Versionado (content_versions): Autoridad del Trigger, Concurrencia y Resiliencia ante Errores', () => {
    it('CV-01 & CV-02: si falla SELECT o INSERT en content_versions, updatePost y updateComment retornan resultado coherente al usuario y disparan igualmente la moderación IA', async () => {
      const moderationActionMod = await import('@/app/actions/moderation-ai');
      const moderationCalls: Array<Record<string, unknown>> = [];
      const spyModeration = vi
        .spyOn(moderationActionMod, 'runAiContentModerationAction')
        .mockImplementation(async (params: any) => {
          moderationCalls.push(params);
          return { status: 'SUCCESS', aiResultId: 'ai-1', classification: {} as any };
        });

      const insertedVersionPayloads: Array<Record<string, unknown>> = [];

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'posts') {
          return {
            update: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    single: async () => ({
                      data: {
                        id: 'post-cv-err-1',
                        title: 'Título guardado en DB',
                        content: 'Contenido guardado en DB',
                        status: 'PUBLISHED',
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'comments') {
          return {
            update: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    single: async () => ({
                      data: {
                        id: 'comment-cv-err-1',
                        content: 'Comentario guardado en DB',
                        status: 'PUBLISHED',
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'content_versions') {
          return {
            // Simulamos que SELECT falla por error de permisos/red
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: null,
                        error: { message: 'Simulated RLS/read failure on content_versions' },
                      }),
                    }),
                  }),
                }),
              }),
            }),
            // Simulamos que INSERT también devuelve error de persistencia
            insert: (payload: Record<string, unknown>) => {
              insertedVersionPayloads.push(payload);
              return {
                select: () => ({
                  maybeSingle: async () => ({
                    data: null,
                    error: { message: 'Simulated insert error on content_versions' },
                  }),
                }),
              };
            },
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      });

      const { updatePost } = await import('@/lib/services/client/posts');
      const { updateComment: updateCommentClient } = await import('@/lib/services/client/comments');
      const { updateComment: updateCommentServer } = await import('@/lib/services/comments');

      const postResult = await updatePost(
        'post-cv-err-1',
        { title: 'Título guardado en DB', content: 'Contenido guardado en DB' },
        'user-1'
      );
      expect(postResult.id).toBe('post-cv-err-1');
      expect(postResult.title).toBe('Título guardado en DB');

      const commentClientResult = await updateCommentClient(
        'comment-cv-err-1',
        'Comentario guardado en DB',
        'user-1'
      );
      expect(commentClientResult.id).toBe('comment-cv-err-1');

      const commentServerResult = await updateCommentServer(
        'comment-cv-err-1',
        'Comentario guardado en DB 2',
        'user-1'
      );
      expect(commentServerResult.id).toBe('comment-cv-err-1');

      // Cuando falla el SELECT previo, la app envía version_number = 1 delegando la autoridad al trigger DB
      expect(insertedVersionPayloads).toHaveLength(3);
      expect(insertedVersionPayloads[0].version_number).toBe(1);
      expect(insertedVersionPayloads[1].version_number).toBe(1);
      expect(insertedVersionPayloads[2].version_number).toBe(1);

      // Aunque falló el INSERT en content_versions, la moderación IA fue invocada con versionId: null
      expect(moderationCalls).toHaveLength(3);
      expect(moderationCalls[0]).toEqual({
        entityType: 'POST',
        entityId: 'post-cv-err-1',
        versionId: null,
      });
      expect(moderationCalls[1]).toEqual({
        entityType: 'COMMENT',
        entityId: 'comment-cv-err-1',
        versionId: null,
      });
      expect(moderationCalls[2]).toEqual({
        entityType: 'COMMENT',
        entityId: 'comment-cv-err-1',
        versionId: null,
      });

      spyModeration.mockRestore();
    });

    it('CV-03: ediciones concurrentes e intercaladas con moderador bajo la autoridad del trigger assign_content_version_number() producen numeración estrictamente secuencial sin colisiones', async () => {
      // Simulamos la tabla content_versions con el trigger BEFORE INSERT assign_content_version_number()
      // (SECURITY DEFINER, lee el MAX global sin filtro RLS) mientras el cliente autor solo ve sus propias filas por RLS
      const dbVersionRows: Array<{
        id: string;
        entity_type: string;
        entity_id: string;
        version_number: number;
        edited_by: string;
      }> = [
        // Un moderador creó previamente la versión 1 y la versión 2 (invisibles para el autor bajo RLS)
        {
          id: 'ver-mod-1',
          entity_type: 'POST',
          entity_id: 'post-concurrent-1',
          version_number: 1,
          edited_by: 'moderator-uid',
        },
        {
          id: 'ver-mod-2',
          entity_type: 'POST',
          entity_id: 'post-concurrent-1',
          version_number: 2,
          edited_by: 'moderator-uid',
        },
      ];

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'posts') {
          return {
            update: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    single: async () => ({
                      data: {
                        id: 'post-concurrent-1',
                        title: 'Edición concurrente',
                        content: 'Contenido concurrente',
                        status: 'PUBLISHED',
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'content_versions') {
          return {
            select: () => ({
              eq: (_c1: string, entityType: string) => ({
                eq: (_c2: string, entityId: string) => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => {
                        // Bajo RLS ("Authors can view own content versions"), el autor solo ve edited_by === 'author-uid'
                        const visibleToAuthor = dbVersionRows.filter(
                          (r) =>
                            r.entity_type === entityType &&
                            r.entity_id === entityId &&
                            r.edited_by === 'author-uid'
                        );
                        if (visibleToAuthor.length === 0) return { data: null, error: null };
                        const maxVisible = Math.max(...visibleToAuthor.map((r) => r.version_number));
                        return { data: { version_number: maxVisible }, error: null };
                      },
                    }),
                  }),
                }),
              }),
            }),
            insert: (payload: Record<string, unknown>) => {
              // El trigger BEFORE INSERT assign_content_version_number() (SECURITY DEFINER + pg_advisory_xact_lock)
              // calcula el MAX real sobre TODAS las filas de la entidad sin restricción RLS:
              const allEntityRows = dbVersionRows.filter(
                (r) =>
                  r.entity_type === payload.entity_type && r.entity_id === payload.entity_id
              );
              const globalMax =
                allEntityRows.length === 0
                  ? 0
                  : Math.max(...allEntityRows.map((r) => r.version_number));
              const proposed = Number(payload.version_number);
              const authoritativeVersionNumber =
                !Number.isInteger(proposed) || proposed <= 0 || proposed <= globalMax
                  ? globalMax + 1
                  : proposed;

              const newRow = {
                id: `ver-${dbVersionRows.length + 1}`,
                entity_type: String(payload.entity_type),
                entity_id: String(payload.entity_id),
                version_number: authoritativeVersionNumber,
                edited_by: String(payload.edited_by),
              };
              dbVersionRows.push(newRow);

              return {
                select: () => ({
                  maybeSingle: async () => ({
                    data: { id: newRow.id },
                    error: null,
                  }),
                }),
              };
            },
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      });

      const { updatePost } = await import('@/lib/services/client/posts');

      // Lanzamos 3 ediciones concurrentes del autor cuando ya existen versiones 1 y 2 de un moderador
      await Promise.all([
        updatePost('post-concurrent-1', { content: 'Edición concurrente A' }, 'author-uid'),
        updatePost('post-concurrent-1', { content: 'Edición concurrente B' }, 'author-uid'),
        updatePost('post-concurrent-1', { content: 'Edición concurrente C' }, 'author-uid'),
      ]);

      expect(dbVersionRows.map((r) => r.version_number)).toEqual([1, 2, 3, 4, 5]);
    });

    it('CV-04: reconcileMissingContentVersions detecta posts/comentarios editados con historial incompleto, inserta la versión faltante y registra auditoría', async () => {
      const { reconcileMissingContentVersions } = await import('@/lib/services/moderation-ai');

      const auditEntries: Array<Record<string, unknown>> = [];
      const versionsDb: Array<Record<string, unknown>> = [];

      const mockDb = {
        from: (table: string) => {
          if (table === 'posts') {
            return {
              select: () => ({
                order: () => ({
                  limit: () => ({
                    eq: async () => ({
                      data: [
                        {
                          id: 'post-reconcile-1',
                          author_id: 'author-rec-1',
                          title: 'Título Nuevo',
                          content: 'Contenido Nuevo Tras Edición',
                          created_at: '2026-10-20T10:00:00Z',
                          updated_at: '2026-10-20T10:05:00Z',
                        },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === 'comments') {
            return {
              select: () => ({
                order: () => ({
                  limit: () => ({
                    eq: async () => ({ data: [], error: null }),
                  }),
                }),
              }),
            };
          }
          if (table === 'content_versions') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    order: () => ({
                      limit: () => ({
                        maybeSingle: async () => ({
                          // Versión desactualizada: refleja texto anterior
                          data: {
                            id: 'v-old',
                            version_number: 1,
                            title: 'Título Viejo',
                            content: 'Contenido Viejo',
                          },
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
              insert: (payload: Record<string, unknown>) => {
                versionsDb.push(payload);
                return {
                  select: () => ({
                    maybeSingle: async () => ({
                      data: { id: 'v-repaired', version_number: 2 },
                      error: null,
                    }),
                  }),
                };
              },
            };
          }
          if (table === 'audit_logs') {
            return {
              insert: async (entry: Record<string, unknown>) => {
                auditEntries.push(entry);
                return { data: null, error: null };
              },
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        },
      };

      const result = await reconcileMissingContentVersions({
        entityType: 'POST',
        entityId: 'post-reconcile-1',
        supabaseClient: mockDb,
      });

      expect(result.repairedPostIds).toEqual(['post-reconcile-1']);
      expect(versionsDb).toHaveLength(1);
      expect(versionsDb[0].title).toBe('Título Nuevo');
      expect(versionsDb[0].content).toBe('Contenido Nuevo Tras Edición');
      expect(auditEntries).toHaveLength(1);
      expect(auditEntries[0].action).toBe('CONTENT_VERSION_RECONCILED');
    });
  });
});
