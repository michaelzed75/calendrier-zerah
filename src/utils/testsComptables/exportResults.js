// @ts-check

/**
 * @file Utilitaires d'export Excel pour les résultats des tests comptables
 */

import * as XLSX from 'xlsx';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
  AlignmentType, WidthType, BorderStyle, HeadingLevel, convertMillimetersToTwip
} from 'docx';

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
  } else if (test.code === 'attestation_achats') {
    dataToExport = resultats.map((r, index) => ({
      '#': index + 1,
      'Sévérité': translateSeverite(r.severite),
      'Type': r.type_anomalie || '',
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

  if (donneesAnalysees.type === 'attestation_achats') {
    resume.push(
      { 'Information': 'Nb écritures analysées', 'Valeur': donneesAnalysees.nbEcrituresAnalysees || 0 },
      { 'Information': 'Nb écritures total FEC', 'Valeur': donneesAnalysees.nbEcrituresTotal || 0 },
      { 'Information': 'Comptes filtrés', 'Valeur': (donneesAnalysees.comptesAchats || []).join(', ') },
      { 'Information': 'Nb fournisseurs', 'Valeur': donneesAnalysees.nbFournisseurs || 0 },
      { 'Information': 'Total Débit', 'Valeur': donneesAnalysees.totalDebit?.toFixed(2) || '0.00' },
      { 'Information': 'Total Crédit', 'Valeur': donneesAnalysees.totalCredit?.toFixed(2) || '0.00' },
      { 'Information': 'Total HT (Débit - Crédit)', 'Valeur': donneesAnalysees.totalHT?.toFixed(2) || '0.00' }
    );
  }

  const wsResume = XLSX.utils.json_to_sheet(resume);
  wsResume['!cols'] = [{ wch: 25 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsResume, 'Résumé');

  // Feuille des données selon le type

  // === ATTESTATION ACHATS : Feuille Attestation + Feuille Vérification ===
  if (donneesAnalysees.type === 'attestation_achats' && donneesAnalysees.fournisseurs) {
    // --- Feuille 1 : Attestation (résumé par fournisseur, trié par montant HT décroissant) ---
    const attestationData = [];

    // Lignes fournisseurs
    for (const f of donneesAnalysees.fournisseurs) {
      attestationData.push({
        'Fournisseur': f.nom,
        'Compte auxiliaire': f.compteAuxiliaire || '',
        'Nb écritures': f.nbEcritures,
        'Total Débit': f.totalDebit?.toFixed(2) || '0.00',
        'Total Crédit': f.totalCredit?.toFixed(2) || '0.00',
        'Montant HT': f.montantHT?.toFixed(2) || '0.00'
      });
    }

    // Ligne vide + Total général
    attestationData.push({
      'Fournisseur': '', 'Compte auxiliaire': '', 'Nb écritures': '',
      'Total Débit': '', 'Total Crédit': '', 'Montant HT': ''
    });
    attestationData.push({
      'Fournisseur': `TOTAL GÉNÉRAL (${donneesAnalysees.nbFournisseurs || 0} fournisseurs)`,
      'Compte auxiliaire': '',
      'Nb écritures': '',
      'Total Débit': donneesAnalysees.totalDebit?.toFixed(2) || '0.00',
      'Total Crédit': donneesAnalysees.totalCredit?.toFixed(2) || '0.00',
      'Montant HT': donneesAnalysees.totalHT?.toFixed(2) || '0.00'
    });

    const wsAttestation = XLSX.utils.json_to_sheet(attestationData);
    wsAttestation['!cols'] = [
      { wch: 35 },  // Fournisseur
      { wch: 15 },  // Compte auxiliaire
      { wch: 12 },  // Nb écritures
      { wch: 15 },  // Total Débit
      { wch: 15 },  // Total Crédit
      { wch: 15 }   // Montant HT
    ];
    XLSX.utils.book_append_sheet(wb, wsAttestation, 'Attestation');

    // --- Feuille 2 : Vérification (détail FEC avec Débit/Crédit/Solde/Produits) ---
    if (donneesAnalysees.detailVerification && donneesAnalysees.detailVerification.length > 0) {
      const verificationData = donneesAnalysees.detailVerification.map((e, index) => ({
        '#': index + 1,
        'JournalCode': e.JournalCode,
        'JournalLib': e.JournalLib,
        'EcritureNum': e.EcritureNum,
        'EcritureDate': e.EcritureDate,
        'CompteNum': e.CompteNum,
        'CompteLib': e.CompteLib,
        'CompAux': e.CompAuxNum,
        'Produits': e.Produits || '',
        'CompAuxLib': e.CompAuxLib,
        'PieceRef': e.PieceRef,
        'PieceDate': e.PieceDate,
        'EcritureLib': e.EcritureLib,
        'Débit': e.Debit?.toFixed(2) || '0.00',
        'Crédit': e.Credit?.toFixed(2) || '0.00',
        'Solde': e.Solde?.toFixed(2) || '0.00'
      }));

      const wsVerification = XLSX.utils.json_to_sheet(verificationData);
      wsVerification['!cols'] = [
        { wch: 5 },   // #
        { wch: 8 },   // JournalCode
        { wch: 15 },  // JournalLib
        { wch: 12 },  // EcritureNum
        { wch: 12 },  // EcritureDate
        { wch: 10 },  // CompteNum
        { wch: 25 },  // CompteLib
        { wch: 12 },  // CompAux
        { wch: 12 },  // Produits
        { wch: 25 },  // CompAuxLib
        { wch: 15 },  // PieceRef
        { wch: 12 },  // PieceDate
        { wch: 35 },  // EcritureLib
        { wch: 12 },  // Débit
        { wch: 12 },  // Crédit
        { wch: 12 }   // Solde
      ];
      XLSX.utils.book_append_sheet(wb, wsVerification, 'Vérification FEC');
    }
  }

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

/**
 * Formatte un nombre en euros avec 2 décimales et séparateur de milliers
 * @param {number} n - Nombre à formater
 * @returns {string} Nombre formaté (ex: "189 674,73 €")
 */
function formatEuros(n) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

/**
 * Formatte la date en français (ex: "12 février 2026")
 * @param {Date} [d] - Date à formater
 * @returns {string} Date en français
 */
function formatDateFr(d = new Date()) {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Exporte une attestation achats fournisseurs au format Word (.docx)
 * Calquée sur le modèle officiel AUDIT UP
 *
 * @param {Object} params - Paramètres d'export
 * @param {Object} params.donneesAnalysees - Données du test attestation_achats
 * @param {Object} params.client - Client concerné
 * @param {string} params.client.nom - Nom du client
 * @param {number} params.millesime - Année fiscale
 * @param {string} [params.nomSociete] - Nom de la société (override)
 * @param {string} [params.adresse] - Adresse de la société
 * @param {string} [params.cpVille] - Code postal + ville
 * @param {Set<string>} [params.selectedFournisseurs] - Noms normalisés des fournisseurs à inclure (si vide/null = tous)
 */
export async function exportAttestationWord({ donneesAnalysees, client, millesime, nomSociete, adresse, cpVille, selectedFournisseurs }) {
  if (!donneesAnalysees || donneesAnalysees.type !== 'attestation_achats') {
    console.warn('Pas de données attestation_achats à exporter');
    return;
  }

  const societe = nomSociete || client.nom;
  const parCategorieRaw = donneesAnalysees.parCategorie || {};

  // Filtrer les fournisseurs si une sélection est fournie
  const parCategorie = {};
  let totalHT = 0;
  if (selectedFournisseurs && selectedFournisseurs.size > 0) {
    for (const [cat, data] of Object.entries(parCategorieRaw)) {
      const filtered = data.fournisseurs.filter(f =>
        selectedFournisseurs.has(f.nom.toUpperCase().replace(/\s+/g, ' ').trim())
      );
      if (filtered.length > 0) {
        const sousTotal = Math.round(filtered.reduce((s, f) => s + f.montantHT, 0) * 100) / 100;
        parCategorie[cat] = { fournisseurs: filtered, sousTotal };
        totalHT += sousTotal;
      }
    }
    totalHT = Math.round(totalHT * 100) / 100;
  } else {
    Object.assign(parCategorie, parCategorieRaw);
    totalHT = donneesAnalysees.totalHT || 0;
  }

  // Style bordure invisible pour cellules
  const noBorder = {
    top: { style: BorderStyle.NONE, size: 0 },
    bottom: { style: BorderStyle.NONE, size: 0 },
    left: { style: BorderStyle.NONE, size: 0 },
    right: { style: BorderStyle.NONE, size: 0 }
  };

  // Style bordure pour le tableau attestation
  const thinBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
    left: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
    right: { style: BorderStyle.SINGLE, size: 1, color: '999999' }
  };

  // === Construire les lignes du tableau ===
  const tableRows = [];

  // En-tête du tableau
  tableRows.push(
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          borders: thinBorder,
          width: { size: 70, type: WidthType.PERCENTAGE },
          shading: { fill: '2B4C7E' },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Description', bold: true, color: 'FFFFFF', size: 22, font: 'Calibri' })]
          })]
        }),
        new TableCell({
          borders: thinBorder,
          width: { size: 30, type: WidthType.PERCENTAGE },
          shading: { fill: '2B4C7E' },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Montant HT', bold: true, color: 'FFFFFF', size: 22, font: 'Calibri' })]
          })]
        })
      ]
    })
  );

  // Lignes par catégorie
  const categories = Object.keys(parCategorie).sort();
  for (const categorie of categories) {
    const catData = parCategorie[categorie];

    // Ligne titre catégorie (ex: "Boissons", "Food")
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            borders: thinBorder,
            columnSpan: 2,
            shading: { fill: 'D6E4F0' },
            children: [new Paragraph({
              children: [new TextRun({ text: categorie, bold: true, size: 22, font: 'Calibri' })]
            })]
          })
        ]
      })
    );

    // Lignes fournisseurs de cette catégorie (triés par montant décroissant)
    const fournisseursTries = [...catData.fournisseurs].sort((a, b) => b.montantHT - a.montantHT);
    for (const f of fournisseursTries) {
      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              borders: thinBorder,
              children: [new Paragraph({
                indent: { left: convertMillimetersToTwip(5) },
                children: [new TextRun({ text: f.nom, size: 20, font: 'Calibri' })]
              })]
            }),
            new TableCell({
              borders: thinBorder,
              children: [new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: formatEuros(f.montantHT), size: 20, font: 'Calibri' })]
              })]
            })
          ]
        })
      );
    }

    // Sous-total catégorie
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            borders: thinBorder,
            shading: { fill: 'F2F2F2' },
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: `Sous-total ${categorie}`, bold: true, size: 20, font: 'Calibri' })]
            })]
          }),
          new TableCell({
            borders: thinBorder,
            shading: { fill: 'F2F2F2' },
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: formatEuros(catData.sousTotal), bold: true, size: 20, font: 'Calibri' })]
            })]
          })
        ]
      })
    );
  }

  // Ligne Total Général
  tableRows.push(
    new TableRow({
      children: [
        new TableCell({
          borders: thinBorder,
          shading: { fill: '2B4C7E' },
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'Total Général', bold: true, color: 'FFFFFF', size: 22, font: 'Calibri' })]
          })]
        }),
        new TableCell({
          borders: thinBorder,
          shading: { fill: '2B4C7E' },
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: formatEuros(totalHT), bold: true, color: 'FFFFFF', size: 22, font: 'Calibri' })]
          })]
        })
      ]
    })
  );

  // === Construire le document ===
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertMillimetersToTwip(20),
            bottom: convertMillimetersToTwip(20),
            left: convertMillimetersToTwip(25),
            right: convertMillimetersToTwip(25)
          }
        }
      },
      children: [
        // En-tête : AUDIT UP
        new Paragraph({
          children: [
            new TextRun({ text: 'AUDIT UP', bold: true, size: 36, color: '2B4C7E', font: 'Calibri' })
          ]
        }),
        new Paragraph({ spacing: { after: 200 } }),

        // Coordonnées du client
        new Paragraph({
          children: [new TextRun({ text: societe, bold: true, size: 24, font: 'Calibri' })]
        }),
        ...(adresse ? [new Paragraph({
          children: [new TextRun({ text: adresse, size: 22, font: 'Calibri' })]
        })] : []),
        ...(cpVille ? [new Paragraph({
          children: [new TextRun({ text: cpVille, size: 22, font: 'Calibri' })]
        })] : []),
        new Paragraph({ spacing: { after: 400 } }),

        // Date alignée à droite
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: `Paris le ${formatDateFr()}`, size: 22, font: 'Calibri' })]
        }),
        new Paragraph({ spacing: { after: 400 } }),

        // Objet
        new Paragraph({
          children: [
            new TextRun({ text: 'Objet : ', bold: true, size: 22, font: 'Calibri' }),
            new TextRun({ text: 'Attestation achats fournisseurs liste limitative', bold: true, size: 22, font: 'Calibri', underline: {} })
          ]
        }),
        new Paragraph({ spacing: { after: 300 } }),

        // Corps du texte
        new Paragraph({
          children: [new TextRun({ text: 'Madame, Monsieur,', size: 22, font: 'Calibri' })]
        }),
        new Paragraph({ spacing: { after: 200 } }),

        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: `Je vous informe que sauf erreur ou omission de notre part le montant des achats effectués par la société ${societe}, au titre de la période du 1er janvier ${millesime} au 31 décembre ${millesime}, s'élève en HT à :`,
              size: 22,
              font: 'Calibri'
            })
          ]
        }),
        new Paragraph({ spacing: { after: 200 } }),

        // Tableau
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tableRows
        }),
        new Paragraph({ spacing: { after: 400 } }),

        // Formule de politesse
        new Paragraph({
          children: [new TextRun({ text: 'Veuillez agréer, Madame, Monsieur, l\'expression de nos salutations distinguées.', size: 22, font: 'Calibri' })]
        }),
        new Paragraph({ spacing: { after: 600 } }),

        // Signature
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'M MICHAEL ZERAH', bold: true, size: 22, font: 'Calibri' })]
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'EXPERT-COMPTABLE', size: 20, font: 'Calibri', color: '666666' })]
        })
      ]
    }]
  });

  // Générer et télécharger
  const blob = await Packer.toBlob(doc);
  const dateStr = new Date().toISOString().split('T')[0];
  const clientNom = client.nom.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  const fileName = `Attestation_Achats_${clientNom}_${millesime}_${dateStr}.docx`;

  // Téléchargement via lien temporaire
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default {
  exportTestResults,
  exportHistorique,
  exportDonneesAnalysees,
  exportAttestationWord
};
