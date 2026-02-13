// @ts-check

/**
 * @file Utilitaires d'export Excel pour les résultats des tests comptables
 */

import * as XLSX from 'xlsx-js-style';
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

  // === ÉTAT DES DETTES : Rapport professionnel stylé ===
  if (donneesAnalysees.type === 'etat_dettes') {
    // ─── Styles réutilisables ───
    const BLEU_FONCE = '1F3864';
    const BLEU_MOYEN = '2B4C7E';
    const BLEU_CLAIR = 'D6E4F0';
    const GRIS_CLAIR = 'F2F2F2';
    const GRIS_SOUS_TOTAL = 'E8E8E8';
    const BLANC = 'FFFFFF';

    const borderThin = { style: 'thin', color: { rgb: '999999' } };
    const borderMedium = { style: 'medium', color: { rgb: BLEU_MOYEN } };
    const allBordersThin = { top: borderThin, bottom: borderThin, left: borderThin, right: borderThin };
    const allBordersMedium = { top: borderMedium, bottom: borderMedium, left: borderMedium, right: borderMedium };

    const fmtEuro = '#,##0.00" €"';

    const styleTitre = {
      font: { name: 'Calibri', sz: 18, bold: true, color: { rgb: BLANC } },
      fill: { fgColor: { rgb: BLEU_FONCE } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: allBordersMedium
    };
    const styleSubTitre = {
      font: { name: 'Calibri', sz: 11, color: { rgb: '333333' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      fill: { fgColor: { rgb: BLEU_CLAIR } },
      border: allBordersThin
    };
    const styleHeader = {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: BLANC } },
      fill: { fgColor: { rgb: BLEU_MOYEN } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: allBordersThin
    };
    const styleHeaderLeft = { ...styleHeader, alignment: { horizontal: 'left', vertical: 'center' } };
    const styleCategorie = {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: BLEU_FONCE } },
      fill: { fgColor: { rgb: BLEU_CLAIR } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: allBordersThin
    };
    const styleCategorieNum = {
      ...styleCategorie,
      alignment: { horizontal: 'right', vertical: 'center' },
      numFmt: fmtEuro
    };
    const styleCell = {
      font: { name: 'Calibri', sz: 10 },
      border: allBordersThin,
      alignment: { vertical: 'center' }
    };
    const styleCellNum = {
      ...styleCell,
      alignment: { horizontal: 'right', vertical: 'center' },
      numFmt: fmtEuro
    };
    const styleCellNumPlain = {
      ...styleCell,
      alignment: { horizontal: 'center', vertical: 'center' },
      numFmt: '#,##0'
    };
    const styleSousTotal = {
      font: { name: 'Calibri', sz: 10, bold: true, italic: true },
      fill: { fgColor: { rgb: GRIS_SOUS_TOTAL } },
      border: allBordersThin,
      alignment: { horizontal: 'right', vertical: 'center' }
    };
    const styleSousTotalNum = {
      ...styleSousTotal,
      numFmt: fmtEuro
    };
    const styleTotalGen = {
      font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: BLANC } },
      fill: { fgColor: { rgb: BLEU_FONCE } },
      border: allBordersMedium,
      alignment: { horizontal: 'right', vertical: 'center' }
    };
    const styleTotalGenNum = {
      ...styleTotalGen,
      numFmt: fmtEuro
    };
    const styleInfo = {
      font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: '666666' } },
      alignment: { horizontal: 'left', vertical: 'center' }
    };

    // ─── Helper : set cell with style ───
    function setCell(ws, ref, value, style) {
      const cell = { v: value, s: style };
      if (typeof value === 'number') cell.t = 'n';
      else cell.t = 's';
      ws[ref] = cell;
    }

    // ─── Construire la feuille "Résumé" stylée ───
    const wsResumeSt = {};
    const dateArreteFormatted = donneesAnalysees.dateArrete
      ? new Date(donneesAnalysees.dateArrete).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : `31 décembre ${millesime}`;

    // Row 1 : Titre AUDIT UP fusionné
    wsResumeSt['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },  // Titre
      { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },  // Sous-titre
    ];
    setCell(wsResumeSt, 'A1', 'AUDIT UP', {
      font: { name: 'Calibri', sz: 20, bold: true, color: { rgb: BLANC } },
      fill: { fgColor: { rgb: BLEU_FONCE } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: allBordersMedium
    });
    setCell(wsResumeSt, 'B1', '', { fill: { fgColor: { rgb: BLEU_FONCE } }, border: allBordersMedium });

    // Row 2 : Sous-titre
    setCell(wsResumeSt, 'A2', `État des Dettes Provisoires — ${client.nom} — Exercice ${millesime}`, {
      font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: BLEU_FONCE } },
      fill: { fgColor: { rgb: BLEU_CLAIR } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: allBordersThin
    });
    setCell(wsResumeSt, 'B2', '', { fill: { fgColor: { rgb: BLEU_CLAIR } }, border: allBordersThin });

    // Row 3 : vide
    // Row 4-10 : Infos
    const resumeInfos = [
      ['Client', client.nom],
      ['Exercice (Millésime)', String(millesime)],
      ['Arrêté au', dateArreteFormatted],
      ['Seuil de signification', `${(donneesAnalysees.seuilSignification || 0).toLocaleString('fr-FR')} €`],
      ['Comptes analysés', String(donneesAnalysees.nbComptesAnalyses || 0)],
      ['Comptes retenus', String(donneesAnalysees.nbComptesRetenus || 0)],
      ['Total des dettes', (donneesAnalysees.totalDettes || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'],
      ['Date de l\'export', formatDate(new Date())]
    ];

    const styleInfoLabel = {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: BLEU_FONCE } },
      fill: { fgColor: { rgb: GRIS_CLAIR } },
      border: allBordersThin,
      alignment: { vertical: 'center' }
    };
    const styleInfoValue = {
      font: { name: 'Calibri', sz: 10 },
      border: allBordersThin,
      alignment: { vertical: 'center' }
    };
    const styleInfoValueBold = {
      font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: 'CC0000' } },
      border: allBordersThin,
      alignment: { vertical: 'center' }
    };

    resumeInfos.forEach(([label, value], i) => {
      const row = i + 4; // Start at row 4 (0-indexed: 3)
      setCell(wsResumeSt, `A${row}`, label, styleInfoLabel);
      // Total des dettes en rouge gras
      setCell(wsResumeSt, `B${row}`, value, i === 6 ? styleInfoValueBold : styleInfoValue);
    });

    wsResumeSt['!cols'] = [{ wch: 30 }, { wch: 45 }];
    wsResumeSt['!rows'] = [{ hpt: 35 }, { hpt: 25 }];
    wsResumeSt['!ref'] = `A1:B${3 + resumeInfos.length}`;
    // Remplacer la feuille résumé
    wb.Sheets['Résumé'] = wsResumeSt;

    // ─── Feuille "État des Dettes" : rapport principal stylé ───
    if (donneesAnalysees.categories && donneesAnalysees.categories.length > 0) {
      const ws = {};
      const merges = [];
      let row = 1;
      const nbCols = 7; // A-G
      const lastCol = String.fromCharCode(64 + nbCols); // 'G'

      // Row 1 : Grand titre fusionné
      merges.push({ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: nbCols - 1 } });
      setCell(ws, `A${row}`, 'ÉTAT DES DETTES PROVISOIRES', styleTitre);
      for (let c = 1; c < nbCols; c++) {
        setCell(ws, `${String.fromCharCode(65 + c)}${row}`, '', styleTitre);
      }
      row++;

      // Row 2 : Sous-titre avec client + date
      merges.push({ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: nbCols - 1 } });
      setCell(ws, `A${row}`, `${client.nom} — Arrêté au ${dateArreteFormatted} — Exercice ${millesime}`, styleSubTitre);
      for (let c = 1; c < nbCols; c++) {
        setCell(ws, `${String.fromCharCode(65 + c)}${row}`, '', styleSubTitre);
      }
      row++;

      // Row 3 : vide
      row++;

      // Row 4 : En-tête du tableau
      const headers = ['Catégorie', 'N° Compte', 'Libellé', 'Nb écritures', 'Total Débit', 'Total Crédit', 'Montant dette'];
      headers.forEach((h, i) => {
        const style = i <= 2 ? styleHeaderLeft : styleHeader;
        setCell(ws, `${String.fromCharCode(65 + i)}${row}`, h, style);
      });
      row++;

      // Lignes de données par catégorie
      for (const cat of donneesAnalysees.categories) {
        // Ligne catégorie (fusionner A-C)
        merges.push({ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: 2 } });
        setCell(ws, `A${row}`, `▸ ${cat.label || cat.categorie}`, styleCategorie);
        setCell(ws, `B${row}`, '', styleCategorie);
        setCell(ws, `C${row}`, '', styleCategorie);
        setCell(ws, `D${row}`, '', styleCategorie);
        setCell(ws, `E${row}`, '', styleCategorie);
        setCell(ws, `F${row}`, '', styleCategorie);
        setCell(ws, `G${row}`, cat.sousTotal || 0, styleCategorieNum);
        row++;

        // Lignes de comptes
        for (const c of cat.comptes) {
          setCell(ws, `A${row}`, '', styleCell);
          setCell(ws, `B${row}`, c.compteNum || '', styleCell);
          setCell(ws, `C${row}`, c.compteLib || '', styleCell);
          setCell(ws, `D${row}`, c.nbEcritures || 0, styleCellNumPlain);
          setCell(ws, `E${row}`, c.totalDebit || 0, styleCellNum);
          setCell(ws, `F${row}`, c.totalCredit || 0, styleCellNum);
          setCell(ws, `G${row}`, c.montantDette || 0, styleCellNum);
          row++;
        }

        // Ligne sous-total
        merges.push({ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: 4 } });
        setCell(ws, `A${row}`, `Sous-total ${cat.categorie}`, styleSousTotal);
        setCell(ws, `B${row}`, '', styleSousTotal);
        setCell(ws, `C${row}`, '', styleSousTotal);
        setCell(ws, `D${row}`, '', styleSousTotal);
        setCell(ws, `E${row}`, '', styleSousTotal);
        setCell(ws, `F${row}`, '', styleSousTotal);
        setCell(ws, `G${row}`, cat.sousTotal || 0, styleSousTotalNum);
        row++;

        // Ligne vide de séparation
        row++;
      }

      // Ligne TOTAL GÉNÉRAL
      merges.push({ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: 5 } });
      setCell(ws, `A${row}`, 'TOTAL GÉNÉRAL DES DETTES', styleTotalGen);
      setCell(ws, `B${row}`, '', styleTotalGen);
      setCell(ws, `C${row}`, '', styleTotalGen);
      setCell(ws, `D${row}`, '', styleTotalGen);
      setCell(ws, `E${row}`, '', styleTotalGen);
      setCell(ws, `F${row}`, '', styleTotalGen);
      setCell(ws, `G${row}`, donneesAnalysees.totalDettes || 0, styleTotalGenNum);
      row++;

      // Ligne vide
      row++;

      // Ligne info seuil
      const seuilVal = donneesAnalysees.seuilSignification || 0;
      merges.push({ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: nbCols - 1 } });
      if (seuilVal > 0) {
        setCell(ws, `A${row}`, `ℹ Seuil de signification appliqué : ${seuilVal.toLocaleString('fr-FR')} € — Seuls les comptes dont le solde en valeur absolue est ≥ ${seuilVal.toLocaleString('fr-FR')} € sont retenus dans cet état.`, styleInfo);
      } else {
        setCell(ws, `A${row}`, 'ℹ Aucun seuil de signification appliqué — Tous les comptes de dettes sont présentés.', styleInfo);
      }
      row++;

      // Ligne info export
      merges.push({ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: nbCols - 1 } });
      setCell(ws, `A${row}`, `Document généré le ${formatDate(new Date())} — AUDIT UP`, styleInfo);
      row++;

      ws['!ref'] = `A1:${lastCol}${row}`;
      ws['!merges'] = merges;
      ws['!cols'] = [
        { wch: 12 },  // A: Catégorie (vide pour lignes comptes)
        { wch: 14 },  // B: N° Compte
        { wch: 42 },  // C: Libellé
        { wch: 13 },  // D: Nb écritures
        { wch: 16 },  // E: Total Débit
        { wch: 16 },  // F: Total Crédit
        { wch: 18 }   // G: Montant dette
      ];
      ws['!rows'] = [{ hpt: 32 }, { hpt: 22 }]; // Titre + sous-titre height

      // Print settings
      ws['!printHeader'] = '1:4';

      XLSX.utils.book_append_sheet(wb, ws, 'État des Dettes');
    }

    // ─── Feuille "Détail comptes" stylée ───
    if (donneesAnalysees.detailComptes && donneesAnalysees.detailComptes.length > 0) {
      const wsDet = {};
      const mergesDet = [];
      let rowD = 1;

      // Titre
      mergesDet.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } });
      setCell(wsDet, `A${rowD}`, 'DÉTAIL DES COMPTES ANALYSÉS', {
        ...styleTitre,
        font: { ...styleTitre.font, sz: 14 }
      });
      for (let c = 1; c <= 9; c++) {
        setCell(wsDet, `${String.fromCharCode(65 + c)}${rowD}`, '', {
          ...styleTitre,
          font: { ...styleTitre.font, sz: 14 }
        });
      }
      rowD++;
      rowD++; // ligne vide

      // Headers
      const detHeaders = ['#', 'Catégorie', 'N° Compte', 'Libellé', 'Nb écritures', 'Total Débit', 'Total Crédit', 'Solde', 'Montant dette', 'Retenu'];
      detHeaders.forEach((h, i) => {
        setCell(wsDet, `${String.fromCharCode(65 + i)}${rowD}`, h, styleHeader);
      });
      rowD++;

      // Données
      const styleRetenuOui = {
        ...styleCell,
        font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '006600' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
      const styleRetenuNon = {
        ...styleCell,
        font: { name: 'Calibri', sz: 10, color: { rgb: '999999' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };

      donneesAnalysees.detailComptes.forEach((c, i) => {
        const isRetenu = c.retenu;
        const rowStyle = isRetenu ? styleCell : {
          ...styleCell,
          font: { name: 'Calibri', sz: 10, color: { rgb: '999999' } }
        };
        const rowNumStyle = isRetenu ? styleCellNum : {
          ...styleCellNum,
          font: { name: 'Calibri', sz: 10, color: { rgb: '999999' } }
        };

        setCell(wsDet, `A${rowD}`, i + 1, { ...rowStyle, alignment: { horizontal: 'center', vertical: 'center' } });
        setCell(wsDet, `B${rowD}`, c.categorie || '', rowStyle);
        setCell(wsDet, `C${rowD}`, c.compteNum || '', rowStyle);
        setCell(wsDet, `D${rowD}`, c.compteLib || '', rowStyle);
        setCell(wsDet, `E${rowD}`, c.nbEcritures || 0, { ...rowStyle, alignment: { horizontal: 'center', vertical: 'center' }, numFmt: '#,##0' });
        setCell(wsDet, `F${rowD}`, c.totalDebit || 0, rowNumStyle);
        setCell(wsDet, `G${rowD}`, c.totalCredit || 0, rowNumStyle);
        setCell(wsDet, `H${rowD}`, c.solde || 0, rowNumStyle);
        setCell(wsDet, `I${rowD}`, c.montantDette || 0, rowNumStyle);
        setCell(wsDet, `J${rowD}`, isRetenu ? '✓ Oui' : 'Non', isRetenu ? styleRetenuOui : styleRetenuNon);
        rowD++;
      });

      wsDet['!ref'] = `A1:J${rowD}`;
      wsDet['!merges'] = mergesDet;
      wsDet['!cols'] = [
        { wch: 5 },   // #
        { wch: 25 },  // Catégorie
        { wch: 14 },  // N° Compte
        { wch: 40 },  // Libellé
        { wch: 13 },  // Nb écritures
        { wch: 16 },  // Total Débit
        { wch: 16 },  // Total Crédit
        { wch: 16 },  // Solde
        { wch: 16 },  // Montant dette
        { wch: 10 }   // Retenu
      ];
      wsDet['!rows'] = [{ hpt: 28 }];

      XLSX.utils.book_append_sheet(wb, wsDet, 'Détail comptes');
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
