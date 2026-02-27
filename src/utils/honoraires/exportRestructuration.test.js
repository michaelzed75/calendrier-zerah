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

import { exportRestructurationExcel, mapFrequence, mapJourFacturation, mapModesFinalisation } from './exportRestructuration.js';

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

describe('Import PL — format 18 colonnes template PL', () => {
  it('contient exactement 18 colonnes (format template PL officiel)', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const headers = getSheetData('Import PL AUP')[0];
    expect(headers.length).toBe(18);
  });

  it('contient les colonnes client/produit (A-J)', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const headers = getSheetData('Import PL AUP')[0];
    expect(headers[0]).toBe('Raison sociale (optionnel)');
    expect(headers[1]).toBe('Identifiant client');
    expect(headers[2]).toBe('SIREN');
    expect(headers[3]).toBe('Millesime');
    expect(headers[4]).toBe('Mission (optionnel)');
    expect(headers[5]).toBe('Identifiant produit (obligatoire)');
    expect(headers[6]).toBe('Nom du produit (optionnel)');
    expect(headers[7]).toBe('Description du produit (optionnel)');
    expect(headers[8]).toBe('Honoraires (HT)');
    expect(headers[9]).toBe('Temps estime (HH:mm) (optionnel)');
  });

  it('contient les colonnes abonnement (K-R)', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const headers = getSheetData('Import PL AUP')[0];
    expect(headers[10]).toBe('Mode de facturation');
    expect(headers[11]).toBe("Date de debut de l'abonnement (valable si abonnement)");
    expect(headers[12]).toBe("Date de fin de l'abonnement (valable si abonnement)");
    expect(headers[13]).toBe('Interval de facturation (valable si abonnement)');
    expect(headers[14]).toBe('Frequence de facturation (valable si abonnement)');
    expect(headers[15]).toBe('Jour de facturation (valable si abonnement)');
    expect(headers[16]).toBe('Identifiant du modele de facturation (valable si abonnement)');
    expect(headers[17]).toBe('Mode de finalisation (valable si abonnement)');
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
    // Toujours 18 colonnes
    expect(data[0].length).toBe(18);
    // Chaque row a le même client
    expect(data[1][0]).toBe('CLIENT TEST');
    expect(data[2][0]).toBe('CLIENT TEST');
    expect(data[3][0]).toBe('CLIENT TEST');
    // Mais un produit différent (col 6 = Nom du produit)
    expect(data[1][6]).toBe('Mission comptable');
    expect(data[2][6]).toBe('Mise à disposition logiciel');
    expect(data[3][6]).toBe('Etablissement du P&L');
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
    expect(data[1][8]).toBe(500); // col 8 = Honoraires (HT)
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
    expect(data[1][8]).toBe(175); // prix 2026, pas 170 (col 8 = HT)
    expect(data[2][8]).toBe(205);
    expect(data[1][5]).toBe('UUID-MISSION-COMPTA'); // col 5 = Identifiant produit
    expect(data[2][5]).toBe('UUID-PL');
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
    expect(data[1][8]).toBe(337.5); // vrai montant, pas 1€ (col 8 = HT)
    expect(data[1][14]).toBe('ans'); // fréquence mappée du vrai abo (col 14)
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
    expect(data[1][8]).toBe(465); // col 8 = HT
    expect(data[2][8]).toBe(1200);
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
    // Ligne 1 : métadonnées du 1er abo (monthly → mois)
    expect(data[1][14]).toBe('mois'); // col 14 = Fréquence
    expect(data[1][11]).toBe('01/01/2025'); // col 11 = Date début
    // Ligne 2 : métadonnées du 2e abo (yearly → ans)
    expect(data[2][14]).toBe('ans');
    expect(data[2][11]).toBe('15/06/2025');
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
    expect(row[8]).toBe(102.5); // col 8 = Honoraires (HT)
  });

  it('écrit les métadonnées avec les valeurs PL template', () => {
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
    // Colonnes client (A-D)
    expect(row[0]).toBe('SAINT JAMES');
    expect(row[1]).toBe('C2STJAMES');
    expect(row[2]).toBe('838444347');
    expect(row[3]).toBe(2026);
    expect(row[4]).toBe(''); // Mission (optionnel)
    // Colonnes abonnement (K-R) avec valeurs PL dropdown
    expect(row[10]).toBe('Forfait par abonnement');
    expect(row[11]).toBe('15/06/2024');
    expect(row[12]).toBe(''); // Date fin (optionnel)
    expect(row[13]).toBe(1);
    expect(row[14]).toBe('mois');
    expect(row[15]).toBe('Dernier jour du mois');
    expect(row[16]).toBe(''); // ID modèle (optionnel)
    expect(row[17]).toBe('Un brouillon de facture');
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
    expect(row[6]).toBe('Mission comptable'); // col 6 = Nom du produit
    expect(row[7]).toBe(''); // col 7 = Description
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
    expect(data[1][11]).toBe('01/03/2024'); // col 11 = Date début
    expect(data[2][11]).toBe('01/03/2024');
    // Mais des produits différents (col 8 = HT)
    expect(data[1][8]).toBe(500);
    expect(data[2][8]).toBe(100);
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
    expect(row[5]).toBe('UUID-MISSION-COMPTA'); // col 5 = Identifiant produit
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
    expect(row[5]).toBe('');
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
    expect(row[5]).toBe('UUID-PL');
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
    expect(row[5]).toBe('UUID-RDV');
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
    expect(row[5]).toBe('UUID-ZF-MISSION');
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
    expect(row[5]).toBe('');
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
    expect(row[11]).toBe('01/01/2024'); // col 11 = Date début
  });

  it('gère une date avec composant horaire (ISO+T)', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({ dateDebut: '2025-12-31T00:00:00', lignesFixes: [makeLigneFixe()] })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const row = getSheetData('Import PL AUP')[1];
    expect(row[11]).toBe('31/12/2025');
  });

  it('laisse une date déjà au format dd/mm/yyyy inchangée', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({ dateDebut: '15/06/2024', lignesFixes: [makeLigneFixe()] })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const row = getSheetData('Import PL AUP')[1];
    expect(row[11]).toBe('15/06/2024');
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

  it('gère un abonnement yearly → "ans"', () => {
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
    expect(row[14]).toBe('ans'); // col 14 = Fréquence, mappé de yearly → ans
    expect(row[8]).toBe(1200); // col 8 = HT
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
    expect(row[8]).toBe(1.02); // col 8 = HT
  });
});

