// @ts-check

/**
 * @file Moteur de calcul des augmentations d'honoraires
 *
 * Calcule l'impact d'augmentations en % ou € par axe, par client, par ligne.
 */

import { AXE_DEFINITIONS, AXE_KEYS, getMultiplicateurAccessoire } from './classificationAxes.js';

/**
 * @typedef {Object} ParametreAxe
 * @property {boolean} actif - Axe inclus dans la simulation
 * @property {'pourcentage'|'montant'} mode - Type d'augmentation
 * @property {number} valeur - Valeur (% ou €)
 * @property {boolean} useGlobal - Utiliser le % global plutôt que la valeur propre
 */

/**
 * @typedef {Object} ParametresAugmentation
 * @property {number} pourcentageGlobal - % par défaut pour tous les axes
 * @property {Object.<string, ParametreAxe>} axes - Paramètres par axe
 */

/**
 * @typedef {Object} ResultatLigne
 * @property {number} ligne_id
 * @property {number} abonnement_id
 * @property {number} pennylane_subscription_id
 * @property {number} client_id
 * @property {string} label
 * @property {string} axe
 * @property {number} quantite
 * @property {number} ancien_prix_unitaire_ht
 * @property {number} nouveau_prix_unitaire_ht
 * @property {number} ancien_montant_ht
 * @property {number} nouveau_montant_ht
 * @property {number} delta_ht
 * @property {number} delta_pourcentage
 * @property {string} frequence
 * @property {number} intervalle
 * @property {string} status
 */

/**
 * @typedef {Object} ResultatClient
 * @property {number} client_id
 * @property {string} client_nom
 * @property {string} client_cabinet
 * @property {boolean} exclu
 * @property {string} mode_facturation_social
 * @property {Object.<string, {ancien: number, nouveau: number, delta: number}>} totaux_par_axe
 * @property {number} ancien_total_ht
 * @property {number} nouveau_total_ht
 * @property {number} delta_total_ht
 * @property {number} delta_total_pourcentage
 * @property {number} nb_lignes_modifiees
 * @property {ResultatLigne[]} lignes
 */

/**
 * Arrondit un prix à la demi-dizaine (le prix finit toujours par 0 ou 5).
 * Unités : 0→0, 1-2→0, 3-7→5, 8-9→dizaine supérieure
 *
 * @param {number} prix
 * @returns {number}
 */
export function arrondirDemiDizaine(prix) {
  const dizaine = Math.floor(prix / 10) * 10;
  const unites = prix - dizaine;
  if (unites < 3) return dizaine;
  if (unites <= 7) return dizaine + 5;
  return dizaine + 10;
}

/**
 * Arrondit un prix au demi-centime (les centimes finissent par 0 ou 5).
 * Même logique que demi-dizaine mais sur les centimes :
 * Centièmes : 0→0, 1-2→0, 3-7→5, 8-9→dizaine de centimes supérieure
 *
 * Ex: 15.862 → .86 unité 6 → 5 → 15.85
 *     15.821 → .82 unité 2 → 0 → 15.80
 *     15.837 → .83 unité 3 → 5 → 15.85
 *     15.889 → .88 unité 8 → sup → 15.90
 *
 * @param {number} prix
 * @returns {number}
 */
export function arrondirDemiCentime(prix) {
  // Travailler en centièmes de centime pour éviter les erreurs de flottants
  const centimes = Math.round(prix * 100);
  const dizaineCentimes = Math.floor(centimes / 10) * 10;
  const unites = centimes - dizaineCentimes;
  let result;
  if (unites < 3) result = dizaineCentimes;
  else if (unites <= 7) result = dizaineCentimes + 5;
  else result = dizaineCentimes + 10;
  return result / 100;
}

/**
 * Calcule le coefficient d'annualisation d'une ligne selon sa fréquence de facturation.
 * Permet de convertir un montant par période en montant annuel.
 *
 * Exemples :
 * - monthly, intervalle 1 → ×12 (mensuel)
 * - monthly, intervalle 3 → ×4 (trimestriel)
 * - monthly, intervalle 6 → ×2 (semestriel)
 * - yearly, intervalle 1 → ×1 (annuel)
 * - yearly, intervalle 2 → ×0.5 (bisannuel)
 *
 * @param {string} frequence - 'monthly' | 'yearly' | null
 * @param {number} intervalle - Intervalle entre facturations (ex: 1, 3, 6, 12)
 * @returns {number} Coefficient multiplicateur pour annualiser
 */
