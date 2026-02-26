// @ts-check

/**
 * @file Service Silae — Parse Excel, matching clients, CRUD BDD
 *
 * Gère l'import des fichiers Excel Silae "Analyse production synthétique",
 * le mapping dossiers Silae → clients locaux, et le stockage en BDD.
 */

import * as XLSX from 'xlsx';

/**
 * @typedef {Object} SilaeRow
 * @property {string} code - Numero Dossier (col A)
 * @property {string} nom - Societe (col B)
 * @property {string} siren - SIREN (col C)
 * @property {number} bulletins - Bulletins originaux non 0 (col F)
 * @property {number} bulletinsTotal - Total général bulletins (col M)
 * @property {number} coffreFort - Bulletins déposés coffre-fort (col K)
 * @property {number} editique - Dont éditique / publi-postage (col L)
 * @property {number} entrees - Entrées salariés (col O)
 * @property {number} sorties - Sorties salariés (col P)
 * @property {number} declarations - Déclarations (col Q)
 * @property {number} attestationsPE - Attestations Pôle emploi (col S)
 */

/**
 * @typedef {Object} SilaeMapping
 * @property {number} [id]
 * @property {string} code_silae
 * @property {string} [nom_silae]
 * @property {string} [siren]
 * @property {number|null} client_id
 */

/**
 * Normalise un nom pour comparaison
 * @param {string} str
 * @returns {string}
 */
function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Parse un fichier Excel Silae "Analyse production synthétique".
 * Structure attendue : ligne 1 = titre, ligne 2 = vide, ligne 3 = headers, lignes 4+ = données.
 *
 * @param {ArrayBuffer} fileBuffer - Contenu du fichier Excel
 * @returns {SilaeRow[]}
 */
export function parseSilaeExcel(fileBuffer) {
  const wb = XLSX.read(fileBuffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];

  if (!ws) throw new Error('Aucune feuille trouvée dans le fichier');

  // Lire toutes les données en array of arrays (en commençant à la ligne 3 = headers)
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // La ligne 3 (index 2) contient les headers
  // Les données commencent à la ligne 4 (index 3)
  if (data.length < 4) {
    throw new Error('Fichier Silae invalide : pas assez de lignes');
  }

  const result = [];

  for (let i = 3; i < data.length; i++) {
    const row = data[i];
    const code = String(row[0] || '').trim();
    const nom = String(row[1] || '').trim();

    // Ignorer les lignes vides ou la ligne de totaux
    if (!code || !nom) continue;
    // Ignorer si le code ressemble à un total
    if (code.toLowerCase() === 'total' || nom.toLowerCase() === 'total') continue;

    result.push({
      code,
      nom,
      siren: String(row[2] || '').trim(),
      bulletins: parseInt(row[5]) || 0,         // Col F (index 5)
      bulletinsTotal: parseInt(row[12]) || 0,    // Col M (index 12)
      coffreFort: parseInt(row[10]) || 0,        // Col K (index 10)
      editique: parseInt(row[11]) || 0,          // Col L (index 11) — "...dont éditique"
      entrees: parseInt(row[14]) || 0,           // Col O (index 14)
      sorties: parseInt(row[15]) || 0,           // Col P (index 15)
      declarations: parseInt(row[16]) || 0,      // Col Q (index 16)
      attestationsPE: parseInt(row[18]) || 0     // Col S (index 18)
    });
  }

  return result;
}

/**
 * Récupère les mappings Silae existants depuis la BDD.
 *
 * @param {Object} supabase
 * @returns {Promise<SilaeMapping[]>}
 */
export async function getSilaeMapping(supabase) {
  const { data, error } = await supabase
    .from('silae_mapping')
    .select('*')
    .order('code_silae');

  if (error) throw new Error(`Erreur récupération mapping Silae: ${error.message}`);
  return data || [];
}

/**
 * Met à jour ou crée un mapping Silae → client(s).
 * Supporte le mapping 1→N (un dossier Silae lié à plusieurs clients Pennylane).
 *
 * @param {Object} supabase
 * @param {string} codeSilae
 * @param {number[]} clientIds - Un ou plusieurs client IDs
 * @param {string} [nomSilae]
 * @param {string} [siren]
 * @returns {Promise<void>}
 */
