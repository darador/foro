import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { normalizeTag } from '../src/lib/utils';

describe('Fase 2B — Exploración y Búsqueda', () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20261004000009_fase2b_search_and_exploration.sql'
  );

  it('Migration file 20261004000009_fase2b_search_and_exploration.sql exists', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it('Migration contains profile_searchable column and search indexes', () => {
    const content = fs.readFileSync(migrationPath, 'utf8');

    expect(content).toContain('profile_searchable');
    expect(content).toContain('idx_posts_fts');
    expect(content).toContain('idx_profiles_alias_trgm');
    expect(content).toContain('pg_trgm');
    expect(content).toContain('idx_posts_published_type_created');
  });

  describe('normalizeTag utility', () => {
    it('normalizes tags by removing hash symbols, whitespace, and converting to lowercase', () => {
      expect(normalizeTag('#BDSM')).toBe('bdsm');
      expect(normalizeTag('  #Swingers  ')).toBe('swingers');
      expect(normalizeTag('FETICHE')).toBe('fetiche');
      expect(normalizeTag('')).toBe('');
    });

    it('handles URL encoded tag inputs', () => {
      expect(normalizeTag('%23pareja')).toBe('pareja');
      expect(normalizeTag('roleplay%20bdsm')).toBe('roleplay bdsm');
    });
  });

  describe('Search service privacy and visibility contracts', () => {
    it('Search file src/lib/services/search.ts exists and enforces PUBLISHED status & profile_searchable', () => {
      const searchServicePath = path.join(process.cwd(), 'src', 'lib', 'services', 'search.ts');
      expect(fs.existsSync(searchServicePath)).toBe(true);

      const content = fs.readFileSync(searchServicePath, 'utf8');

      // Ensures status = PUBLISHED filter
      expect(content).toContain("eq('status', 'PUBLISHED')");

      // Ensures profile_searchable = true filter
      expect(content).toContain("eq('profile_searchable', true)");

      // Ensures sensitive profile fields are NOT exposed
      expect(content).not.toContain('email');
      expect(content).not.toContain('admin_roles');
    });
  });
});
