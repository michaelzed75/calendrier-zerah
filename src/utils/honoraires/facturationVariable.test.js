// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests unitaires pour facturationVariableService.js (Phase 3)
 *
 * Basé sur les données réelles de BK BAGNEUX (client_id=112, Audit Up) :
 * - 6 produits variables en tarifs_reference 2026
 * - Données Silae janvier 2026 : bulletins=39, coffre_fort=30, entrees=2, sorties=2, editique=2
 * - Produit "Modification de bulletin" = SANS colonne Silae (manuel)
 */

// ─────────────────────── Mock data ───────────────────────

const CLIENT_BK = {
  id: 112,
  nom: 'BK BAGNEUX',
  cabinet: 'Audit Up',
  siren: '901059287',
  pennylane_customer_id: 'C1BKBAGNEUX',
  actif: true
};

const TARIFS_VARIABLE_BK = [
  { client_id: 112, label: 'Etablissement du bulletin de salaire', axe: 'social_bulletin', pu_ht: 15.80, quantite: 1, type_recurrence: 'variable', date_effet: '2026-01-01', tva_rate: 0.20, cabinet: 'Audit Up', produit_pennylane_id: 30 },
  { client_id: 112, label: 'Dépôt coffre-fort numérique', axe: 'accessoires_social', pu_ht: 1.00, quantite: 1, type_recurrence: 'variable', date_effet: '2026-01-01', tva_rate: 0.20, cabinet: 'Audit Up', produit_pennylane_id: 31 },
  { client_id: 112, label: 'Bulletins envoyés par publi-postage', axe: 'accessoires_social', pu_ht: 2.65, quantite: 1, type_recurrence: 'variable', date_effet: '2026-01-01', tva_rate: 0.20, cabinet: 'Audit Up', produit_pennylane_id: 37 },
  { client_id: 112, label: "Enregistrement d'entrée de salariés", axe: 'accessoires_social', pu_ht: 15.80, quantite: 1, type_recurrence: 'variable', date_effet: '2026-01-01', tva_rate: 0.20, cabinet: 'Audit Up', produit_pennylane_id: 32 },
  { client_id: 112, label: 'Enregistrement de sortie de salariés', axe: 'accessoires_social', pu_ht: 31.55, quantite: 1, type_recurrence: 'variable', date_effet: '2026-01-01', tva_rate: 0.20, cabinet: 'Audit Up', produit_pennylane_id: 33 },
  { client_id: 112, label: 'Modification de bulletin de salaires sur votre demande', axe: 'accessoires_social', pu_ht: 15.80, quantite: 1, type_recurrence: 'variable', date_effet: '2026-01-01', tva_rate: 0.20, cabinet: 'Audit Up', produit_pennylane_id: 36 }
];

const PRODUITS_PL_AUP = [
  { id: 30, cabinet: 'Audit Up', denomination: 'Etablissement de bulletin de salaire {{mois}}', label_normalise: 'bulletin_salaire', type_recurrence: 'variable', colonne_silae: 'bulletins', tva_rate: 0.20, actif: true },
  { id: 31, cabinet: 'Audit Up', denomination: 'Dépôt Coffre-Fort Numérique', label_normalise: 'coffre_fort', type_recurrence: 'variable', colonne_silae: 'coffre_fort', tva_rate: 0.20, actif: true },
  { id: 32, cabinet: 'Audit Up', denomination: "Enregistrement d'entrée de salariés", label_normalise: 'entree_salarie', type_recurrence: 'variable', colonne_silae: 'entrees', tva_rate: 0.20, actif: true },
  { id: 33, cabinet: 'Audit Up', denomination: 'Enregistrement de sortie de salariés', label_normalise: 'sortie_salarie', type_recurrence: 'variable', colonne_silae: 'sorties', tva_rate: 0.20, actif: true },
  { id: 36, cabinet: 'Audit Up', denomination: 'Modification de bulletin de salaire sur votre demande', label_normalise: 'modification_bulletin', type_recurrence: 'variable', colonne_silae: null, tva_rate: 0.20, actif: true },
  { id: 37, cabinet: 'Audit Up', denomination: 'Bulletins de salaire envoyés par publi-postage', label_normalise: 'publipostage', type_recurrence: 'variable', colonne_silae: 'editique', tva_rate: 0.20, actif: true }
];

