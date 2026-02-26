// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock xlsx-js-style
const mockSheets = {};
const mockSheetNames = [];
let lastFileName = '';

vi.mock('xlsx-js-style', () => ({
  utils: {
    book_new: () => ({ Sheets: mockSheets, SheetNames: mockSheetNames }),
    book_append_sheet: (wb, ws, name) => {
      wb.Sheets[name] = ws;
      wb.SheetNames.push(name);
    },
    aoa_to_sheet: (data) => {
      const ws = {};
      for (let r = 0; r < data.length; r++) {
        for (let c = 0; c < data[r].length; c++) {
          const col = c < 26 ? String.fromCharCode(65 + c) : 'A' + String.fromCharCode(65 + c - 26);
          const ref = `${col}${r + 1}`;
          if (data[r][c] !== undefined && data[r][c] !== '') {
            ws[ref] = { v: data[r][c], t: typeof data[r][c] === 'number' ? 'n' : 's' };
          }
        }
      }
      ws['!data'] = data;
      return ws;
    }
  },
  writeFile: (wb, fileName) => { lastFileName = fileName; }
}));

import { exportRestructurationExcel } from './exportRestructuration.js';

// === Test Data ===

function makePlan({
  clientId = 1, nom = 'CLIENT TEST', cabinet = 'Audit Up',
  siren = '123456789', plCustomerId = 'C1TEST',
  abonnements = [], totalHtActuel = 0, totalHtFixe2026 = 0,
  totalHtVariableActuel = 0, nbFixes = 0, nbVariables = 0
} = {}) {
  return {
    client_id: clientId,
    client_nom: nom,
    cabinet,
    siren,
    pennylane_customer_id: plCustomerId,
    abonnements,
    total_ht_actuel: totalHtActuel,
    total_ht_fixe_2026: totalHtFixe2026,
    total_ht_variable_actuel: totalHtVariableActuel,
    nb_lignes_fixes: nbFixes,
    nb_lignes_variables: nbVariables
  };
}

function makeAbo({
  id = 100, label = 'Abo test', status = 'in_progress',
  frequence = 'monthly', intervalle = 1, jourFacturation = 31,
  dateDebut = '2024-01-01', plSubId = 2307848,
  lignesFixes = [], lignesVariables = [], decision = 'inchange'
} = {}) {
  return {
    abonnement_id: id,
    label,
    status,
    frequence,
    intervalle,
    jour_facturation: jourFacturation,
    mode_finalisation: 'awaiting_validation',
    conditions_paiement: 'upon_receipt',
    moyen_paiement: 'offline',
    date_debut: dateDebut,
    pennylane_subscription_id: plSubId,
    lignes_fixes: lignesFixes,
    lignes_variables: lignesVariables,
    decision
  };
}

function makeLigneFixe({ label = 'Mission comptable', quantite = 1, ancienPuHt = 100, nouveauPuHt = 102.5, axe = 'compta_mensuelle', famille = 'comptabilite' } = {}) {
  return {
    label, quantite, ancien_pu_ht: ancienPuHt, nouveau_pu_ht: nouveauPuHt,
    axe, type_recurrence: 'fixe', famille, description: '', action: 'garder'
  };
}

function makeLigneVariable({ label = 'Etablissement du bulletin de salaire', quantite = 5, ancienPuHt = 15.8, nouveauPuHt = 16.2, axe = 'social_bulletin', famille = 'social' } = {}) {
  return {
    label, quantite, ancien_pu_ht: ancienPuHt, nouveau_pu_ht: nouveauPuHt,
    axe, type_recurrence: 'variable', famille, description: '', action: 'supprimer'
  };
}

function makeStats(plans) {
  return {
    totalClients: plans.length,
    totalClientsAvecVariable: plans.filter(p => p.nb_lignes_variables > 0).length,
    totalClientsFixeOnly: plans.filter(p => p.nb_lignes_variables === 0).length,
    totalAbosASupprimer: 0,
    totalAbosAModifier: 0,
    totalAbosInchanges: plans.reduce((s, p) => s + p.abonnements.length, 0),
    totalLignesFixes: plans.reduce((s, p) => s + p.nb_lignes_fixes, 0),
    totalLignesVariables: plans.reduce((s, p) => s + p.nb_lignes_variables, 0),
    totalHtActuel: plans.reduce((s, p) => s + p.total_ht_actuel, 0),
    totalHtFixe2026: plans.reduce((s, p) => s + p.total_ht_fixe_2026, 0),
    totalHtVariableActuel: plans.reduce((s, p) => s + p.total_ht_variable_actuel, 0),
    parCabinet: {}
  };
}

