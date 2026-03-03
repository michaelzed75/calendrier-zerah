// @ts-check

/**
 * @file Service import/export Excel pour les tarifs variables
 *
 * - exportTarifsVariableExcel() : exporte tous les clients (R/F) avec leurs prix variables
 * - parseTarifsVariableExcel()  : parse le fichier Excel édité par l'utilisateur
 * - importTarifsVariableData()  : upsert les tarifs modifiés dans tarifs_reference
 */

import * as XLSX from 'xlsx-js-style';

// ═══════════════════════════ Mapping colonnes ═══════════════════════════

/**
 * Mapping des 6 produits variables : colonne Excel → label_normalise + axe + label par défaut
 */
export const TARIF_COLUMNS = [
  { key: 'bulletin_salaire',      axe: 'social_bulletin',    header: 'Bulletin de salaire',   defaultLabel: 'Etablissement du bulletin de salaire' },
  { key: 'coffre_fort',           axe: 'accessoires_social', header: 'Coffre-fort',           defaultLabel: 'Dépôt coffre-fort numérique' },
  { key: 'publipostage',          axe: 'accessoires_social', header: 'Éditique',              defaultLabel: 'Bulletins envoyés par publi-postage' },
  { key: 'entree_salarie',        axe: 'accessoires_social', header: 'Entrée salarié',        defaultLabel: "Enregistrement d'entrée de salariés" },
  { key: 'sortie_salarie',        axe: 'accessoires_social', header: 'Sortie salarié',        defaultLabel: 'Enregistrement de sortie de salariés' },
  { key: 'modification_bulletin', axe: 'accessoires_social', header: 'Modification bulletin', defaultLabel: 'Modification de bulletin de salaires sur votre demande' },
];

const CABINET_MAP = { 'Audit Up': 'AUP', 'Zerah Fiduciaire': 'ZF' };
const CABINET_REVERSE = { 'AUP': 'Audit Up', 'ZF': 'Zerah Fiduciaire' };

/**
 * Indexe les clients par SIREN/SIRET + cabinet.
 * Clé composite pour distinguer les clients multi-cabinets partageant le même SIRET
 * (ex: RELAIS CHRISTINE existe en AUP et ZF avec le même SIRET 38757178900016).
 *
 * @param {Array<{id: number, nom: string, siren: string, cabinet: string, siret_complement?: string}>} clients
 * @returns {Map<string, Object>} Map<"SIREN|cabinet" ou "SIRET|cabinet", client>
 */
function buildClientIndex(clients) {
  const index = new Map();
  for (const c of clients) {
    const cab = CABINET_MAP[c.cabinet] || c.cabinet;
    if (c.siren) index.set(`${c.siren}|${cab}`, c);
    if (c.siren && c.siret_complement) {
      index.set(`${c.siren}${c.siret_complement}|${cab}`, c);
    }
  }
  return index;
}

/**
 * Cherche un client dans l'index par SIREN/SIRET + cabinet.
 * @param {Map<string, Object>} index
 * @param {string} siren - SIREN (9) ou SIRET (14) du fichier Excel
 * @param {string} cabinetAbbrev - 'AUP' ou 'ZF' du fichier Excel
 * @returns {Object|undefined}
 */
function lookupClient(index, siren, cabinetAbbrev) {
  return index.get(`${siren}|${cabinetAbbrev}`);
}

/**
 * Détermine le label_normalise d'un tarif à partir de son axe et label.
 * Fallback quand produit_pennylane_id est null.
 */
function detectLabelNormalise(axe, label) {
  if (axe === 'social_bulletin') return 'bulletin_salaire';
  if (axe !== 'accessoires_social') return null;
  const lower = (label || '').toLowerCase();
  if (lower.includes('coffre')) return 'coffre_fort';
  if (lower.includes('publi') || lower.includes('éditique') || lower.includes('editique')) return 'publipostage';
  if (lower.includes('modification')) return 'modification_bulletin';
  if (lower.includes('sortie')) return 'sortie_salarie';
  if (lower.includes('entrée') || lower.includes('entree') || lower.includes("d'entrée")) return 'entree_salarie';
  return null;
}

// ═══════════════════════════ Export ═══════════════════════════

