// @ts-check

/**
 * @file Orchestrateur d'exécution des tests comptables
 * Gère le chargement des données, l'exécution des tests et la sauvegarde des résultats
 */

import { supabase } from '../../supabaseClient.js';
import { getFEC, getSupplierInvoices, getBankTransactions } from './pennylaneClientApi.js';
import { getTest } from './tests/index.js';

/**
 * @typedef {Object} RunTestParams
 * @property {number} clientId - ID du client
 * @property {string} testCode - Code du test à exécuter
 * @property {number} millesime - Année fiscale
 * @property {number} collaborateurId - ID du collaborateur qui lance le test
 * @property {string} pennylaneApiKey - Clé API Pennylane du client
 * @property {Object} [options] - Options supplémentaires du test
 */

/**
 * @typedef {Object} RunTestResult
 * @property {boolean} success - Si le test a réussi
 * @property {number} [executionId] - ID de l'exécution créée
 * @property {import('../../types').TestResultAnomalie[]} [anomalies] - Anomalies détectées
 * @property {string} [error] - Message d'erreur si échec
 * @property {number} [dureeMs] - Durée d'exécution en ms
 */

/**
 * Récupère les données requises par un test
 * @param {string[]} requiredData - Types de données requis
 * @param {string} apiKey - Clé API Pennylane
 * @param {number} millesime - Année fiscale
 * @returns {Promise<Object>} Données récupérées
 */
async function fetchRequiredData(requiredData, apiKey, millesime) {
  const data = {};

  for (const dataType of requiredData) {
    switch (dataType) {
      case 'fec':
        data.fec = await getFEC(apiKey, millesime);
        break;
      case 'invoices':
      case 'supplierInvoices':
        data.supplierInvoices = await getSupplierInvoices(apiKey, millesime);
        break;
      case 'bankTransactions':
        data.bankTransactions = await getBankTransactions(apiKey, millesime);
        break;
      default:
        console.warn(`Type de données inconnu: ${dataType}`);
    }
  }

  return data;
}

/**
 * Exécute un test comptable
 * @param {RunTestParams} params - Paramètres d'exécution
 * @returns {Promise<RunTestResult>} Résultat de l'exécution
 */
export async function runTest(params) {
  const { clientId, testCode, millesime, collaborateurId, pennylaneApiKey, options = {} } = params;
  const startTime = Date.now();

  // Vérifier que le test existe
  const testDefinition = getTest(testCode);
  if (!testDefinition) {
    return {
      success: false,
      error: `Test inconnu: ${testCode}`
    };
  }

  // Créer l'entrée d'exécution en BDD
  const { data: execution, error: insertError } = await supabase
    .from('tests_comptables_executions')
    .insert([{
      client_id: clientId,
      test_code: testCode,
      collaborateur_id: collaborateurId,
      millesime,
      statut: 'en_cours',
      nombre_anomalies: 0
    }])
    .select()
    .single();

  if (insertError || !execution) {
    return {
      success: false,
      error: `Erreur création exécution: ${insertError?.message || 'Données manquantes'}`
    };
  }

  try {
    // Récupérer les données nécessaires via l'API Pennylane
    const data = await fetchRequiredData(testDefinition.requiredData, pennylaneApiKey, millesime);

    // Exécuter le test
    const anomalies = await testDefinition.execute({
      ...data,
      options
    });

    const dureeMs = Date.now() - startTime;

    // Sauvegarder les résultats
    if (anomalies.length > 0) {
      const resultatsToInsert = anomalies.map(anomalie => ({
        execution_id: execution.id,
        type_anomalie: anomalie.type_anomalie,
        severite: anomalie.severite,
        donnees: anomalie.donnees,
        commentaire: anomalie.commentaire || null,
        traite: false
      }));

      const { error: resultError } = await supabase
        .from('tests_comptables_resultats')
        .insert(resultatsToInsert);

      if (resultError) {
        console.error('Erreur sauvegarde résultats:', resultError);
      }
    }

    // Mettre à jour l'exécution
    await supabase
      .from('tests_comptables_executions')
      .update({
        statut: 'termine',
        duree_ms: dureeMs,
        nombre_anomalies: anomalies.length
      })
      .eq('id', execution.id);

    return {
      success: true,
      executionId: execution.id,
      anomalies,
      dureeMs
    };

  } catch (error) {
    const dureeMs = Date.now() - startTime;

    // Marquer l'exécution en erreur
    await supabase
      .from('tests_comptables_executions')
      .update({
        statut: 'erreur',
        duree_ms: dureeMs
      })
      .eq('id', execution.id);

    return {
      success: false,
      executionId: execution.id,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      dureeMs
    };
  }
}

/**
 * Récupère l'historique des exécutions pour un client
 * @param {number} clientId - ID du client
 * @param {number} [limit=20] - Nombre maximum de résultats
 * @returns {Promise<import('../../types').TestComptableExecution[]>} Historique
 */
export async function getExecutionHistory(clientId, limit = 20) {
  const { data, error } = await supabase
    .from('tests_comptables_executions')
    .select('*')
    .eq('client_id', clientId)
    .order('date_execution', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Erreur récupération historique:', error);
    return [];
  }

  return data || [];
}

/**
 * Récupère les résultats détaillés d'une exécution
 * @param {number} executionId - ID de l'exécution
 * @returns {Promise<import('../../types').TestComptableResultat[]>} Résultats
 */
export async function getExecutionResults(executionId) {
  const { data, error } = await supabase
    .from('tests_comptables_resultats')
    .select('*')
    .eq('execution_id', executionId)
    .order('severite', { ascending: true }); // critical, error, warning, info

  if (error) {
    console.error('Erreur récupération résultats:', error);
    return [];
  }

  return data || [];
}

/**
 * Marque un résultat comme traité
 * @param {number} resultatId - ID du résultat
 * @param {number} collaborateurId - ID du collaborateur qui traite
 * @returns {Promise<boolean>} Succès
 */
export async function markAsProcessed(resultatId, collaborateurId) {
  const { error } = await supabase
    .from('tests_comptables_resultats')
    .update({
      traite: true,
      traite_par: collaborateurId,
      traite_le: new Date().toISOString()
    })
    .eq('id', resultatId);

  return !error;
}

/**
 * Récupère les définitions de tests depuis la BDD
 * @returns {Promise<import('../../types').TestComptableDefinition[]>} Définitions
 */
export async function getTestDefinitions() {
  const { data, error } = await supabase
    .from('tests_comptables_definitions')
    .select('*')
    .eq('actif', true)
    .order('ordre_affichage');

  if (error) {
    console.error('Erreur récupération définitions:', error);
    return [];
  }

  return data || [];
}

export default {
  runTest,
  getExecutionHistory,
  getExecutionResults,
  markAsProcessed,
  getTestDefinitions
};
