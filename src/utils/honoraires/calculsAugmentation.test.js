import { describe, it, expect } from 'vitest';
import {
  calculerAugmentationLigne,
  calculerAugmentationGlobale,
  calculerTotauxResume,
  creerParametresDefaut,
  arrondirDemiDizaine,
  arrondirDemiCentime,
  getCoeffAnnualisation
} from './calculsAugmentation.js';

// ============================================================
// Helpers
// ============================================================

/**
 * Crée des paramètres avec tous les axes actifs et useGlobal=true (pour tests de calcul).
 * creerParametresDefaut() retourne tout inactif (pour l'UI), donc on active manuellement ici.
 */
const creerParametresActifs = (pct = 3) => {
  const params = creerParametresDefaut(pct);
  for (const key of Object.keys(params.axes)) {
    if (key === 'accessoires_social') continue; // suit le bulletin
    params.axes[key].actif = true;
    params.axes[key].useGlobal = true;
  }
  return params;
};

const makeLigne = (overrides = {}) => ({
  ligne_id: 1,
  abonnement_id: 100,
  pennylane_subscription_id: 200,
  client_id: 1,
  client_nom: 'Client Test',
  client_cabinet: 'Audit Up',
  label: 'Mission comptable',
  famille: 'comptabilite',
  axe: 'compta_mensuelle',
  quantite: 1,
  montant_ht: 500,
  montant_ttc: 600,
  frequence: 'monthly',
  intervalle: 1,
  status: 'in_progress',
  mode_facturation_social: 'forfait',
  ...overrides
});

// ============================================================
// Tests creerParametresDefaut
// ============================================================

describe('creerParametresDefaut', () => {
  it('crée des paramètres avec 0% par défaut (rien coché)', () => {
    const params = creerParametresDefaut();
    expect(params.pourcentageGlobal).toBe(0);
  });

  it('accepte un pourcentage global personnalisé', () => {
    const params = creerParametresDefaut(5);
    expect(params.pourcentageGlobal).toBe(5);
  });

  it('tous les axes sont inactifs par défaut', () => {
    const params = creerParametresDefaut();
    for (const key of Object.keys(params.axes)) {
      expect(params.axes[key].actif).toBe(false);
    }
  });

  it('les axes configurables ont useGlobal à false par défaut', () => {
    const params = creerParametresDefaut();
    for (const key of Object.keys(params.axes)) {
      if (key === 'accessoires_social') continue;
      expect(params.axes[key].useGlobal).toBe(false);
    }
  });

  it('social_bulletin a le mode pourcentage par défaut', () => {
    const params = creerParametresDefaut();
    expect(params.axes.social_bulletin.mode).toBe('pourcentage');
  });

  it('compta_mensuelle a le mode pourcentage par défaut', () => {
    const params = creerParametresDefaut();
    expect(params.axes.compta_mensuelle.mode).toBe('pourcentage');
  });
});

// ============================================================
// Tests arrondirDemiDizaine
// ============================================================

describe('arrondirDemiDizaine', () => {
  it('ne touche pas les prix finissant par 0', () => {
    expect(arrondirDemiDizaine(1210)).toBe(1210);
    expect(arrondirDemiDizaine(850)).toBe(850);
  });

  it('arrondit 1-2 à la dizaine inférieure (→ 0)', () => {
    expect(arrondirDemiDizaine(1211)).toBe(1210);
    expect(arrondirDemiDizaine(1212)).toBe(1210);
  });

  it('arrondit 3-7 à 5', () => {
    expect(arrondirDemiDizaine(1213)).toBe(1215);
    expect(arrondirDemiDizaine(1214)).toBe(1215);
    expect(arrondirDemiDizaine(1215)).toBe(1215);
    expect(arrondirDemiDizaine(1216)).toBe(1215);
    expect(arrondirDemiDizaine(1217)).toBe(1215);
  });

  it('arrondit 8-9 à la dizaine supérieure (→ 0)', () => {
    expect(arrondirDemiDizaine(1218)).toBe(1220);
    expect(arrondirDemiDizaine(1219)).toBe(1220);
  });

  it('cas réels : 1180 +3% = 1215.40 → 1215', () => {
    expect(arrondirDemiDizaine(1215.40)).toBe(1215);
  });

  it('cas réels : 830 +3% = 854.90 → 855', () => {
    // 854.90 → unités 4.90 → 3-7 → 855
    expect(arrondirDemiDizaine(854.90)).toBe(855);
  });
});

// ============================================================
// Tests arrondirDemiCentime
// ============================================================