export async function updateSilaeMapping(supabase, codeSilae, clientIds, nomSilae = null, siren = null) {
  // Supprimer les anciens mappings pour ce code (sans client_id = les entrées "à mapper")
  await supabase
    .from('silae_mapping')
    .delete()
    .eq('code_silae', codeSilae)
    .is('client_id', null);

  for (const clientId of clientIds) {
    // Upsert le mapping (UNIQUE sur code_silae + client_id)
    const { error: mappingError } = await supabase
      .from('silae_mapping')
      .upsert({
        code_silae: codeSilae,
        client_id: clientId,
        nom_silae: nomSilae,
        siren: siren,
        updated_at: new Date().toISOString()
      }, { onConflict: 'code_silae,client_id' });

    if (mappingError) throw new Error(`Erreur update mapping: ${mappingError.message}`);

    // Mettre à jour le code_silae et le siren sur le client
    const updateFields = { code_silae: codeSilae };
    if (siren) {
      updateFields.siren = siren;
    }

    const { error: clientError } = await supabase
      .from('clients')
      .update(updateFields)
      .eq('id', clientId);

    if (clientError) {
      console.error(`Erreur update code_silae/siren client ${clientId}:`, clientError.message);
    }
  }
}

/**
 * Importe les données Silae en BDD.
 * Retourne les lignes matchées et non matchées.
 *
 * @param {Object} supabase
 * @param {SilaeRow[]} silaeRows - Données parsées du fichier
 * @param {string} periode - Format 'YYYY-MM'
 * @param {Object[]} clients - Liste des clients locaux
 * @returns {Promise<{ matched: {row: SilaeRow, client_id: number, client_nom: string}[], unmatched: SilaeRow[], inserted: number, errors: string[] }>}
 */
export async function importSilaeData(supabase, silaeRows, periode, clients) {
  // 1. Charger les mappings existants (1→N : un code peut avoir plusieurs client_ids)
  const existingMappings = await getSilaeMapping(supabase);
  /** @type {Map<string, number[]>} */
  const mappingByCode = new Map();
  for (const m of existingMappings) {
    if (m.client_id) {
      if (!mappingByCode.has(m.code_silae)) {
        mappingByCode.set(m.code_silae, []);
      }
      mappingByCode.get(m.code_silae).push(m.client_id);
    }
  }

  // 2. Construire un index des clients par code_silae, par SIREN et par nom normalisé
  const clientByCode = new Map();
  /** @type {Map<string, Object>} SIREN → client (clé universelle) */
  const clientBySiren = new Map();
  const clientByNom = new Map();
  for (const c of clients) {
    if (c.code_silae) clientByCode.set(c.code_silae, c);
    if (c.siren) clientBySiren.set(c.siren, c);
    clientByNom.set(normalizeString(c.nom), c);
  }

  // 3. Matcher chaque ligne
  // Ordre de priorité : mapping BDD → SIREN → code_silae → nom exact → nom partiel
  const matched = [];
  const unmatched = [];

  for (const row of silaeRows) {
    /** @type {number[]} */
    let clientIds = [];

    // Essai 1 : mapping existant en BDD (peut être 1→N)
    if (mappingByCode.has(row.code)) {
      clientIds = mappingByCode.get(row.code);
    }

    // Essai 2 : par SIREN (CLÉ UNIVERSELLE) — Silae col C = client.siren
    if (clientIds.length === 0 && row.siren) {
      const sirenClean = row.siren.replace(/\s/g, '').trim();
      if (sirenClean && clientBySiren.has(sirenClean)) {
        const client = clientBySiren.get(sirenClean);
        clientIds = [client.id];
      }
    }

    // Essai 3 : par code_silae sur le client
    if (clientIds.length === 0 && clientByCode.has(row.code)) {
      const client = clientByCode.get(row.code);
      clientIds = [client.id];
    }

    // Essai 4 : par nom normalisé
    if (clientIds.length === 0) {
      const nomNorm = normalizeString(row.nom);
      if (clientByNom.has(nomNorm)) {
        const client = clientByNom.get(nomNorm);
        clientIds = [client.id];
      }
    }

    // Essai 5 : nom contient (partiel)
    if (clientIds.length === 0) {
      const nomNorm = normalizeString(row.nom);
      for (const c of clients) {
        const cNorm = normalizeString(c.nom);
        if (cNorm.includes(nomNorm) || nomNorm.includes(cNorm)) {
          clientIds = [c.id];
          break;
        }
      }
    }

    if (clientIds.length > 0) {
      // Ajouter un matched pour chaque client lié
      for (const cid of clientIds) {
        const client = clients.find(c => c.id === cid);
        matched.push({ row, client_id: cid, client_nom: client?.nom || '' });
      }
    } else if (row.bulletins > 0) {
      // Ignorer les dossiers à 0 bulletin (clients partis, Silae pas nettoyé)
      unmatched.push(row);
      // Créer l'entrée de mapping sans client_id pour le mapper manuellement
      // On utilise insert au lieu de upsert car la contrainte UNIQUE est (code_silae, client_id)
      const { data: existing } = await supabase
        .from('silae_mapping')
        .select('id')
        .eq('code_silae', row.code)
        .is('client_id', null)
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase
          .from('silae_mapping')
          .insert({
            code_silae: row.code,
            nom_silae: row.nom,
            siren: row.siren,
            client_id: null
          });
      }
    }
  }

  // 4. Insérer les données matchées en BDD (mêmes bulletins dupliqués sur chaque client lié)
  let inserted = 0;
  const errors = [];

  for (const { row, client_id } of matched) {
    const { error } = await supabase
      .from('silae_productions')
      .upsert({
        client_id,
        periode,
        bulletins: row.bulletins,
        bulletins_total: row.bulletinsTotal,
        coffre_fort: row.coffreFort,
        editique: row.editique,
        entrees: row.entrees,
        sorties: row.sorties,
        declarations: row.declarations,
        attestations_pe: row.attestationsPE,
        imported_at: new Date().toISOString()
      }, { onConflict: 'client_id,periode' });

    if (error) {
      errors.push(`${row.nom} → ${client_id}: ${error.message}`);
    } else {
      inserted++;
    }

    // Enregistrer le mapping si pas déjà fait
    const existingIds = mappingByCode.get(row.code) || [];
    if (!existingIds.includes(client_id)) {
      await supabase
        .from('silae_mapping')
        .upsert({
          code_silae: row.code,
          nom_silae: row.nom,
          siren: row.siren,
          client_id,
          updated_at: new Date().toISOString()
        }, { onConflict: 'code_silae,client_id' });
    }
  }

  return { matched, unmatched, inserted, errors };
}

