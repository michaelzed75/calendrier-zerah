// @ts-check

/**
 * @file Classification des lignes de facturation en 8 axes d'augmentation
 *
 * Axes :
 * 1. compta_mensuelle  — Mission comptable / surveillance
 * 2. bilan             — Bilan (annuel)
 * 3. pl                — P&L / Etat de gestion (mensuel, pas systématique)
 * 4. social_forfait    — Social au forfait
 * 5. social_bulletin   — Social au bulletin (prix unitaire)
 * 6. accessoires_social— Coffre-fort, publi-postage, entrées/sorties, extras
 * 7. juridique         — Secrétariat juridique
 * 8. support           — Mise à disposition de logiciel, divers
 */

/**
 * @typedef {'compta_mensuelle'|'bilan'|'pl'|'social_forfait'|'social_bulletin'|'accessoires_social'|'juridique'|'support'} AxeAugmentation
 */

/**
 * @typedef {Object} AxeDefinition
 * @property {string} key
 * @property {string} label
 * @property {string} description
 * @property {string} color
 * @property {string[]} modes
 * @property {string} defaultMode
 */

/** @type {Object.<string, AxeDefinition>} */
export const AXE_DEFINITIONS = {
  compta_mensuelle: {
    key: 'compta_mensuelle',
    label: 'Compta mensuelle',
    description: 'Mission comptable / surveillance',
    color: 'blue',
    modes: ['pourcentage', 'montant'],
    defaultMode: 'pourcentage',
    unique: true
  },
  bilan: {
    key: 'bilan',
    label: 'Bilan',
    description: 'Etablissement du Bilan (annuel)',
    color: 'indigo',
    modes: ['pourcentage', 'montant'],
    defaultMode: 'pourcentage',
    unique: true
  },
  pl: {
    key: 'pl',
    label: 'P&L / Gestion',
    description: 'Etat de gestion / P&L (mensuel)',
    color: 'violet',
    modes: ['pourcentage', 'montant'],
    defaultMode: 'pourcentage',
    unique: true
  },
  social_forfait: {
    key: 'social_forfait',
    label: 'Social forfait',
    description: 'Mission du social (forfait)',
    color: 'green',
    modes: ['pourcentage', 'montant'],
    defaultMode: 'pourcentage',
    unique: true
  },
  social_bulletin: {
    key: 'social_bulletin',
    label: 'Social au bulletin',
    description: 'Bulletins de salaire (prix unitaire)',
    color: 'emerald',
    modes: ['pourcentage', 'montant'],
    defaultMode: 'pourcentage',
    unique: true
  },
  accessoires_social: {
    key: 'accessoires_social',
    label: 'Accessoires social',
    description: 'Suit le prix du bulletin (×1 ou ×2)',
    color: 'teal',
    modes: [],          // Pas de mode propre : suit le bulletin
    defaultMode: null,
    unique: false,
    suiviBulletin: true  // Les accessoires suivent l'augmentation du bulletin
  },
  juridique: {
    key: 'juridique',
    label: 'Juridique',
    description: 'Secrétariat juridique',
    color: 'purple',
    modes: ['pourcentage', 'montant'],
    defaultMode: 'pourcentage',
    unique: true
  },
  support: {
    key: 'support',
    label: 'Support / Logiciels',
    description: 'Mise à disposition de logiciel, divers',
    color: 'amber',
    modes: ['pourcentage', 'montant'],
    defaultMode: 'pourcentage',
    unique: false
  }
};

/** Liste ordonnée des clés d'axes */
export const AXE_KEYS = Object.keys(AXE_DEFINITIONS);

/**
 * Classifie une ligne de facturation dans un axe d'augmentation.
 * L'ordre de vérification est important : accessoires avant social générique.
 *
 * @param {Object} ligne - Ligne de facturation (abonnements_lignes)
 * @param {string} ligne.label
 * @param {string} ligne.famille
 * @param {number} ligne.quantite
 * @param {string} modeFacturationSocial - 'forfait' ou 'reel'
 * @returns {AxeAugmentation|null} Axe ou null si non classifiable
 */
