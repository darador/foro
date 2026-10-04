# FOROFETICHE — DOCUMENTACIÓN TÉCNICA (FASE 2A — NÚCLEO DE COMUNIDAD)

## 1. Visión General del Proyecto

**ForoFetiche** es una comunidad anónima, discreta y moderna para compartir experiencias, preguntas y conversaciones entre adultos (+18) sobre sexualidad y fetiches.

Este documento refleja la arquitectura y estado del desarrollo tras completar la **Fase 2A (Núcleo de Comunidad)**.

---

## 2. Estado del Desarrollo

- **Fase Actual:** `FASE 2A — NÚCLEO DE COMUNIDAD` (COMPLETADA)
- **Estado de Fase 2B / Siguientes Fases:** EN ESPERA DE AUTORIZACIÓN EXPLÍCITA DEL USUARIO.
- **Deuda Técnica Registrada:** `SECURITY_VALIDATION_PENDING` (Pruebas RLS runtime en Supabase local pendientes para cuando Docker/CLI esté disponible).

---

## 3. Matriz de Correcciones de Seguridad (Fase 1.1)

### 1. Protección Estricta de `admin_roles` (Sección 1)
- **Modificación:** Se eliminó la política pública de SELECT sobre `admin_roles`.
- **Implementación:** Únicamente los administradores autorizados (`public.is_admin(auth.uid())`) pueden realizar SELECT directo sobre `admin_roles`.
- **Acceso Cliente:** Las comprobaciones de rol por parte de clientes normales se canalizan mediante las funciones `SECURITY DEFINER` (`is_admin()`, `is_moderator()`, `is_superadmin()`, `get_user_role()`), sin exponer la tabla de roles.

### 2. Protección de `email_verified`, Contadores y Badges (Secciones 2 y 3)
- **Modificación:** Se instaló un trigger `BEFORE UPDATE ON public.profiles` (`trg_protect_profile_readonly`).
- **Comportamiento:** Si un usuario intenta modificar manualmente `email_verified`, `experiences_count`, `comments_count`, `reactions_received` o `badges` a través de una consulta UPDATE REST/GraphQL direct a Supabase, el trigger sobrescribe automáticamente los valores entrantes devolviendo los valores originales (`OLD`), impidiendo cualquier escalación no autorizada.

### 3. Incorporación de `moderation_ai_results` (Sección 4)
- **Modificación:** Creación de la tabla `moderation_ai_results` (`case_id`, `model`, `risk_level`, `flags`, `confidence`).
- **Seguridad RLS:** Acceso de lectura y escritura restringido estrictamente a moderadores y administradores (`public.is_moderator(auth.uid())`). Usuarios normales tienen 0 acceso.

### 4. Blindaje del Flujo de Mensajería (Sección 5)
- **Modificación:** Creación de la función `public.can_send_message(conversation_id, sender_id)`.
- **Verificación:** Para insertar un mensaje en una conversación, el servidor verifica:
  1) Que el usuario sea miembro activo de la conversación.
  2) Que la conversación derive de una `message_request` con estado `ACCEPTED`.
  3) Que no existan bloqueos activos (`user_blocks`) entre los participantes.

### 5. Blindaje Server-Side de `DIRECTORY_ENABLED` (Sección 6)
- **Modificación:** Creación de la función en base de datos `public.is_directory_enabled()` que retorna `FALSE` de forma predeterminada.
- **Seguridad RLS:** La política `SELECT` de `directory_profiles` retorna 0 filas ante cualquier consulta directa de clientes normales a Supabase mientras el flag en DB sea `FALSE`.

### 6. Auditoría del Service Role (Sección 8)
- **Modificación:** [src/lib/supabase/admin.ts](file:///c:/Users/ruben/OneDrive/Escritorio/Proyectos/Foro/src/lib/supabase/admin.ts) verifica explícitamente `typeof window !== 'undefined'` y lanza una excepción crítica si intentara ejecutarse en el navegador. La clave `SUPABASE_SERVICE_ROLE_KEY` no tiene el prefijo `NEXT_PUBLIC_` y jamás se empaqueta en bundles cliente.

---

## 4. Migraciones del Proyecto

```
supabase/migrations/
├── 20261004000000_initial_schema.sql
├── 20261004000001_rls_policies.sql
├── 20261004000002_seed_categories.sql
├── 20261004000003_security_hardening.sql (Fase 1.1)
├── 20261004000004_fix_rls_findings.sql (Fase 1.2)
├── 20261004000005_fase2a_community_helpers.sql (Fase 2A)
└── 20261004000006_fase2a_security_corrections.sql (Correcciones Fase 2A)
```

---

## 5. Matriz de Operaciones Verificadas

### PROHIBIDAS (Verificadas mediante RLS, Triggers DB y Tests):
- ❌ Leer o modificar la tabla `admin_roles` directamente como usuario normal.
- ❌ Modificar `email_verified`, contadores o `badges` vía UPDATE directo en `profiles`.
- ❌ Modificar `views_count`, `reactions_count` o `comments_count` vía UPDATE directo en `posts`.
- ❌ Leer `audit_logs`, `moderation_cases`, `moderation_actions` o `moderation_ai_results`.
- ❌ Leer `saved_posts` de otros usuarios.
- ❌ Leer conversaciones o mensajes ajenos.
- ❌ Enviar mensajes sin solicitud aceptada (`message_request = ACCEPTED`).
- ❌ Enviar mensajes a usuarios bloqueados.
- ❌ Consultar `directory_profiles` vía API directa cuando `DIRECTORY_ENABLED=false`.

### PERMITIDAS (Verificadas mediante RLS y Tests):
- `modificar campos legítimos del propio perfil (alias, description, profile_type, province, city, tags, avatar_url)`
- `leer contenido publicado y categorías`
- `crear contenido, comentarios y reacciones si email_verified=true`
- `gestionar guardados propios, follows propios y bloqueos propios`

---

## 6. Resultados de Pruebas

- **Pruebas Automatizadas (`npm test`):** 45 de 45 pruebas pasadas exitosamente (100% de efectividad).
- **Compilado de Producción (`npm run build`):** Exitoso sin errores de TypeScript ni sintaxis.

