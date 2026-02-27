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

function makeLigneFixe({ ligneId = null, label = 'Mission comptable', quantite = 1, ancienPuHt = 100, nouveauPuHt = 102.5, axe = 'compta_mensuelle', famille = 'comptabilite' } = {}) {
  return {
    ligne_id: ligneId,
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

function makeProduitsPennylane(cabinet = 'Audit Up') {
  return [
    { cabinet, pennylane_product_id: 'UUID-MISSION-COMPTA', denomination: 'Mission comptable', label_normalise: 'mission_comptable' },
    { cabinet, pennylane_product_id: 'UUID-LOGICIEL', denomination: 'Mise à disposition logiciel {{période}}', label_normalise: 'logiciel' },
    { cabinet, pennylane_product_id: 'UUID-PL', denomination: 'Etablissement du P&L', label_normalise: 'pl' },
    { cabinet, pennylane_product_id: 'UUID-BILAN', denomination: 'Etablissement du bilan', label_normalise: 'bilan' },
    { cabinet, pennylane_product_id: 'UUID-SOCIAL-FORFAIT', denomination: 'Forfait social', label_normalise: 'social_forfait' },
    { cabinet, pennylane_product_id: 'UUID-SURVEILLANCE', denomination: 'Mission de surveillance', label_normalise: 'mission_surveillance' },
    { cabinet, pennylane_product_id: 'UUID-JURIDIQUE', denomination: 'Secrétariat juridique approbation', label_normalise: 'juridique_approbation' },
    { cabinet, pennylane_product_id: 'UUID-RDV', denomination: 'Rendez-vous analyse', label_normalise: 'rdv_analyse' },
  ];
}

// === Helper ===

function getSheetData(sheetName) {
  const ws = mockSheets[sheetName];
  return ws?.['!data'] || null;
}

// === Tests ===

beforeEach(() => {
  for (const key of Object.keys(mockSheets)) delete mockSheets[key];
  mockSheetNames.length = 0;
  lastFileName = '';
});

// ── Structure générale ──────────────────────────────────────────────────────

describe('exportRestructurationExcel — structure générale', () => {
  it('génère un fichier avec 5 onglets pour 2 cabinets', () => {
    const plans = [
      makePlan({ nom: 'AUP Client', cabinet: 'Audit Up', abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })], nbFixes: 1 }),
      makePlan({ nom: 'ZF Client', cabinet: 'Zerah Fiduciaire', plCustomerId: 'C2TEST', abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })], nbFixes: 1 })
    ];

    exportRestructurationExcel({ plans, stats: makeStats(plans) });

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
      makePlan({ nom: 'Client B', cabinet: 'Audit Up', plCustomerId: 'C1B', abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })], nbFixes: 1 })
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

// ── Import PL — split par cabinet ───────────────────────────────────────────

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
    expect(aupData[1][0]).toBe('CLIENT AUP');

    // ZF sheet: header + 1 data row
    expect(zfData.length).toBe(2);
    expect(zfData[1][0]).toBe('CLIENT ZF');
  });

  it('trie les clients par nom dans chaque onglet', () => {
    const plans = [
      makePlan({ nom: 'ZZZ DERNIER', cabinet: 'Audit Up', abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })], nbFixes: 1 }),
      makePlan({ nom: 'AAA PREMIER', cabinet: 'Audit Up', plCustomerId: 'C1B', abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })], nbFixes: 1 }),
      makePlan({ nom: 'MMM MILIEU', cabinet: 'Audit Up', plCustomerId: 'C1C', abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })], nbFixes: 1 })
    ];

    exportRestructurationExcel({ plans, stats: makeStats(plans) });

    const data = getSheetData('Import PL AUP');
    expect(data[1][0]).toBe('AAA PREMIER');
    expect(data[2][0]).toBe('MMM MILIEU');
    expect(data[3][0]).toBe('ZZZ DERNIER');
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

// ── Import PL — format 14 colonnes PL 2026 ─────────────────────────────────

