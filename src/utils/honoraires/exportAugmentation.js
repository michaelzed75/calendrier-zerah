// @ts-check

/**
 * @file Export Excel stylé pour la simulation d'augmentation des honoraires
 *
 * Utilise xlsx-js-style pour un rendu professionnel avec couleurs, bordures et fusions.
 * Pattern repris de src/utils/testsComptables/exportResults.js
 */

import * as XLSX from 'xlsx-js-style';
import { AXE_DEFINITIONS, AXE_KEYS } from './classificationAxes.js';
import { getCoeffAnnualisation } from './calculsAugmentation.js';

// === Couleurs et styles ===

const BLEU_FONCE = '1F3864';
const BLEU_MOYEN = '2B4C7E';
const BLEU_CLAIR = 'D6E4F0';
const VERT = '27AE60';
const ROUGE = 'E74C3C';
const GRIS_CLAIR = 'F2F2F2';
const GRIS = 'E0E0E0';

const borderThin = { style: 'thin', color: { rgb: '999999' } };
const allBorders = { top: borderThin, bottom: borderThin, left: borderThin, right: borderThin };

const styleTitre = {
  font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: BLEU_FONCE } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: allBorders
};

const styleSousTitre = {
  font: { name: 'Calibri', sz: 10, color: { rgb: '666666' } },
  alignment: { horizontal: 'center' }
};

const styleHeader = {
  font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: BLEU_MOYEN } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: allBorders
};

const styleCell = {
  font: { name: 'Calibri', sz: 10 },
  border: allBorders,
  alignment: { vertical: 'center' }
};

const styleCellNum = {
  font: { name: 'Calibri', sz: 10 },
  border: allBorders,
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt: '#,##0.00" \\u20ac"'
};

const styleCellPct = {
  font: { name: 'Calibri', sz: 10 },
  border: allBorders,
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt: '0.00"%"'
};

const styleTotal = {
  font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: BLEU_FONCE } },
  border: allBorders,
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt: '#,##0.00" \\u20ac"'
};

const styleTotalLabel = {
  font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: BLEU_FONCE } },
  border: allBorders,
  alignment: { vertical: 'center' }
};

const styleSubtotal = {
  font: { name: 'Calibri', sz: 10, bold: true },
  fill: { fgColor: { rgb: BLEU_CLAIR } },
  border: allBorders,
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt: '#,##0.00" \\u20ac"'
};

const styleSubtotalLabel = {
  font: { name: 'Calibri', sz: 10, bold: true },
  fill: { fgColor: { rgb: BLEU_CLAIR } },
  border: allBorders,
  alignment: { vertical: 'center' }
};

const styleDeltaPositif = {
  font: { name: 'Calibri', sz: 10, color: { rgb: VERT } },
  border: allBorders,
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt: '+#,##0.00" \\u20ac";-#,##0.00" \\u20ac"'
};

const styleExclu = {
  font: { name: 'Calibri', sz: 10, color: { rgb: '999999' } },
  fill: { fgColor: { rgb: GRIS_CLAIR } },
  border: allBorders,
  alignment: { vertical: 'center' }
};

/**
 * Helper : écrit une cellule avec style
 * @param {Object} ws
 * @param {string} ref - Ex: 'A1'
 * @param {*} value
 * @param {Object} style
 */
function setCell(ws, ref, value, style) {
  const cell = { v: value, s: style };
  if (typeof value === 'number') cell.t = 'n';
  else cell.t = 's';
  ws[ref] = cell;
}

/** Écrit une cellule avec une formule Excel */
function setFormula(ws, ref, formula, style) {
  ws[ref] = { f: formula, s: style, t: 'n' };
}

