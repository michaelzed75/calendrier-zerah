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
  setCompanyId,
  fetchAllDataForSync
} from './pennylaneCustomersApi.js';

// Synchronisation
export {
  syncCustomersAndSubscriptions,
  getHonorairesResume,
  normalizeString,
  removeJuridicalSuffixes,
  matchCustomerToClient,
  getFamilleFromLabel
} from './syncHonoraires.js';

// Sync Preview & Commit
export {
  previewSync,
  commitSync
} from './syncPreview.js';

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

// Audit
export { auditAbonnements } from './auditHonoraires.js';

// Réconciliation
export { reconcilierDonnees } from './reconciliation.js';

// Tarifs de référence
export {
  sauvegarderTarifsBaseline,
  sauvegarderTarifsReference,
  chargerTarifsReference,
  getDatesEffetDisponibles,
  chargerProduitsPennylane,
  supprimerTarifsReference
} from './tarifsReferenceService.js';

// Restructuration abonnements (Phase 2)
export {
  analyserClient,
  analyserTousLesClients,
  calculerStatistiques
} from './subscriptionRestructuration.js';

// Export restructuration
export { exportRestructurationExcel } from './exportRestructuration.js';
