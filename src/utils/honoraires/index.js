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

// Classification & Axes
export {
  AXE_DEFINITIONS,
  AXE_KEYS,
  classifierLigne,
  detectModeFacturationSocial,
  classifierToutesLesLignes
} from './classificationAxes.js';

// Calculs augmentation
export {
  calculerAugmentationLigne,
  calculerAugmentationGlobale,
  calculerTotauxResume,
  creerParametresDefaut,
  getCoeffAnnualisation
} from './calculsAugmentation.js';

// Silae
export {
  parseSilaeExcel,
  getSilaeMapping,
  updateSilaeMapping,
  importSilaeData,
  getSilaeProductions,
  getSilaePeriodes
} from './silaeService.js';

// Export augmentation
export { exportAugmentationExcel } from './exportAugmentation.js';

// Diagnostic
export { genererDiagnostic } from './diagnosticHonoraires.js';
export { exportDiagnosticExcel } from './exportDiagnostic.js';
