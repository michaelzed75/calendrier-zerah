// @ts-check

/**
 * @file Export Excel de restructuration des abonnements Pennylane
 *
 * Génère un fichier Excel avec 5 onglets :
 * 1. Résumé — Vue d'ensemble : nb clients, lignes fixes/variables, montants
 * 2. Import PL AUP — Abonnements fixes Audit Up avec prix 2026
 * 3. Import PL ZF — Abonnements fixes Zerah Fiduciaire avec prix 2026
 * 4. A SUPPRIMER — Liste des lignes variables à retirer de PL
 * 5. Détail croisé — Vue complète par client : abonnements × lignes × décision
 *
 * Utilisé pour :
 * - Valider visuellement la restructuration avant exécution
 * - Importer les abonnements fixes dans Pennylane
 * - Référencer les produits variables à supprimer manuellement ou via API write
 */

import * as XLSX from 'xlsx-js-style';

// === Styles ===
const BLEU_FONCE = '1F3864';
const BLEU_MOYEN = '2B4C7E';
const BLEU_CLAIR = 'D6E4F0';
const VERT = '27AE60';
const ROUGE = 'E74C3C';
const ORANGE = 'F39C12';

const borderThin = { style: 'thin', color: { rgb: '999999' } };
const allBorders = { top: borderThin, bottom: borderThin, left: borderThin, right: borderThin };

const styleTitre = {
  font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: BLEU_FONCE } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: allBorders
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

const styleCellCenter = {
  font: { name: 'Calibri', sz: 10 },
  border: allBorders,
  alignment: { horizontal: 'center', vertical: 'center' }
};

const styleCellNum = {
  font: { name: 'Calibri', sz: 10 },
  border: allBorders,
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt: '#,##0.00'
};

const styleGarder = {
  font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: VERT } },
  border: allBorders,
  alignment: { horizontal: 'center', vertical: 'center' }
};

const styleSupprimer = {
  font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: ROUGE } },
  border: allBorders,
  alignment: { horizontal: 'center', vertical: 'center' }
};

const styleLabelKPI = {
  font: { name: 'Calibri', sz: 11, bold: true },
  fill: { fgColor: { rgb: BLEU_CLAIR } },
  border: allBorders,
  alignment: { vertical: 'center' }
};

const styleValueKPI = {
  font: { name: 'Calibri', sz: 11, bold: true },
  fill: { fgColor: { rgb: BLEU_CLAIR } },
  border: allBorders,
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt: '#,##0.00'
};

const styleValueInt = {
  font: { name: 'Calibri', sz: 11, bold: true },
  fill: { fgColor: { rgb: BLEU_CLAIR } },
  border: allBorders,
  alignment: { horizontal: 'right', vertical: 'center' }
};

const styleHeaderGarder = {
  ...styleHeader,
  fill: { fgColor: { rgb: VERT } }
};

const styleHeaderSupprimer = {
  ...styleHeader,
  fill: { fgColor: { rgb: ROUGE } }
};

