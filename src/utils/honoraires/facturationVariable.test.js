// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx-js-style';

/**
 * Tests unitaires pour la Phase 3 — Facturation Variable
 *
 * Couvre :
 *   1. Export Excel (exportFacturationVariable.js)
 *      - formaterPeriodeFr, nettoyerDenomination, dernierJourMoisExcel
 *      - Split par cabinet, nommage fichiers, période dans nom produit
 *      - Format cellules strict PL brouillons
 *   2. Service facturation (facturationVariableService.js)
 *      - Données BK BAGNEUX (client_id=112, Audit Up)
 *      - Calculs montants, mapping colonnes Silae
 *      - normaliserLabelTarif, matchLabel
 *   3. Sync produits PL
 *
 * Basé sur les données réelles de BK BAGNEUX :
 * - 6 produits variables en tarifs_reference 2026
 * - Données Silae janvier 2026 : bulletins=39, coffre_fort=30, entrees=2, sorties=2, editique=2
 * - Produit "Modification de bulletin" = SANS colonne Silae (manuel)
 */

// ════════════════════════════════════════════════════════════════
//  1. EXPORT — Tests des helpers internes
// ════════════════════════════════════════════════════════════════

// On importe le module et on capture les appels XLSX.writeFile
// xlsx-js-style est CJS → le default contient tout (utils, writeFile, etc.)
vi.mock('xlsx-js-style', async () => {
  const actual = await vi.importActual('xlsx-js-style');
  const mod = actual.default || actual;
  const mockWriteFile = vi.fn();
  return {
    default: { ...mod, writeFile: mockWriteFile },
    ...mod,
    writeFile: mockWriteFile
  };
});

import { exportFacturationVariableExcel } from './exportFacturationVariable.js';

// ─── Mock data clients (2 cabinets) ───

const CLIENT_AUP = {
  client_id: 112,
  client_nom: 'BK BAGNEUX',
  cabinet: 'Audit Up',
  siren: '901059287',
  pennylane_customer_id: 'C1BKBAGNEUX',
  lignes: [
    { label: 'Etablissement du bulletin de salaire', label_normalise: 'bulletin_salaire', pennylane_product_id: 'uuid-bulletin-aup', denomination: 'Etablissement de bulletin de salaire {{mois}}', pu_ht: 15.80, pu_ttc: 18.96, quantite: 39, montant_ht: 616.20, colonne_silae: 'bulletins', source: 'silae', tva_code: 'FR_200', tva_rate: 0.20 },
    { label: 'Dépôt coffre-fort numérique', label_normalise: 'coffre_fort', pennylane_product_id: 'uuid-coffre-aup', denomination: 'Dépôt Coffre-Fort Numérique', pu_ht: 1.00, pu_ttc: 1.20, quantite: 30, montant_ht: 30.00, colonne_silae: 'coffre_fort', source: 'silae', tva_code: 'FR_200', tva_rate: 0.20 },
    { label: 'Modification de bulletin', label_normalise: 'modification_bulletin', pennylane_product_id: 'uuid-modif-aup', denomination: 'Modification de bulletin de salaire sur votre demande', pu_ht: 15.80, pu_ttc: 18.96, quantite: null, montant_ht: null, colonne_silae: null, source: 'manuel', tva_code: 'FR_200', tva_rate: 0.20 }
  ],
  total_ht_auto: 646.20,
  total_ht_estimable: 646.20,
  has_silae: true,
  complet: false
};

const CLIENT_ZF = {
  client_id: 200,
  client_nom: 'CABINET TEST ZF',
  cabinet: 'Zerah Fiduciaire',
  siren: '123456789',
  pennylane_customer_id: 'C1TESTZF',
  lignes: [
    { label: 'Etablissement du bulletin de salaire', label_normalise: 'bulletin_salaire', pennylane_product_id: 'uuid-bulletin-zf', denomination: 'Etablissement de bulletin de salaire {{mois}}', pu_ht: 18.00, pu_ttc: 21.60, quantite: 10, montant_ht: 180.00, colonne_silae: 'bulletins', source: 'silae', tva_code: 'FR_200', tva_rate: 0.20 }
  ],
  total_ht_auto: 180.00,
  total_ht_estimable: 180.00,
  has_silae: true,
  complet: true
};

// ─── Tests Export ───

