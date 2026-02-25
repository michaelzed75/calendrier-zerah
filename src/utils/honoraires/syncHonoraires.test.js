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
  // 1. SIREN (CLÉ UNIVERSELLE, prioritaire) — identifiant officiel INSEE
  if (customer.reg_no) {
    const sirenClean = customer.reg_no.replace(/\s/g, '').trim();
    if (sirenClean && /^\d{9}$/.test(sirenClean)) {
      const candidates = clients.filter(c => c.siren && c.siren === sirenClean);
      if (candidates.length === 1) {
        return candidates[0];
      }
      if (candidates.length > 1 && customer.external_reference) {
        // SIREN ambigu → UUID pour désambiguïser
        const uuidMatch = candidates.find(c => c.pennylane_customer_id === customer.external_reference);
        if (uuidMatch) return uuidMatch;
      }
    }
  }

  // 2. Match par pennylane_customer_id existant (UUID) — fallback
  if (customer.external_reference) {
    const matchByUUID = clients.find(
      c => c.pennylane_customer_id && c.pennylane_customer_id === customer.external_reference
    );
    if (matchByUUID) return matchByUUID;
  }

  // 3. Match par nom normalisé (exact)
  const customerNameNorm = normalizeString(customer.name);
  const matchByNameExact = clients.find(
    c => normalizeString(c.nom) === customerNameNorm
  );
  if (matchByNameExact) return matchByNameExact;

  // 4. Match par nom sans suffixes juridiques (exact)
  const customerNameClean = removeJuridicalSuffixes(normalizeString(customer.name));
  const matchByNameClean = clients.find(
    c => removeJuridicalSuffixes(normalizeString(c.nom)) === customerNameClean
  );
  if (matchByNameClean) return matchByNameClean;

  // 5. Match par nom normalisé (contient)
  const matchByNamePartial = clients.find(c => {
    const clientNameNorm = normalizeString(c.nom);
    return clientNameNorm.includes(customerNameNorm) || customerNameNorm.includes(clientNameNorm);
  });
  if (matchByNamePartial) return matchByNamePartial;

  // 6. Match par nom sans suffixes (contient)
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
    { id: 1, nom: 'BDV SARL', pennylane_customer_id: 'uuid-bdv-123', siren: '123456789' },
    { id: 2, nom: 'Société Test', pennylane_customer_id: null, siren: '987654321' },
    { id: 3, nom: 'Client Sans UUID', pennylane_customer_id: null, siren: null },
    { id: 4, nom: 'Restaurant Le Bon', pennylane_customer_id: null, siren: '555666777' },
    { id: 5, nom: 'HOLDING GROUPE ABC', pennylane_customer_id: null, siren: null }
  ];

  it('devrait matcher par SIREN en priorité', () => {
    const customer = { id: 100, name: 'Nom Différent', external_reference: null, reg_no: '987654321' };
    const match = matchCustomerToClient(customer, clients);
    expect(match).toBeTruthy();
    expect(match.id).toBe(2);
  });

  it('devrait matcher par UUID en fallback', () => {
    const customer = { id: 100, name: 'Nom Différent', external_reference: 'uuid-bdv-123', reg_no: '' };
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

// ============================================================================
// CAS RÉELS — FAUX POSITIFS PAR NOM (bugs rencontrés en production)
// ============================================================================

describe('Faux positifs par nom — cas réels de production', () => {
  it('NE devrait PAS matcher LM avec FERIA CAFE GILBERT DELMAS (inclusion "lm" dans "delmas")', () => {
    // Bug réel : "lm" (normalisé) est contenu dans "gilbertdelmas" → faux positif niveau 5/6
    // La solution : le SIREN empêche ce faux match
    const clients = [
      { id: 189, nom: 'FERIA CAFE GILBERT DELMAS', pennylane_customer_id: null, siren: '492321757' },
      { id: 56, nom: 'LM', pennylane_customer_id: 'uuid-lm', siren: '849866504' }
    ];
    const customer = { id: 300, name: 'LM', external_reference: 'uuid-lm', reg_no: '849866504' };
    const match = matchCustomerToClient(customer, clients);
    // Doit matcher par SIREN avec LM (id 56), PAS par inclusion de nom avec FERIA CAFE
    expect(match).toBeTruthy();
    expect(match.id).toBe(56);
  });

  it('FAUX POSITIF DOCUMENTÉ : GILBERT DELMAS matche LM par inclusion de nom (sans SIREN)', () => {
    // Bug réel : sans SIREN sur le customer, le matching tombe en fallback nom
    // "gilbertdelmas" contient "lm" → faux positif niveau 5 (name_partial)
    // C'est pourquoi renseigner le SIREN sur Pennylane est INDISPENSABLE
    const clients = [
      { id: 56, nom: 'LM', pennylane_customer_id: null, siren: '849866504' }
    ];
    const customer = { id: 301, name: 'GILBERT DELMAS', external_reference: null, reg_no: '492321757' };
    const match = matchCustomerToClient(customer, clients);
    // Pas de client avec SIREN 492321757 → tombe en matching nom → faux positif
    expect(match).toBeTruthy(); // Faux positif connu
    expect(match.id).toBe(56);
  });

  it('le matching par nom partiel EST dangereux pour les noms courts (documentation)', () => {
    // Sans SIREN, "lm" est contenu dans "gilbertdelmas" → faux positif
    const clients = [
      { id: 56, nom: 'LM', pennylane_customer_id: null, siren: null }
    ];
    const customer = { id: 302, name: 'GILBERT DELMAS', external_reference: null, reg_no: '' };
    const match = matchCustomerToClient(customer, clients);
    // ATTENTION : ceci est un faux positif connu ! Le matching partiel matche "lm" ⊂ "gilbertdelmas"
    // C'est pourquoi le SIREN est INDISPENSABLE pour les noms courts
    expect(match).toBeTruthy(); // Malheureusement, sans SIREN, ça matche
    expect(match.id).toBe(56); // Faux positif documenté
  });
});

describe('SIREN ambigu — plusieurs établissements même SIREN (syncHonoraires)', () => {
  const clientsMultiEtab = [
    { id: 109, nom: 'RELAIS CHRISTINE', siren: '387571789', pennylane_customer_id: 'uuid-relais-au' },
    { id: 203, nom: 'SAINT JAMES', siren: '387571789', pennylane_customer_id: 'uuid-stjames-au' },
    { id: 50, nom: 'AUTRE CLIENT', siren: '111222333', pennylane_customer_id: null }
  ];

  it('devrait désambiguïser par UUID quand SIREN matche 2 clients', () => {
    const customer = { id: 400, name: 'CHRISTINE-RELAIS', external_reference: 'uuid-relais-au', reg_no: '387571789' };
    const match = matchCustomerToClient(customer, clientsMultiEtab);
    expect(match).toBeTruthy();
    expect(match.id).toBe(109);
  });

  it('devrait matcher le 2e établissement correctement', () => {
    const customer = { id: 401, name: 'CHRISTINE-SAINT JAMES', external_reference: 'uuid-stjames-au', reg_no: '387571789' };
    const match = matchCustomerToClient(customer, clientsMultiEtab);
    expect(match).toBeTruthy();
    expect(match.id).toBe(203);
  });

  it('devrait tomber en fallback nom si SIREN ambigu sans UUID', () => {
    const customer = { id: 402, name: 'CHRISTINE INCONNU', external_reference: null, reg_no: '387571789' };
    const match = matchCustomerToClient(customer, clientsMultiEtab);
    // SIREN ambigu (2 candidats) + pas d'UUID → ne peut pas désambiguïser par SIREN
    // Tombe en fallback nom : "christineinconnu" contient "christine" ⊂ "relaischristine" → match partiel
    // Ce comportement est risqué mais acceptable pour la sync (découverte)
    // La réconciliation NE fait PAS de matching par nom et retournerait null
    expect(match).toBeNull(); // Aucun matching par nom exact → "christineinconnu" ≠ nom exact
  });

  it('devrait matcher SIREN unique directement sans UUID', () => {
    const customer = { id: 403, name: 'AUTRE', external_reference: null, reg_no: '111222333' };
    const match = matchCustomerToClient(customer, clientsMultiEtab);
    expect(match).toBeTruthy();
    expect(match.id).toBe(50);
  });
});
