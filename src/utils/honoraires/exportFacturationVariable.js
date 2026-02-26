// @ts-check

/**
 * @file Export Excel pour la facturation variable mensuelle (Phase 3)
 *
 * Produit UN FICHIER PAR CABINET au format d'import Pennylane BROUILLONS
 * (reproduit à l'identique le format du fichier "test final import.xlsx").
 *
 * Nommage : "AUP Janvier 26 a importer dans PL.xlsx"
 *           "ZF Janvier 26 a importer dans PL.xlsx"
 *
 * Format PLAT — 1 ligne = 1 produit d'un client.
 * Seuls les produits avec quantité Silae sont exportés (pas les manuels).
 *
 * Colonnes :
 *   A  Raison sociale (optionnel)           — texte
 *   B  SIREN                                — NOMBRE (pas texte)
 *   C  Identifiant produit (recommandé)     — texte UUID
 *   D  Nom du produit                       — texte + période (ex: "… Janvier 26")
 *   E  Description (optionnel)              — VIDE (cellule absente)
 *   F  Quantité                             — nombre
 *   G  Unité (liste déroulante)             — "unité"
 *   H  Prix unitaire HT en euros            — nombre
 *   I  Taux TVA (liste déroulante)          — nombre 0.2 format "0.00%"
 *   J  Type de produit                      — "Prestations de services"
 *   K  Date d'émission                      — serial Excel format "m/d/yy"
 *   L  Modèle (identifiant) (optionnel)     — VIDE (cellule absente)
 *
 * Feuille nommée "Feuil1".
 * Utilise xlsx-js-style.
 */

import * as XLSX from 'xlsx-js-style';

// ═══════════════════════════ Helpers ═══════════════════════════

