// @ts-check
import { describe, it, expect } from 'vitest';
import { diffJours, classifyTache, estEnRetard, tachesASignaler } from './tachesStatus.js';

const TODAY = '2026-06-23';

describe('diffJours', () => {
  it('compte les jours entre deux dates', () => {
    expect(diffJours('2026-06-20', '2026-06-23')).toBe(3);
    expect(diffJours('2026-06-23', '2026-06-20')).toBe(-3);
    expect(diffJours('2026-06-23', '2026-06-23')).toBe(0);
  });
});

describe('classifyTache', () => {
  const opts = { today: TODAY };

  it('faite', () => {
    expect(classifyTache({ statut: 'faite' }, opts)).toBe('faite');
  });

  it('en_retard si échéance dépassée', () => {
    expect(classifyTache({ statut: 'planifiee', date_echeance: '2026-06-20' }, opts)).toBe('en_retard');
  });

  it('en_retard si date de réalisation planifiée dépassée', () => {
    expect(classifyTache({ statut: 'planifiee', date_realisation: '2026-06-22' }, opts)).toBe('en_retard');
  });

  it('non_planifiee si à faire sans date de réalisation', () => {
    expect(classifyTache({ statut: 'a_faire' }, opts)).toBe('non_planifiee');
  });

  it('echeance_proche si échéance dans le seuil', () => {
    expect(classifyTache({ statut: 'planifiee', date_echeance: '2026-06-24', date_realisation: '2026-06-24' }, opts)).toBe('echeance_proche');
  });

  it('a_jour si planifiée pour plus tard sans échéance proche', () => {
    expect(classifyTache({ statut: 'planifiee', date_realisation: '2026-06-30' }, opts)).toBe('a_jour');
  });

  it('échéance aujourd\'hui = echeance_proche, pas en retard', () => {
    expect(classifyTache({ statut: 'planifiee', date_echeance: TODAY, date_realisation: TODAY }, opts)).toBe('echeance_proche');
  });

  it('le retard prime sur "non planifiée" (échéance passée, jamais planifiée)', () => {
    expect(classifyTache({ statut: 'a_faire', date_echeance: '2026-06-01' }, opts)).toBe('en_retard');
  });

  it('respecte un seuil de proximité personnalisé', () => {
    const t = { statut: 'planifiee', date_echeance: '2026-06-28', date_realisation: '2026-06-28' };
    expect(classifyTache(t, { today: TODAY, seuilProche: 2 })).toBe('a_jour');
    expect(classifyTache(t, { today: TODAY, seuilProche: 7 })).toBe('echeance_proche');
  });
});

describe('estEnRetard', () => {
  it('true si en retard', () => {
    expect(estEnRetard({ statut: 'planifiee', date_echeance: '2026-06-01' }, TODAY)).toBe(true);
  });
  it('false sinon', () => {
    expect(estEnRetard({ statut: 'faite', date_echeance: '2026-06-01' }, TODAY)).toBe(false);
    expect(estEnRetard({ statut: 'a_faire' }, TODAY)).toBe(false);
  });
});

describe('tachesASignaler', () => {
  it('répartit les tâches dans les bons paniers', () => {
    const taches = [
      { statut: 'planifiee', date_echeance: '2026-06-01' },        // en retard
      { statut: 'a_faire' },                                       // non planifiée
      { statut: 'planifiee', date_echeance: '2026-06-24', date_realisation: '2026-06-24' }, // proche
      { statut: 'planifiee', date_realisation: '2026-07-10' },     // à jour (ignorée)
      { statut: 'faite' },                                        // ignorée
    ];
    const r = tachesASignaler(taches, { today: TODAY });
    expect(r.enRetard).toHaveLength(1);
    expect(r.nonPlanifiee).toHaveLength(1);
    expect(r.echeanceProche).toHaveLength(1);
  });
});
