// @ts-check

/**
 * @file Test "Soldes anormaux" (comptes fournisseurs débiteurs / clients créditeurs)
 * Un compte fournisseur (401) normalement créditeur avec un solde débiteur
 * peut indiquer un trop-payé, un avoir non imputé ou une erreur de saisie.
 * Un compte client (411) normalement débiteur avec un solde créditeur
 * peut indiquer un trop-perçu ou une erreur.
 */

/**
 * Définition du test Soldes anormaux
 * @type {import('../../../types').TestDefinition}
 */
export const soldesAnormaux = {
  code: 'soldes_anormaux',
  nom: 'Soldes anormaux (401/411)',
  description: 'Détecte les comptes fournisseurs (401) débiteurs et clients (411) créditeurs – signale trop-payés, avoirs non imputés ou erreurs',
  requiredData: ['fec'],

  /**
   * Exécute le test
   * @param {Object} params - Paramètres d'exécution
   * @param {import('../../../types').FECEntry[]} params.fec - Écritures FEC
   * @param {Object} [params.options] - Options du test
   * @param {number} [params.options.seuilMontant=0] - Montant minimum pour alerter (en valeur absolue)
   * @returns {Promise<{anomalies: import('../../../types').TestResultAnomalie[], donneesAnalysees: Object}>}
   */
  async execute({ fec, options = {} }) {
    const seuilMontant = options.seuilMontant || 0;

    /** @type {import('../../../types').TestResultAnomalie[]} */
    const anomalies = [];

    // === ÉTAPE 1 : Calculer les soldes par compte auxiliaire (401/411) ===
    /** @type {Map<string, {compteNum: string, compteLib: string, totalDebit: number, totalCredit: number, nbEcritures: number}>} */
    const soldesParCompte = new Map();

    for (const ecriture of fec) {
      const compteNum = ecriture.CompteNum || '';
      if (!compteNum.startsWith('401') && !compteNum.startsWith('411')) continue;

      if (!soldesParCompte.has(compteNum)) {
        soldesParCompte.set(compteNum, {
          compteNum,
          compteLib: ecriture.CompteLib || ecriture.CompAuxLib || '',
          totalDebit: 0,
          totalCredit: 0,
          nbEcritures: 0
        });
      }

      const compte = soldesParCompte.get(compteNum);
      compte.totalDebit += ecriture.Debit || 0;
      compte.totalCredit += ecriture.Credit || 0;
      compte.nbEcritures++;
    }

    // === ÉTAPE 2 : Détecter les soldes anormaux ===
    const comptesAnalyses = [];
    const comptesAnormaux = [];

    for (const [compteNum, data] of soldesParCompte) {
      const solde = Math.round((data.totalDebit - data.totalCredit) * 100) / 100;
      const isFournisseur = compteNum.startsWith('401');
      const isClient = compteNum.startsWith('411');

      const compteInfo = {
        compteNum: data.compteNum,
        compteLib: data.compteLib,
        type: isFournisseur ? 'Fournisseur' : 'Client',
        totalDebit: Math.round(data.totalDebit * 100) / 100,
        totalCredit: Math.round(data.totalCredit * 100) / 100,
        solde,
        nbEcritures: data.nbEcritures,
        anormal: false,
        raison: ''
      };

      // Fournisseur (401) : normalement créditeur (solde < 0), anormal si débiteur (solde > 0)
      if (isFournisseur && solde > seuilMontant) {
        compteInfo.anormal = true;
        compteInfo.raison = `Fournisseur avec solde débiteur (${solde.toFixed(2)}€) : trop-payé, avoir non imputé ou erreur`;
      }

      // Client (411) : normalement débiteur (solde > 0), anormal si créditeur (solde < 0)
      if (isClient && solde < -seuilMontant) {
        compteInfo.anormal = true;
        compteInfo.raison = `Client avec solde créditeur (${solde.toFixed(2)}€) : trop-perçu, avoir non imputé ou erreur`;
      }

      comptesAnalyses.push(compteInfo);
      if (compteInfo.anormal) {
        comptesAnormaux.push(compteInfo);
      }
    }

    // Trier : anormaux d'abord (par montant absolu décroissant), puis normaux
    comptesAnalyses.sort((a, b) => {
      if (a.anormal !== b.anormal) return a.anormal ? -1 : 1;
      return Math.abs(b.solde) - Math.abs(a.solde);
    });

    // === ÉTAPE 3 : Générer les anomalies ===
    for (const compte of comptesAnormaux) {
      /** @type {import('../../../types').SeveriteAnomalie} */
      let severite = 'warning';
      const absSolde = Math.abs(compte.solde);
      if (absSolde > 10000) severite = 'error';
      else if (absSolde > 1000) severite = 'warning';
      else severite = 'info';

      anomalies.push({
        type_anomalie: 'solde_anormal',
        severite,
        donnees: {
          compteNum: compte.compteNum,
          compteLib: compte.compteLib,
          type: compte.type,
          solde: compte.solde,
          totalDebit: compte.totalDebit,
          totalCredit: compte.totalCredit,
          nbEcritures: compte.nbEcritures
        },
        commentaire: compte.raison
      });
    }

    // Résumé
    anomalies.push({
      type_anomalie: 'soldes_anormaux_resume',
      severite: 'info',
      donnees: {
        nbComptesAnalyses: comptesAnalyses.length,
        nbFournisseurs: comptesAnalyses.filter(c => c.type === 'Fournisseur').length,
        nbClients: comptesAnalyses.filter(c => c.type === 'Client').length,
        nbAnormaux: comptesAnormaux.length,
        comptesAnormaux: comptesAnormaux.map(c => ({
          compteNum: c.compteNum,
          compteLib: c.compteLib,
          type: c.type,
          solde: c.solde
        }))
      },
      commentaire: `Analyse de ${comptesAnalyses.length} comptes (401/411) — ${comptesAnormaux.length} solde(s) anormal(aux) détecté(s)`
    });

    return {
      anomalies,
      donneesAnalysees: {
        type: 'soldes_anormaux',
        nbComptesAnalyses: comptesAnalyses.length,
        nbFournisseurs: comptesAnalyses.filter(c => c.type === 'Fournisseur').length,
        nbClients: comptesAnalyses.filter(c => c.type === 'Client').length,
        nbAnormaux: comptesAnormaux.length,
        comptes: comptesAnalyses
      }
    };
  }
};

export default soldesAnormaux;