describe('arrondirDemiCentime', () => {
  it('ne touche pas les centimes finissant par 0', () => {
    expect(arrondirDemiCentime(15.40)).toBe(15.40);
    expect(arrondirDemiCentime(15.80)).toBe(15.80);
  });

  it('arrondit centièmes 1-2 vers 0', () => {
    expect(arrondirDemiCentime(15.81)).toBe(15.80);
    expect(arrondirDemiCentime(15.82)).toBe(15.80);
  });

  it('arrondit centièmes 3-7 vers 5', () => {
    expect(arrondirDemiCentime(15.83)).toBe(15.85);
    expect(arrondirDemiCentime(15.84)).toBe(15.85);
    expect(arrondirDemiCentime(15.85)).toBe(15.85);
    expect(arrondirDemiCentime(15.86)).toBe(15.85);
    expect(arrondirDemiCentime(15.87)).toBe(15.85);
  });

  it('arrondit centièmes 8-9 vers dizaine de centimes supérieure', () => {
    expect(arrondirDemiCentime(15.88)).toBe(15.90);
    expect(arrondirDemiCentime(15.89)).toBe(15.90);
  });

  it('cas réel : 15.40 +3% = 15.862 → 15.85', () => {
    expect(arrondirDemiCentime(15.862)).toBe(15.85);
  });

  it('cas réel : 30.80 +3% = 31.724 → 31.70', () => {
    // centimes 72 → unité 2 → 0 → 31.70
    expect(arrondirDemiCentime(31.724)).toBe(31.70);
  });

  it('cas réel : 16.94 → 16.95', () => {
    // centimes 94 → unité 4 → 5 → 16.95
    expect(arrondirDemiCentime(16.94)).toBe(16.95);
  });
});

// ============================================================
// Tests getCoeffAnnualisation
// ============================================================

describe('getCoeffAnnualisation', () => {
  it('monthly intervalle 1 = ×12 (mensuel)', () => {
    expect(getCoeffAnnualisation('monthly', 1)).toBe(12);
  });

  it('monthly intervalle 3 = ×4 (trimestriel)', () => {
    expect(getCoeffAnnualisation('monthly', 3)).toBe(4);
  });

  it('monthly intervalle 6 = ×2 (semestriel)', () => {
    expect(getCoeffAnnualisation('monthly', 6)).toBe(2);
  });

  it('monthly intervalle 12 = ×1 (annuel par mois)', () => {
    expect(getCoeffAnnualisation('monthly', 12)).toBe(1);
  });

  it('yearly intervalle 1 = ×1 (annuel)', () => {
    expect(getCoeffAnnualisation('yearly', 1)).toBe(1);
  });

  it('yearly intervalle 2 = ×0.5 (bisannuel)', () => {
    expect(getCoeffAnnualisation('yearly', 2)).toBe(0.5);
  });

  it('null frequence = monthly par défaut (×12)', () => {
    expect(getCoeffAnnualisation(null, 1)).toBe(12);
  });

  it('null intervalle = 1 par défaut', () => {
    expect(getCoeffAnnualisation('monthly', null)).toBe(12);
  });
});

// ============================================================
// Tests calculerAugmentationLigne
// ============================================================

