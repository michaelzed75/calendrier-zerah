import { describe, it, expect } from 'vitest';
import { formatDateToYMD, parseDateString } from './dateUtils';

describe('dateUtils', () => {
  describe('formatDateToYMD', () => {
    it('formate une date correctement en YYYY-MM-DD', () => {
      const date = new Date(2025, 0, 15); // 15 janvier 2025
      expect(formatDateToYMD(date)).toBe('2025-01-15');
    });

    it('ajoute un zéro devant les mois < 10', () => {
      const date = new Date(2025, 8, 5); // 5 septembre 2025
      expect(formatDateToYMD(date)).toBe('2025-09-05');
    });

    it('ajoute un zéro devant les jours < 10', () => {
      const date = new Date(2025, 11, 3); // 3 décembre 2025
      expect(formatDateToYMD(date)).toBe('2025-12-03');
    });

    it('gère le dernier jour de l\'année', () => {
      const date = new Date(2025, 11, 31); // 31 décembre 2025
      expect(formatDateToYMD(date)).toBe('2025-12-31');
    });

    it('gère le premier jour de l\'année', () => {
      const date = new Date(2025, 0, 1); // 1er janvier 2025
      expect(formatDateToYMD(date)).toBe('2025-01-01');
    });
  });

  describe('parseDateString', () => {
    it('parse une chaîne YYYY-MM-DD en Date', () => {
      const result = parseDateString('2025-01-15');
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0); // janvier = 0
      expect(result.getDate()).toBe(15);
    });

    it('parse correctement les mois avec zéro', () => {
      const result = parseDateString('2025-09-05');
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(8); // septembre = 8
      expect(result.getDate()).toBe(5);
    });

    it('parse le dernier jour de l\'année', () => {
      const result = parseDateString('2025-12-31');
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(11); // décembre = 11
      expect(result.getDate()).toBe(31);
    });
  });

  describe('formatDateToYMD et parseDateString sont inverses', () => {
    it('format puis parse redonne la même date', () => {
      const original = new Date(2025, 5, 20);
      const formatted = formatDateToYMD(original);
      const parsed = parseDateString(formatted);

      expect(parsed.getFullYear()).toBe(original.getFullYear());
      expect(parsed.getMonth()).toBe(original.getMonth());
      expect(parsed.getDate()).toBe(original.getDate());
    });

    it('parse puis format redonne la même chaîne', () => {
      const original = '2025-07-14';
      const parsed = parseDateString(original);
      const formatted = formatDateToYMD(parsed);

      expect(formatted).toBe(original);
    });
  });
});
