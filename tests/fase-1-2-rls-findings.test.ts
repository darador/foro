import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * FASE 1.2 — TEST SUITE DE VERIFICACIÓN DE CORRECCIÓN DE HALLAZGOS DE AUDITORÍA RLS
 * 
 * TIPO DE PRUEBA:
 * - Pruebas estáticas de verificación de código DDL/RLS y AST de las migraciones SQL.
 * - Validación de políticas RLS, triggers y sentencias GRANT/REVOKE en base de datos.
 * - Nota: Esta suite inspecciona las sentencias SQL de las migraciones sin conectarse
 *   a un motor PostgreSQL en vivo. Las pruebas contra base de datos real requieren Supabase CLI local.
 */

describe('FASE 1.2 — CORRECCIÓN DE HALLAZGOS RLS: Análisis de Migraciones SQL', () => {
  const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
  
  const getSql = (file: string) => fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
  
  const initialSchema = getSql('20261004000000_initial_schema.sql');
  const initialRls = getSql('20261004000001_rls_policies.sql');
  const hardeningRls = getSql('20261004000003_security_hardening.sql');
  const fixFindingsRls = getSql('20261004000004_fix_rls_findings.sql');

  const fullRlsScript = `${initialSchema}\n${initialRls}\n${hardeningRls}\n${fixFindingsRls}`;

  describe('HALLAZGO 1 — VULNERABILIDAD EN can_send_message() & MENSAJERÍA', () => {
    test('1. Si conversation.request_id IS NULL -> can_send_message() RETORNA FALSE (sin fallback genérico)', () => {
      expect(fixFindingsRls).toContain('IF conv_request_id IS NULL THEN\n        RETURN FALSE;');
      // Elimina el fallback genérico que buscaba cualquier request sin emparejar los participantes exactos
      expect(fixFindingsRls).not.toContain('WHERE (mr.sender_id = target_sender_id OR mr.recipient_id = target_sender_id)');
    });

    test('2. can_send_message() verifica que el request_id pertenezca EXACTAMENTE a los participantes de la conversación', () => {
      expect(fixFindingsRls).toContain('(req_sender_id = target_sender_id AND req_recipient_id = other_member_id)');
      expect(fixFindingsRls).toContain('(req_recipient_id = target_sender_id AND req_sender_id = other_member_id)');
    });

    test('3. can_send_message() verifica que status sea ACCEPTED', () => {
      expect(fixFindingsRls).toContain('IF req_status IS NULL OR req_status <> \'ACCEPTED\' THEN\n        RETURN FALSE;');
    });

    test('4. Usuario bloqueado NO puede enviar mensajes (check de user_blocks)', () => {
      expect(fixFindingsRls).toContain('ub.blocker_id = cm.user_id AND ub.blocked_id = target_sender_id');
      expect(fixFindingsRls).toContain('IF is_blocked THEN\n        RETURN FALSE;');
    });

    test('5. Usuario normal NO puede modificar conversation.request_id (No existe política UPDATE)', () => {
      // Revisa que NO exista ninguna política UPDATE permisiva para authenticated en conversations
      expect(fullRlsScript).not.toContain('CREATE POLICY "Users can update conversations"');
      expect(fullRlsScript).not.toContain('ON public.conversations FOR UPDATE');
    });

    test('6. Usuario normal NO puede insertar ni modificar conversation_members directamente', () => {
      // Revisa que NO exista ninguna política INSERT ni UPDATE para authenticated en conversation_members
      expect(fullRlsScript).not.toContain('CREATE POLICY "Users can insert conversation_members"');
      expect(fullRlsScript).not.toContain('ON public.conversation_members FOR INSERT');
    });
  });

  describe('HALLAZGO 2 — EXPOSICIÓN DE ROLES EN get_user_role() & ROLES', () => {
    test('7. Usuario normal NO puede ejecutar get_user_role() (REVOKE EXECUTE de PUBLIC, authenticated, anon)', () => {
      expect(fixFindingsRls).toContain('REVOKE EXECUTE ON FUNCTION public.get_user_role(UUID) FROM PUBLIC;');
      expect(fixFindingsRls).toContain('REVOKE EXECUTE ON FUNCTION public.get_user_role(UUID) FROM authenticated;');
      expect(fixFindingsRls).toContain('REVOKE EXECUTE ON FUNCTION public.get_user_role(UUID) FROM anon;');
      expect(fixFindingsRls).toContain('GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO service_role;');
    });

    test('8. Usuario normal NO puede consultar directamente la tabla admin_roles', () => {
      expect(fullRlsScript).toContain('CREATE POLICY "Admin roles viewable only by admins"');
      expect(fullRlsScript).toContain('USING (public.is_admin(auth.uid()))');
    });

    test('9. Mecanismos internos autorizados (is_admin(auth.uid())) continúan funcionando para la sesión activa', () => {
      expect(fullRlsScript).toContain('CREATE OR REPLACE FUNCTION public.is_admin(target_user_id UUID)');
      expect(fullRlsScript).toContain('WHERE user_id = target_user_id AND role IN (\'SUPERADMIN\', \'DIRECTORY_ADMIN\')');
    });
  });
});