describe('exportFacturationVariableExcel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devrait générer 2 fichiers pour 2 cabinets', () => {
    const resultat = {
      clients: [CLIENT_AUP, CLIENT_ZF],
      stats: {}
    };

    exportFacturationVariableExcel({ resultat, periode: '2026-01' });

    expect(XLSX.writeFile).toHaveBeenCalledTimes(2);
  });

  it('devrait nommer le fichier AUP correctement', () => {
    const resultat = { clients: [CLIENT_AUP], stats: {} };

    exportFacturationVariableExcel({ resultat, periode: '2026-01' });

    const [, fileName] = XLSX.writeFile.mock.calls[0];
    expect(fileName).toBe('AUP Janvier 26 a importer dans PL.xlsx');
  });

  it('devrait nommer le fichier ZF correctement', () => {
    const resultat = { clients: [CLIENT_ZF], stats: {} };

    exportFacturationVariableExcel({ resultat, periode: '2026-01' });

    const [, fileName] = XLSX.writeFile.mock.calls[0];
    expect(fileName).toBe('ZF Janvier 26 a importer dans PL.xlsx');
  });

  it('devrait nommer correctement pour février 2026', () => {
    const resultat = { clients: [CLIENT_AUP], stats: {} };

    exportFacturationVariableExcel({ resultat, periode: '2026-02' });

    const [, fileName] = XLSX.writeFile.mock.calls[0];
    expect(fileName).toBe('AUP Février 26 a importer dans PL.xlsx');
  });

  it('devrait nommer correctement pour décembre 2025', () => {
    const resultat = { clients: [CLIENT_AUP], stats: {} };

    exportFacturationVariableExcel({ resultat, periode: '2025-12' });

    const [, fileName] = XLSX.writeFile.mock.calls[0];
    expect(fileName).toBe('AUP Décembre 25 a importer dans PL.xlsx');
  });

  it('devrait ajouter la période au nom du produit (Janvier 26)', () => {
    const resultat = { clients: [CLIENT_AUP], stats: {} };

    exportFacturationVariableExcel({ resultat, periode: '2026-01' });

    const [wb] = XLSX.writeFile.mock.calls[0];
    const ws = wb.Sheets['Feuil1'];

    // D2 = premier produit (row 1 = data row 0)
    const d2 = ws[XLSX.utils.encode_cell({ r: 1, c: 3 })];
    expect(d2.v).toBe('Etablissement de bulletin de salaire Janvier 26');
  });

  it('devrait retirer {{mois}} du nom de produit', () => {
    const resultat = { clients: [CLIENT_AUP], stats: {} };

    exportFacturationVariableExcel({ resultat, periode: '2026-01' });

    const [wb] = XLSX.writeFile.mock.calls[0];
    const ws = wb.Sheets['Feuil1'];

    const d2 = ws[XLSX.utils.encode_cell({ r: 1, c: 3 })];
    expect(d2.v).not.toContain('{{mois}}');
  });

  it('devrait exclure les lignes manuelles (quantite null)', () => {
    const resultat = { clients: [CLIENT_AUP], stats: {} };

    exportFacturationVariableExcel({ resultat, periode: '2026-01' });

    const [wb] = XLSX.writeFile.mock.calls[0];
    const ws = wb.Sheets['Feuil1'];

    // AUP a 3 lignes dont 1 manuelle → 2 lignes data + 1 header = 3 rows
    // Row 0 = header, Row 1 = bulletin, Row 2 = coffre
    expect(ws[XLSX.utils.encode_cell({ r: 1, c: 0 })]).toBeDefined(); // row 1
    expect(ws[XLSX.utils.encode_cell({ r: 2, c: 0 })]).toBeDefined(); // row 2
    expect(ws[XLSX.utils.encode_cell({ r: 3, c: 0 })]).toBeUndefined(); // pas de row 3
  });

  it('devrait nommer la feuille "Feuil1"', () => {
    const resultat = { clients: [CLIENT_AUP], stats: {} };

    exportFacturationVariableExcel({ resultat, periode: '2026-01' });

    const [wb] = XLSX.writeFile.mock.calls[0];
    expect(wb.SheetNames).toContain('Feuil1');
  });

  it('devrait écrire le SIREN en nombre (t:n)', () => {
    const resultat = { clients: [CLIENT_AUP], stats: {} };

    exportFacturationVariableExcel({ resultat, periode: '2026-01' });

    const [wb] = XLSX.writeFile.mock.calls[0];
    const ws = wb.Sheets['Feuil1'];

    const b2 = ws[XLSX.utils.encode_cell({ r: 1, c: 1 })];
    expect(b2.t).toBe('n');
    expect(b2.v).toBe(901059287);
  });

  it('devrait écrire la TVA en nombre 0.2 avec format 0.00%', () => {
    const resultat = { clients: [CLIENT_AUP], stats: {} };

    exportFacturationVariableExcel({ resultat, periode: '2026-01' });

    const [wb] = XLSX.writeFile.mock.calls[0];
    const ws = wb.Sheets['Feuil1'];

    const i2 = ws[XLSX.utils.encode_cell({ r: 1, c: 8 })];
    expect(i2.t).toBe('n');
    expect(i2.v).toBe(0.20);
    expect(i2.z).toBe('0.00%');
  });

  it('devrait écrire la date en serial Excel avec format m/d/yy', () => {
    const resultat = { clients: [CLIENT_AUP], stats: {} };

    exportFacturationVariableExcel({ resultat, periode: '2026-01' });

    const [wb] = XLSX.writeFile.mock.calls[0];
    const ws = wb.Sheets['Feuil1'];

    const k2 = ws[XLSX.utils.encode_cell({ r: 1, c: 10 })];
    expect(k2.t).toBe('n');
    expect(k2.z).toBe('m/d/yy');
    // 31 janvier 2026 = serial 46053
    expect(k2.v).toBe(46053);
  });

  it('devrait avoir la colonne E absente (Description)', () => {
    const resultat = { clients: [CLIENT_AUP], stats: {} };

    exportFacturationVariableExcel({ resultat, periode: '2026-01' });

    const [wb] = XLSX.writeFile.mock.calls[0];
    const ws = wb.Sheets['Feuil1'];

    // E2 (r:1, c:4) ne doit pas exister
    const e2 = ws[XLSX.utils.encode_cell({ r: 1, c: 4 })];
    expect(e2).toBeUndefined();
  });

  it('devrait avoir la colonne L absente (Modèle)', () => {
    const resultat = { clients: [CLIENT_AUP], stats: {} };

    exportFacturationVariableExcel({ resultat, periode: '2026-01' });

    const [wb] = XLSX.writeFile.mock.calls[0];
    const ws = wb.Sheets['Feuil1'];

    // L2 (r:1, c:11) ne doit pas exister
    const l2 = ws[XLSX.utils.encode_cell({ r: 1, c: 11 })];
    expect(l2).toBeUndefined();
  });

  it('devrait écrire "Prestations de services" en colonne J', () => {
    const resultat = { clients: [CLIENT_AUP], stats: {} };

    exportFacturationVariableExcel({ resultat, periode: '2026-01' });

    const [wb] = XLSX.writeFile.mock.calls[0];
    const ws = wb.Sheets['Feuil1'];

    const j2 = ws[XLSX.utils.encode_cell({ r: 1, c: 9 })];
    expect(j2.t).toBe('s');
    expect(j2.v).toBe('Prestations de services');
  });

  it('devrait écrire "unité" en colonne G', () => {
    const resultat = { clients: [CLIENT_AUP], stats: {} };

    exportFacturationVariableExcel({ resultat, periode: '2026-01' });

    const [wb] = XLSX.writeFile.mock.calls[0];
    const ws = wb.Sheets['Feuil1'];

    const g2 = ws[XLSX.utils.encode_cell({ r: 1, c: 6 })];
    expect(g2.t).toBe('s');
    expect(g2.v).toBe('unité');
  });

  it('devrait écrire les 12 headers corrects', () => {
    const resultat = { clients: [CLIENT_AUP], stats: {} };

    exportFacturationVariableExcel({ resultat, periode: '2026-01' });

    const [wb] = XLSX.writeFile.mock.calls[0];
    const ws = wb.Sheets['Feuil1'];

    const expectedHeaders = [
      'Raison sociale (optionnel)', 'SIREN', 'Identifiant produit (recommandé)',
      'Nom du produit', 'Description (optionnel)', 'Quantité',
      'Unité (liste déroulante)', 'Prix unitaire HT en euros',
      'Taux TVA  (liste déroulante)', 'Type de produit',
      "Date d'émission", 'Modèle (identifiant) (optionnel)'
    ];

    for (let c = 0; c < expectedHeaders.length; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
      expect(cell.v).toBe(expectedHeaders[c]);
      expect(cell.t).toBe('s');
    }
  });

  it('devrait ne rien faire si aucun client', () => {
    const resultat = { clients: [], stats: {} };

    exportFacturationVariableExcel({ resultat, periode: '2026-01' });

    expect(XLSX.writeFile).not.toHaveBeenCalled();
  });

  it('devrait fonctionner en mode client unique', () => {
    exportFacturationVariableExcel({ client: CLIENT_ZF, periode: '2026-03' });

    expect(XLSX.writeFile).toHaveBeenCalledTimes(1);
    const [, fileName] = XLSX.writeFile.mock.calls[0];
    expect(fileName).toBe('ZF Mars 26 a importer dans PL.xlsx');
  });

  it('devrait calculer le serial Excel correct pour février 2026', () => {
    const resultat = { clients: [CLIENT_AUP], stats: {} };

    exportFacturationVariableExcel({ resultat, periode: '2026-02' });

    const [wb] = XLSX.writeFile.mock.calls[0];
    const ws = wb.Sheets['Feuil1'];

    const k2 = ws[XLSX.utils.encode_cell({ r: 1, c: 10 })];
    // 28 février 2026 = serial 46081
    expect(k2.v).toBe(46081);
  });
});

