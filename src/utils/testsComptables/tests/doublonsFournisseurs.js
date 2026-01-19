// @ts-check

/**
 * @file Test de détection des doublons fournisseurs
 * Détecte les comptes 401 qui semblent correspondre au même fournisseur
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
 * @param {string} str - Chaîne source
 * @returns {string[]} Liste des mots
 */
function extractWords(str) {
  const normalized = normalizeString(str);
  return normalized.split(' ').filter(word => word.length >= 3);
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
 * Extrait le nom du fournisseur du numéro de compte ou du libellé
 * @param {string} compteNum - Numéro de compte (ex: "401ORANGE")
 * @param {string} compteLib - Libellé du compte
 * @returns {string} Nom extrait
 */
function extractSupplierName(compteNum, compteLib) {
  // Si le compte contient un nom après 401 (ex: 401ORANGE, 401Forange)
  const numMatch = compteNum.match(/^401[0-9]*([A-Za-z].*)$/i);
  if (numMatch && numMatch[1]) {
    return numMatch[1];
  }

  // Sinon utiliser le libellé
  return compteLib || compteNum;
}

/**
 * Définition du test de doublons fournisseurs
 * @type {import('../../../types').TestDefinition}
 */
export const doublonsFournisseurs = {
  code: 'doublons_fournisseurs',
  nom: 'Doublons fournisseurs',
  description: 'Détecte des comptes 401 similaires (ex: 401Forange vs 401005456 avec libellé Orange)',
  requiredData: ['fec'],

  /**
   * Exécute le test de détection des doublons
   * @param {Object} params - Paramètres d'exécution
   * @param {import('../../../types').FECEntry[]} params.fec - Données FEC
   * @param {Object} [params.options] - Options du test
   * @param {number} [params.options.seuilSimilarite=0.6] - Seuil de similarité (0-1)
   * @returns {Promise<import('../../../types').TestResultAnomalie[]>} Anomalies détectées
   */
  async execute({ fec, options = {} }) {
    const seuilSimilarite = options.seuilSimilarite || 0.6;
    /** @type {import('../../../types').TestResultAnomalie[]} */
    const anomalies = [];

    // Extraire les comptes 401 uniques
    const comptes401Map = new Map();

    for (const entry of fec) {
      const compteNum = entry.CompteNum || '';
      if (compteNum.startsWith('401')) {
        if (!comptes401Map.has(compteNum)) {
          comptes401Map.set(compteNum, {
            compteNum,
            compteLib: entry.CompteLib || '',
            compAuxNum: entry.CompAuxNum || '',
            compAuxLib: entry.CompAuxLib || '',
            nbEcritures: 0,
            totalDebit: 0,
            totalCredit: 0
          });
        }
        const compte = comptes401Map.get(compteNum);
        compte.nbEcritures++;
        compte.totalDebit += entry.Debit || 0;
        compte.totalCredit += entry.Credit || 0;
      }
    }

    const comptes401 = Array.from(comptes401Map.values());

    // Comparer chaque paire de comptes
    const doublonsPotentiels = [];

    for (let i = 0; i < comptes401.length; i++) {
      for (let j = i + 1; j < comptes401.length; j++) {
        const compte1 = comptes401[i];
        const compte2 = comptes401[j];

        // Extraire les noms de fournisseurs
        const nom1 = extractSupplierName(compte1.compteNum, compte1.compteLib);
        const nom2 = extractSupplierName(compte2.compteNum, compte2.compteLib);

        // Calculer la similarité
        const similarity = similarityScore(nom1, nom2);

        // Vérifier les mots communs
        const { hasCommon, commonWords } = findCommonWords(
          `${compte1.compteLib} ${compte1.compAuxLib}`,
          `${compte2.compteLib} ${compte2.compAuxLib}`
        );

        // Détecter un doublon potentiel
        const isDoublon = similarity >= seuilSimilarite || (hasCommon && commonWords.length >= 1);

        if (isDoublon) {
          doublonsPotentiels.push({
            compte1,
            compte2,
            similarity,
            commonWords,
            raison: similarity >= seuilSimilarite
              ? `Similarité élevée (${Math.round(similarity * 100)}%)`
              : `Mots communs: ${commonWords.join(', ')}`
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
            numero: doublon.compte1.compteNum,
            libelle: doublon.compte1.compteLib,
            auxiliaire: doublon.compte1.compAuxLib,
            nbEcritures: doublon.compte1.nbEcritures,
            totalDebit: doublon.compte1.totalDebit,
            totalCredit: doublon.compte1.totalCredit
          },
          compte2: {
            numero: doublon.compte2.compteNum,
            libelle: doublon.compte2.compteLib,
            auxiliaire: doublon.compte2.compAuxLib,
            nbEcritures: doublon.compte2.nbEcritures,
            totalDebit: doublon.compte2.totalDebit,
            totalCredit: doublon.compte2.totalCredit
          },
          similarite: Math.round(doublon.similarity * 100),
          motsCommuns: doublon.commonWords
        },
        commentaire: `Doublon potentiel détecté: ${doublon.raison}. ` +
          `${doublon.compte1.compteNum} (${doublon.compte1.compteLib}) vs ` +
          `${doublon.compte2.compteNum} (${doublon.compte2.compteLib})`
      });
    }

    return anomalies;
  }
};

export default doublonsFournisseurs;
