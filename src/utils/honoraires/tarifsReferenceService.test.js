import { describe, it, expect, vi, beforeEach } from 'vitest';

// On teste les fonctions pures/utilitaires internes de tarifsReferenceService
// Les fonctions async (supabase) sont testées avec un mock

// ============================================================
// Helper : mock Supabase
// ============================================================

function createMockSupabase({ upsertError = null, selectData = [], selectError = null, deleteData = [], deleteError = null } = {}) {
  const mock = {
    from: vi.fn(() => mock),
    upsert: vi.fn(() => ({ error: upsertError })),
    select: vi.fn(() => ({ data: selectData, error: selectError })),
    delete: vi.fn(() => mock),
    eq: vi.fn(() => mock),
    order: vi.fn(() => mock),
  };
  // Chaîne fluide : from().upsert() / from().select() / from().delete().eq().select()
  mock.from.mockReturnValue({
    upsert: mock.upsert,
    select: vi.fn(() => ({
      order: vi.fn(() => ({
        order: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({ data: selectData, error: selectError })),
              data: selectData, error: selectError
            })),
            data: selectData, error: selectError
          })),
          data: selectData, error: selectError
        })),
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({ data: selectData, error: selectError })),
            data: selectData, error: selectError
          })),
          data: selectData, error: selectError
        })),
        data: selectData, error: selectError
      })),
      eq: vi.fn(() => ({
        data: selectData, error: selectError
      })),
      data: selectData, error: selectError
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({ data: deleteData, error: deleteError }))
      }))
    }))
  });
  return mock;
}

// ============================================================
// Helper : créer un résultat client réaliste
// ============================================================

function makeResultatClient(overrides = {}) {
  return {
    client_id: 1,
    client_nom: 'Client Test',
    client_cabinet: 'Audit Up',
    exclu: false,
    mode_facturation_social: 'forfait',
    totaux_par_axe: {},
    ancien_total_ht: 12000,
    nouveau_total_ht: 12300,
    delta_total_ht: 300,
    delta_total_pourcentage: 2.5,
    nb_lignes_modifiees: 2,
    lignes: [
      {
        ligne_id: 10,
        abonnement_id: 100,
        pennylane_subscription_id: 200,
        client_id: 1,
        label: 'Mission comptable',
        axe: 'compta_mensuelle',
        quantite: 1,
        ancien_prix_unitaire_ht: 500,
        nouveau_prix_unitaire_ht: 515,
        ancien_montant_ht: 500,
        nouveau_montant_ht: 515,
        delta_ht: 15,
        delta_pourcentage: 3,
        frequence: 'monthly',
        intervalle: 1,
        status: 'in_progress'
      },
      {
        ligne_id: 11,
        abonnement_id: 100,
        pennylane_subscription_id: 200,
        client_id: 1,
        label: 'Etablissement du Bilan',
        axe: 'bilan',
        quantite: 1,
        ancien_prix_unitaire_ht: 6300,
        nouveau_prix_unitaire_ht: 6460,
        ancien_montant_ht: 6300,
        nouveau_montant_ht: 6460,
        delta_ht: 160,
        delta_pourcentage: 2.54,
        frequence: 'monthly',
        intervalle: 1,
        status: 'in_progress'
      }
    ],
    ...overrides
  };
}

// ============================================================
// Import des fonctions à tester
// ============================================================

import {
  sauvegarderTarifsBaseline,
  sauvegarderTarifsReference,
  chargerTarifsReference,
  getDatesEffetDisponibles,
  chargerProduitsPennylane,
  supprimerTarifsReference
} from './tarifsReferenceService.js';

// ============================================================
// Tests sauvegarderTarifsBaseline
// ============================================================

