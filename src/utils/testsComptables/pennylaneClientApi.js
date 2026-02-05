// @ts-check

/**
 * @file Client API Pennylane pour les données comptables d'un client spécifique
 * Ce module gère les appels API vers Pennylane avec la clé API propre à chaque client
 * Utilise le proxy serverless /api/pennylane-proxy pour éviter les problèmes CORS
 */

// URL du proxy API (fonction serverless Vercel)
const PROXY_URL = '/api/pennylane-proxy';

/**
 * Effectue un appel à l'API Pennylane via le proxy
 * @param {string} apiKey - Clé API Pennylane du client
 * @param {string} endpoint - Endpoint relatif (ex: '/accounting_entries')
 * @param {Object} [params] - Paramètres de requête optionnels
 * @returns {Promise<Object>} Réponse de l'API
 */
export async function callPennylaneAPI(apiKey, endpoint, params = {}) {
  const url = new URL(PROXY_URL, window.location.origin);

  // Ajouter l'endpoint comme paramètre
  url.searchParams.append('endpoint', endpoint);

  // Ajouter les autres paramètres de requête
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-Pennylane-Api-Key': apiKey,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erreur API Pennylane (${response.status}): ${text}`);
  }

  return response.json();
}

/**
 * Récupère toutes les données paginées d'un endpoint
 * @param {string} apiKey - Clé API Pennylane
 * @param {string} endpoint - Endpoint relatif
 * @param {Object} [baseParams] - Paramètres de base
 * @returns {Promise<Object[]>} Toutes les données
 */
async function getAllPaginated(apiKey, endpoint, baseParams = {}) {
  let allItems = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await callPennylaneAPI(apiKey, endpoint, {
      ...baseParams,
      page,
      per_page: 100
    });

    const items = result.items || result.data || result.entries || [];
    allItems = allItems.concat(items);

    // Vérifier s'il y a d'autres pages
    const totalPages = result.total_pages || result.pagination?.total_pages || 1;
    hasMore = page < totalPages;
    page++;
  }

  return allItems;
}

/**
 * Récupère le FEC (Fichier des Écritures Comptables) d'un client pour un exercice
 * Utilise l'endpoint /ledger_entries de l'API Pennylane v2
 * @param {string} apiKey - Clé API Pennylane du client
 * @param {number} millesime - Année fiscale (ex: 2024)
 * @returns {Promise<import('../../types').FECEntry[]>} Écritures comptables
 */
export async function getFEC(apiKey, millesime) {
  const startDate = `${millesime}-01-01`;
  const endDate = `${millesime}-12-31`;

  // API Pennylane v2 utilise /ledger_entries avec un filtre JSON
  // Format: filter=[{field: 'date', operator: 'gteq', value: '2024-01-01'}, ...]
  const filter = JSON.stringify([
    { field: 'date', operator: 'gteq', value: startDate },
    { field: 'date', operator: 'lteq', value: endDate }
  ]);

  const entries = await getAllPaginated(apiKey, '/ledger_entries', {
    filter
  });

  // Mapper vers le format FEC standard
  return entries.map(entry => ({
    JournalCode: entry.journal_code || entry.journal?.code || '',
    JournalLib: entry.journal_label || entry.journal?.label || '',
    EcritureNum: entry.entry_number || entry.id?.toString() || '',
    EcritureDate: entry.date || entry.entry_date || '',
    CompteNum: entry.account_number || entry.account?.number || '',
    CompteLib: entry.account_label || entry.account?.label || '',
    CompAuxNum: entry.auxiliary_account_number || '',
    CompAuxLib: entry.auxiliary_account_label || '',
    PieceRef: entry.document_reference || entry.piece_ref || '',
    PieceDate: entry.document_date || entry.piece_date || '',
    EcritureLib: entry.label || entry.description || '',
    Debit: parseFloat(entry.debit) || 0,
    Credit: parseFloat(entry.credit) || 0,
    EcritureLet: entry.lettering || '',
    DateLet: entry.lettering_date || '',
    ValidDate: entry.validation_date || '',
    Montantdevise: parseFloat(entry.currency_amount) || 0,
    Idevise: entry.currency || 'EUR'
  }));
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
