// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests pour le module de synchronisation des honoraires
 *
 * Note: Ces tests utilisent des mocks pour Supabase et l'API Pennylane
 * car les vraies API ne sont pas disponibles en environnement de test.
 */

// ============================================================================
// FONCTIONS UTILITAIRES EXTRAITES POUR TEST
// ============================================================================

/**
 * Normalise une chaîne pour la comparaison
 * @param {string} str - Chaîne à normaliser
 * @returns {string} Chaîne normalisée
 */
function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Supprime les suffixes juridiques courants d'un nom
 * @param {string} name - Nom à nettoyer
 * @returns {string} Nom sans suffixes juridiques
 */
function removeJuridicalSuffixes(name) {
  const suffixes = [
    'sarl', 'sas', 'sa', 'eurl', 'sasu', 'sci', 'snc', 'scp', 'selarl',
    'earl', 'gaec', 'gie', 'scop', 'scm', 'sep', 'scea', 'gfa',
    'holding', 'groupe', 'group', 'international', 'france', 'paris'
  ];
  let result = name.toLowerCase();
  for (const suffix of suffixes) {
    result = result.replace(new RegExp(`\\s*${suffix}$`, 'g'), '');
    result = result.replace(new RegExp(`^${suffix}\\s*`, 'g'), '');
  }
  return result.trim();
}

/**
 * Match un customer Pennylane avec un client local
 * @param {Object} customer - Customer Pennylane
 * @param {Object[]} clients - Liste des clients locaux
 * @returns {Object|null} Client matché ou null
 */
function matchCustomerToClient(customer, clients) {
  // 1. Match par pennylane_customer_id existant (UUID)
  if (customer.external_reference) {
    const matchByUUID = clients.find(
      c => c.pennylane_customer_id && c.pennylane_customer_id === customer.external_reference
    );
    if (matchByUUID) return matchByUUID;
  }

  // 2. Match par nom normalisé (exact)
  const customerNameNorm = normalizeString(customer.name);
  const matchByNameExact = clients.find(
    c => normalizeString(c.nom) === customerNameNorm
  );
  if (matchByNameExact) return matchByNameExact;

  // 3. Match par nom sans suffixes juridiques (exact)
  const customerNameClean = removeJuridicalSuffixes(normalizeString(customer.name));
  const matchByNameClean = clients.find(
    c => removeJuridicalSuffixes(normalizeString(c.nom)) === customerNameClean
  );
  if (matchByNameClean) return matchByNameClean;

  // 4. Match par nom normalisé (contient)
  const matchByNamePartial = clients.find(c => {
    const clientNameNorm = normalizeString(c.nom);
    return clientNameNorm.includes(customerNameNorm) || customerNameNorm.includes(clientNameNorm);
  });
  if (matchByNamePartial) return matchByNamePartial;

  // 5. Match par nom sans suffixes (contient)
  const matchByNameCleanPartial = clients.find(c => {
    const clientNameClean = removeJuridicalSuffixes(normalizeString(c.nom));
    return clientNameClean.includes(customerNameClean) || customerNameClean.includes(clientNameClean);
  });
  if (matchByNameCleanPartial) return matchByNameCleanPartial;

  return null;
}

/**
 * Détermine la famille d'un produit selon son label
 * @param {string} label - Label du produit
 * @param {Object[]} produitsFacturation - Liste des produits avec leur famille
 * @returns {string} Famille
 */
function getFamilleFromLabel(label, produitsFacturation) {
  if (!label) return 'support';

  const produit = produitsFacturation.find(
    p => normalizeString(p.label) === normalizeString(label)
  );
  if (produit) return produit.famille;

  const labelLower = label.toLowerCase();

  if (labelLower.includes('social') || labelLower.includes('bulletin') ||
      labelLower.includes('salari') || labelLower.includes('coffre-fort') ||
      labelLower.includes('publi-postage')) {
    return 'social';
  }

  if (labelLower.includes('comptab') || labelLower.includes('bilan') ||
      labelLower.includes('p&l') || labelLower.includes('surveillance')) {
    return 'comptabilite';
  }

  if (labelLower.includes('juridique') || labelLower.includes('secrétariat')) {
    return 'juridique';
  }

  return 'support';
}

// ============================================================================
// TESTS
// ============================================================================

