// @ts-check
import { describe, it, expect } from 'vitest';
import {
  calculerCoutTotal,
  calculerTauxHoraireBrut,
  calculerTauxHoraireCharge,
  calculerAugmentation,
  calculerMasseSalariale,
  estimerChargesPatronales,
  formatMontant,
  formatTauxHoraire,
  calculerEvolution,
  simulerAugmentationGlobale,
  HEURES_ANNUELLES_LEGALES,
  TAUX_CHARGES_PATRONALES_DEFAUT
} from './calculsSalaires';

// ============================================
// DONNÉES DE TEST
// ============================================

/** @type {Array<{salaire_brut_annuel: number, charges_patronales_annuel: number}>} */
const mockSalaires = [
  { salaire_brut_annuel: 35000, charges_patronales_annuel: 15750 }, // 45% charges
  { salaire_brut_annuel: 42000, charges_patronales_annuel: 18900 },
  { salaire_brut_annuel: 28000, charges_patronales_annuel: 12600 },
];

// ============================================
// TESTS CONSTANTES
// ============================================

describe('Constantes', () => {
  it('HEURES_ANNUELLES_LEGALES vaut 1607', () => {
    expect(HEURES_ANNUELLES_LEGALES).toBe(1607);
  });

  it('TAUX_CHARGES_PATRONALES_DEFAUT vaut 0.45 (45%)', () => {
    expect(TAUX_CHARGES_PATRONALES_DEFAUT).toBe(0.45);
  });
});

// ============================================
// TESTS calculerCoutTotal
// ============================================

describe('calculerCoutTotal', () => {
  it('additionne le brut et les charges', () => {
    const cout = calculerCoutTotal(35000, 15750);
    expect(cout).toBe(50750);
  });

  it('gère les charges à zéro', () => {
    const cout = calculerCoutTotal(35000, 0);
    expect(cout).toBe(35000);
  });

  it('gère les valeurs null/undefined', () => {
    expect(calculerCoutTotal(null, 15000)).toBe(15000);
    expect(calculerCoutTotal(35000, null)).toBe(35000);
    expect(calculerCoutTotal(null, null)).toBe(0);
    expect(calculerCoutTotal(undefined, undefined)).toBe(0);
  });

  it('gère les décimales correctement', () => {
    const cout = calculerCoutTotal(35000.50, 15750.25);
    expect(cout).toBe(50750.75);
  });
});

// ============================================
// TESTS calculerTauxHoraireBrut
// ============================================

describe('calculerTauxHoraireBrut', () => {
  it('calcule le taux horaire avec les heures légales par défaut', () => {
    const taux = calculerTauxHoraireBrut(35000);
    // 35000 / 1607 = 21.78
    expect(taux).toBeCloseTo(21.78, 2);
  });

  it('calcule le taux horaire avec heures personnalisées', () => {
    const taux = calculerTauxHoraireBrut(35000, 1750);
    // 35000 / 1750 = 20
    expect(taux).toBe(20);
  });

  it('retourne 0 si heures à zéro', () => {
    const taux = calculerTauxHoraireBrut(35000, 0);
    expect(taux).toBe(0);
  });

  it('retourne 0 si heures négatives', () => {
    const taux = calculerTauxHoraireBrut(35000, -100);
    expect(taux).toBe(0);
  });

  it('gère un salaire élevé (cadre supérieur)', () => {
    const taux = calculerTauxHoraireBrut(80000);
    // 80000 / 1607 = 49.78
    expect(taux).toBeCloseTo(49.78, 2);
  });
});

// ============================================
// TESTS calculerTauxHoraireCharge
// ============================================