/** Mois français (index 1-12) */
const MOIS_FR = [
  '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

/** Abréviations cabinets pour le nom de fichier */
const CABINET_ABBREV = {
  'Audit Up': 'AUP',
  'Zerah Fiduciaire': 'ZF'
};

/**
 * Formatte la période en français : "2026-01" → "Janvier 26"
 * @param {string} periode - 'YYYY-MM'
 * @returns {string}
 */
function formaterPeriodeFr(periode) {
  const [annee, mois] = periode.split('-').map(Number);
  return `${MOIS_FR[mois]} ${String(annee).slice(-2)}`;
}

/**
 * Calcule le dernier jour du mois comme serial date Excel.
 * @param {string} periode - 'YYYY-MM'
 * @returns {number} Serial date Excel
 */
function dernierJourMoisExcel(periode) {
  const [annee, mois] = periode.split('-').map(Number);
  const lastDayNum = new Date(annee, mois, 0).getDate();
  const dateUtc = Date.UTC(annee, mois - 1, lastDayNum);
  const epochUtc = Date.UTC(1899, 11, 30);
  return Math.floor((dateUtc - epochUtc) / 86400000);
}

/**
 * Nettoie la denomination PL en retirant {{mois}}, espaces superflus,
 * puis ajoute la période en suffixe (ex: "Janvier 26").
 * @param {string} denom
 * @param {string} suffixePeriode - ex: "Janvier 26"
 * @returns {string}
 */
function nettoyerDenomination(denom, suffixePeriode) {
  const clean = denom.replace(/\{\{mois\}\}/g, '').replace(/\s+$/, '').replace(/\s+/g, ' ');
  return `${clean} ${suffixePeriode}`;
}

// ═══════════════════════════ Export principal ═══════════════════════════

/**
 * Exporte la facturation variable en Excel au format PL brouillons.
 * Génère UN fichier par cabinet (AUP / ZF).
 *
 * @param {Object} params
 * @param {import('./facturationVariableService.js').ResultatFacturation} [params.resultat]
 * @param {import('./facturationVariableService.js').ClientFacturation} [params.client]
 * @param {string} params.periode
 * @param {string} [params.dateEffet]
 */
export function exportFacturationVariableExcel({ resultat, client, periode, dateEffet }) {
  const dateEmission = dernierJourMoisExcel(periode);
  const suffixePeriode = formaterPeriodeFr(periode);

  const allClients = resultat ? resultat.clients : (client ? [client] : []);
  if (allClients.length === 0) return;

  // ── Grouper par cabinet ──
  /** @type {Record<string, typeof allClients>} */
  const parCabinet = {};
  for (const c of allClients) {
    const cab = c.cabinet || 'Inconnu';
    if (!parCabinet[cab]) parCabinet[cab] = [];
    parCabinet[cab].push(c);
  }

  // ── Un fichier Excel par cabinet ──
  for (const [cabinet, clients] of Object.entries(parCabinet)) {
    const wb = XLSX.utils.book_new();
    buildImportPLSheet(wb, clients, dateEmission, suffixePeriode);

    const abbrev = CABINET_ABBREV[cabinet] || cabinet.substring(0, 3).toUpperCase();
    const fileName = `${abbrev} ${suffixePeriode} a importer dans PL.xlsx`;
    XLSX.writeFile(wb, fileName);
  }
}

// ═══════════════════════════ Construction feuille ═══════════════════════════

/**
 * Construit la feuille au format STRICT identique au "test final import.xlsx".
 * Cellule par cellule pour contrôler type (t), valeur (v) et format (z).
 * @param {*} wb
 * @param {Array} clients
 * @param {number} dateEmission
 * @param {string} suffixePeriode - ex: "Janvier 26"
 */
function buildImportPLSheet(wb, clients, dateEmission, suffixePeriode) {
  const ws = {};

  // === Headers (Row 0) — tous en texte (t:"s") ===
  const headers = [
    'Raison sociale (optionnel)',
    'SIREN',
    'Identifiant produit (recommandé)',
    'Nom du produit',
    'Description (optionnel)',
    'Quantité',
    'Unité (liste déroulante)',
    'Prix unitaire HT en euros',
    'Taux TVA  (liste déroulante)',       // Note : double espace avant (liste — identique au template PL
    'Type de produit',
    "Date d'émission",
    'Modèle (identifiant) (optionnel)'
  ];

  for (let c = 0; c < headers.length; c++) {
    const ref = XLSX.utils.encode_cell({ r: 0, c });
    ws[ref] = { t: 's', v: headers[c] };
  }

  // === Data rows — uniquement les lignes avec quantité (source Silae) ===
  let r = 1;
  for (const client of clients) {
    for (const ligne of client.lignes) {
      // Exclure les lignes manuelles (pas de quantité)
      if (ligne.quantite === null || ligne.quantite === undefined) continue;

      const siren = client.siren ? parseInt(client.siren, 10) : 0;

      // A — Raison sociale (texte)
      ws[XLSX.utils.encode_cell({ r, c: 0 })] = { t: 's', v: client.client_nom };

      // B — SIREN (NOMBRE)
      ws[XLSX.utils.encode_cell({ r, c: 1 })] = { t: 'n', v: siren };

      // C — Identifiant produit (texte UUID)
      ws[XLSX.utils.encode_cell({ r, c: 2 })] = { t: 's', v: ligne.pennylane_product_id || '' };

      // D — Nom du produit (texte, sans {{mois}}, avec période ex: "… Janvier 26")
      ws[XLSX.utils.encode_cell({ r, c: 3 })] = { t: 's', v: nettoyerDenomination(ligne.denomination || ligne.label, suffixePeriode) };

      // E — Description : cellule VIDE (on ne la crée pas → absente)

      // F — Quantité (nombre)
      ws[XLSX.utils.encode_cell({ r, c: 5 })] = { t: 'n', v: ligne.quantite };

      // G — Unité (texte)
      ws[XLSX.utils.encode_cell({ r, c: 6 })] = { t: 's', v: 'unité' };

      // H — Prix unitaire HT (nombre)
      ws[XLSX.utils.encode_cell({ r, c: 7 })] = { t: 'n', v: ligne.pu_ht };

      // I — Taux TVA (nombre avec format pourcentage)
      ws[XLSX.utils.encode_cell({ r, c: 8 })] = { t: 'n', v: ligne.tva_rate, z: '0.00%' };

      // J — Type de produit (texte)
      ws[XLSX.utils.encode_cell({ r, c: 9 })] = { t: 's', v: 'Prestations de services' };

      // K — Date d'émission (nombre serial avec format date)
      ws[XLSX.utils.encode_cell({ r, c: 10 })] = { t: 'n', v: dateEmission, z: 'm/d/yy' };

      // L — Modèle : cellule VIDE (on ne la crée pas → absente)

      r++;
    }
  }

  // Range de la feuille
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: 11 } });

  // Largeurs colonnes
  ws['!cols'] = [
    { wch: 30 },  // A
    { wch: 12 },  // B
    { wch: 38 },  // C
    { wch: 50 },  // D
    { wch: 20 },  // E
    { wch: 10 },  // F
    { wch: 10 },  // G
    { wch: 20 },  // H
    { wch: 12 },  // I
    { wch: 32 },  // J
    { wch: 14 },  // K
    { wch: 14 }   // L
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Feuil1');
}