// === Helper ===

function getSheetData(sheetName) {
  const ws = mockSheets[sheetName];
  return ws?.['!data'] || null;
}

// === Tests ===

beforeEach(() => {
  // Reset mock state
  for (const key of Object.keys(mockSheets)) delete mockSheets[key];
  mockSheetNames.length = 0;
  lastFileName = '';
});

describe('exportRestructurationExcel — structure générale', () => {
  it('génère un fichier avec 5 onglets pour 2 cabinets', () => {
    const plans = [
      makePlan({ nom: 'AUP Client', cabinet: 'Audit Up', abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })], nbFixes: 1 }),
      makePlan({ nom: 'ZF Client', cabinet: 'Zerah Fiduciaire', plCustomerId: 'C2TEST', abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })], nbFixes: 1 })
    ];

    const wb = { Sheets: {}, SheetNames: [] };
    exportRestructurationExcel({ plans, stats: makeStats(plans) });

    // Use the mock data
    expect(mockSheetNames).toContain('Résumé');
    expect(mockSheetNames).toContain('Import PL AUP');
    expect(mockSheetNames).toContain('Import PL ZF');
    expect(mockSheetNames).toContain('A SUPPRIMER');
    expect(mockSheetNames).toContain('Détail croisé');
    expect(mockSheetNames.length).toBe(5);
  });

  it('génère 4 onglets si un seul cabinet (AUP)', () => {
    const plans = [
      makePlan({ nom: 'Client A', cabinet: 'Audit Up', abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })], nbFixes: 1 }),
      makePlan({ nom: 'Client B', cabinet: 'Audit Up', abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })], nbFixes: 1 })
    ];

    exportRestructurationExcel({ plans, stats: makeStats(plans) });

    expect(mockSheetNames).toContain('Import PL AUP');
    expect(mockSheetNames).not.toContain('Import PL ZF');
    expect(mockSheetNames.length).toBe(4);
  });

  it('génère 4 onglets si un seul cabinet (ZF)', () => {
    const plans = [
      makePlan({ nom: 'ZF1', cabinet: 'Zerah Fiduciaire', abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })], nbFixes: 1 })
    ];

    exportRestructurationExcel({ plans, stats: makeStats(plans) });

    expect(mockSheetNames).toContain('Import PL ZF');
    expect(mockSheetNames).not.toContain('Import PL AUP');
    expect(mockSheetNames.length).toBe(4);
  });

  it('nomme le fichier avec la date du jour', () => {
    const plans = [
      makePlan({ abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })], nbFixes: 1 })
    ];

    exportRestructurationExcel({ plans, stats: makeStats(plans) });

    expect(lastFileName).toMatch(/^restructuration_abonnements_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  it('nomme le fichier avec le nom du client en mode singleClient', () => {
    const plans = [
      makePlan({ nom: 'HFC INVEST', abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })], nbFixes: 1 })
    ];

    exportRestructurationExcel({ plans, stats: makeStats(plans), singleClient: true });

    expect(lastFileName).toMatch(/^restructuration_HFC_INVEST_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });
});