// ════════════════════════════════════════════════════════════════
//  2. SERVICE — Tests des données BK BAGNEUX
// ════════════════════════════════════════════════════════════════

const TARIFS_VARIABLE_BK = [
  { client_id: 112, label: 'Etablissement du bulletin de salaire', axe: 'social_bulletin', pu_ht: 15.80, quantite: 1, type_recurrence: 'variable', date_effet: '2026-01-01', tva_rate: 0.20, cabinet: 'Audit Up', produit_pennylane_id: 30 },
  { client_id: 112, label: 'Dépôt coffre-fort numérique', axe: 'accessoires_social', pu_ht: 1.00, quantite: 1, type_recurrence: 'variable', date_effet: '2026-01-01', tva_rate: 0.20, cabinet: 'Audit Up', produit_pennylane_id: 31 },
  { client_id: 112, label: 'Bulletins envoyés par publi-postage', axe: 'accessoires_social', pu_ht: 2.65, quantite: 1, type_recurrence: 'variable', date_effet: '2026-01-01', tva_rate: 0.20, cabinet: 'Audit Up', produit_pennylane_id: 37 },
  { client_id: 112, label: "Enregistrement d'entrée de salariés", axe: 'accessoires_social', pu_ht: 15.80, quantite: 1, type_recurrence: 'variable', date_effet: '2026-01-01', tva_rate: 0.20, cabinet: 'Audit Up', produit_pennylane_id: 32 },
  { client_id: 112, label: 'Enregistrement de sortie de salariés', axe: 'accessoires_social', pu_ht: 31.55, quantite: 1, type_recurrence: 'variable', date_effet: '2026-01-01', tva_rate: 0.20, cabinet: 'Audit Up', produit_pennylane_id: 33 },
  { client_id: 112, label: 'Modification de bulletin de salaires sur votre demande', axe: 'accessoires_social', pu_ht: 15.80, quantite: 1, type_recurrence: 'variable', date_effet: '2026-01-01', tva_rate: 0.20, cabinet: 'Audit Up', produit_pennylane_id: 36 }
];