/** Convertit un index de colonne en lettre (0='A', 26='AA') */
function colLetter(idx) {
  let s = '';
  let n = idx;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/**
 * Exporte la simulation d'augmentation en Excel stylé (3 feuilles).
 *
 * @param {Object} params
 * @param {import('./calculsAugmentation.js').ResultatClient[]} params.resultats
 * @param {import('./calculsAugmentation.js').ParametresAugmentation} params.parametres
 * @param {Object} params.totaux - Résultat de calculerTotauxResume
 * @param {string} [params.filterCabinet] - Filtre cabinet appliqué
 */
export function exportAugmentationExcel({ resultats, parametres, totaux, filterCabinet, honoraires, clients }) {
  const wb = XLSX.utils.book_new();
  const dateStr = new Date().toLocaleDateString('fr-FR');

  // ====== FEUILLE 1 : RÉSUMÉ ======
  buildResumeSheet(wb, { totaux, parametres, filterCabinet, dateStr });

  // ====== FEUILLE 2 : DÉTAIL PAR CLIENT ======
  buildDetailSheet(wb, { resultats, dateStr });

  // ====== FEUILLES 3 & 4 : IMPORT PENNYLANE (ZF + AUP) ======
  if (honoraires && clients) {
    buildPennylaneSheets(wb, { resultats, honoraires, clients });
  }

  // Télécharger
  const fileName = `augmentation_honoraires_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Feuille Résumé
 */
function buildResumeSheet(wb, { totaux, parametres, filterCabinet, dateStr }) {
  const ws = {};
  const merges = [];
  let row = 1;

  // Titre
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } });
  setCell(ws, `A${row}`, 'SIMULATION AUGMENTATION HONORAIRES', styleTitre);
  for (let c = 1; c <= 5; c++) setCell(ws, `${colLetter(c)}${row}`, '', styleTitre);
  row++;

  // Sous-titre
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 5 } });
  const subtitleText = `${dateStr}${filterCabinet && filterCabinet !== 'tous' ? ` — ${filterCabinet}` : ''} — Taux global : ${parametres.pourcentageGlobal}%`;
  setCell(ws, `A${row}`, subtitleText, styleSousTitre);
  for (let c = 1; c <= 5; c++) setCell(ws, `${colLetter(c)}${row}`, '', styleSousTitre);
  row += 2;

  // === Tableau par axe (montants annualisés) ===
  const headersAxe = ['Axe', 'Actuel HT /an', 'Nouveau HT /an', 'Delta /an', 'Delta %', 'Paramètre'];
  headersAxe.forEach((h, i) => setCell(ws, `${colLetter(i)}${row}`, h, styleHeader));
  row++;

  for (const key of AXE_KEYS) {
    const axe = totaux.parAxe[key];
    const param = parametres.axes[key];
    const def = AXE_DEFINITIONS[key];

    let paramText = '';
    if (!param?.actif) {
      paramText = 'Inactif';
    } else if (param.useGlobal) {
      paramText = `Global (${parametres.pourcentageGlobal}%)`;
    } else {
      paramText = param.mode === 'pourcentage' ? `${param.valeur}%` : `+${param.valeur} EUR`;
    }

    setCell(ws, `A${row}`, def.label, styleCell);
    setCell(ws, `B${row}`, axe.ancien, styleCellNum);
    setCell(ws, `C${row}`, axe.nouveau, styleCellNum);
    setCell(ws, `D${row}`, axe.delta, styleDeltaPositif);
    setCell(ws, `E${row}`, axe.deltaPct, styleCellPct);
    setCell(ws, `F${row}`, paramText, styleCell);
    row++;
  }

  row++;

  // === Tableau par cabinet ===
  const headersCab = ['Cabinet', 'Actuel HT /an', 'Nouveau HT /an', 'Delta /an', 'Delta %', 'Nb clients'];
  headersCab.forEach((h, i) => setCell(ws, `${colLetter(i)}${row}`, h, styleHeader));
  row++;

  for (const [cab, data] of Object.entries(totaux.parCabinet)) {
    setCell(ws, `A${row}`, cab, styleCell);
    setCell(ws, `B${row}`, data.ancien, styleCellNum);
    setCell(ws, `C${row}`, data.nouveau, styleCellNum);
    setCell(ws, `D${row}`, data.delta, styleDeltaPositif);
    setCell(ws, `E${row}`, data.deltaPct, styleCellPct);
    setCell(ws, `F${row}`, data.nbClients, { ...styleCell, alignment: { horizontal: 'center', vertical: 'center' } });
    row++;
  }

  row++;

  // === Total général ===
  setCell(ws, `A${row}`, 'TOTAL GÉNÉRAL', styleTotalLabel);
  setCell(ws, `B${row}`, totaux.global.ancien, styleTotal);
  setCell(ws, `C${row}`, totaux.global.nouveau, styleTotal);
  setCell(ws, `D${row}`, totaux.global.delta, { ...styleTotal, numFmt: '+#,##0.00" \\u20ac";-#,##0.00" \\u20ac"' });
  setCell(ws, `E${row}`, totaux.global.deltaPct, { ...styleTotal, numFmt: '0.00"%"' });
  setCell(ws, `F${row}`, `${totaux.global.nbClients} clients`, styleTotalLabel);

  // Dimensions
  ws['!ref'] = `A1:F${row}`;
  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 22 }, // Axe
    { wch: 16 }, // Actuel
    { wch: 16 }, // Nouveau
    { wch: 14 }, // Delta
    { wch: 10 }, // Delta %
    { wch: 20 }  // Paramètre
  ];
  ws['!rows'] = [{ hpt: 32 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Résumé');
}

/**
 * Feuille Détail par client
 *
 * Les colonnes Montant actuel / Nouveau montant utilisent les montants Silae (production réelle)
 * quand disponibles, pour que la somme des lignes = sous-total client = total général.
 * Les sous-totaux et le total général utilisent des formules SUM Excel.
 */
function buildDetailSheet(wb, { resultats, dateStr }) {
  const ws = {};

  const headers = [
    'PL Sub ID', 'Client', 'Cabinet', 'Axe', 'Produit',
    'Qté PL', 'Qté Silae', 'Coeff.',
    'Prix unit. actuel HT', 'Nouveau prix unit. HT',
    'Mt actuel HT', 'Nouveau mt HT', 'Delta', 'Delta %',
    'Mt annuel avant', 'Mt annuel après', 'Delta annuel'
  ];
  const nbCols = headers.length;

  // Colonnes avec formules de somme (index 0-based)
  // O=14 Mt annuel avant, P=15 Mt annuel après, Q=16 Delta annuel
  const COL_ANNUEL_AVANT = 14;  // O
  const COL_ANNUEL_APRES = 15;  // P
  const COL_DELTA_ANNUEL = 16;  // Q

  // Row 1 = header
  for (let c = 0; c < nbCols; c++) {
    setCell(ws, `${colLetter(c)}1`, headers[c], styleHeader);
  }

  let row = 2; // Ligne Excel courante (1-indexed, commence après le header)
  let clientFirstRow = 0; // Première ligne de données du client en cours
  const subtotalRows = []; // Lignes des sous-totaux (pour le total général)

  for (const client of resultats) {
    const clientLines = client.lignes.filter(l => l.axe);
    if (clientLines.length === 0) continue;

    clientFirstRow = row;

    for (const ligne of clientLines) {
      const coeff = ligne.coeff_annualisation || getCoeffAnnualisation(ligne.frequence, ligne.intervalle);

      // Montants cohérents : si Silae dispo, utiliser les montants basés sur qté Silae
      const hasSilae = ligne.montant_silae !== null && ligne.montant_silae !== undefined;
      const ancienMontant = hasSilae
        ? Math.round(ligne.ancien_prix_unitaire_ht * ligne.quantite_silae * 100) / 100
        : ligne.ancien_montant_ht;
      const nouveauMontant = hasSilae
        ? ligne.montant_silae
        : ligne.nouveau_montant_ht;
      const delta = hasSilae
        ? ligne.delta_silae
        : ligne.delta_ht;
      const deltaPct = ancienMontant > 0
        ? Math.round(((nouveauMontant - ancienMontant) / ancienMontant) * 10000) / 100
        : 0;

      // Colonnes A..N : données directes
      setCell(ws, `A${row}`, ligne.pennylane_subscription_id || '', styleCell);
      setCell(ws, `B${row}`, client.client_nom, styleCell);
      setCell(ws, `C${row}`, client.client_cabinet, styleCell);
      setCell(ws, `D${row}`, AXE_DEFINITIONS[ligne.axe]?.label || ligne.axe || '', styleCell);
      setCell(ws, `E${row}`, ligne.description ? `${ligne.label} — ${ligne.description}` : ligne.label, styleCell);
      setCell(ws, `F${row}`, ligne.quantite, { ...styleCell, alignment: { horizontal: 'center', vertical: 'center' } });
      setCell(ws, `G${row}`, hasSilae ? ligne.quantite_silae : '', { ...styleCell, alignment: { horizontal: 'center', vertical: 'center' } });
      setCell(ws, `H${row}`, coeff, { ...styleCell, alignment: { horizontal: 'center', vertical: 'center' } });
      setCell(ws, `I${row}`, ligne.ancien_prix_unitaire_ht, styleCellNum);
      setCell(ws, `J${row}`, ligne.nouveau_prix_unitaire_ht, styleCellNum);
      setCell(ws, `K${row}`, ancienMontant, styleCellNum);
      setCell(ws, `L${row}`, nouveauMontant, styleCellNum);
      setCell(ws, `M${row}`, delta, styleDeltaPositif);
      setCell(ws, `N${row}`, deltaPct, styleCellPct);

      // Colonnes O, P, Q : formules = montant × coeff
      setFormula(ws, `O${row}`, `K${row}*H${row}`, styleCellNum);
      setFormula(ws, `P${row}`, `L${row}*H${row}`, styleCellNum);
      setFormula(ws, `Q${row}`, `M${row}*H${row}`, styleDeltaPositif);

      row++;
    }

    // Sous-total client : formules SUM sur les lignes du client
    const firstR = clientFirstRow;
    const lastR = row - 1;

    for (let c = 0; c < nbCols; c++) {
      setCell(ws, `${colLetter(c)}${row}`, '', styleSubtotal);
    }
    setCell(ws, `B${row}`, `SOUS-TOTAL ${client.client_nom}`, styleSubtotalLabel);
    if (client.exclu) setCell(ws, `C${row}`, 'EXCLU', styleSubtotalLabel);

    // Formules SUM pour les 3 colonnes annuelles
    setFormula(ws, `O${row}`, `SUM(O${firstR}:O${lastR})`, styleSubtotal);
    setFormula(ws, `P${row}`, `SUM(P${firstR}:P${lastR})`, styleSubtotal);
    setFormula(ws, `Q${row}`, `SUM(Q${firstR}:Q${lastR})`, styleSubtotal);

    subtotalRows.push(row);
    row++;
  }

  // === TOTAL GÉNÉRAL : somme des sous-totaux ===
  if (subtotalRows.length > 0) {
    row++; // Ligne vide

    for (let c = 0; c < nbCols; c++) {
      setCell(ws, `${colLetter(c)}${row}`, '', styleTotal);
    }
    setCell(ws, `B${row}`, 'TOTAL GÉNÉRAL', styleTotalLabel);

    // Formule : somme des cellules sous-totaux (références non contiguës)
    const sumRefs = (col) => subtotalRows.map(r => `${col}${r}`).join('+');
    setFormula(ws, `O${row}`, sumRefs('O'), styleTotal);
    setFormula(ws, `P${row}`, sumRefs('P'), styleTotal);
    setFormula(ws, `Q${row}`, `P${row}-O${row}`, { ...styleTotal, numFmt: '+#,##0.00" \\u20ac";-#,##0.00" \\u20ac"' });

    row++;
  }

  // Dimensions
  ws['!ref'] = `A1:${colLetter(nbCols - 1)}${row}`;

  // Largeurs colonnes
  ws['!cols'] = [
    { wch: 12 }, // A - PL Sub ID
    { wch: 30 }, // B - Client
    { wch: 18 }, // C - Cabinet
    { wch: 18 }, // D - Axe
    { wch: 35 }, // E - Produit
    { wch: 7 },  // F - Qté PL
    { wch: 9 },  // G - Qté Silae
    { wch: 6 },  // H - Coeff
    { wch: 16 }, // I - Prix unit actuel
    { wch: 16 }, // J - Nouveau prix unit
    { wch: 14 }, // K - Montant actuel
    { wch: 14 }, // L - Nouveau montant
    { wch: 12 }, // M - Delta
    { wch: 8 },  // N - Delta %
    { wch: 14 }, // O - Mt annuel avant
    { wch: 14 }, // P - Mt annuel après
    { wch: 14 }  // Q - Delta annuel
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Détail par client');
}

/**
 * Construit les 2 onglets d'import Pennylane (ZF et AUP).
 *
 * Format pivot : 1 ligne = 1 abonnement, lignes de produit en colonnes horizontales.
 * Chaque groupe de ligne = 5 colonnes (Label, Quantité, TTC unitaire, Taux TVA, description).
 * AUP a en plus une colonne « Ligne 2 - Remise » après Ligne 2.
 *
 * TOUS les abonnements actifs (in_progress + not_started) sont exportés,
 * avec les nouveaux prix TTC pour les lignes modifiées et les prix originaux pour les autres.
 * Pennylane reconnaît les abonnements existants par l'identifiant client et met à jour sans créer de doublons.
 */
function buildPennylaneSheets(wb, { resultats, honoraires, clients }) {
  // 1. Collecter les ligne_id modifiées → nouveau prix unitaire HT
  const modifiedLines = new Map(); // Map<ligne_id, nouveau_prix_unitaire_ht>

  for (const client of resultats) {
    if (client.exclu) continue;
    for (const ligne of client.lignes) {
      if (ligne.delta_ht !== 0 || ligne.delta_silae) {
        modifiedLines.set(ligne.ligne_id, ligne.nouveau_prix_unitaire_ht);
      }
    }
  }

  // 2. Séparer TOUS les abonnements actifs par cabinet (ZF / AUP)
  const abosZF = [];
  const abosAUP = [];

  for (const abo of honoraires) {
    // Exclure les stopped/finished
    if (abo.status === 'stopped' || abo.status === 'finished') continue;

    const cabinet = abo.clients?.cabinet || '';
    if (cabinet.toLowerCase().includes('audit')) {
      abosAUP.push(abo);
    } else {
      abosZF.push(abo);
    }
  }

  // 3. Construire les feuilles
  const MAX_LINES_ZF = 10;
  const MAX_LINES_AUP = 7;

  if (abosZF.length > 0) {
    buildOnePennylaneSheet(wb, abosZF, modifiedLines, clients, 'ZF', MAX_LINES_ZF, false);
  }
  if (abosAUP.length > 0) {
    buildOnePennylaneSheet(wb, abosAUP, modifiedLines, clients, 'AUP', MAX_LINES_AUP, true);
  }
}

/**
 * Construit un onglet d'import Pennylane pour un cabinet.
 *
 * @param {Object} wb - Workbook xlsx-js-style
 * @param {Object[]} abos - Abonnements à exporter
 * @param {Map<number, number>} modifiedLines - Map<ligne_id, nouveau_prix_unitaire_ht>
 * @param {Object[]} clients - Liste des clients
 * @param {string} sheetName - Nom de l'onglet
 * @param {number} maxLines - Nombre max de lignes produit (10 ZF, 7 AUP)
 * @param {boolean} hasRemise - true pour AUP (colonne Remise après Ligne 2)
 */
function buildOnePennylaneSheet(wb, abos, modifiedLines, clients, sheetName, maxLines, hasRemise) {
  // Construire le header
  const fixedHeaders = [
    'Intervalle de frequence',        // A
    "Frequence d'abonnement",         // B
    'Mode de finalisation',           // C
    'Date de creation',               // D
    'Jour du mois de facturation',    // E
    'Nom',                            // F
    'Identifiant du client',          // G
    'Conditions de paiement',         // H
    'Moyen de paiement'               // I
  ];

  const lineHeaders = [];
  for (let l = 1; l <= maxLines; l++) {
    lineHeaders.push(`Ligne ${l} - Label`);
    lineHeaders.push(`Ligne ${l} - Quantite`);
    lineHeaders.push(`Ligne ${l} - TTC`);
    lineHeaders.push(`Ligne ${l} - Taux TVA`);
    lineHeaders.push(`Ligne ${l} - description`);
    // Colonne Remise après Ligne 2 (AUP uniquement)
    if (hasRemise && l === 2) {
      lineHeaders.push('Ligne 2 - Remise');
    }
  }

  const headers = [...fixedHeaders, ...lineHeaders];
  const data = [];

  // Trier par nom client
  abos.sort((a, b) => {
    const nomA = a.clients?.nom || a.label || '';
    const nomB = b.clients?.nom || b.label || '';
    return nomA.localeCompare(nomB, 'fr');
  });

  for (const abo of abos) {
    const clientNom = abo.clients?.nom || abo.label || '';
    const clientId = abo.clients?.pennylane_customer_id || '';

    // Formater la date (dd/mm/yyyy)
    const dateCreation = formatDatePennylane(abo.date_debut);

    // Colonnes fixes
    const row = [
      abo.intervalle || 1,                          // A - Intervalle
      abo.frequence || 'monthly',                    // B - Fréquence
      abo.mode_finalisation || 'awaiting_validation', // C - Mode
      dateCreation,                                  // D - Date
      abo.jour_facturation || 31,                    // E - Jour
      clientNom,                                     // F - Nom
      clientId,                                      // G - Identifiant client
      abo.conditions_paiement || 'upon_receipt',     // H - Conditions
      abo.moyen_paiement || 'offline'                // I - Moyen
    ];

    // Lignes de produit
    const lignes = abo.abonnements_lignes || [];
    for (let l = 0; l < maxLines; l++) {
      if (l < lignes.length) {
        const ligne = lignes[l];

        // Vérifier si cette ligne a été modifiée
        const nouveauPUHT = modifiedLines.get(ligne.id);
        let ttcUnitaire;
        if (nouveauPUHT !== undefined) {
          // Ligne modifiée : nouveau prix unitaire TTC
          ttcUnitaire = Math.round(nouveauPUHT * 1.2 * 100) / 100;
        } else {
          // Ligne non modifiée : prix unitaire TTC original
          const qty = ligne.quantite || 1;
          ttcUnitaire = qty > 0
            ? Math.round((ligne.montant_ttc / qty) * 100) / 100
            : ligne.montant_ttc;
        }

        row.push(ligne.label || '');           // Label
        row.push(ligne.quantite || 1);         // Quantité
        row.push(ttcUnitaire);                 // TTC unitaire
        row.push(ligne.taux_tva || 'FR_200');  // Taux TVA
        row.push(ligne.description || '');     // description

        // Remise après Ligne 2 (AUP)
        if (hasRemise && l === 1) {
          row.push(''); // Remise vide
        }
      } else {
        // Ligne vide
        row.push('', '', '', '', '');
        if (hasRemise && l === 1) {
          row.push('');
        }
      }
    }

    data.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

  // Largeurs colonnes
  const colWidths = [
    { wch: 10 }, // A - Intervalle
    { wch: 12 }, // B - Fréquence
    { wch: 20 }, // C - Mode
    { wch: 12 }, // D - Date
    { wch: 8 },  // E - Jour
    { wch: 30 }, // F - Nom
    { wch: 38 }, // G - Identifiant client
    { wch: 16 }, // H - Conditions
    { wch: 10 }  // I - Moyen
  ];
  // Colonnes des lignes
  for (let l = 0; l < maxLines; l++) {
    colWidths.push({ wch: 35 }); // Label
    colWidths.push({ wch: 8 });  // Quantité
    colWidths.push({ wch: 12 }); // TTC
    colWidths.push({ wch: 10 }); // TVA
    colWidths.push({ wch: 30 }); // description
    if (hasRemise && l === 1) {
      colWidths.push({ wch: 10 }); // Remise
    }
  }
  ws['!cols'] = colWidths;

  // Styler le header
  for (let c = 0; c < headers.length; c++) {
    const ref = `${colLetter(c)}1`;
    if (ws[ref]) {
      ws[ref].s = styleHeader;
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
}

/**
 * Formate une date ISO (YYYY-MM-DD) en dd/mm/yyyy pour Pennylane.
 */
function formatDatePennylane(dateStr) {
  if (!dateStr) return '';
  // Si déjà au format dd/mm/yyyy
  if (dateStr.includes('/')) return dateStr;
  // Format ISO YYYY-MM-DD
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}
