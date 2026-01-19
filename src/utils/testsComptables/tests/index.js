// @ts-check

/**
 * @file Registre centralisé des tests comptables disponibles
 * Pour ajouter un nouveau test:
 * 1. Créer un fichier dans ce dossier (ex: monNouveauTest.js)
 * 2. L'importer ici
 * 3. L'ajouter au testsRegistry
 */

import { doublonsFournisseurs } from './doublonsFournisseurs.js';
import { doubleSaisie } from './doubleSaisie.js';

/**
 * Registre de tous les tests disponibles
 * @type {Object.<string, import('../../../types').TestDefinition>}
 */
export const testsRegistry = {
  doublons_fournisseurs: doublonsFournisseurs,
  double_saisie: doubleSaisie
};

/**
 * Récupère un test par son code
 * @param {string} code - Code du test
 * @returns {import('../../../types').TestDefinition|undefined} Définition du test
 */
export function getTest(code) {
  return testsRegistry[code];
}

/**
 * Récupère tous les tests disponibles
 * @returns {import('../../../types').TestDefinition[]} Liste des tests
 */
export function getAllTests() {
  return Object.values(testsRegistry);
}

/**
 * Récupère les tests par catégorie
 * @param {string} categorie - Catégorie à filtrer
 * @returns {import('../../../types').TestDefinition[]} Tests de la catégorie
 */
export function getTestsByCategory(categorie) {
  return getAllTests().filter(test => {
    // La catégorie est définie dans les métadonnées du test
    // Pour l'instant on utilise requiredData comme proxy
    if (categorie === 'FEC') {
      return test.requiredData.includes('fec');
    }
    if (categorie === 'factures') {
      return test.requiredData.includes('invoices');
    }
    if (categorie === 'banque') {
      return test.requiredData.includes('bankTransactions');
    }
    return true;
  });
}

/**
 * Liste des catégories de tests disponibles
 */
export const categories = [
  { id: 'FEC', nom: 'Analyse FEC', description: 'Tests sur le fichier des écritures comptables' },
  { id: 'factures', nom: 'Factures', description: 'Tests sur les factures fournisseurs/clients' },
  { id: 'banque', nom: 'Banque', description: 'Tests sur les opérations bancaires' },
  { id: 'rapprochement', nom: 'Rapprochement', description: 'Tests de cohérence entre sources' }
];

export default testsRegistry;
