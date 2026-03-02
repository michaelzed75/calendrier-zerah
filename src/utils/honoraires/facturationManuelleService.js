// @ts-check

/**
 * @file Service import/export Excel pour la saisie manuelle
 *
 * - exportModeleManuel() : génère un template Excel pré-rempli (clients actifs, SIREN, R/F)
 * - parseManuelExcel()   : parse le fichier Excel rempli par l'utilisateur
 * - importManuelData()   : injecte les données parsées dans silae_productions
 */

import * as XLSX from 'xlsx-js-style';
import { sauverDonneesManuelles } from './facturationVariableService.js';

// ═══════════════════════════ Helpers ═══════════════════════════

const MOIS_FR = [
  '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

/** @param {string} periode - 'YYYY-MM' */
function formaterPeriodeFr(periode) {
  const [annee, mois] = periode.split('-').map(Number);
  return `${MOIS_FR[mois]} ${String(annee).slice(-2)}`;
}

// ═══════════════════════════ Export modèle ═══════════════════════════

/**
 * Génère et télécharge un fichier Excel modèle pour la saisie manuelle.
 *
 * Colonnes : Type | Client | SIREN | Cabinet | Bull. refaits | Bull. manuels |
 *            Entrées | Sorties | Extras | Coffre-fort | Éditique | Temps passé | Commentaires
 *
 * @param {Object} params
 * @param {import('@supabase/supabase-js').SupabaseClient} params.supabase
 * @param {string} params.periode - 'YYYY-MM'
 * @param {string} [params.cabinet] - filtre cabinet (optionnel)
 */
export async function exportModeleManuel({ supabase, periode, cabinet }) {
  // 1. Charger clients actifs
  let qClients = supabase
    .from('clients')
    .select('id, nom, cabinet, siren')
    .eq('actif', true);
  if (cabinet) {
    qClients = qClients.eq('cabinet', cabinet);
  }
  const { data: clients, error: errC } = await qClients;
  if (errC) throw new Error(`Erreur chargement clients: ${errC.message}`);

  // 2. Charger tarifs variables pour déterminer R/F
  let qTarifs = supabase
    .from('tarifs_reference')
    .select('client_id')
    .eq('type_recurrence', 'variable');
  if (cabinet) {
    qTarifs = qTarifs.eq('cabinet', cabinet);
  }
  const { data: tarifsData, error: errT } = await qTarifs;
  if (errT) throw new Error(`Erreur chargement tarifs: ${errT.message}`);

  const reelClientIds = new Set((tarifsData || []).map(t => t.client_id));

  // 3. Charger données existantes pour pré-remplir
  const { data: silaeData } = await supabase
    .from('silae_productions')
    .select('client_id, bulletins_manuels, bulletins_refaits, temps_passe, commentaires')
    .eq('periode', periode);

  const silaeMap = new Map();
  for (const row of (silaeData || [])) {
    silaeMap.set(row.client_id, row);
  }

  // 4. Construire les lignes : R d'abord, puis F, alphabétique dans chaque groupe
  const rows = (clients || [])
    .map(c => ({
      ...c,
      type: reelClientIds.has(c.id) ? 'R' : 'F',
      manuel: silaeMap.get(c.id) || null
    }))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'R' ? -1 : 1;
      return a.nom.localeCompare(b.nom, 'fr');
    });

  // 5. Construire le workbook
  const wb = XLSX.utils.book_new();
  const ws = {};

  const HEADERS = [
    'Type', 'Client', 'SIREN', 'Cabinet',
    'Bull. refaits', 'Bull. manuels',
    'Entrées', 'Sorties', 'Extras', 'Coffre-fort', 'Éditique',
    'Temps passé', 'Commentaires'
  ];

  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '334155' } },
    border: {
      bottom: { style: 'thin', color: { rgb: '64748B' } }
    }
  };

  // Headers
  for (let c = 0; c < HEADERS.length; c++) {
    ws[XLSX.utils.encode_cell({ r: 0, c })] = { t: 's', v: HEADERS[c], s: headerStyle };
  }

  // Data rows
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const r = i + 1;
    const m = row.manuel;

    // A — Type (R/F)
    ws[XLSX.utils.encode_cell({ r, c: 0 })] = { t: 's', v: row.type };
    // B — Client
    ws[XLSX.utils.encode_cell({ r, c: 1 })] = { t: 's', v: row.nom };
    // C — SIREN
    ws[XLSX.utils.encode_cell({ r, c: 2 })] = { t: 's', v: row.siren || '' };
    // D — Cabinet
    const cabAbbrev = row.cabinet === 'Audit Up' ? 'AUP' : (row.cabinet === 'Zerah Fiduciaire' ? 'ZF' : row.cabinet);
    ws[XLSX.utils.encode_cell({ r, c: 3 })] = { t: 's', v: cabAbbrev };
    // E — Bull. refaits (pré-rempli si existant)
    if (m?.bulletins_refaits) ws[XLSX.utils.encode_cell({ r, c: 4 })] = { t: 'n', v: m.bulletins_refaits };
    // F — Bull. manuels
    if (m?.bulletins_manuels) ws[XLSX.utils.encode_cell({ r, c: 5 })] = { t: 'n', v: m.bulletins_manuels };
    // G-K — Entrées, Sorties, Extras, Coffre-fort, Éditique (vide)
    // L — Temps passé
    if (m?.temps_passe) ws[XLSX.utils.encode_cell({ r, c: 11 })] = { t: 'n', v: m.temps_passe };
    // M — Commentaires
    if (m?.commentaires) ws[XLSX.utils.encode_cell({ r, c: 12 })] = { t: 's', v: m.commentaires };
  }

  // Range
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: 12 } });

  // Largeurs colonnes
  ws['!cols'] = [
    { wch: 5 },   // A Type
    { wch: 35 },  // B Client
    { wch: 16 },  // C SIREN
    { wch: 8 },   // D Cabinet
    { wch: 13 },  // E Bull. refaits
    { wch: 13 },  // F Bull. manuels
    { wch: 10 },  // G Entrées
    { wch: 10 },  // H Sorties
    { wch: 10 },  // I Extras
    { wch: 12 },  // J Coffre-fort
    { wch: 10 },  // K Éditique
    { wch: 12 },  // L Temps passé
    { wch: 30 }   // M Commentaires
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Modèle');

  const suffixe = formaterPeriodeFr(periode);
  const fileName = `Modele facturation ${suffixe}.xlsx`;

  // Blob download (compatible navigateur — XLSX.writeFile utilise fs qui est externalisé par Vite)
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ═══════════════════════════ Parse Excel ═══════════════════════════

/**
 * @typedef {Object} ManuelRow
 * @property {string} type - 'R' ou 'F'
 * @property {string} client - Nom (pour affichage)
 * @property {string} siren - SIREN/SIRET pour matching
 * @property {string} cabinet
 * @property {number} bulletins_refaits
 * @property {number} bulletins_manuels
 * @property {number} entrees
 * @property {number} sorties
 * @property {number} extras
 * @property {number} coffre_fort
 * @property {number} editique
 * @property {number} temps_passe
 * @property {string} commentaires
 */

/**
 * Parse un fichier Excel de saisie manuelle.
 * @param {ArrayBuffer} buffer
 * @returns {ManuelRow[]}
 */
export function parseManuelExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (raw.length < 2) return [];

  // Skip header row
  const rows = [];
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r || !r[1]) continue; // pas de nom client → skip

    const bulletins_refaits = parseInt(r[4]) || 0;
    const bulletins_manuels = parseInt(r[5]) || 0;
    const entrees = parseInt(r[6]) || 0;
    const sorties = parseInt(r[7]) || 0;
    const extras = parseInt(r[8]) || 0;
    const coffre_fort = parseInt(r[9]) || 0;
    const editique = parseInt(r[10]) || 0;
    const temps_passe = parseFloat(r[11]) || 0;
    const commentaires = String(r[12] || '').trim();

    // Ignorer lignes sans aucune donnée saisie (E-M vides)
    if (
      bulletins_refaits === 0 && bulletins_manuels === 0 &&
      entrees === 0 && sorties === 0 && extras === 0 &&
      coffre_fort === 0 && editique === 0 &&
      temps_passe === 0 && !commentaires
    ) continue;

    rows.push({
      type: String(r[0] || '').trim(),
      client: String(r[1] || '').trim(),
      siren: String(r[2] || '').trim(),
      cabinet: String(r[3] || '').trim(),
      bulletins_refaits,
      bulletins_manuels,
      entrees,
      sorties,
      extras,
      coffre_fort,
      editique,
      temps_passe,
      commentaires
    });
  }

  return rows;
}

