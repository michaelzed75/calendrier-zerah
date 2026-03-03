// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx-js-style';

/**
 * Tests unitaires — Import/Export tarifs variables
 *
 * Couvre :
 *   1. parseTarifsVariableExcel — parse du fichier Excel édité
 *   2. exportTarifsVariableExcel — génération du fichier Excel (mock Supabase)
 *   3. importTarifsVariableData — upsert tarifs dans tarifs_reference (mock Supabase)
 */

// ════════════════════════════════════════════════════════════════
//  Mock xlsx-js-style (call-through pour que buildExcelBuffer fonctionne)
// ════════════════════════════════════════════════════════════════

vi.mock('xlsx-js-style', async () => {
  const actual = await vi.importActual('xlsx-js-style');
  const mod = actual.default || actual;
  const realWrite = mod.write.bind(mod);
  const mockWrite = vi.fn((...args) => realWrite(...args));
  return {
    default: { ...mod, write: mockWrite },
    ...mod,
    write: mockWrite
  };
});

// Mock DOM pour le pattern Blob download (jsdom fournit document mais pas URL.createObjectURL)
const _downloadedFiles = [];
const _origCreateElement = document.createElement.bind(document);
document.createElement = vi.fn(function(tag) {
  if (tag === 'a') {
    const a = _origCreateElement.call(document, 'a');
    a.click = function() { _downloadedFiles.push(a.download); };
    return a;
  }
  return _origCreateElement.call(document, tag);
});
if (!URL.createObjectURL) URL.createObjectURL = vi.fn(() => 'blob:mock');
if (!URL.revokeObjectURL) URL.revokeObjectURL = vi.fn();

import {
  TARIF_COLUMNS,
  parseTarifsVariableExcel,
  exportTarifsVariableExcel,
  previewTarifsVariableImport,
  importTarifsVariableData
} from './tarifsVariableExcelService.js';

// ════════════════════════════════════════════════════════════════
//  Helpers
// ════════════════════════════════════════════════════════════════

const HEADERS = ['Client', 'Type', 'SIREN/SIRET', 'Cabinet', ...TARIF_COLUMNS.map(c => c.header)];

function buildExcelBuffer(rows) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Tarifs variables');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

/** Crée un mock Supabase avec des réponses configurables */
function mockSupabase(overrides = {}) {
  const defaultClients = [
    { id: 1, nom: 'CLIENT A', cabinet: 'Audit Up', siren: '111111111', siret_complement: null },
    { id: 2, nom: 'CLIENT B', cabinet: 'Zerah Fiduciaire', siren: '222222222', siret_complement: '00024' },
    { id: 3, nom: 'CLIENT F', cabinet: 'Audit Up', siren: '333333333', siret_complement: null },
  ];

  const defaultTarifs = [
    { client_id: 1, label: 'Etablissement du bulletin de salaire', axe: 'social_bulletin', pu_ht: 15.80, produit_pennylane_id: 101 },
    { client_id: 1, label: 'Dépôt coffre-fort numérique', axe: 'accessoires_social', pu_ht: 1.00, produit_pennylane_id: 102 },
  ];

  const defaultProduits = [
    { id: 101, cabinet: 'Audit Up', label_normalise: 'bulletin_salaire' },
    { id: 102, cabinet: 'Audit Up', label_normalise: 'coffre_fort' },
    { id: 103, cabinet: 'Audit Up', label_normalise: 'publipostage' },
    { id: 104, cabinet: 'Audit Up', label_normalise: 'entree_salarie' },
    { id: 105, cabinet: 'Audit Up', label_normalise: 'sortie_salarie' },
    { id: 106, cabinet: 'Audit Up', label_normalise: 'modification_bulletin' },
    { id: 201, cabinet: 'Zerah Fiduciaire', label_normalise: 'bulletin_salaire' },
    { id: 202, cabinet: 'Zerah Fiduciaire', label_normalise: 'coffre_fort' },
  ];

  const clients = overrides.clients ?? defaultClients;
  const tarifs = overrides.tarifs ?? defaultTarifs;
  const produits = overrides.produits ?? defaultProduits;
  const upsertResults = overrides.upsertResults ?? [];
  let upsertCallIndex = 0;
  const upsertCalls = [];
  const historiqueCalls = [];

  function createChain(data, error = null) {
    const chain = {
      _data: data,
      _error: error,
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      then: undefined,
    };
    // Make it thenable so await works
    Object.defineProperty(chain, 'then', {
      value: function(resolve) {
        return Promise.resolve({ data: chain._data, error: chain._error }).then(resolve);
      }
    });
    return chain;
  }

  const supabase = {
    from: vi.fn((table) => {
      if (table === 'clients') return createChain(clients);
      if (table === 'tarifs_reference') {
        const chain = createChain(tarifs);
        chain.upsert = vi.fn((data) => {
          upsertCalls.push(data);
          const result = upsertResults[upsertCallIndex++];
          return Promise.resolve({ error: result?.error || null });
        });
        return chain;
      }
      if (table === 'produits_pennylane') return createChain(produits);
      if (table === 'historique_prix') {
        return {
          insert: vi.fn((data) => {
            historiqueCalls.push(data);
            return Promise.resolve({ error: null });
          }),
        };
      }
      return createChain([]);
    }),
    _upsertCalls: upsertCalls,
    _historiqueCalls: historiqueCalls,
  };

  return supabase;
}

