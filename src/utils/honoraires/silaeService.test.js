// @ts-check
import { describe, it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { parseSilaeExcel, excludeTotalRows, aggregatePeriodRows, importSilaeData } from './silaeService.js';

/**
 * Tests unitaires — Import Silae "Analyse production synthétique"
 *
 * Couvre :
 *   1. parseSilaeExcel — extraction Bulletins extra (col D) et Bulletins refaits (col E)
 *   2. excludeTotalRows — exclusion de la ligne de total des dossiers multi-établissements
 *   3. importSilaeData — routage des lignes détail vers le bon client (SNC CHRISTINE)
 *
 * Basé sur le fichier réel 06-2026 :
 *   CHRISTINE | SNC CHRISTINE                    (total, à ignorer)
 *   CHRISTINE | SNC CHRISTINE - RELAIS CHRISTINE → client RELAIS CHRISTINE (109, Audit Up)
 *   CHRISTINE | SNC CHRISTINE - SAINT JAMES      → client SAINT JAMES (203, Audit Up)
 */

// ─── Helpers construction fichier Silae ───

const HEADERS = [
  'Numéro\nDossier', 'Société', 'Siren', 'Bulletins extra', 'Bulletins refaits',
  'Bulletins\noriginaux non 0', '... dont non\nédités', 'Bulletins\noriginaux à 0',
  'Total bulletins\noriginaux', 'Bulletins\noriginaux\nà calculer',
  'Bulletins\ndéposés\ncoffre-fort', '...dont\néditique', 'Total général\nbulletins',
  'Total bulletins\nbrouillons', 'Entrées', 'Sorties', 'Déclarations', 'DUE',
  'Attestation\nPôle emploi'
];

/**
 * Construit un ArrayBuffer de fichier Silae à partir de lignes de données.
 * @param {any[][]} dataRows
 * @returns {ArrayBuffer}
 */
function buildSilaeFile(dataRows) {
  const aoa = [
    ['Analyse production synthétique par période de paie'],
    [],
    HEADERS,
    ...dataRows
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Feuil1');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return out;
}

// Lignes reproduisant le fichier réel 06-2026 (colonnes A→S)
const ROW_ACF = ['ACF CONSEI', 'ACF CONSEILS', '523455244', '', '', 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0];
const ROW_TERNI = ['TERNICOMPT', 'TERNI COMPTOIR', '943100636', '6 extras', '', 33, 0, 0, 33, 0, 26, 0, 33, 0, 2, 1, 0, 0, 0];
const ROW_BK = ['BK BAGNEUX', 'BK BAGNEUX', '901059287', '', 1, 38, 0, 0, 38, 0, 37, 2, 38, 0, 2, 2, 0, 0, 0];
// Ligne de total réelle du fichier 06-2026 : coffre-fort (706) et éditique (2)
// renseignés sur le total mais absents des lignes détail → fichier incohérent, rejeté
const ROW_CHRISTINE_TOTAL_INCOHERENT = ['CHRISTINE', 'SNC CHRISTINE', '387571789', '', '', 454, 0, 0, 454, 1, 706, 2, 454, 0, 35, 26, 2, 0, 110];
// Variante cohérente : chaque champ renseigné du total = somme des lignes détail
const ROW_CHRISTINE_TOTAL = ['CHRISTINE', 'SNC CHRISTINE', '387571789', '', '', 454, 0, 0, 454, 1, '', '', 454, 0, 35, 26, 2, 0, 110];
const ROW_CHRISTINE_RELAIS = ['CHRISTINE', 'SNC CHRISTINE - RELAIS CHRISTINE', '387571789', 27, 0, 158, 0, 0, 158, 0, 0, 0, 158, 0, 19, 16, 1, 0, 44];
const ROW_CHRISTINE_SJ = ['CHRISTINE', 'SNC CHRISTINE - SAINT JAMES', '387571789', 7, 0, 296, 0, 0, 296, 1, 0, 0, 296, 0, 16, 10, 1, 0, 66];

// ─── Clients locaux (données réelles) ───

const CLIENTS = [
  { id: 109, nom: 'RELAIS CHRISTINE', siren: '387571789', code_silae: 'CHRISTINE', cabinet: 'Audit Up' },
  { id: 203, nom: 'SAINT JAMES', siren: '387571789', code_silae: null, cabinet: 'Audit Up' },
  { id: 204, nom: 'RELAIS CHRISTINE', siren: '387571789', code_silae: null, cabinet: 'Zerah Fiduciaire' },
  { id: 135, nom: 'SAINT JAMES', siren: '387571789', code_silae: null, cabinet: 'Zerah Fiduciaire' },
  { id: 112, nom: 'BK BAGNEUX', siren: '901059287', code_silae: 'BK BAGNEUX', cabinet: 'Audit Up' },
  { id: 50, nom: 'TERNI COMPTOIR', siren: '943100636', code_silae: null, cabinet: 'Audit Up' }
];

/**
 * Mock Supabase chaînable. `mappings` = contenu de silae_mapping.
 * Capture les upserts silae_productions dans `productionUpserts`.
 */
function mockSupabase(mappings = []) {
  const productionUpserts = [];
  const mappingUpserts = [];

  const supabase = {
    from(table) {
      const chain = {
        select: vi.fn(() => chain),
        order: vi.fn(() => Promise.resolve({ data: table === 'silae_mapping' ? mappings : [], error: null })),
        eq: vi.fn(() => chain),
        is: vi.fn(() => chain),
        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        insert: vi.fn(() => Promise.resolve({ error: null })),
        update: vi.fn(() => chain),
        upsert: vi.fn((payload) => {
          if (table === 'silae_productions') productionUpserts.push(payload);
          if (table === 'silae_mapping') mappingUpserts.push(payload);
          return Promise.resolve({ error: null });
        }),
        delete: vi.fn(() => chain)
      };
      return chain;
    }
  };

  return { supabase, productionUpserts, mappingUpserts };
}

// ════════════════════════════════════════════════════════════════
//  1. parseSilaeExcel — colonnes D (extras) et E (refaits)
// ════════════════════════════════════════════════════════════════

describe('parseSilaeExcel — Bulletins extra (col D) et Bulletins refaits (col E)', () => {
  it('extrait extras et bulletinsRefaits numériques', () => {
    const rows = parseSilaeExcel(buildSilaeFile([ROW_CHRISTINE_RELAIS, ROW_CHRISTINE_SJ]));
    const relais = rows.find(r => r.nom.includes('RELAIS'));
    const sj = rows.find(r => r.nom.includes('SAINT JAMES'));
    expect(relais.extras).toBe(27);
    expect(relais.bulletinsRefaits).toBe(0);
    expect(sj.extras).toBe(7);
  });

  it('tolère le format texte "6 extras" (col D)', () => {
    const rows = parseSilaeExcel(buildSilaeFile([ROW_TERNI]));
    expect(rows[0].extras).toBe(6);
  });

  it('extrait bulletinsRefaits (col E) et met 0 si vide', () => {
    const rows = parseSilaeExcel(buildSilaeFile([ROW_BK, ROW_ACF]));
    const bk = rows.find(r => r.code === 'BK BAGNEUX');
    const acf = rows.find(r => r.code === 'ACF CONSEI');
    expect(bk.bulletinsRefaits).toBe(1);
    expect(acf.bulletinsRefaits).toBe(0);
    expect(acf.extras).toBe(0);
  });

  it('conserve le parsing des colonnes existantes (non décalées)', () => {
    const rows = parseSilaeExcel(buildSilaeFile([ROW_BK]));
    const bk = rows[0];
    expect(bk.bulletins).toBe(38);
    expect(bk.coffreFort).toBe(37);
    expect(bk.editique).toBe(2);
    expect(bk.entrees).toBe(2);
    expect(bk.sorties).toBe(2);
  });
});

// ════════════════════════════════════════════════════════════════
//  2. excludeTotalRows — multi-établissements
// ════════════════════════════════════════════════════════════════

describe('excludeTotalRows — ligne de total SNC CHRISTINE ignorée', () => {
  it('parseSilaeExcel écarte la ligne de total et garde les 2 lignes détail', () => {
    const rows = parseSilaeExcel(buildSilaeFile([
      ROW_ACF, ROW_CHRISTINE_TOTAL, ROW_CHRISTINE_RELAIS, ROW_CHRISTINE_SJ, ROW_BK
    ]));
    const christine = rows.filter(r => r.code === 'CHRISTINE');
    expect(christine).toHaveLength(2);
    expect(christine.map(r => r.nom).sort()).toEqual([
      'SNC CHRISTINE - RELAIS CHRISTINE',
      'SNC CHRISTINE - SAINT JAMES'
    ]);
    // Les autres dossiers ne sont pas touchés
    expect(rows).toHaveLength(4);
  });

  it('ne touche pas aux codes présents une seule fois', () => {
    const rows = excludeTotalRows([
      { code: 'ACF', nom: 'ACF CONSEILS' },
      { code: 'BK', nom: 'BK BAGNEUX' }
    ]);
    expect(rows).toHaveLength(2);
  });

  it('garde tout si aucune ligne du groupe n\'est un préfixe des autres', () => {
    const rows = excludeTotalRows([
      { code: 'X', nom: 'HOTEL ALPHA' },
      { code: 'X', nom: 'HOTEL BETA' }
    ]);
    expect(rows).toHaveLength(2);
  });
});

// ════════════════════════════════════════════════════════════════
//  2c. Contrôle de cohérence total / détail → rejet du fichier
// ════════════════════════════════════════════════════════════════

describe('excludeTotalRows — rejet si incohérence total/détail', () => {
  it('rejette le fichier réel 06-2026 (coffre-fort 706 et éditique 2 absents du détail)', () => {
    expect(() => parseSilaeExcel(buildSilaeFile([
      ROW_CHRISTINE_TOTAL_INCOHERENT, ROW_CHRISTINE_RELAIS, ROW_CHRISTINE_SJ
    ]))).toThrow(/rejeté.*SNC CHRISTINE.*Coffre-fort : 706 \(total\) ≠ 0 \(somme détails\).*Éditique : 2 \(total\) ≠ 0/s);
  });

  it('rejette si les bulletins du total ≠ somme des détails', () => {
    const totalFaux = [...ROW_CHRISTINE_TOTAL];
    totalFaux[5] = 500; // total bulletins ≠ 158 + 296
    expect(() => parseSilaeExcel(buildSilaeFile([totalFaux, ROW_CHRISTINE_RELAIS, ROW_CHRISTINE_SJ])))
      .toThrow(/Bulletins : 500 \(total\) ≠ 454/);
  });

  it('ne contrôle pas un champ vide/0 sur le total (détail plus riche autorisé)', () => {
    // Bulletins extra : vide sur le total, 27 + 7 = 34 sur le détail → pas de rejet
    const rows = parseSilaeExcel(buildSilaeFile([ROW_CHRISTINE_TOTAL, ROW_CHRISTINE_RELAIS, ROW_CHRISTINE_SJ]));
    expect(rows.filter(r => r.code === 'CHRISTINE')).toHaveLength(2);
  });

  it('accepte un total parfaitement cohérent', () => {
    expect(() => parseSilaeExcel(buildSilaeFile([ROW_CHRISTINE_TOTAL, ROW_CHRISTINE_RELAIS, ROW_CHRISTINE_SJ])))
      .not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════
//  2b. aggregatePeriodRows — dossier éclaté par période de paie (MAZEL)
// ════════════════════════════════════════════════════════════════

// Lignes reproduisant le fichier réel 06-2026 : MAZEL sur 3 lignes de paie,
// SIREN uniquement sur la 1re, 1 bulletin refait sur la 2e
const ROW_MAZEL_1 = ['MAZEL', 'MAZEL', '494256894', '', '', 0, 0, 0, 0, 7, 0, 0, 0, 7, 0, 0, 0, 0, 0];
const ROW_MAZEL_2 = ['MAZEL', 'MAZEL', '', '', 1, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 0, 0];
const ROW_MAZEL_3 = ['MAZEL', 'MAZEL', '', '', '', 5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 0, 0];

describe('aggregatePeriodRows — même dossier sur plusieurs périodes de paie', () => {
  it('fusionne les lignes MAZEL en sommant les quantités et récupère le SIREN', () => {
    const rows = parseSilaeExcel(buildSilaeFile([ROW_MAZEL_1, ROW_MAZEL_2, ROW_MAZEL_3]));
    expect(rows).toHaveLength(1);
    const mazel = rows[0];
    expect(mazel.siren).toBe('494256894');
    expect(mazel.bulletins).toBe(7);          // 0 + 2 + 5
    expect(mazel.bulletinsRefaits).toBe(1);   // 0 + 1 + 0
  });

  it('ne fusionne pas les multi-établissements (noms différents)', () => {
    const rows = aggregatePeriodRows([
      { code: 'CHRISTINE', nom: 'SNC CHRISTINE - RELAIS CHRISTINE', siren: '387571789', extras: 27, bulletinsRefaits: 0, bulletins: 158, bulletinsTotal: 158, coffreFort: 0, editique: 0, entrees: 19, sorties: 16, declarations: 1, attestationsPE: 44 },
      { code: 'CHRISTINE', nom: 'SNC CHRISTINE - SAINT JAMES', siren: '387571789', extras: 7, bulletinsRefaits: 0, bulletins: 296, bulletinsTotal: 296, coffreFort: 0, editique: 0, entrees: 16, sorties: 10, declarations: 1, attestationsPE: 66 }
    ]);
    expect(rows).toHaveLength(2);
  });

  it('un dossier fusionné redevient mono-ligne → matching classique par SIREN', async () => {
    const clients = [...CLIENTS, { id: 77, nom: 'MAZEL', siren: '494256894', code_silae: null, cabinet: 'Audit Up' }];
    const { supabase, productionUpserts } = mockSupabase([]);
    const rows = parseSilaeExcel(buildSilaeFile([ROW_MAZEL_1, ROW_MAZEL_2, ROW_MAZEL_3]));

    const result = await importSilaeData(supabase, rows, '2026-06', clients);

    expect(result.unmatched).toHaveLength(0);
    expect(result.matched).toHaveLength(1);
    expect(productionUpserts).toHaveLength(1);
    expect(productionUpserts[0].client_id).toBe(77);
    expect(productionUpserts[0].bulletins).toBe(7);
    expect(productionUpserts[0].bulletins_refaits).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════
//  3. importSilaeData — routage multi-établissements + nouvelles colonnes
// ════════════════════════════════════════════════════════════════

describe('importSilaeData — SNC CHRISTINE routage par établissement', () => {
  const MAPPINGS = [
    { code_silae: 'CHRISTINE', client_id: 109, nom_silae: 'SNC CHRISTINE', siren: '387571789' },
    { code_silae: 'CHRISTINE', client_id: 203, nom_silae: 'SNC CHRISTINE - SAINT JAMES', siren: '387571789' }
  ];

  it('route chaque ligne détail vers le client mappé dont le nom correspond', async () => {
    const { supabase, productionUpserts } = mockSupabase(MAPPINGS);
    const rows = parseSilaeExcel(buildSilaeFile([ROW_CHRISTINE_TOTAL, ROW_CHRISTINE_RELAIS, ROW_CHRISTINE_SJ]));

    const result = await importSilaeData(supabase, rows, '2026-06', CLIENTS);

    expect(result.unmatched).toHaveLength(0);
    expect(result.matched).toHaveLength(2);

    const relais = productionUpserts.find(p => p.client_id === 109);
    const sj = productionUpserts.find(p => p.client_id === 203);
    expect(relais).toBeDefined();
    expect(sj).toBeDefined();
    // Chaque établissement reçoit SES quantités, pas celles du total
    expect(relais.bulletins).toBe(158);
    expect(relais.extras).toBe(27);
    expect(relais.entrees).toBe(19);
    expect(sj.bulletins).toBe(296);
    expect(sj.extras).toBe(7);
    expect(sj.entrees).toBe(16);
    // La ligne de total (454 bulletins) n'est importée nulle part
    expect(productionUpserts.some(p => p.bulletins === 454)).toBe(false);
  });

  it('ligne détail sans client mappé correspondant → unmatched (pas de fallback code/nom)', async () => {
    // Mapping incomplet : seul RELAIS CHRISTINE (109) est mappé
    const { supabase, productionUpserts } = mockSupabase([MAPPINGS[0]]);
    const rows = parseSilaeExcel(buildSilaeFile([ROW_CHRISTINE_TOTAL, ROW_CHRISTINE_RELAIS, ROW_CHRISTINE_SJ]));

    const result = await importSilaeData(supabase, rows, '2026-06', CLIENTS);

    // RELAIS matché, SAINT JAMES non matché (2 clients "SAINT JAMES" partagent le SIREN → ambigu)
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].client_id).toBe(109);
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0].nom).toBe('SNC CHRISTINE - SAINT JAMES');
    // Surtout PAS de fallback vers le client 109 (code_silae=CHRISTINE) pour la ligne SAINT JAMES
    expect(productionUpserts.filter(p => p.client_id === 109)).toHaveLength(1);
  });

  it('SIREN partagé + nom unique → match direct sans mapping', async () => {
    // Un seul client porte le nom de l'établissement pour ce SIREN
    const clients = [
      { id: 109, nom: 'RELAIS CHRISTINE', siren: '387571789', code_silae: 'CHRISTINE', cabinet: 'Audit Up' },
      { id: 203, nom: 'SAINT JAMES', siren: '387571789', code_silae: null, cabinet: 'Audit Up' }
    ];
    const { supabase } = mockSupabase([]);
    const rows = parseSilaeExcel(buildSilaeFile([ROW_CHRISTINE_TOTAL, ROW_CHRISTINE_RELAIS, ROW_CHRISTINE_SJ]));

    const result = await importSilaeData(supabase, rows, '2026-06', clients);

    expect(result.unmatched).toHaveLength(0);
    const ids = result.matched.map(m => m.client_id).sort();
    expect(ids).toEqual([109, 203]);
  });
});

describe('importSilaeData — colonnes extras et bulletins_refaits importées', () => {
  it('upsert silae_productions inclut extras et bulletins_refaits du fichier', async () => {
    const { supabase, productionUpserts } = mockSupabase([]);
    const rows = parseSilaeExcel(buildSilaeFile([ROW_TERNI, ROW_BK]));

    await importSilaeData(supabase, rows, '2026-06', CLIENTS);

    const terni = productionUpserts.find(p => p.client_id === 50);
    const bk = productionUpserts.find(p => p.client_id === 112);
    expect(terni.extras).toBe(6);            // "6 extras" texte
    expect(terni.bulletins_refaits).toBe(0);
    expect(bk.extras).toBe(0);
    expect(bk.bulletins_refaits).toBe(1);
  });

  it('comportement 1→N conservé pour un code mono-ligne mappé sur plusieurs clients', async () => {
    const { supabase, productionUpserts } = mockSupabase([
      { code_silae: 'BK BAGNEUX', client_id: 112, nom_silae: 'BK BAGNEUX', siren: '901059287' },
      { code_silae: 'BK BAGNEUX', client_id: 50, nom_silae: 'BK BAGNEUX', siren: '901059287' }
    ]);
    const rows = parseSilaeExcel(buildSilaeFile([ROW_BK]));

    const result = await importSilaeData(supabase, rows, '2026-06', CLIENTS);

    // Une seule ligne fichier, dupliquée sur les 2 clients mappés (comportement historique)
    expect(result.matched).toHaveLength(2);
    expect(productionUpserts.map(p => p.client_id).sort((a, b) => a - b)).toEqual([50, 112]);
  });
});
