// @ts-check
/**
 * Fonctions de calcul pour les salaires
 * Taux horaires, coûts, augmentations, masse salariale
 */

/** Nombre d'heures annuelles légales en France */
export const HEURES_ANNUELLES_LEGALES = 1607;

/** Taux de charges patronales par défaut (approximatif) */
export const TAUX_CHARGES_PATRONALES_DEFAUT = 0.45; // 45%

/**
 * Calcule le coût total employeur (brut + charges patronales)
 * @param {number} salaireBrut - Salaire brut annuel
 * @param {number} chargesPatronales - Charges patronales annuelles
 * @returns {number}
 */
export function calculerCoutTotal(salaireBrut, chargesPatronales) {
  return (salaireBrut || 0) + (chargesPatronales || 0);
}

/**
 * Calcule le taux horaire brut
 * @param {number} salaireBrutAnnuel - Salaire brut annuel
 * @param {number} [heuresAnnuelles=1607] - Nombre d'heures annuelles
 * @returns {number}
 */
export function calculerTauxHoraireBrut(salaireBrutAnnuel, heuresAnnuelles = HEURES_ANNUELLES_LEGALES) {
  if (!heuresAnnuelles || heuresAnnuelles <= 0) return 0;
  return salaireBrutAnnuel / heuresAnnuelles;
}

/**
 * Calcule le taux horaire chargé (coût total / heures)
 * @param {number} salaireBrutAnnuel - Salaire brut annuel
 * @param {number} chargesPatronalesAnnuel - Charges patronales annuelles
 * @param {number} [heuresAnnuelles=1607] - Nombre d'heures annuelles
 * @returns {number}
 */
export function calculerTauxHoraireCharge(salaireBrutAnnuel, chargesPatronalesAnnuel, heuresAnnuelles = HEURES_ANNUELLES_LEGALES) {
  if (!heuresAnnuelles || heuresAnnuelles <= 0) return 0;
  const coutTotal = calculerCoutTotal(salaireBrutAnnuel, chargesPatronalesAnnuel);
  return coutTotal / heuresAnnuelles;
}

/**
 * Calcule un nouveau salaire après augmentation
 * @param {number} salaireActuel - Salaire brut actuel
 * @param {number} valeur - Valeur de l'augmentation
 * @param {'montant' | 'pourcentage'} type - Type d'augmentation
 * @returns {number}
 */
export function calculerAugmentation(salaireActuel, valeur, type) {
  if (type === 'pourcentage') {
    return salaireActuel * (1 + valeur / 100);
  }
  return salaireActuel + valeur;
}

/**
 * Estime les charges patronales à partir du brut
 * @param {number} salaireBrut - Salaire brut
 * @param {number} [taux=0.45] - Taux de charges (défaut 45%)
 * @returns {number}
 */
export function estimerChargesPatronales(salaireBrut, taux = TAUX_CHARGES_PATRONALES_DEFAUT) {
  return salaireBrut * taux;
}

/**
 * Calcule la masse salariale totale
 * @param {Array<{salaire_brut_annuel: number, charges_patronales_annuel: number}>} salaires
 * @returns {{totalBrut: number, totalCharges: number, coutTotal: number}}
 */
export function calculerMasseSalariale(salaires) {
  const totalBrut = salaires.reduce((sum, s) => sum + (s.salaire_brut_annuel || 0), 0);
  const totalCharges = salaires.reduce((sum, s) => sum + (s.charges_patronales_annuel || 0), 0);

  return {
    totalBrut,
    totalCharges,
    coutTotal: totalBrut + totalCharges
  };
}

/**
 * Calcule le coût d'une augmentation globale (en %)
 * @param {Array<{salaire_brut_annuel: number, charges_patronales_annuel: number}>} salaires
 * @param {number} pourcentage - Pourcentage d'augmentation
 * @returns {{coutActuel: number, nouveauCout: number, difference: number}}
 */
export function simulerAugmentationGlobale(salaires, pourcentage) {
  const masseSalarialeActuelle = calculerMasseSalariale(salaires);
  const facteur = 1 + pourcentage / 100;

  const nouveauCout = masseSalarialeActuelle.coutTotal * facteur;

  return {
    coutActuel: masseSalarialeActuelle.coutTotal,
    nouveauCout,
    difference: nouveauCout - masseSalarialeActuelle.coutTotal
  };
}

/**
 * Formate un montant en euros
 * @param {number} montant
 * @param {boolean} [showCents=true]
 * @returns {string}
 */
export function formatMontant(montant, showCents = true) {
  if (montant === null || montant === undefined || isNaN(montant)) {
    return '-';
  }

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0
  }).format(montant);
}

/**
 * Formate un taux horaire
 * @param {number} taux
 * @returns {string}
 */
export function formatTauxHoraire(taux) {
  if (taux === null || taux === undefined || isNaN(taux)) {
    return '-';
  }
  return `${taux.toFixed(2)} €/h`;
}

/**
 * Calcule l'évolution entre deux salaires
 * @param {number} ancien - Ancien salaire
 * @param {number} nouveau - Nouveau salaire
 * @returns {{montant: number, pourcentage: number}}
 */
export function calculerEvolution(ancien, nouveau) {
  const montant = nouveau - ancien;
  const pourcentage = ancien > 0 ? ((nouveau - ancien) / ancien) * 100 : 0;

  return { montant, pourcentage };
}
