-- ============================================================================
-- FOROFETICHE — FASE 2B: EXPLORACIÓN Y BÚSQUEDA INCREMENTAL MIGRATION
-- Migration: 20261004000009_fase2b_search_and_exploration.sql
-- ============================================================================

-- 1. AGREGAR COLUMNA profile_searchable A PROFILES
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS profile_searchable BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.profile_searchable IS 'Indica si el perfil del usuario puede ser descubierto en las búsquedas públicas de la comunidad.';

-- 2. EXTENSIÓN Y ÍNDICES PARA BÚSQUEDA RÁPIDA (TRGM Y FTS)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índice para búsqueda de alias en perfiles públicos
CREATE INDEX IF NOT EXISTS idx_profiles_alias_trgm 
  ON public.profiles USING gin (alias gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_profiles_searchable 
  ON public.profiles (profile_searchable) 
  WHERE profile_searchable = true;

-- Índice Full Text Search (FTS) en publicaciones públicas
CREATE INDEX IF NOT EXISTS idx_posts_fts 
  ON public.posts USING gin (to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(content, '')));

-- Índices de alto rendimiento para filtros y exploración
CREATE INDEX IF NOT EXISTS idx_posts_published_type_created 
  ON public.posts (status, type, created_at DESC) 
  WHERE status = 'PUBLISHED';

CREATE INDEX IF NOT EXISTS idx_posts_published_category 
  ON public.posts (status, category_id) 
  WHERE status = 'PUBLISHED';

CREATE INDEX IF NOT EXISTS idx_posts_published_location 
  ON public.posts (status, province, city) 
  WHERE status = 'PUBLISHED';