export function getCoeffAnnualisation(frequence, intervalle = 1) {
  const inter = intervalle || 1;
  if (frequence === 'yearly') {
    return 1 / inter;
  }
  // monthly (défaut) : 12 / intervalle
  // intervalle 1 → ×12, intervalle 3 → ×4, intervalle 6 → ×2
  return 12 / inter;
}

/**
 * Calcule la valeur effective d'augmentation pour un axe donné.
 *
 * @param {string} axeKey - Clé de l'axe
 * @param {ParametresAugmentation} params
 * @returns {{ mode: string, valeur: number, actif: boolean }}
 */
function getValeurEffective(axeKey, params) {
  const axeParam = params.axes[axeKey];
  if (!axeParam || !axeParam.actif) {
    return { mode: 'pourcentage', valeur: 0, actif: false };
  }
  if (axeParam.useGlobal) {
    return { mode: 'pourcentage', valeur: params.pourcentageGlobal, actif: true };
  }
  return { mode: axeParam.mode, valeur: axeParam.valeur, actif: true };
}

/**
 * Calcule l'augmentation pour une seule ligne de facturation.
 *
 * @param {import('./classificationAxes.js').LigneClassifiee} ligne
 * @param {ParametresAugmentation} params
 * @returns {ResultatLigne}
 */