describe('calculerAugmentationLigne', () => {
  // Augmentation en pourcentage (via global)
  it('applique le % global quand useGlobal est true', () => {
    const ligne = makeLigne({ montant_ht: 1000, quantite: 1 });
    const params = creerParametresActifs(5); // 5%

    const res = calculerAugmentationLigne(ligne, params);

    expect(res.ancien_montant_ht).toBe(1000);
    expect(res.nouveau_montant_ht).toBe(1050);
    expect(res.delta_ht).toBe(50);
    expect(res.delta_pourcentage).toBe(5);
  });

  // Augmentation en pourcentage propre (pas global)
  it('applique le % propre quand useGlobal est false', () => {
    const ligne = makeLigne({ montant_ht: 1000, axe: 'bilan' });
    const params = creerParametresActifs(3);
    params.axes.bilan.useGlobal = false;
    params.axes.bilan.mode = 'pourcentage';
    params.axes.bilan.valeur = 10;

    const res = calculerAugmentationLigne(ligne, params);

    expect(res.nouveau_montant_ht).toBe(1100);
    expect(res.delta_ht).toBe(100);
    expect(res.delta_pourcentage).toBe(10);
  });

  // Augmentation en montant fixe (non bulletin)
  it('applique un montant fixe sur le total HT (non bulletin)', () => {
    const ligne = makeLigne({ montant_ht: 500, axe: 'compta_mensuelle' });
    const params = creerParametresActifs();
    params.axes.compta_mensuelle.useGlobal = false;
    params.axes.compta_mensuelle.mode = 'montant';
    params.axes.compta_mensuelle.valeur = 25;

    const res = calculerAugmentationLigne(ligne, params);

    expect(res.nouveau_montant_ht).toBe(525);
    expect(res.delta_ht).toBe(25);
  });

  // Augmentation en montant fixe sur social_bulletin (prix unitaire)
  it('augmente le prix unitaire pour social_bulletin en mode montant', () => {
    const ligne = makeLigne({
      axe: 'social_bulletin',
      montant_ht: 300,   // 10 bulletins × 30€
      quantite: 10
    });
    const params = creerParametresActifs();
    params.axes.social_bulletin.useGlobal = false;
    params.axes.social_bulletin.mode = 'montant';
    params.axes.social_bulletin.valeur = 2; // +2€ par bulletin

    const res = calculerAugmentationLigne(ligne, params);

    // Ancien prix unitaire = 30€, nouveau = 32€
    expect(res.ancien_prix_unitaire_ht).toBe(30);
    expect(res.nouveau_prix_unitaire_ht).toBe(32);
    // Nouveau montant = 32 × 10 = 320
    expect(res.nouveau_montant_ht).toBe(320);
    expect(res.delta_ht).toBe(20);
  });

  // Axe inactif
  it('ne modifie rien si l\'axe est inactif', () => {
    const ligne = makeLigne({ montant_ht: 1000 });
    const params = creerParametresActifs(5);
    params.axes.compta_mensuelle.actif = false;

    const res = calculerAugmentationLigne(ligne, params);

    expect(res.nouveau_montant_ht).toBe(1000);
    expect(res.delta_ht).toBe(0);
  });

  // Ligne sans axe
  it('ne modifie rien si la ligne n\'a pas d\'axe', () => {
    const ligne = makeLigne({ axe: null, montant_ht: 200 });
    const params = creerParametresActifs(5);

    const res = calculerAugmentationLigne(ligne, params);

    expect(res.nouveau_montant_ht).toBe(200);
    expect(res.delta_ht).toBe(0);
  });

  // Valeur zéro
  it('ne modifie rien si la valeur est 0', () => {
    const ligne = makeLigne({ montant_ht: 500 });
    const params = creerParametresDefaut(0);

    const res = calculerAugmentationLigne(ligne, params);

    expect(res.nouveau_montant_ht).toBe(500);
    expect(res.delta_ht).toBe(0);
  });

  // Arrondi correct (sur un axe sans arrondi demi-dizaine)
  it('arrondit correctement à 2 décimales', () => {
    const ligne = makeLigne({ montant_ht: 333.33, axe: 'social_forfait' });
    const params = creerParametresActifs(3); // 333.33 × 1.03 = 343.3299

    const res = calculerAugmentationLigne(ligne, params);

    expect(res.nouveau_montant_ht).toBe(343.33);
    expect(res.delta_ht).toBe(10);
  });

  // Arrondi demi-dizaine sur compta_mensuelle
  it('arrondit à la demi-dizaine pour compta_mensuelle (1180 +3% → 1215)', () => {
    const ligne = makeLigne({ montant_ht: 1180, axe: 'compta_mensuelle' });
    const params = creerParametresActifs(3); // 1180 × 1.03 = 1215.40

    const res = calculerAugmentationLigne(ligne, params);

    expect(res.nouveau_prix_unitaire_ht).toBe(1215);
    expect(res.nouveau_montant_ht).toBe(1215);
  });

  // Arrondi demi-dizaine sur bilan
  it('arrondit à la demi-dizaine pour bilan (830 +3% = 854.90 → 855)', () => {
    const ligne = makeLigne({ montant_ht: 830, axe: 'bilan' });
    const params = creerParametresActifs(3); // 830 × 1.03 = 854.90 → unités 4.90 → 3-7 → 855

    const res = calculerAugmentationLigne(ligne, params);

    expect(res.nouveau_prix_unitaire_ht).toBe(855);
    expect(res.nouveau_montant_ht).toBe(855);
  });

  // Accessoires social suivent le bulletin (×1)
  it('accessoire ×1 (modification) suit le delta du bulletin', () => {
    // Bulletin à 15.40€, augmentation +1€ → accessoire modification passe de 15.40 à 16.40
    const ligne = makeLigne({
      axe: 'accessoires_social',
      label: 'Modification de bulletin de salaires',
      montant_ht: 15.40,
      quantite: 1
    });
    const params = creerParametresActifs();
    params.axes.social_bulletin.useGlobal = false;
    params.axes.social_bulletin.mode = 'montant';
    params.axes.social_bulletin.valeur = 1; // +1€ par bulletin

    const res = calculerAugmentationLigne(ligne, params);

    expect(res.nouveau_prix_unitaire_ht).toBe(16.40);
    expect(res.nouveau_montant_ht).toBe(16.40);
    expect(res.delta_ht).toBe(1);
  });

  // Accessoires social suivent le bulletin (×2 pour sortie)
  it('accessoire ×2 (sortie) suit 2× le delta du bulletin', () => {
    // Sortie = 2× bulletin = 30.80€, bulletin +1€ → sortie +2€ → 32.80
    const ligne = makeLigne({
      axe: 'accessoires_social',
      label: 'Enregistrement de sortie de salariés',
      montant_ht: 30.80,
      quantite: 1
    });
    const params = creerParametresActifs();
    params.axes.social_bulletin.useGlobal = false;
    params.axes.social_bulletin.mode = 'montant';
    params.axes.social_bulletin.valeur = 1; // +1€ par bulletin

    const res = calculerAugmentationLigne(ligne, params);

    expect(res.nouveau_prix_unitaire_ht).toBe(32.80);
    expect(res.nouveau_montant_ht).toBe(32.80);
    expect(res.delta_ht).toBe(2);
  });

  // Accessoire entrée = ×1
  it('accessoire entrée suit ×1 le delta du bulletin', () => {
    const ligne = makeLigne({
      axe: 'accessoires_social',
      label: "Enregistrement d'entrée de salariés",
      montant_ht: 15.40,
      quantite: 1
    });
    const params = creerParametresActifs();
    params.axes.social_bulletin.useGlobal = false;
    params.axes.social_bulletin.mode = 'montant';
    params.axes.social_bulletin.valeur = 2; // +2€ par bulletin

    const res = calculerAugmentationLigne(ligne, params);

    expect(res.nouveau_prix_unitaire_ht).toBe(17.40);
    expect(res.delta_ht).toBe(2);
  });

  // Extra = ×1 (contient "entrée" et "sortie" mais aussi "extra")
  it('accessoire extra suit ×1 le delta du bulletin', () => {
    const ligne = makeLigne({
      axe: 'accessoires_social',
      label: "Enregistrement d'entrée / sortie d'un extra",
      montant_ht: 15.40,
      quantite: 1
    });
    const params = creerParametresActifs();
    params.axes.social_bulletin.useGlobal = false;
    params.axes.social_bulletin.mode = 'montant';
    params.axes.social_bulletin.valeur = 1;

    const res = calculerAugmentationLigne(ligne, params);

    expect(res.nouveau_prix_unitaire_ht).toBe(16.40);
    expect(res.delta_ht).toBe(1);
  });

  // Accessoire suit le bulletin en mode % global (cas réel)
  it('accessoire ×1 suit le bulletin en mode % global (15.40 +3% → 15.85)', () => {
    const ligne = makeLigne({
      axe: 'accessoires_social',
      label: 'Modification de bulletin de salaires',
      montant_ht: 15.40,
      quantite: 1
    });
    // social_bulletin useGlobal=true, global=3% → delta = 15.40 × 3% = 0.462
    const params = creerParametresActifs(3);

    const res = calculerAugmentationLigne(ligne, params);

    // 15.40 + 0.462 = 15.862 → demi-centime : centièmes 62 → unité 2 → 0 → 15.80 NON
    // Attends : 15.862 arrondi centimes : on regarde le chiffre des centièmes
    // 15.86(2) → centimes = 86, centième 6 → 3-7 → 5 → 15.85
    expect(res.nouveau_prix_unitaire_ht).toBe(15.85);
    expect(res.delta_ht).toBe(0.45);
  });

  it('accessoire ×2 (sortie) suit le bulletin en mode % global (30.80 +3% → 31.70)', () => {
    const ligne = makeLigne({
      axe: 'accessoires_social',
      label: 'Enregistrement de sortie de salariés',
      montant_ht: 30.80,
      quantite: 1
    });
    const params = creerParametresActifs(3);

    const res = calculerAugmentationLigne(ligne, params);

    // prixBulletinBase = 30.80 / 2 = 15.40, delta = 15.40 × 3% = 0.462
    // nouveau = 30.80 + 0.924 = 31.724 → demi-centime : centimes 72, unité 2 → 0 → 31.70
    expect(res.nouveau_prix_unitaire_ht).toBe(31.70);
    expect(res.delta_ht).toBe(0.90);
  });

  // Accessoire ne bouge pas si bulletin inactif
  it('accessoire ne bouge pas si social_bulletin est inactif', () => {
    const ligne = makeLigne({
      axe: 'accessoires_social',
      label: 'Modification de bulletin',
      montant_ht: 15.40,
      quantite: 1
    });
    const params = creerParametresDefaut();
    params.axes.social_bulletin.actif = false;

    const res = calculerAugmentationLigne(ligne, params);

    expect(res.nouveau_montant_ht).toBe(15.40);
    expect(res.delta_ht).toBe(0);
  });

  // Pas d'arrondi demi-dizaine sur social_forfait
  it('n\'arrondit PAS à la demi-dizaine pour social_forfait', () => {
    const ligne = makeLigne({ montant_ht: 450, axe: 'social_forfait' });
    const params = creerParametresActifs(3); // 450 × 1.03 = 463.50

    const res = calculerAugmentationLigne(ligne, params);

    expect(res.nouveau_montant_ht).toBe(463.5);
  });

  // Montant zéro
  it('gère un montant HT de 0', () => {
    const ligne = makeLigne({ montant_ht: 0 });
    const params = creerParametresActifs(5);

    const res = calculerAugmentationLigne(ligne, params);

    expect(res.nouveau_montant_ht).toBe(0);
    expect(res.delta_pourcentage).toBe(0);
  });

  // Retourne toutes les propriétés
  it('retourne toutes les propriétés de ResultatLigne', () => {
    const ligne = makeLigne();
    const params = creerParametresDefaut();

    const res = calculerAugmentationLigne(ligne, params);

    expect(res).toHaveProperty('ligne_id');
    expect(res).toHaveProperty('abonnement_id');
    expect(res).toHaveProperty('pennylane_subscription_id');
    expect(res).toHaveProperty('client_id');
    expect(res).toHaveProperty('label');
    expect(res).toHaveProperty('axe');
    expect(res).toHaveProperty('quantite');
    expect(res).toHaveProperty('ancien_prix_unitaire_ht');
    expect(res).toHaveProperty('nouveau_prix_unitaire_ht');
    expect(res).toHaveProperty('ancien_montant_ht');
    expect(res).toHaveProperty('nouveau_montant_ht');
    expect(res).toHaveProperty('delta_ht');
    expect(res).toHaveProperty('delta_pourcentage');
    expect(res).toHaveProperty('frequence');
    expect(res).toHaveProperty('intervalle');
    expect(res).toHaveProperty('status');
  });
});

