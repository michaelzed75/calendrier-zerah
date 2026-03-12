// @ts-check
import { describe, it, expect } from 'vitest';
import { etatDettes } from './etatDettes.js';

/** Helper pour créer une écriture FEC */
function fec(compteNum, compteLib, debit, credit) {
  return { CompteNum: compteNum, CompteLib: compteLib, Debit: debit, Credit: credit };
}

describe('etatDettes - État des dettes', () => {
  describe('Métadonnées', () => {
    it('a le bon code et requiert fecDettes', () => {
      expect(etatDettes.code).toBe('etat_dettes');
      expect(etatDettes.requiredData).toContain('fecDettes');
    });
  });

  describe('Comptes 164 (emprunts)', () => {
    it('inclut les comptes 164 avec solde créditeur comme dettes', async () => {
      const ecritures = [
        // À-nouveau : solde créditeur = dette de 50000
        fec('164110000', 'EMPRUNT RICHARD 75KE', 0, 50000),
        // Remboursement mensuel
        fec('164110000', 'EMPRUNT RICHARD 75KE', 5000, 0),
      ];

      const { donneesAnalysees } = await etatDettes.execute({ fec: ecritures, options: {} });

      const catEmprunts = donneesAnalysees.categories.find(c => c.categorie === 'Emprunts');
      expect(catEmprunts).toBeDefined();
      expect(catEmprunts.sousTotal).toBe(45000); // 50000 - 5000
      expect(catEmprunts.comptes[0].compteNum).toBe('164110000');
    });

    it('inclut plusieurs sous-comptes 164 séparément', async () => {
      const ecritures = [
        fec('164110000', 'EMPRUNT RICHARD', 10000, 20000),  // dette 10000
        fec('164120000', 'EMPRUNT TAFANEL', 5000, 12000),   // dette 7000
      ];

      const { donneesAnalysees } = await etatDettes.execute({ fec: ecritures, options: {} });

      const catEmprunts = donneesAnalysees.categories.find(c => c.categorie === 'Emprunts');
      expect(catEmprunts).toBeDefined();
      expect(catEmprunts.comptes).toHaveLength(2);
      expect(catEmprunts.sousTotal).toBe(17000);
    });

    it('exclut les comptes 164 avec solde débiteur (pas une dette)', async () => {
      const ecritures = [
        // Solde débiteur : remboursé plus que dû (pas réaliste mais test la logique)
        fec('164110000', 'EMPRUNT RICHARD', 30000, 20000), // solde +10000 = pas une dette
      ];

      const { donneesAnalysees } = await etatDettes.execute({ fec: ecritures, options: {} });

      const catEmprunts = donneesAnalysees.categories.find(c => c.categorie === 'Emprunts');
      // La catégorie apparaît mais le montant dette est 0
      expect(catEmprunts.sousTotal).toBe(0);
    });
  });

  describe('Catégories avec règles spéciales', () => {
    it('globalOnly: agrège les fournisseurs 401 en une seule ligne', async () => {
      const ecritures = [
        fec('401001', 'FOURNISSEUR A', 100, 500),
        fec('401002', 'FOURNISSEUR B', 200, 800),
        fec('401003', 'FOURNISSEUR C', 50, 300),
      ];

      const { donneesAnalysees } = await etatDettes.execute({ fec: ecritures, options: {} });

      const catFourn = donneesAnalysees.categories.find(c => c.categorie === 'Fournisseurs');
      expect(catFourn).toBeDefined();
      // Une seule ligne agrégée
      expect(catFourn.comptes).toHaveLength(1);
      expect(catFourn.comptes[0].compteNum).toBe('401xxx');
      // Total : (100+200+50) - (500+800+300) = 350 - 1600 = -1250 → dette 1250
      expect(catFourn.sousTotal).toBe(1250);
    });

    it('onlyIfNegative: banque 512 exclue si solde positif', async () => {
      const ecritures = [
        fec('5121002', 'BANQUE CE', 50000, 10000), // solde +40000 = pas une dette
      ];

      const { donneesAnalysees } = await etatDettes.execute({ fec: ecritures, options: {} });

      const catBanque = donneesAnalysees.categories.find(c => c.categorie === 'Banque');
      expect(catBanque).toBeUndefined(); // catégorie absente car filtré par onlyIfNegative
    });

    it('onlyIfNegative: banque 512 incluse si solde négatif', async () => {
      const ecritures = [
        fec('5121002', 'BANQUE CE', 10000, 50000), // solde -40000 = dette
      ];

      const { donneesAnalysees } = await etatDettes.execute({ fec: ecritures, options: {} });

      const catBanque = donneesAnalysees.categories.find(c => c.categorie === 'Banque');
      expect(catBanque).toBeDefined();
      expect(catBanque.sousTotal).toBe(40000);
    });
  });

  describe('Total général', () => {
    it('somme correctement toutes les catégories', async () => {
      const ecritures = [
        fec('164110000', 'EMPRUNT', 0, 10000),       // dette 10000
        fec('421000', 'PERSONNEL', 1000, 5000),       // dette 4000
        fec('4282000', 'CONGES PAYES', 500, 3500),    // dette 3000
        fec('401001', 'FOURNISSEUR', 200, 1200),      // dette 1000
      ];

      const { donneesAnalysees } = await etatDettes.execute({ fec: ecritures, options: {} });

      expect(donneesAnalysees.totalDettes).toBe(18000);
      expect(donneesAnalysees.nbComptesRetenus).toBe(4);
    });
  });

  describe('Seuil de signification', () => {
    it('exclut les comptes sous le seuil', async () => {
      const ecritures = [
        fec('164110000', 'EMPRUNT', 0, 50000),    // dette 50000 — au-dessus
        fec('421000', 'PERSONNEL', 0, 100),        // dette 100 — en-dessous
      ];

      const { donneesAnalysees } = await etatDettes.execute({
        fec: ecritures,
        options: { seuilSignification: 500 }
      });

      expect(donneesAnalysees.totalDettes).toBe(50000);
      expect(donneesAnalysees.nbComptesRetenus).toBe(1);
    });
  });
});