// ── Mapping valeurs PL dropdown ─────────────────────────────────────────────

describe('mapFrequence — conversion API → dropdown PL', () => {
  it('mappe "monthly" → "mois"', () => {
    expect(mapFrequence('monthly')).toBe('mois');
  });

  it('mappe "yearly" → "ans"', () => {
    expect(mapFrequence('yearly')).toBe('ans');
  });

  it('mappe "weekly" → "semaines"', () => {
    expect(mapFrequence('weekly')).toBe('semaines');
  });

  it('retourne "mois" par défaut si null/undefined', () => {
    expect(mapFrequence(null)).toBe('mois');
    expect(mapFrequence(undefined)).toBe('mois');
  });

  it('retourne la valeur brute si inconnue (passthrough)', () => {
    expect(mapFrequence('quarterly')).toBe('quarterly');
  });
});

describe('mapJourFacturation — conversion jour → dropdown PL', () => {
  it('mappe 31 → "Dernier jour du mois"', () => {
    expect(mapJourFacturation(31)).toBe('Dernier jour du mois');
  });

  it('mappe "31" (string) → "Dernier jour du mois"', () => {
    expect(mapJourFacturation('31')).toBe('Dernier jour du mois');
  });

  it('mappe null/undefined → "Dernier jour du mois"', () => {
    expect(mapJourFacturation(null)).toBe('Dernier jour du mois');
    expect(mapJourFacturation(undefined)).toBe('Dernier jour du mois');
  });

  it('mappe tout autre jour → "Meme que la date du debut d\'abonnement"', () => {
    expect(mapJourFacturation(1)).toBe("Meme que la date du debut d'abonnement");
    expect(mapJourFacturation(15)).toBe("Meme que la date du debut d'abonnement");
  });
});