// ═══════════════════════════ Import données ═══════════════════════════

/**
 * Importe les données manuelles parsées dans silae_productions.
 *
 * @param {Object} params
 * @param {import('@supabase/supabase-js').SupabaseClient} params.supabase
 * @param {ManuelRow[]} params.rows - lignes parsées
 * @param {string} params.periode - 'YYYY-MM'
 * @param {Array<{id: string, nom: string, siren: string}>} params.clients - clients actifs (pour matching)
 * @returns {Promise<{updated: number, skipped: number, unmatched: string[]}>}
 */
export async function importManuelData({ supabase, rows, periode, clients }) {
  // Construire index par SIREN
  const clientBySiren = new Map();
  for (const c of clients) {
    if (c.siren) clientBySiren.set(c.siren, c);
  }

  let updated = 0;
  let skipped = 0;
  const unmatched = [];

  for (const row of rows) {
    // Matching par SIREN
    const client = clientBySiren.get(row.siren);
    if (!client) {
      unmatched.push(`${row.client} (${row.siren})`);
      skipped++;
      continue;
    }

    // Sauver les données manuelles (bulletins_manuels, bulletins_refaits, temps_passe, commentaires)
    await sauverDonneesManuelles({
      supabase,
      clientId: client.id,
      periode,
      data: {
        bulletins_manuels: row.bulletins_manuels,
        bulletins_refaits: row.bulletins_refaits,
        temps_passe: row.temps_passe,
        commentaires: row.commentaires
      }
    });

    // Si le fichier contient des données Silae standard (entrees/sorties/etc.)
    // et que le client N'A PAS de données Silae auto → mettre à jour aussi les colonnes standard
    if (row.entrees > 0 || row.sorties > 0 || row.extras > 0 || row.coffre_fort > 0 || row.editique > 0) {
      const { data: existing } = await supabase
        .from('silae_productions')
        .select('id, bulletins')
        .eq('client_id', client.id)
        .eq('periode', periode)
        .maybeSingle();

      if (existing && (existing.bulletins || 0) === 0) {
        // Client sans données Silae auto → injecter les colonnes standard
        await supabase
          .from('silae_productions')
          .update({
            entrees: row.entrees,
            sorties: row.sorties,
            coffre_fort: row.coffre_fort,
            editique: row.editique
          })
          .eq('id', existing.id);
      }
    }

    updated++;
  }

  return { updated, skipped, unmatched };
}