describe('calculerTauxHoraireCharge', () => {
  it('calcule le taux horaire chargé (coût total / heures)', () => {
    const taux = calculerTauxHoraireCharge(35000, 15750);
    // (35000 + 15750) / 1607 = 31.58
    expect(taux).toBeCloseTo(31.58, 2);
  });

  it('utilise les heures légales par défaut', () => {
    const taux = calculerTauxHoraireCharge(35000, 15750);
    const tauxManuel = (35000 + 15750) / HEURES_ANNUELLES_LEGALES;
    expect(taux).toBeCloseTo(tauxManuel, 2);
  });

  it('accepte des heures personnalisées', () => {
    const taux = calculerTauxHoraireCharge(35000, 15750, 1750);
    // (35000 + 15750) / 1750 = 29
    expect(taux).toBe(29);
  });

  it('retourne 0 si heures à zéro', () => {
    const taux = calculerTauxHoraireCharge(35000, 15750, 0);
    expect(taux).toBe(0);
  });

  it('gère les charges à zéro (taux = taux brut)', () => {
    const tauxCharge = calculerTauxHoraireCharge(35000, 0);
    const tauxBrut = calculerTauxHoraireBrut(35000);
    expect(tauxCharge).toBeCloseTo(tauxBrut, 2);
  });
});

// ============================================
// TESTS calculerAugmentation
// ============================================

describe('calculerAugmentation', () => {
  describe('type pourcentage', () => {
    it('calcule une augmentation de 3%', () => {
      const nouveau = calculerAugmentation(35000, 3, 'pourcentage');
      expect(nouveau).toBe(36050); // 35000 * 1.03
    });

    it('calcule une augmentation de 10%', () => {
      const nouveau = calculerAugmentation(35000, 10, 'pourcentage');
      expect(nouveau).toBe(38500); // 35000 * 1.10
    });

    it('gère une augmentation de 0%', () => {
      const nouveau = calculerAugmentation(35000, 0, 'pourcentage');
      expect(nouveau).toBe(35000);
    });

    it('gère une diminution (pourcentage négatif)', () => {
      const nouveau = calculerAugmentation(35000, -5, 'pourcentage');
      expect(nouveau).toBe(33250); // 35000 * 0.95
    });
  });

  describe('type montant', () => {
    it('ajoute un montant fixe', () => {
      const nouveau = calculerAugmentation(35000, 1500, 'montant');
      expect(nouveau).toBe(36500);
    });

    it('gère un montant négatif (diminution)', () => {
      const nouveau = calculerAugmentation(35000, -2000, 'montant');
      expect(nouveau).toBe(33000);
    });

    it('gère un montant à zéro', () => {
      const nouveau = calculerAugmentation(35000, 0, 'montant');
      expect(nouveau).toBe(35000);
    });
  });
});

// ============================================
// TESTS estimerChargesPatronales
// ============================================

describe('estimerChargesPatronales', () => {
  it('utilise le taux par défaut de 45%', () => {
    const charges = estimerChargesPatronales(35000);
    expect(charges).toBe(15750); // 35000 * 0.45
  });

  it('accepte un taux personnalisé', () => {
    const charges = estimerChargesPatronales(35000, 0.50);
    expect(charges).toBe(17500); // 35000 * 0.50
  });

  it('gère un salaire à zéro', () => {
    const charges = estimerChargesPatronales(0);
    expect(charges).toBe(0);
  });

  it('calcule correctement pour un salaire élevé', () => {
    const charges = estimerChargesPatronales(80000, 0.42);
    expect(charges).toBe(33600); // 80000 * 0.42
  });
});

// ============================================
// TESTS calculerMasseSalariale
// ============================================

describe('calculerMasseSalariale', () => {
  it('calcule les totaux de la masse salariale', () => {
    const masse = calculerMasseSalariale(mockSalaires);

    // Total brut: 35000 + 42000 + 28000 = 105000
    expect(masse.totalBrut).toBe(105000);

    // Total charges: 15750 + 18900 + 12600 = 47250
    expect(masse.totalCharges).toBe(47250);

    // Coût total: 105000 + 47250 = 152250
    expect(masse.coutTotal).toBe(152250);
  });

  it('gère une liste vide', () => {
    const masse = calculerMasseSalariale([]);
    expect(masse.totalBrut).toBe(0);
    expect(masse.totalCharges).toBe(0);
    expect(masse.coutTotal).toBe(0);
  });

  it('gère un seul salaire', () => {
    const masse = calculerMasseSalariale([mockSalaires[0]]);
    expect(masse.totalBrut).toBe(35000);
    expect(masse.totalCharges).toBe(15750);
    expect(masse.coutTotal).toBe(50750);
  });

  it('gère les valeurs null/undefined dans les salaires', () => {
    const salairesAvecNull = [
      { salaire_brut_annuel: 35000, charges_patronales_annuel: null },
      { salaire_brut_annuel: null, charges_patronales_annuel: 15000 },
    ];
    const masse = calculerMasseSalariale(salairesAvecNull);
    expect(masse.totalBrut).toBe(35000);
    expect(masse.totalCharges).toBe(15000);
    expect(masse.coutTotal).toBe(50000);
  });
});

