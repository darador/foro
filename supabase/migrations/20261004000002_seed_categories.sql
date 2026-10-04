-- ============================================================================
-- FOROFETICHE — DATABASE MIGRATION: SEED INITIAL CATEGORIES
-- Phase 1 Foundation (Section 14 of Master Prompt)
-- ============================================================================

INSERT INTO public.categories (name, slug, description)
VALUES 
    ('Fetiches', 'fetiches', 'Conversaciones y experiencias sobre todo tipo de fetiches y atracciones particulares.'),
    ('BDSM', 'bdsm', 'Dominación, sumisión, bondage, masoquismo, disciplina y prácticas BDSM consensuadas.'),
    ('Swinger', 'swinger', 'Intercambio de pareja, estilo de vida swinger y experiencias en el ambiente.'),
    ('Parejas', 'parejas', 'Dinámicas, fantasías, acuerdos y vivencias en pareja.'),
    ('Encuentros', 'encuentros', 'Relatos, preguntas y vivencias sobre citas y encuentros entre adultos.'),
    ('Escorts', 'escorts', 'Experiencias, preguntas y debates sobre el ámbito del trabajo sexual adulto.'),
    ('Lugares y eventos', 'lugares-y-eventos', 'Clubes, fiestas privadas, saunas, eventos y espacios de reunión.'),
    ('Otros', 'otros', 'Otras conversaciones adultas que no encajan directamente en las categorías anteriores.')
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;
