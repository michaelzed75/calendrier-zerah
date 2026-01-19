// @ts-check

/**
 * @file Export centralisé du module Tests Comptables
 */

// Client API Pennylane
export {
  callPennylaneAPI,
  getFEC,
  getSupplierInvoices,
  getCustomerInvoices,
  getBankTransactions,
  getChartOfAccounts,
  getSuppliers,
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

// Export Excel
export {
  exportTestResults,
  exportHistorique
} from './exportResults.js';
