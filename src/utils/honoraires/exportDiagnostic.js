// @ts-check

/**
 * @file Export Excel du rapport diagnostic des abonnements.
 * Utilise xlsx-js-style (même pattern que exportAugmentation.js).
 */

import * as XLSX from 'xlsx-js-style';

// === Couleurs et styles ===

const BLEU_FONCE = '1F3864';
const BLEU_MOYEN = '2B4C7E';
const BLEU_CLAIR = 'D6E4F0';
const ROUGE_CLAIR = 'FADBD8';
const ROUGE = 'E74C3C';
const ORANGE = 'E67E22';
const JAUNE = 'F4D03F';

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

const styleCellNum = {
  font: { name: 'Calibri', sz: 10 },
  border: allBorders,
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt: '#,##0.00" \u20ac"'
};

const styleCellAnomaly = {
  font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: ROUGE } },
  fill: { fgColor: { rgb: ROUGE_CLAIR } },
  border: allBorders,
  alignment: { vertical: 'center' }
};

const styleCellAnomalyNum = {
  font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: ROUGE } },
  fill: { fgColor: { rgb: ROUGE_CLAIR } },
  border: allBorders,
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt: '#,##0.00" \u20ac"'
};

const styleStatLabel = {
  font: { name: 'Calibri', sz: 11, bold: true },
  border: allBorders,
  alignment: { vertical: 'center' }
};

const styleStatValue = {
  font: { name: 'Calibri', sz: 11, bold: true },
  border: allBorders,
  alignment: { horizontal: 'right', vertical: 'center' }
};

const SEVERITY_COLORS = {
  error: ROUGE,
  warning: ORANGE,
  info: JAUNE
};

// === Helpers ===

function setCell(ws, ref, value, style) {
  const cell = { v: value, s: style };
  if (typeof value === 'number') cell.t = 'n';
  else cell.t = 's';
  ws[ref] = cell;
}

