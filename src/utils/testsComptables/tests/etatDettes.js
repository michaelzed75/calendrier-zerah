// @ts-check

/**
 * @file Test "État des Dettes" — Génère un état des dettes par catégorie de comptes à une date donnée
 * Calcule les soldes des comptes de dettes (emprunts, personnel, fournisseurs, etc.)
 * et les regroupe par catégorie avec sous-totaux et total général.
 */

/**
 * Catégories de dettes par défaut (Plan Comptable Général)
 * Chaque catégorie peut avoir des règles spéciales :
 * - onlyIfNegative : n'inclure que si le solde est négatif (caisse, banque)
 * - globalOnly : agréger tous les sous-comptes en une seule ligne (fournisseurs)
 */
const CATEGORIES_DETTES_DEFAUT = [
  { prefixes: ['164'], categorie: 'Emprunts', label: 'Emprunts auprès des établissements de crédit' },
  { prefixes: ['421'], categorie: 'Personnel', label: 'Personnel - Rémunérations dues' },
  { prefixes: ['428'], categorie: 'Congés payés', label: 'Personnel - Charges à payer (congés payés)' },
  { prefixes: ['451'], categorie: 'Groupe et associés', label: 'Groupe et associés' },
  { prefixes: ['455'], categorie: 'Comptes courants associés', label: 'Associés - Comptes courants' },
  { prefixes: ['53'], categorie: 'Caisse', label: 'Caisse (si solde négatif)', onlyIfNegative: true },
  { prefixes: ['401', '408'], categorie: 'Fournisseurs', label: 'Fournisseurs et comptes rattachés (dont FNP)', globalOnly: true },
  { prefixes: ['467', '468'], categorie: 'Dettes diverses', label: 'Autres dettes' },
  { prefixes: ['512'], categorie: 'Banque', label: 'Banque (si solde négatif)', onlyIfNegative: true }
];

/**
 * Reconstruit les catégories à partir des préfixes utilisateur
 * Si l'utilisateur a modifié les préfixes, on les réassigne aux catégories par défaut
 * @param {string[]} userPrefixes - Préfixes saisis par l'utilisateur
 * @returns {Array<{prefixes: string[], categorie: string, label: string, onlyIfNegative?: boolean, globalOnly?: boolean}>}
 */
function buildCategories(userPrefixes) {
  if (!userPrefixes || userPrefixes.length === 0) {
    return CATEGORIES_DETTES_DEFAUT;
  }

  // Associer chaque préfixe utilisateur à sa catégorie par défaut
  // Si un préfixe ne correspond à aucune catégorie connue, le mettre dans "Autres"
  const categories = [];
  const usedPrefixes = new Set();

  for (const catDef of CATEGORIES_DETTES_DEFAUT) {
    const matchedPrefixes = userPrefixes.filter(p =>
      catDef.prefixes.some(defP => p.startsWith(defP) || defP.startsWith(p))
    );
    if (matchedPrefixes.length > 0) {
      categories.push({
        ...catDef,
        prefixes: matchedPrefixes
      });
      matchedPrefixes.forEach(p => usedPrefixes.add(p));
    }
  }

  // Préfixes non reconnus → catégorie "Autres"
  const autresPrefixes = userPrefixes.filter(p => !usedPrefixes.has(p));
  if (autresPrefixes.length > 0) {
    categories.push({
      prefixes: autresPrefixes,
      categorie: 'Autres',
      label: `Autres comptes (${autresPrefixes.join(', ')})`
    });
  }

  return categories;
}

/**
 * @type {import('../../../types').TestDefinition}
 */
