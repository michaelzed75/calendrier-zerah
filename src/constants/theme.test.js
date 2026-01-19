import { describe, it, expect } from 'vitest';
import { GRADIENT_THEMES, ACCENT_COLORS, UNSPLASH_CATEGORIES } from './theme';

describe('theme constants', () => {
  describe('GRADIENT_THEMES', () => {
    it('contient au moins un thème', () => {
      expect(GRADIENT_THEMES.length).toBeGreaterThan(0);
    });

    it('chaque thème a un id, name et gradient', () => {
      GRADIENT_THEMES.forEach(theme => {
        expect(theme).toHaveProperty('id');
        expect(theme).toHaveProperty('name');
        expect(theme).toHaveProperty('gradient');
        expect(typeof theme.id).toBe('string');
        expect(typeof theme.name).toBe('string');
        expect(typeof theme.gradient).toBe('string');
      });
    });

    it('contient le thème par défaut', () => {
      const defaultTheme = GRADIENT_THEMES.find(t => t.id === 'default');
      expect(defaultTheme).toBeDefined();
    });

    it('tous les ids sont uniques', () => {
      const ids = GRADIENT_THEMES.map(t => t.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });

    it('les gradients contiennent des classes Tailwind valides', () => {
      GRADIENT_THEMES.forEach(theme => {
        expect(theme.gradient).toMatch(/from-\w+(-\d+)?/);
        expect(theme.gradient).toMatch(/to-\w+(-\d+)?/);
      });
    });
  });

  describe('ACCENT_COLORS', () => {
    it('contient au moins une couleur', () => {
      expect(ACCENT_COLORS.length).toBeGreaterThan(0);
    });

    it('chaque couleur a toutes les propriétés requises', () => {
      ACCENT_COLORS.forEach(color => {
        expect(color).toHaveProperty('id');
        expect(color).toHaveProperty('name');
        expect(color).toHaveProperty('color');
        expect(color).toHaveProperty('hover');
        expect(color).toHaveProperty('text');
        expect(color).toHaveProperty('ring');
      });
    });

    it('tous les ids sont uniques', () => {
      const ids = ACCENT_COLORS.map(c => c.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });

    it('les classes de couleur sont des classes Tailwind bg-*', () => {
      ACCENT_COLORS.forEach(color => {
        expect(color.color).toMatch(/^bg-\w+-\d+$/);
      });
    });

    it('les classes hover sont des classes Tailwind hover:bg-*', () => {
      ACCENT_COLORS.forEach(color => {
        expect(color.hover).toMatch(/^hover:bg-\w+-\d+$/);
      });
    });

    it('les classes text sont des classes Tailwind text-*', () => {
      ACCENT_COLORS.forEach(color => {
        expect(color.text).toMatch(/^text-\w+-\d+$/);
      });
    });

    it('les classes ring sont des classes Tailwind ring-*', () => {
      ACCENT_COLORS.forEach(color => {
        expect(color.ring).toMatch(/^ring-\w+-\d+$/);
      });
    });
  });

  describe('UNSPLASH_CATEGORIES', () => {
    it('contient au moins une catégorie', () => {
      expect(UNSPLASH_CATEGORIES.length).toBeGreaterThan(0);
    });

    it('chaque catégorie a un id, name et query', () => {
      UNSPLASH_CATEGORIES.forEach(category => {
        expect(category).toHaveProperty('id');
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('query');
        expect(typeof category.id).toBe('string');
        expect(typeof category.name).toBe('string');
        expect(typeof category.query).toBe('string');
      });
    });

    it('tous les ids sont uniques', () => {
      const ids = UNSPLASH_CATEGORIES.map(c => c.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });

    it('les queries ne sont pas vides', () => {
      UNSPLASH_CATEGORIES.forEach(category => {
        expect(category.query.length).toBeGreaterThan(0);
      });
    });
  });
});