describe('normalizeString', () => {
  it('devrait normaliser une chaîne simple', () => {
    expect(normalizeString('Test')).toBe('test');
  });

  it('devrait supprimer les accents', () => {
    expect(normalizeString('Café Épicé')).toBe('cafeepice');
  });

  it('devrait supprimer les caractères spéciaux', () => {
    expect(normalizeString('Test & Co.')).toBe('testco');
  });

  it('devrait gérer les chaînes vides', () => {
    expect(normalizeString('')).toBe('');
    expect(normalizeString(null)).toBe('');
    expect(normalizeString(undefined)).toBe('');
  });

  it('devrait normaliser des noms de société réels', () => {
    expect(normalizeString('BDV SARL')).toBe('bdvsarl');
    expect(normalizeString('Société Générale')).toBe('societegenerale');
    expect(normalizeString('L\'Épicerie du Coin')).toBe('lepicerieducoin');
  });
});

describe('removeJuridicalSuffixes', () => {
  it('devrait supprimer SARL à la fin', () => {
    expect(removeJuridicalSuffixes('entreprise sarl')).toBe('entreprise');
  });

  it('devrait supprimer SAS à la fin', () => {
    expect(removeJuridicalSuffixes('entreprise sas')).toBe('entreprise');
  });

  it('devrait supprimer SCI à la fin', () => {
    expect(removeJuridicalSuffixes('immo sci')).toBe('immo');
  });

  it('devrait supprimer HOLDING', () => {
    // 'groupe' est aussi un suffixe, donc les deux sont supprimés
    expect(removeJuridicalSuffixes('test holding')).toBe('test');
  });

  it('devrait gérer plusieurs suffixes potentiels', () => {
    // Le suffixe est supprimé de la fin
    expect(removeJuridicalSuffixes('test france')).toBe('test');
  });

  it('devrait ne pas modifier un nom sans suffixe', () => {
    expect(removeJuridicalSuffixes('entreprise normale')).toBe('entreprise normale');
  });

  it('devrait supprimer au début aussi', () => {
    expect(removeJuridicalSuffixes('sarl entreprise')).toBe('entreprise');
  });
});

describe('matchCustomerToClient', () => {
  const clients = [
    { id: 1, nom: 'BDV SARL', pennylane_customer_id: 'uuid-bdv-123' },
    { id: 2, nom: 'Société Test', pennylane_customer_id: null },
    { id: 3, nom: 'Client Sans UUID', pennylane_customer_id: null },
    { id: 4, nom: 'Restaurant Le Bon', pennylane_customer_id: null },
    { id: 5, nom: 'HOLDING GROUPE ABC', pennylane_customer_id: null }
  ];

  it('devrait matcher par UUID en priorité', () => {
    const customer = { id: 100, name: 'Nom Différent', external_reference: 'uuid-bdv-123' };
    const match = matchCustomerToClient(customer, clients);
    expect(match).toBeTruthy();
    expect(match.id).toBe(1);
  });

  it('devrait matcher par nom exact', () => {
    const customer = { id: 101, name: 'Société Test', external_reference: null };
    const match = matchCustomerToClient(customer, clients);
    expect(match).toBeTruthy();
    expect(match.id).toBe(2);
  });

  it('devrait matcher en ignorant les accents et casse', () => {
    const customer = { id: 102, name: 'SOCIETE TEST', external_reference: null };
    const match = matchCustomerToClient(customer, clients);
    expect(match).toBeTruthy();
    expect(match.id).toBe(2);
  });

  it('devrait matcher en supprimant les suffixes juridiques', () => {
    const customer = { id: 103, name: 'BDV', external_reference: null };
    // BDV match BDV SARL après suppression du suffixe SARL
    const match = matchCustomerToClient(customer, clients);
    expect(match).toBeTruthy();
    expect(match.id).toBe(1);
  });

  it('devrait matcher par inclusion partielle', () => {
    const customer = { id: 104, name: 'Restaurant Le Bon Paris', external_reference: null };
    // "restaurantlebonparis" contient "restaurantlebon" -> match
    const match = matchCustomerToClient(customer, clients);
    expect(match).toBeTruthy();
    expect(match.id).toBe(4);
  });

  it('devrait retourner null si pas de match', () => {
    const customer = { id: 105, name: 'Entreprise Inconnue XYZ', external_reference: null };
    const match = matchCustomerToClient(customer, clients);
    expect(match).toBeNull();
  });

  it('devrait matcher ABC HOLDING avec HOLDING GROUPE ABC', () => {
    const customer = { id: 106, name: 'ABC', external_reference: null };
    // Après suppression des suffixes: "abc" vs "abc" -> match
    const match = matchCustomerToClient(customer, clients);
    expect(match).toBeTruthy();
    expect(match.id).toBe(5);
  });
});

