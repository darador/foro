# FOROFETICHE — DOCUMENTACIÓN TÉCNICA (FASE 1 — FUNDACIÓN)

## 1. Visión General del Proyecto

**ForoFetiche** es una comunidad anónima, discreta y moderna para compartir experiencias, preguntas y conversaciones entre adultos (+18) sobre sexualidad y fetiches.

Este repositorio implementa la arquitectura definida en el **Master Prompt de Desarrollo**, cumpliendo estrictamente con el principio de mínima exposición de datos, seguridad por defecto mediante PostgreSQL RLS (Row Level Security) y feature flags legalmente restrictivos.

---

## 2. Estado del Desarrollo

- **Fase Actual:** `FASE 1 — FUNDACIÓN` (COMPLETADA)
- **Estado de la Fase 2 (Comunidad):** EN ESPERA DE VALIDACIÓN Y AUTORIZACIÓN EXPLICITA.

---

## 3. Stack Tecnológico

- **Framework Web:** Next.js 15+ (App Router)
- **Lenguaje:** TypeScript (Estricto)
- **Estilos:** Tailwind CSS v4 + PostCSS
- **Diseño & UI:** Aesthetic Dark, discreto, móvil-primero
- **Backend / BaaS:** Supabase (Auth, PostgreSQL, RLS, Storage)
- **Test Runner:** Vitest

---

## 4. Estructura de Directorios

```
Foro/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   ├── registro/
│   │   │   └── verificar-email/
│   │   ├── (protected)/
│   │   │   ├── publicar/
│   │   │   ├── mensajes/
│   │   │   ├── perfil/
│   │   │   └── guardados/
│   │   ├── admin/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx (Dashboard)
│   │   ├── explorar/
│   │   ├── auth/callback/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   └── layout/
│   │       ├── Navbar.tsx
│   │       ├── MobileNav.tsx
│   │       └── Footer.tsx
│   ├── lib/
│   │   ├── config/
│   │   │   └── feature-flags.ts
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   ├── middleware.ts
│   │   │   └── admin.ts
│   │   └── utils.ts
│   ├── types/
│   │   └── database.ts
│   └── middleware.ts
├── supabase/
│   └── migrations/
│       ├── 20261004000000_initial_schema.sql
│       ├── 20261004000001_rls_policies.sql
│       └── 20261004000002_seed_categories.sql
├── tests/
│   ├── feature-flags.test.ts
│   └── rls-security-contract.test.ts
├── .env.example
├── .env.local
├── tsconfig.json
├── package.json
└── README.md
```

---

## 5. Configuración de Base de Datos y Seguridad (RLS)

### Principios Fundamentales:
1. **Regla de No Destrucción (Sección 5):** Ninguna migración ni script de base de datos ejecuta operaciones destructivas (`DROP`, `TRUNCATE`, `DELETE` masivo).
2. **Separación de Roles Administrativos (Regla 40 & 76):** Los roles administrativos (`SUPERADMIN`, `MODERATOR`, `DIRECTORY_ADMIN`) **NUNCA** se almacenan como un campo editable de `profiles`. Se gestionan en la tabla protegida `admin_roles`.
3. **Privacidad de Mensajes y Guardados (Regla 27 & 31):** 
   - `saved_posts`: Únicamente legible y gestionable por su propietario.
   - `messages`: Legible y enviables únicamente por los miembros de la conversación activa.
   - `user_blocks`: Aplicación estricta server-side.

### Migraciones Implementadas:
- `20261004000000_initial_schema.sql`: Creación de tablas base (`profiles`, `admin_roles`, `categories`, `posts`, `tags`, `post_tags`, `comments`, `reactions`, `saved_posts`, `post_follows`, `user_blocks`, `messages`, `reports`, `moderation_cases`, `audit_logs`, `directory_profiles`).
- `20261004000001_rls_policies.sql`: Habilitación universal de RLS y creación de políticas restrictivas para cada entidad.
- `20261004000002_seed_categories.sql`: Seed inicial de las 8 categorías principales definidas en la sección 14.

---

## 6. Feature Flags

Conforme a la **Sección 43 del Master Prompt**:
- `DIRECTORY_ENABLED` se encuentra configurado en `false` de manera predeterminada (`process.env.NEXT_PUBLIC_DIRECTORY_ENABLED === 'true'`).
- La navegación pública y las acciones del módulo de directorio permanecen ocultas hasta contar con la autorización legal correspondiente.

---

## 7. Variables de Entorno

Copie `.env.example` a `.env.local` y configure las credenciales de su proyecto en Supabase:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DIRECTORY_ENABLED=false
```

---

## 8. Instrucciones de Verificación de Fase 1

### Ejecutar Tests:
```bash
npm test
```

### Ejecutar Servidor de Desarrollo:
```bash
npm run dev
```

---

## 9. Detención Obligatoria

Conforme a la instrucción **80. PRIMERA TAREA / DETENETE**:
El desarrollo de la **Fase 1 (Fundación)** se encuentra completado y listo para revisión. **No se procederá con la Fase 2 (Comunidad) hasta recibir la validación y confirmación explícita del usuario.**