/**
 * Exporte un fichier Excel listant tous les clients avec leurs tarifs variables.
 * Clients R (réel) : prix pré-remplis. Clients F (forfait) : cellules vides.
 *
 * @param {Object} params
 * @param {import('@supabase/supabase-js').SupabaseClient} params.supabase
 * @param {string} params.dateEffet - ex: '2026-01-01'
 * @param {string} [params.cabinet] - filtre cabinet (optionnel)
 */
export async function exportTarifsVariableExcel({ supabase, dateEffet, cabinet }) {
  // 1. Charger clients actifs
  let qClients = supabase
    .from('clients')
    .select('id, nom, cabinet, siren, siret_complement')
    .eq('actif', true);
  if (cabinet) qClients = qClients.eq('cabinet', cabinet);
  const { data: clients, error: errC } = await qClients;
  if (errC) throw new Error(`Erreur chargement clients: ${errC.message}`);

  // 2. Charger tarifs variables pour la dateEffet
  let qTarifs = supabase
    .from('tarifs_reference')
    .select('client_id, label, axe, pu_ht, produit_pennylane_id')
    .eq('type_recurrence', 'variable')
    .eq('date_effet', dateEffet);
  if (cabinet) qTarifs = qTarifs.eq('cabinet', cabinet);
  const { data: tarifsData, error: errT } = await qTarifs;
  if (errT) throw new Error(`Erreur chargement tarifs: ${errT.message}`);

  // 3. Charger produits PL variables actifs (pour mapper produit_pennylane_id → label_normalise)
  const { data: produitsData } = await supabase
    .from('produits_pennylane')
    .select('id, cabinet, label_normalise')
    .eq('type_recurrence', 'variable')
    .eq('actif', true);

  const produitById = new Map();
  for (const p of (produitsData || [])) {
    produitById.set(p.id, p);
  }

  // 4. Indexer tarifs par client → { label_normalise: pu_ht }
  const tarifsByClient = new Map();
  const reelClientIds = new Set();

  for (const t of (tarifsData || [])) {
    // R = a un tarif bulletin de salaire (social_bulletin), pas juste des accessoires
    if (t.axe === 'social_bulletin') reelClientIds.add(t.client_id);
    if (!tarifsByClient.has(t.client_id)) tarifsByClient.set(t.client_id, {});

    // Déterminer le label_normalise : via produit PL si dispo, sinon fallback axe+label
    const produit = produitById.get(t.produit_pennylane_id);
    const labelNorm = produit
      ? produit.label_normalise
      : detectLabelNormalise(t.axe, t.label);

    if (labelNorm) {
      tarifsByClient.get(t.client_id)[labelNorm] = t.pu_ht;
    }
  }

  // 5. Construire les lignes : R d'abord (alpha), puis F (alpha)
  const sortedClients = (clients || [])
    .map(c => ({ ...c, type: reelClientIds.has(c.id) ? 'R' : 'F' }))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'R' ? -1 : 1;
      return a.nom.localeCompare(b.nom, 'fr');
    });

  // 6. Construire le workbook via aoa_to_sheet (plus fiable qu'une construction manuelle)
  const wb = XLSX.utils.book_new();

  const HEADERS = ['Client', 'Type', 'SIREN/SIRET', 'Cabinet', ...TARIF_COLUMNS.map(c => c.header)];

  const aoaData = [HEADERS];
  for (const client of sortedClients) {
    const sirenOuSiret = client.siret_complement
      ? `${client.siren}${client.siret_complement}`
      : (client.siren || '');
    const cabAbbrev = CABINET_MAP[client.cabinet] || client.cabinet;
    const clientTarifs = tarifsByClient.get(client.id) || {};

    aoaData.push([
      client.nom,
      client.type,
      sirenOuSiret,
      cabAbbrev,
      ...TARIF_COLUMNS.map(col => {
        const prix = clientTarifs[col.key];
        return (prix !== undefined && prix !== null) ? prix : null;
      })
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoaData);

  // Appliquer le style des headers
  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '334155' } },
    border: { bottom: { style: 'thin', color: { rgb: '64748B' } } }
  };
  for (let c = 0; c < HEADERS.length; c++) {
    const ref = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[ref]) ws[ref].s = headerStyle;
  }

  // Appliquer le format numérique sur les colonnes prix
  for (let i = 1; i <= sortedClients.length; i++) {
    for (let j = 0; j < TARIF_COLUMNS.length; j++) {
      const ref = XLSX.utils.encode_cell({ r: i, c: 4 + j });
      if (ws[ref] && ws[ref].t === 'n') ws[ref].z = '0.00';
    }
  }

  ws['!cols'] = [
    { wch: 35 },  // A Client
    { wch: 5 },   // B Type
    { wch: 18 },  // C SIREN/SIRET
    { wch: 6 },   // D Cabinet
    { wch: 18 },  // E Bulletin
    { wch: 12 },  // F Coffre-fort
    { wch: 10 },  // G Éditique
    { wch: 14 },  // H Entrée
    { wch: 14 },  // I Sortie
    { wch: 20 },  // J Modification
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Tarifs variables');

  const fileName = `Tarifs variables ${dateEffet}.xlsx`;
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

// ═══════════════════════════ Parse ═══════════════════════════

/**
 * @typedef {Object} TarifVariableRow
 * @property {string} client - Nom du client
 * @property {string} type - 'R' ou 'F'
 * @property {string} siren - SIREN ou SIRET (sans préfixe R/F)
 * @property {string} cabinet - 'AUP' ou 'ZF'
 * @property {number|null} bulletin_salaire
 * @property {number|null} coffre_fort
 * @property {number|null} publipostage
 * @property {number|null} entree_salarie
 * @property {number|null} sortie_salarie
 * @property {number|null} modification_bulletin
 */

/**
 * Parse un fichier Excel de tarifs variables.
 * @param {ArrayBuffer} buffer
 * @returns {TarifVariableRow[]}
 */
export function parseTarifsVariableExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (raw.length < 2) return [];

  const rows = [];
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];
    const clientNom = String(r[0] || '').trim();
    if (!clientNom) continue;

    const type = String(r[1] || '').trim().charAt(0); // 'R' or 'F'
    const siren = String(r[2] || '').trim();
    const cabinet = String(r[3] || '').trim();

    // Parse les 6 colonnes prix (E-J = indices 4-9)
    // Cellule vide → null (sera traité selon contexte dans l'import/preview)
    const prix = {};
    let hasAnyValue = false;
    for (let j = 0; j < TARIF_COLUMNS.length; j++) {
      const val = r[4 + j];
      const num = (val !== '' && val !== null && val !== undefined) ? parseFloat(val) : null;
      prix[TARIF_COLUMNS[j].key] = (num !== null && !isNaN(num)) ? num : null;
      if (prix[TARIF_COLUMNS[j].key] !== null) hasAnyValue = true;
    }

    if (!hasAnyValue) continue;

    rows.push({
      client: clientNom,
      type,
      siren,
      cabinet,
      ...prix
    });
  }

  return rows;
}