describe('Import PL — format 14 colonnes PL 2026', () => {
  it('contient exactement 14 colonnes (10 abo + 4 produit)', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const headers = getSheetData('Import PL AUP')[0];
    expect(headers.length).toBe(14);
  });

  it('contient les 10 colonnes abonnement', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const headers = getSheetData('Import PL AUP')[0];
    expect(headers[0]).toBe('Raison sociale');
    expect(headers[1]).toBe('Identifiant client');
    expect(headers[2]).toBe('SIREN');
    expect(headers[3]).toBe('Millesime');
    expect(headers[4]).toBe('Mode de facturation');
    expect(headers[5]).toBe("Date de debut de l'abonnement");
    expect(headers[6]).toBe('Interval de facturation');
    expect(headers[7]).toBe('Frequence de facturation');
    expect(headers[8]).toBe('Jour de facturation');
    expect(headers[9]).toBe('Mode de finalisation');
  });

  it('contient les 4 colonnes produit sans préfixe "Ligne N"', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const headers = getSheetData('Import PL AUP')[0];
    expect(headers[10]).toBe('Identifiant produit');
    expect(headers[11]).toBe('Nom du produit');
    expect(headers[12]).toBe('Description');
    expect(headers[13]).toBe('Honoraires HT');
  });

  it('génère 1 ligne par produit (3 produits = 3 rows)', () => {
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

    const data = getSheetData('Import PL AUP');
    // Header + 3 data rows
    expect(data.length).toBe(4);
    // Toujours 14 colonnes
    expect(data[0].length).toBe(14);
    // Chaque row a le même client
    expect(data[1][0]).toBe('CLIENT TEST');
    expect(data[2][0]).toBe('CLIENT TEST');
    expect(data[3][0]).toBe('CLIENT TEST');
    // Mais un produit différent
    expect(data[1][11]).toBe('Mission comptable');
    expect(data[2][11]).toBe('Mise à disposition logiciel');
    expect(data[3][11]).toBe('Etablissement du P&L');
  });

  it('génère N lignes pour 2 abos × 2 produits distincts = 4 rows', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [
        makeAbo({
          lignesFixes: [
            makeLigneFixe({ label: 'Mission comptable', nouveauPuHt: 500 }),
            makeLigneFixe({ label: 'Logiciel', nouveauPuHt: 100 })
          ]
        }),
        makeAbo({
          id: 200, plSubId: 2307849,
          lignesFixes: [
            makeLigneFixe({ label: 'P&L', nouveauPuHt: 200 }),
            makeLigneFixe({ label: 'Bilan', nouveauPuHt: 300 })
          ]
        })
      ],
      nbFixes: 4
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const data = getSheetData('Import PL AUP');
    // Header + 4 data rows (produits tous différents)
    expect(data.length).toBe(5);
  });
});

// ── Import PL — filtrage par validLigneIds (tarifs_reference) ────────────────