describe('sauvegarderTarifsBaseline', () => {
  it('sauvegarde les prix AVANT augmentation (ancien_prix_unitaire_ht)', async () => {
    const upsertCalls = [];
    const mockSupabase = {
      from: vi.fn(() => ({
        upsert: vi.fn((tarif) => {
          upsertCalls.push(tarif);
          return { error: null };
        })
      }))
    };

    const resultats = [makeResultatClient()];
    const result = await sauvegarderTarifsBaseline(mockSupabase, resultats, '2025-01-01', 'baseline_2025');

    expect(result.inserted).toBe(2);
    expect(result.errors).toHaveLength(0);

    // Vérifier que c'est l'ancien prix qui est sauvegardé
    const tarifCompta = upsertCalls.find(t => t.label === 'Mission comptable');
    expect(tarifCompta.pu_ht).toBe(500); // ancien_prix_unitaire_ht, pas 515
    expect(tarifCompta.date_effet).toBe('2025-01-01');
    expect(tarifCompta.source).toBe('baseline_2025');
    expect(tarifCompta.axe).toBe('compta_mensuelle');

    const tarifBilan = upsertCalls.find(t => t.label === 'Etablissement du Bilan');
    expect(tarifBilan.pu_ht).toBe(6300); // ancien_prix_unitaire_ht, pas 6460
  });

  it('ignore les clients exclus', async () => {
    const upsertCalls = [];
    const mockSupabase = {
      from: vi.fn(() => ({
        upsert: vi.fn((tarif) => {
          upsertCalls.push(tarif);
          return { error: null };
        })
      }))
    };

    const resultats = [makeResultatClient({ exclu: true })];
    const result = await sauvegarderTarifsBaseline(mockSupabase, resultats, '2025-01-01');

    expect(result.inserted).toBe(0);
    expect(upsertCalls).toHaveLength(0);
  });

  it('ignore les lignes sans axe', async () => {
    const upsertCalls = [];
    const mockSupabase = {
      from: vi.fn(() => ({
        upsert: vi.fn((tarif) => {
          upsertCalls.push(tarif);
          return { error: null };
        })
      }))
    };

    const resultats = [makeResultatClient({
      lignes: [
        { ligne_id: 10, label: 'Ligne classée', axe: 'compta_mensuelle', ancien_prix_unitaire_ht: 500, quantite: 1, frequence: 'monthly', intervalle: 1 },
        { ligne_id: 11, label: 'Ligne non classée', axe: null, ancien_prix_unitaire_ht: 200, quantite: 1, frequence: 'monthly', intervalle: 1 }
      ]
    })];
    const result = await sauvegarderTarifsBaseline(mockSupabase, resultats, '2025-01-01');

    expect(result.inserted).toBe(1);
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0].label).toBe('Ligne classée');
  });

  it('collecte les erreurs Supabase sans arrêter', async () => {
    let callCount = 0;
    const mockSupabase = {
      from: vi.fn(() => ({
        upsert: vi.fn(() => {
          callCount++;
          if (callCount === 1) return { error: { message: 'Erreur test' } };
          return { error: null };
        })
      }))
    };

    const resultats = [makeResultatClient()];
    const result = await sauvegarderTarifsBaseline(mockSupabase, resultats, '2025-01-01');

    expect(result.inserted).toBe(1); // La 2e ligne passe
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Erreur test');
  });

  it('attribue le bon type_recurrence (fixe pour compta, variable pour bulletin)', async () => {
    const upsertCalls = [];
    const mockSupabase = {
      from: vi.fn(() => ({
        upsert: vi.fn((tarif) => {
          upsertCalls.push(tarif);
          return { error: null };
        })
      }))
    };

    const resultats = [makeResultatClient({
      lignes: [
        { ligne_id: 10, label: 'Mission comptable', axe: 'compta_mensuelle', ancien_prix_unitaire_ht: 500, quantite: 1, frequence: 'monthly', intervalle: 1 },
        { ligne_id: 11, label: 'Bulletin de salaire', axe: 'social_bulletin', ancien_prix_unitaire_ht: 15.40, quantite: 10, frequence: 'monthly', intervalle: 1 },
        { ligne_id: 12, label: 'Coffre-fort', axe: 'accessoires_social', ancien_prix_unitaire_ht: 5, quantite: 10, frequence: 'monthly', intervalle: 1 }
      ]
    })];
    await sauvegarderTarifsBaseline(mockSupabase, resultats, '2025-01-01');

    expect(upsertCalls.find(t => t.axe === 'compta_mensuelle').type_recurrence).toBe('fixe');
    expect(upsertCalls.find(t => t.axe === 'social_bulletin').type_recurrence).toBe('variable');
    expect(upsertCalls.find(t => t.axe === 'accessoires_social').type_recurrence).toBe('variable');
  });

  it('appelle onProgress pendant la sauvegarde', async () => {
    const progressCalls = [];
    const mockSupabase = {
      from: vi.fn(() => ({
        upsert: vi.fn(() => ({ error: null }))
      }))
    };

    // Créer un client avec 25 lignes pour déclencher le callback (tous les 20)
    const lignes = Array.from({ length: 25 }, (_, i) => ({
      ligne_id: i,
      label: `Ligne ${i}`,
      axe: 'compta_mensuelle',
      ancien_prix_unitaire_ht: 100 + i,
      quantite: 1,
      frequence: 'monthly',
      intervalle: 1
    }));

    const resultats = [makeResultatClient({ lignes })];
    await sauvegarderTarifsBaseline(
      mockSupabase,
      resultats,
      '2025-01-01',
      'baseline_2025',
      (p) => progressCalls.push(p)
    );

    // Au moins 2 appels : à 20 lignes (80%) et à 100%
    expect(progressCalls.length).toBeGreaterThanOrEqual(2);
    // Dernier appel = 100%
    expect(progressCalls[progressCalls.length - 1].percent).toBe(100);
  });
});