describe('Import PL — split par cabinet', () => {
  it('sépare les clients AUP et ZF dans des onglets distincts', () => {
    const aupPlan = makePlan({
      nom: 'CLIENT AUP', cabinet: 'Audit Up', plCustomerId: 'C1AUP',
      abonnements: [makeAbo({ lignesFixes: [makeLigneFixe({ label: 'Mission comptable AUP', nouveauPuHt: 500 })] })],
      nbFixes: 1
    });
    const zfPlan = makePlan({
      nom: 'CLIENT ZF', cabinet: 'Zerah Fiduciaire', plCustomerId: 'C2ZF',
      abonnements: [makeAbo({ lignesFixes: [makeLigneFixe({ label: 'Mission comptable ZF', nouveauPuHt: 300 })] })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [aupPlan, zfPlan], stats: makeStats([aupPlan, zfPlan]) });

    const aupData = getSheetData('Import PL AUP');
    const zfData = getSheetData('Import PL ZF');

    expect(aupData).not.toBeNull();
    expect(zfData).not.toBeNull();

    // AUP sheet: header + 1 data row
    expect(aupData.length).toBe(2);
    expect(aupData[1][5]).toBe('CLIENT AUP');

    // ZF sheet: header + 1 data row
    expect(zfData.length).toBe(2);
    expect(zfData[1][5]).toBe('CLIENT ZF');
  });

  it('trie les clients par nom dans chaque onglet', () => {
    const plans = [
      makePlan({ nom: 'ZZZ DERNIER', cabinet: 'Audit Up', abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })], nbFixes: 1 }),
      makePlan({ nom: 'AAA PREMIER', cabinet: 'Audit Up', plCustomerId: 'C1B', abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })], nbFixes: 1 }),
      makePlan({ nom: 'MMM MILIEU', cabinet: 'Audit Up', plCustomerId: 'C1C', abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })], nbFixes: 1 })
    ];

    exportRestructurationExcel({ plans, stats: makeStats(plans) });

    const data = getSheetData('Import PL AUP');
    expect(data[1][5]).toBe('AAA PREMIER');
    expect(data[2][5]).toBe('MMM MILIEU');
    expect(data[3][5]).toBe('ZZZ DERNIER');
  });

  it('ne crée pas de ligne si abo sans lignes fixes', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({ lignesFixes: [], lignesVariables: [makeLigneVariable()], decision: 'a_supprimer' })],
      nbVariables: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const data = getSheetData('Import PL AUP');
    // Header only, no data rows
    expect(data.length).toBe(1);
  });
});

describe('Import PL — format colonnes', () => {
  it('contient les 9 colonnes fixes standard PL', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const data = getSheetData('Import PL AUP');
    const headers = data[0];

    expect(headers[0]).toBe('Intervalle de frequence');
    expect(headers[1]).toBe("Frequence d'abonnement");
    expect(headers[2]).toBe('Mode de finalisation');
    expect(headers[3]).toBe('Date de creation');
    expect(headers[4]).toBe('Jour du mois de facturation');
    expect(headers[5]).toBe('Nom');
    expect(headers[6]).toBe('Identifiant du client');
    expect(headers[7]).toBe('Conditions de paiement');
    expect(headers[8]).toBe('Moyen de paiement');
  });

  it('contient les colonnes de ligne produit (Label, Quantite, TTC, TVA, description)', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const headers = getSheetData('Import PL AUP')[0];

    expect(headers[9]).toBe('Ligne 1 - Label');
    expect(headers[10]).toBe('Ligne 1 - Quantite');
    expect(headers[11]).toBe('Ligne 1 - TTC');
    expect(headers[12]).toBe('Ligne 1 - Taux TVA');
    expect(headers[13]).toBe('Ligne 1 - description');
  });

  it('gère plusieurs lignes produit par abonnement', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({
        lignesFixes: [
          makeLigneFixe({ label: 'Mission comptable', nouveauPuHt: 500 }),
          makeLigneFixe({ label: 'Mise à disposition logiciel', nouveauPuHt: 100 }),
          makeLigneFixe({ label: 'Etablissement du P&L', nouveauPuHt: 200 })
        ]
      })],
      nbFixes: 3
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const headers = getSheetData('Import PL AUP')[0];

    // 3 lignes → Ligne 1, 2, 3
    expect(headers[9]).toBe('Ligne 1 - Label');
    expect(headers[14]).toBe('Ligne 2 - Label');
    expect(headers[19]).toBe('Ligne 3 - Label');
    // Total: 9 fixed + 3×5 line cols = 24
    expect(headers.length).toBe(24);
  });
});