// ============================================================
// Tests Silae — quantités réelles sur accessoires et bulletins
// ============================================================

describe('Silae quantités accessoires', () => {
  const silaeClient = {
    bulletins: 12,
    bulletins_total: 15,
    coffre_fort: 12,
    entrees: 3,
    sorties: 2,
    declarations: 10,
    attestations_pe: 1
  };

  const params = creerParametresActifs(0);
  // Activer le bulletin à 3%
  params.axes.social_bulletin = { actif: true, mode: 'pourcentage', valeur: 3, useGlobal: false };

  it('entrée de salariés utilise silaeClient.entrees', () => {
    const ligne = makeLigne({
      axe: 'accessoires_social',
      label: "Enregistrement d'entrée de salariés",
      montant_ht: 15.40,
      quantite: 1
    });
    const res = calculerAugmentationLigne(ligne, params, silaeClient);
    expect(res.quantite_silae).toBe(3);
  });

  it('sortie de salariés utilise silaeClient.sorties', () => {
    const ligne = makeLigne({
      axe: 'accessoires_social',
      label: 'Enregistrement de sortie de salariés',
      montant_ht: 30.80,
      quantite: 1
    });
    const res = calculerAugmentationLigne(ligne, params, silaeClient);
    expect(res.quantite_silae).toBe(2);
  });

  it('extra utilise silaeClient.entrees', () => {
    const ligne = makeLigne({
      axe: 'accessoires_social',
      label: "Enregistrement d'entrée / sortie d'un extra",
      montant_ht: 15.40,
      quantite: 1
    });
    const res = calculerAugmentationLigne(ligne, params, silaeClient);
    expect(res.quantite_silae).toBe(3);
  });

  it('modification de bulletin = forfait 1 par client', () => {
    const ligne = makeLigne({
      axe: 'accessoires_social',
      label: 'Modification de bulletin de salaires sur votre demande',
      montant_ht: 15.40,
      quantite: 1
    });
    const res = calculerAugmentationLigne(ligne, params, silaeClient);
    // Pas de donnée Silae pour les modifications → forfait 1 par client
    expect(res.quantite_silae).toBe(1);
  });

  it('coffre-fort utilise silaeClient.bulletins', () => {
    const ligne = makeLigne({
      axe: 'accessoires_social',
      label: 'Coffre-fort numérique',
      montant_ht: 15.40,
      quantite: 1
    });
    const res = calculerAugmentationLigne(ligne, params, silaeClient);
    expect(res.quantite_silae).toBe(12);
  });

  it('bulletin utilise silaeClient.bulletins', () => {
    const ligne = makeLigne({
      axe: 'social_bulletin',
      label: 'Bulletin de salaire',
      montant_ht: 154.00,
      quantite: 10
    });
    const res = calculerAugmentationLigne(ligne, params, silaeClient);
    expect(res.quantite_silae).toBe(12);
  });

  it('gère correctement silaeClient.entrees = 0 (ne retourne pas null)', () => {
    const silaeZero = { ...silaeClient, entrees: 0 };
    const ligne = makeLigne({
      axe: 'accessoires_social',
      label: "Enregistrement d'entrée de salariés",
      montant_ht: 15.40,
      quantite: 1
    });
    const res = calculerAugmentationLigne(ligne, params, silaeZero);
    expect(res.quantite_silae).toBe(0);
    expect(res.montant_silae).toBe(0);
    expect(res.delta_silae).toBe(0);
  });

  it('gère correctement silaeClient.sorties = 0 (ne retourne pas null)', () => {
    const silaeZero = { ...silaeClient, sorties: 0 };
    const ligne = makeLigne({
      axe: 'accessoires_social',
      label: 'Enregistrement de sortie de salariés',
      montant_ht: 30.80,
      quantite: 1
    });
    const res = calculerAugmentationLigne(ligne, params, silaeZero);
    expect(res.quantite_silae).toBe(0);
    expect(res.montant_silae).toBe(0);
  });

  it('calcule delta_silae pour entrée de salariés', () => {
    const ligne = makeLigne({
      axe: 'accessoires_social',
      label: "Enregistrement d'entrée de salariés",
      montant_ht: 15.40,
      quantite: 1
    });
    const res = calculerAugmentationLigne(ligne, params, silaeClient);
    // PU avant = 15.40, multiplicateur=1, bulletin +3% → delta = 15.40 × 3% = 0.462
    // nouveau PU = 15.40 + 0.462 = 15.862 → arrondi demi-centime → 15.85
    // quantite_silae = 3
    // montant_silae = 15.85 × 3 = 47.55
    // ancien montant silae = 15.40 × 3 = 46.20
    // delta_silae = 47.55 - 46.20 = 1.35
    expect(res.quantite_silae).toBe(3);
    expect(res.montant_silae).toBe(47.55);
    expect(res.delta_silae).toBe(1.35);
  });
});

