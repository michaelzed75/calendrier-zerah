// @ts-check

/**
 * @file Test de détection des doubles saisies
 * Détecte les factures présentes dans le relevé bancaire ET saisies individuellement
 */

/**
 * Normalise un montant pour la comparaison
 * @param {number|string} amount - Montant à normaliser
 * @returns {number} Montant normalisé (2 décimales)
 */
function normalizeAmount(amount) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return Math.round((num || 0) * 100) / 100;
}

/**
 * Parse une date en objet Date
 * @param {string} dateStr - Date au format YYYY-MM-DD ou autre
 * @returns {Date|null} Objet Date ou null si invalide
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Calcule la différence en jours entre deux dates
 * @param {Date} date1 - Première date
 * @param {Date} date2 - Deuxième date
 * @returns {number} Différence en jours (valeur absolue)
 */
function daysDifference(date1, date2) {
  const diffTime = Math.abs(date1.getTime() - date2.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Définition du test de double saisie
 * @type {import('../../../types').TestDefinition}
 */
export const doubleSaisie = {
  code: 'double_saisie',
  nom: 'Double saisie',
  description: 'Détecte les factures présentes dans le relevé bancaire ET saisies individuellement',
  requiredData: ['fec'],

  /**
   * Exécute le test de détection des doubles saisies
   * @param {Object} params - Paramètres d'exécution
   * @param {import('../../../types').FECEntry[]} params.fec - Données FEC
   * @param {Object} [params.options] - Options du test
   * @param {number} [params.options.toleranceJours=5] - Tolérance en jours entre les dates
   * @param {number} [params.options.toleranceMontant=0.01] - Tolérance sur les montants (en %)
   * @returns {Promise<import('../../../types').TestResultAnomalie[]>} Anomalies détectées
   */
  async execute({ fec, options = {} }) {
    const toleranceJours = options.toleranceJours || 5;
    const toleranceMontant = options.toleranceMontant || 0.01; // 1%

    /** @type {import('../../../types').TestResultAnomalie[]} */
    const anomalies = [];

    // Séparer les écritures bancaires (512) des écritures de charges/produits
    const ecrituresBanque = [];
    const ecrituresFactures = [];

    // Journaux bancaires courants
    const journauxBancaires = ['BQ', 'BNQ', 'BANQUE', 'BAN', 'BA'];

    for (const entry of fec) {
      const compteNum = entry.CompteNum || '';
      const journalCode = (entry.JournalCode || '').toUpperCase();

      // Écritures bancaires (comptes 512 ou journaux bancaires)
      if (compteNum.startsWith('512') || journauxBancaires.includes(journalCode)) {
        ecrituresBanque.push(entry);
      }

      // Écritures de factures (comptes 401 fournisseurs ou 411 clients)
      if (compteNum.startsWith('401') || compteNum.startsWith('411')) {
        ecrituresFactures.push(entry);
      }
    }

    // Grouper les écritures bancaires par montant pour accélérer la recherche
    const banqueParMontant = new Map();
    for (const entry of ecrituresBanque) {
      const montant = normalizeAmount(entry.Debit || entry.Credit);
      if (montant === 0) continue;

      if (!banqueParMontant.has(montant)) {
        banqueParMontant.set(montant, []);
      }
      banqueParMontant.get(montant).push(entry);
    }

    // Pour chaque écriture de facture, chercher une correspondance bancaire
    const doublesDetectes = new Set(); // Pour éviter les doublons

    for (const facture of ecrituresFactures) {
      const montantFacture = normalizeAmount(facture.Debit || facture.Credit);
      if (montantFacture === 0) continue;

      const dateFacture = parseDate(facture.EcritureDate || facture.PieceDate);
      if (!dateFacture) continue;

      // Chercher des montants similaires dans les écritures bancaires
      // On cherche le montant exact et des montants proches
      const montantsAChercher = [montantFacture];

      // Ajouter des montants avec tolérance
      const tolerance = montantFacture * toleranceMontant;
      for (let delta = -tolerance; delta <= tolerance; delta += 0.01) {
        const montantTest = normalizeAmount(montantFacture + delta);
        if (montantTest !== montantFacture) {
          montantsAChercher.push(montantTest);
        }
      }

      for (const montant of montantsAChercher) {
        const ecrituresBanqueCorrespondantes = banqueParMontant.get(montant) || [];

        for (const banque of ecrituresBanqueCorrespondantes) {
          const dateBanque = parseDate(banque.EcritureDate || banque.PieceDate);
          if (!dateBanque) continue;

          // Vérifier la proximité des dates
          const diffJours = daysDifference(dateFacture, dateBanque);

          if (diffJours <= toleranceJours) {
            // Créer une clé unique pour éviter les doublons
            const cle = `${facture.EcritureNum}-${banque.EcritureNum}`;
            if (doublesDetectes.has(cle)) continue;
            doublesDetectes.add(cle);

            // Déterminer la sévérité
            /** @type {import('../../../types').SeveriteAnomalie} */
            let severite = 'warning';
            if (diffJours === 0 && montant === montantFacture) {
              severite = 'error'; // Même jour, même montant exact
            } else if (diffJours <= 2) {
              severite = 'warning';
            } else {
              severite = 'info';
            }

            anomalies.push({
              type_anomalie: 'double_saisie',
              severite,
              donnees: {
                ecritureFacture: {
                  numero: facture.EcritureNum,
                  date: facture.EcritureDate,
                  compte: facture.CompteNum,
                  libelle: facture.EcritureLib,
                  montant: montantFacture,
                  pieceRef: facture.PieceRef
                },
                ecritureBanque: {
                  numero: banque.EcritureNum,
                  date: banque.EcritureDate,
                  compte: banque.CompteNum,
                  libelle: banque.EcritureLib,
                  montant: montant,
                  pieceRef: banque.PieceRef
                },
                differenceJours: diffJours,
                differenceMontant: Math.abs(montantFacture - montant)
              },
              commentaire: `Possible double saisie: facture ${facture.PieceRef || facture.EcritureNum} ` +
                `(${montantFacture}€ le ${facture.EcritureDate}) correspond à l'écriture bancaire ` +
                `${banque.PieceRef || banque.EcritureNum} (${montant}€ le ${banque.EcritureDate}). ` +
                `Écart: ${diffJours} jour(s).`
            });
          }
        }
      }
    }

    return anomalies;
  }
};

export default doubleSaisie;