// ═══════════════════════════ Preview ═══════════════════════════

/**
 * @typedef {Object} TarifVariableChange
 * @property {string} client - Nom du client
 * @property {string} cabinet - 'AUP' ou 'ZF'
 * @property {string} colonne - Header de la colonne (ex: "Bulletin de salaire")
 * @property {'creation'|'modification'|'inchange'} type
 * @property {number|null} ancienPrix
 * @property {number} nouveauPrix
 */

/**
 * Prévisualise les modifications avant import.
 * Compare le fichier Excel parsé avec les tarifs existants en base.
 *
 * @param {Object} params
 * @param {import('@supabase/supabase-js').SupabaseClient} params.supabase
 * @param {TarifVariableRow[]} params.rows - Lignes parsées
 * @param {string} params.dateEffet
 * @param {Array<{id: number, nom: string, siren: string, cabinet: string, siret_complement?: string}>} params.clients
 * @returns {Promise<{changes: TarifVariableChange[], unmatched: string[]}>}
 */
export async function previewTarifsVariableImport({ supabase, rows, dateEffet, clients }) {
  const clientIndex = buildClientIndex(clients);

  // Charger produits PL
  const { data: produitsData } = await supabase
    .from('produits_pennylane')
    .select('id, cabinet, label_normalise')
    .eq('type_recurrence', 'variable')
    .eq('actif', true);

  const produitById = new Map();
  for (const p of (produitsData || [])) {
    produitById.set(p.id, p);
  }

  // Charger tarifs existants
  const { data: existingTarifs } = await supabase
    .from('tarifs_reference')
    .select('client_id, label, pu_ht, axe, produit_pennylane_id')
    .eq('type_recurrence', 'variable')
    .eq('date_effet', dateEffet);

  // Indexer par client → label_normalise → pu_ht
  const existingByClient = new Map();
  for (const t of (existingTarifs || [])) {
    const produit = produitById.get(t.produit_pennylane_id);
    const labelNorm = produit
      ? produit.label_normalise
      : detectLabelNormalise(t.axe, t.label);
    if (!labelNorm) continue;
    if (!existingByClient.has(t.client_id)) existingByClient.set(t.client_id, new Map());
    existingByClient.get(t.client_id).set(labelNorm, t.pu_ht);
  }

  const changes = [];
  const unmatched = [];

  for (const row of rows) {
    const client = lookupClient(clientIndex, row.siren, row.cabinet);
    if (!client) {
      unmatched.push(`${row.client} (${row.siren} ${row.cabinet})`);
      continue;
    }

    for (const col of TARIF_COLUMNS) {
      const prixRaw = row[col.key];
      const clientExisting = existingByClient.get(client.id);
      const ancienPrix = clientExisting ? clientExisting.get(col.key) : null;

      if (prixRaw === null || prixRaw === undefined) {
        // Cellule vide : écraser à 0 SEULEMENT si un tarif existe déjà
        if (ancienPrix !== null && ancienPrix !== undefined && ancienPrix !== 0) {
          changes.push({ client: row.client, cabinet: row.cabinet, colonne: col.header, type: 'modification', ancienPrix, nouveauPrix: 0 });
        }
        continue;
      }

      if (ancienPrix === null || ancienPrix === undefined) {
        changes.push({ client: row.client, cabinet: row.cabinet, colonne: col.header, type: 'creation', ancienPrix: null, nouveauPrix: prixRaw });
      } else if (ancienPrix !== prixRaw) {
        changes.push({ client: row.client, cabinet: row.cabinet, colonne: col.header, type: 'modification', ancienPrix, nouveauPrix: prixRaw });
      }
      // inchangé → pas dans la liste
    }
  }

  return { changes, unmatched };
}