// ============================================
// TESTS simulerAugmentationGlobale
// ============================================

describe('simulerAugmentationGlobale', () => {
  it('simule une augmentation globale de 3%', () => {
    const simulation = simulerAugmentationGlobale(mockSalaires, 3);

    // Coût actuel: 152250
    expect(simulation.coutActuel).toBe(152250);

    // Nouveau coût: 152250 * 1.03 = 156817.5
    expect(simulation.nouveauCout).toBeCloseTo(156817.5, 2);

    // Différence: 4567.5
    expect(simulation.difference).toBeCloseTo(4567.5, 2);
  });

  it('simule une augmentation de 0% (pas de changement)', () => {
    const simulation = simulerAugmentationGlobale(mockSalaires, 0);
    expect(simulation.difference).toBe(0);
    expect(simulation.nouveauCout).toBe(simulation.coutActuel);
  });

  it('simule une diminution de 5%', () => {
    const simulation = simulerAugmentationGlobale(mockSalaires, -5);
    expect(simulation.nouveauCout).toBeLessThan(simulation.coutActuel);
    expect(simulation.difference).toBeLessThan(0);
  });
});

// ============================================
// TESTS formatMontant
// ============================================

describe('formatMontant', () => {
  it('formate un montant en euros avec centimes', () => {
    const formatted = formatMontant(35000);
    expect(formatted).toContain('35');
    expect(formatted).toContain('000');
    expect(formatted).toContain('€');
  });

  it('formate sans centimes si demandé', () => {
    const formatted = formatMontant(35000.50, false);
    expect(formatted).toContain('35');
    expect(formatted).not.toContain(',50');
  });

  it('retourne "-" pour null', () => {
    expect(formatMontant(null)).toBe('-');
  });

  it('retourne "-" pour undefined', () => {
    expect(formatMontant(undefined)).toBe('-');
  });

  it('retourne "-" pour NaN', () => {
    expect(formatMontant(NaN)).toBe('-');
  });

  it('formate les grands nombres avec séparateurs', () => {
    const formatted = formatMontant(1500000);
    // Doit contenir le séparateur de milliers (espace en français)
    expect(formatted).toMatch(/1\s*500\s*000/);
  });
});

// ============================================
// TESTS formatTauxHoraire
// ============================================

describe('formatTauxHoraire', () => {
  it('formate un taux horaire avec 2 décimales', () => {
    const formatted = formatTauxHoraire(21.78);
    expect(formatted).toBe('21.78 €/h');
  });

  it('ajoute les décimales manquantes', () => {
    const formatted = formatTauxHoraire(20);
    expect(formatted).toBe('20.00 €/h');
  });

  it('retourne "-" pour null', () => {
    expect(formatTauxHoraire(null)).toBe('-');
  });

  it('retourne "-" pour undefined', () => {
    expect(formatTauxHoraire(undefined)).toBe('-');
  });

  it('retourne "-" pour NaN', () => {
    expect(formatTauxHoraire(NaN)).toBe('-');
  });
});

// ============================================
// TESTS calculerEvolution
// ============================================