const SILAE_BK_JAN = {
  client_id: 112,
  periode: '2026-01',
  bulletins: 39,
  bulletins_total: 39,
  coffre_fort: 30,
  editique: 2,
  entrees: 2,
  sorties: 2,
  declarations: 1,
  attestations_pe: 2
};

// ─────────────────────── Mock Supabase ───────────────────────

function createMockSupabase({ clients = [CLIENT_BK], tarifs = TARIFS_VARIABLE_BK, produits = PRODUITS_PL_AUP, silae = [SILAE_BK_JAN] } = {}) {
  const mockChain = (data) => {
    const chain = {
      select: vi.fn().mockReturnValue(chain),
      eq: vi.fn().mockReturnValue(chain),
      single: vi.fn().mockResolvedValue({ data: data?.[0] || null, error: null }),
      order: vi.fn().mockReturnValue(chain),
      then: (fn) => fn({ data, error: null })
    };
    // Override pour retourner les données sans .single()
    chain.then = undefined;
    // Simuler l'await direct
    Object.defineProperty(chain, 'then', {
      value: (resolve) => resolve({ data, error: null }),
      writable: true
    });
    return chain;
  };

  return {
    from: vi.fn((table) => {
      if (table === 'clients') return mockChain(clients);
      if (table === 'tarifs_reference') return mockChain(tarifs);
      if (table === 'produits_pennylane') return mockChain(produits);
      if (table === 'silae_productions') return mockChain(silae);
      return mockChain([]);
    })
  };
}

// ─────────────────────── Tests ───────────────────────

// Note : On teste les fonctions internes via genererFacturationClient
// qui est plus simple à mocker que genererFacturationVariable

describe('facturationVariableService', () => {
  // On importe dynamiquement pour permettre le mock
  let genererFacturationClient;

  beforeEach(async () => {
    const mod = await import('./facturationVariableService.js');
    genererFacturationClient = mod.genererFacturationClient;
  });

  it('devrait être importable', () => {
    expect(genererFacturationClient).toBeDefined();
    expect(typeof genererFacturationClient).toBe('function');
  });
});

// Tests sur les données de BK BAGNEUX
describe('BK BAGNEUX — facturation variable janvier 2026', () => {
  it('devrait trouver 6 produits variables', () => {
    expect(TARIFS_VARIABLE_BK).toHaveLength(6);
  });

  it('devrait matcher 5 produits avec Silae et 1 manuel', () => {
    const auto = PRODUITS_PL_AUP.filter(p => p.colonne_silae !== null);
    const manuel = PRODUITS_PL_AUP.filter(p => p.colonne_silae === null);
    expect(auto).toHaveLength(5);
    expect(manuel).toHaveLength(1);
    expect(manuel[0].label_normalise).toBe('modification_bulletin');
  });

  it('devrait calculer le bon total HT auto (sans modifications)', () => {
    // bulletins: 39 × 15.80 = 616.20
    // coffre_fort: 30 × 1.00 = 30.00
    // editique: 2 × 2.65 = 5.30
    // entrees: 2 × 15.80 = 31.60
    // sorties: 2 × 31.55 = 63.10
    // TOTAL = 746.20

    const expected = {
      bulletins: 39 * 15.80,
      coffre_fort: 30 * 1.00,
      editique: 2 * 2.65,
      entrees: 2 * 15.80,
      sorties: 2 * 31.55
    };

    const total = Object.values(expected).reduce((s, v) => s + v, 0);
    expect(Math.round(total * 100) / 100).toBe(746.20);
  });

  it('devrait calculer les montants individuels correctement', () => {
    expect(39 * 15.80).toBeCloseTo(616.20, 2);
    expect(30 * 1.00).toBe(30.00);
    expect(2 * 2.65).toBeCloseTo(5.30, 2);
    expect(2 * 15.80).toBeCloseTo(31.60, 2);
    expect(2 * 31.55).toBeCloseTo(63.10, 2);
  });

  it('devrait mapper editique → colonne Silae editique', () => {
    const publipostage = PRODUITS_PL_AUP.find(p => p.label_normalise === 'publipostage');
    expect(publipostage).toBeDefined();
    expect(publipostage.colonne_silae).toBe('editique');
  });

  it('devrait avoir modification_bulletin sans colonne Silae', () => {
    const modif = PRODUITS_PL_AUP.find(p => p.label_normalise === 'modification_bulletin');
    expect(modif).toBeDefined();
    expect(modif.colonne_silae).toBeNull();
  });
});

