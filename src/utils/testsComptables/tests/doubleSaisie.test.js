// @ts-check
import { describe, it, expect } from 'vitest';
import { doubleSaisie } from './doubleSaisie.js';

describe('doubleSaisie - Relevé fournisseurs', () => {
  describe('Métadonnées du test', () => {
    it('a le bon code', () => {
      expect(doubleSaisie.code).toBe('double_saisie');
    });

    it('a le bon nom', () => {
      expect(doubleSaisie.nom).toBe('Relevé fournisseurs');
    });

    it('requiert supplierInvoices', () => {
      expect(doubleSaisie.requiredData).toContain('supplierInvoices');
    });
  });

  describe('Fournisseurs NON marqués au relevé (détection doublons classiques)', () => {
    it('détecte un doublon classique quand montant récent > montant ancien', async () => {
      const factures = [
        {
          id: 1,
          invoice_number: 'F001',
          date: '2026-01-10',
          amount: 100,
          label: 'Facture FOURNISSEUR A - F001',
          supplier: { id: 'S1' }
        },
        {
          id: 2,
          invoice_number: 'F002',
          date: '2026-01-20',
          amount: 150, // Plus grand que 100
          label: 'Facture FOURNISSEUR A - F002',
          supplier: { id: 'S1' }
        }
      ];

      const result = await doubleSaisie.execute({
        supplierInvoices: factures,
        options: { toleranceJours: 31 }
      });

      const listeFournisseurs = result.anomalies[0]?.donnees?.fournisseurs || [];
      const fournisseurA = listeFournisseurs.find(f => f.supplierId === 'S1');

      expect(fournisseurA).toBeDefined();
      expect(fournisseurA.hasAlertes).toBe(true);
      expect(fournisseurA.alertes[0].type).toBe('doublon_classique');
    });

    it('ne détecte PAS de doublon si montant récent <= montant ancien', async () => {
      const factures = [
        {
          id: 1,
          invoice_number: 'F001',
          date: '2026-01-10',
          amount: 200,
          label: 'Facture FOURNISSEUR B - F001',
          supplier: { id: 'S2' }
        },
        {
          id: 2,
          invoice_number: 'F002',
          date: '2026-01-20',
          amount: 100, // Plus petit que 200
          label: 'Facture FOURNISSEUR B - F002',
          supplier: { id: 'S2' }
        }
      ];

      const result = await doubleSaisie.execute({
        supplierInvoices: factures,
        options: { toleranceJours: 31 }
      });

      const listeFournisseurs = result.anomalies[0]?.donnees?.fournisseurs || [];
      const fournisseurB = listeFournisseurs.find(f => f.supplierId === 'S2');

      expect(fournisseurB).toBeDefined();
      expect(fournisseurB.hasAlertes).toBe(false);
    });

    it('ne détecte PAS de doublon si écart > toleranceJours', async () => {
      const factures = [
        {
          id: 1,
          invoice_number: 'F001',
          date: '2026-01-01',
          amount: 100,
          label: 'Facture FOURNISSEUR C - F001',
          supplier: { id: 'S3' }
        },
        {
          id: 2,
          invoice_number: 'F002',
          date: '2026-03-01', // 59 jours d'écart
          amount: 200,
          label: 'Facture FOURNISSEUR C - F002',
          supplier: { id: 'S3' }
        }
      ];

      const result = await doubleSaisie.execute({
        supplierInvoices: factures,
        options: { toleranceJours: 31 }
      });

      const listeFournisseurs = result.anomalies[0]?.donnees?.fournisseurs || [];
      const fournisseurC = listeFournisseurs.find(f => f.supplierId === 'S3');

      expect(fournisseurC).toBeDefined();
      expect(fournisseurC.hasAlertes).toBe(false);
    });
  });

  describe('Fournisseurs marqués au relevé', () => {
    it('détecte un doublon relevé quand 2+ factures sur le même mois', async () => {
      const factures = [
        {
          id: 1,
          invoice_number: 'R001',
          date: '2026-01-05',
          amount: 500,
          label: 'Facture RELEVE FOURNISSEUR - R001',
          supplier: { id: 'SR1' }
        },
        {
          id: 2,
          invoice_number: 'R002',
          date: '2026-01-25',
          amount: 600,
          label: 'Facture RELEVE FOURNISSEUR - R002',
          supplier: { id: 'SR1' }
        }
      ];

      const result = await doubleSaisie.execute({
        supplierInvoices: factures,
        options: {
          fournisseursReleve: ['SR1'] // Marqué au relevé
        }
      });

      const listeFournisseurs = result.anomalies[0]?.donnees?.fournisseurs || [];
      const fournisseurReleve = listeFournisseurs.find(f => f.supplierId === 'SR1');

      expect(fournisseurReleve).toBeDefined();
      expect(fournisseurReleve.isMarqueReleve).toBe(true);
      expect(fournisseurReleve.hasAlertes).toBe(true);
      expect(fournisseurReleve.alertes[0].type).toBe('doublon_releve');
      expect(fournisseurReleve.alertes[0].mois).toBe('2026-01');
    });

    it('ne détecte PAS de doublon relevé si 1 seule facture par mois', async () => {
      const factures = [
        {
          id: 1,
          invoice_number: 'R001',
          date: '2026-01-15',
          amount: 500,
          label: 'Facture RELEVE UNIQUE - R001',
          supplier: { id: 'SR2' }
        },
        {
          id: 2,
          invoice_number: 'R002',
          date: '2026-02-15',
          amount: 600,
          label: 'Facture RELEVE UNIQUE - R002',
          supplier: { id: 'SR2' }
        }
      ];

      const result = await doubleSaisie.execute({
        supplierInvoices: factures,
        options: {
          fournisseursReleve: ['SR2']
        }
      });

      const listeFournisseurs = result.anomalies[0]?.donnees?.fournisseurs || [];
      const fournisseur = listeFournisseurs.find(f => f.supplierId === 'SR2');

      // Pas d'alerte doublon_releve (peut avoir alerte releve_manquant selon le mois actuel)
      const alertesDoublon = fournisseur.alertes.filter(a => a.type === 'doublon_releve');
      expect(alertesDoublon.length).toBe(0);
    });
  });

  describe('Extraction du nom fournisseur', () => {
    it('extrait correctement le nom depuis le label "Facture XXX - YYY"', async () => {
      const factures = [
        {
          id: 1,
          date: '2026-01-15',
          amount: 100,
          label: 'Facture BOUCHERIE MARGUERITE - FA2026001',
          supplier: { id: 'SN1' }
        }
      ];

      const result = await doubleSaisie.execute({ supplierInvoices: factures });

      const listeFournisseurs = result.anomalies[0]?.donnees?.fournisseurs || [];
      const fournisseur = listeFournisseurs.find(f => f.supplierId === 'SN1');

      expect(fournisseur.nom).toBe('BOUCHERIE MARGUERITE');
    });

    it('extrait correctement le nom depuis un avoir', async () => {
      const factures = [
        {
          id: 1,
          date: '2026-01-15',
          amount: 50,
          label: 'Avoir CARREFOUR - AV2026001',
          supplier: { id: 'SN2' }
        }
      ];

      const result = await doubleSaisie.execute({ supplierInvoices: factures });

      const listeFournisseurs = result.anomalies[0]?.donnees?.fournisseurs || [];
      const fournisseur = listeFournisseurs.find(f => f.supplierId === 'SN2');

      expect(fournisseur.nom).toBe('CARREFOUR');
    });
  });

  describe('Données analysées', () => {
    it('retourne les statistiques correctes', async () => {
      const factures = [
        { id: 1, date: '2026-01-10', amount: 100, label: 'Facture A - 1', supplier: { id: 'S1' } },
        { id: 2, date: '2026-01-15', amount: 200, label: 'Facture A - 2', supplier: { id: 'S1' } },
        { id: 3, date: '2026-01-20', amount: 300, label: 'Facture B - 1', supplier: { id: 'S2' } }
      ];

      const result = await doubleSaisie.execute({
        supplierInvoices: factures,
        options: { fournisseursReleve: ['S2'] }
      });

      expect(result.donneesAnalysees.type).toBe('double_saisie');
      expect(result.donneesAnalysees.nbFactures).toBe(3);
      expect(result.donneesAnalysees.nbFournisseurs).toBe(2);
      expect(result.donneesAnalysees.nbMarquesReleve).toBe(1);
    });
  });

  describe('Filtrage des factures invalides', () => {
    it('ignore les factures sans montant', async () => {
      const factures = [
        { id: 1, date: '2026-01-10', amount: 0, label: 'Facture A - 1', supplier: { id: 'S1' } },
        { id: 2, date: '2026-01-15', amount: 100, label: 'Facture A - 2', supplier: { id: 'S1' } }
      ];

      const result = await doubleSaisie.execute({ supplierInvoices: factures });

      expect(result.donneesAnalysees.nbFactures).toBe(1);
    });

    it('ignore les factures sans date', async () => {
      const factures = [
        { id: 1, date: null, amount: 100, label: 'Facture A - 1', supplier: { id: 'S1' } },
        { id: 2, date: '2026-01-15', amount: 200, label: 'Facture A - 2', supplier: { id: 'S1' } }
      ];

      const result = await doubleSaisie.execute({ supplierInvoices: factures });

      expect(result.donneesAnalysees.nbFactures).toBe(1);
    });

    it('ignore les factures sans supplier', async () => {
      const factures = [
        { id: 1, date: '2026-01-10', amount: 100, label: 'Facture A - 1', supplier: null },
        { id: 2, date: '2026-01-15', amount: 200, label: 'Facture A - 2', supplier: { id: 'S1' } }
      ];

      const result = await doubleSaisie.execute({ supplierInvoices: factures });

      expect(result.donneesAnalysees.nbFactures).toBe(1);
    });
  });
});
