// @ts-check

/**
 * @file Test "Attestation achats fournisseurs liste limitative"
 * Génère une attestation des achats HT répartis par fournisseur
 * Produit également un tableau de vérification détaillé (type FEC)
 * Utilise les écritures du FEC (ledger_entry_lines) filtrées sur les comptes d'achats
 */

/**
 * Comptes d'achats par défaut (restauration)
 * 60701 = Achats de marchandises — Boissons
 * 60702 = Achats de marchandises — Food
 */
const COMPTES_ACHATS_DEFAUT = ['60701', '60702'];

/**
 * Mapping compte → catégorie produit
 * Utilisé pour regrouper les achats par type dans l'attestation Word
 */
const CATEGORIES_PAR_COMPTE = {
  '60701': 'Boissons',
  '60702': 'Food'
};

/**
 * Détermine la catégorie d'une écriture à partir de son numéro de compte
 * @param {string} compteNum - Numéro de compte (ex: '60701', '607010000')
 * @returns {string} Catégorie (Boissons, Food, ou Autres)
 */
function getCategorieForEntry(compteNum) {
  for (const [prefix, cat] of Object.entries(CATEGORIES_PAR_COMPTE)) {
    if (compteNum.startsWith(prefix) || prefix.startsWith(compteNum)) {
      return cat;
    }
  }
  return 'Autres';
}

/**
 * Extrait le nom du fournisseur depuis les données FEC
 * Priorité : CompAuxLib > EcritureLib (nettoyé) > CompAuxNum > inconnu
 * @param {Object} ecriture - Écriture FEC
 * @returns {string} Nom du fournisseur
 */
function extractFournisseurName(ecriture) {
  // 1. CompAuxLib (compte auxiliaire) = source la plus fiable
  if (ecriture.CompAuxLib && ecriture.CompAuxLib.trim()) {
    return ecriture.CompAuxLib.trim();
  }

  // 2. EcritureLib contient souvent le nom du fournisseur
  // Formats Pennylane typiques :
  //   "Facture FOURNISSEUR - 202504031 (label généré)"
  //   "Avoir FOURNISSEUR - 202504031 (label généré)"
  //   "Facture DOMAFRAIS - LD052010 RLV (label généré)"
  //   "FOURNISSEUR n°XXXX"
  if (ecriture.EcritureLib) {
    const lib = ecriture.EcritureLib.trim();
    // Supprimer le suffixe Pennylane "(label généré)"
    let cleaned = lib.replace(/\s*\(label généré\)\s*$/i, '').trim();
    // Supprimer les préfixes "Facture" / "Avoir"
    cleaned = cleaned.replace(/^(?:Facture|Avoir)\s+/i, '').trim();
    // Supprimer tout ce qui suit le dernier " - " (numéro de facture/livraison)
    const dashIdx = cleaned.lastIndexOf(' - ');
    if (dashIdx > 0) {
      cleaned = cleaned.substring(0, dashIdx).trim();
    }
    // Supprimer les numéros de facture courants (n°XXXX)
    cleaned = cleaned.replace(/\s*n°\s*\d+.*$/i, '').trim();
    if (cleaned) return cleaned;
    return lib;
  }

  // 3. CompAuxNum comme dernier recours
  if (ecriture.CompAuxNum && ecriture.CompAuxNum.trim()) {
    return `Fournisseur ${ecriture.CompAuxNum.trim()}`;
  }

  return 'Fournisseur inconnu';
}

/**
 * Normalise un nom de fournisseur pour le regroupement
 * @param {string} nom - Nom brut du fournisseur
 * @returns {string} Nom normalisé (majuscules, sans espaces superflus)
 */