describe('Import PL — filtrage par validLigneIds', () => {
  it('sans validLigneIds, inclut toutes les lignes fixes', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [
        makeAbo({
          lignesFixes: [
            makeLigneFixe({ ligneId: 1001, label: 'Mission comptable', nouveauPuHt: 500 }),
            makeLigneFixe({ ligneId: 1002, label: 'Logiciel', nouveauPuHt: 200 })
          ]
        }),
        makeAbo({
          id: 200, plSubId: 2307849,
          lignesFixes: [makeLigneFixe({ ligneId: 1003, label: 'Mission comptable', nouveauPuHt: 300 })]
        })
      ],
      nbFixes: 3
    });

    // Sans validLigneIds → pas de filtrage, toutes les 3 lignes incluses
    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const data = getSheetData('Import PL AUP');
    expect(data.length).toBe(4); // header + 3 rows
  });

  it('filtre les lignes dont le ligne_id n\'est pas dans validLigneIds', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [
        makeAbo({
          lignesFixes: [
            makeLigneFixe({ ligneId: 1001, label: 'Mission comptable', nouveauPuHt: 500 })
          ]
        }),
        makeAbo({
          id: 200, plSubId: 2307849,
          lignesFixes: [makeLigneFixe({ ligneId: 1002, label: 'Mission comptable', nouveauPuHt: 300 })]
        })
      ],
      nbFixes: 2
    });

    // Seule la ligne 1001 est valide → l'ancien abo (1002) est éliminé
    const validLigneIds = new Set([1001]);
    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]), validLigneIds });

    const data = getSheetData('Import PL AUP');
    expect(data.length).toBe(2); // header + 1 row (seule la ligne 1001)
    expect(data[1][13]).toBe(500);
  });

  it('élimine les doublons d\'anciens abonnements (prix 2025)', () => {
    const produits = makeProduitsPennylane('Audit Up');
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [
        // Nouveau abo 2026 avec prix augmenté
        makeAbo({
          plSubId: 2307848,
          lignesFixes: [
            makeLigneFixe({ ligneId: 1001, label: 'Mission comptable', nouveauPuHt: 175 }),
            makeLigneFixe({ ligneId: 1002, label: 'Etablissement du P&L', nouveauPuHt: 205 })
          ]
        }),
        // Ancien abo 2025 (à éliminer)
        makeAbo({
          id: 200, plSubId: 308022,
          lignesFixes: [
            makeLigneFixe({ ligneId: 2001, label: 'Mission comptable', nouveauPuHt: 170 }),
            makeLigneFixe({ ligneId: 2002, label: 'Etablissement du P&L', nouveauPuHt: 200 })
          ]
        })
      ],
      nbFixes: 4
    });

    // Seules les lignes du nouveau abo sont dans tarifs_reference
    const validLigneIds = new Set([1001, 1002]);
    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]), produitsPennylane: produits, validLigneIds });

    const data = getSheetData('Import PL AUP');
    expect(data.length).toBe(3); // header + 2 rows (nouveau abo seulement)
    expect(data[1][13]).toBe(175); // prix 2026, pas 170
    expect(data[2][13]).toBe(205);
    expect(data[1][10]).toBe('UUID-MISSION-COMPTA');
    expect(data[2][10]).toBe('UUID-PL');
  });

  it('élimine les placeholders à 1€ quand le vrai abo existe', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [
        // Placeholder mensuel à 1€
        makeAbo({
          plSubId: 2307804, frequence: 'monthly',
          lignesFixes: [makeLigneFixe({ ligneId: 3001, label: 'Mission comptable', nouveauPuHt: 1 })]
        }),
        // Vrai abo annuel
        makeAbo({
          id: 200, plSubId: 2307803, frequence: 'yearly',
          lignesFixes: [makeLigneFixe({ ligneId: 3002, label: 'Mission comptable', nouveauPuHt: 337.5 })]
        })
      ],
      nbFixes: 2
    });

    // tarifs_reference pointe vers le vrai abo (3002)
    const validLigneIds = new Set([3002]);
    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]), validLigneIds });

    const data = getSheetData('Import PL AUP');
    expect(data.length).toBe(2); // header + 1 row
    expect(data[1][13]).toBe(337.5); // vrai montant, pas 1€
    expect(data[1][7]).toBe('yearly'); // fréquence du vrai abo
  });

  it('conserve les lignes multiples du même abo si toutes sont dans validLigneIds', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({
        lignesFixes: [
          makeLigneFixe({ ligneId: 4001, label: 'Mission comptable', nouveauPuHt: 465 }),
          makeLigneFixe({ ligneId: 4002, label: 'Mission comptable', nouveauPuHt: 1200 })
        ]
      })],
      nbFixes: 2
    });

    // Les deux lignes du même abo sont dans tarifs_reference
    const validLigneIds = new Set([4001, 4002]);
    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]), validLigneIds });

    const data = getSheetData('Import PL AUP');
    expect(data.length).toBe(3); // header + 2 rows
    expect(data[1][13]).toBe(465);
    expect(data[2][13]).toBe(1200);
  });

  it('utilise les métadonnées du bon abo pour chaque ligne', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [
        makeAbo({
          plSubId: 2307900, frequence: 'monthly', dateDebut: '2025-01-01',
          lignesFixes: [makeLigneFixe({ ligneId: 5001, label: 'Mission comptable', nouveauPuHt: 500 })]
        }),
        makeAbo({
          id: 200, plSubId: 2307901, frequence: 'yearly', dateDebut: '2025-06-15',
          lignesFixes: [makeLigneFixe({ ligneId: 5002, label: 'Bilan', nouveauPuHt: 4000 })]
        })
      ],
      nbFixes: 2
    });

    const validLigneIds = new Set([5001, 5002]);
    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]), validLigneIds });

    const data = getSheetData('Import PL AUP');
    expect(data.length).toBe(3);
    // Ligne 1 : métadonnées du 1er abo (monthly)
    expect(data[1][7]).toBe('monthly');
    expect(data[1][5]).toBe('01/01/2025');
    // Ligne 2 : métadonnées du 2e abo (yearly)
    expect(data[2][7]).toBe('yearly');
    expect(data[2][5]).toBe('15/06/2025');
  });
});

