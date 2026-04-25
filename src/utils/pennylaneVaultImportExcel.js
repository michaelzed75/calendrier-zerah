// @ts-check
/**
 * Import/export Excel des clés API Pennylane (Vault).
 *
 * Sécurité :
 * - L'export NE CONTIENT JAMAIS de clés API (elles ne sont jamais lues côté serveur retour vers UI)
 * - L'export contient uniquement les statuts (✅ Configurée / vide) pour info
 * - L'import lit les clés saisies par l'utilisateur dans l'Excel et les envoie au serveur via HTTPS
 * - Le fichier Excel rempli contient les clés en clair → rappeler à l'utilisateur de le supprimer après import
 */

import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';

const CLE_READ_COL = 'Clé READ';
const CLE_WRITE_COL = 'Clé WRITE';
const STATUT_READ_COL = 'Statut Clé READ';
const STATUT_WRITE_COL = 'Statut Clé WRITE';

/**
 * Récupère le JWT de la session courante.
 */
async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Session expirée — reconnectez-vous');
  }
  return session.access_token;
}

/**
 * Appelle /api/pennylane-key avec le JWT.
 */
async function callKeyApi(body) {
  const token = await getAccessToken();
  const res = await fetch('/api/pennylane-key', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/**
 * Récupère la liste des statuts Vault (un objet par scope par client).
 * @returns {Promise<Object<number, { read?: {label, updated_at}, write?: {label, updated_at} }>>}
 */
export async function fetchVaultStatuses() {
  const data = await callKeyApi({ action: 'list' });
  /** @type {Object<number, any>} */
  const byClient = {};
  for (const item of (data.items || [])) {
    if (!byClient[item.client_id]) byClient[item.client_id] = {};
    byClient[item.client_id][item.scope] = {
      label: item.pennylane_key_label,
      updated_at: item.updated_at
    };
  }
  return byClient;
}

/**
 * Formate un statut pour la cellule Excel.
 */
function formatStatut(scopeData) {
  if (!scopeData) return '';
  const date = scopeData.updated_at ? new Date(scopeData.updated_at).toLocaleDateString('fr-FR') : '';
  return `Configurée le ${date}`;
}

/**
 * Construit les 4 colonnes Vault pour un client donné.
 */
export function buildVaultColumnsForClient(clientId, statuses) {
  const status = statuses[clientId] || {};
  return {
    [STATUT_READ_COL]: formatStatut(status.read),
    [CLE_READ_COL]: '', // toujours vide à l'export
    [STATUT_WRITE_COL]: formatStatut(status.write),
    [CLE_WRITE_COL]: '' // toujours vide à l'export
  };
}

/**
 * Parse un fichier Excel uploadé par l'utilisateur.
 * Retourne uniquement les lignes ayant au moins une clé non vide.
 *
 * @param {File} file
 * @returns {Promise<{
 *   rows: Array<{ client_id: number, nom: string, read_key?: string, write_key?: string }>,
 *   stats: { totalRows: number, withReadKey: number, withWriteKey: number, ignored: number, errors: string[] }
 * }>}
 */
export async function parseImportFile(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  /** @type {any[]} */
  const json = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const rows = [];
  let withReadKey = 0;
  let withWriteKey = 0;
  let ignored = 0;
  const errors = [];

  for (let i = 0; i < json.length; i++) {
    const row = json[i];
    const id = parseInt(row['ID'], 10);
    const nom = String(row['Nom'] || '').trim();

    if (!id || isNaN(id)) {
      errors.push(`Ligne ${i + 2} : ID manquant ou invalide`);
      continue;
    }

    const readKey = String(row[CLE_READ_COL] || '').trim();
    const writeKey = String(row[CLE_WRITE_COL] || '').trim();

    if (!readKey && !writeKey) {
      ignored++;
      continue;
    }

    if (readKey) withReadKey++;
    if (writeKey) withWriteKey++;

    rows.push({
      client_id: id,
      nom,
      read_key: readKey || undefined,
      write_key: writeKey || undefined
    });
  }

  return {
    rows,
    stats: {
      totalRows: json.length,
      withReadKey,
      withWriteKey,
      ignored,
      errors
    }
  };
}

/**
 * Exécute l'import : pour chaque ligne avec une clé, appelle /api/pennylane-key set.
 *
 * @param {Array<{ client_id: number, nom: string, read_key?: string, write_key?: string }>} rows
 * @param {(progress: { current: number, total: number, currentName: string }) => void} [onProgress]
 * @returns {Promise<{ success: number, failed: Array<{ client_id: number, nom: string, scope: string, error: string }> }>}
 */
export async function executeImport(rows, onProgress) {
  // Compter le total d'opérations (1 par clé non vide)
  let totalOps = 0;
  for (const r of rows) {
    if (r.read_key) totalOps++;
    if (r.write_key) totalOps++;
  }

  let current = 0;
  let success = 0;
  /** @type {Array<{ client_id: number, nom: string, scope: string, error: string }>} */
  const failed = [];

  for (const row of rows) {
    if (row.read_key) {
      current++;
      if (onProgress) onProgress({ current, total: totalOps, currentName: `${row.nom} (read)` });
      try {
        await callKeyApi({
          action: 'set',
          client_id: row.client_id,
          scope: 'read',
          api_key: row.read_key,
          label: `Clé read ${row.nom}`
        });
        success++;
      } catch (err) {
        failed.push({
          client_id: row.client_id,
          nom: row.nom,
          scope: 'read',
          error: err.message
        });
      }
    }

    if (row.write_key) {
      current++;
      if (onProgress) onProgress({ current, total: totalOps, currentName: `${row.nom} (write)` });
      try {
        await callKeyApi({
          action: 'set',
          client_id: row.client_id,
          scope: 'write',
          api_key: row.write_key,
          label: `Clé write ${row.nom}`
        });
        success++;
      } catch (err) {
        failed.push({
          client_id: row.client_id,
          nom: row.nom,
          scope: 'write',
          error: err.message
        });
      }
    }
  }

  return { success, failed };
}