function colLetter(idx) {
  let s = '';
  let n = idx;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/** Définition des feuilles d'anomalies */
const SHEET_DEFS = [
  {
    key: 'socialConflicts',
    name: 'Conflits social',
    columns: ['Client', 'Cabinet', 'Abonnement', 'Label', 'Classification', 'Famille', 'Axe', 'Qté', 'Mt HT', 'Statut'],
    widths: [25, 15, 20, 35, 15, 15, 20, 6, 12, 12],
    mapRow: (anomaly, d) => [
      anomaly.clientNom, anomaly.clientCabinet, d.abo_label || '',
      d.label || '', d.classification || '', d.famille || '', d.axe || '',
      d.quantite ?? '', d.montant_ht ?? '', d.abo_status || ''
    ],
    numCols: [8] // index of Mt HT column
  },
  {
    key: 'duplicateUniqueAxes',
    name: 'Doublons axes',
    columns: ['Client', 'Cabinet', 'Abonnement', 'Label', 'Famille', 'Axe', 'Qté', 'Mt HT', 'Statut'],
    widths: [25, 15, 20, 35, 15, 20, 6, 12, 12],
    mapRow: (anomaly, d) => [
      anomaly.clientNom, anomaly.clientCabinet, d.abo_label || '',
      d.label || '', d.famille || '', d.axe || '',
      d.quantite ?? '', d.montant_ht ?? '', d.abo_status || ''
    ],
    numCols: [7]
  },
  {
    key: 'duplicateLabels',
    name: 'Labels dupliqués',
    columns: ['Client', 'Cabinet', 'Abonnement', 'Label', 'Famille', 'Axe', 'Qté', 'Mt HT', 'Statut'],
    widths: [25, 15, 20, 35, 15, 20, 6, 12, 12],
    mapRow: (anomaly, d) => [
      anomaly.clientNom, anomaly.clientCabinet, d.abo_label || '',
      d.label || '', d.famille || '', d.axe || '',
      d.quantite ?? '', d.montant_ht ?? '', d.abo_status || ''
    ],
    numCols: [7]
  },
  {
    key: 'multipleSubscriptions',
    name: 'Multi-abonnements',
    columns: ['Client', 'Cabinet', 'Abonnement', 'PL ID', 'Statut', 'Total HT', 'Nb lignes'],
    widths: [25, 15, 25, 12, 12, 14, 10],
    mapRow: (anomaly, d) => [
      anomaly.clientNom, anomaly.clientCabinet,
      d.label || '', d.pennylane_id ?? '', d.status || '',
      d.total_ht ?? '', d.nb_lignes ?? ''
    ],
    numCols: [5]
  },
  {
    key: 'nonStandardLabels',
    name: 'Labels non standard',
    columns: ['Client', 'Cabinet', 'Abonnement', 'Label', 'Famille', 'Axe', 'Mt HT'],
    widths: [25, 15, 20, 40, 15, 20, 12],
    mapRow: (anomaly, d) => [
      anomaly.clientNom, anomaly.clientCabinet, d.abo_label || '',
      d.label || '', d.famille || '', d.axe || '', d.montant_ht ?? ''
    ],
    numCols: [6]
  },
  {
    key: 'unclassifiedLines',
    name: 'Non classifiées',
    columns: ['Client', 'Cabinet', 'Abonnement', 'Label', 'Famille', 'Mt HT'],
    widths: [25, 15, 20, 40, 15, 12],
    mapRow: (anomaly, d) => [
      anomaly.clientNom, anomaly.clientCabinet, d.abo_label || '',
      d.label || '', d.famille || '', d.montant_ht ?? ''
    ],
    numCols: [5]
  }
];

/**
 * Exporte le rapport diagnostic en Excel.
 * @param {Object} report - Rapport retourné par genererDiagnostic()
 */
export function exportDiagnosticExcel(report) {
  const wb = XLSX.utils.book_new();
  const dateStr = new Date().toLocaleDateString('fr-FR');

  // === Feuille Résumé ===
  buildResumeSheet(wb, report, dateStr);

  // === Feuilles par catégorie (uniquement si anomalies > 0) ===
  for (const def of SHEET_DEFS) {
    const items = report.anomalies[def.key] || [];
    if (items.length === 0) continue;
    buildAnomalySheet(wb, def, items);
  }

  // === Download ===
  const fileName = `diagnostic_abonnements_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// === Builders ===

function buildResumeSheet(wb, report, dateStr) {
  const ws = {};
  const merges = [];
  const nbCols = 3;

  // Titre
  setCell(ws, 'A1', `Diagnostic des abonnements — ${dateStr}`, styleTitre);
  for (let c = 1; c < nbCols; c++) {
    setCell(ws, `${colLetter(c)}1`, '', styleTitre);
  }
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: nbCols - 1 } });

  // Stats
  let row = 3;
  const stats = [
    ['Clients analysés', report.totalClients],
    ['Abonnements analysés', report.totalAbonnements],
    ['Lignes analysées', report.totalLignes],
    ['', ''],
    ['Total anomalies', report.summary.totalAnomalies],
    ['  dont erreurs', report.summary.bySeverity.error],
    ['  dont alertes', report.summary.bySeverity.warning],
    ['  dont infos', report.summary.bySeverity.info]
  ];

  for (const [label, value] of stats) {
    setCell(ws, `A${row}`, label, styleStatLabel);
    setCell(ws, `B${row}`, value, styleStatValue);
    row++;
  }

  // Tableau récapitulatif par catégorie
  row += 1;
  setCell(ws, `A${row}`, 'Catégorie', styleHeader);
  setCell(ws, `B${row}`, 'Sévérité', styleHeader);
  setCell(ws, `C${row}`, 'Nb anomalies', styleHeader);
  row++;

  const CATEGORIES = [
    { key: 'socialConflicts', label: 'Conflits social forfait/bulletin', severity: 'error' },
    { key: 'duplicateUniqueAxes', label: 'Doublons d\'axes uniques', severity: 'warning' },
    { key: 'duplicateLabels', label: 'Labels dupliqués dans un abonnement', severity: 'warning' },
    { key: 'multipleSubscriptions', label: 'Abonnements multiples par client', severity: 'info' },
    { key: 'nonStandardLabels', label: 'Labels non standard', severity: 'info' },
    { key: 'unclassifiedLines', label: 'Lignes non classifiées', severity: 'info' }
  ];

  for (const cat of CATEGORIES) {
    const count = (report.anomalies[cat.key] || []).length;
    const sevColor = SEVERITY_COLORS[cat.severity];
    const sevStyle = {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: sevColor } },
      border: allBorders,
      alignment: { horizontal: 'center', vertical: 'center' }
    };
    setCell(ws, `A${row}`, cat.label, styleCell);
    setCell(ws, `B${row}`, cat.severity, sevStyle);
    setCell(ws, `C${row}`, count, { ...styleStatValue, ...(count > 0 ? { font: { ...styleStatValue.font, color: { rgb: sevColor } } } : {}) });
    row++;
  }

  ws['!ref'] = `A1:C${row - 1}`;
  ws['!merges'] = merges;
  ws['!cols'] = [{ wch: 35 }, { wch: 15 }, { wch: 15 }];
  ws['!rows'] = [{ hpt: 30 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Résumé');
}

function buildAnomalySheet(wb, def, items) {
  const ws = {};
  const cols = def.columns;

  // Headers
  for (let c = 0; c < cols.length; c++) {
    setCell(ws, `${colLetter(c)}1`, cols[c], styleHeader);
  }

  // Rows
  let row = 2;
  for (const anomaly of items) {
    // Description row (merged)
    setCell(ws, `A${row}`, anomaly.description, {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: BLEU_FONCE } },
      fill: { fgColor: { rgb: BLEU_CLAIR } },
      border: allBorders,
      alignment: { vertical: 'center' }
    });
    for (let c = 1; c < cols.length; c++) {
      setCell(ws, `${colLetter(c)}${row}`, '', {
        fill: { fgColor: { rgb: BLEU_CLAIR } },
        border: allBorders
      });
    }
    ws['!merges'] = ws['!merges'] || [];
    ws['!merges'].push({ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: cols.length - 1 } });
    row++;

    // Detail rows
    const details = anomaly.details || [];
    for (const d of details) {
      const values = def.mapRow(anomaly, d);
      const isAnomaly = d._isAnomaly ?? true;

      for (let c = 0; c < values.length; c++) {
        const isNum = def.numCols.includes(c) && typeof values[c] === 'number';
        let style;
        if (isAnomaly) {
          style = isNum ? styleCellAnomalyNum : styleCellAnomaly;
        } else {
          style = isNum ? styleCellNum : styleCell;
        }
        setCell(ws, `${colLetter(c)}${row}`, values[c], style);
      }
      row++;
    }

    // Blank separator
    row++;
  }

  ws['!ref'] = `A1:${colLetter(cols.length - 1)}${Math.max(row - 1, 1)}`;
  ws['!cols'] = def.widths.map(w => ({ wch: w }));
  ws['!rows'] = [{ hpt: 25 }];

  XLSX.utils.book_append_sheet(wb, ws, def.name);
}