// ── Import PL — données ligne (format PL 2026) ─────────────────────────────

describe('Import PL — données ligne PL 2026', () => {
  it('écrit le prix HT directement (pas de conversion TTC)', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({
        lignesFixes: [makeLigneFixe({ label: 'Mission', nouveauPuHt: 102.5 })]
      })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const row = getSheetData('Import PL AUP')[1];
    expect(row[13]).toBe(102.5); // Honoraires HT
  });

  it('écrit les métadonnées abonnement dans les 10 colonnes fixes', () => {
    const plan = makePlan({
      nom: 'SAINT JAMES', cabinet: 'Zerah Fiduciaire', siren: '838444347', plCustomerId: 'C2STJAMES',
      abonnements: [makeAbo({
        intervalle: 1, frequence: 'monthly', jourFacturation: 31,
        dateDebut: '2024-06-15',
        lignesFixes: [makeLigneFixe()]
      })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const row = getSheetData('Import PL ZF')[1];
    expect(row[0]).toBe('SAINT JAMES');
    expect(row[1]).toBe('C2STJAMES');
    expect(row[2]).toBe('838444347');
    expect(row[3]).toBe(2026);
    expect(row[4]).toBe('abonnement');
    expect(row[5]).toBe('15/06/2024');
    expect(row[6]).toBe(1);
    expect(row[7]).toBe('monthly');
    expect(row[8]).toBe(31);
    expect(row[9]).toBe('awaiting_validation');
  });

  it('écrit le label et la description dans les colonnes produit', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({
        lignesFixes: [makeLigneFixe({ label: 'Mission comptable' })]
      })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const row = getSheetData('Import PL AUP')[1];
    expect(row[11]).toBe('Mission comptable');
    expect(row[12]).toBe('');
  });

  it('écrit le SIREN comme chaîne vide si absent', () => {
    const plan = makePlan({
      cabinet: 'Audit Up', siren: null,
      abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const row = getSheetData('Import PL AUP')[1];
    expect(row[2]).toBe('');
  });

  it('répète les colonnes fixes pour chaque produit du même abo', () => {
    const plan = makePlan({
      nom: 'MULTI PROD', cabinet: 'Audit Up', plCustomerId: 'C1MULTI',
      abonnements: [makeAbo({
        dateDebut: '2024-03-01', frequence: 'monthly',
        lignesFixes: [
          makeLigneFixe({ label: 'Mission comptable', nouveauPuHt: 500 }),
          makeLigneFixe({ label: 'Logiciel', nouveauPuHt: 100 })
        ]
      })],
      nbFixes: 2
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const data = getSheetData('Import PL AUP');
    // Les 2 rows partagent les mêmes colonnes fixes
    expect(data[1][0]).toBe('MULTI PROD');
    expect(data[2][0]).toBe('MULTI PROD');
    expect(data[1][1]).toBe('C1MULTI');
    expect(data[2][1]).toBe('C1MULTI');
    expect(data[1][5]).toBe('01/03/2024');
    expect(data[2][5]).toBe('01/03/2024');
    // Mais des produits différents
    expect(data[1][13]).toBe(500);
    expect(data[2][13]).toBe(100);
  });
});

// ── Import PL — matching UUID produits ──────────────────────────────────────

describe('Import PL — matching UUID produits', () => {
  it('écrit le UUID du produit PL si trouvé via produitsPennylane', () => {
    const produits = makeProduitsPennylane('Audit Up');
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({
        lignesFixes: [makeLigneFixe({ label: 'Mission comptable' })]
      })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]), produitsPennylane: produits });

    const row = getSheetData('Import PL AUP')[1];
    expect(row[10]).toBe('UUID-MISSION-COMPTA');
  });

  it('écrit une chaîne vide si aucun produit PL ne correspond', () => {
    const produits = makeProduitsPennylane('Audit Up');
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({
        lignesFixes: [makeLigneFixe({ label: 'Produit inconnu exotique' })]
      })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]), produitsPennylane: produits });

    const row = getSheetData('Import PL AUP')[1];
    expect(row[10]).toBe('');
  });

  it('matche P&L par mot-clé', () => {
    const produits = makeProduitsPennylane('Audit Up');
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({
        lignesFixes: [makeLigneFixe({ label: 'Etablissement du P&L' })]
      })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]), produitsPennylane: produits });

    const row = getSheetData('Import PL AUP')[1];
    expect(row[10]).toBe('UUID-PL');
  });

  it('matche Rendez-vous / RDV', () => {
    const produits = makeProduitsPennylane('Audit Up');
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({
        lignesFixes: [makeLigneFixe({ label: 'RDV Analyse financière' })]
      })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]), produitsPennylane: produits });

    const row = getSheetData('Import PL AUP')[1];
    expect(row[10]).toBe('UUID-RDV');
  });

  it('ne mélange pas les produits entre cabinets', () => {
    const produits = [
      ...makeProduitsPennylane('Audit Up'),
      { cabinet: 'Zerah Fiduciaire', pennylane_product_id: 'UUID-ZF-MISSION', denomination: 'Mission comptable', label_normalise: 'mission_comptable' }
    ];
    const plan = makePlan({
      cabinet: 'Zerah Fiduciaire',
      abonnements: [makeAbo({
        lignesFixes: [makeLigneFixe({ label: 'Mission comptable' })]
      })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]), produitsPennylane: produits });

    const row = getSheetData('Import PL ZF')[1];
    expect(row[10]).toBe('UUID-ZF-MISSION');
  });

  it('fonctionne sans produitsPennylane (UUID vide)', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({
        lignesFixes: [makeLigneFixe({ label: 'Mission comptable' })]
      })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const row = getSheetData('Import PL AUP')[1];
    expect(row[10]).toBe('');
  });
});