export function classifierLigne(ligne, modeFacturationSocial) {
  const label = (ligne.label || '').toLowerCase();
  const famille = ligne.famille || '';
  const quantite = ligne.quantite || 1;

  // Axe 2 : Bilan (vérifié avant compta pour éviter collision)
  if (label.includes('bilan')) {
    return 'bilan';
  }

  // Axe 3 : P&L / Etat de gestion
  if (label.includes('p&l') || label.includes('gestion')) {
    return 'pl';
  }

  // Axe 1 : Compta mensuelle
  if (label.includes('comptab') || label.includes('surveillance')) {
    return 'compta_mensuelle';
  }

  // Axe 5 : Accessoires social (vérifié AVANT social forfait/bulletin)
  if (
    label.includes('coffre-fort') || label.includes('coffre fort') ||
    label.includes('publi-postage') || label.includes('publipostage') ||
    label.includes('entrée') || label.includes('entree') ||
    label.includes('sortie') ||
    label.includes('extra') ||
    label.includes('modification de bulletin')
  ) {
    return 'accessoires_social';
  }

  // Axes 3/4 : Social — classification PAR LIGNE (pas par mode client global)
  // Le mode client global causait des faux positifs : si un client avait une seule ligne
  // "au bulletin", TOUTES ses lignes sociales étaient classées bulletin,
  // y compris les vrais forfaits → multiplication Silae erronée → CA gonflé.
  if (famille === 'social') {
    // Critère 1 : le label contient "bulletin" → c'est du bulletin
    // Ex: "Etablissement du bulletin de salaire"
    if (label.includes('bulletin')) {
      return 'social_bulletin';
    }
    // Critère 2 : le label contient "forfait" → c'est du forfait
    // Ex: "Forfait social", "Mission du social au forfait"
    if (label.includes('forfait')) {
      return 'social_forfait';
    }
    // Critère 3 : quantité > 1 → c'est du bulletin (plusieurs bulletins)
    if (quantite > 1) {
      return 'social_bulletin';
    }
    // Critère 4 : prix unitaire < seuil → bulletin
    const montantHt = ligne.montant_ht || 0;
    const prixUnitaire = quantite > 0 ? montantHt / quantite : montantHt;
    if (prixUnitaire > 0 && prixUnitaire < SEUIL_PRIX_BULLETIN) {
      return 'social_bulletin';
    }
    // Par défaut → forfait (plus sûr : pas de multiplication Silae)
    return 'social_forfait';
  }

  // Axe 7 : Juridique
  if (famille === 'juridique') {
    return 'juridique';
  }

  // Axe 8 : Support / Logiciels
  if (famille === 'support') {
    return 'support';
  }

  // Non classifié (ne sera pas augmenté)
  return null;
}

/** Seuil prix unitaire HT en-dessous duquel une ligne social est considérée "au bulletin" */
const SEUIL_PRIX_BULLETIN = 30;

/**
 * Détermine le multiplicateur d'un accessoire par rapport au prix unitaire d'un bulletin.
 * - Modification de bulletin = 1× bulletin
 * - Enregistrement d'entrée = 1× bulletin
 * - Enregistrement d'entrée/sortie d'un extra = 1× bulletin
 * - Enregistrement de sortie = 2× bulletins
 * - Coffre-fort numérique = 1× bulletin
 * - Publi-postage = 1× bulletin
 *
 * @param {string} label - Label de la ligne
 * @returns {number} Multiplicateur (1 ou 2)
 */
export function getMultiplicateurAccessoire(label) {
  const l = (label || '').toLowerCase();
  // Sortie seule (pas "entrée / sortie d'un extra") = 2× bulletin
  if (l.includes('sortie') && !l.includes('entrée') && !l.includes('entree') && !l.includes('extra')) {
    return 2;
  }
  return 1;
}

/**
 * Détecte automatiquement le mode de facturation social d'un client
 * à partir de ses lignes de facturation.
 *
 * NOTE : Cette fonction est utilisée pour l'AFFICHAGE du mode client uniquement.
 * La classification des lignes individuelles se fait directement dans classifierLigne()
 * sur la base du label, de la quantité et du prix unitaire de CHAQUE ligne.
 *
 * Un client peut avoir les deux modes (forfait + bulletin) simultanément.
 * Le mode retourné ici indique le mode DOMINANT pour l'affichage.
 *
 * Règles :
 * 1. Si une ligne social a "bulletin" dans le label → le client a du bulletin
 * 2. Si une ligne social a quantité > 1 → le client a du bulletin
 * 3. Si une ligne social a un prix unitaire < 30€ → le client a du bulletin
 * 4. Sinon → forfait uniquement
 *
 * @param {Object[]} lignes - Lignes de facturation du client
 * @returns {'forfait'|'reel'} Mode détecté (BDD constraint: forfait ou reel uniquement)
 */