// ============================================================
// Tests sauvegarderTarifsReference
// ============================================================

describe('sauvegarderTarifsReference', () => {
  it('sauvegarde les prix APRÈS augmentation (nouveau_prix_unitaire_ht)', async () => {
    const upsertCalls = [];
    const mockSupabase = {
      from: vi.fn(() => ({
        upsert: vi.fn((tarif) => {
          upsertCalls.push(tarif);
          return { error: null };
        })
      }))
    };

    const resultats = [makeResultatClient()];
    const result = await sauvegarderTarifsReference(mockSupabase, resultats, '2026-01-01', 'augmentation_2026');

    expect(result.inserted).toBe(2);
    expect(result.errors).toHaveLength(0);

    // Vérifier que c'est le nouveau prix qui est sauvegardé
    const tarifCompta = upsertCalls.find(t => t.label === 'Mission comptable');
    expect(tarifCompta.pu_ht).toBe(515); // nouveau_prix_unitaire_ht, pas 500
    expect(tarifCompta.date_effet).toBe('2026-01-01');
    expect(tarifCompta.source).toBe('augmentation_2026');

    const tarifBilan = upsertCalls.find(t => t.label === 'Etablissement du Bilan');
    expect(tarifBilan.pu_ht).toBe(6460); // nouveau_prix_unitaire_ht, pas 6300
  });

  it('ignore les clients exclus', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        upsert: vi.fn(() => ({ error: null }))
      }))
    };

    const resultats = [makeResultatClient({ exclu: true })];
    const result = await sauvegarderTarifsReference(mockSupabase, resultats, '2026-01-01');

    expect(result.inserted).toBe(0);
  });

  it('ignore les lignes sans axe', async () => {
    const upsertCalls = [];
    const mockSupabase = {
      from: vi.fn(() => ({
        upsert: vi.fn((tarif) => {
          upsertCalls.push(tarif);
          return { error: null };
        })
      }))
    };

    const resultats = [makeResultatClient({
      lignes: [
        { ligne_id: 10, label: 'Avec axe', axe: 'bilan', nouveau_prix_unitaire_ht: 1000, quantite: 1, frequence: 'monthly', intervalle: 1 },
        { ligne_id: 11, label: 'Sans axe', axe: null, nouveau_prix_unitaire_ht: 200, quantite: 1, frequence: 'monthly', intervalle: 1 }
      ]
    })];
    const result = await sauvegarderTarifsReference(mockSupabase, resultats, '2026-01-01');

    expect(result.inserted).toBe(1);
    expect(upsertCalls[0].label).toBe('Avec axe');
  });

  it('utilise upsert avec onConflict client_id,label,date_effet', async () => {
    let upsertOptions = null;
    const mockSupabase = {
      from: vi.fn(() => ({
        upsert: vi.fn((_tarif, options) => {
          upsertOptions = options;
          return { error: null };
        })
      }))
    };

    const resultats = [makeResultatClient({
      lignes: [{ ligne_id: 10, label: 'Test', axe: 'bilan', nouveau_prix_unitaire_ht: 1000, quantite: 1, frequence: 'monthly', intervalle: 1 }]
    })];
    await sauvegarderTarifsReference(mockSupabase, resultats, '2026-01-01');

    expect(upsertOptions).toEqual({ onConflict: 'client_id,label,date_effet' });
  });
});

