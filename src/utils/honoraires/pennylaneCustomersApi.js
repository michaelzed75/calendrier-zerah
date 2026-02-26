// @ts-check

/**
 * @file Service API Pennylane pour les Customers et Billing Subscriptions
 * Gère la récupération des clients (customers) et abonnements (billing_subscriptions)
 * depuis l'API Pennylane v2 pour la facturation des honoraires.
 *
 * Utilise le proxy serverless /api/pennylane-proxy pour éviter les problèmes CORS.
 * L'API Pennylane v2 exige un header X-Company-Id pour identifier la société.
 */

// URL du proxy API (fonction serverless Vercel)
const PROXY_URL = '/api/pennylane-proxy';

// Company ID Pennylane (set via setCompanyId avant les appels)
let _companyId = null;

/**
 * Configure le Company ID Pennylane pour tous les appels API
 * @param {string|null} companyId - L'identifiant de la société Pennylane
 */
export function setCompanyId(companyId) {
  _companyId = companyId;
  console.log(`[PennylaneAPI] Company ID configuré: ${companyId || '(vide)'}`);
}

/**
 * Effectue un appel à l'API Pennylane via le proxy
 * @param {string} apiKey - Clé API Pennylane
 * @param {string} endpoint - Endpoint relatif (ex: '/customers')
 * @param {Object} [params] - Paramètres de requête optionnels
 * @returns {Promise<Object>} Réponse de l'API
 */
async function callPennylaneAPI(apiKey, endpoint, params = {}) {
  const url = new URL(PROXY_URL, window.location.origin);

  // Ajouter l'endpoint comme paramètre
  url.searchParams.append('endpoint', endpoint);

  // Ajouter les autres paramètres de requête
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });

  console.log(`[callPennylaneAPI] ${endpoint} → ${url.toString()}`);

  const headers = {
    'X-Pennylane-Api-Key': apiKey,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  // Ajouter le Company ID si configuré
  if (_companyId) {
    headers['X-Company-Id'] = _companyId;
  }

  // Retry avec backoff sur 429 (rate limit)
  const MAX_RETRIES = 5;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers
    });

    console.log(`[callPennylaneAPI] ${endpoint} → status ${response.status}`);

    if (response.status === 429) {
      const waitSec = Math.min(attempt * 2, 10);
      console.warn(`[callPennylaneAPI] Rate limit 429 — retry ${attempt}/${MAX_RETRIES} dans ${waitSec}s`);
      await new Promise(r => setTimeout(r, waitSec * 1000));
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      console.error(`[callPennylaneAPI] ${endpoint} → erreur:`, text);
      throw new Error(`Erreur API Pennylane (${response.status}): ${text}`);
    }

    return response.json();
  }
  throw new Error(`Rate limit Pennylane dépassé après ${MAX_RETRIES} tentatives sur ${endpoint}`);
}

/**
 * Récupère toutes les données paginées d'un endpoint (avec curseur)
 * @param {string} apiKey - Clé API Pennylane
 * @param {string} endpoint - Endpoint relatif
 * @param {Object} [baseParams] - Paramètres de base
 * @param {function} [onProgress] - Callback de progression (page, total)
 * @returns {Promise<Object[]>} Toutes les données
 */
async function getAllPaginated(apiKey, endpoint, baseParams = {}, onProgress = null) {
  let allItems = [];
  let cursor = null;
  let pageNum = 0;

  while (true) {
    pageNum++;
    const params = { ...baseParams, per_page: 100 };
    if (cursor) {
      params.cursor = cursor;
    }

    const result = await callPennylaneAPI(apiKey, endpoint, params);

    const items = result.items || [];
    allItems = allItems.concat(items);

    if (onProgress) {
      onProgress(pageNum, allItems.length);
    }

    // Vérifier s'il y a d'autres pages
    if (result.has_more === false || !result.next_cursor) {
      break;
    }
    cursor = result.next_cursor;
  }

  return allItems;
}

/**
 * @typedef {Object} PennylaneCustomer
 * @property {number} id - ID du customer Pennylane
 * @property {string} name - Nom du client
 * @property {string} [external_reference] - Référence externe (C1VPBATI...)
 * @property {string} [reference] - Référence
 * @property {string} [reg_no] - SIREN
 * @property {string} [vat_number] - N° TVA
 * @property {string} customer_type - Type (company/individual)
 * @property {string} payment_conditions - Conditions de paiement
 * @property {string[]} [emails] - Emails
 * @property {Object} [billing_address] - Adresse de facturation
 */