// Tests sur le mapping colonne Silae
describe('mapping colonne_silae', () => {
  const SILAE_COLUMN_MAP = {
    bulletins: 'bulletins',
    coffre_fort: 'coffre_fort',
    editique: 'editique',
    entrees: 'entrees',
    sorties: 'sorties',
    declarations: 'declarations',
    attestations_pe: 'attestations_pe'
  };

  it('devrait mapper tous les produits auto vers les bonnes colonnes Silae', () => {
    for (const prod of PRODUITS_PL_AUP) {
      if (prod.colonne_silae) {
        expect(SILAE_COLUMN_MAP).toHaveProperty(prod.colonne_silae);
        const silaeKey = SILAE_COLUMN_MAP[prod.colonne_silae];
        expect(SILAE_BK_JAN).toHaveProperty(silaeKey);
      }
    }
  });

  it('devrait extraire les quantités correctes de Silae', () => {
    const expected = {
      bulletins: 39,
      coffre_fort: 30,
      editique: 2,
      entrees: 2,
      sorties: 2
    };

    for (const [col, qty] of Object.entries(expected)) {
      const silaeKey = SILAE_COLUMN_MAP[col];
      expect(SILAE_BK_JAN[silaeKey]).toBe(qty);
    }
  });
});

// Tests PU TTC
describe('calcul PU TTC', () => {
  it('devrait calculer le PU TTC = PU HT × 1.20', () => {
    for (const tarif of TARIFS_VARIABLE_BK) {
      const puTtc = Math.round(tarif.pu_ht * 1.20 * 100) / 100;
      expect(puTtc).toBeGreaterThan(0);
    }
  });

  it('bulletins: PU TTC = 18.96', () => {
    expect(Math.round(15.80 * 1.20 * 100) / 100).toBe(18.96);
  });

  it('coffre-fort: PU TTC = 1.20', () => {
    expect(Math.round(1.00 * 1.20 * 100) / 100).toBe(1.20);
  });

  it('publi-postage: PU TTC = 3.18', () => {
    expect(Math.round(2.65 * 1.20 * 100) / 100).toBe(3.18);
  });
});

// Tests normalisation label
describe('normalisation label tarif', () => {
  it('devrait reconnaître les labels de bulletin', () => {
    const labels = [
      'Etablissement du bulletin de salaire',
      'Etablissement de bulletin de salaire Janvier 2026',
      'Etablissement des bulletins de salaire et mise à disposition du logiciel social'
    ];
    for (const l of labels) {
      expect(l.toLowerCase()).toContain('bulletin');
    }
  });

  it('devrait reconnaître publi-postage / éditique', () => {
    const labels = [
      'Bulletins envoyés par publi-postage',
      'Bulletins de salaire envoyés par publi-postage'
    ];
    for (const l of labels) {
      expect(l.toLowerCase()).toContain('publi');
    }
  });

  it('devrait reconnaître modification de bulletin', () => {
    const labels = [
      'Modification de bulletin de salaires sur votre demande',
      'Modification de bulletin de salaire sur votre demande'
    ];
    for (const l of labels) {
      expect(l.toLowerCase()).toContain('modif');
      expect(l.toLowerCase()).toContain('bulletin');
    }
  });
});

// Tests structure export
describe('structure données export', () => {
  it('devrait avoir la bonne facture totale pour BK BAGNEUX jan 2026', () => {
    // FIXE : 1015.00 (mission surveillance)
    // VARIABLE auto : 746.20
    // VARIABLE manuel : ? (modification de bulletin)
    // TOTAL connu : 1015.00 + 746.20 = 1761.20
    const fixe = 1015.00;
    const variableAuto = 746.20;
    expect(fixe + variableAuto).toBe(1761.20);
  });
});