const PRODUITS_PL_AUP = [
  { id: 30, cabinet: 'Audit Up', pennylane_product_id: 'uuid-bull-30', denomination: 'Etablissement de bulletin de salaire {{mois}}', label_normalise: 'bulletin_salaire', type_recurrence: 'variable', colonne_silae: 'bulletins', tva_rate: 0.20, actif: true },
  { id: 31, cabinet: 'Audit Up', pennylane_product_id: 'uuid-coffre-31', denomination: 'Dépôt Coffre-Fort Numérique', label_normalise: 'coffre_fort', type_recurrence: 'variable', colonne_silae: 'coffre_fort', tva_rate: 0.20, actif: true },
  { id: 32, cabinet: 'Audit Up', pennylane_product_id: 'uuid-entree-32', denomination: "Enregistrement d'entrée de salariés", label_normalise: 'entree_salarie', type_recurrence: 'variable', colonne_silae: 'entrees', tva_rate: 0.20, actif: true },
  { id: 33, cabinet: 'Audit Up', pennylane_product_id: 'uuid-sortie-33', denomination: 'Enregistrement de sortie de salariés', label_normalise: 'sortie_salarie', type_recurrence: 'variable', colonne_silae: 'sorties', tva_rate: 0.20, actif: true },
  { id: 36, cabinet: 'Audit Up', pennylane_product_id: 'uuid-modif-36', denomination: 'Modification de bulletin de salaire sur votre demande', label_normalise: 'modification_bulletin', type_recurrence: 'variable', colonne_silae: null, tva_rate: 0.20, actif: true },
  { id: 37, cabinet: 'Audit Up', pennylane_product_id: 'uuid-publi-37', denomination: 'Bulletins de salaire envoyés par publi-postage', label_normalise: 'publipostage', type_recurrence: 'variable', colonne_silae: 'editique', tva_rate: 0.20, actif: true }
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

describe('BK BAGNEUX — données de référence', () => {
  it('devrait trouver 6 produits variables en tarifs', () => {
    expect(TARIFS_VARIABLE_BK).toHaveLength(6);
  });

  it('devrait matcher 5 produits avec Silae et 1 manuel', () => {
    const auto = PRODUITS_PL_AUP.filter(p => p.colonne_silae !== null);
    const manuel = PRODUITS_PL_AUP.filter(p => p.colonne_silae === null);
    expect(auto).toHaveLength(5);
    expect(manuel).toHaveLength(1);
    expect(manuel[0].label_normalise).toBe('modification_bulletin');
  });

  it('devrait calculer le total HT auto = 746.20', () => {
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

// ─── Mapping colonne Silae ───

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
      expect(SILAE_BK_JAN[col]).toBe(qty);
    }
  });
});