// ════════════════════════════════════════════════════════════════
//  1. PARSE — parseTarifsVariableExcel
// ════════════════════════════════════════════════════════════════

describe('parseTarifsVariableExcel', () => {
  it('devrait parser 1 client R avec tous les prix', () => {
    const rows = [
      HEADERS,
      ['CLIENT A', 'R', '111111111', 'AUP', 15.80, 1.00, 2.65, 15.80, 31.55, 15.80]
    ];
    const result = parseTarifsVariableExcel(buildExcelBuffer(rows));
    expect(result).toHaveLength(1);
    expect(result[0].client).toBe('CLIENT A');
    expect(result[0].type).toBe('R');
    expect(result[0].siren).toBe('111111111');
    expect(result[0].cabinet).toBe('AUP');
    expect(result[0].bulletin_salaire).toBe(15.80);
    expect(result[0].coffre_fort).toBe(1.00);
    expect(result[0].publipostage).toBe(2.65);
    expect(result[0].entree_salarie).toBe(15.80);
    expect(result[0].sortie_salarie).toBe(31.55);
    expect(result[0].modification_bulletin).toBe(15.80);
  });

  it('devrait parser 1 client F avec seulement coffre-fort rempli', () => {
    const rows = [
      HEADERS,
      ['CLIENT F', 'F', '333333333', 'AUP', '', 1.00, '', '', '', '']
    ];
    const result = parseTarifsVariableExcel(buildExcelBuffer(rows));
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('F');
    expect(result[0].coffre_fort).toBe(1.00);
    expect(result[0].bulletin_salaire).toBeNull();
    expect(result[0].publipostage).toBeNull();
  });

  it('devrait ignorer les lignes où tous les prix sont vides', () => {
    const rows = [
      HEADERS,
      ['CLIENT A', 'R', '111111111', 'AUP', 15.80, 1.00, 2.65, 15.80, 31.55, 15.80],
      ['CLIENT VIDE', 'F', '444444444', 'AUP', '', '', '', '', '', '']
    ];
    const result = parseTarifsVariableExcel(buildExcelBuffer(rows));
    expect(result).toHaveLength(1);
    expect(result[0].client).toBe('CLIENT A');
  });

  it('devrait extraire R/F et SIREN correctement', () => {
    const rows = [
      HEADERS,
      ['TEST', 'R', '901059287', 'AUP', 10, '', '', '', '', ''],
      ['TEST2', 'F', '123456789', 'ZF', '', 1.5, '', '', '', '']
    ];
    const result = parseTarifsVariableExcel(buildExcelBuffer(rows));
    expect(result[0].type).toBe('R');
    expect(result[0].siren).toBe('901059287');
    expect(result[1].type).toBe('F');
    expect(result[1].siren).toBe('123456789');
  });

  it('devrait gérer un SIRET 14 chiffres', () => {
    const rows = [
      HEADERS,
      ['MULTI ETAB', 'R', '34971975800024', 'ZF', 21, '', '', '', '', '']
    ];
    const result = parseTarifsVariableExcel(buildExcelBuffer(rows));
    expect(result).toHaveLength(1);
    expect(result[0].siren).toBe('34971975800024');
  });

  it('devrait retourner [] pour un fichier vide', () => {
    const rows = [HEADERS];
    const result = parseTarifsVariableExcel(buildExcelBuffer(rows));
    expect(result).toEqual([]);
  });

  it('devrait parser un mix R et F', () => {
    const rows = [
      HEADERS,
      ['A REEL', 'R', '111111111', 'AUP', 15, 1, 2, 15, 30, 15],
      ['B FORFAIT', 'F', '222222222', 'ZF', '', 1.5, 2.0, '', '', ''],
      ['C REEL', 'R', '333333333', 'AUP', 20, '', '', '', '', '']
    ];
    const result = parseTarifsVariableExcel(buildExcelBuffer(rows));
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe('R');
    expect(result[1].type).toBe('F');
    expect(result[2].type).toBe('R');
  });
});

