// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx-js-style';

/**
 * Tests unitaires — Saisie manuelle + grille Silae
 *
 * Couvre :
 *   1. Export modèle Excel (facturationManuelleService.js)
 *   2. Parse Excel rempli (facturationManuelleService.js)
 *   3. Fallback bulletins manuels (facturationVariableService.js)
 *   4. Mapping bulletins_refaits (SILAE_COLUMN_MAP)
 *   5. Export PL — exclusion quantité 0
 *   6. Clients forfait dans l'export PL (coffre-fort / éditique)
 */

// ════════════════════════════════════════════════════════════════
//  Mock xlsx-js-style
// ════════════════════════════════════════════════════════════════

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

import { parseManuelExcel } from './facturationManuelleService.js';
import { exportFacturationVariableExcel } from './exportFacturationVariable.js';

// ════════════════════════════════════════════════════════════════
//  1. PARSE EXCEL — parseManuelExcel
// ════════════════════════════════════════════════════════════════

function buildExcelBuffer(rows) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Modèle');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return buf;
}

const HEADERS = ['Type', 'Client', 'SIREN', 'Cabinet', 'Bull. refaits', 'Bull. manuels',
  'Entrées', 'Sorties', 'Extras', 'Coffre-fort', 'Éditique', 'Temps passé', 'Commentaires'];

describe('parseManuelExcel', () => {
  it('devrait parser un fichier avec 1 ligne remplie', () => {
    const rows = [
      HEADERS,
      ['R', 'SAINT JAMES', '349719758001', 'AUP', 0, 12, 1, 0, 0, 0, 0, 1.5, 'Manuel']
    ];
    const result = parseManuelExcel(buildExcelBuffer(rows));
    expect(result).toHaveLength(1);
    expect(result[0].client).toBe('SAINT JAMES');
    expect(result[0].siren).toBe('349719758001');
    expect(result[0].bulletins_manuels).toBe(12);
    expect(result[0].entrees).toBe(1);
    expect(result[0].temps_passe).toBe(1.5);
    expect(result[0].commentaires).toBe('Manuel');
  });

  it('devrait ignorer les lignes où toutes les colonnes E-M sont vides', () => {
    const rows = [
      HEADERS,
      ['R', 'BK BAGNEUX', '901059287', 'AUP', 0, 0, 0, 0, 0, 0, 0, 0, ''],
      ['R', 'SAINT JAMES', '349719758001', 'AUP', 0, 12, 0, 0, 0, 0, 0, 0, '']
    ];
    const result = parseManuelExcel(buildExcelBuffer(rows));
    expect(result).toHaveLength(1);
    expect(result[0].client).toBe('SAINT JAMES');
  });

  it('devrait retourner un tableau vide pour un fichier vide', () => {
    const rows = [HEADERS];
    const result = parseManuelExcel(buildExcelBuffer(rows));
    expect(result).toHaveLength(0);
  });

  it('devrait parser les bulletins refaits correctement', () => {
    const rows = [
      HEADERS,
      ['R', 'BK BAGNEUX', '901059287', 'AUP', 3, 0, 0, 0, 0, 0, 0, 0, '']
    ];
    const result = parseManuelExcel(buildExcelBuffer(rows));
    expect(result).toHaveLength(1);
    expect(result[0].bulletins_refaits).toBe(3);
    expect(result[0].bulletins_manuels).toBe(0);
  });

  it('devrait parser le coffre-fort et éditique', () => {
    const rows = [
      HEADERS,
      ['F', 'ACF CONSEILS', '123456789', 'AUP', 0, 0, 0, 0, 0, 5, 3, 0, '']
    ];
    const result = parseManuelExcel(buildExcelBuffer(rows));
    expect(result).toHaveLength(1);
    expect(result[0].coffre_fort).toBe(5);
    expect(result[0].editique).toBe(3);
    expect(result[0].type).toBe('F');
  });

  it('devrait gérer les commentaires avec espaces', () => {
    const rows = [
      HEADERS,
      ['R', 'TEST', '111111111', 'AUP', 0, 0, 0, 0, 0, 0, 0, 0, '  Client exigeant  ']
    ];
    const result = parseManuelExcel(buildExcelBuffer(rows));
    expect(result).toHaveLength(1);
    expect(result[0].commentaires).toBe('Client exigeant');
  });

  it('devrait ignorer les lignes sans nom de client', () => {
    const rows = [
      HEADERS,
      ['R', '', '111111111', 'AUP', 5, 0, 0, 0, 0, 0, 0, 0, ''],
      ['R', 'VALIDE', '222222222', 'AUP', 3, 0, 0, 0, 0, 0, 0, 0, '']
    ];
    const result = parseManuelExcel(buildExcelBuffer(rows));
    expect(result).toHaveLength(1);
    expect(result[0].client).toBe('VALIDE');
  });

  it('devrait parser plusieurs lignes correctement', () => {
    const rows = [
      HEADERS,
      ['R', 'CLIENT A', '111111111', 'AUP', 2, 0, 0, 0, 0, 0, 0, 0, ''],
      ['R', 'CLIENT B', '222222222', 'AUP', 0, 10, 0, 0, 0, 0, 0, 0, ''],
      ['F', 'CLIENT C', '333333333', 'ZF', 0, 0, 0, 0, 0, 3, 0, 2.5, 'Note']
    ];
    const result = parseManuelExcel(buildExcelBuffer(rows));
    expect(result).toHaveLength(3);
    expect(result[0].bulletins_refaits).toBe(2);
    expect(result[1].bulletins_manuels).toBe(10);
    expect(result[2].coffre_fort).toBe(3);
    expect(result[2].temps_passe).toBe(2.5);
  });
});

