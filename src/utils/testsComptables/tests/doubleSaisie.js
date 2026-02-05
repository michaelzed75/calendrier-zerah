// @ts-check

/**
 * @file Test Relevé fournisseurs
 * - Liste tous les fournisseurs avec possibilité de les marquer "au relevé"
 * - Pour fournisseurs "au relevé" : alerte si 2+ factures sur un mois (doublon)
 * - Pour fournisseurs "au relevé" : alerte si pas de facture ce mois (relevé manquant)
 * - Pour autres fournisseurs : détection doublons classiques
 * Utilise l'API /supplier_invoices de Pennylane
 */

/**
 * Normalise un montant pour la comparaison
 * @param {number|string} amount - Montant à normaliser
 * @returns {number} Montant normalisé (2 décimales, valeur absolue)
 */
function normalizeAmount(amount) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return Math.abs(Math.round((num || 0) * 100) / 100);
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
 * Extrait le mois-année d'une date (format "2025-01")
 * @param {string} dateStr - Date au format YYYY-MM-DD
 * @returns {string} Mois-année au format "YYYY-MM"
 */
function getMoisAnnee(dateStr) {
  if (!dateStr) return '';
  return dateStr.substring(0, 7); // "2025-01-15" -> "2025-01"
}

/**
 * Vérifie si un filename suggère un document récapitulatif/relevé
 * @param {string} filename - Nom du fichier
 * @returns {boolean}
 */
function isReleve(filename) {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  const termes = ['releve', 'relevé', 'recapitulatif', 'récapitulatif', 'recap', 'mensuel', 'periodique'];
  return termes.some(terme => lower.includes(terme));
}

/**
 * Extrait le nom du fournisseur depuis le label de la facture
 * Format typique: "Facture FOURNISSEUR - NUMERO"
 * @param {string} label - Label de la facture
 * @returns {string} Nom du fournisseur ou chaîne vide
 */
function extractSupplierName(label) {
  if (!label) return '';
  const match = label.match(/^(?:Facture|Avoir)\s+(.+?)\s+-\s+/i);
  if (match) {
    return match[1].trim();
  }
  return '';
}

/**
 * Définition du test Relevé fournisseurs
 * @type {import('../../../types').TestDefinition}
 */