function normalizeFournisseurName(nom) {
  return nom
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Définition du test Attestation achats fournisseurs
 * @type {import('../../../types').TestDefinition}
 */
export const attestationAchats = {
  code: 'attestation_achats',
  nom: 'Attestation achats fournisseurs',
  description: 'Génère une attestation des achats HT par fournisseur avec détail de vérification FEC',
  requiredData: ['fec'],

  /**
   * Exécute le test
   * @param {Object} params - Paramètres d'exécution
   * @param {import('../../../types').FECEntry[]} params.fec - Écritures FEC
   * @param {Object} [params.options] - Options du test
   * @param {string[]} [params.options.comptesAchats] - Comptes d'achat à filtrer (ex: ['607', '601'])
   * @returns {Promise<{anomalies: import('../../../types').TestResultAnomalie[], donneesAnalysees: Object}>}
   */
  async execute({ fec, options = {} }) {
    const comptesAchats = options.comptesAchats || COMPTES_ACHATS_DEFAUT;

    /** @type {import('../../../types').TestResultAnomalie[]} */
    const anomalies = [];

    // === ÉTAPE 1 : Filtrer les écritures d'achats ===
    // Matching bidirectionnel : le compte peut commencer par le préfixe OU le préfixe peut commencer par le compte
    // Cela gère le cas où l'API retourne "60701" et l'utilisateur entre "607010000" ou "607"
    const ecrituresAchats = fec.filter(e => {
      if (!e.CompteNum) return false;
      return comptesAchats.some(prefixe =>
        e.CompteNum.startsWith(prefixe) || prefixe.startsWith(e.CompteNum)
      );
    });

    // === ÉTAPE 2 : Regrouper par fournisseur (avec catégorie) ===
    /** @type {Map<string, {nom: string, compteAux: string, categorie: string, ecritures: Object[], totalDebit: number, totalCredit: number}>} */
    const parFournisseur = new Map();

    for (const ecriture of ecrituresAchats) {
      const nomBrut = extractFournisseurName(ecriture);
      const nomNorm = normalizeFournisseurName(nomBrut);
      const categorie = getCategorieForEntry(ecriture.CompteNum || '');

      // Clé = nom normalisé + catégorie (un fournisseur peut avoir des écritures dans plusieurs catégories)
      const cle = `${nomNorm}||${categorie}`;

      if (!parFournisseur.has(cle)) {
        parFournisseur.set(cle, {
          nom: nomBrut,
          compteAux: ecriture.CompAuxNum || '',
          categorie,
          ecritures: [],
          totalDebit: 0,
          totalCredit: 0
        });
      }

      const fournisseur = parFournisseur.get(cle);
      fournisseur.ecritures.push(ecriture);
      fournisseur.totalDebit += ecriture.Debit || 0;
      fournisseur.totalCredit += ecriture.Credit || 0;
    }

    // === ÉTAPE 3 : Calculer le montant HT net par fournisseur (Débit - Crédit) ===
    /** @type {Object[]} */
    const fournisseursListe = [];

    for (const [cle, data] of parFournisseur) {
      // Montant HT = Débit - Crédit (les avoirs réduisent le débit)
      const montantHT = Math.round((data.totalDebit - data.totalCredit) * 100) / 100;

      fournisseursListe.push({
        nom: data.nom,
        nomNormalise: cle.split('||')[0],
        compteAuxiliaire: data.compteAux,
        categorie: data.categorie,
        nbEcritures: data.ecritures.length,
        totalDebit: Math.round(data.totalDebit * 100) / 100,
        totalCredit: Math.round(data.totalCredit * 100) / 100,
        montantHT
      });
    }

    // Trier par catégorie puis par montant HT décroissant
    fournisseursListe.sort((a, b) => {
      if (a.categorie !== b.categorie) return a.categorie.localeCompare(b.categorie);
      return b.montantHT - a.montantHT;
    });

    // === ÉTAPE 4 : Calculer le total général ===
    const totalGeneral = {
      nbFournisseurs: fournisseursListe.length,
      totalDebit: Math.round(fournisseursListe.reduce((s, f) => s + f.totalDebit, 0) * 100) / 100,
      totalCredit: Math.round(fournisseursListe.reduce((s, f) => s + f.totalCredit, 0) * 100) / 100,
      totalHT: Math.round(fournisseursListe.reduce((s, f) => s + f.montantHT, 0) * 100) / 100
    };

    // === ÉTAPE 4b : Regrouper par catégorie pour l'attestation Word ===
    /** @type {Object<string, {fournisseurs: Object[], sousTotal: number}>} */
    const parCategorie = {};
    for (const f of fournisseursListe) {
      if (!parCategorie[f.categorie]) {
        parCategorie[f.categorie] = { fournisseurs: [], sousTotal: 0 };
      }
      parCategorie[f.categorie].fournisseurs.push({ nom: f.nom, montantHT: f.montantHT });
      parCategorie[f.categorie].sousTotal += f.montantHT;
    }
    // Arrondir les sous-totaux
    for (const cat of Object.values(parCategorie)) {
      cat.sousTotal = Math.round(cat.sousTotal * 100) / 100;
    }

    // === ÉTAPE 5 : Préparer le détail de vérification (écritures FEC) ===
    const detailVerification = ecrituresAchats.map(e => ({
      JournalCode: e.JournalCode,
      JournalLib: e.JournalLib,
      EcritureNum: e.EcritureNum,
      EcritureDate: e.EcritureDate,
      CompteNum: e.CompteNum,
      CompteLib: e.CompteLib,
      CompAuxNum: e.CompAuxNum,
      Produits: getCategorieForEntry(e.CompteNum || ''),
      CompAuxLib: e.CompAuxLib,
      PieceRef: e.PieceRef,
      PieceDate: e.PieceDate,
      EcritureLib: e.EcritureLib,
      Debit: e.Debit || 0,
      Credit: e.Credit || 0,
      Solde: Math.round(((e.Debit || 0) - (e.Credit || 0)) * 100) / 100
    }));

    // Trier par date puis par numéro d'écriture
    detailVerification.sort((a, b) => {
      if (a.EcritureDate !== b.EcritureDate) {
        return (a.EcritureDate || '').localeCompare(b.EcritureDate || '');
      }
      return (a.EcritureNum || '').localeCompare(b.EcritureNum || '');
    });

    // === ÉTAPE 6 : Générer les anomalies ===
    // Fournisseurs avec montant négatif (plus d'avoirs que d'achats)
    const fournisseursNegatifs = fournisseursListe.filter(f => f.montantHT < 0);
    for (const f of fournisseursNegatifs) {
      anomalies.push({
        type_anomalie: 'fournisseur_montant_negatif',
        severite: 'warning',
        donnees: {
          fournisseur: f.nom,
          montantHT: f.montantHT,
          totalDebit: f.totalDebit,
          totalCredit: f.totalCredit,
          nbEcritures: f.nbEcritures
        },
        commentaire: `Le fournisseur ${f.nom} a un montant HT négatif (${f.montantHT.toFixed(2)}€) : plus d'avoirs que d'achats`
      });
    }

    // Résumé global (toujours présent)
    anomalies.push({
      type_anomalie: 'attestation_achats_resume',
      severite: 'info',
      donnees: {
        fournisseurs: fournisseursListe,
        totalGeneral
      },
      commentaire: `Attestation: ${totalGeneral.nbFournisseurs} fournisseur(s), Total HT: ${totalGeneral.totalHT.toFixed(2)}€ (Débit: ${totalGeneral.totalDebit.toFixed(2)}€, Crédit: ${totalGeneral.totalCredit.toFixed(2)}€)`
    });

    return {
      anomalies,
      donneesAnalysees: {
        type: 'attestation_achats',
        nbEcrituresAnalysees: ecrituresAchats.length,
        nbEcrituresTotal: fec.length,
        comptesAchats,
        nbFournisseurs: totalGeneral.nbFournisseurs,
        totalDebit: totalGeneral.totalDebit,
        totalCredit: totalGeneral.totalCredit,
        totalHT: totalGeneral.totalHT,
        fournisseurs: fournisseursListe,
        parCategorie,
        detailVerification
      }
    };
  }
};

export default attestationAchats;