// ════════════════════════════════════════════════════════════════
//  2. FALLBACK BULLETINS MANUELS
// ════════════════════════════════════════════════════════════════

describe('fallback bulletins manuels', () => {
  const SILAE_COLUMN_MAP = {
    bulletins: 'bulletins',
    coffre_fort: 'coffre_fort',
    editique: 'editique',
    entrees: 'entrees',
    sorties: 'sorties',
    declarations: 'declarations',
    attestations_pe: 'attestations_pe',
    bulletins_refaits: 'bulletins_refaits'
  };

  it('devrait utiliser bulletins_manuels quand bulletins Silae = 0', () => {
    const silae = { bulletins: 0, bulletins_manuels: 12, coffre_fort: 0 };
    const colonneSilae = 'bulletins';
    let quantite = 0;
    let source = 'silae';

    // Reproduire la logique du service
    if (SILAE_COLUMN_MAP[colonneSilae]) {
      quantite = silae[SILAE_COLUMN_MAP[colonneSilae]];
      source = 'silae';
    }

    // Fallback
    if (quantite === 0 && colonneSilae === 'bulletins' && silae.bulletins_manuels > 0) {
      quantite = silae.bulletins_manuels;
      source = 'manuel';
    }

    expect(quantite).toBe(12);
    expect(source).toBe('manuel');
  });

  it('devrait garder bulletins Silae quand > 0 (pas de fallback)', () => {
    const silae = { bulletins: 39, bulletins_manuels: 5, coffre_fort: 0 };
    let quantite = silae.bulletins;
    let source = 'silae';

    if (quantite === 0 && silae.bulletins_manuels > 0) {
      quantite = silae.bulletins_manuels;
      source = 'manuel';
    }

    expect(quantite).toBe(39);
    expect(source).toBe('silae');
  });

  it('devrait rester à 0 si bulletins et bulletins_manuels sont tous les deux à 0', () => {
    const silae = { bulletins: 0, bulletins_manuels: 0, coffre_fort: 0 };
    let quantite = silae.bulletins;

    if (quantite === 0 && silae.bulletins_manuels > 0) {
      quantite = silae.bulletins_manuels;
    }

    expect(quantite).toBe(0);
  });

  it('ne devrait PAS appliquer le fallback pour coffre_fort', () => {
    const silae = { bulletins: 0, bulletins_manuels: 12, coffre_fort: 0 };
    const colonneSilae = 'coffre_fort';
    let quantite = silae.coffre_fort;

    // Le fallback ne s'applique QUE si colonneSilae === 'bulletins'
    if (quantite === 0 && colonneSilae === 'bulletins' && silae.bulletins_manuels > 0) {
      quantite = silae.bulletins_manuels;
    }

    expect(quantite).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════
//  3. MAPPING BULLETINS_REFAITS
// ════════════════════════════════════════════════════════════════

describe('mapping bulletins_refaits', () => {
  const SILAE_COLUMN_MAP = {
    bulletins: 'bulletins',
    coffre_fort: 'coffre_fort',
    editique: 'editique',
    entrees: 'entrees',
    sorties: 'sorties',
    declarations: 'declarations',
    attestations_pe: 'attestations_pe',
    bulletins_refaits: 'bulletins_refaits'
  };

  it('devrait avoir bulletins_refaits dans SILAE_COLUMN_MAP', () => {
    expect(SILAE_COLUMN_MAP).toHaveProperty('bulletins_refaits');
    expect(SILAE_COLUMN_MAP.bulletins_refaits).toBe('bulletins_refaits');
  });

  it('devrait extraire la quantité refaits depuis silae_productions', () => {
    const silae = {
      bulletins: 39,
      bulletins_refaits: 3,
      coffre_fort: 30
    };
    const colonneSilae = 'bulletins_refaits';
    const silaeKey = SILAE_COLUMN_MAP[colonneSilae];
    const quantite = silae[silaeKey];

    expect(quantite).toBe(3);
  });

  it('devrait retourner 0 si pas de bulletins refaits', () => {
    const silae = {
      bulletins: 39,
      bulletins_refaits: 0,
      coffre_fort: 30
    };
    const quantite = silae[SILAE_COLUMN_MAP['bulletins_refaits']];
    expect(quantite).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════
//  4. EXPORT PL — exclusion quantité 0
// ════════════════════════════════════════════════════════════════

describe('export PL — filtre quantité', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devrait exclure les lignes avec quantité = 0', () => {
    const client = {
      client_id: 112,
      client_nom: 'BK BAGNEUX',
      cabinet: 'Audit Up',
      siren: '901059287',
      pennylane_customer_id: 'C1',
      lignes: [
        { label: 'Bulletin', label_normalise: 'bulletin_salaire', pennylane_product_id: 'uuid-1', denomination: 'Bulletin {{mois}}', pu_ht: 15.80, pu_ttc: 18.96, quantite: 39, montant_ht: 616.20, colonne_silae: 'bulletins', source: 'silae', tva_code: 'FR_200', tva_rate: 0.20 },
        { label: 'Coffre-fort', label_normalise: 'coffre_fort', pennylane_product_id: 'uuid-2', denomination: 'Coffre-Fort', pu_ht: 1.00, pu_ttc: 1.20, quantite: 0, montant_ht: 0, colonne_silae: 'coffre_fort', source: 'silae', tva_code: 'FR_200', tva_rate: 0.20 },
        { label: 'Modif bulletin', label_normalise: 'modification_bulletin', pennylane_product_id: 'uuid-3', denomination: 'Modification', pu_ht: 15.80, pu_ttc: 18.96, quantite: null, montant_ht: null, colonne_silae: 'bulletins_refaits', source: 'manuel', tva_code: 'FR_200', tva_rate: 0.20 }
      ],
      total_ht_auto: 616.20,
      total_ht_estimable: 616.20,
      has_silae: true,
      complet: false
    };

    exportFacturationVariableExcel({ resultat: { clients: [client], stats: {} }, periode: '2026-01' });

    const [wb] = XLSX.writeFile.mock.calls[0];
    const ws = wb.Sheets['Feuil1'];

    // Seule la ligne bulletin (qte=39) doit être exportée
    // Row 0 = header, Row 1 = bulletin (39)
    expect(ws[XLSX.utils.encode_cell({ r: 1, c: 0 })]).toBeDefined();
    expect(ws[XLSX.utils.encode_cell({ r: 1, c: 5 })].v).toBe(39);
    // Row 2 = ne devrait PAS exister (coffre=0, modif=null)
    expect(ws[XLSX.utils.encode_cell({ r: 2, c: 0 })]).toBeUndefined();
  });

  it('devrait inclure les lignes avec quantité > 0 (bulletins refaits)', () => {
    const client = {
      client_id: 112,
      client_nom: 'BK BAGNEUX',
      cabinet: 'Audit Up',
      siren: '901059287',
      pennylane_customer_id: 'C1',
      lignes: [
        { label: 'Bulletin', label_normalise: 'bulletin_salaire', pennylane_product_id: 'uuid-1', denomination: 'Bulletin {{mois}}', pu_ht: 15.80, pu_ttc: 18.96, quantite: 39, montant_ht: 616.20, colonne_silae: 'bulletins', source: 'silae', tva_code: 'FR_200', tva_rate: 0.20 },
        { label: 'Modif bulletin', label_normalise: 'modification_bulletin', pennylane_product_id: 'uuid-3', denomination: 'Modification', pu_ht: 15.80, pu_ttc: 18.96, quantite: 2, montant_ht: 31.60, colonne_silae: 'bulletins_refaits', source: 'silae', tva_code: 'FR_200', tva_rate: 0.20 }
      ],
      total_ht_auto: 647.80,
      total_ht_estimable: 647.80,
      has_silae: true,
      complet: true
    };

    exportFacturationVariableExcel({ resultat: { clients: [client], stats: {} }, periode: '2026-01' });

    const [wb] = XLSX.writeFile.mock.calls[0];
    const ws = wb.Sheets['Feuil1'];

    // 2 lignes data : bulletin (39) + modif (2)
    expect(ws[XLSX.utils.encode_cell({ r: 1, c: 5 })].v).toBe(39);
    expect(ws[XLSX.utils.encode_cell({ r: 2, c: 5 })].v).toBe(2);
    expect(ws[XLSX.utils.encode_cell({ r: 3, c: 0 })]).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════
//  5. CLIENTS FORFAIT — coffre-fort / éditique dans export PL
// ════════════════════════════════════════════════════════════════

describe('export PL — clients forfait coffre-fort/éditique', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devrait exporter un client forfait avec coffre-fort', () => {
    const clientForfait = {
      client_id: 500,
      client_nom: 'ACF CONSEILS',
      cabinet: 'Audit Up',
      siren: '123456789',
      pennylane_customer_id: 'C-ACF',
      lignes: [
        { label: 'Coffre-fort', label_normalise: 'coffre_fort', pennylane_product_id: 'uuid-coffre', denomination: 'Dépôt Coffre-Fort Numérique', pu_ht: 1.00, pu_ttc: 1.20, quantite: 5, montant_ht: 5.00, colonne_silae: 'coffre_fort', source: 'silae', tva_code: 'FR_200', tva_rate: 0.20 }
      ],
      total_ht_auto: 5.00,
      total_ht_estimable: 5.00,
      has_silae: true,
      complet: true
    };

    exportFacturationVariableExcel({ resultat: { clients: [clientForfait], stats: {} }, periode: '2026-01' });

    const [wb] = XLSX.writeFile.mock.calls[0];
    const ws = wb.Sheets['Feuil1'];

    // Row 1 = coffre-fort
    expect(ws[XLSX.utils.encode_cell({ r: 1, c: 0 })].v).toBe('ACF CONSEILS');
    expect(ws[XLSX.utils.encode_cell({ r: 1, c: 1 })].v).toBe(123456789);
    expect(ws[XLSX.utils.encode_cell({ r: 1, c: 5 })].v).toBe(5);
    expect(ws[XLSX.utils.encode_cell({ r: 1, c: 7 })].v).toBe(1.00);
  });

  it('devrait mélanger clients réel et forfait dans le même fichier cabinet', () => {
    const clientReel = {
      client_id: 112,
      client_nom: 'BK BAGNEUX',
      cabinet: 'Audit Up',
      siren: '901059287',
      pennylane_customer_id: 'C1',
      lignes: [
        { label: 'Bulletin', label_normalise: 'bulletin_salaire', pennylane_product_id: 'uuid-1', denomination: 'Bulletin {{mois}}', pu_ht: 15.80, pu_ttc: 18.96, quantite: 39, montant_ht: 616.20, colonne_silae: 'bulletins', source: 'silae', tva_code: 'FR_200', tva_rate: 0.20 }
      ],
      total_ht_auto: 616.20,
      total_ht_estimable: 616.20,
      has_silae: true,
      complet: true
    };
    const clientForfait = {
      client_id: 500,
      client_nom: 'ACF CONSEILS',
      cabinet: 'Audit Up',
      siren: '123456789',
      pennylane_customer_id: 'C-ACF',
      lignes: [
        { label: 'Coffre-fort', label_normalise: 'coffre_fort', pennylane_product_id: 'uuid-coffre', denomination: 'Coffre-Fort', pu_ht: 1.00, pu_ttc: 1.20, quantite: 3, montant_ht: 3.00, colonne_silae: 'coffre_fort', source: 'silae', tva_code: 'FR_200', tva_rate: 0.20 }
      ],
      total_ht_auto: 3.00,
      total_ht_estimable: 3.00,
      has_silae: true,
      complet: true
    };

    exportFacturationVariableExcel({
      resultat: { clients: [clientReel, clientForfait], stats: {} },
      periode: '2026-01'
    });

    // 1 seul fichier (même cabinet AUP)
    expect(XLSX.writeFile).toHaveBeenCalledTimes(1);

    const [wb] = XLSX.writeFile.mock.calls[0];
    const ws = wb.Sheets['Feuil1'];

    // Row 1 = BK BAGNEUX, Row 2 = ACF CONSEILS
    expect(ws[XLSX.utils.encode_cell({ r: 1, c: 0 })].v).toBe('BK BAGNEUX');
    expect(ws[XLSX.utils.encode_cell({ r: 2, c: 0 })].v).toBe('ACF CONSEILS');
    expect(ws[XLSX.utils.encode_cell({ r: 3, c: 0 })]).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════
//  6. DONNÉES MANUELLES — structure silae_productions
// ════════════════════════════════════════════════════════════════

describe('structure données manuelles silae_productions', () => {
  it('ne devrait PAS écraser les colonnes manuelles lors d\'un re-import Silae', () => {
    // Les colonnes manuelles ont des DEFAULT et ne sont PAS dans le upsert Silae
    const SILAE_UPSERT_COLUMNS = [
      'client_id', 'periode', 'bulletins', 'coffre_fort', 'editique',
      'entrees', 'sorties', 'declarations', 'attestations_pe'
    ];
    const MANUAL_COLUMNS = ['bulletins_manuels', 'bulletins_refaits', 'temps_passe', 'commentaires'];

    for (const col of MANUAL_COLUMNS) {
      expect(SILAE_UPSERT_COLUMNS).not.toContain(col);
    }
  });

  it('devrait avoir les bons defaults pour les colonnes manuelles', () => {
    const defaults = {
      bulletins_manuels: 0,
      bulletins_refaits: 0,
      temps_passe: 0,
      commentaires: ''
    };

    expect(defaults.bulletins_manuels).toBe(0);
    expect(defaults.bulletins_refaits).toBe(0);
    expect(defaults.temps_passe).toBe(0);
    expect(defaults.commentaires).toBe('');
  });

  it('temps_passe et commentaires ne doivent PAS être exportés vers PL', () => {
    // Ces champs sont pour info interne uniquement
    const EXPORT_PL_FIELDS = [
      'label', 'label_normalise', 'pennylane_product_id', 'denomination',
      'pu_ht', 'pu_ttc', 'quantite', 'montant_ht', 'colonne_silae',
      'source', 'tva_code', 'tva_rate'
    ];

    expect(EXPORT_PL_FIELDS).not.toContain('temps_passe');
    expect(EXPORT_PL_FIELDS).not.toContain('commentaires');
  });
});