export function detectModeFacturationSocial(lignes) {
  for (const ligne of lignes) {
    const famille = (ligne.famille || '').toLowerCase();
    if (famille !== 'social') continue;

    const label = (ligne.label || '').toLowerCase();
    const quantite = ligne.quantite || 1;
    const montantHt = ligne.montant_ht || 0;

    // Exclure les accessoires (coffre-fort, publi-postage, etc.)
    if (label.includes('coffre') || label.includes('publi') ||
        label.includes('entrée') || label.includes('entree') ||
        label.includes('sortie') || label.includes('extra') ||
        label.includes('modification')) {
      continue;
    }

    // Critère 1 : le label contient "bulletin" → c'est du bulletin
    if (label.includes('bulletin')) {
      return 'reel';
    }

    // Critère 2 : quantité > 1 → forcément du bulletin
    if (quantite > 1) {
      return 'reel';
    }

    // Critère 3 : prix unitaire < 30€ → prix au bulletin
    const prixUnitaire = quantite > 0 ? montantHt / quantite : montantHt;
    if (prixUnitaire > 0 && prixUnitaire < SEUIL_PRIX_BULLETIN) {
      return 'reel';
    }
  }
  return 'forfait';
}

/**
 * @typedef {Object} LigneClassifiee
 * @property {number} ligne_id
 * @property {number} abonnement_id
 * @property {number} pennylane_subscription_id
 * @property {number} client_id
 * @property {string} client_nom
 * @property {string} client_cabinet
 * @property {string} label
 * @property {string} famille
 * @property {number} quantite
 * @property {number} montant_ht
 * @property {number} montant_ttc
 * @property {string} frequence
 * @property {number} intervalle
 * @property {string} status
 * @property {string} mode_facturation_social
 * @property {string} [description] - Description de la ligne (ex: "Hôtel", "Restaurant")
 * @property {AxeAugmentation|null} axe
 */

/**
 * Classifie toutes les lignes de facturation de tous les abonnements.
 * Détecte aussi le mode_facturation_social pour chaque client.
 *
 * @param {Object[]} honoraires - Données de getHonorairesResume()
 * @param {Object[]} clients - Liste des clients de la BDD
 * @returns {{ lignes: LigneClassifiee[], modesDetectes: Map<number, string> }}
 */
export function classifierToutesLesLignes(honoraires, clients) {
  // Regrouper les lignes par client pour détecter le mode
  const lignesParClient = new Map();
  for (const abo of honoraires) {
    const clientId = abo.client_id;
    if (!lignesParClient.has(clientId)) {
      lignesParClient.set(clientId, []);
    }
    for (const ligne of (abo.abonnements_lignes || [])) {
      lignesParClient.get(clientId).push(ligne);
    }
  }

  // Toujours détecter le mode depuis les lignes de facturation (prix unitaire)
  // Ne pas faire confiance à la valeur BDD qui peut être obsolète
  const clientModes = new Map();
  const modesDetectes = new Map();
  for (const [clientId, lignes] of lignesParClient) {
    const detected = detectModeFacturationSocial(lignes);
    clientModes.set(clientId, detected);

    // Signaler comme "à persister" si différent de la valeur BDD
    const client = clients.find(c => c.id === clientId);
    if (!client?.mode_facturation_social || client.mode_facturation_social !== detected) {
      modesDetectes.set(clientId, detected);
    }
  }

  // Classifier chaque ligne sans dédoublonnage.
  // Le diagnostic signale les doublons potentiels — c'est l'utilisateur qui corrige dans Pennylane.
  const result = [];

  for (const abo of honoraires) {
    const clientId = abo.client_id;
    const clientNom = abo.clients?.nom || abo.label || '';
    const clientCabinet = abo.clients?.cabinet || '-';
    const modeSocial = clientModes.get(clientId) || 'forfait';

    for (const ligne of (abo.abonnements_lignes || [])) {
      const axe = classifierLigne(ligne, modeSocial);

      result.push({
        ligne_id: ligne.id,
        abonnement_id: abo.id,
        pennylane_subscription_id: abo.pennylane_subscription_id,
        client_id: clientId,
        client_nom: clientNom,
        client_cabinet: clientCabinet,
        label: ligne.label,
        famille: ligne.famille,
        quantite: ligne.quantite || 1,
        montant_ht: ligne.montant_ht || 0,
        montant_ttc: ligne.montant_ttc || 0,
        frequence: abo.frequence,
        intervalle: abo.intervalle || 1,
        status: abo.status,
        mode_facturation_social: modeSocial,
        description: ligne.description || '',
        axe
      });
    }
  }

  return { lignes: result, modesDetectes };
}
