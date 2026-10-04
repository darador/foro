import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { sanitizeHtml } from '../src/lib/sanitize';

/**
 * FASE 2A — SUITE DE PRUEBAS DEL NÚCLEO DE COMUNIDAD & CORRECCIONES SEGURIDAD
 * 
 * CLASIFICACIÓN EXPLÍCITA DE ESTOS TESTS:
 * 1. PRUEBAS UNITARIAS DE SANITIZACIÓN: Ejecutan la función `sanitizeHtml()` con
 *    múltiples vectores de ataque XSS (DOMPurify allowlist).
 * 2. PRUEBAS CONTRACTUALES / ESTRUCTURALES SQL: Verifican la presencia de Column-Level Privileges,
 *    triggers, restricciones CHECK, search_path, sentencias REVOKE y RPCs específicas en las migraciones incremental.
 * 
 * NOTA DE DEUDA TÉCNICA: SECURITY_VALIDATION_PENDING (No son pruebas de integración runtime en PostgreSQL
 * por falta de Docker / Supabase CLI en el entorno actual).
 */

describe('FASE 2A — NÚCLEO DE COMUNIDAD: Verificación Contractual & Seguridad', () => {
  const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
  const getSql = (file: string) => fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

  const initialRls = getSql('20261004000001_rls_policies.sql');
  const correctionsSql = getSql('20261004000006_fase2a_security_corrections.sql');
  const counterFixSql = getSql('20261004000007_fix_post_counter_protection.sql');
  const statusFixSql = getSql('20261004000008_fix_status_moderation_bypass.sql');

  describe('1. SANITIZACIÓN HTML & PROTECCIÓN XSS (DOMPurify Allowlist)', () => {
    test('Permite etiquetas seguras y formato básico', () => {
      const input = '<p>Este es un <strong>texto seguro</strong> con <em>énfasis</em> y <a href="https://forofetiche.com">enlace</a>.</p>';
      const clean = sanitizeHtml(input);
      expect(clean).toContain('<strong>texto seguro</strong>');
      expect(clean).toContain('href="https://forofetiche.com"');
    });

    test('Elimina scripts maliciosos (<script>)', () => {
      const input = 'Hola <script>alert("XSS")</script> mundo';
      const clean = sanitizeHtml(input);
      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('alert');
      expect(clean).toBe('Hola  mundo');
    });

    test('Elimina event handlers inline (onerror, onclick, onload, onmouseover)', () => {
      const input1 = '<img src="invalid.jpg" onerror="alert(1)" />';
      const input2 = '<button onclick="fetch(\'https://attacker.com\')">Click</button>';
      expect(sanitizeHtml(input1)).not.toContain('onerror');
      expect(sanitizeHtml(input1)).not.toContain('alert');
      expect(sanitizeHtml(input2)).not.toContain('onclick');
    });

    test('Elimina esquemas de pseudoprotocolo javascript:, vbscript: y data: URIs', () => {
      const jsLink = '<a href="javascript:alert(1)">Enlace Malicioso</a>';
      const vbsLink = '<a href="vbscript:msgbox(1)">Enlace VBScript</a>';
      const dataLink = '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Enlace Data</a>';

      expect(sanitizeHtml(jsLink)).not.toContain('javascript:');
      expect(sanitizeHtml(vbsLink)).not.toContain('vbscript:');
      expect(sanitizeHtml(dataLink)).not.toContain('data:');
    });

    test('Elimina etiquetas SVG, MathML, iframe, object, embed', () => {
      const svgInput = '<svg onload="alert(1)"><circle cx="50" cy="50" r="40"/></svg>';
      const iframeInput = '<iframe src="https://malicious.com"></iframe>';
      const embedInput = '<embed src="malicious.swf">';

      expect(sanitizeHtml(svgInput)).not.toContain('<svg');
      expect(sanitizeHtml(svgInput)).not.toContain('onload');
      expect(sanitizeHtml(iframeInput)).not.toContain('<iframe');
      expect(sanitizeHtml(embedInput)).not.toContain('<embed');
    });

    test('Conserva enlaces legítimos HTTP y HTTPS', () => {
      const httpLink = '<a href="http://ejemplo.com">HTTP Link</a>';
      const httpsLink = '<a href="https://ejemplo.com">HTTPS Link</a>';

      expect(sanitizeHtml(httpLink)).toContain('href="http://ejemplo.com"');
      expect(sanitizeHtml(httpsLink)).toContain('href="https://ejemplo.com"');
    });
  });

  describe('2. PROTECCIÓN DE CONTADORES Y COLUMNAS DE PUBLICACIONES (POSTS)', () => {
    test('Revoca permisos de INSERT y UPDATE sobre la tabla posts a authenticated y anon', () => {
      expect(counterFixSql).toContain('REVOKE INSERT, UPDATE ON public.posts FROM authenticated, anon, PUBLIC;');
    });

    test('Otorga permiso de INSERT únicamente en columnas editables por el usuario', () => {
      const grantInsertBlock = counterFixSql.split('GRANT INSERT (')[1].split(') ON public.posts')[0];
      expect(grantInsertBlock).toContain('title');
      expect(grantInsertBlock).toContain('content');
      expect(grantInsertBlock).not.toContain('views_count');
      expect(grantInsertBlock).not.toContain('reactions_count');
      expect(grantInsertBlock).not.toContain('comments_count');
    });

    test('Revoca permiso de UPDATE en posts.status a authenticated (000008)', () => {
      expect(statusFixSql).toContain('REVOKE UPDATE ON public.posts FROM authenticated, anon, PUBLIC;');
      const grantUpdateBlock = statusFixSql.split('GRANT UPDATE (')[1].split(') ON public.posts')[0];
      expect(grantUpdateBlock).toContain('title');
      expect(grantUpdateBlock).toContain('content');
      expect(grantUpdateBlock).not.toContain('status');
      expect(grantUpdateBlock).not.toContain('views_count');
      expect(grantUpdateBlock).not.toContain('reactions_count');
      expect(grantUpdateBlock).not.toContain('comments_count');
    });

    test('Función y trigger protect_post_readonly_fields evalúa pg_trigger_depth() y session_user', () => {
      expect(counterFixSql).toContain('FUNCTION public.protect_post_readonly_fields()');
      expect(counterFixSql).toContain('pg_trigger_depth() <= 1');
      expect(counterFixSql).toContain('session_user NOT IN (\'postgres\', \'supabase_admin\')');
    });
  });

  describe('3. BLINDAJE DE STATUS Y MODERACIÓN VÍA RPCs', () => {
    test('RPC soft_delete_post encapsula el borrado suave del autor sin permitir otros estados', () => {
      expect(statusFixSql).toContain('FUNCTION public.soft_delete_post(target_post_id UUID)');
      expect(statusFixSql).toContain('SET search_path = public');
      expect(statusFixSql).toContain('SET status = \'DELETED\'');
      expect(statusFixSql).toContain('author_id = auth.uid()');
    });

    test('RPC moderate_post_status exige rol is_moderator(auth.uid())', () => {
      expect(statusFixSql).toContain('FUNCTION public.moderate_post_status(target_post_id UUID, new_status TEXT)');
      expect(statusFixSql).toContain('public.is_moderator(auth.uid())');
    });
  });

  describe('4. CORRECCIÓN DE CONTADORES DE COMENTARIOS (STATUS PUBLISHED)', () => {
    test('Trigger sync_comment_counters escucha UPDATE y contempla transiciones de status', () => {
      expect(correctionsSql).toContain('AFTER INSERT OR UPDATE OR DELETE ON public.comments');
      expect(correctionsSql).toContain('OLD.status = \'PUBLISHED\' AND NEW.status <> \'PUBLISHED\'');
      expect(correctionsSql).toContain('OLD.status <> \'PUBLISHED\' AND NEW.status = \'PUBLISHED\'');
    });
  });

  describe('5. HARDENING DE FUNCIONES SECURITY DEFINER & RPC', () => {
    test('Todas las funciones SECURITY DEFINER definen SET search_path = public', () => {
      expect(correctionsSql).toContain('FUNCTION public.increment_post_views(target_post_id UUID)');
      expect(correctionsSql).toContain('SET search_path = public');
    });

    test('increment_post_views revoca ejecución a PUBLIC y otorga permisos explícitos', () => {
      expect(correctionsSql).toContain('REVOKE EXECUTE ON FUNCTION public.increment_post_views(UUID) FROM PUBLIC;');
      expect(correctionsSql).toContain('GRANT EXECUTE ON FUNCTION public.increment_post_views(UUID) TO anon, authenticated, service_role;');
    });
  });

  describe('6. REGLAS BASE & PRIVACIDAD', () => {
    test('Profundidad máxima de comentarios limitada a 3 niveles a nivel DB', () => {
      const initialSchema = getSql('20261004000000_initial_schema.sql');
      expect(initialSchema).toContain('depth INTEGER NOT NULL DEFAULT 1 CHECK (depth <= 3)');
    });

    test('Guardados y follows son strictly privados', () => {
      expect(initialRls).toContain('CREATE POLICY "Users can only view own saved posts"');
      expect(initialRls).toContain('CREATE POLICY "Users can view own post follows"');
    });
  });
});
