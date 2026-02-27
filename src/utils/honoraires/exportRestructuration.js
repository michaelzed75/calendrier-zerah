// @ts-check

/**
 * @file Export Excel de restructuration des abonnements Pennylane
 *
 * Génère un fichier Excel avec 5 onglets :
 * 1. Résumé — Vue d'ensemble : nb clients, lignes fixes/variables, montants
 * 2. Import PL AUP — Abonnements fixes Audit Up avec prix 2026 (format PL 2026)
 * 3. Import PL ZF — Abonnements fixes Zerah Fiduciaire avec prix 2026 (format PL 2026)
 * 4. A SUPPRIMER — Liste des lignes variables à retirer de PL
 * 5. Détail croisé — Vue complète par client : abonnements × lignes × décision
 *
 * Format PL 2026 (nouveau) : 1 ligne = 1 produit. Un abonnement avec N produits
 * génère N lignes, chacune répétant les 10 colonnes fixes + 4 colonnes produit.
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
 * @param {Array<{cabinet: string, pennylane_product_id: string, denomination: string, label_normalise: string}>} [params.produitsPennylane] - Produits PL pour UUID
 * @param {Set<number>} [params.validLigneIds] - Set des abonnement_ligne_id valides (depuis tarifs_reference 2026 fixe). Si fourni, seules les lignes dont le ligne_id est dans ce set sont exportées. Élimine les doublons provenant d'anciens abonnements.
 */