// ════════════════════════════════════════════════════════════════
//  2. EXPORT — exportTarifsVariableExcel
// ════════════════════════════════════════════════════════════════

describe('exportTarifsVariableExcel', () => {
  beforeEach(() => {
    _downloadedFiles.length = 0;
    vi.mocked(XLSX.write).mockClear();
  });

  it('devrait générer un fichier avec les bons headers', async () => {
    const supabase = mockSupabase();
    await exportTarifsVariableExcel({ supabase, dateEffet: '2026-01-01' });

    expect(XLSX.write).toHaveBeenCalled();
    const call = vi.mocked(XLSX.write).mock.calls[0];
    const wb = call[0];
    const ws = wb.Sheets['Tarifs variables'];
    // Vérifier headers (row 0)
    expect(ws['A1'].v).toBe('Client');
    expect(ws['B1'].v).toBe('Type');
    expect(ws['C1'].v).toBe('SIREN/SIRET');
    expect(ws['D1'].v).toBe('Cabinet');
    expect(ws['E1'].v).toBe('Bulletin de salaire');
    expect(ws['F1'].v).toBe('Coffre-fort');
  });

  it('devrait pré-remplir les prix pour les clients R', async () => {
    const supabase = mockSupabase();
    await exportTarifsVariableExcel({ supabase, dateEffet: '2026-01-01' });

    const wb = vi.mocked(XLSX.write).mock.calls[0][0];
    const ws = wb.Sheets['Tarifs variables'];

    // CLIENT A est R (a des tarifs) — chercher sa ligne
    // Les clients R sont triés en premier alphabétiquement
    expect(ws['A2'].v).toBe('CLIENT A');
    expect(ws['B2'].v).toBe('R');
    expect(ws['C2'].v).toBe('111111111');
    expect(ws['E2'].v).toBe(15.80); // bulletin_salaire
    expect(ws['F2'].v).toBe(1.00);  // coffre_fort
  });

  it('devrait laisser les cellules vides pour les clients F', async () => {
    const supabase = mockSupabase();
    await exportTarifsVariableExcel({ supabase, dateEffet: '2026-01-01' });

    const wb = vi.mocked(XLSX.write).mock.calls[0][0];
    const ws = wb.Sheets['Tarifs variables'];

    // CLIENT B et CLIENT F sont F (pas de tarifs variables)
    // Ils apparaissent après CLIENT A (R), triés par nom
    expect(ws['A3'].v).toBe('CLIENT B');
    expect(ws['B3'].v).toBe('F');
    // Prix vides — pas de cellule
    expect(ws['E3']).toBeUndefined();
  });

  it('devrait séparer R/F et SIREN dans des colonnes distinctes', async () => {
    const supabase = mockSupabase();
    await exportTarifsVariableExcel({ supabase, dateEffet: '2026-01-01' });

    const wb = vi.mocked(XLSX.write).mock.calls[0][0];
    const ws = wb.Sheets['Tarifs variables'];

    // CLIENT A (R) : type en B, SIREN en C
    expect(ws['B2'].v).toBe('R');
    expect(ws['C2'].v).toBe('111111111');
    // CLIENT B (F) : type en B, SIREN en C
    expect(ws['B3'].v).toBe('F');
  });

  it('devrait remplir les prix même sans produit_pennylane_id (fallback axe+label)', async () => {
    const supabase = mockSupabase({
      tarifs: [
        { client_id: 1, label: 'Etablissement du bulletin de salaire', axe: 'social_bulletin', pu_ht: 15.80, produit_pennylane_id: null },
        { client_id: 1, label: 'Dépôt coffre-fort numérique', axe: 'accessoires_social', pu_ht: 1.00, produit_pennylane_id: null },
        { client_id: 1, label: 'Enregistrement de sortie de salariés', axe: 'accessoires_social', pu_ht: 31.55, produit_pennylane_id: null },
      ],
    });
    await exportTarifsVariableExcel({ supabase, dateEffet: '2026-01-01' });

    const wb = vi.mocked(XLSX.write).mock.calls[0][0];
    const ws = wb.Sheets['Tarifs variables'];

    expect(ws['A2'].v).toBe('CLIENT A');
    expect(ws['B2'].v).toBe('R');
    expect(ws['E2'].v).toBe(15.80); // bulletin via axe social_bulletin
    expect(ws['F2'].v).toBe(1.00);  // coffre via label "coffre"
    expect(ws['I2'].v).toBe(31.55); // sortie via label "sortie"
  });

  it('devrait classer F un client avec seulement des accessoires (sans bulletin)', async () => {
    const supabase = mockSupabase({
      tarifs: [
        // Client 1 : seulement coffre-fort (accessoires_social), PAS de social_bulletin
        { client_id: 1, label: 'Dépôt coffre-fort numérique', axe: 'accessoires_social', pu_ht: 1.00, produit_pennylane_id: 102 },
      ],
    });
    await exportTarifsVariableExcel({ supabase, dateEffet: '2026-01-01' });

    const wb = vi.mocked(XLSX.write).mock.calls[0][0];
    const ws = wb.Sheets['Tarifs variables'];

    // CLIENT A devrait être F (pas de social_bulletin), pas R
    // Tous les clients sont F → triés alphabétiquement
    expect(ws['A2'].v).toBe('CLIENT A');
    expect(ws['B2'].v).toBe('F');
    // Mais le coffre-fort doit quand même être rempli
    expect(ws['F2'].v).toBe(1.00);
  });

  it('devrait utiliser le SIRET quand siret_complement existe', async () => {
    const supabase = mockSupabase();
    await exportTarifsVariableExcel({ supabase, dateEffet: '2026-01-01' });

    const wb = vi.mocked(XLSX.write).mock.calls[0][0];
    const ws = wb.Sheets['Tarifs variables'];

    // CLIENT B a siret_complement='00024' → SIRET = 22222222200024
    expect(ws['C3'].v).toBe('22222222200024');
  });
});

