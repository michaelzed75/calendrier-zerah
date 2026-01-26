// @ts-check

/**
 * @file Service API Pennylane pour les Customers et Billing Subscriptions
 * Gère la récupération des clients (customers) et abonnements (billing_subscriptions)
 * depuis l'API Pennylane v2 pour la facturation des honoraires.
 *
 * Utilise le proxy serverless /api/pennylane-proxy pour éviter les problèmes CORS.
 */

// URL du proxy API (fonction serverless Vercel)
const PROXY_URL = '/api/pennylane-proxy';

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
 * @param {string} apiKey - Clé API à tester
 * @returns {Promise<{success: boolean, error?: string}>} Résultat du test
 */
export async function testConnection(apiKey) {
  try {
    await callPennylaneAPI(apiKey, '/me', {});
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
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
