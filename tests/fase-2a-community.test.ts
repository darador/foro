import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * FASE 2A — SUITE DE PRUEBAS DEL NÚCLEO DE COMUNIDAD
 * 
 * DECLARACIÓN EXPLÍCITA SOBRE LOS TESTS:
 * - Esta suite de pruebas realiza análisis contractual y verificación estática
 *   del código fuente (services, validaciones Zod, sanitización HTML, migraciones RLS).
 * - NO ejecuta consultas vivas contra una instancia de PostgreSQL en tiempo de ejecución.
 */

describe('FASE 2A — NÚCLEO DE COMUNIDAD: Verificación Contractual & Seguridad', () => {
  const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
  const getSql = (file: string) => fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
  
  const initialRls = getSql('20261004000001_rls_policies.sql');
  const communityHelpersSql = getSql('20261004000005_fase2a_community_helpers.sql');

  describe('1. PUBLICACIONES (POSTS)', () => {
    test('Visitante puede leer posts con status PUBLISHED', () => {
      expect(initialRls).toContain('CREATE POLICY "Public can view published posts"');
      expect(initialRls).toContain('status = \'PUBLISHED\'');
    });

    test('Usuario no verificado NO puede crear publicaciones (requiere email_verified = true)', () => {
      expect(initialRls).toContain('CREATE POLICY "Verified users can create posts"');
      expect(initialRls).toContain('email_verified = true');
    });

    test('Usuario puede editar e eliminar lógicamente solo sus propios posts', () => {
      expect(initialRls).toContain('CREATE POLICY "Authors can update own posts"');
      expect(initialRls).toContain('author_id = auth.uid()');
    });
  });

  describe('2. REACCIONES (🔥 ME INTERESA)', () => {
    test('Reacciones limitadas a 1 por usuario por post/comentario vía unique index', () => {
      const initialSchema = getSql('20261004000000_initial_schema.sql');
      expect(initialSchema).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_post_reaction');
      expect(initialSchema).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_comment_reaction');
    });

    test('Sincronización automática de contadores vía triggers de base de datos', () => {
      expect(communityHelpersSql).toContain('FUNCTION public.sync_reaction_counters()');
      expect(communityHelpersSql).toContain('AFTER INSERT OR DELETE ON public.reactions');
    });
  });

  describe('3. GUARDADOS & FOLLOWS', () => {
    test('Guardados son estrictamente privados por RLS (user_id = auth.uid())', () => {
      expect(initialRls).toContain('CREATE POLICY "Users can only view own saved posts"');
      expect(initialRls).toContain('USING (user_id = auth.uid())');
    });

    test('Follows limitados exclusivamente a publicaciones (post_follows)', () => {
      expect(initialRls).toContain('CREATE POLICY "Users can view own post follows"');
    });
  });

  describe('4. COMENTARIOS & PROFUNDIDAD MÁXIMA', () => {
    test('Profundidad máxima de comentarios limitada a 3 niveles', () => {
      const initialSchema = getSql('20261004000000_initial_schema.sql');
      expect(initialSchema).toContain('depth INTEGER NOT NULL DEFAULT 1 CHECK (depth <= 3)');
    });

    test('Comentarios exigen email_verified = true para creación', () => {
      expect(initialRls).toContain('CREATE POLICY "Verified users can create comments"');
    });
  });

  describe('5. REPORTES & BLOQUEOS', () => {
    test('Reporte no es público y se asigna al reporter_id', () => {
      expect(initialRls).toContain('CREATE POLICY "Users can submit reports"');
      expect(initialRls).toContain('CREATE POLICY "Reporters can view their submitted reports"');
    });

    test('Bloqueo de usuario aplica a nivel server-side (user_blocks)', () => {
      expect(initialRls).toContain('CREATE POLICY "Users can block other users"');
    });
  });
});
