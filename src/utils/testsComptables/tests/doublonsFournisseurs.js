// @ts-check

/**
 * @file Test de détection des doublons fournisseurs
 * Détecte les comptes 401 qui semblent correspondre au même fournisseur
 * Utilise l'API /ledger_accounts de Pennylane (plan comptable)
 */

/**
 * Normalise une chaîne pour la comparaison
 * - Convertit en minuscules
 * - Supprime les accents
 * - Supprime les caractères spéciaux
 * - Supprime les espaces multiples
 * @param {string} str - Chaîne à normaliser
 * @returns {string} Chaîne normalisée
 */
function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/[^a-z0-9\s]/g, ' ')    // Remplace les caractères spéciaux par des espaces
    .replace(/\s+/g, ' ')             // Supprime les espaces multiples
    .trim();
}

/**
 * Extrait les mots significatifs d'une chaîne (longueur >= 3)
 * Exclut les mots génériques courants
 * @param {string} str - Chaîne source
 * @returns {string[]} Liste des mots
 */
function extractWords(str) {
  const normalized = normalizeString(str);
  // Mots à exclure car trop génériques (formes juridiques, mots courants)
  const excludeWords = new Set([
    // Formes juridiques
    'sas', 'sarl', 'eurl', 'sci', 'sasu', 'snc', 'scp', 'scea',
    'ste', 'societe', 'ets', 'etablissements', 'etablissement',
    // Mots courants
    'france', 'paris', 'services', 'service', 'group', 'groupe',
    'fournisseur', 'fournisseurs', 'client', 'clients',
    // Mots trop génériques pour la comparaison
    'maison', 'chateau', 'domaine', 'les', 'des', 'aux', 'fils',
    'cie', 'and', 'the', 'international', 'distribution', 'net'
  ]);
  return normalized
    .split(' ')
    .filter(word => word.length >= 3 && !excludeWords.has(word));
}

/**
 * Calcule la distance de Levenshtein entre deux chaînes
 * @param {string} a - Première chaîne
 * @param {string} b - Deuxième chaîne
 * @returns {number} Distance
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // suppression
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calcule un score de similarité entre deux chaînes (0 à 1)
 * @param {string} a - Première chaîne
 * @param {string} b - Deuxième chaîne
 * @returns {number} Score de similarité (1 = identique)
 */
function similarityScore(a, b) {
  const normA = normalizeString(a);
  const normB = normalizeString(b);

  if (normA === normB) return 1;
  if (!normA || !normB) return 0;

  const maxLen = Math.max(normA.length, normB.length);
  const distance = levenshteinDistance(normA, normB);

  return 1 - (distance / maxLen);
}

/**
 * Vérifie si deux comptes partagent des mots communs significatifs
 * @param {string} label1 - Premier libellé
 * @param {string} label2 - Deuxième libellé
 * @returns {{hasCommon: boolean, commonWords: string[]}} Résultat
 */
function findCommonWords(label1, label2) {
  const words1 = new Set(extractWords(label1));
  const words2 = new Set(extractWords(label2));

  const commonWords = [...words1].filter(word => words2.has(word));

  return {
    hasCommon: commonWords.length > 0,
    commonWords
  };
}

/**
 * Définition du test de doublons fournisseurs
 * @type {import('../../../types').TestDefinition}
 */
export const doublonsFournisseurs = {
  code: 'doublons_fournisseurs',
  nom: 'Doublons fournisseurs',
  description: 'Détecte des comptes 401 similaires (ex: 401DARTY vs 401100059 DARTY GRAND EST)',
  requiredData: ['ledgerAccounts'],

  /**
   * Exécute le test de détection des doublons
   * @param {Object} params - Paramètres d'exécution
   * @param {Object[]} params.ledgerAccounts - Liste des comptes du plan comptable
   * @param {Object} [params.options] - Options du test
   * @param {number} [params.options.seuilSimilarite=0.6] - Seuil de similarité (0-1)
   * @returns {Promise<{anomalies: import('../../../types').TestResultAnomalie[], donneesAnalysees: Object}>}
   */
  async execute({ ledgerAccounts, options = {} }) {
    const seuilSimilarite = options.seuilSimilarite || 0.6;
    /** @type {import('../../../types').TestResultAnomalie[]} */
    const anomalies = [];

    // Filtrer les comptes 401 (fournisseurs)
    const comptes401 = ledgerAccounts
      .filter(acc => acc.number && acc.number.startsWith('401'))
      .map(acc => ({
        id: acc.id,
        numero: acc.number,
        libelle: acc.label || ''
      }));

    // Comparer chaque paire de comptes
    const doublonsPotentiels = [];

    for (let i = 0; i < comptes401.length; i++) {
      for (let j = i + 1; j < comptes401.length; j++) {
        const compte1 = comptes401[i];
        const compte2 = comptes401[j];

        // Calculer la similarité des libellés
        const similarity = similarityScore(compte1.libelle, compte2.libelle);

        // Chercher les mots communs significatifs
        const { hasCommon, commonWords } = findCommonWords(compte1.libelle, compte2.libelle);

        // Détecter un doublon potentiel
        // Critères:
        // - Similarité >= 60% ET au moins 1 mot commun significatif
        // - OU au moins 1 mot commun significatif (quelque soit la similarité)
        const hasSignificantCommonWord = hasCommon && commonWords.length >= 1;
        const isDoublon = hasSignificantCommonWord;

        if (isDoublon) {
          doublonsPotentiels.push({
            compte1,
            compte2,
            similarity,
            commonWords,
            raison: `Mots communs: ${commonWords.join(', ')}${similarity >= seuilSimilarite ? ` (similarité ${Math.round(similarity * 100)}%)` : ''}`
          });
        }
      }
    }

    // Créer les anomalies
    for (const doublon of doublonsPotentiels) {
      // Déterminer la sévérité selon la similarité
      /** @type {import('../../../types').SeveriteAnomalie} */
      let severite = 'info';
      if (doublon.similarity >= 0.9) {
        severite = 'error';
      } else if (doublon.similarity >= 0.7 || doublon.commonWords.length >= 2) {
        severite = 'warning';
      }

      anomalies.push({
        type_anomalie: 'doublon_fournisseur',
        severite,
        donnees: {
          compte1: {
            numero: doublon.compte1.numero,
            libelle: doublon.compte1.libelle,
            auxiliaire: ''
          },
          compte2: {
            numero: doublon.compte2.numero,
            libelle: doublon.compte2.libelle,
            auxiliaire: ''
          },
          similarite: Math.round(doublon.similarity * 100),
          motsCommuns: doublon.commonWords
        },
        commentaire: `Doublon potentiel détecté: ${doublon.raison}. ` +
          `${doublon.compte1.numero} (${doublon.compte1.libelle}) vs ` +
          `${doublon.compte2.numero} (${doublon.compte2.libelle})`
      });
    }

    // Retourner les anomalies ET les données analysées pour permettre l'export
    return {
      anomalies,
      donneesAnalysees: {
        type: 'fournisseurs',
        fournisseurs: comptes401.map(c => ({
          compte: c.numero,
          libelle: c.libelle,
          compteAuxiliaire: '',
          libelleAuxiliaire: '',
          nbEcritures: 0,
          totalDebit: 0,
          totalCredit: 0
        })),
        nbFournisseurs: comptes401.length,
        nbComparaisons: (comptes401.length * (comptes401.length - 1)) / 2,
        seuilSimilarite: seuilSimilarite * 100
      }
    };
  }
};

export default doublonsFournisseurs;