// ============================================================
// Tests baseline vs reference : prix différents
// ============================================================

describe('baseline vs reference prix différents', () => {
  it('baseline sauve ancien_prix, reference sauve nouveau_prix pour le même client', async () => {
    const baselineCalls = [];
    const referenceCalls = [];

    const mockBaseline = {
      from: vi.fn(() => ({
        upsert: vi.fn((tarif) => { baselineCalls.push(tarif); return { error: null }; })
      }))
    };
    const mockReference = {
      from: vi.fn(() => ({
        upsert: vi.fn((tarif) => { referenceCalls.push(tarif); return { error: null }; })
      }))
    };

    const resultats = [makeResultatClient()];

    await sauvegarderTarifsBaseline(mockBaseline, resultats, '2025-01-01', 'baseline_2025');
    await sauvegarderTarifsReference(mockReference, resultats, '2026-01-01', 'augmentation_2026');

    // Mission comptable : ancien 500, nouveau 515
    const bCompta = baselineCalls.find(t => t.label === 'Mission comptable');
    const rCompta = referenceCalls.find(t => t.label === 'Mission comptable');
    expect(bCompta.pu_ht).toBe(500);   // ancien
    expect(rCompta.pu_ht).toBe(515);   // nouveau
    expect(bCompta.date_effet).toBe('2025-01-01');
    expect(rCompta.date_effet).toBe('2026-01-01');

    // Bilan : ancien 6300, nouveau 6460
    const bBilan = baselineCalls.find(t => t.label === 'Etablissement du Bilan');
    const rBilan = referenceCalls.find(t => t.label === 'Etablissement du Bilan');
    expect(bBilan.pu_ht).toBe(6300);
    expect(rBilan.pu_ht).toBe(6460);
  });
});

// ============================================================
// Tests getTypeRecurrence (via observation des tarifs sauvegardés)
// ============================================================

describe('getTypeRecurrence (via sauvegarderTarifsBaseline)', () => {
  const testRecurrence = async (axe, expectedType) => {
    const upsertCalls = [];
    const mockSupabase = {
      from: vi.fn(() => ({
        upsert: vi.fn((tarif) => { upsertCalls.push(tarif); return { error: null }; })
      }))
    };

    const resultats = [makeResultatClient({
      lignes: [{ ligne_id: 1, label: 'Test', axe, ancien_prix_unitaire_ht: 100, quantite: 1, frequence: 'monthly', intervalle: 1 }]
    })];
    await sauvegarderTarifsBaseline(mockSupabase, resultats, '2025-01-01');

    expect(upsertCalls[0].type_recurrence).toBe(expectedType);
  };

  it('compta_mensuelle → fixe', async () => { await testRecurrence('compta_mensuelle', 'fixe'); });
  it('bilan → fixe', async () => { await testRecurrence('bilan', 'fixe'); });
  it('pl → fixe', async () => { await testRecurrence('pl', 'fixe'); });
  it('social_forfait → fixe', async () => { await testRecurrence('social_forfait', 'fixe'); });
  it('juridique → fixe', async () => { await testRecurrence('juridique', 'fixe'); });
  it('support → fixe', async () => { await testRecurrence('support', 'fixe'); });
  it('social_bulletin → variable', async () => { await testRecurrence('social_bulletin', 'variable'); });
  it('accessoires_social → variable', async () => { await testRecurrence('accessoires_social', 'variable'); });
});