// ============================================================
// Tests calculerAugmentationGlobale
// ============================================================

describe('calculerAugmentationGlobale', () => {
  const lignes2clients = [
    makeLigne({ client_id: 1, client_nom: 'Alpha', client_cabinet: 'Zerah', axe: 'compta_mensuelle', montant_ht: 500 }),
    makeLigne({ client_id: 1, client_nom: 'Alpha', client_cabinet: 'Zerah', axe: 'bilan', montant_ht: 1200, ligne_id: 2 }),
    makeLigne({ client_id: 2, client_nom: 'Beta', client_cabinet: 'Audit Up', axe: 'compta_mensuelle', montant_ht: 300, ligne_id: 3 })
  ];

  it('regroupe les résultats par client', () => {
    const params = creerParametresActifs(3);
    const resultats = calculerAugmentationGlobale(lignes2clients, params);

    expect(resultats).toHaveLength(2);
  });

  it('trie les résultats par nom client', () => {
    const params = creerParametresActifs(3);
    const resultats = calculerAugmentationGlobale(lignes2clients, params);

    expect(resultats[0].client_nom).toBe('Alpha');
    expect(resultats[1].client_nom).toBe('Beta');
  });

  it('calcule correctement les totaux par client (annualisés)', () => {
    const params = creerParametresActifs(5); // +5%
    const resultats = calculerAugmentationGlobale(lignes2clients, params);

    const alpha = resultats.find(r => r.client_nom === 'Alpha');
    // Alpha : compta 500/mois + bilan 1200/mois = 1700/mois
    // Annualisé : (500 + 1200) × 12 = 20400 → +5% = 21420
    expect(alpha.ancien_total_ht).toBe(20400);
    expect(alpha.nouveau_total_ht).toBe(21420);
    expect(alpha.delta_total_ht).toBe(1020);
    expect(alpha.delta_total_pourcentage).toBe(5);
  });

  it('calcule les totaux par axe pour chaque client (annualisés)', () => {
    const params = creerParametresActifs(10);
    const resultats = calculerAugmentationGlobale(lignes2clients, params);

    const alpha = resultats.find(r => r.client_nom === 'Alpha');
    // compta 500/mois × 12 = 6000/an, +10% = 6600, delta = 600
    expect(alpha.totaux_par_axe.compta_mensuelle.ancien).toBe(6000);
    expect(alpha.totaux_par_axe.compta_mensuelle.nouveau).toBe(6600);
    expect(alpha.totaux_par_axe.compta_mensuelle.delta).toBe(600);
    // bilan 1200/mois × 12 = 14400/an, +10% = 15840, delta = 1440
    expect(alpha.totaux_par_axe.bilan.ancien).toBe(14400);
    expect(alpha.totaux_par_axe.bilan.delta).toBe(1440);
  });

  it('exclut un client de l\'augmentation', () => {
    const params = creerParametresActifs(5);
    const exclus = new Set([1]); // Exclure Alpha
    const resultats = calculerAugmentationGlobale(lignes2clients, params, exclus);

    const alpha = resultats.find(r => r.client_nom === 'Alpha');
    expect(alpha.exclu).toBe(true);
    expect(alpha.delta_total_ht).toBe(0);
    expect(alpha.nouveau_total_ht).toBe(alpha.ancien_total_ht);

    const beta = resultats.find(r => r.client_nom === 'Beta');
    expect(beta.exclu).toBe(false);
    // 300/mois × 5% = 15/mois × 12 = 180/an
    expect(beta.delta_total_ht).toBe(180);
  });

  it('annualise correctement un mix mensuel + annuel', () => {
    const lignesMix = [
      makeLigne({ client_id: 1, client_nom: 'Mix', axe: 'compta_mensuelle', montant_ht: 100, frequence: 'monthly', intervalle: 1 }),
      makeLigne({ client_id: 1, client_nom: 'Mix', axe: 'bilan', montant_ht: 600, frequence: 'yearly', intervalle: 1, ligne_id: 2 }),
    ];
    const params = creerParametresActifs(10); // +10%
    const resultats = calculerAugmentationGlobale(lignesMix, params);

    const mix = resultats[0];
    // compta 100/mois × 12 = 1200/an → +10% → 1320, delta 120
    // bilan 600/an × 1 = 600/an → +10% → 660, delta 60
    // Total annuel : 1800 → 1980, delta 180
    expect(mix.ancien_total_ht).toBe(1800);
    expect(mix.nouveau_total_ht).toBe(1980);
    expect(mix.delta_total_ht).toBe(180);
    expect(mix.delta_total_pourcentage).toBe(10);
  });

  it('annualise correctement le trimestriel (×4)', () => {
    const lignesTrim = [
      makeLigne({ client_id: 1, client_nom: 'Trim', axe: 'compta_mensuelle', montant_ht: 300, frequence: 'monthly', intervalle: 3 }),
    ];
    const params = creerParametresActifs(10); // +10%
    const resultats = calculerAugmentationGlobale(lignesTrim, params);

    const trim = resultats[0];
    // 300/trimestre × 4 = 1200/an → +10% → 1320, delta 120
    expect(trim.ancien_total_ht).toBe(1200);
    expect(trim.nouveau_total_ht).toBe(1320);
    expect(trim.delta_total_ht).toBe(120);
  });

  it('compte correctement les lignes modifiées', () => {
    const params = creerParametresActifs(3);
    const resultats = calculerAugmentationGlobale(lignes2clients, params);

    const alpha = resultats.find(r => r.client_nom === 'Alpha');
    expect(alpha.nb_lignes_modifiees).toBe(2);
  });

  it('retourne 0 lignes modifiées si aucune augmentation', () => {
    const params = creerParametresDefaut(0);
    const resultats = calculerAugmentationGlobale(lignes2clients, params);

    const alpha = resultats.find(r => r.client_nom === 'Alpha');
    expect(alpha.nb_lignes_modifiees).toBe(0);
  });
});