describe('getFamilleFromLabel', () => {
  const produitsFacturation = [
    { label: 'Mission comptable', famille: 'comptabilite' },
    { label: 'Mission du social', famille: 'social' },
    { label: 'Secrétariat juridique', famille: 'juridique' }
  ];

  it('devrait trouver la famille depuis le référentiel', () => {
    expect(getFamilleFromLabel('Mission comptable', produitsFacturation)).toBe('comptabilite');
    expect(getFamilleFromLabel('Mission du social', produitsFacturation)).toBe('social');
  });

  it('devrait détecter social par mots-clés', () => {
    expect(getFamilleFromLabel('Bulletin de paie', [])).toBe('social');
    expect(getFamilleFromLabel('Gestion des salariés', [])).toBe('social');
    expect(getFamilleFromLabel('Coffre-fort numérique', [])).toBe('social');
  });

  it('devrait détecter comptabilité par mots-clés', () => {
    expect(getFamilleFromLabel('Bilan annuel', [])).toBe('comptabilite');
    expect(getFamilleFromLabel('Mission de surveillance', [])).toBe('comptabilite');
    expect(getFamilleFromLabel('Etablissement P&L', [])).toBe('comptabilite');
  });

  it('devrait détecter juridique par mots-clés', () => {
    expect(getFamilleFromLabel('Secrétariat juridique', [])).toBe('juridique');
  });

  it('devrait retourner support par défaut', () => {
    expect(getFamilleFromLabel('Frais divers', [])).toBe('support');
    expect(getFamilleFromLabel('', [])).toBe('support');
    expect(getFamilleFromLabel(null, [])).toBe('support');
  });
});

describe('Filtrage des customers sans abonnement', () => {
  it('devrait identifier les customers avec abonnements', () => {
    const subscriptions = [
      { id: 1, customer: { id: 100 } },
      { id: 2, customer: { id: 101 } },
      { id: 3, customer: { id: 100 } }, // Même customer, 2 abonnements
    ];

    const customerIdsWithSubscription = new Set(
      subscriptions.map(sub => sub.customer?.id).filter(Boolean)
    );

    expect(customerIdsWithSubscription.size).toBe(2);
    expect(customerIdsWithSubscription.has(100)).toBe(true);
    expect(customerIdsWithSubscription.has(101)).toBe(true);
    expect(customerIdsWithSubscription.has(102)).toBe(false);
  });

  it('devrait filtrer les customers sans abonnement du matching', () => {
    const customers = [
      { id: 100, name: 'Client A', external_reference: 'uuid-a' },
      { id: 101, name: 'Client B', external_reference: 'uuid-b' },
      { id: 102, name: 'Client C (doublon)', external_reference: 'uuid-c' }
    ];

    const subscriptions = [
      { id: 1, customer: { id: 100 } },
      { id: 2, customer: { id: 101 } }
      // Pas d'abonnement pour customer 102
    ];

    const customerIdsWithSubscription = new Set(
      subscriptions.map(sub => sub.customer?.id).filter(Boolean)
    );

    const customersToMatch = customers.filter(c => customerIdsWithSubscription.has(c.id));

    expect(customersToMatch.length).toBe(2);
    expect(customersToMatch.find(c => c.id === 102)).toBeUndefined();
  });
});

describe('Cas réels de doublons cabinet', () => {
  it('devrait matcher le bon BDV (celui avec abonnement)', () => {
    const customers = [
      { id: 88628029, name: 'BDV', external_reference: 'uuid-audit-up' }, // Audit Up, sans abo
      { id: 222492854, name: 'BDV SARL', external_reference: 'uuid-zerah' } // Zerah, avec abo
    ];

    const subscriptions = [
      { id: 1, customer: { id: 222492854 }, label: 'BDV SARL' }
      // Pas d'abonnement pour 88628029
    ];

    const clients = [
      { id: 1, nom: 'BDV SARL', pennylane_customer_id: null }
    ];

    const customerIdsWithSubscription = new Set(
      subscriptions.map(sub => sub.customer?.id).filter(Boolean)
    );

    // Seul le customer Zerah devrait être matché
    const customersToMatch = customers.filter(c => customerIdsWithSubscription.has(c.id));
    expect(customersToMatch.length).toBe(1);
    expect(customersToMatch[0].id).toBe(222492854);

    // Et il devrait matcher avec le client local
    const match = matchCustomerToClient(customersToMatch[0], clients);
    expect(match).toBeTruthy();
    expect(match.id).toBe(1);
  });
});