// ═══════════════════════════ Import ═══════════════════════════

/**
 * Importe les tarifs variables édités dans tarifs_reference.
 * Trace chaque modification dans historique_prix (créations et changements de prix).
 *
 * Note sur la traçabilité :
 *   - La sync Pennylane trace les changements d'abonnements FIXES dans historique_prix
 *   - Cette fonction trace les changements de tarifs VARIABLES (import Excel)
 *   - Ensemble, historique_prix couvre l'intégralité des évolutions d'honoraires
 *   - Pour une bascule R→F manuelle (rare, correction initiale), passer directement en base
 *     et insérer manuellement dans historique_prix pour garder la trace
 *
 * @param {Object} params
 * @param {import('@supabase/supabase-js').SupabaseClient} params.supabase
 * @param {TarifVariableRow[]} params.rows - Lignes parsées
 * @param {string} params.dateEffet - Date d'effet pour l'upsert
 * @param {Array<{id: number, nom: string, siren: string, cabinet: string, siret_complement?: string}>} params.clients
 * @returns {Promise<{created: number, updated: number, errors: string[], unmatched: string[], historique: number}>}
 */
export async function importTarifsVariableData({ supabase, rows, dateEffet, clients }) {
  // 1. Indexer clients par SIREN/SIRET + cabinet (clé composite)
  const clientIndex = buildClientIndex(clients);

  // 2. Charger produits PL variables → Map<label_normalise+cabinet, produit> + Map<id, produit>
  const { data: produitsData } = await supabase
    .from('produits_pennylane')
    .select('id, cabinet, label_normalise')
    .eq('type_recurrence', 'variable')
    .eq('actif', true);

  const produitByKey = new Map();
  const produitById = new Map();
  for (const p of (produitsData || [])) {
    produitByKey.set(`${p.label_normalise}|${p.cabinet}`, p);
    produitById.set(p.id, p);
  }

  // 3. Charger tarifs existants pour cette dateEffet (labels + anciens prix pour historique)
  const { data: existingTarifs } = await supabase
    .from('tarifs_reference')
    .select('client_id, label, pu_ht, axe, produit_pennylane_id')
    .eq('type_recurrence', 'variable')
    .eq('date_effet', dateEffet);

  // Map: clientId → Map<label_normalise, { label, pu_ht }>
  // Indexe par label_normalise : via produit PL si dispo, sinon fallback axe+label
  const existingByClient = new Map();
  for (const t of (existingTarifs || [])) {
    const produit = produitById.get(t.produit_pennylane_id);
    const labelNorm = produit
      ? produit.label_normalise
      : detectLabelNormalise(t.axe, t.label);
    if (!labelNorm) continue;

    if (!existingByClient.has(t.client_id)) existingByClient.set(t.client_id, new Map());
    existingByClient.get(t.client_id).set(labelNorm, { label: t.label, pu_ht: t.pu_ht });
  }

  // 4. Traiter chaque ligne
  let created = 0;
  let updated = 0;
  let historique = 0;
  const errors = [];
  const unmatched = [];

  for (const row of rows) {
    const client = lookupClient(clientIndex, row.siren, row.cabinet);
    if (!client) {
      unmatched.push(`${row.client} (${row.siren} ${row.cabinet})`);
      continue;
    }

    const fullCabinet = CABINET_REVERSE[row.cabinet] || row.cabinet;

    for (const col of TARIF_COLUMNS) {
      const prixRaw = row[col.key];

      // Lookup produit PL
      const produit = produitByKey.get(`${col.key}|${fullCabinet}`);

      // Chercher le tarif existant par label_normalise (= col.key)
      const clientExisting = existingByClient.get(client.id);
      const existing = clientExisting ? clientExisting.get(col.key) : null;

      // Cellule vide : écraser à 0 si tarif existant, sinon ignorer
      if (prixRaw === null || prixRaw === undefined) {
        if (!existing || existing.pu_ht === 0) continue; // pas de tarif ou déjà à 0 → rien
        // Tarif existant avec prix > 0 → écraser à 0
      }

      const prix = (prixRaw === null || prixRaw === undefined) ? 0 : prixRaw;
      const label = existing ? existing.label : col.defaultLabel;
      const ancienPrix = existing ? existing.pu_ht : null;

      const isUpdate = !!existing;
      const prixChanged = isUpdate && ancienPrix !== prix;

      const tarif = {
        client_id: client.id,
        label,
        axe: col.axe,
        type_recurrence: 'variable',
        pu_ht: prix,
        quantite: 1,
        frequence: 'monthly',
        intervalle: 1,
        tva_rate: 0.20,
        cabinet: fullCabinet,
        date_effet: dateEffet,
        source: 'import_tarifs_variable',
        produit_pennylane_id: produit?.id || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('tarifs_reference')
        .upsert(tarif, { onConflict: 'client_id,label,date_effet' });

      if (error) {
        errors.push(`${row.client} / ${col.header}: ${error.message}`);
      } else if (isUpdate) {
        updated++;
      } else {
        created++;
      }

      // 5. Tracer dans historique_prix (création ou changement de prix)
      if (!error && (prixChanged || !isUpdate)) {
        const delta = ancienPrix !== null ? prix - ancienPrix : null;
        const deltaPct = ancienPrix && ancienPrix !== 0
          ? Math.round(((prix - ancienPrix) / ancienPrix) * 10000) / 100
          : null;

        await supabase
          .from('historique_prix')
          .insert({
            client_id: client.id,
            label: `[Variable] ${col.header}`,
            famille: 'social',
            ancien_montant_ht: ancienPrix,
            nouveau_montant_ht: prix,
            ancienne_quantite: null,
            nouvelle_quantite: null,
            delta_ht: delta,
            delta_pourcentage: deltaPct,
            date_detection: new Date().toISOString(),
            sync_cabinet: fullCabinet,
          });
        historique++;
      }
    }
  }

  return { created, updated, errors, unmatched, historique };
}