/** Helper : convertit un index colonne en lettre */
function colLetter(idx) {
  let s = '';
  let n = idx;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

function setCell(ws, ref, value, style) {
  const cell = { v: value, s: style };
  if (typeof value === 'number') cell.t = 'n';
  else cell.t = 's';
  ws[ref] = cell;
}

/**
 * Exporte la restructuration en Excel.
 *
 * @param {Object} params
 * @param {import('./subscriptionRestructuration.js').PlanRestructurationClient[]} params.plans
 * @param {Object} params.stats - Résultat de calculerStatistiques
 * @param {boolean} [params.singleClient] - true si export pour un seul client (test)
 */
export function exportRestructurationExcel({ plans, stats, singleClient = false }) {
  const wb = XLSX.utils.book_new();
  const dateStr = new Date().toLocaleDateString('fr-FR');

  // Onglet 1 : Résumé
  buildResumeSheet(wb, { stats, dateStr, singleClient, plans });

  // Onglet 2 : Import PL (abonnements FIXES avec prix 2026)
  buildImportFixeSheet(wb, { plans });

  // Onglet 3 : Produits à SUPPRIMER
  buildSupprimerSheet(wb, { plans });

  // Onglet 4 : Détail croisé
  buildDetailCroiseSheet(wb, { plans });

  // Télécharger
  const prefix = singleClient && plans.length === 1
    ? `restructuration_${plans[0].client_nom.replace(/[^a-zA-Z0-9]/g, '_')}`
    : 'restructuration_abonnements';
  const fileName = `${prefix}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Onglet Résumé : KPIs et tableau par cabinet.
 */
function buildResumeSheet(wb, { stats, dateStr, singleClient, plans }) {
  const ws = {};
  const merges = [];
  let row = 1;

  // Titre
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } });
  const title = singleClient && plans.length === 1
    ? `RESTRUCTURATION — ${plans[0].client_nom}`
    : 'RESTRUCTURATION DES ABONNEMENTS PENNYLANE';
  setCell(ws, `A${row}`, title, styleTitre);
  for (let c = 1; c <= 4; c++) setCell(ws, `${colLetter(c)}${row}`, '', styleTitre);
  row++;

  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 4 } });
  setCell(ws, `A${row}`, `Phase 2 — Honoraires 2026 — ${dateStr}`, {
    font: { name: 'Calibri', sz: 10, color: { rgb: '666666' } },
    alignment: { horizontal: 'center' }
  });
  row += 2;

  // KPIs
  const kpis = [
    ['Clients analysés', stats.totalClients, false],
    ['Clients avec produits variables', stats.totalClientsAvecVariable, false],
    ['Clients fixe uniquement', stats.totalClientsFixeOnly, false],
    ['', '', false],
    ['Lignes FIXES (à garder)', stats.totalLignesFixes, false],
    ['Lignes VARIABLES (à supprimer)', stats.totalLignesVariables, false],
    ['', '', false],
    ['Abonnements à supprimer entièrement', stats.totalAbosASupprimer, false],
    ['Abonnements à modifier (retirer variable)', stats.totalAbosAModifier, false],
    ['Abonnements inchangés', stats.totalAbosInchanges, false],
    ['', '', false],
    ['Total HT actuel (tous produits)', stats.totalHtActuel, true],
    ['Total HT FIXE 2026 (après augmentation)', stats.totalHtFixe2026, true],
    ['Total HT variable actuel (à supprimer de PL)', stats.totalHtVariableActuel, true],
  ];

  for (const [label, value, isCurrency] of kpis) {
    if (label === '') { row++; continue; }
    setCell(ws, `A${row}`, label, styleLabelKPI);
    setCell(ws, `B${row}`, '', styleLabelKPI);
    setCell(ws, `C${row}`, '', styleLabelKPI);
    setCell(ws, `D${row}`, value, isCurrency ? styleValueKPI : styleValueInt);
    setCell(ws, `E${row}`, '', styleLabelKPI);
    merges.push({ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: 2 } });
    row++;
  }

  row += 2;

  // Tableau par cabinet
  const cabHeaders = ['Cabinet', 'Clients', 'Avec variable', 'Lignes fixes', 'Lignes variables', 'HT fixe 2026', 'HT variable actuel'];
  for (let c = 0; c < cabHeaders.length; c++) {
    setCell(ws, `${colLetter(c)}${row}`, cabHeaders[c], styleHeader);
  }
  row++;

  for (const [cab, data] of Object.entries(stats.parCabinet)) {
    setCell(ws, `A${row}`, cab, styleCell);
    setCell(ws, `B${row}`, data.nbClients, styleCellCenter);
    setCell(ws, `C${row}`, data.nbAvecVariable, styleCellCenter);
    setCell(ws, `D${row}`, data.lignesFixes, styleCellCenter);
    setCell(ws, `E${row}`, data.lignesVariables, styleCellCenter);
    setCell(ws, `F${row}`, data.htFixe2026, styleCellNum);
    setCell(ws, `G${row}`, data.htVariableActuel, styleCellNum);
    row++;
  }

  ws['!ref'] = `A1:G${row}`;
  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 40 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }
  ];
  ws['!rows'] = [{ hpt: 32 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Résumé');
}

/**
 * Onglet Import PL : format import Pennylane avec les abonnements FIXES uniquement.
 * Même format que buildPennylaneSheets dans exportAugmentation.js.
 */
function buildImportFixeSheet(wb, { plans }) {
  // Séparer les plans par cabinet → un onglet par cabinet
  const cabinets = new Map();
  for (const plan of plans) {
    const cab = plan.cabinet || 'Autre';
    if (!cabinets.has(cab)) cabinets.set(cab, []);
    cabinets.get(cab).push(plan);
  }

  for (const [cabinet, cabinetPlans] of cabinets) {
    const shortName = cabinet === 'Audit Up' ? 'AUP' : cabinet === 'Zerah Fiduciaire' ? 'ZF' : cabinet;

    const fixedHeaders = [
      'Intervalle de frequence',
      "Frequence d'abonnement",
      'Mode de finalisation',
      'Date de creation',
      'Jour du mois de facturation',
      'Nom',
      'Identifiant du client',
      'Conditions de paiement',
      'Moyen de paiement'
    ];

    let maxLines = 0;
    for (const plan of cabinetPlans) {
      for (const abo of plan.abonnements) {
        if (abo.lignes_fixes.length > maxLines) maxLines = abo.lignes_fixes.length;
      }
    }
    maxLines = Math.max(maxLines, 1);

    const lineHeaders = [];
    for (let l = 1; l <= maxLines; l++) {
      lineHeaders.push(`Ligne ${l} - Label`);
      lineHeaders.push(`Ligne ${l} - Quantite`);
      lineHeaders.push(`Ligne ${l} - TTC`);
      lineHeaders.push(`Ligne ${l} - Taux TVA`);
      lineHeaders.push(`Ligne ${l} - description`);
    }

    const headers = [...fixedHeaders, ...lineHeaders];
    const data = [];

    const sortedPlans = [...cabinetPlans].sort((a, b) => a.client_nom.localeCompare(b.client_nom, 'fr'));

    for (const plan of sortedPlans) {
      for (const abo of plan.abonnements) {
        if (abo.lignes_fixes.length === 0) continue;

        const dateCreation = formatDatePennylane(abo.date_debut);

        const row = [
          abo.intervalle || 1,
          abo.frequence || 'monthly',
          abo.mode_finalisation || 'awaiting_validation',
          dateCreation,
          abo.jour_facturation || 31,
          plan.client_nom,
          plan.pennylane_customer_id,
          abo.conditions_paiement || 'upon_receipt',
          abo.moyen_paiement || 'offline'
        ];

        for (let l = 0; l < maxLines; l++) {
          if (l < abo.lignes_fixes.length) {
            const ligne = abo.lignes_fixes[l];
            const ttcUnitaire = Math.round(ligne.nouveau_pu_ht * 1.2 * 100) / 100;

            row.push(ligne.label);
            row.push(ligne.quantite);
            row.push(ttcUnitaire);
            row.push('FR_200');
            row.push(ligne.description || '');
          } else {
            row.push('', '', '', '', '');
          }
        }

        data.push(row);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

    const colWidths = [
      { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 8 },
      { wch: 30 }, { wch: 38 }, { wch: 16 }, { wch: 10 }
    ];
    for (let l = 0; l < maxLines; l++) {
      colWidths.push({ wch: 40 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 30 });
    }
    ws['!cols'] = colWidths;

    for (let c = 0; c < headers.length; c++) {
      const ref = `${colLetter(c)}1`;
      if (ws[ref]) ws[ref].s = c < fixedHeaders.length ? styleHeader : styleHeaderGarder;
    }

    XLSX.utils.book_append_sheet(wb, ws, `Import PL ${shortName}`);
  }
}

/**
 * Onglet Produits à SUPPRIMER : lignes variables à retirer de Pennylane.
 */
function buildSupprimerSheet(wb, { plans }) {
  const headers = [
    'Client', 'Cabinet', 'SIREN', 'PL Customer ID',
    'PL Sub ID', 'Abonnement', 'Décision abo',
    'Produit', 'Axe', 'Quantité', 'PU HT actuel',
    'Montant HT actuel', 'Famille'
  ];

  const rows = [];

  for (const plan of plans) {
    for (const abo of plan.abonnements) {
      for (const ligne of abo.lignes_variables) {
        rows.push([
          plan.client_nom,
          plan.cabinet,
          plan.siren,
          plan.pennylane_customer_id,
          abo.pennylane_subscription_id,
          abo.label,
          abo.decision === 'a_supprimer' ? 'SUPPRIMER ABO' : 'RETIRER LIGNE',
          ligne.label,
          ligne.axe,
          ligne.quantite,
          ligne.ancien_pu_ht,
          Math.round(ligne.ancien_pu_ht * ligne.quantite * 100) / 100,
          ligne.famille
        ]);
      }
    }
  }

  if (rows.length === 0) {
    rows.push(['Aucun produit variable à supprimer', '', '', '', '', '', '', '', '', '', '', '', '']);
  }

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  ws['!cols'] = [
    { wch: 30 }, { wch: 16 }, { wch: 12 }, { wch: 38 },
    { wch: 12 }, { wch: 30 }, { wch: 16 },
    { wch: 45 }, { wch: 18 }, { wch: 8 }, { wch: 12 },
    { wch: 14 }, { wch: 12 }
  ];

  // Styler le header en rouge
  for (let c = 0; c < headers.length; c++) {
    const ref = `${colLetter(c)}1`;
    if (ws[ref]) ws[ref].s = styleHeaderSupprimer;
  }

  // Autofiltre
  ws['!autofilter'] = { ref: `A1:${colLetter(headers.length - 1)}${rows.length + 1}` };

  XLSX.utils.book_append_sheet(wb, ws, 'A SUPPRIMER');
}

/**
 * Onglet Détail croisé : vue complète avec toutes les lignes et leur décision.
 */
function buildDetailCroiseSheet(wb, { plans }) {
  const ws = {};
  let row = 1;

  const headers = [
    'Client', 'Cabinet', 'SIREN',
    'PL Sub ID', 'Abonnement', 'Statut abo', 'Fréquence', 'Intervalle',
    'Produit', 'Axe', 'Type', 'Action',
    'Qté', 'PU actuel HT', 'PU 2026 HT', 'Delta PU', 'Delta %',
    'Mt actuel HT', 'Mt 2026 HT'
  ];

  for (let c = 0; c < headers.length; c++) {
    setCell(ws, `${colLetter(c)}${row}`, headers[c], styleHeader);
  }
  row++;

  for (const plan of plans) {
    for (const abo of plan.abonnements) {
      const allLignes = [
        ...abo.lignes_fixes.map(l => ({ ...l, action: 'GARDER' })),
        ...abo.lignes_variables.map(l => ({ ...l, action: 'SUPPRIMER' }))
      ];

      for (const ligne of allLignes) {
        const deltaPU = Math.round((ligne.nouveau_pu_ht - ligne.ancien_pu_ht) * 100) / 100;
        const deltaPct = ligne.ancien_pu_ht > 0
          ? Math.round((deltaPU / ligne.ancien_pu_ht) * 10000) / 100
          : 0;

        setCell(ws, `A${row}`, plan.client_nom, styleCell);
        setCell(ws, `B${row}`, plan.cabinet, styleCell);
        setCell(ws, `C${row}`, plan.siren, styleCell);
        setCell(ws, `D${row}`, abo.pennylane_subscription_id, styleCell);
        setCell(ws, `E${row}`, abo.label, styleCell);
        setCell(ws, `F${row}`, abo.status, styleCellCenter);
        setCell(ws, `G${row}`, abo.frequence, styleCellCenter);
        setCell(ws, `H${row}`, abo.intervalle, styleCellCenter);
        setCell(ws, `I${row}`, ligne.label, styleCell);
        setCell(ws, `J${row}`, ligne.axe, styleCell);
        setCell(ws, `K${row}`, ligne.type_recurrence, styleCellCenter);
        setCell(ws, `L${row}`, ligne.action, ligne.action === 'GARDER' ? styleGarder : styleSupprimer);
        setCell(ws, `M${row}`, ligne.quantite, styleCellCenter);
        setCell(ws, `N${row}`, ligne.ancien_pu_ht, styleCellNum);
        setCell(ws, `O${row}`, ligne.nouveau_pu_ht, styleCellNum);
        setCell(ws, `P${row}`, deltaPU, styleCellNum);
        setCell(ws, `Q${row}`, deltaPct, { ...styleCellCenter, numFmt: '0.00"%"' });
        setCell(ws, `R${row}`, Math.round(ligne.ancien_pu_ht * ligne.quantite * 100) / 100, styleCellNum);
        setCell(ws, `S${row}`, Math.round(ligne.nouveau_pu_ht * ligne.quantite * 100) / 100, styleCellNum);
        row++;
      }
    }
  }

  ws['!ref'] = `A1:S${row - 1}`;
  ws['!autofilter'] = { ref: `A1:S${row - 1}` };
  ws['!cols'] = [
    { wch: 30 }, { wch: 16 }, { wch: 12 },
    { wch: 12 }, { wch: 30 }, { wch: 13 }, { wch: 10 }, { wch: 9 },
    { wch: 45 }, { wch: 18 }, { wch: 8 }, { wch: 12 },
    { wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 8 },
    { wch: 14 }, { wch: 14 }
  ];
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(wb, ws, 'Détail croisé');
}

/**
 * Formate une date ISO (YYYY-MM-DD) en dd/mm/yyyy pour Pennylane.
 */
function formatDatePennylane(dateStr) {
  if (!dateStr) return '';
  if (dateStr.includes('/')) return dateStr;
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}
