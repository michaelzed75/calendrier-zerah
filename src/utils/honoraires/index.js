// @ts-check

/**
 * @file Module Honoraires
 * Gestion des honoraires facturés, abonnements Pennylane et analyse de rentabilité
 */

// API Pennylane Customers & Subscriptions
export {
  getAllCustomers,
  getCustomerById,
  getAllSubscriptions,
  getSubscriptionInvoiceLines,
  getSubscriptionWithLines,
  testConnection,
  fetchAllDataForSync
} from './pennylaneCustomersApi.js';

// Synchronisation
export {
  syncCustomersAndSubscriptions,
  getHonorairesResume
} from './syncHonoraires.js';
