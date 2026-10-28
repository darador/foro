-- ============================================================================
-- FOROFETICHE — DATABASE MIGRATION: CATEGORIES AND PUBLICATION TYPES MVP
-- Safe, additive, non-destructive migration
-- ============================================================================

-- 1. Update posts_type_check to allow 'DEBATE'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'posts_type_check' 
        AND conrelid = 'public.posts'::regclass
    ) THEN
        ALTER TABLE public.posts DROP CONSTRAINT posts_type_check;
    END IF;
END $$;

ALTER TABLE public.posts 
    ADD CONSTRAINT posts_type_check 
    CHECK (type IN ('EXPERIENCE', 'QUESTION', 'CONFESSION', 'DEBATE'));

-- 2. Enhance categories table with display_order and is_active (for future admin management)
ALTER TABLE public.categories 
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

-- 3. Upsert official MVP categories
INSERT INTO public.categories (name, slug, description, is_active, display_order)
VALUES 
    ('Fetiches', 'fetiches', 'Conversaciones y experiencias sobre todo tipo de fetiches y atracciones particulares.', true, 1),
    ('BDSM', 'bdsm', 'Dominación, sumisión, bondage, masoquismo, disciplina y prácticas BDSM consensuadas.', true, 2),
    ('Encuentros', 'encuentros', 'Relatos, preguntas y vivencias sobre citas y encuentros entre adultos.', true, 3),
    ('Parejas', 'parejas', 'Dinámicas, fantasías, acuerdos y vivencias en pareja.', true, 4),
    ('Swinger', 'swinger', 'Intercambio de pareja, estilo de vida swinger y experiencias en el ambiente.', true, 5),
    ('Escorts', 'escorts', 'Experiencias, preguntas y debates sobre el ámbito del trabajo sexual adulto.', true, 6),
    ('Masajes eróticos', 'masajes-eroticos', 'Experiencias, técnicas y consultas sobre masajes eróticos y tántricos.', true, 7),
    ('Sexo virtual', 'sexo-virtual', 'Cam, sexting, llamadas y experiencias de erotismo a distancia.', true, 8),
    ('Lugares y eventos', 'lugares-y-eventos', 'Clubes, fiestas privadas, saunas, eventos y espacios de reunión.', true, 9),
    ('Otros', 'otros', 'Otras conversaciones adultas que no encajan directamente en las categorías anteriores.', true, 10)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    display_order = EXCLUDED.display_order;

-- 4. Create publication_types table for future administrative flexibility
CREATE TABLE IF NOT EXISTS public.publication_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on publication_types
ALTER TABLE public.publication_types ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active publication types
DROP POLICY IF EXISTS "Public can view active publication types" ON public.publication_types;
CREATE POLICY "Public can view active publication types" 
    ON public.publication_types FOR SELECT 
    USING (is_active = true);

-- Seed publication_types
INSERT INTO public.publication_types (slug, name, description, is_active, display_order)
VALUES
    ('EXPERIENCE', 'Experiencias', 'Relatos personales, vivencias y anécdotas de la comunidad.', true, 1),
    ('QUESTION', 'Preguntas', 'Consultas, dudas y pedidos de consejo o recomendación.', true, 2),
    ('CONFESSION', 'Confesiones', 'Pensamientos íntimos, fantasías secretas y confesiones anónimas.', true, 3),
    ('DEBATE', 'Debates', 'Temas de discusión, opiniones y debates de la comunidad.', true, 4)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    display_order = EXCLUDED.display_order;

-- 5. Safe isolation of runtime synthetic test posts from production feed
UPDATE public.posts 
SET status = 'HIDDEN'
WHERE status = 'PUBLISHED' 
  AND (title ILIKE '%[RUNTIME_TEST]%' OR content ILIKE '%[RUNTIME_TEST]%');