// ════════════════════════════════════════════════════════════════
//  3. IMPORT — importTarifsVariableData
// ════════════════════════════════════════════════════════════════

describe('importTarifsVariableData', () => {
  const clients = [
    { id: 1, nom: 'CLIENT A', siren: '111111111', cabinet: 'Audit Up', siret_complement: null },
    { id: 2, nom: 'CLIENT B', siren: '222222222', cabinet: 'Zerah Fiduciaire', siret_complement: '00024' },
  ];

  it('devrait faire un upsert pour un client R existant', async () => {
    const supabase = mockSupabase({
      tarifs: [
        { client_id: 1, label: 'Etablissement du bulletin de salaire', axe: 'social_bulletin', pu_ht: 15.80, produit_pennylane_id: 101 },
      ],
    });

    const rows = [{
      client: 'CLIENT A', type: 'R', siren: '111111111', cabinet: 'AUP',
      bulletin_salaire: 16.00, coffre_fort: null, publipostage: null,
      entree_salarie: null, sortie_salarie: null, modification_bulletin: null,
    }];

    const result = await importTarifsVariableData({ supabase, rows, dateEffet: '2026-01-01', clients });

    expect(result.errors).toHaveLength(0);
    // Seul bulletin est upserted (les null sont ignorés car pas de tarif existant)
    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);
    expect(supabase._upsertCalls).toHaveLength(1);
    expect(supabase._upsertCalls[0].pu_ht).toBe(16.00);
    expect(supabase._upsertCalls[0].client_id).toBe(1);
    // Historique tracé (prix changé : 15.80 → 16.00)
    expect(result.historique).toBe(1);
    expect(supabase._historiqueCalls[0].ancien_montant_ht).toBe(15.80);
    expect(supabase._historiqueCalls[0].nouveau_montant_ht).toBe(16.00);
    expect(supabase._historiqueCalls[0].label).toContain('Bulletin');
  });

  it('devrait créer des tarifs pour un client F et tracer dans historique', async () => {
    const supabase = mockSupabase({ tarifs: [] });

    const rows = [{
      client: 'CLIENT A', type: 'F', siren: '111111111', cabinet: 'AUP',
      bulletin_salaire: null, coffre_fort: 1.00, publipostage: 2.00,
      entree_salarie: null, sortie_salarie: null, modification_bulletin: null,
    }];

    const result = await importTarifsVariableData({ supabase, rows, dateEffet: '2026-01-01', clients });

    expect(result.created).toBe(2); // coffre_fort + publipostage (null = ignoré)
    expect(supabase._upsertCalls).toHaveLength(2);
    // Historique tracé pour les 2 créations
    expect(result.historique).toBe(2);
    expect(supabase._historiqueCalls).toHaveLength(2);
    expect(supabase._historiqueCalls[0].ancien_montant_ht).toBeNull();
    expect(supabase._historiqueCalls[0].nouveau_montant_ht).toBe(1.00);
  });

  it('ne devrait PAS tracer dans historique si le prix est inchangé', async () => {
    const supabase = mockSupabase({
      tarifs: [
        { client_id: 1, label: 'Etablissement du bulletin de salaire', axe: 'social_bulletin', pu_ht: 15.80, produit_pennylane_id: 101 },
      ],
    });

    const rows = [{
      client: 'CLIENT A', type: 'R', siren: '111111111', cabinet: 'AUP',
      bulletin_salaire: 15.80, coffre_fort: null, publipostage: null,
      entree_salarie: null, sortie_salarie: null, modification_bulletin: null,
    }];

    const result = await importTarifsVariableData({ supabase, rows, dateEffet: '2026-01-01', clients });

    expect(result.updated).toBe(1); // bulletin inchangé
    expect(result.created).toBe(0); // null = ignoré (pas de tarif existant)
    // Pas d'historique car prix identique
    expect(result.historique).toBe(0);
    expect(supabase._historiqueCalls).toHaveLength(0);
  });

  it('devrait écraser à 0 si cellule vide et tarif existant', async () => {
    const supabase = mockSupabase({
      tarifs: [
        { client_id: 1, label: 'Etablissement du bulletin de salaire', axe: 'social_bulletin', pu_ht: 15.80, produit_pennylane_id: 101 },
        { client_id: 1, label: 'Dépôt coffre-fort numérique', axe: 'accessoires_social', pu_ht: 1.00, produit_pennylane_id: 102 },
      ],
    });

    const rows = [{
      client: 'CLIENT A', type: 'R', siren: '111111111', cabinet: 'AUP',
      bulletin_salaire: 15.80, coffre_fort: null, publipostage: null,
      entree_salarie: null, sortie_salarie: null, modification_bulletin: null,
    }];

    const result = await importTarifsVariableData({ supabase, rows, dateEffet: '2026-01-01', clients });

    // bulletin inchangé (15.80), coffre_fort écrasé à 0 (existait à 1.00)
    expect(result.updated).toBe(2);
    expect(supabase._upsertCalls).toHaveLength(2);
    expect(supabase._upsertCalls[1].pu_ht).toBe(0);
    // Historique : coffre-fort changé 1.00 → 0
    expect(result.historique).toBe(1);
    expect(supabase._historiqueCalls[0].ancien_montant_ht).toBe(1.00);
    expect(supabase._historiqueCalls[0].nouveau_montant_ht).toBe(0);
  });

  it('devrait reporter les clients non matchés', async () => {
    const supabase = mockSupabase({ tarifs: [] });

    const rows = [{
      client: 'INCONNU', type: 'R', siren: '999999999', cabinet: 'AUP',
      bulletin_salaire: 10, coffre_fort: null, publipostage: null,
      entree_salarie: null, sortie_salarie: null, modification_bulletin: null,
    }];

    const result = await importTarifsVariableData({ supabase, rows, dateEffet: '2026-01-01', clients });

    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0]).toContain('INCONNU');
    expect(supabase._upsertCalls).toHaveLength(0);
  });

  it('devrait distinguer le même SIRET dans deux cabinets différents', async () => {
    // Cas Relais Christine : même SIRET 38757178900016 en AUP (id:109) et ZF (id:204)
    const multiCabClients = [
      { id: 109, nom: 'RELAIS CHRISTINE', siren: '387571789', cabinet: 'Audit Up', siret_complement: '00016' },
      { id: 204, nom: 'RELAIS CHRISTINE', siren: '387571789', cabinet: 'Zerah Fiduciaire', siret_complement: '00016' },
    ];

    const supabase = mockSupabase({
      clients: multiCabClients,
      tarifs: [
        { client_id: 109, label: 'Etablissement du bulletin de salaire', axe: 'social_bulletin', pu_ht: 21, produit_pennylane_id: 101 },
        { client_id: 204, label: 'Etablissement du bulletin de salaire', axe: 'social_bulletin', pu_ht: 21, produit_pennylane_id: null },
      ],
    });

    const rows = [
      // AUP : prix à 22 (hausse)
      {
        client: 'RELAIS CHRISTINE', type: 'R', siren: '38757178900016', cabinet: 'AUP',
        bulletin_salaire: 22, coffre_fort: null, publipostage: null,
        entree_salarie: null, sortie_salarie: null, modification_bulletin: null,
      },
      // ZF : prix à 0 (pas de social ZF)
      {
        client: 'RELAIS CHRISTINE', type: 'R', siren: '38757178900016', cabinet: 'ZF',
        bulletin_salaire: 0, coffre_fort: null, publipostage: null,
        entree_salarie: null, sortie_salarie: null, modification_bulletin: null,
      },
    ];

    const result = await importTarifsVariableData({ supabase, rows, dateEffet: '2026-01-01', clients: multiCabClients });

    expect(result.errors).toHaveLength(0);
    expect(result.unmatched).toHaveLength(0);
    // 2 upserts : AUP→22, ZF→0
    expect(supabase._upsertCalls).toHaveLength(2);
    expect(supabase._upsertCalls[0].client_id).toBe(109);
    expect(supabase._upsertCalls[0].pu_ht).toBe(22);
    expect(supabase._upsertCalls[1].client_id).toBe(204);
    expect(supabase._upsertCalls[1].pu_ht).toBe(0);
  });

  it('devrait utiliser le bon axe par colonne', async () => {
    const supabase = mockSupabase({ tarifs: [] });

    const rows = [{
      client: 'CLIENT A', type: 'R', siren: '111111111', cabinet: 'AUP',
      bulletin_salaire: 15, coffre_fort: 1, publipostage: null,
      entree_salarie: null, sortie_salarie: null, modification_bulletin: null,
    }];

    const result = await importTarifsVariableData({ supabase, rows, dateEffet: '2026-01-01', clients });

    expect(supabase._upsertCalls).toHaveLength(2);
    // bulletin_salaire → axe social_bulletin
    expect(supabase._upsertCalls[0].axe).toBe('social_bulletin');
    // coffre_fort → axe accessoires_social
    expect(supabase._upsertCalls[1].axe).toBe('accessoires_social');
  });
});

