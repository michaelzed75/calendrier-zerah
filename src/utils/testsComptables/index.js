// @ts-check

/**
 * @file Export centralisé du module Tests Comptables
 */

// Client API Pennylane
export {
  callPennylaneAPI,
  getFEC,
  getFECByAccounts,
  getSupplierInvoices,
  getCustomerInvoices,
  getBankTransactions,
  getChartOfAccounts,
  getSuppliers,
  getLedgerAccounts,
  testConnection
} from './pennylaneClientApi.js';

// Orchestrateur de tests
export {
  runTest,
  getExecutionHistory,
  getExecutionResults,
  markAsProcessed,
  getTestDefinitions
} from './testRunner.js';

// Registre des tests
export {
  testsRegistry,
  getTest,
  getAllTests,
  getTestsByCategory,
  categories
} from './tests/index.js';

// Export Excel et Word
export {
  exportTestResults,
  exportHistorique,
  exportDonneesAnalysees,
  exportAttestationWord
} from './exportResults.js';