export const etatDettes = {
  code: 'etat_dettes',
  nom: 'État des dettes',
  description: 'Génère un état des dettes avec soldes par catégorie de comptes à une date donnée, avec seuil de signification et export Excel',
  requiredData: ['fecDettes'],

  /**
   * @param {Object} params
   * @param {import('../../../types').FECEntry[]} params.fec - Écritures comptables filtrées
   * @param {Object} [params.options]
   * @param {string[]} [params.options.comptesPrefixes] - Préfixes de comptes personnalisés
   * @param {number} [params.options.seuilSignification] - Seuil en euros (défaut 0)
   * @param {string} [params.options.dateArrete] - Date d'arrêté au format YYYY-MM-DD
   */
  async execute({ fec, options = {} }) {
    const seuilSignification = options.seuilSignification || 0;
    const dateArrete = options.dateArrete || '';
    const categories = buildCategories(options.comptesPrefixes);

    // ========================================
    // 1. Agréger Débit/Crédit par numéro de compte
    // ========================================
    /** @type {Map<string, {compteNum: string, compteLib: string, totalDebit: number, totalCredit: number, nbEcritures: number}>} */
    const soldesParCompte = new Map();

    for (const ecriture of fec) {
      const compteNum = ecriture.CompteNum;
      if (!compteNum) continue;

      if (!soldesParCompte.has(compteNum)) {
        soldesParCompte.set(compteNum, {
          compteNum,
          compteLib: ecriture.CompteLib || '',
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

    // ========================================
    // 2. Classer par catégorie et appliquer les règles
    // ========================================
    const categoriesResultat = [];
    let totalDettes = 0;
    let nbComptesAnalyses = 0;
    let nbComptesRetenus = 0;
    /** @type {Array<Object>} */
    const detailComptes = [];

    for (const catDef of categories) {
      // Trouver tous les comptes qui matchent cette catégorie
      const comptesMatches = [];
      for (const [compteNum, data] of soldesParCompte) {
        const matches = catDef.prefixes.some(prefix => compteNum.startsWith(prefix));
        if (matches) {
          const solde = Math.round((data.totalDebit - data.totalCredit) * 100) / 100;
          // Pour les comptes de dette (passif), solde < 0 = dette
          // montantDette = valeur absolue du solde quand c'est une dette
          const montantDette = solde < 0 ? Math.abs(solde) : 0;

          comptesMatches.push({
            ...data,
            solde,
            montantDette
          });
        }
      }

      if (comptesMatches.length === 0) continue;

      nbComptesAnalyses += comptesMatches.length;

      // Appliquer la règle onlyIfNegative (caisse, banque)
      let comptesFiltres = comptesMatches;
      if (catDef.onlyIfNegative) {
        comptesFiltres = comptesMatches.filter(c => c.solde < 0);
      }

      // Appliquer la règle globalOnly (fournisseurs : une seule ligne agrégée)
      let comptesFinaux;
      if (catDef.globalOnly && comptesFiltres.length > 0) {
        const totalDebit = comptesFiltres.reduce((sum, c) => sum + c.totalDebit, 0);
        const totalCredit = comptesFiltres.reduce((sum, c) => sum + c.totalCredit, 0);
        const soldeGlobal = Math.round((totalDebit - totalCredit) * 100) / 100;
        const montantDetteGlobal = soldeGlobal < 0 ? Math.abs(soldeGlobal) : 0;

        comptesFinaux = [{
          compteNum: catDef.prefixes[0] + 'xxx',
          compteLib: `${catDef.categorie} (total ${comptesFiltres.length} comptes)`,
          totalDebit: Math.round(totalDebit * 100) / 100,
          totalCredit: Math.round(totalCredit * 100) / 100,
          solde: soldeGlobal,
          montantDette: montantDetteGlobal,
          nbEcritures: comptesFiltres.reduce((sum, c) => sum + c.nbEcritures, 0)
        }];
      } else {
        comptesFinaux = comptesFiltres;
      }

      // Appliquer le seuil de signification
      const comptesRetenus = comptesFinaux.filter(c => Math.abs(c.solde) >= seuilSignification);
      nbComptesRetenus += comptesRetenus.length;

      const sousTotal = Math.round(comptesRetenus.reduce((sum, c) => sum + c.montantDette, 0) * 100) / 100;
      totalDettes += sousTotal;

      if (comptesRetenus.length > 0) {
        categoriesResultat.push({
          categorie: catDef.categorie,
          label: catDef.label,
          globalOnly: catDef.globalOnly || false,
          onlyIfNegative: catDef.onlyIfNegative || false,
          comptes: comptesRetenus.sort((a, b) => b.montantDette - a.montantDette),
          sousTotal
        });
      }

      // Ajouter au détail (tous les comptes, même non retenus)
      // Pour les catégories globalOnly, si la ligne agrégée est retenue, tous les comptes individuels sont retenus
      const categorieRetenue = catDef.globalOnly && comptesRetenus.length > 0;
      for (const c of comptesMatches) {
        const retenu = categorieRetenue || comptesRetenus.some(r => r.compteNum === c.compteNum);
        detailComptes.push({
          categorie: catDef.categorie,
          compteNum: c.compteNum,
          compteLib: c.compteLib,
          totalDebit: Math.round(c.totalDebit * 100) / 100,
          totalCredit: Math.round(c.totalCredit * 100) / 100,
          solde: c.solde,
          montantDette: c.montantDette,
          nbEcritures: c.nbEcritures,
          retenu
        });
      }
    }

    totalDettes = Math.round(totalDettes * 100) / 100;

    // ========================================
    // 3. Construire les anomalies et données analysées
    // ========================================

    /** @type {import('../../../types').TestResultAnomalie[]} */
    const anomalies = [];

    // Anomalie résumé
    anomalies.push({
      type_anomalie: 'etat_dettes_resume',
      severite: 'info',
      donnees: {
        dateArrete,
        seuilSignification,
        nbComptesAnalyses,
        nbComptesRetenus,
        totalDettes,
        categories: categoriesResultat.map(cat => ({
          categorie: cat.categorie,
          nbComptes: cat.comptes.length,
          sousTotal: cat.sousTotal
        }))
      },
      commentaire: `État des dettes au ${dateArrete || 'fin d\'exercice'} : ${nbComptesRetenus} comptes retenus, total ${totalDettes.toFixed(2)} €`
    });

    // Alertes pour les dettes significatives
    for (const cat of categoriesResultat) {
      for (const compte of cat.comptes) {
        if (compte.montantDette > 0) {
          const severite = compte.montantDette >= 50000 ? 'warning' : 'info';
          anomalies.push({
            type_anomalie: 'dette_compte',
            severite,
            donnees: {
              categorie: cat.categorie,
              compteNum: compte.compteNum,
              compteLib: compte.compteLib,
              montantDette: compte.montantDette,
              totalDebit: compte.totalDebit,
              totalCredit: compte.totalCredit,
              solde: compte.solde
            },
            commentaire: `${cat.categorie} — ${compte.compteNum} ${compte.compteLib} : ${compte.montantDette.toFixed(2)} €`
          });
        }
      }
    }

    const donneesAnalysees = {
      type: 'etat_dettes',
      dateArrete,
      seuilSignification,
      nbComptesAnalyses,
      nbComptesRetenus,
      totalDettes,
      nbEcrituresTotal: fec.length,
      categories: categoriesResultat,
      detailComptes: detailComptes.sort((a, b) => a.categorie.localeCompare(b.categorie) || a.compteNum.localeCompare(b.compteNum))
    };

    return { anomalies, donneesAnalysees };
  }
};

export default etatDettes;