export function calculerAugmentationLigne(ligne, params, silaeClient = null) {
  const ancienMontant = ligne.montant_ht || 0;
  const quantite = ligne.quantite || 1;
  const ancienPrixUnitaire = quantite > 0 ? ancienMontant / quantite : ancienMontant;

  let nouveauMontant = ancienMontant;
  let nouveauPrixUnitaire = ancienPrixUnitaire;

  // Pour le social (bulletin + accessoires), on utilise la quantité Silae si disponible
  // pour calculer l'impact réel (nb de bulletins réellement produits)
  let quantiteSilae = null;

  if (ligne.axe) {
    // Accessoires social : suivent automatiquement le bulletin
    if (ligne.axe === 'accessoires_social') {
      const bulletinParams = getValeurEffective('social_bulletin', params);
      if (bulletinParams.actif && bulletinParams.valeur !== 0) {
        const multiplicateur = getMultiplicateurAccessoire(ligne.label);
        let deltaBulletinUnitaire = 0;
        if (bulletinParams.mode === 'pourcentage') {
          // Mode % : le delta est un % du prix de base du bulletin
          // Prix de base du bulletin = prix de l'accessoire / multiplicateur
          const prixBulletinBase = ancienPrixUnitaire / multiplicateur;
          deltaBulletinUnitaire = prixBulletinBase * (bulletinParams.valeur / 100);
        } else {
          // Mode montant : delta direct en €
          deltaBulletinUnitaire = bulletinParams.valeur;
        }
        if (deltaBulletinUnitaire !== 0) {
          nouveauPrixUnitaire = ancienPrixUnitaire + (multiplicateur * deltaBulletinUnitaire);
          nouveauMontant = nouveauPrixUnitaire * quantite;
        }
      }

      // Quantité Silae pour les accessoires : selon le type
      // IMPORTANT: utiliser ?? au lieu de || pour ne pas perdre les valeurs 0
      if (silaeClient) {
        const l = (ligne.label || '').toLowerCase();
        if (l.includes('coffre') || l.includes('publi')) {
          // Coffre-fort / publi-postage → même quantité que les bulletins
          quantiteSilae = silaeClient.bulletins ?? silaeClient.bulletins_total ?? null;
        } else if (l.includes('extra')) {
          // Extra (entrée/sortie d'un extra) → entrées Silae (c'est un événement unitaire)
          quantiteSilae = silaeClient.entrees ?? null;
        } else if (l.includes('modification') || l.includes('modif')) {
          // Modifications de bulletin → forfait 1 par client (pas de donnée Silae pour ça)
          quantiteSilae = 1;
        } else if (l.includes('sortie') && !l.includes('entrée') && !l.includes('entree')) {
          // Sortie seule (pas un extra) → sorties Silae
          quantiteSilae = silaeClient.sorties ?? null;
        } else if (l.includes('entrée') || l.includes('entree') || l.includes('entrées') || l.includes('entrees')) {
          // Entrée de salariés → entrées Silae
          quantiteSilae = silaeClient.entrees ?? null;
        }
      }
    } else {
      const { mode, valeur, actif } = getValeurEffective(ligne.axe, params);

      if (actif && valeur !== 0) {
        if (ligne.axe === 'social_bulletin') {
          // Social au bulletin : augmentation du prix unitaire (en % ou en €)
          if (mode === 'pourcentage') {
            nouveauPrixUnitaire = ancienPrixUnitaire * (1 + valeur / 100);
          } else {
            nouveauPrixUnitaire = ancienPrixUnitaire + valeur;
          }
          nouveauMontant = nouveauPrixUnitaire * quantite;
        } else if (mode === 'pourcentage') {
          // Autres axes en mode %
          nouveauMontant = ancienMontant * (1 + valeur / 100);
          nouveauPrixUnitaire = quantite > 0 ? nouveauMontant / quantite : nouveauMontant;
        } else {
          // Autres axes en mode montant
          nouveauMontant = ancienMontant + valeur;
          nouveauPrixUnitaire = quantite > 0 ? nouveauMontant / quantite : nouveauMontant;
        }
      }

      // Quantité Silae pour le bulletin
      if (ligne.axe === 'social_bulletin' && silaeClient) {
        quantiteSilae = silaeClient.bulletins ?? silaeClient.bulletins_total ?? null;
      }
    }
  }

  // Arrondi métier UNIQUEMENT si le prix a été modifié (sinon on ne touche pas au prix actuel)
  const aEteModifie = nouveauPrixUnitaire !== ancienPrixUnitaire;

  if (aEteModifie) {
    // Arrondi demi-dizaine pour compta, bilan, juridique, support
    // Seulement si le prix est >= 10€ (en dessous, la granularité 5€ est trop grossière)
    if (ligne.axe === 'compta_mensuelle' || ligne.axe === 'bilan' || ligne.axe === 'juridique' || ligne.axe === 'support') {
      if (nouveauPrixUnitaire >= 10) {
        nouveauPrixUnitaire = arrondirDemiDizaine(nouveauPrixUnitaire);
      } else {
        nouveauPrixUnitaire = Math.round(nouveauPrixUnitaire * 100) / 100;
      }
      nouveauMontant = nouveauPrixUnitaire * quantite;
    }

    // Arrondi demi-centime pour bulletin et accessoires
    if (ligne.axe === 'social_bulletin' || ligne.axe === 'accessoires_social') {
      nouveauPrixUnitaire = arrondirDemiCentime(nouveauPrixUnitaire);
      nouveauMontant = nouveauPrixUnitaire * quantite;
    }
  }

  // Arrondir à 2 décimales
  nouveauMontant = Math.round(nouveauMontant * 100) / 100;
  nouveauPrixUnitaire = Math.round(nouveauPrixUnitaire * 100) / 100;

  // Impact Silae : si on a une quantité Silae, calculer le montant avec cette quantité
  // Cela donne l'impact réel basé sur la production réelle
  let montantSilae = null;
  let deltaSilae = null;
  if (quantiteSilae !== null && (ligne.axe === 'social_bulletin' || ligne.axe === 'accessoires_social')) {
    montantSilae = Math.round(nouveauPrixUnitaire * quantiteSilae * 100) / 100;
    const ancienMontantSilae = Math.round(ancienPrixUnitaire * quantiteSilae * 100) / 100;
    deltaSilae = Math.round((montantSilae - ancienMontantSilae) * 100) / 100;
  }

  const delta = Math.round((nouveauMontant - ancienMontant) * 100) / 100;
  const deltaPourcentage = ancienMontant > 0
    ? Math.round(((nouveauMontant - ancienMontant) / ancienMontant) * 10000) / 100
    : 0;

  const coeffAnnuel = getCoeffAnnualisation(ligne.frequence, ligne.intervalle);

  return {
    ligne_id: ligne.ligne_id,
    abonnement_id: ligne.abonnement_id,
    pennylane_subscription_id: ligne.pennylane_subscription_id,
    client_id: ligne.client_id,
    label: ligne.label,
    axe: ligne.axe,
    quantite,
    ancien_prix_unitaire_ht: Math.round(ancienPrixUnitaire * 100) / 100,
    nouveau_prix_unitaire_ht: nouveauPrixUnitaire,
    ancien_montant_ht: ancienMontant,
    nouveau_montant_ht: nouveauMontant,
    delta_ht: delta,
    delta_pourcentage: deltaPourcentage,
    frequence: ligne.frequence,
    intervalle: ligne.intervalle,
    coeff_annualisation: coeffAnnuel,
    status: ligne.status,
    description: ligne.description || '',
    // Données Silae (quantité réelle et impact)
    quantite_silae: quantiteSilae,
    montant_silae: montantSilae,
    delta_silae: deltaSilae
  };
}