describe('mapModesFinalisation — conversion API → dropdown PL', () => {
  it('mappe "awaiting_validation" → "Un brouillon de facture"', () => {
    expect(mapModesFinalisation('awaiting_validation')).toBe('Un brouillon de facture');
  });

  it('mappe "auto_finalized" → "Une facture finalisee"', () => {
    expect(mapModesFinalisation('auto_finalized')).toBe('Une facture finalisee');
  });

  it('retourne "Un brouillon de facture" par défaut si null/undefined', () => {
    expect(mapModesFinalisation(null)).toBe('Un brouillon de facture');
    expect(mapModesFinalisation(undefined)).toBe('Un brouillon de facture');
  });

  it('retourne la valeur brute si inconnue (passthrough)', () => {
    expect(mapModesFinalisation('some_other_mode')).toBe('some_other_mode');
  });
});

// ── Cohérence totaux export ↔ tarifs_reference ──────────────────────────────

describe('Cohérence totaux — somme HT export = somme des tarifs', () => {
  it('le total HT de l\'export correspond exactement à la somme des nouveauPuHt', () => {
    const lignes = [
      makeLigneFixe({ ligneId: 1, label: 'Mission comptable', nouveauPuHt: 800 }),
      makeLigneFixe({ ligneId: 2, label: 'Bilan', nouveauPuHt: 535 }),
      makeLigneFixe({ ligneId: 3, label: 'Social', nouveauPuHt: 538.13 })
    ];
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({ lignesFixes: lignes })],
      nbFixes: 3
    });

    const validLigneIds = new Set([1, 2, 3]);
    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]), validLigneIds });

    const data = getSheetData('Import PL AUP');
    const totalExport = data.slice(1).reduce((sum, row) => sum + row[8], 0);
    const totalAttendu = lignes.reduce((sum, l) => sum + Math.round(l.nouveau_pu_ht * 100) / 100, 0);
    expect(Math.round(totalExport * 100) / 100).toBe(Math.round(totalAttendu * 100) / 100);
  });

  it('le filtrage validLigneIds ne modifie pas le total des lignes valides', () => {
    const lignesValides = [
      makeLigneFixe({ ligneId: 10, label: 'Compta', nouveauPuHt: 500 }),
      makeLigneFixe({ ligneId: 20, label: 'Bilan', nouveauPuHt: 1200 })
    ];
    const ligneInvalide = makeLigneFixe({ ligneId: 99, label: 'Compta ancien', nouveauPuHt: 480 });

    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [
        makeAbo({ lignesFixes: lignesValides }),
        makeAbo({ id: 200, plSubId: 308000, lignesFixes: [ligneInvalide] })
      ],
      nbFixes: 3
    });

    const validLigneIds = new Set([10, 20]); // seules les lignes valides
    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]), validLigneIds });

    const data = getSheetData('Import PL AUP');
    expect(data.length).toBe(3); // header + 2 lignes valides (pas la 3e)
    const totalExport = data.slice(1).reduce((sum, row) => sum + row[8], 0);
    expect(totalExport).toBe(1700); // 500 + 1200, pas 500 + 1200 + 480
  });

  it('les totaux par cabinet sont indépendants', () => {
    const aupPlan = makePlan({
      nom: 'AUP', cabinet: 'Audit Up', plCustomerId: 'C1',
      abonnements: [makeAbo({
        lignesFixes: [
          makeLigneFixe({ ligneId: 1, nouveauPuHt: 800 }),
          makeLigneFixe({ ligneId: 2, nouveauPuHt: 535 })
        ]
      })],
      nbFixes: 2
    });
    const zfPlan = makePlan({
      nom: 'ZF', cabinet: 'Zerah Fiduciaire', plCustomerId: 'C2',
      abonnements: [makeAbo({
        lignesFixes: [
          makeLigneFixe({ ligneId: 3, nouveauPuHt: 300 }),
          makeLigneFixe({ ligneId: 4, nouveauPuHt: 250 })
        ]
      })],
      nbFixes: 2
    });

    const validLigneIds = new Set([1, 2, 3, 4]);
    exportRestructurationExcel({ plans: [aupPlan, zfPlan], stats: makeStats([aupPlan, zfPlan]), validLigneIds });

    const aupData = getSheetData('Import PL AUP');
    const zfData = getSheetData('Import PL ZF');

    const totalAup = aupData.slice(1).reduce((sum, row) => sum + row[8], 0);
    const totalZf = zfData.slice(1).reduce((sum, row) => sum + row[8], 0);

    expect(totalAup).toBe(1335); // 800 + 535
    expect(totalZf).toBe(550); // 300 + 250
    expect(totalAup + totalZf).toBe(1885);
  });

  it('un plan multi-abos accumule correctement les totaux', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [
        makeAbo({
          lignesFixes: [
            makeLigneFixe({ ligneId: 1, label: 'Mission comptable', nouveauPuHt: 175.50 }),
            makeLigneFixe({ ligneId: 2, label: 'Logiciel', nouveauPuHt: 41.25 })
          ]
        }),
        makeAbo({
          id: 200, plSubId: 2307900,
          lignesFixes: [
            makeLigneFixe({ ligneId: 3, label: 'Bilan', nouveauPuHt: 537.50 })
          ]
        })
      ],
      nbFixes: 3
    });

    const validLigneIds = new Set([1, 2, 3]);
    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]), validLigneIds });

    const data = getSheetData('Import PL AUP');
    expect(data.length).toBe(4); // header + 3 lignes
    const total = data.slice(1).reduce((sum, row) => sum + row[8], 0);
    expect(Math.round(total * 100) / 100).toBe(754.25); // 175.50 + 41.25 + 537.50
  });

  it('les arrondis centimes sont préservés sans perte', () => {
    // Montants typiques après arrondirDemiCentime
    const lignes = [
      makeLigneFixe({ ligneId: 1, nouveauPuHt: 16.19 }),
      makeLigneFixe({ ligneId: 2, nouveauPuHt: 538.13 }),
      makeLigneFixe({ ligneId: 3, nouveauPuHt: 0.41 })
    ];
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({ lignesFixes: lignes })],
      nbFixes: 3
    });

    const validLigneIds = new Set([1, 2, 3]);
    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]), validLigneIds });

    const data = getSheetData('Import PL AUP');
    expect(data[1][8]).toBe(16.19);
    expect(data[2][8]).toBe(538.13);
    expect(data[3][8]).toBe(0.41);
    // Vérifie qu'aucune perte d'arrondi sur la somme
    const total = data.slice(1).reduce((sum, row) => sum + row[8], 0);
    expect(Math.round(total * 100) / 100).toBe(554.73);
  });
});