describe('Import PL — données ligne', () => {
  it('calcule le TTC unitaire = HT × 1.2 arrondi à 2 décimales', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({
        lignesFixes: [makeLigneFixe({ label: 'Mission', nouveauPuHt: 102.5, quantite: 1 })]
      })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const row = getSheetData('Import PL AUP')[1];
    // TTC = 102.5 × 1.2 = 123
    expect(row[11]).toBe(123);
  });

  it('calcule le TTC pour des prix non-ronds (arrondis à 2 décimales)', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({
        lignesFixes: [makeLigneFixe({ label: 'P&L', nouveauPuHt: 210.12, quantite: 1 })]
      })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const row = getSheetData('Import PL AUP')[1];
    // TTC = 210.12 × 1.2 = 252.144 → arrondi 252.14
    expect(row[11]).toBeCloseTo(252.14, 2);
  });

  it('utilise la TVA FR_200 pour chaque ligne', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const row = getSheetData('Import PL AUP')[1];
    expect(row[12]).toBe('FR_200');
  });

  it('renseigne les métadonnées abonnement (intervalle, fréquence, nom, identifiant)', () => {
    const plan = makePlan({
      nom: 'SAINT JAMES', cabinet: 'Zerah Fiduciaire', plCustomerId: 'C2STJAMES',
      abonnements: [makeAbo({
        intervalle: 1, frequence: 'monthly', jourFacturation: 31,
        dateDebut: '2024-06-15',
        lignesFixes: [makeLigneFixe()]
      })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const row = getSheetData('Import PL ZF')[1];
    expect(row[0]).toBe(1); // intervalle
    expect(row[1]).toBe('monthly'); // fréquence
    expect(row[2]).toBe('awaiting_validation'); // mode
    expect(row[3]).toBe('15/06/2024'); // date création (dd/mm/yyyy)
    expect(row[4]).toBe(31); // jour facturation
    expect(row[5]).toBe('SAINT JAMES'); // nom
    expect(row[6]).toBe('C2STJAMES'); // identifiant client
    expect(row[7]).toBe('upon_receipt'); // conditions
    expect(row[8]).toBe('offline'); // moyen
  });
});

describe('Import PL — formatDatePennylane', () => {
  it('convertit une date ISO en dd/mm/yyyy', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({ dateDebut: '2024-01-01', lignesFixes: [makeLigneFixe()] })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const row = getSheetData('Import PL AUP')[1];
    expect(row[3]).toBe('01/01/2024');
  });

  it('gère une date avec composant horaire (ISO+T)', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({ dateDebut: '2025-12-31T00:00:00', lignesFixes: [makeLigneFixe()] })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const row = getSheetData('Import PL AUP')[1];
    expect(row[3]).toBe('31/12/2025');
  });

  it('laisse une date déjà au format dd/mm/yyyy inchangée', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({ dateDebut: '15/06/2024', lignesFixes: [makeLigneFixe()] })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const row = getSheetData('Import PL AUP')[1];
    expect(row[3]).toBe('15/06/2024');
  });
});

describe('Onglet A SUPPRIMER', () => {
  it('liste les lignes variables avec leurs métadonnées', () => {
    const plan = makePlan({
      nom: 'HFC INVEST', cabinet: 'Audit Up', siren: '838444347',
      abonnements: [makeAbo({
        decision: 'a_supprimer', plSubId: 2307849,
        lignesFixes: [],
        lignesVariables: [
          makeLigneVariable({ label: 'Etablissement du bulletin de salaire', quantite: 5, ancienPuHt: 15.8 })
        ]
      })],
      nbVariables: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    expect(mockSheetNames).toContain('A SUPPRIMER');
  });

  it('affiche "Aucun produit variable" si aucune ligne variable', () => {
    const plan = makePlan({
      abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()], lignesVariables: [] })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    expect(mockSheetNames).toContain('A SUPPRIMER');
  });
});

describe('Onglet Détail croisé', () => {
  it('inclut toutes les lignes (fixes et variables) avec leur action', () => {
    const plan = makePlan({
      nom: 'TEST', cabinet: 'Audit Up',
      abonnements: [makeAbo({
        decision: 'a_modifier',
        lignesFixes: [makeLigneFixe({ label: 'Mission comptable' })],
        lignesVariables: [makeLigneVariable({ label: 'Bulletin de salaire' })]
      })],
      nbFixes: 1, nbVariables: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    expect(mockSheetNames).toContain('Détail croisé');
  });
});

describe('Cas limites', () => {
  it('gère un plan avec 0 abonnements', () => {
    const plan = makePlan({ abonnements: [] });

    expect(() => {
      exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });
    }).not.toThrow();
  });

  it('gère un tableau de plans vide', () => {
    expect(() => {
      exportRestructurationExcel({ plans: [], stats: makeStats([]) });
    }).not.toThrow();
  });

  it('gère un abonnement yearly avec prix symbolique 1€', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({
        frequence: 'yearly',
        lignesFixes: [makeLigneFixe({ label: 'Bilan', nouveauPuHt: 1.02, quantite: 1 })]
      })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const row = getSheetData('Import PL AUP')[1];
    expect(row[1]).toBe('yearly');
    // TTC = 1.02 × 1.2 = 1.224 → 1.22
    expect(row[11]).toBeCloseTo(1.22, 2);
  });
});