/**
 * @typedef {Object} PennylaneSubscription
 * @property {number} id - ID de l'abonnement
 * @property {string} label - Label/Nom
 * @property {string} status - Statut (in_progress, not_started, stopped, finished)
 * @property {string} start - Date de début
 * @property {string} [finish] - Date de fin
 * @property {string} mode - Mode de finalisation
 * @property {string} payment_conditions - Conditions de paiement
 * @property {string} payment_method - Moyen de paiement
 * @property {Object} recurring_rule - Règle de récurrence
 * @property {Object} customer - Customer lié
 * @property {Object} customer_invoice_data - Données de facturation
 */

/**
 * @typedef {Object} PennylaneInvoiceLine
 * @property {number} id - ID de la ligne
 * @property {string} label - Label du produit
 * @property {string} quantity - Quantité
 * @property {string} amount - Montant TTC
 * @property {string} currency_amount_before_tax - Montant HT
 * @property {string} vat_rate - Taux TVA (FR_200...)
 * @property {string} [description] - Description
 */

/**
 * Récupère tous les customers Pennylane
 * @param {string} apiKey - Clé API Pennylane
 * @param {function} [onProgress] - Callback de progression
 * @returns {Promise<PennylaneCustomer[]>} Liste des customers
 */
export async function getAllCustomers(apiKey, onProgress = null) {
  return getAllPaginated(apiKey, '/customers', {}, onProgress);
}

/**
 * Récupère un customer par son ID
 * @param {string} apiKey - Clé API Pennylane
 * @param {number} customerId - ID du customer
 * @returns {Promise<PennylaneCustomer>} Customer
 */
export async function getCustomerById(apiKey, customerId) {
  return callPennylaneAPI(apiKey, `/customers/${customerId}`);
}

/**
 * Récupère tous les billing subscriptions
 * @param {string} apiKey - Clé API Pennylane
 * @param {function} [onProgress] - Callback de progression
 * @returns {Promise<PennylaneSubscription[]>} Liste des abonnements
 */
export async function getAllSubscriptions(apiKey, onProgress = null) {
  return getAllPaginated(apiKey, '/billing_subscriptions', {}, onProgress);
}

/**
 * Récupère les lignes de facturation d'un abonnement
 * @param {string} apiKey - Clé API Pennylane
 * @param {number} subscriptionId - ID de l'abonnement
 * @returns {Promise<PennylaneInvoiceLine[]>} Lignes de facturation
 */
export async function getSubscriptionInvoiceLines(apiKey, subscriptionId) {
  const result = await callPennylaneAPI(apiKey, `/billing_subscriptions/${subscriptionId}/invoice_lines`);
  return result.items || [];
}

/**
 * Récupère un abonnement avec ses lignes de facturation
 * @param {string} apiKey - Clé API Pennylane
 * @param {number} subscriptionId - ID de l'abonnement
 * @returns {Promise<{subscription: PennylaneSubscription, lines: PennylaneInvoiceLine[]}>}
 */
export async function getSubscriptionWithLines(apiKey, subscriptionId) {
  const [subscription, lines] = await Promise.all([
    callPennylaneAPI(apiKey, `/billing_subscriptions/${subscriptionId}`),
    getSubscriptionInvoiceLines(apiKey, subscriptionId)
  ]);
  return { subscription, lines };
}

/**
 * Teste la connexion à l'API avec une clé donnée
 * Utilise /me qui ne nécessite aucun scope (valide pour tout token)
 * @param {string} apiKey - Clé API à tester
 * @returns {Promise<{success: boolean, error?: string, data?: Object}>} Résultat du test
 */
export async function testConnection(apiKey) {
  try {
    console.log('[testConnection] Test avec /me...');
    const result = await callPennylaneAPI(apiKey, '/me', {});
    console.log('[testConnection] Succès:', result);
    return { success: true, data: result };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('[testConnection] Échec:', errorMsg);
    return {
      success: false,
      error: errorMsg
    };
  }
}

/**
 * Récupère toutes les données nécessaires pour la synchronisation
 * @param {string} apiKey - Clé API Pennylane
 * @param {function} [onProgress] - Callback de progression ({step, message, current, total})
 * @returns {Promise<{customers: PennylaneCustomer[], subscriptions: PennylaneSubscription[]}>}
 */
export async function fetchAllDataForSync(apiKey, onProgress = null) {
  const report = (step, message, current = 0, total = 0) => {
    if (onProgress) {
      onProgress({ step, message, current, total });
    }
  };

  report('customers', 'Récupération des customers Pennylane...');
  const customers = await getAllCustomers(apiKey, (page, total) => {
    report('customers', `Récupération des customers... (page ${page}, ${total} récupérés)`, total, 0);
  });
  report('customers', `${customers.length} customers récupérés`, customers.length, customers.length);

  report('subscriptions', 'Récupération des abonnements Pennylane...');
  const subscriptions = await getAllSubscriptions(apiKey, (page, total) => {
    report('subscriptions', `Récupération des abonnements... (page ${page}, ${total} récupérés)`, total, 0);
  });
  report('subscriptions', `${subscriptions.length} abonnements récupérés`, subscriptions.length, subscriptions.length);

  return { customers, subscriptions };
}