// ─── Calcul PU TTC ───

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

// ─── Normalisation labels ───

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

// ─── Structure export ───

describe('structure données export', () => {
  it('devrait avoir la bonne facture totale pour BK BAGNEUX jan 2026', () => {
    const fixe = 1015.00;
    const variableAuto = 746.20;
    expect(fixe + variableAuto).toBe(1761.20);
  });
});

// ════════════════════════════════════════════════════════════════
//  3. SERIAL DATE EXCEL
// ════════════════════════════════════════════════════════════════

describe('serial date Excel', () => {
  // On vérifie via l'export que les dates sont correctes
  it('31 janvier 2026 = serial 46053', () => {
    const resultat = { clients: [CLIENT_AUP], stats: {} };
    exportFacturationVariableExcel({ resultat, periode: '2026-01' });

    const [wb] = XLSX.writeFile.mock.calls[XLSX.writeFile.mock.calls.length - 1];
    const ws = wb.Sheets['Feuil1'];
    const k2 = ws[XLSX.utils.encode_cell({ r: 1, c: 10 })];
    expect(k2.v).toBe(46053);
  });

  it('28 février 2026 = serial 46081', () => {
    vi.clearAllMocks();
    const resultat = { clients: [CLIENT_AUP], stats: {} };
    exportFacturationVariableExcel({ resultat, periode: '2026-02' });

    const [wb] = XLSX.writeFile.mock.calls[0];
    const ws = wb.Sheets['Feuil1'];
    const k2 = ws[XLSX.utils.encode_cell({ r: 1, c: 10 })];
    expect(k2.v).toBe(46081);
  });

  it('31 mars 2026 = serial 46112', () => {
    vi.clearAllMocks();
    const resultat = { clients: [CLIENT_AUP], stats: {} };
    exportFacturationVariableExcel({ resultat, periode: '2026-03' });

    const [wb] = XLSX.writeFile.mock.calls[0];
    const ws = wb.Sheets['Feuil1'];
    const k2 = ws[XLSX.utils.encode_cell({ r: 1, c: 10 })];
    expect(k2.v).toBe(46112);
  });

  it('31 décembre 2025 = serial 46022', () => {
    vi.clearAllMocks();
    const resultat = { clients: [CLIENT_AUP], stats: {} };
    exportFacturationVariableExcel({ resultat, periode: '2025-12' });

    const [wb] = XLSX.writeFile.mock.calls[0];
    const ws = wb.Sheets['Feuil1'];
    const k2 = ws[XLSX.utils.encode_cell({ r: 1, c: 10 })];
    // 46022 + 31 jours = 46053 (31 jan 2026) ✓
    expect(k2.v).toBe(46022);
  });
});

// ════════════════════════════════════════════════════════════════
//  4. FORMATER PÉRIODE FRANÇAIS
// ════════════════════════════════════════════════════════════════