// ════════════════════════════════════════════════════════════════
//  4. PREVIEW — previewTarifsVariableImport
// ════════════════════════════════════════════════════════════════

describe('previewTarifsVariableImport', () => {
  const clients = [
    { id: 1, nom: 'CLIENT A', siren: '111111111', cabinet: 'Audit Up', siret_complement: null },
    { id: 2, nom: 'CLIENT B', siren: '222222222', cabinet: 'Zerah Fiduciaire', siret_complement: '00024' },
  ];

  it('devrait détecter une modification de prix', async () => {
    const supabase = mockSupabase({
      tarifs: [
        { client_id: 1, label: 'Etablissement du bulletin de salaire', axe: 'social_bulletin', pu_ht: 15.80, produit_pennylane_id: 101 },
      ],
    });

    const rows = [{
      client: 'CLIENT A', type: 'R', siren: '111111111', cabinet: 'AUP',
      bulletin_salaire: 16.00, coffre_fort: null, publipostage: null,
      entree_salarie: null, sortie_salarie: null, modification_bulletin: null,
    }];

    const result = await previewTarifsVariableImport({ supabase, rows, dateEffet: '2026-01-01', clients });

    // 1 modification (bulletin 15.80→16.00), null ignorés car pas de tarif existant
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].type).toBe('modification');
    expect(result.changes[0].ancienPrix).toBe(15.80);
    expect(result.changes[0].nouveauPrix).toBe(16.00);
    expect(result.changes[0].colonne).toBe('Bulletin de salaire');
    expect(result.changes[0].cabinet).toBe('AUP');
  });

  it('devrait détecter une création', async () => {
    const supabase = mockSupabase({ tarifs: [] });

    const rows = [{
      client: 'CLIENT A', type: 'F', siren: '111111111', cabinet: 'AUP',
      bulletin_salaire: null, coffre_fort: 1.00, publipostage: null,
      entree_salarie: null, sortie_salarie: null, modification_bulletin: null,
    }];

    const result = await previewTarifsVariableImport({ supabase, rows, dateEffet: '2026-01-01', clients });

    // 1 création (coffre-fort), null ignorés car pas de tarif existant
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].type).toBe('creation');
    expect(result.changes[0].nouveauPrix).toBe(1.00);
    expect(result.changes[0].colonne).toBe('Coffre-fort');
    expect(result.changes[0].cabinet).toBe('AUP');
  });

  it('ne devrait PAS lister les prix inchangés', async () => {
    const supabase = mockSupabase({
      tarifs: [
        { client_id: 1, label: 'Etablissement du bulletin de salaire', axe: 'social_bulletin', pu_ht: 15.80, produit_pennylane_id: 101 },
      ],
    });

    const rows = [{
      client: 'CLIENT A', type: 'R', siren: '111111111', cabinet: 'AUP',
      bulletin_salaire: 15.80, coffre_fort: null, publipostage: null,
      entree_salarie: null, sortie_salarie: null, modification_bulletin: null,
    }];

    const result = await previewTarifsVariableImport({ supabase, rows, dateEffet: '2026-01-01', clients });

    // bulletin inchangé, null ignorés (pas de tarif existant)
    expect(result.changes).toHaveLength(0);
  });

  it('devrait écraser à 0 si cellule vide et tarif existant', async () => {
    const supabase = mockSupabase({
      tarifs: [
        { client_id: 1, label: 'Etablissement du bulletin de salaire', axe: 'social_bulletin', pu_ht: 15.80, produit_pennylane_id: 101 },
        { client_id: 1, label: 'Dépôt coffre-fort numérique', axe: 'accessoires_social', pu_ht: 1.00, produit_pennylane_id: 102 },
      ],
    });

    const rows = [{
      client: 'CLIENT A', type: 'R', siren: '111111111', cabinet: 'AUP',
      bulletin_salaire: 15.80, coffre_fort: null, publipostage: null,
      entree_salarie: null, sortie_salarie: null, modification_bulletin: null,
    }];

    const result = await previewTarifsVariableImport({ supabase, rows, dateEffet: '2026-01-01', clients });

    // bulletin inchangé, coffre_fort existant (1.00) → écrasé à 0
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].type).toBe('modification');
    expect(result.changes[0].colonne).toBe('Coffre-fort');
    expect(result.changes[0].ancienPrix).toBe(1.00);
    expect(result.changes[0].nouveauPrix).toBe(0);
  });

  it('devrait reporter les clients non matchés', async () => {
    const supabase = mockSupabase({ tarifs: [] });

    const rows = [{
      client: 'INCONNU', type: 'R', siren: '999999999', cabinet: 'AUP',
      bulletin_salaire: 10, coffre_fort: null, publipostage: null,
      entree_salarie: null, sortie_salarie: null, modification_bulletin: null,
    }];

    const result = await previewTarifsVariableImport({ supabase, rows, dateEffet: '2026-01-01', clients });

    expect(result.changes).toHaveLength(0);
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0]).toContain('INCONNU');
  });

  it('devrait distinguer le même SIRET dans deux cabinets pour le preview', async () => {
    const multiCabClients = [
      { id: 109, nom: 'RELAIS CHRISTINE', siren: '387571789', cabinet: 'Audit Up', siret_complement: '00016' },
      { id: 204, nom: 'RELAIS CHRISTINE', siren: '387571789', cabinet: 'Zerah Fiduciaire', siret_complement: '00016' },
    ];

    const supabase = mockSupabase({
      clients: multiCabClients,
      tarifs: [
        { client_id: 109, label: 'Etablissement du bulletin de salaire', axe: 'social_bulletin', pu_ht: 21, produit_pennylane_id: 101 },
        { client_id: 204, label: 'Etablissement du bulletin de salaire', axe: 'social_bulletin', pu_ht: 21, produit_pennylane_id: null },
      ],
    });

    const rows = [
      {
        client: 'RELAIS CHRISTINE', type: 'R', siren: '38757178900016', cabinet: 'AUP',
        bulletin_salaire: 22, coffre_fort: null, publipostage: null,
        entree_salarie: null, sortie_salarie: null, modification_bulletin: null,
      },
      {
        client: 'RELAIS CHRISTINE', type: 'R', siren: '38757178900016', cabinet: 'ZF',
        bulletin_salaire: 0, coffre_fort: null, publipostage: null,
        entree_salarie: null, sortie_salarie: null, modification_bulletin: null,
      },
    ];

    const result = await previewTarifsVariableImport({ supabase, rows, dateEffet: '2026-01-01', clients: multiCabClients });

    // AUP : modification 21→22, ZF : modification 21→0
    expect(result.changes).toHaveLength(2);
    expect(result.changes[0].cabinet).toBe('AUP');
    expect(result.changes[0].ancienPrix).toBe(21);
    expect(result.changes[0].nouveauPrix).toBe(22);
    expect(result.changes[1].cabinet).toBe('ZF');
    expect(result.changes[1].ancienPrix).toBe(21);
    expect(result.changes[1].nouveauPrix).toBe(0);
  });
});
