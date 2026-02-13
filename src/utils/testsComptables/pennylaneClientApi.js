// @ts-check

/**
 * @file Client API Pennylane pour les données comptables d'un client spécifique
 * Ce module gère les appels API vers Pennylane avec la clé API propre à chaque client
 * Utilise le proxy serverless /api/pennylane-proxy pour éviter les problèmes CORS
 */

// URL du proxy API (fonction serverless Vercel)
const PROXY_URL = '/api/pennylane-proxy';

/**
 * Pause utilitaire pour le rate limiting
 * @param {number} ms - Millisecondes d'attente
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Effectue un appel à l'API Pennylane via le proxy
 * Gère automatiquement le rate limiting (429) avec retry + backoff
 * @param {string} apiKey - Clé API Pennylane du client
 * @param {string} endpoint - Endpoint relatif (ex: '/accounting_entries')
 * @param {Object} [params] - Paramètres de requête optionnels
 * @param {number} [retries=3] - Nombre de tentatives en cas de rate limit
 * @returns {Promise<Object>} Réponse de l'API
 */
export async function callPennylaneAPI(apiKey, endpoint, params = {}, retries = 3) {
  const url = new URL(PROXY_URL, window.location.origin);

  // Ajouter l'endpoint comme paramètre
  url.searchParams.append('endpoint', endpoint);

  // Ajouter les autres paramètres de requête
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-Pennylane-Api-Key': apiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    // Rate limit : attendre et réessayer
    if (response.status === 429 && attempt < retries) {
      const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000); // 1s, 2s, 4s max 5s
      console.warn(`Rate limit Pennylane (429), attente ${waitTime}ms avant retry ${attempt + 1}/${retries}...`);
      await sleep(waitTime);
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Erreur API Pennylane (${response.status}): ${text}`);
    }

    return response.json();
  }

  throw new Error('Erreur API Pennylane: rate limit persistant après ' + retries + ' tentatives');
}

/**
 * Récupère toutes les données paginées d'un endpoint
 * Gère les deux types de pagination Pennylane v2 :
 * - Nouveau : curseur (has_more + next_cursor) - utilisé par ledger_entry_lines, supplier_invoices
 * - Ancien : pages (total_pages + page=X) - utilisé par ledger_accounts, journals
 * @param {string} apiKey - Clé API Pennylane
 * @param {string} endpoint - Endpoint relatif
 * @param {Object} [baseParams] - Paramètres de base
 * @returns {Promise<Object[]>} Toutes les données (dédupliquées par id)
 */
async function getAllPaginated(apiKey, endpoint, baseParams = {}) {
  let allItems = [];
  const maxPages = 1000; // sécurité haute

  // Premier appel pour détecter le type de pagination
  const firstParams = { ...baseParams, per_page: 100 };
  const firstResult = await callPennylaneAPI(apiKey, endpoint, firstParams);
  const firstItems = firstResult.items || firstResult.data || firstResult.entries || [];
  allItems = allItems.concat(firstItems);

  // Détecter le type de pagination
  const usesCursor = firstResult.has_more !== null && firstResult.has_more !== undefined;
  const usesPages = firstResult.total_pages !== null && firstResult.total_pages !== undefined && firstResult.total_pages > 1;

  if (usesCursor && firstResult.has_more && firstResult.next_cursor) {
    // Pagination par curseur (ledger_entry_lines, etc.)
    let cursor = firstResult.next_cursor;
    let pageCount = 1;

    while (pageCount < maxPages && cursor) {
      pageCount++;
      const params = { ...baseParams, per_page: 100, cursor };
      const result = await callPennylaneAPI(apiKey, endpoint, params);
      const items = result.items || result.data || result.entries || [];
      allItems = allItems.concat(items);

      if (result.has_more && result.next_cursor) {
        cursor = result.next_cursor;
        await sleep(150);
      } else {
        break;
      }
    }
  } else if (usesPages) {
    // Pagination par pages (ledger_accounts, journals, etc.)
    const totalPages = firstResult.total_pages;
    for (let page = 2; page <= Math.min(totalPages, maxPages); page++) {
      const params = { ...baseParams, per_page: 100, page };
      const result = await callPennylaneAPI(apiKey, endpoint, params);
      const items = result.items || result.data || result.entries || [];
      allItems = allItems.concat(items);
      await sleep(150);
    }
  }

  // Dédupliquer par id (l'API peut retourner des doublons)
  const seen = new Set();
  const uniqueItems = [];
  for (const item of allItems) {
    const itemId = item.id;
    if (itemId && seen.has(itemId)) continue;
    if (itemId) seen.add(itemId);
    uniqueItems.push(item);
  }

  return uniqueItems;
}

/**
 * Récupère le FEC (Fichier des Écritures Comptables) d'un client pour un exercice
 * Utilise l'endpoint /ledger_entry_lines de l'API Pennylane v2 pour les lignes d'écritures
 * puis enrichit avec /ledger_entries (labels/pièces) et /journals (codes journaux)
 *
 * Structure API Pennylane v2 :
 * - /ledger_entry_lines : lignes avec debit, credit, ledger_account.number, date
 *   Filtre autorisés: id, date, journal_id, ledger_account_id
 *   Pagination par curseur, per_page max réel = 20
 * - /ledger_entries : en-têtes avec label (nom fournisseur), piece_number
 *   Pagination par curseur
 * - /ledger_accounts : plan comptable avec number, label
 *   Pagination par page (page=X, total_pages)
 * - /journals : code et libellé du journal
 *
 * @param {string} apiKey - Clé API Pennylane du client
 * @param {number} millesime - Année fiscale (ex: 2024)
 * @returns {Promise<import('../../types').FECEntry[]>} Écritures comptables
 */
export async function getFEC(apiKey, millesime) {
  const startDate = `${millesime}-01-01`;
  const endDate = `${millesime}-12-31`;

  // 1. Récupérer les référentiels (petites listes, pagination par pages)
  /** @type {Map<number, {code: string, label: string}>} */
  const journalsMap = new Map();
  try {
    const journals = await getAllPaginated(apiKey, '/journals', {});
    for (const j of journals) {
      journalsMap.set(j.id, { code: j.code || '', label: j.label || '' });
    }
  } catch (e) {
    console.warn('Impossible de récupérer les journaux:', e.message);
  }

  /** @type {Map<number, {number: string, label: string}>} */
  const accountsMap = new Map();
  const accounts = await getAllPaginated(apiKey, '/ledger_accounts', {});
  for (const acc of accounts) {
    accountsMap.set(acc.id, { number: acc.number || '', label: acc.label || '' });
  }

  // 2. Récupérer TOUTES les lignes d'écritures pour la période
  // On utilise un filtre par date seulement (les filtres par compte seront faits côté client)
  const dateFilter = JSON.stringify([
    { field: 'date', operator: 'gteq', value: startDate },
    { field: 'date', operator: 'lteq', value: endDate }
  ]);

  const lines = await getAllPaginated(apiKey, '/ledger_entry_lines', { filter: dateFilter });

  // 3. Récupérer les en-têtes d'écritures (labels, pièces, pour enrichir avec le nom fournisseur)
  const entries = await getAllPaginated(apiKey, '/ledger_entries', { filter: dateFilter });

  /** @type {Map<number, {label: string, pieceNumber: string, journalId: number}>} */
  const entriesMap = new Map();
  for (const entry of entries) {
    entriesMap.set(entry.id, {
      label: entry.label || '',
      pieceNumber: entry.piece_number || '',
      journalId: entry.journal_id || entry.journal?.id || 0
    });
  }

  // 4. Mapper les lignes vers le format FEC standard
  return lines.map(line => {
    const parentEntry = entriesMap.get(line.ledger_entry?.id) || { label: '', pieceNumber: '', journalId: 0 };
    const journal = journalsMap.get(line.journal?.id || parentEntry.journalId) || { code: '', label: '' };
    const account = accountsMap.get(line.ledger_account?.id) || null;
    const accountNumber = line.ledger_account?.number || account?.number || '';
    const accountLabel = account?.label || '';

    // Extraire le nom du fournisseur depuis le label de l'écriture parente ou de la ligne
    // Format typique Pennylane :
    //   "Facture FOURNISSEUR - 202504031 (label généré)"
    //   "Avoir FOURNISSEUR - 202504031 (label généré)"
    //   "Facture DOMAFRAIS - LD052010 RLV (label généré)"
    //   "OBD n° 03/2025" ou "SYSCO n° 09/2025"
    const parentLabel = parentEntry.label || '';
    const rawLabel = parentLabel || line.label || '';
    let fournisseurName = '';
    if (rawLabel) {
      let cleaned = rawLabel;
      // 1. Supprimer "(label généré)" en fin
      cleaned = cleaned.replace(/\s*\(label généré\)\s*$/i, '').trim();
      // 2. Supprimer le préfixe "Facture" / "Avoir"
      cleaned = cleaned.replace(/^(?:Facture|Avoir)\s+/i, '').trim();
      // 3. Supprimer le numéro de facture/avoir après le dernier " - "
      const dashIdx = cleaned.lastIndexOf(' - ');
      if (dashIdx > 0) {
        cleaned = cleaned.substring(0, dashIdx).trim();
      }
      // 4. Supprimer les numéros de facture courants : "n° 03/2025", "n°12345", "N° FA-2025-001"
      cleaned = cleaned.replace(/\s*n°\s*.+$/i, '').trim();
      // 5. Supprimer les dates MM/YYYY ou MM-YYYY en fin de nom (ex: "OBD 05/2025")
      cleaned = cleaned.replace(/\s+\d{2}[\/\-]\d{4}\s*$/, '').trim();
      // 6. Supprimer les numéros de facture Pennylane en fin : "F1249246558", "F262614", "F111760"
      cleaned = cleaned.replace(/\s+F\d{4,}\w*\s*$/, '').trim();
      fournisseurName = cleaned || rawLabel;
    }

    const isAuxiliary = accountNumber.startsWith('401') || accountNumber.startsWith('411');

    return {
      JournalCode: journal.code,
      JournalLib: journal.label,
      EcritureNum: (line.ledger_entry?.id || line.id)?.toString() || '',
      EcritureDate: line.date || '',
      CompteNum: accountNumber,
      CompteLib: accountLabel,
      CompAuxNum: isAuxiliary ? accountNumber : '',
      CompAuxLib: fournisseurName || (isAuxiliary ? accountLabel : ''),
      PieceRef: parentEntry.pieceNumber,
      PieceDate: line.date || '',
      EcritureLib: line.label || parentLabel,
      Debit: parseFloat(line.debit) || 0,
      Credit: parseFloat(line.credit) || 0,
      EcritureLet: '',
      DateLet: '',
      ValidDate: '',
      Montantdevise: 0,
      Idevise: 'EUR'
    };
  });
}

/**
 * Récupère les lignes d'écritures filtrées par comptes pour un exercice
 * Version optimisée qui filtre par ledger_account_id côté API
 * Beaucoup plus rapide que getFEC() pour les tests sur des comptes spécifiques
 *
 * @param {string} apiKey - Clé API Pennylane du client
 * @param {number} millesime - Année fiscale
 * @param {string[]} comptePrefixes - Préfixes de comptes à récupérer (ex: ['607', '601'])
 * @returns {Promise<import('../../types').FECEntry[]>} Écritures comptables filtrées
 */
export async function getFECByAccounts(apiKey, millesime, comptePrefixes) {
  const startDate = `${millesime}-01-01`;
  const endDate = `${millesime}-12-31`;

  // 1. Récupérer les référentiels
  /** @type {Map<number, {code: string, label: string}>} */
  const journalsMap = new Map();
  try {
    const journals = await getAllPaginated(apiKey, '/journals', {});
    for (const j of journals) {
      journalsMap.set(j.id, { code: j.code || '', label: j.label || '' });
    }
  } catch (e) {
    console.warn('Impossible de récupérer les journaux:', e.message);
  }

  // 2. Récupérer TOUS les comptes et trouver ceux qui matchent les préfixes
  const allAccounts = await getAllPaginated(apiKey, '/ledger_accounts', {});

  /** @type {Map<number, {number: string, label: string}>} */
  const accountsMap = new Map();
  /** @type {number[]} */
  const targetAccountIds = [];

  for (const acc of allAccounts) {
    accountsMap.set(acc.id, { number: acc.number || '', label: acc.label || '' });
    // Matching bidirectionnel pour gérer les formats différents
    const accNum = acc.number || '';
    const matches = comptePrefixes.some(prefix =>
      accNum.startsWith(prefix) || prefix.startsWith(accNum)
    );
    if (matches && accNum.length > 0) {
      targetAccountIds.push(acc.id);
    }
  }

  console.log(`getFECByAccounts: ${targetAccountIds.length} comptes trouvés pour préfixes [${comptePrefixes.join(', ')}]`);

  // 3. Récupérer les lignes d'écritures pour chaque compte cible
  // Utilise le filtre ledger_account_id côté API = très efficace
  /** @type {Object[]} */
  let allLines = [];

  for (const accountId of targetAccountIds) {
    const filter = JSON.stringify([
      { field: 'date', operator: 'gteq', value: startDate },
      { field: 'date', operator: 'lteq', value: endDate },
      { field: 'ledger_account_id', operator: 'eq', value: accountId }
    ]);

    const lines = await getAllPaginated(apiKey, '/ledger_entry_lines', { filter });
    allLines = allLines.concat(lines);
  }

  console.log(`getFECByAccounts: ${allLines.length} lignes récupérées au total`);

  // 4. Récupérer les en-têtes d'écritures pour enrichir (noms fournisseurs)
  // On ne récupère que les entries parentes des lignes trouvées
  const entryIds = new Set(allLines.map(l => l.ledger_entry?.id).filter(Boolean));

  /** @type {Map<number, {label: string, pieceNumber: string, journalId: number}>} */
  const entriesMap = new Map();

  if (entryIds.size > 0) {
    // Récupérer les entries par lots via le endpoint de liste
    // Comme on ne peut pas filtrer par ID, on récupère toutes les entries de la période
    // et on filtre en mémoire
    const dateFilter = JSON.stringify([
      { field: 'date', operator: 'gteq', value: startDate },
      { field: 'date', operator: 'lteq', value: endDate }
    ]);
    const entries = await getAllPaginated(apiKey, '/ledger_entries', { filter: dateFilter });
    for (const entry of entries) {
      if (entryIds.has(entry.id)) {
        entriesMap.set(entry.id, {
          label: entry.label || '',
          pieceNumber: entry.piece_number || '',
          journalId: entry.journal_id || entry.journal?.id || 0
        });
      }
    }
  }

  // 5. Mapper vers le format FEC
  return allLines.map(line => {
    const parentEntry = entriesMap.get(line.ledger_entry?.id) || { label: '', pieceNumber: '', journalId: 0 };
    const journal = journalsMap.get(line.journal?.id || parentEntry.journalId) || { code: '', label: '' };
    const account = accountsMap.get(line.ledger_account?.id) || null;
    const accountNumber = line.ledger_account?.number || account?.number || '';
    const accountLabel = account?.label || '';

    const parentLabel = parentEntry.label || '';
    const rawLabel = parentLabel || line.label || '';
    let fournisseurName = '';
    if (rawLabel) {
      let cleaned = rawLabel;
      cleaned = cleaned.replace(/\s*\(label généré\)\s*$/i, '').trim();
      cleaned = cleaned.replace(/^(?:Facture|Avoir)\s+/i, '').trim();
      const dashIdx = cleaned.lastIndexOf(' - ');
      if (dashIdx > 0) {
        cleaned = cleaned.substring(0, dashIdx).trim();
      }
      // Supprimer les numéros de facture courants : "n° 03/2025", "n°12345"
      cleaned = cleaned.replace(/\s*n°\s*.+$/i, '').trim();
      // Supprimer les dates MM/YYYY ou MM-YYYY en fin de nom (ex: "OBD 05/2025")
      cleaned = cleaned.replace(/\s+\d{2}[\/\-]\d{4}\s*$/, '').trim();
      // Supprimer les numéros de facture Pennylane en fin : "F1249246558", "F262614"
      cleaned = cleaned.replace(/\s+F\d{4,}\w*\s*$/, '').trim();
      fournisseurName = cleaned || rawLabel;
    }

    const isAuxiliary = accountNumber.startsWith('401') || accountNumber.startsWith('411');

    return {
      JournalCode: journal.code,
      JournalLib: journal.label,
      EcritureNum: (line.ledger_entry?.id || line.id)?.toString() || '',
      EcritureDate: line.date || '',
      CompteNum: accountNumber,
      CompteLib: accountLabel,
      CompAuxNum: isAuxiliary ? accountNumber : '',
      CompAuxLib: fournisseurName || (isAuxiliary ? accountLabel : ''),
      PieceRef: parentEntry.pieceNumber,
      PieceDate: line.date || '',
      EcritureLib: line.label || parentLabel,
      Debit: parseFloat(line.debit) || 0,
      Credit: parseFloat(line.credit) || 0,
      EcritureLet: '',
      DateLet: '',
      ValidDate: '',
      Montantdevise: 0,
      Idevise: 'EUR'
    };
  });
}

/**
 * Récupère les écritures FEC filtrées par préfixes de comptes avec dates personnalisées
 * Variante de getFECByAccounts qui accepte une plage de dates au lieu d'un millésime
 * @param {string} apiKey - Clé API Pennylane du client
 * @param {string} startDate - Date début au format 'YYYY-MM-DD'
 * @param {string} endDate - Date fin au format 'YYYY-MM-DD'
 * @param {string[]} comptePrefixes - Préfixes de comptes à récupérer (ex: ['164', '421', '512'])
 * @returns {Promise<import('../../types').FECEntry[]>} Écritures comptables filtrées
 */
export async function getFECByAccountsToDate(apiKey, startDate, endDate, comptePrefixes) {
  // 1. Récupérer les référentiels
  /** @type {Map<number, {code: string, label: string}>} */
  const journalsMap = new Map();
  try {
    const journals = await getAllPaginated(apiKey, '/journals', {});
    for (const j of journals) {
      journalsMap.set(j.id, { code: j.code || '', label: j.label || '' });
    }
  } catch (e) {
    console.warn('Impossible de récupérer les journaux:', e.message);
  }

  // 2. Récupérer TOUS les comptes et trouver ceux qui matchent les préfixes
  const allAccounts = await getAllPaginated(apiKey, '/ledger_accounts', {});

  /** @type {Map<number, {number: string, label: string}>} */
  const accountsMap = new Map();
  /** @type {number[]} */
  const targetAccountIds = [];

  for (const acc of allAccounts) {
    accountsMap.set(acc.id, { number: acc.number || '', label: acc.label || '' });
    const accNum = acc.number || '';
    const matches = comptePrefixes.some(prefix =>
      accNum.startsWith(prefix) || prefix.startsWith(accNum)
    );
    if (matches && accNum.length > 0) {
      targetAccountIds.push(acc.id);
    }
  }

  console.log(`getFECByAccountsToDate: ${targetAccountIds.length} comptes trouvés pour préfixes [${comptePrefixes.join(', ')}] (${startDate} → ${endDate})`);

  // 3. Récupérer les lignes d'écritures pour chaque compte cible
  /** @type {Object[]} */
  let allLines = [];

  for (const accountId of targetAccountIds) {
    const filter = JSON.stringify([
      { field: 'date', operator: 'gteq', value: startDate },
      { field: 'date', operator: 'lteq', value: endDate },
      { field: 'ledger_account_id', operator: 'eq', value: accountId }
    ]);

    const lines = await getAllPaginated(apiKey, '/ledger_entry_lines', { filter });
    allLines = allLines.concat(lines);
  }

  console.log(`getFECByAccountsToDate: ${allLines.length} lignes récupérées au total`);

  // 4. Récupérer les en-têtes d'écritures pour enrichir
  const entryIds = new Set(allLines.map(l => l.ledger_entry?.id).filter(Boolean));

  /** @type {Map<number, {label: string, pieceNumber: string, journalId: number}>} */
  const entriesMap = new Map();

  if (entryIds.size > 0) {
    const dateFilter = JSON.stringify([
      { field: 'date', operator: 'gteq', value: startDate },
      { field: 'date', operator: 'lteq', value: endDate }
    ]);
    const entries = await getAllPaginated(apiKey, '/ledger_entries', { filter: dateFilter });
    for (const entry of entries) {
      if (entryIds.has(entry.id)) {
        entriesMap.set(entry.id, {
          label: entry.label || '',
          pieceNumber: entry.piece_number || '',
          journalId: entry.journal_id || entry.journal?.id || 0
        });
      }
    }
  }

  // 5. Mapper vers le format FEC
  return allLines.map(line => {
    const parentEntry = entriesMap.get(line.ledger_entry?.id) || { label: '', pieceNumber: '', journalId: 0 };
    const journal = journalsMap.get(line.journal?.id || parentEntry.journalId) || { code: '', label: '' };
    const account = accountsMap.get(line.ledger_account?.id) || null;
    const accountNumber = line.ledger_account?.number || account?.number || '';
    const accountLabel = account?.label || '';

    const parentLabel = parentEntry.label || '';
    const rawLabel = parentLabel || line.label || '';
    let fournisseurName = '';
    if (rawLabel) {
      let cleaned = rawLabel;
      cleaned = cleaned.replace(/\s*\(label généré\)\s*$/i, '').trim();
      cleaned = cleaned.replace(/^(?:Facture|Avoir)\s+/i, '').trim();
      const dashIdx = cleaned.lastIndexOf(' - ');
      if (dashIdx > 0) {
        cleaned = cleaned.substring(0, dashIdx).trim();
      }
      cleaned = cleaned.replace(/\s*n°\s*.+$/i, '').trim();
      cleaned = cleaned.replace(/\s+\d{2}[\/\-]\d{4}\s*$/, '').trim();
      cleaned = cleaned.replace(/\s+F\d{4,}\w*\s*$/, '').trim();
      fournisseurName = cleaned || rawLabel;
    }

    const isAuxiliary = accountNumber.startsWith('401') || accountNumber.startsWith('411');

    return {
      JournalCode: journal.code,
      JournalLib: journal.label,
      EcritureNum: (line.ledger_entry?.id || line.id)?.toString() || '',
      EcritureDate: line.date || '',
      CompteNum: accountNumber,
      CompteLib: accountLabel,
      CompAuxNum: isAuxiliary ? accountNumber : '',
      CompAuxLib: fournisseurName || (isAuxiliary ? accountLabel : ''),
      PieceRef: parentEntry.pieceNumber,
      PieceDate: line.date || '',
      EcritureLib: line.label || parentLabel,
      Debit: parseFloat(line.debit) || 0,
      Credit: parseFloat(line.credit) || 0,
      EcritureLet: '',
      DateLet: '',
      ValidDate: '',
      Montantdevise: 0,
      Idevise: 'EUR'
    };
  });
}

/**
 * Récupère les factures fournisseurs
 * @param {string} apiKey - Clé API Pennylane du client
 * @param {number} millesime - Année fiscale
 * @returns {Promise<Object[]>} Liste des factures fournisseurs
 */
export async function getSupplierInvoices(apiKey, millesime) {
  const startDate = `${millesime}-01-01`;
  const endDate = `${millesime}-12-31`;

  const filter = JSON.stringify([
    { field: 'date', operator: 'gteq', value: startDate },
    { field: 'date', operator: 'lteq', value: endDate }
  ]);

  return getAllPaginated(apiKey, '/supplier_invoices', { filter });
}

/**
 * Récupère les factures clients
 * @param {string} apiKey - Clé API Pennylane du client
 * @param {number} millesime - Année fiscale
 * @returns {Promise<Object[]>} Liste des factures clients
 */
export async function getCustomerInvoices(apiKey, millesime) {
  const startDate = `${millesime}-01-01`;
  const endDate = `${millesime}-12-31`;

  const filter = JSON.stringify([
    { field: 'date', operator: 'gteq', value: startDate },
    { field: 'date', operator: 'lteq', value: endDate }
  ]);

  return getAllPaginated(apiKey, '/customer_invoices', { filter });
}

/**
 * Récupère les opérations bancaires
 * @param {string} apiKey - Clé API Pennylane du client
 * @param {number} millesime - Année fiscale
 * @returns {Promise<Object[]>} Liste des opérations bancaires
 */
export async function getBankTransactions(apiKey, millesime) {
  const startDate = `${millesime}-01-01`;
  const endDate = `${millesime}-12-31`;

  const filter = JSON.stringify([
    { field: 'date', operator: 'gteq', value: startDate },
    { field: 'date', operator: 'lteq', value: endDate }
  ]);

  return getAllPaginated(apiKey, '/bank_transactions', { filter });
}

/**
 * Récupère le plan comptable (liste des comptes)
 * API Pennylane v2 utilise /ledger_accounts
 * @param {string} apiKey - Clé API Pennylane du client
 * @returns {Promise<Object[]>} Liste des comptes
 */
export async function getChartOfAccounts(apiKey) {
  return getAllPaginated(apiKey, '/ledger_accounts');
}

/**
 * Récupère les fournisseurs
 * @param {string} apiKey - Clé API Pennylane du client
 * @returns {Promise<Object[]>} Liste des fournisseurs
 */
export async function getSuppliers(apiKey) {
  return getAllPaginated(apiKey, '/suppliers');
}

/**
 * Récupère tous les comptes du plan comptable (ledger_accounts)
 * @param {string} apiKey - Clé API Pennylane du client
 * @returns {Promise<Object[]>} Liste des comptes avec id, number, label
 */
export async function getLedgerAccounts(apiKey) {
  return getAllPaginated(apiKey, '/ledger_accounts');
}

/**
 * Teste la connexion à l'API avec une clé donnée
 * Utilise l'endpoint /me de l'API Pennylane v2
 * @param {string} apiKey - Clé API à tester
 * @returns {Promise<{success: boolean, error?: string}>} Résultat du test
 */
export async function testConnection(apiKey) {
  try {
    // API Pennylane v2 utilise /me pour vérifier l'authentification
    await callPennylaneAPI(apiKey, '/me', {});
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    };
  }
}