// ============================================================
// Tests calculerTotauxResume
// ============================================================

describe('calculerTotauxResume', () => {
  const makeResultatClient = (overrides = {}) => ({
    client_id: 1,
    client_nom: 'Client',
    client_cabinet: 'Zerah',
    exclu: false,
    mode_facturation_social: 'forfait',
    totaux_par_axe: {
      compta_mensuelle: { ancien: 500, nouveau: 515, delta: 15 },
      bilan: { ancien: 0, nouveau: 0, delta: 0 },
      pl: { ancien: 0, nouveau: 0, delta: 0 },
      social_forfait: { ancien: 0, nouveau: 0, delta: 0 },
      social_bulletin: { ancien: 0, nouveau: 0, delta: 0 },
      accessoires_social: { ancien: 0, nouveau: 0, delta: 0 },
      juridique: { ancien: 0, nouveau: 0, delta: 0 },
      support: { ancien: 0, nouveau: 0, delta: 0 }
    },
    ancien_total_ht: 500,
    nouveau_total_ht: 515,
    delta_total_ht: 15,
    delta_total_pourcentage: 3,
    nb_lignes_modifiees: 1,
    lignes: [],
    ...overrides
  });

  it('calcule les totaux globaux', () => {
    const resultats = [
      makeResultatClient({ ancien_total_ht: 1000, nouveau_total_ht: 1050, delta_total_ht: 50, nb_lignes_modifiees: 2 }),
      makeResultatClient({ client_id: 2, client_nom: 'Client 2', ancien_total_ht: 500, nouveau_total_ht: 525, delta_total_ht: 25, nb_lignes_modifiees: 1 })
    ];

    const resume = calculerTotauxResume(resultats);

    expect(resume.global.ancien).toBe(1500);
    expect(resume.global.nouveau).toBe(1575);
    expect(resume.global.delta).toBe(75);
    expect(resume.global.nbClients).toBe(2);
    expect(resume.global.nbLignes).toBe(3);
  });

  it('exclut les clients exclus des totaux', () => {
    const resultats = [
      makeResultatClient({ ancien_total_ht: 1000, nouveau_total_ht: 1050, delta_total_ht: 50, nb_lignes_modifiees: 2 }),
      makeResultatClient({ client_id: 2, exclu: true, ancien_total_ht: 500, nouveau_total_ht: 500, delta_total_ht: 0, nb_lignes_modifiees: 0 })
    ];

    const resume = calculerTotauxResume(resultats);

    expect(resume.global.ancien).toBe(1000);
    expect(resume.global.nouveau).toBe(1050);
    expect(resume.global.nbClients).toBe(1);
  });

  it('calcule les totaux par axe', () => {
    const resultats = [
      makeResultatClient({
        totaux_par_axe: {
          compta_mensuelle: { ancien: 500, nouveau: 515, delta: 15 },
          bilan: { ancien: 1200, nouveau: 1236, delta: 36 },
          pl: { ancien: 0, nouveau: 0, delta: 0 },
          social_forfait: { ancien: 0, nouveau: 0, delta: 0 },
          social_bulletin: { ancien: 0, nouveau: 0, delta: 0 },
          accessoires_social: { ancien: 0, nouveau: 0, delta: 0 },
          juridique: { ancien: 0, nouveau: 0, delta: 0 },
      support: { ancien: 0, nouveau: 0, delta: 0 }
        }
      })
    ];

    const resume = calculerTotauxResume(resultats);

    expect(resume.parAxe.compta_mensuelle.ancien).toBe(500);
    expect(resume.parAxe.compta_mensuelle.delta).toBe(15);
    expect(resume.parAxe.compta_mensuelle.deltaPct).toBe(3);
    expect(resume.parAxe.bilan.ancien).toBe(1200);
    expect(resume.parAxe.bilan.delta).toBe(36);
  });

  it('calcule les totaux par cabinet', () => {
    const resultats = [
      makeResultatClient({ client_cabinet: 'Zerah', ancien_total_ht: 1000, nouveau_total_ht: 1030, delta_total_ht: 30 }),
      makeResultatClient({ client_id: 2, client_cabinet: 'Zerah', ancien_total_ht: 500, nouveau_total_ht: 515, delta_total_ht: 15 }),
      makeResultatClient({ client_id: 3, client_cabinet: 'Audit Up', ancien_total_ht: 800, nouveau_total_ht: 824, delta_total_ht: 24, nb_lignes_modifiees: 1 })
    ];

    const resume = calculerTotauxResume(resultats);

    expect(resume.parCabinet['Zerah'].ancien).toBe(1500);
    expect(resume.parCabinet['Zerah'].delta).toBe(45);
    expect(resume.parCabinet['Zerah'].nbClients).toBe(2);
    expect(resume.parCabinet['Audit Up'].ancien).toBe(800);
    expect(resume.parCabinet['Audit Up'].nbClients).toBe(1);
  });

  it('gère un résultat vide', () => {
    const resume = calculerTotauxResume([]);

    expect(resume.global.ancien).toBe(0);
    expect(resume.global.nouveau).toBe(0);
    expect(resume.global.delta).toBe(0);
    expect(resume.global.nbClients).toBe(0);
    expect(resume.global.nbLignes).toBe(0);
  });

  it('ne compte pas un client sans delta dans nbClients', () => {
    const resultats = [
      makeResultatClient({ ancien_total_ht: 1000, nouveau_total_ht: 1000, delta_total_ht: 0, nb_lignes_modifiees: 0 })
    ];

    const resume = calculerTotauxResume(resultats);

    expect(resume.global.nbClients).toBe(0);
  });
});