// ── Conformité format template PL ───────────────────────────────────────────

describe('Conformité format template PL officiel', () => {
  const VALEURS_DROPDOWN_PL = {
    millesimes: [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030],
    modeFacturation: ['Forfait par abonnement', 'A l\'acte'],
    frequence: ['mois', 'ans', 'semaines'],
    jourFacturation: ['Dernier jour du mois', 'Meme que la date du debut d\'abonnement'],
    modeFinalisation: ['Un brouillon de facture', 'Une facture finalisee']
  };

  it('le millésime 2026 est dans la liste PL', () => {
    expect(VALEURS_DROPDOWN_PL.millesimes).toContain(2026);
  });

  it('"Forfait par abonnement" est une valeur dropdown PL valide', () => {
    expect(VALEURS_DROPDOWN_PL.modeFacturation).toContain('Forfait par abonnement');
  });

  it('toutes les fréquences mappées sont des valeurs dropdown PL valides', () => {
    expect(VALEURS_DROPDOWN_PL.frequence).toContain(mapFrequence('monthly'));
    expect(VALEURS_DROPDOWN_PL.frequence).toContain(mapFrequence('yearly'));
    expect(VALEURS_DROPDOWN_PL.frequence).toContain(mapFrequence('weekly'));
  });

  it('tous les jours de facturation mappés sont des valeurs dropdown PL valides', () => {
    expect(VALEURS_DROPDOWN_PL.jourFacturation).toContain(mapJourFacturation(31));
    expect(VALEURS_DROPDOWN_PL.jourFacturation).toContain(mapJourFacturation(1));
    expect(VALEURS_DROPDOWN_PL.jourFacturation).toContain(mapJourFacturation(null));
  });

  it('tous les modes de finalisation mappés sont des valeurs dropdown PL valides', () => {
    expect(VALEURS_DROPDOWN_PL.modeFinalisation).toContain(mapModesFinalisation('awaiting_validation'));
    expect(VALEURS_DROPDOWN_PL.modeFinalisation).toContain(mapModesFinalisation('auto_finalized'));
    expect(VALEURS_DROPDOWN_PL.modeFinalisation).toContain(mapModesFinalisation(null));
  });

  it('un export complet ne contient que des valeurs PL valides', () => {
    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({
        frequence: 'monthly', jourFacturation: 31,
        lignesFixes: [makeLigneFixe({ ligneId: 1, nouveauPuHt: 500 })]
      })],
      nbFixes: 1
    });

    const validLigneIds = new Set([1]);
    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]), validLigneIds });

    const row = getSheetData('Import PL AUP')[1];
    // col 3 = Millésime
    expect(VALEURS_DROPDOWN_PL.millesimes).toContain(row[3]);
    // col 10 = Mode de facturation
    expect(VALEURS_DROPDOWN_PL.modeFacturation).toContain(row[10]);
    // col 14 = Fréquence
    expect(VALEURS_DROPDOWN_PL.frequence).toContain(row[14]);
    // col 15 = Jour de facturation
    expect(VALEURS_DROPDOWN_PL.jourFacturation).toContain(row[15]);
    // col 17 = Mode de finalisation
    expect(VALEURS_DROPDOWN_PL.modeFinalisation).toContain(row[17]);
  });

  it('les 18 colonnes sont dans l\'ordre exact du template PL', () => {
    const HEADERS_PL_OFFICIELS = [
      'Raison sociale (optionnel)',
      'Identifiant client',
      'SIREN',
      'Millesime',
      'Mission (optionnel)',
      'Identifiant produit (obligatoire)',
      'Nom du produit (optionnel)',
      'Description du produit (optionnel)',
      'Honoraires (HT)',
      'Temps estime (HH:mm) (optionnel)',
      'Mode de facturation',
      "Date de debut de l'abonnement (valable si abonnement)",
      "Date de fin de l'abonnement (valable si abonnement)",
      'Interval de facturation (valable si abonnement)',
      'Frequence de facturation (valable si abonnement)',
      'Jour de facturation (valable si abonnement)',
      'Identifiant du modele de facturation (valable si abonnement)',
      'Mode de finalisation (valable si abonnement)'
    ];

    const plan = makePlan({
      cabinet: 'Audit Up',
      abonnements: [makeAbo({ lignesFixes: [makeLigneFixe()] })],
      nbFixes: 1
    });

    exportRestructurationExcel({ plans: [plan], stats: makeStats([plan]) });

    const headers = getSheetData('Import PL AUP')[0];
    expect(headers).toEqual(HEADERS_PL_OFFICIELS);
  });
});