// ── Import PL — formatDatePennylane ─────────────────────────────────────────

describe('Import PL — formatDatePennylane', () => {
  it('convertit une date ISO en dd/mm/yyyy', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({ dateDebut: '2024-01-01', lignesFixes: [makeLigneFixe()] })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const row = getSheetData('Import PL AUP')[1];
    expect(row[5]).toBe('01/01/2024');
  });

  it('gère une date avec composant horaire (ISO+T)', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({ dateDebut: '2025-12-31T00:00:00', lignesFixes: [makeLigneFixe()] })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const row = getSheetData('Import PL AUP')[1];
    expect(row[5]).toBe('31/12/2025');
  });

  it('laisse une date déjà au format dd/mm/yyyy inchangée', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({ dateDebut: '15/06/2024', lignesFixes: [makeLigneFixe()] })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const row = getSheetData('Import PL AUP')[1];
    expect(row[5]).toBe('15/06/2024');
  });
});

// ── Onglet A SUPPRIMER ──────────────────────────────────────────────────────

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

// ── Onglet Détail croisé ────────────────────────────────────────────────────

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

// ── Cas limites ─────────────────────────────────────────────────────────────

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

  it('gère un abonnement yearly', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({
        frequence: 'yearly',
        lignesFixes: [makeLigneFixe({ label: 'Bilan', nouveauPuHt: 1200 })]
      })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const row = getSheetData('Import PL AUP')[1];
    expect(row[7]).toBe('yearly');
    expect(row[13]).toBe(1200);
  });

  it('gère un prix symbolique 1€', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({
        lignesFixes: [makeLigneFixe({ label: 'Juridique approbation', nouveauPuHt: 1.02 })]
      })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const row = getSheetData('Import PL AUP')[1];
    expect(row[13]).toBe(1.02);
  });
});