/**
 * Récupère les productions Silae stockées en BDD.
 *
 * @param {Object} supabase
 * @param {string} [periode] - Filtre optionnel sur la période
 * @returns {Promise<Object[]>}
 */
export async function getSilaeProductions(supabase, periode = null) {
  let query = supabase
    .from('silae_productions')
    .select('*')
    .order('periode', { ascending: false });

  if (periode) {
    query = query.eq('periode', periode);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Erreur récupération productions Silae: ${error.message}`);
  return data || [];
}

/**
 * Extrait la période (YYYY-MM) du nom de fichier Silae.
 * Ex: "Production Janvier 26.xlsx" → "2026-01"
 * Fallback : mois/année courants si non détecté.
 *
 * @param {string} filename
 * @returns {string} Période au format YYYY-MM
 */
export function extractPeriodeFromFilename(filename) {
  const moisMap = {
    'janvier': '01', 'fevrier': '02', 'mars': '03', 'avril': '04',
    'mai': '05', 'juin': '06', 'juillet': '07', 'aout': '08',
    'septembre': '09', 'octobre': '10', 'novembre': '11', 'decembre': '12'
  };

  const lower = filename.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  for (const [mois, num] of Object.entries(moisMap)) {
    if (lower.includes(mois)) {
      const match = lower.match(/(\d{2,4})/);
      if (match) {
        let year = parseInt(match[1]);
        if (year < 100) year += 2000;
        return `${year}-${num}`;
      }
    }
  }

  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Récupère les périodes Silae disponibles (distinctes).
 *
 * @param {Object} supabase
 * @returns {Promise<string[]>}
 */
export async function getSilaePeriodes(supabase) {
  const { data, error } = await supabase
    .from('silae_productions')
    .select('periode')
    .order('periode', { ascending: false });

  if (error) throw new Error(`Erreur récupération périodes Silae: ${error.message}`);

  // Dédupliquer
  const periodes = [...new Set((data || []).map(d => d.periode))];
  return periodes;
}
