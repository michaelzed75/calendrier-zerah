// @ts-check

/**
 * @file Diagnostic des anomalies dans les données d'abonnements Pennylane.
 * Détecte doublons, conflits de classification, labels non-standard, etc.
 */

import { classifierLigne, detectModeFacturationSocial, AXE_DEFINITIONS, AXE_KEYS } from './classificationAxes.js';

/** Mots-clés attendus dans les labels d'abonnements standards */
const KNOWN_KEYWORDS = [
  'comptab', 'surveillance', 'bilan', 'p&l', 'gestion',
  'bulletin', 'coffre-fort', 'coffre fort', 'publi-postage', 'publipostage',
  'entrée', 'entree', 'sortie', 'extra', 'modification',
  'social', 'juridique', 'secrétariat', 'secretariat',
  'support', 'logiciel', 'facturation', 'refacturation',
  'mission', 'dossier'
];

/**
 * Génère un rapport diagnostic complet sur les données d'abonnements.
 *
 * @param {Object[]} honoraires - Données brutes de getHonorairesResume() (TOUS les abonnements)
 * @param {Object[]} clients - Liste des clients depuis la BDD
 * @returns {Object} Rapport diagnostic structuré
 */
export function genererDiagnostic(honoraires, clients) {
  // === Pré-calcul : structures par client ===
  const clientsMap = new Map(); // clientId → { client, abonnements: Map<aboId, { abo, lignes[] }>, allLines[], allClassified[] }

  // Détecter le mode social par client (même logique que classifierToutesLesLignes)
  const lignesParClientPourMode = new Map();
  for (const abo of honoraires) {
    const cid = abo.client_id;
    if (!lignesParClientPourMode.has(cid)) lignesParClientPourMode.set(cid, []);
    for (const ligne of (abo.abonnements_lignes || [])) {
      lignesParClientPourMode.get(cid).push(ligne);
    }
  }

  const clientModes = new Map();
  for (const [clientId, lignes] of lignesParClientPourMode) {
    clientModes.set(clientId, detectModeFacturationSocial(lignes));
  }

  // Construire la structure par client
  let totalLignes = 0;
  for (const abo of honoraires) {
    const cid = abo.client_id;
    if (!clientsMap.has(cid)) {
      const client = clients.find(c => c.id === cid);
      clientsMap.set(cid, {
        client,
        clientNom: client?.nom || abo.clients?.nom || abo.label || `Client #${cid}`,
        clientCabinet: client?.cabinet || abo.clients?.cabinet || '-',
        abonnements: new Map(),
        allLines: [],
        allClassified: []
      });
    }
    const data = clientsMap.get(cid);
    const modeSocial = clientModes.get(cid) || 'forfait';

    const lignesAbo = [];
    for (const ligne of (abo.abonnements_lignes || [])) {
      totalLignes++;
      const axe = classifierLigne(ligne, modeSocial);
      const enriched = {
        ...ligne,
        abonnement_id: abo.id,
        abo_label: abo.label,
        abo_status: abo.status,
        abo_pennylane_id: abo.pennylane_subscription_id,
        axe
      };
      lignesAbo.push(enriched);
      data.allLines.push(enriched);
      data.allClassified.push(enriched);
    }
    data.abonnements.set(abo.id, { abo, lignes: lignesAbo });
  }

  // === Détection des anomalies ===
  const socialConflicts = [];
  const duplicateUniqueAxes = [];
  const duplicateLabels = [];
  const multipleSubscriptions = [];
  const nonStandardLabels = [];
  const unclassifiedLines = [];
  const suspiciousBulletinPrices = [];

  for (const [clientId, data] of clientsMap) {
    const { clientNom, clientCabinet, allClassified, allLines, abonnements } = data;

    // Lignes des abonnements actifs uniquement (pour doublons/conflits)
    const ACTIVE_STATUSES = new Set(['in_progress', 'not_started']);
    const activeClassified = allClassified.filter(l => ACTIVE_STATUSES.has(l.abo_status));
    const activeLines = allLines.filter(l => ACTIVE_STATUSES.has(l.abo_status));

    // --- Pattern 1 : Conflit social forfait/bulletin (par abonnement actif) ---
    for (const [aboId, { abo, lignes }] of abonnements) {
      if (!ACTIVE_STATUSES.has(abo.status)) continue;
      const aboAxes = new Set(lignes.map(l => l.axe).filter(Boolean));
      if (aboAxes.has('social_forfait') && aboAxes.has('social_bulletin')) {
        socialConflicts.push({
          type: 'social_conflict',
          severity: 'error',
          clientId,
          clientNom,
          clientCabinet,
          description: `${clientNom} / ${abo.label} : lignes classées à la fois en forfait social ET en bulletin social`,
          details: lignes.map(l => ({
            ...formatLigneDetail(l),
            _isAnomaly: l.axe === 'social_forfait' || l.axe === 'social_bulletin',
            ...(l.axe === 'social_forfait' ? { classification: 'Social forfait' } :
               l.axe === 'social_bulletin' ? { classification: 'Social bulletin' } : {})
          }))
        });
      }
    }

    // --- Pattern 2 : Doublons d'axes uniques (par abonnement actif) ---
    for (const [aboId, { abo, lignes }] of abonnements) {
      if (!ACTIVE_STATUSES.has(abo.status)) continue;
      for (const axeKey of AXE_KEYS) {
        if (!AXE_DEFINITIONS[axeKey]?.unique) continue;
        const linesForAxe = lignes.filter(l => l.axe === axeKey);
        if (linesForAxe.length <= 1) continue;
        duplicateUniqueAxes.push({
          type: 'duplicate_unique_axe',
          severity: 'warning',
          clientId,
          clientNom,
          clientCabinet,
          description: `${clientNom} / ${abo.label} : ${linesForAxe.length} lignes pour l'axe "${AXE_DEFINITIONS[axeKey].label}" (devrait être unique)`,
          details: lignes.map(l => ({ ...formatLigneDetail(l), _isAnomaly: l.axe === axeKey }))
        });
      }
    }

    // --- Pattern 3 : Labels dupliqués dans un même abonnement (actifs uniquement) ---
    for (const [aboId, { abo, lignes }] of abonnements) {
      if (!ACTIVE_STATUSES.has(abo.status)) continue;
      const byLabel = new Map();
      for (const line of lignes) {
        const key = (line.label || '').toLowerCase().trim();
        if (!key) continue;
        if (!byLabel.has(key)) byLabel.set(key, []);
        byLabel.get(key).push(line);
      }
      for (const [labelKey, dupLines] of byLabel) {
        if (dupLines.length <= 1) continue;
        duplicateLabels.push({
          type: 'duplicate_label',
          severity: 'warning',
          clientId,
          clientNom,
          clientCabinet,
          description: `${clientNom} / ${abo.label} : "${dupLines[0].label}" apparaît ${dupLines.length} fois dans le même abonnement`,
          details: lignes.map(l => ({ ...formatLigneDetail(l), _isAnomaly: (l.label || '').toLowerCase().trim() === labelKey }))
        });
      }
    }

    // --- Pattern 4 : Multi-abonnements actifs par client/cabinet ---
    const activeAbos = [...abonnements.values()]
      .filter(a => a.abo.status === 'in_progress')
      .map(a => a.abo);
    if (activeAbos.length > 1) {
      multipleSubscriptions.push({
        type: 'multiple_subscriptions',
        severity: 'info',
        clientId,
        clientNom,
        clientCabinet,
        description: `${clientNom} (${clientCabinet}) : ${activeAbos.length} abonnements actifs (in_progress)`,
        details: activeAbos.map(abo => ({
          abonnement_id: abo.id,
          pennylane_id: abo.pennylane_subscription_id,
          label: abo.label,
          status: abo.status,
          total_ht: abo.total_ht,
          nb_lignes: (abo.abonnements_lignes || []).length
        }))
      });
    }

    // --- Pattern 5 : Labels non-standard (abonnements actifs uniquement) ---
    for (const line of activeLines) {
      const labelLower = (line.label || '').toLowerCase();
      if (!labelLower) continue;
      const matchesKeyword = KNOWN_KEYWORDS.some(kw => labelLower.includes(kw));
      if (!matchesKeyword) {
        nonStandardLabels.push({
          type: 'non_standard_label',
          severity: 'info',
          clientId,
          clientNom,
          clientCabinet,
          description: `Label inhabituel : "${line.label}"${line.description ? ` — ${line.description.substring(0, 80)}` : ''}`,
          details: [formatLigneDetail(line)]
        });
      }
    }

    // --- Pattern 6 : Lignes non classifiées (abonnements actifs uniquement) ---
    for (const line of activeClassified) {
      if (line.axe === null) {
        unclassifiedLines.push({
          type: 'unclassified_line',
          severity: 'info',
          clientId,
          clientNom,
          clientCabinet,
          description: `Ligne non classifiée : "${line.label}" (famille: ${line.famille || 'aucune'})`,
          details: [formatLigneDetail(line)]
        });
      }
    }

    // --- Pattern 7 : Prix social suspect (abonnements actifs uniquement) ---
    // Vérifie la cohérence prix ↔ classification dans les deux sens :
    // - Bulletin avec prix > 30€ → probable forfait mal classé en bulletin
    // - Bulletin avec prix < 1€ → erreur probable (quantité/montant inversés)
    // - Forfait avec prix < 30€ → probable bulletin mal classé en forfait
    for (const line of activeClassified) {
      if (line.axe !== 'social_bulletin' && line.axe !== 'social_forfait') continue;
      const quantite = line.quantite || 1;
      const montantHt = line.montant_ht || 0;
      const prixUnitaire = quantite > 0 ? montantHt / quantite : montantHt;

      if (line.axe === 'social_bulletin') {
        if (prixUnitaire > 0 && prixUnitaire < 1) {
          suspiciousBulletinPrices.push({
            type: 'suspicious_social_price',
            severity: 'warning',
            clientId,
            clientNom,
            clientCabinet,
            description: `${clientNom} : prix bulletin anormalement bas (${prixUnitaire.toFixed(2)}€ HT/bulletin) — vérifier quantité/montant`,
            details: [formatLigneDetail(line)]
          });
        } else if (prixUnitaire > 30) {
          suspiciousBulletinPrices.push({
            type: 'suspicious_social_price',
            severity: 'error',
            clientId,
            clientNom,
            clientCabinet,
            description: `${clientNom} : prix bulletin élevé (${prixUnitaire.toFixed(2)}€ > 30€) — probable forfait classé en bulletin`,
            details: [formatLigneDetail(line)]
          });
        }
      }

      if (line.axe === 'social_forfait') {
        if (prixUnitaire > 0 && prixUnitaire < 30) {
          suspiciousBulletinPrices.push({
            type: 'suspicious_social_price',
            severity: 'warning',
            clientId,
            clientNom,
            clientCabinet,
            description: `${clientNom} : prix forfait social bas (${prixUnitaire.toFixed(2)}€ < 30€) — probable bulletin classé en forfait`,
            details: [formatLigneDetail(line)]
          });
        }
      }
    }
  }

  // === Résumé ===
  const allAnomalies = [
    ...socialConflicts, ...duplicateUniqueAxes, ...duplicateLabels,
    ...multipleSubscriptions, ...nonStandardLabels, ...unclassifiedLines,
    ...suspiciousBulletinPrices
  ];

  return {
    timestamp: new Date().toISOString(),
    totalAbonnements: honoraires.length,
    totalLignes,
    totalClients: clientsMap.size,
    anomalies: {
      socialConflicts,
      duplicateUniqueAxes,
      duplicateLabels,
      multipleSubscriptions,
      nonStandardLabels,
      unclassifiedLines,
      suspiciousBulletinPrices
    },
    summary: {
      totalAnomalies: allAnomalies.length,
      bySeverity: {
        error: allAnomalies.filter(a => a.severity === 'error').length,
        warning: allAnomalies.filter(a => a.severity === 'warning').length,
        info: allAnomalies.filter(a => a.severity === 'info').length
      }
    }
  };
}

/**
 * Formate les détails d'une ligne pour l'affichage dans le rapport.
 */
function formatLigneDetail(line) {
  return {
    ligne_id: line.id,
    label: line.label,
    famille: line.famille,
    quantite: line.quantite,
    montant_ht: line.montant_ht,
    montant_ttc: line.montant_ttc,
    description: line.description,
    axe: line.axe,
    abonnement_id: line.abonnement_id,
    abo_label: line.abo_label,
    abo_status: line.abo_status,
    abo_pennylane_id: line.abo_pennylane_id
  };
}