/**
 * Récupère tous les produits Pennylane (paginé)
 * @param {string} apiKey - Clé API Pennylane
 * @param {function} [onProgress] - Callback de progression (page, total)
 * @returns {Promise<Object[]>} Liste des produits PL
 */
export async function getAllProducts(apiKey, onProgress = null) {
  return getAllPaginated(apiKey, '/products', {}, onProgress);
}

// ═══════════════════ WRITE API (Nettoyage Pennylane) ═══════════════════

/**
 * Effectue un appel WRITE à l'API Pennylane via le proxy (POST/PUT/DELETE/PATCH)
 * @param {string} apiKey
 * @param {'POST'|'PUT'|'DELETE'|'PATCH'} method
 * @param {string} endpoint - ex: '/customer_invoices/123'
 * @param {Object} [body] - Corps de la requête (pour POST/PUT/PATCH)
 * @param {Object} [params] - Query params optionnels
 * @returns {Promise<Object|null>} Réponse de l'API (null pour 204 No Content)
 */
async function callPennylaneWriteAPI(apiKey, method, endpoint, body = null, params = {}) {
  const url = new URL(PROXY_URL, window.location.origin);
  url.searchParams.append('endpoint', endpoint);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });

  console.log(`[callPennylaneWriteAPI] ${method} ${endpoint}`);

  const headers = {
    'X-Pennylane-Api-Key': apiKey,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  if (_companyId) {
    headers['X-Company-Id'] = _companyId;
  }

  const fetchOptions = { method, headers };
  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    fetchOptions.body = JSON.stringify(body);
  }

  // Retry sur 429
  const MAX_RETRIES = 5;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url.toString(), fetchOptions);

    if (response.status === 429) {
      const waitSec = Math.min(attempt * 2, 10);
      console.warn(`[callPennylaneWriteAPI] Rate limit 429 — retry ${attempt}/${MAX_RETRIES} dans ${waitSec}s`);
      await new Promise(r => setTimeout(r, waitSec * 1000));
      continue;
    }

    // 204 No Content (typique pour DELETE)
    if (response.status === 204) {
      return null;
    }

    if (!response.ok) {
      const text = await response.text();
      console.error(`[callPennylaneWriteAPI] ${method} ${endpoint} → erreur:`, text);
      throw new Error(`Erreur API Pennylane ${method} (${response.status}): ${text}`);
    }

    return response.json();
  }
  throw new Error(`Rate limit Pennylane dépassé après ${MAX_RETRIES} tentatives sur ${method} ${endpoint}`);
}

/**
 * Liste les factures clients (brouillons, finalisées, etc.)
 * @param {string} apiKey
 * @param {Object} [filters] - { status, date_from, date_to }
 * @returns {Promise<Object[]>}
 */
export async function listCustomerInvoices(apiKey, filters = {}) {
  const params = {};
  if (filters.status) params.status = filters.status;
  const filterArr = [];
  if (filters.date_from) filterArr.push({ field: 'date', operator: 'gteq', value: filters.date_from });
  if (filters.date_to) filterArr.push({ field: 'date', operator: 'lteq', value: filters.date_to });
  if (filterArr.length > 0) params.filter = JSON.stringify(filterArr);
  return getAllPaginated(apiKey, '/customer_invoices', params);
}

/**
 * Supprime une facture brouillon
 * @param {string} apiKey
 * @param {number} invoiceId
 * @returns {Promise<null>}
 */
export async function deleteDraftInvoice(apiKey, invoiceId) {
  return callPennylaneWriteAPI(apiKey, 'DELETE', `/customer_invoices/${invoiceId}`);
}

/**
 * Met à jour une facture brouillon (lignes, montants)
 * @param {string} apiKey
 * @param {number} invoiceId
 * @param {Object} data - Données de mise à jour
 * @returns {Promise<Object>}
 */
export async function updateDraftInvoice(apiKey, invoiceId, data) {
  return callPennylaneWriteAPI(apiKey, 'PUT', `/customer_invoices/${invoiceId}`, data);
}

/**
 * Supprime un abonnement récurrent
 * @param {string} apiKey
 * @param {number} subscriptionId
 * @returns {Promise<null>}
 */
export async function deleteSubscription(apiKey, subscriptionId) {
  return callPennylaneWriteAPI(apiKey, 'DELETE', `/billing_subscriptions/${subscriptionId}`);
}

/**
 * Crée un nouvel abonnement récurrent
 * @param {string} apiKey
 * @param {Object} data - Données de l'abonnement
 * @returns {Promise<Object>}
 */
export async function createSubscription(apiKey, data) {
  return callPennylaneWriteAPI(apiKey, 'POST', '/billing_subscriptions', data);
}
