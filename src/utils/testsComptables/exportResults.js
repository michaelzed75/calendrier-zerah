// @ts-check

/**
 * @file Utilitaires d'export Excel pour les résultats des tests comptables
 */

import * as XLSX from 'xlsx';

/**
 * Formatte une date pour l'affichage
 * @param {string|Date} date - Date à formater
 * @returns {string} Date formatée
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Traduit la sévérité en français
 * @param {string} severite - Code sévérité
 * @returns {string} Sévérité traduite
 */
function translateSeverite(severite) {
  const translations = {
    'critical': 'Critique',
    'error': 'Erreur',
    'warning': 'Avertissement',
    'info': 'Information'
  };
  return translations[severite] || severite;
}

/**
 * Exporte les résultats d'un test en Excel
 * @param {Object} params - Paramètres d'export
 * @param {import('../../types').TestComptableExecution} params.execution - Exécution du test
 * @param {import('../../types').TestResultAnomalie[]} params.resultats - Résultats à exporter
 * @param {Object} params.client - Client concerné
 * @param {string} params.client.nom - Nom du client
 * @param {Object} params.test - Test exécuté
 * @param {string} params.test.nom - Nom du test
 * @param {string} params.test.code - Code du test
 */
export function exportTestResults({ execution, resultats, client, test }) {
  // Préparer les données selon le type de test
  let dataToExport;

  if (test.code === 'doublons_fournisseurs') {
    dataToExport = resultats.map((r, index) => ({
      '#': index + 1,
      'Sévérité': translateSeverite(r.severite),
      'Compte 1': r.donnees?.compte1?.numero || '',
      'Libellé 1': r.donnees?.compte1?.libelle || '',
      'Nb écritures 1': r.donnees?.compte1?.nbEcritures || 0,
      'Total débit 1': r.donnees?.compte1?.totalDebit || 0,
      'Compte 2': r.donnees?.compte2?.numero || '',
      'Libellé 2': r.donnees?.compte2?.libelle || '',
      'Nb écritures 2': r.donnees?.compte2?.nbEcritures || 0,
      'Total débit 2': r.donnees?.compte2?.totalDebit || 0,
      'Similarité (%)': r.donnees?.similarite || 0,
      'Mots communs': (r.donnees?.motsCommuns || []).join(', '),
      'Commentaire': r.commentaire || ''
    }));
  } else if (test.code === 'double_saisie') {
    dataToExport = resultats.map((r, index) => ({
      '#': index + 1,
      'Sévérité': translateSeverite(r.severite),
      'N° écriture facture': r.donnees?.ecritureFacture?.numero || '',
      'Date facture': r.donnees?.ecritureFacture?.date || '',
      'Compte facture': r.donnees?.ecritureFacture?.compte || '',
      'Montant facture': r.donnees?.ecritureFacture?.montant || 0,
      'Pièce facture': r.donnees?.ecritureFacture?.pieceRef || '',
      'N° écriture banque': r.donnees?.ecritureBanque?.numero || '',
      'Date banque': r.donnees?.ecritureBanque?.date || '',
      'Montant banque': r.donnees?.ecritureBanque?.montant || 0,
      'Écart jours': r.donnees?.differenceJours || 0,
      'Commentaire': r.commentaire || ''
    }));
  } else {
    // Format générique pour les autres tests
    dataToExport = resultats.map((r, index) => ({
      '#': index + 1,
      'Type': r.type_anomalie || '',
      'Sévérité': translateSeverite(r.severite),
      'Données': JSON.stringify(r.donnees || {}),
      'Commentaire': r.commentaire || ''
    }));
  }

  // Ajouter une feuille de résumé
  const resume = [
    { 'Information': 'Client', 'Valeur': client.nom },
    { 'Information': 'Test', 'Valeur': test.nom },
    { 'Information': 'Millésime', 'Valeur': execution.millesime },
    { 'Information': 'Date exécution', 'Valeur': formatDate(execution.date_execution) },
    { 'Information': 'Durée (ms)', 'Valeur': execution.duree_ms || 0 },
    { 'Information': 'Statut', 'Valeur': execution.statut },
    { 'Information': 'Nb anomalies', 'Valeur': resultats.length },
    { 'Information': 'Critiques', 'Valeur': resultats.filter(r => r.severite === 'critical').length },
    { 'Information': 'Erreurs', 'Valeur': resultats.filter(r => r.severite === 'error').length },
    { 'Information': 'Avertissements', 'Valeur': resultats.filter(r => r.severite === 'warning').length },
    { 'Information': 'Informations', 'Valeur': resultats.filter(r => r.severite === 'info').length }
  ];

  // Créer le workbook
  const wb = XLSX.utils.book_new();

  // Feuille résumé
  const wsResume = XLSX.utils.json_to_sheet(resume);
  wsResume['!cols'] = [{ wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsResume, 'Résumé');

  // Feuille des résultats
  if (dataToExport.length > 0) {
    const wsResultats = XLSX.utils.json_to_sheet(dataToExport);

    // Ajuster la largeur des colonnes selon le type de test
    if (test.code === 'doublons_fournisseurs') {
      wsResultats['!cols'] = [
        { wch: 5 },  // #
        { wch: 15 }, // Sévérité
        { wch: 15 }, // Compte 1
        { wch: 30 }, // Libellé 1
        { wch: 12 }, // Nb écritures 1
        { wch: 15 }, // Total débit 1
        { wch: 15 }, // Compte 2
        { wch: 30 }, // Libellé 2
        { wch: 12 }, // Nb écritures 2
        { wch: 15 }, // Total débit 2
        { wch: 12 }, // Similarité
        { wch: 20 }, // Mots communs
        { wch: 50 }  // Commentaire
      ];
    } else if (test.code === 'double_saisie') {
      wsResultats['!cols'] = [
        { wch: 5 },  // #
        { wch: 15 }, // Sévérité
        { wch: 15 }, // N° facture
        { wch: 12 }, // Date facture
        { wch: 12 }, // Compte facture
        { wch: 12 }, // Montant facture
        { wch: 15 }, // Pièce facture
        { wch: 15 }, // N° banque
        { wch: 12 }, // Date banque
        { wch: 12 }, // Montant banque
        { wch: 10 }, // Écart jours
        { wch: 50 }  // Commentaire
      ];
    }

    XLSX.utils.book_append_sheet(wb, wsResultats, 'Anomalies');
  }

  // Générer le nom du fichier
  const dateStr = new Date().toISOString().split('T')[0];
  const clientNom = client.nom.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  const fileName = `Test_${test.code}_${clientNom}_${execution.millesime}_${dateStr}.xlsx`;

  // Télécharger le fichier
  XLSX.writeFile(wb, fileName);
}

/**
 * Exporte l'historique des tests d'un client
 * @param {Object} params - Paramètres d'export
 * @param {import('../../types').TestComptableExecution[]} params.executions - Historique des exécutions
 * @param {Object} params.client - Client concerné
 * @param {string} params.client.nom - Nom du client
 */
export function exportHistorique({ executions, client }) {
  const dataToExport = executions.map((exec, index) => ({
    '#': index + 1,
    'Date': formatDate(exec.date_execution),
    'Test': exec.test_code,
    'Millésime': exec.millesime,
    'Statut': exec.statut,
    'Nb anomalies': exec.nombre_anomalies,
    'Durée (ms)': exec.duree_ms || 0
  }));

  const ws = XLSX.utils.json_to_sheet(dataToExport);
  ws['!cols'] = [
    { wch: 5 },  // #
    { wch: 20 }, // Date
    { wch: 25 }, // Test
    { wch: 10 }, // Millésime
    { wch: 12 }, // Statut
    { wch: 12 }, // Nb anomalies
    { wch: 12 }  // Durée
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Historique');

  const dateStr = new Date().toISOString().split('T')[0];
  const clientNom = client.nom.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  const fileName = `Historique_Tests_${clientNom}_${dateStr}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

/**
 * Exporte les données analysées par un test (même sans anomalies)
 * @param {Object} params - Paramètres d'export
 * @param {Object} params.donneesAnalysees - Données analysées par le test
 * @param {Object} params.client - Client concerné
 * @param {string} params.client.nom - Nom du client
 * @param {Object} params.test - Test exécuté
 * @param {string} params.test.nom - Nom du test
 * @param {string} params.test.code - Code du test
 * @param {number} params.millesime - Année fiscale
 */
export function exportDonneesAnalysees({ donneesAnalysees, client, test, millesime }) {
  if (!donneesAnalysees) {
    console.warn('Pas de données analysées à exporter');
    return;
  }

  const wb = XLSX.utils.book_new();

  // Feuille de résumé
  const resume = [
    { 'Information': 'Client', 'Valeur': client.nom },
    { 'Information': 'Test', 'Valeur': test.nom },
    { 'Information': 'Millésime', 'Valeur': millesime },
    { 'Information': 'Date export', 'Valeur': formatDate(new Date()) }
  ];

  // Ajouter les statistiques spécifiques au type de données
  if (donneesAnalysees.type === 'fournisseurs') {
    resume.push(
      { 'Information': 'Nb fournisseurs analysés', 'Valeur': donneesAnalysees.nbFournisseurs || 0 },
      { 'Information': 'Nb comparaisons effectuées', 'Valeur': donneesAnalysees.nbComparaisons || 0 },
      { 'Information': 'Seuil de similarité (%)', 'Valeur': donneesAnalysees.seuilSimilarite || 60 }
    );
  }

  const wsResume = XLSX.utils.json_to_sheet(resume);
  wsResume['!cols'] = [{ wch: 25 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsResume, 'Résumé');

  // Feuille des données selon le type
  if (donneesAnalysees.type === 'fournisseurs' && donneesAnalysees.fournisseurs) {
    const fournisseursData = donneesAnalysees.fournisseurs.map((f, index) => ({
      '#': index + 1,
      'Compte': f.compte,
      'Libellé': f.libelle,
      'Compte auxiliaire': f.compteAuxiliaire || '',
      'Libellé auxiliaire': f.libelleAuxiliaire || '',
      'Nb écritures': f.nbEcritures,
      'Total débit': f.totalDebit ? f.totalDebit.toFixed(2) : '0.00',
      'Total crédit': f.totalCredit ? f.totalCredit.toFixed(2) : '0.00'
    }));

    const wsFournisseurs = XLSX.utils.json_to_sheet(fournisseursData);
    wsFournisseurs['!cols'] = [
      { wch: 5 },   // #
      { wch: 15 },  // Compte
      { wch: 40 },  // Libellé
      { wch: 15 },  // Compte auxiliaire
      { wch: 40 },  // Libellé auxiliaire
      { wch: 12 },  // Nb écritures
      { wch: 15 },  // Total débit
      { wch: 15 }   // Total crédit
    ];
    XLSX.utils.book_append_sheet(wb, wsFournisseurs, 'Fournisseurs');
  }

  // Générer le nom du fichier
  const dateStr = new Date().toISOString().split('T')[0];
  const clientNom = client.nom.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  const fileName = `Donnees_Analysees_${test.code}_${clientNom}_${millesime}_${dateStr}.xlsx`;

  // Télécharger le fichier
  XLSX.writeFile(wb, fileName);
}

export default {
  exportTestResults,
  exportHistorique,
  exportDonneesAnalysees
};