export const doubleSaisie = {
  code: 'double_saisie',
  nom: 'Relevé fournisseurs',
  description: 'Suivi des fournisseurs au relevé : détecte les doublons et les relevés manquants',
  requiredData: ['supplierInvoices'],

  /**
   * Exécute le test
   * @param {Object} params - Paramètres d'exécution
   * @param {Object[]} params.supplierInvoices - Factures fournisseurs Pennylane
   * @param {Object} [params.options] - Options du test
   * @param {number} [params.options.toleranceJours=31] - Période de comparaison (jours)
   * @param {string[]} [params.options.fournisseursReleve] - Liste des supplier_id marqués "au relevé"
   * @param {number} [params.options.millesime] - Année fiscale pour le calendrier des relevés
   * @returns {Promise<{anomalies: import('../../../types').TestResultAnomalie[], donneesAnalysees: Object}>}
   */
  async execute({ supplierInvoices, options = {} }) {
    const toleranceJours = options.toleranceJours || 31;
    const fournisseursReleveSet = new Set(options.fournisseursReleve || []);
    const millesime = options.millesime || new Date().getFullYear();

    /** @type {import('../../../types').TestResultAnomalie[]} */
    const anomalies = [];

    // Générer la liste des 12 mois du millésime
    const moisDuMillesime = [];
    for (let m = 1; m <= 12; m++) {
      moisDuMillesime.push(`${millesime}-${String(m).padStart(2, '0')}`);
    }

    // Mois actuel pour savoir jusqu'où vérifier
    const now = new Date();
    const moisActuel = getMoisAnnee(now.toISOString().split('T')[0]);

    // Préparer les factures
    const factures = supplierInvoices
      .filter(inv => inv.amount && inv.date && inv.supplier?.id)
      .map(inv => ({
        id: inv.id,
        numero: inv.invoice_number || String(inv.id),
        date: inv.date,
        dateObj: parseDate(inv.date),
        moisAnnee: getMoisAnnee(inv.date),
        montant: normalizeAmount(inv.amount),
        label: inv.label || '',
        filename: inv.filename || '',
        pdfUrl: inv.public_file_url || '',
        supplierId: inv.supplier?.id,
        supplierName: extractSupplierName(inv.label) || 'Fournisseur inconnu',
        isReleve: isReleve(inv.filename)
      }))
      .filter(f => f.dateObj !== null && f.montant > 0);

    // Grouper par fournisseur
    const parFournisseur = new Map();
    for (const facture of factures) {
      if (!parFournisseur.has(facture.supplierId)) {
        parFournisseur.set(facture.supplierId, {
          supplierId: facture.supplierId,
          nom: facture.supplierName,
          factures: []
        });
      }
      parFournisseur.get(facture.supplierId).factures.push(facture);
    }

    // Liste des fournisseurs avec leurs alertes
    const listeFournisseurs = [];

    for (const [supplierId, fournisseurData] of parFournisseur) {
      const facturesFournisseur = fournisseurData.factures;
      const isMarqueReleve = fournisseursReleveSet.has(String(supplierId));

      // Trier par date croissante
      facturesFournisseur.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

      // Grouper par mois
      const parMois = new Map();
      for (const f of facturesFournisseur) {
        if (!parMois.has(f.moisAnnee)) {
          parMois.set(f.moisAnnee, []);
        }
        parMois.get(f.moisAnnee).push(f);
      }

      // Alertes pour ce fournisseur
      const alertes = [];

      // Calendrier des mois (pour fournisseurs au relevé)
      const calendrierMois = moisDuMillesime.map(mois => {
        const facturesMois = parMois.get(mois) || [];
        const estPasse = mois < moisActuel;
        const estFutur = mois > moisActuel;
        return {
          mois,
          nbFactures: facturesMois.length,
          montantTotal: facturesMois.reduce((sum, f) => sum + f.montant, 0),
          estPasse,
          estFutur,
          estMoisActuel: mois === moisActuel
        };
      });

      if (isMarqueReleve) {
        // FOURNISSEUR AU RELEVÉ : vérifier les règles spéciales

        // 1. Vérifier chaque mois passé : si 2+ factures = doublon, si 0 facture = manquant
        for (const moisInfo of calendrierMois) {
          if (moisInfo.estFutur) continue; // Ne pas vérifier le futur

          const facturesMois = parMois.get(moisInfo.mois) || [];

          if (facturesMois.length >= 2) {
            // Doublon : plusieurs factures sur le même mois
            alertes.push({
              type: 'doublon_releve',
              mois: moisInfo.mois,
              message: `${facturesMois.length} factures en ${moisInfo.mois} (devrait être 1 seul relevé)`,
              factures: facturesMois.slice(0, 5).map(f => ({
                id: f.id,
                numero: f.numero,
                date: f.date,
                montant: f.montant,
                pdfUrl: f.pdfUrl
              }))
            });
          } else if (facturesMois.length === 0 && moisInfo.estPasse) {
            // Relevé manquant pour un mois passé
            alertes.push({
              type: 'releve_manquant',
              mois: moisInfo.mois,
              message: `Pas de relevé reçu pour ${moisInfo.mois}`,
              factures: []
            });
          }
        }
      } else {
        // FOURNISSEUR NORMAL : détection doublons classiques
        // Alerte si : montants égaux OU montant récent > ancien (possible cumul)
        for (let i = 0; i < facturesFournisseur.length; i++) {
          const ancienne = facturesFournisseur[i];

          for (let j = i + 1; j < facturesFournisseur.length; j++) {
            const recente = facturesFournisseur[j];

            const diffJours = Math.ceil((recente.dateObj.getTime() - ancienne.dateObj.getTime()) / (1000 * 60 * 60 * 24));
            if (diffJours > toleranceJours) continue;

            // Doublon si : montants égaux, ou récente plus grande, ou fichier "relevé" détecté
            const montantsEgaux = recente.montant === ancienne.montant;
            const recentePlusGrande = recente.montant > ancienne.montant;
            const releveDetecte = recente.isReleve;

            if (montantsEgaux || recentePlusGrande || releveDetecte) {
              alertes.push({
                type: 'doublon_classique',
                message: montantsEgaux
                  ? `Doublon exact : ${ancienne.montant}€ (même montant)`
                  : `Doublon potentiel : ${ancienne.montant}€ → ${recente.montant}€`,
                factures: [
                  { id: ancienne.id, numero: ancienne.numero, date: ancienne.date, montant: ancienne.montant, pdfUrl: ancienne.pdfUrl, isReleve: ancienne.isReleve },
                  { id: recente.id, numero: recente.numero, date: recente.date, montant: recente.montant, pdfUrl: recente.pdfUrl, isReleve: recente.isReleve }
                ]
              });
              break; // Une seule alerte par fournisseur pour les doublons classiques
            }
          }
          if (alertes.length > 0) break;
        }
      }

      // Ajouter le fournisseur à la liste
      listeFournisseurs.push({
        supplierId,
        nom: fournisseurData.nom,
        nbFactures: facturesFournisseur.length,
        isMarqueReleve,
        hasAlertes: alertes.length > 0,
        alertes,
        calendrierMois: isMarqueReleve ? calendrierMois : null, // Calendrier pour fournisseurs au relevé
        // Pour compatibilité avec l'ancien format
        hasDoublons: alertes.length > 0,
        doublonsPotentiels: alertes.filter(a => a.factures && a.factures.length >= 2).map(a => ({
          factureAncienne: a.factures[0],
          factureRecente: a.factures[1] || a.factures[0],
          releveDetecte: a.type === 'doublon_releve'
        }))
      });
    }

    // Ajouter les fournisseurs "au relevé" qui n'ont AUCUNE facture (pas dans Pennylane)
    // Note: on ne peut pas le faire ici car on n'a pas la liste complète des fournisseurs marqués
    // Ce sera géré côté frontend

    // Trier : fournisseurs avec alertes en premier, puis marqués relevé, puis par nom
    listeFournisseurs.sort((a, b) => {
      if (a.hasAlertes && !b.hasAlertes) return -1;
      if (!a.hasAlertes && b.hasAlertes) return 1;
      if (a.isMarqueReleve && !b.isMarqueReleve) return -1;
      if (!a.isMarqueReleve && b.isMarqueReleve) return 1;
      return a.nom.localeCompare(b.nom, 'fr');
    });

    // Créer l'anomalie "liste"
    anomalies.push({
      type_anomalie: 'liste_fournisseurs',
      severite: 'info',
      donnees: {
        fournisseurs: listeFournisseurs
      },
      commentaire: `${listeFournisseurs.length} fournisseurs, ${listeFournisseurs.filter(f => f.hasAlertes).length} avec alertes`
    });

    return {
      anomalies,
      donneesAnalysees: {
        type: 'double_saisie',
        nbFactures: factures.length,
        nbFournisseurs: parFournisseur.size,
        nbAvecAlertes: listeFournisseurs.filter(f => f.hasAlertes).length,
        nbMarquesReleve: listeFournisseurs.filter(f => f.isMarqueReleve).length,
        toleranceJours
      }
    };
  }
};

export default doubleSaisie;