/**
 * Calcule les augmentations pour toutes les lignes, groupées par client.
 *
 * @param {import('./classificationAxes.js').LigneClassifiee[]} lignesClassifiees
 * @param {ParametresAugmentation} params
 * @param {Set<number>} [clientsExclus] - IDs des clients exclus
 * @param {Map<number, Object>} [silaeData] - Map<client_id, silae_production> pour quantités réelles
 * @returns {ResultatClient[]}
 */
export function calculerAugmentationGlobale(lignesClassifiees, params, clientsExclus = new Set(), silaeData = null) {
  // Regrouper par client
  /** @type {Map<number, {info: any, lignes: import('./classificationAxes.js').LigneClassifiee[]}>} */
  const parClient = new Map();

  for (const ligne of lignesClassifiees) {
    if (!parClient.has(ligne.client_id)) {
      parClient.set(ligne.client_id, {
        info: {
          client_id: ligne.client_id,
          client_nom: ligne.client_nom,
          client_cabinet: ligne.client_cabinet,
          mode_facturation_social: ligne.mode_facturation_social
        },
        lignes: []
      });
    }
    parClient.get(ligne.client_id).lignes.push(ligne);
  }

  // Calculer pour chaque client
  const resultats = [];

  for (const [clientId, { info, lignes }] of parClient) {
    const exclu = clientsExclus.has(clientId);

    // Initialiser les totaux par axe
    const totauxParAxe = {};
    for (const key of AXE_KEYS) {
      totauxParAxe[key] = { ancien: 0, nouveau: 0, delta: 0 };
    }

    let ancienTotal = 0;
    let nouveauTotal = 0;
    let nbLignesModifiees = 0;
    const lignesResultat = [];

    const silaeClient = silaeData ? silaeData.get(clientId) || null : null;

    for (const ligne of lignes) {
      const resultat = calculerAugmentationLigne(
        ligne,
        exclu ? { pourcentageGlobal: 0, axes: {} } : params,
        silaeClient
      );

      lignesResultat.push(resultat);

      // Coefficient d'annualisation pour cette ligne
      const coeff = resultat.coeff_annualisation;

      // Pour les totaux : si Silae dispo, utiliser les montants Silae (cohérent ancien/nouveau/delta)
      // Sinon utiliser les montants Pennylane
      const ancienPourTotal = resultat.montant_silae !== null
        ? Math.round(resultat.ancien_prix_unitaire_ht * resultat.quantite_silae * 100) / 100
        : resultat.ancien_montant_ht;
      const nouveauPourTotal = resultat.montant_silae !== null
        ? resultat.montant_silae
        : resultat.nouveau_montant_ht;
      const deltaPourTotal = resultat.delta_silae !== null
        ? resultat.delta_silae
        : resultat.delta_ht;

      // Annualiser les montants pour les totaux
      ancienTotal += ancienPourTotal * coeff;
      nouveauTotal += nouveauPourTotal * coeff;

      if (resultat.axe && totauxParAxe[resultat.axe]) {
        totauxParAxe[resultat.axe].ancien += ancienPourTotal * coeff;
        totauxParAxe[resultat.axe].nouveau += nouveauPourTotal * coeff;
        totauxParAxe[resultat.axe].delta += deltaPourTotal * coeff;
      }

      if (deltaPourTotal !== 0) {
        nbLignesModifiees++;
      }
    }

    const deltaTotal = Math.round((nouveauTotal - ancienTotal) * 100) / 100;
    const deltaPourcentage = ancienTotal > 0
      ? Math.round(((nouveauTotal - ancienTotal) / ancienTotal) * 10000) / 100
      : 0;

    resultats.push({
      client_id: clientId,
      client_nom: info.client_nom,
      client_cabinet: info.client_cabinet,
      exclu,
      mode_facturation_social: info.mode_facturation_social,
      totaux_par_axe: totauxParAxe,
      ancien_total_ht: Math.round(ancienTotal * 100) / 100,
      nouveau_total_ht: Math.round(nouveauTotal * 100) / 100,
      delta_total_ht: deltaTotal,
      delta_total_pourcentage: deltaPourcentage,
      nb_lignes_modifiees: nbLignesModifiees,
      lignes: lignesResultat
    });
  }

  // Trier par nom client
  resultats.sort((a, b) => a.client_nom.localeCompare(b.client_nom));

  return resultats;
}