export function exportRestructurationExcel({ plans, stats, singleClient = false, produitsPennylane = [], validLigneIds = null }) {
  const wb = XLSX.utils.book_new();
  const dateStr = new Date().toLocaleDateString('fr-FR');

  // Onglet 1 : Résumé
  buildResumeSheet(wb, { stats, dateStr, singleClient, plans });

  // Onglet 2+ : Import PL par cabinet (abonnements FIXES avec prix 2026)
  buildImportFixeSheet(wb, { plans, produitsPennylane, validLigneIds });

  // Onglet : Produits à SUPPRIMER
  buildSupprimerSheet(wb, { plans });

  // Onglet : Détail croisé
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
function buildImportFixeSheet(wb, { plans, produitsPennylane = [], validLigneIds = null }) {
  // Séparer les plans par cabinet → un onglet par cabinet
  const cabinets = new Map();
  for (const plan of plans) {
    const cab = plan.cabinet || 'Autre';
    if (!cabinets.has(cab)) cabinets.set(cab, []);
    cabinets.get(cab).push(plan);
  }

  for (const [cabinet, cabinetPlans] of cabinets) {
    const shortName = cabinet === 'Audit Up' ? 'AUP' : cabinet === 'Zerah Fiduciaire' ? 'ZF' : cabinet;

    // Index produits PL par label_normalise+cabinet pour matching UUID
    const produitsIndex = new Map();
    for (const p of produitsPennylane) {
      if (p.cabinet === cabinet) {
        produitsIndex.set(p.label_normalise, p);
      }
    }

    // Format PL 2026 : 18 colonnes alignées sur le template officiel Pennylane
    // 1 ligne Excel = 1 produit (colonnes abo répétées)
    const headers = [
      'Raison sociale (optionnel)',
      'Identifiant client',
      'SIREN',
      'Millesime',
      'Mission (optionnel)',
      'Identifiant produit (obligatoire)',
      'Nom du produit (optionnel)',
      'Description du produit (optionnel)',
      'Honoraires (HT)',
      'Temps estime (HH:mm) (optionnel)',
      'Mode de facturation',
      'Date de debut de l\'abonnement (valable si abonnement)',
      'Date de fin de l\'abonnement (valable si abonnement)',
      'Interval de facturation (valable si abonnement)',
      'Frequence de facturation (valable si abonnement)',
      'Jour de facturation (valable si abonnement)',
      'Identifiant du modele de facturation (valable si abonnement)',
      'Mode de finalisation (valable si abonnement)'
    ];

    const data = [];
    const sortedPlans = [...cabinetPlans].sort((a, b) => a.client_nom.localeCompare(b.client_nom, 'fr'));
    const hasFilter = validLigneIds && validLigneIds.size > 0;

    for (const plan of sortedPlans) {
      for (const abo of plan.abonnements) {
        if (abo.lignes_fixes.length === 0) continue;
        const dateDebut = formatDatePennylane(abo.date_debut);

        for (const ligne of abo.lignes_fixes) {
          // Si filtre actif : ne garder que les lignes référencées par tarifs_reference
          // Élimine les doublons provenant d'anciens abonnements (prix 2025)
          if (hasFilter && !validLigneIds.has(ligne.ligne_id)) continue;

          const produit = trouverProduitFixe(ligne.label, produitsIndex);

          data.push([
            plan.client_nom,
            plan.pennylane_customer_id,
            plan.siren || '',
            2026,
            '',  // Mission (optionnel)
            produit ? produit.pennylane_product_id : '',
            ligne.label,
            ligne.description || '',
            Math.round(ligne.nouveau_pu_ht * 100) / 100,
            '',  // Temps estimé (optionnel)
            'Forfait par abonnement',
            forcerDate2026(dateDebut),
            '31/12/2099',  // Date de fin : loin dans le futur (abonnement permanent)
            abo.intervalle || 1,
            mapFrequence(abo.frequence),
            31,  // Jour de facturation : toujours dernier jour du mois
            '',  // Identifiant modèle de facturation (optionnel)
            mapModesFinalisation(abo.mode_finalisation)
          ]);
        }
      }
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

    // Forcer les colonnes date (L=début, M=fin) en type texte
    // xlsx-js-style auto-parse les dates dd/mm/yyyy → serial number → ISO
    // PL attend du texte au format JJ/MM/AAAA, pas une date Excel
    for (let r = 2; r <= data.length + 1; r++) {
      const refL = `${colLetter(11)}${r}`;  // col L = Date début
      const refM = `${colLetter(12)}${r}`;  // col M = Date fin
      if (ws[refL]) { ws[refL].t = 's'; ws[refL].z = '@'; }
      if (ws[refM]) { ws[refM].t = 's'; ws[refM].z = '@'; }
    }

    ws['!cols'] = [
      { wch: 30 }, { wch: 38 }, { wch: 12 }, { wch: 10 },  // A-D: Raison, ID client, SIREN, Millésime
      { wch: 12 },  // E: Mission
      { wch: 38 }, { wch: 45 }, { wch: 30 }, { wch: 14 },  // F-I: Produit ID, Nom, Description, HT
      { wch: 12 },  // J: Temps estimé
      { wch: 24 }, { wch: 14 }, { wch: 14 },  // K-M: Mode factu, Date début, Date fin
      { wch: 10 }, { wch: 12 }, { wch: 24 },  // N-P: Intervalle, Fréquence, Jour
      { wch: 20 }, { wch: 24 }  // Q-R: ID modèle, Mode finalisation
    ];

    for (let c = 0; c < headers.length; c++) {
      const ref = `${colLetter(c)}1`;
      // Colonnes produit (F-I = index 5-8) en vert, le reste en bleu
      if (ws[ref]) ws[ref].s = (c >= 5 && c <= 8) ? styleHeaderGarder : styleHeader;
    }

    XLSX.utils.book_append_sheet(wb, ws, `Import PL ${shortName}`);
  }
}

/**
 * Convertit la fréquence API Pennylane en valeur de liste déroulante PL.
 * Template PL attend : "mois", "ans", "semaines"
 */
export function mapFrequence(frequence) {
  const mapping = {
    'monthly': 'mois',
    'yearly': 'ans',
    'weekly': 'semaines'
  };
  return mapping[frequence] || frequence || 'mois';
}

/**
 * Convertit le jour de facturation en valeur de liste déroulante PL.
 * Note : PL rejette "Meme que la date du debut d'abonnement" à l'import,
 * seul "Dernier jour du mois" est accepté en pratique.
 */
export function mapJourFacturation(jour) {
  return 'Dernier jour du mois';
}

/**
 * Convertit le mode de finalisation API en valeur de liste déroulante PL.
 * Template PL attend : "Un brouillon de facture" ou "Une facture finalisee"
 */
export function mapModesFinalisation(mode) {
  const mapping = {
    'awaiting_validation': 'Un brouillon de facture',
    'auto_finalized': 'Une facture finalisee'
  };
  return mapping[mode] || mode || 'Un brouillon de facture';
}

/**
 * Trouve le produit PL correspondant à un label de ligne fixe.
 * Matching simplifié : cherche dans denomination (contient le label).
 */
function trouverProduitFixe(label, produitsIndex) {
  const labelLower = label.toLowerCase();

  // Matching direct par label_normalise connu
  for (const [labelNorm, produit] of produitsIndex) {
    const denom = produit.denomination.toLowerCase();
    // Matching exact ou par inclusion
    if (denom.includes(labelLower) || labelLower.includes(denom.replace(/\s*\{\{.*?\}\}\s*/g, '').trim())) {
      return produit;
    }
  }

  // Matching par mots-clés
  if (labelLower.includes('mission comptable') && labelLower.includes('social')) {
    return produitsIndex.get('mission_comptable_social') || null;
  }
  if (labelLower.includes('mission comptable') && labelLower.includes('logiciel')) {
    return produitsIndex.get('mission_comptable_logiciel') || null;
  }
  if (labelLower.includes('mission comptable') && labelLower.includes('hôtel')) {
    return produitsIndex.get('mission_comptable_hotel') || null;
  }
  if (labelLower.includes('mission comptable') && labelLower.includes('restaurant')) {
    return produitsIndex.get('mission_comptable_restaurant') || null;
  }
  if (labelLower.includes('mission comptable') && labelLower.includes('trimestr')) {
    return produitsIndex.get('mission_comptable_trim') || null;
  }
  if (labelLower.includes('mission comptable') || labelLower.includes('mission compta')) {
    return produitsIndex.get('mission_comptable') || null;
  }
  if (labelLower.includes('surveillance')) {
    return produitsIndex.get('mission_surveillance') || null;
  }
  if (labelLower.includes('p&l') || labelLower.includes('p & l')) {
    return produitsIndex.get('pl') || null;
  }
  if (labelLower.includes('quote-part') || labelLower.includes('quote part') || labelLower.includes('bilan') && !labelLower.includes('établissement')) {
    return produitsIndex.get('quote_part_bilan') || null;
  }
  if (labelLower.includes('bilan')) {
    return produitsIndex.get('bilan') || null;
  }
  if (labelLower.includes('rendez-vous') || labelLower.includes('rdv')) {
    return produitsIndex.get('rdv_analyse') || null;
  }
  if (labelLower.includes('social') && labelLower.includes('trimestr')) {
    return produitsIndex.get('social_forfait_trim') || null;
  }
  if (labelLower.includes('social') || labelLower.includes('paie')) {
    return produitsIndex.get('social_forfait') || null;
  }
  if (labelLower.includes('redevance') && labelLower.includes('logiciel')) {
    return produitsIndex.get('redevance_logiciel_hotel') || null;
  }
  if (labelLower.includes('licence') && labelLower.includes('informatique')) {
    return produitsIndex.get('licences_info') || null;
  }
  if (labelLower.includes('logiciel') || labelLower.includes('mise à disposition')) {
    return produitsIndex.get('logiciel') || null;
  }
  if (labelLower.includes('juridique') && labelLower.includes('approbation')) {
    return produitsIndex.get('juridique_approbation') || null;
  }
  if (labelLower.includes('secrétariat juridique') || labelLower.includes('secretariat juridique')) {
    return produitsIndex.get('juridique_approbation') || null;
  }

  return null;
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
 * Force une date au format dd/mm/yyyy à être au minimum le 01/01/2026.
 * PL rejette les dates dans le passé. Si la date est antérieure à 2026,
 * on la remplace par 01/01/2026 (début d'exercice).
 */
export function forcerDate2026(dateStr) {
  if (!dateStr) return '01/01/2026';
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const annee = parseInt(parts[2], 10);
    if (annee < 2026) return '01/01/2026';
  }
  return dateStr;
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