describe('calculerEvolution', () => {
  it('calcule l\'évolution positive', () => {
    const evolution = calculerEvolution(35000, 36050);
    expect(evolution.montant).toBe(1050);
    expect(evolution.pourcentage).toBeCloseTo(3, 2); // 3%
  });

  it('calcule l\'évolution négative', () => {
    const evolution = calculerEvolution(35000, 33250);
    expect(evolution.montant).toBe(-1750);
    expect(evolution.pourcentage).toBeCloseTo(-5, 2); // -5%
  });

  it('calcule une évolution nulle', () => {
    const evolution = calculerEvolution(35000, 35000);
    expect(evolution.montant).toBe(0);
    expect(evolution.pourcentage).toBe(0);
  });

  it('gère l\'ancien salaire à zéro (évite division par zéro)', () => {
    const evolution = calculerEvolution(0, 35000);
    expect(evolution.montant).toBe(35000);
    expect(evolution.pourcentage).toBe(0); // Pas de % calculable
  });

  it('calcule une forte augmentation (promotion)', () => {
    const evolution = calculerEvolution(35000, 45000);
    expect(evolution.montant).toBe(10000);
    expect(evolution.pourcentage).toBeCloseTo(28.57, 2); // ~28.57%
  });
});

// ============================================
// TESTS SCÉNARIOS MÉTIER RÉALISTES
// ============================================

describe('Scénarios métier cabinet comptable', () => {
  describe('Calcul rentabilité collaborateur', () => {
    it('calcule le coût horaire d\'un collaborateur junior', () => {
      const salaireBrut = 28000;
      const charges = estimerChargesPatronales(salaireBrut);
      const tauxCharge = calculerTauxHoraireCharge(salaireBrut, charges);

      // Un junior à 28k€ brut devrait avoir un taux ~27€/h chargé
      expect(tauxCharge).toBeGreaterThan(25);
      expect(tauxCharge).toBeLessThan(30);
    });

    it('calcule le coût horaire d\'un collaborateur senior', () => {
      const salaireBrut = 55000;
      const charges = estimerChargesPatronales(salaireBrut);
      const tauxCharge = calculerTauxHoraireCharge(salaireBrut, charges);

      // Un senior à 55k€ brut devrait avoir un taux ~50€/h chargé
      expect(tauxCharge).toBeGreaterThan(45);
      expect(tauxCharge).toBeLessThan(55);
    });
  });

  describe('Simulation budget annuel', () => {
    it('simule l\'impact d\'une augmentation collective de 2.5%', () => {
      // Équipe de 5 personnes
      const equipe = [
        { salaire_brut_annuel: 28000, charges_patronales_annuel: 12600 },
        { salaire_brut_annuel: 32000, charges_patronales_annuel: 14400 },
        { salaire_brut_annuel: 38000, charges_patronales_annuel: 17100 },
        { salaire_brut_annuel: 45000, charges_patronales_annuel: 20250 },
        { salaire_brut_annuel: 55000, charges_patronales_annuel: 24750 },
      ];

      const avant = calculerMasseSalariale(equipe);
      const simulation = simulerAugmentationGlobale(equipe, 2.5);

      // Masse salariale initiale: 287100€
      expect(avant.coutTotal).toBe(287100);

      // Impact 2.5%: ~7177€ de plus
      expect(simulation.difference).toBeCloseTo(7177.5, 0);
    });
  });

  describe('Comparaison temps facturé vs coût', () => {
    it('vérifie qu\'un collaborateur est rentable', () => {
      const salaireBrut = 35000;
      const charges = estimerChargesPatronales(salaireBrut);
      const coutAnnuel = calculerCoutTotal(salaireBrut, charges);
      const tauxHoraireCharge = calculerTauxHoraireCharge(salaireBrut, charges);

      // Si on facture à 75€/h et 1400h facturées/an
      const tauxFacture = 75;
      const heuresFacturees = 1400;
      const caGenere = tauxFacture * heuresFacturees;

      // CA généré: 105000€
      expect(caGenere).toBe(105000);

      // Marge: CA - Coût
      const marge = caGenere - coutAnnuel;
      expect(marge).toBeGreaterThan(50000); // Doit être rentable

      // Ratio de rentabilité
      const ratio = caGenere / coutAnnuel;
      expect(ratio).toBeGreaterThan(2); // Doit générer 2x son coût minimum
    });
  });
});