/**
 * Calcule les totaux résumés par axe, par cabinet et globaux.
 *
 * @param {ResultatClient[]} resultats
 * @returns {{
 *   parAxe: Object.<string, {ancien: number, nouveau: number, delta: number, deltaPct: number}>,
 *   parCabinet: Object.<string, {ancien: number, nouveau: number, delta: number, deltaPct: number, nbClients: number}>,
 *   global: {ancien: number, nouveau: number, delta: number, deltaPct: number, nbClients: number, nbLignes: number}
 * }}
 */
export function calculerTotauxResume(resultats) {
  const parAxe = {};
  for (const key of AXE_KEYS) {
    parAxe[key] = { ancien: 0, nouveau: 0, delta: 0, deltaPct: 0 };
  }

  const parCabinet = {};
  let globalAncien = 0;
  let globalNouveau = 0;
  let nbLignesTotal = 0;
  let nbClientsImpactes = 0;

  for (const client of resultats) {
    if (client.exclu) continue;

    globalAncien += client.ancien_total_ht;
    globalNouveau += client.nouveau_total_ht;
    nbLignesTotal += client.nb_lignes_modifiees;

    if (client.delta_total_ht !== 0) {
      nbClientsImpactes++;
    }

    // Par axe
    for (const key of AXE_KEYS) {
      const axe = client.totaux_par_axe[key];
      if (axe) {
        parAxe[key].ancien += axe.ancien;
        parAxe[key].nouveau += axe.nouveau;
        parAxe[key].delta += axe.delta;
      }
    }

    // Par cabinet
    const cab = client.client_cabinet || '-';
    if (!parCabinet[cab]) {
      parCabinet[cab] = { ancien: 0, nouveau: 0, delta: 0, deltaPct: 0, nbClients: 0 };
    }
    parCabinet[cab].ancien += client.ancien_total_ht;
    parCabinet[cab].nouveau += client.nouveau_total_ht;
    parCabinet[cab].delta += client.delta_total_ht;
    parCabinet[cab].nbClients++;
  }

  // Calculer les % pour chaque axe
  for (const key of AXE_KEYS) {
    parAxe[key].deltaPct = parAxe[key].ancien > 0
      ? Math.round(((parAxe[key].nouveau - parAxe[key].ancien) / parAxe[key].ancien) * 10000) / 100
      : 0;
  }

  // Calculer les % pour chaque cabinet
  for (const cab of Object.keys(parCabinet)) {
    parCabinet[cab].deltaPct = parCabinet[cab].ancien > 0
      ? Math.round(((parCabinet[cab].nouveau - parCabinet[cab].ancien) / parCabinet[cab].ancien) * 10000) / 100
      : 0;
  }

  const globalDelta = Math.round((globalNouveau - globalAncien) * 100) / 100;
  const globalDeltaPct = globalAncien > 0
    ? Math.round(((globalNouveau - globalAncien) / globalAncien) * 10000) / 100
    : 0;

  return {
    parAxe,
    parCabinet,
    global: {
      ancien: Math.round(globalAncien * 100) / 100,
      nouveau: Math.round(globalNouveau * 100) / 100,
      delta: globalDelta,
      deltaPct: globalDeltaPct,
      nbClients: nbClientsImpactes,
      nbLignes: nbLignesTotal
    }
  };
}

/**
 * Crée les paramètres par défaut (tous les axes inactifs).
 *
 * @param {number} [pourcentageGlobal=0]
 * @returns {ParametresAugmentation}
 */
export function creerParametresDefaut(pourcentageGlobal = 0) {
  const axes = {};
  for (const key of AXE_KEYS) {
    const def = AXE_DEFINITIONS[key];
    // Les axes "suiviBulletin" (accessoires_social) n'ont pas de paramètres propres
    // Ils suivent automatiquement le bulletin
    if (def.suiviBulletin) {
      axes[key] = { actif: false, mode: 'montant', valeur: 0, useGlobal: false };
      continue;
    }
    axes[key] = {
      actif: false,
      mode: def.defaultMode,
      valeur: 0,
      useGlobal: false
    };
  }
  return { pourcentageGlobal, axes };
}