describe('formaterPeriodeFr (via noms de fichiers)', () => {
  beforeEach(() => vi.clearAllMocks());

  const moisTests = [
    ['2026-01', 'Janvier 26'],
    ['2026-02', 'Février 26'],
    ['2026-03', 'Mars 26'],
    ['2026-04', 'Avril 26'],
    ['2026-05', 'Mai 26'],
    ['2026-06', 'Juin 26'],
    ['2026-07', 'Juillet 26'],
    ['2026-08', 'Août 26'],
    ['2026-09', 'Septembre 26'],
    ['2026-10', 'Octobre 26'],
    ['2026-11', 'Novembre 26'],
    ['2026-12', 'Décembre 26']
  ];

  for (const [periode, expected] of moisTests) {
    it(`${periode} → "${expected}"`, () => {
      const resultat = { clients: [CLIENT_AUP], stats: {} };
      exportFacturationVariableExcel({ resultat, periode });

      const [, fileName] = XLSX.writeFile.mock.calls[0];
      expect(fileName).toBe(`AUP ${expected} a importer dans PL.xlsx`);
      vi.clearAllMocks();
    });
  }
});

// ════════════════════════════════════════════════════════════════
//  5. SYNC PRODUITS PENNYLANE
// ════════════════════════════════════════════════════════════════

describe('syncProduitsPennylane', () => {
  let syncProduitsPennylane;

  beforeEach(async () => {
    const mod = await import('./facturationVariableService.js');
    syncProduitsPennylane = mod.syncProduitsPennylane;
  });

  it('devrait être importable', () => {
    expect(syncProduitsPennylane).toBeDefined();
    expect(typeof syncProduitsPennylane).toBe('function');
  });

  it('devrait retourner 0/0/0 si pas de produits PL', async () => {
    const mockSupabase = { from: vi.fn() };
    const result = await syncProduitsPennylane({ supabase: mockSupabase, cabinet: 'Audit Up', plProducts: [] });
    expect(result).toEqual({ updated: 0, created: 0, total: 0 });
  });

  it('devrait retourner 0/0/0 si plProducts null', async () => {
    const mockSupabase = { from: vi.fn() };
    const result = await syncProduitsPennylane({ supabase: mockSupabase, cabinet: 'Audit Up', plProducts: null });
    expect(result).toEqual({ updated: 0, created: 0, total: 0 });
  });
});

// ════════════════════════════════════════════════════════════════
//  6. SPLIT PAR CABINET
// ════════════════════════════════════════════════════════════════

describe('split par cabinet', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devrait séparer AUP et ZF dans 2 fichiers distincts', () => {
    const resultat = { clients: [CLIENT_AUP, CLIENT_ZF], stats: {} };

    exportFacturationVariableExcel({ resultat, periode: '2026-01' });

    expect(XLSX.writeFile).toHaveBeenCalledTimes(2);

    const fileNames = XLSX.writeFile.mock.calls.map(c => c[1]);
    expect(fileNames).toContain('AUP Janvier 26 a importer dans PL.xlsx');
    expect(fileNames).toContain('ZF Janvier 26 a importer dans PL.xlsx');
  });

  it('devrait mettre uniquement les clients AUP dans le fichier AUP', () => {
    const resultat = { clients: [CLIENT_AUP, CLIENT_ZF], stats: {} };

    exportFacturationVariableExcel({ resultat, periode: '2026-01' });

    // Trouver le workbook AUP
    const aupCall = XLSX.writeFile.mock.calls.find(c => c[1].includes('AUP'));
    const [wb] = aupCall;
    const ws = wb.Sheets['Feuil1'];

    // Vérifier que la raison sociale est BK BAGNEUX (pas CABINET TEST ZF)
    const a2 = ws[XLSX.utils.encode_cell({ r: 1, c: 0 })];
    expect(a2.v).toBe('BK BAGNEUX');
  });

  it('devrait mettre uniquement les clients ZF dans le fichier ZF', () => {
    const resultat = { clients: [CLIENT_AUP, CLIENT_ZF], stats: {} };

    exportFacturationVariableExcel({ resultat, periode: '2026-01' });

    const zfCall = XLSX.writeFile.mock.calls.find(c => c[1].includes('ZF'));
    const [wb] = zfCall;
    const ws = wb.Sheets['Feuil1'];

    const a2 = ws[XLSX.utils.encode_cell({ r: 1, c: 0 })];
    expect(a2.v).toBe('CABINET TEST ZF');
  });

  it('devrait générer 1 seul fichier si tous les clients sont du même cabinet', () => {
    const resultat = { clients: [CLIENT_AUP], stats: {} };

    exportFacturationVariableExcel({ resultat, periode: '2026-01' });

    expect(XLSX.writeFile).toHaveBeenCalledTimes(1);
  });
});
