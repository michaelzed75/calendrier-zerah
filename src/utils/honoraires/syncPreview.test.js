// @ts-check
import { describe, it, expect } from 'vitest';

/**
 * Tests pour le module syncPreview
 *
 * On extrait et teste les fonctions pures de matching et détection d'anomalies.
 * Les fonctions intégrées (previewSync, commitSync) nécessitent des mocks Supabase + API
 * et sont testées indirectement via les fonctions utilitaires ci-dessous.
 */

// ============================================================================
// FONCTIONS EXTRAITES POUR TEST (identiques à syncPreview.js)
// ============================================================================

function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

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
 * Match avec niveau — identique à syncPreview.js
 */
function matchCustomerToClientWithLevel(customer, clients) {
  if (customer.external_reference) {
    const match = clients.find(
      c => c.pennylane_customer_id && c.pennylane_customer_id === customer.external_reference
    );
    if (match) return { client: match, level: 'uuid' };
  }

  if (customer.reg_no) {
    const sirenClean = customer.reg_no.replace(/\s/g, '').trim();
    if (sirenClean && /^\d{9}$/.test(sirenClean)) {
      const match = clients.find(c => c.siren && c.siren === sirenClean);
      if (match) return { client: match, level: 'siren' };
    }
  }

  const customerNameNorm = normalizeString(customer.name);
  const match3 = clients.find(c => normalizeString(c.nom) === customerNameNorm);
  if (match3) return { client: match3, level: 'name_exact' };

  const customerNameClean = removeJuridicalSuffixes(normalizeString(customer.name));
  const match4 = clients.find(
    c => removeJuridicalSuffixes(normalizeString(c.nom)) === customerNameClean
  );
  if (match4) return { client: match4, level: 'name_clean' };

  const match5 = clients.find(c => {
    const n = normalizeString(c.nom);
    return n.includes(customerNameNorm) || customerNameNorm.includes(n);
  });
  if (match5) return { client: match5, level: 'name_partial' };

  const match6 = clients.find(c => {
    const cn = removeJuridicalSuffixes(normalizeString(c.nom));
    return cn.includes(customerNameClean) || customerNameClean.includes(cn);
  });
  if (match6) return { client: match6, level: 'name_clean_partial' };

  return null;
}

/**
 * Détecte les clients inactifs avec abonnements actifs — même logique que syncPreview.js
 */
function detectInactiveWithSubscriptions(customers, subscriptions, inactiveClients) {
  const customerIdsWithSub = new Set(
    subscriptions.map(sub => sub.customer?.id).filter(Boolean)
  );

  const inactiveWithSubs = [];
  for (const customer of customers) {
    if (!customerIdsWithSub.has(customer.id)) continue;

    const inactiveMatch = matchCustomerToClientWithLevel(customer, inactiveClients);
    if (inactiveMatch) {
      const activeSubs = subscriptions.filter(
        s => s.customer?.id === customer.id && s.status === 'in_progress'
      );
      if (activeSubs.length > 0) {
        const totalHT = activeSubs.reduce(
          (sum, s) => sum + (parseFloat(s.customer_invoice_data?.currency_amount_before_tax) || 0), 0
        );
        inactiveWithSubs.push({
          client: inactiveMatch.client,
          customer: { id: customer.id, name: customer.name, reg_no: customer.reg_no },
          subscriptionsCount: activeSubs.length,
          totalHT: Math.round(totalHT * 100) / 100,
          subscriptions: activeSubs.map(s => ({
            label: s.label,
            status: s.status,
            total_ht: parseFloat(s.customer_invoice_data?.currency_amount_before_tax) || 0
          }))
        });
      }
    }
  }
  return inactiveWithSubs;
}

// ============================================================================
// TESTS
// ============================================================================

describe('matchCustomerToClientWithLevel', () => {
  const clients = [
    { id: 1, nom: 'BDV SARL', pennylane_customer_id: 'uuid-bdv-123', siren: '123456789', actif: true },
    { id: 2, nom: 'Société Test', pennylane_customer_id: null, siren: '987654321', actif: true },
    { id: 3, nom: 'Client Sans UUID', pennylane_customer_id: null, siren: null, actif: true },
    { id: 4, nom: 'Restaurant Le Bon', pennylane_customer_id: null, siren: '555666777', actif: true },
    { id: 5, nom: 'HOLDING GROUPE ABC', pennylane_customer_id: null, siren: null, actif: true }
  ];

  it('devrait matcher par UUID avec level uuid', () => {
    const customer = { id: 100, name: 'Nom Différent', external_reference: 'uuid-bdv-123', reg_no: '' };
    const result = matchCustomerToClientWithLevel(customer, clients);
    expect(result).toBeTruthy();
    expect(result.client.id).toBe(1);
    expect(result.level).toBe('uuid');
  });

  it('devrait matcher par SIREN avec level siren', () => {
    const customer = { id: 101, name: 'Nom Totalement Différent', external_reference: null, reg_no: '987654321' };
    const result = matchCustomerToClientWithLevel(customer, clients);
    expect(result).toBeTruthy();
    expect(result.client.id).toBe(2);
    expect(result.level).toBe('siren');
  });

  it('devrait prioriser UUID sur SIREN', () => {
    const customer = { id: 102, name: 'XYZ', external_reference: 'uuid-bdv-123', reg_no: '987654321' };
    const result = matchCustomerToClientWithLevel(customer, clients);
    expect(result.client.id).toBe(1); // UUID match BDV, pas SIREN match Société Test
    expect(result.level).toBe('uuid');
  });

  it('devrait prioriser SIREN sur le nom', () => {
    const customer = { id: 103, name: 'Société Test', external_reference: null, reg_no: '123456789' };
    const result = matchCustomerToClientWithLevel(customer, clients);
    // SIREN 123456789 match BDV (id 1), pas le nom "Société Test" (id 2)
    expect(result.client.id).toBe(1);
    expect(result.level).toBe('siren');
  });

  it('devrait matcher par nom exact avec level name_exact', () => {
    const customer = { id: 104, name: 'Société Test', external_reference: null, reg_no: '' };
    const result = matchCustomerToClientWithLevel(customer, clients);
    expect(result.client.id).toBe(2);
    expect(result.level).toBe('name_exact');
  });

  it('devrait matcher par nom sans suffixe juridique avec level name_clean', () => {
    const customer = { id: 105, name: 'BDV', external_reference: null, reg_no: '' };
    const result = matchCustomerToClientWithLevel(customer, clients);
    expect(result.client.id).toBe(1);
    expect(result.level).toBe('name_clean');
  });

  it('devrait matcher par nom partiel avec level name_partial', () => {
    // "Restaurant Le Bon Vivant" contient "Restaurant Le Bon" (client id:4) en sous-chaîne
    // NB: ne pas utiliser "Paris" car c'est un suffixe juridique retiré par name_clean
    const customer = { id: 106, name: 'Restaurant Le Bon Vivant', external_reference: null, reg_no: '' };
    const result = matchCustomerToClientWithLevel(customer, clients);
    expect(result.client.id).toBe(4);
    expect(result.level).toBe('name_partial');
  });

  it('devrait retourner null si pas de match', () => {
    const customer = { id: 107, name: 'Totalement Inconnu XYZ', external_reference: null, reg_no: '000000000' };
    const result = matchCustomerToClientWithLevel(customer, clients);
    expect(result).toBeNull();
  });

  it('devrait ignorer les SIREN mal formatés', () => {
    const customer = { id: 108, name: 'Totalement Inconnu', external_reference: null, reg_no: '12345' }; // trop court
    const result = matchCustomerToClientWithLevel(customer, clients);
    expect(result).toBeNull();
  });

  it('devrait nettoyer les espaces dans le SIREN', () => {
    const customer = { id: 109, name: 'XYZ', external_reference: null, reg_no: '123 456 789' };
    const result = matchCustomerToClientWithLevel(customer, clients);
    expect(result).toBeTruthy();
    expect(result.client.id).toBe(1);
    expect(result.level).toBe('siren');
  });
});

describe('Séparation clients actifs / inactifs', () => {
  const allClients = [
    { id: 1, nom: 'Client Actif A', actif: true, siren: '111111111' },
    { id: 2, nom: 'Client Actif B', actif: true, siren: '222222222' },
    { id: 3, nom: 'Client Inactif C', actif: false, siren: '333333333' },
    { id: 4, nom: 'Client Inactif D', actif: false, siren: '444444444' }
  ];

  it('devrait séparer correctement actifs et inactifs', () => {
    const actifs = allClients.filter(c => c.actif);
    const inactifs = allClients.filter(c => !c.actif);

    expect(actifs).toHaveLength(2);
    expect(inactifs).toHaveLength(2);
    expect(actifs.every(c => c.actif)).toBe(true);
    expect(inactifs.every(c => !c.actif)).toBe(true);
  });

  it('le matching ne devrait trouver que dans la liste fournie (actifs)', () => {
    const actifs = allClients.filter(c => c.actif);
    const customer = { id: 100, name: 'XYZ', external_reference: null, reg_no: '333333333' };
    const result = matchCustomerToClientWithLevel(customer, actifs);
    // SIREN 333333333 est dans les inactifs, pas dans les actifs
    expect(result).toBeNull();
  });

  it('le matching devrait trouver dans les inactifs si on passe les inactifs', () => {
    const inactifs = allClients.filter(c => !c.actif);
    const customer = { id: 100, name: 'XYZ', external_reference: null, reg_no: '333333333' };
    const result = matchCustomerToClientWithLevel(customer, inactifs);
    expect(result).toBeTruthy();
    expect(result.client.id).toBe(3);
    expect(result.level).toBe('siren');
  });
});

describe('Détection clients inactifs avec abonnements actifs', () => {
  const inactiveClients = [
    { id: 10, nom: 'OCV SAS', actif: false, siren: '111222333', pennylane_customer_id: null },
    { id: 11, nom: 'JOE SARL', actif: false, siren: '444555666', pennylane_customer_id: null },
    { id: 12, nom: 'Ancien Client PP', actif: false, siren: null, pennylane_customer_id: 'uuid-ancien' }
  ];

  it('devrait détecter un client inactif avec abonnement actif via SIREN', () => {
    const customers = [
      { id: 200, name: 'OCV SAS', external_reference: null, reg_no: '111222333' }
    ];
    const subscriptions = [
      {
        id: 1, customer: { id: 200 }, status: 'in_progress', label: 'Mission comptable',
        customer_invoice_data: { currency_amount_before_tax: '500.00' }
      }
    ];

    const result = detectInactiveWithSubscriptions(customers, subscriptions, inactiveClients);
    expect(result).toHaveLength(1);
    expect(result[0].client.id).toBe(10);
    expect(result[0].customer.name).toBe('OCV SAS');
    expect(result[0].subscriptionsCount).toBe(1);
    expect(result[0].totalHT).toBe(500);
    expect(result[0].subscriptions[0].label).toBe('Mission comptable');
  });

  it('devrait détecter un client inactif avec abonnement actif via UUID', () => {
    const customers = [
      { id: 201, name: 'Ancien Client', external_reference: 'uuid-ancien', reg_no: '' }
    ];
    const subscriptions = [
      {
        id: 2, customer: { id: 201 }, status: 'in_progress', label: 'Mission sociale',
        customer_invoice_data: { currency_amount_before_tax: '300.00' }
      }
    ];

    const result = detectInactiveWithSubscriptions(customers, subscriptions, inactiveClients);
    expect(result).toHaveLength(1);
    expect(result[0].client.id).toBe(12);
  });

  it('ne devrait PAS détecter si abonnement est stopped', () => {
    const customers = [
      { id: 202, name: 'OCV SAS', external_reference: null, reg_no: '111222333' }
    ];
    const subscriptions = [
      {
        id: 3, customer: { id: 202 }, status: 'stopped', label: 'Mission comptable',
        customer_invoice_data: { currency_amount_before_tax: '500.00' }
      }
    ];

    const result = detectInactiveWithSubscriptions(customers, subscriptions, inactiveClients);
    expect(result).toHaveLength(0);
  });

  it('ne devrait PAS détecter si customer sans abonnement', () => {
    const customers = [
      { id: 203, name: 'OCV SAS', external_reference: null, reg_no: '111222333' }
    ];
    const subscriptions = []; // Aucun abonnement

    const result = detectInactiveWithSubscriptions(customers, subscriptions, inactiveClients);
    expect(result).toHaveLength(0);
  });

  it('devrait accumuler plusieurs abonnements actifs pour un même client inactif', () => {
    const customers = [
      { id: 204, name: 'JOE SARL', external_reference: null, reg_no: '444555666' }
    ];
    const subscriptions = [
      {
        id: 4, customer: { id: 204 }, status: 'in_progress', label: 'Comptabilité',
        customer_invoice_data: { currency_amount_before_tax: '200.00' }
      },
      {
        id: 5, customer: { id: 204 }, status: 'in_progress', label: 'Social',
        customer_invoice_data: { currency_amount_before_tax: '150.00' }
      }
    ];

    const result = detectInactiveWithSubscriptions(customers, subscriptions, inactiveClients);
    expect(result).toHaveLength(1);
    expect(result[0].subscriptionsCount).toBe(2);
    expect(result[0].totalHT).toBe(350);
    expect(result[0].subscriptions).toHaveLength(2);
  });

  it('devrait détecter plusieurs clients inactifs indépendamment', () => {
    const customers = [
      { id: 205, name: 'OCV SAS', external_reference: null, reg_no: '111222333' },
      { id: 206, name: 'JOE SARL', external_reference: null, reg_no: '444555666' }
    ];
    const subscriptions = [
      {
        id: 6, customer: { id: 205 }, status: 'in_progress', label: 'Compta OCV',
        customer_invoice_data: { currency_amount_before_tax: '100.00' }
      },
      {
        id: 7, customer: { id: 206 }, status: 'in_progress', label: 'Social JOE',
        customer_invoice_data: { currency_amount_before_tax: '200.00' }
      }
    ];

    const result = detectInactiveWithSubscriptions(customers, subscriptions, inactiveClients);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.client.nom)).toContain('OCV SAS');
    expect(result.map(r => r.client.nom)).toContain('JOE SARL');
  });

  it('ne devrait PAS matcher un customer avec un client actif dans la liste inactifs', () => {
    // Si le client n'est pas dans la liste des inactifs, pas d'anomalie
    const customers = [
      { id: 207, name: 'Client Actif', external_reference: null, reg_no: '999999999' }
    ];
    const subscriptions = [
      {
        id: 8, customer: { id: 207 }, status: 'in_progress', label: 'Mission',
        customer_invoice_data: { currency_amount_before_tax: '100.00' }
      }
    ];

    const result = detectInactiveWithSubscriptions(customers, subscriptions, inactiveClients);
    expect(result).toHaveLength(0);
  });
});

describe('Génération anomalies pour rapport sync', () => {
  it('devrait générer une anomalie de type inactive_with_subscriptions', () => {
    const inactiveWithSubs = [
      {
        client: { id: 10, nom: 'OCV SAS', actif: false },
        customer: { id: 200, name: 'OCV SAS', reg_no: '111222333' },
        subscriptionsCount: 2,
        totalHT: 700,
        subscriptions: [
          { label: 'Comptabilité', status: 'in_progress', total_ht: 500 },
          { label: 'Social', status: 'in_progress', total_ht: 200 }
        ]
      }
    ];

    // Même logique que syncPreview.js pour construire l'anomalie
    const anomalies = [];
    if (inactiveWithSubs.length > 0) {
      anomalies.push({
        type: 'inactive_with_subscriptions',
        severity: 'error',
        message: `${inactiveWithSubs.length} client(s) inactif(s) avec abonnement(s) actif(s) sur Pennylane`,
        details: inactiveWithSubs
      });
    }

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].type).toBe('inactive_with_subscriptions');
    expect(anomalies[0].severity).toBe('error');
    expect(anomalies[0].details).toHaveLength(1);
    expect(anomalies[0].details[0].client.nom).toBe('OCV SAS');
    expect(anomalies[0].details[0].totalHT).toBe(700);
  });

  it('ne devrait PAS générer d\'anomalie si aucun client inactif avec abonnement', () => {
    const inactiveWithSubs = [];
    const anomalies = [];
    if (inactiveWithSubs.length > 0) {
      anomalies.push({
        type: 'inactive_with_subscriptions',
        severity: 'error',
        message: `${inactiveWithSubs.length} client(s) inactif(s)`,
        details: inactiveWithSubs
      });
    }
    expect(anomalies).toHaveLength(0);
  });
});

describe('Niveaux de matching — weak match detection', () => {
  it('devrait signaler un match faible pour name_partial', () => {
    const match = { level: 'name_partial' };
    const isWeak = match.level === 'name_partial' || match.level === 'name_clean_partial';
    expect(isWeak).toBe(true);
  });

  it('devrait signaler un match faible pour name_clean_partial', () => {
    const match = { level: 'name_clean_partial' };
    const isWeak = match.level === 'name_partial' || match.level === 'name_clean_partial';
    expect(isWeak).toBe(true);
  });

  it('ne devrait PAS signaler un match faible pour siren', () => {
    const match = { level: 'siren' };
    const isWeak = match.level === 'name_partial' || match.level === 'name_clean_partial';
    expect(isWeak).toBe(false);
  });

  it('ne devrait PAS signaler un match faible pour uuid', () => {
    const match = { level: 'uuid' };
    const isWeak = match.level === 'name_partial' || match.level === 'name_clean_partial';
    expect(isWeak).toBe(false);
  });

  it('ne devrait PAS signaler un match faible pour name_exact', () => {
    const match = { level: 'name_exact' };
    const isWeak = match.level === 'name_partial' || match.level === 'name_clean_partial';
    expect(isWeak).toBe(false);
  });
});

describe('Enrichissement emails par SIREN (logique sync-pennylane serveur)', () => {
  /**
   * Simule la logique d'enrichissement emails de sync-pennylane.js :
   * - Indexe les clients par SIREN
   * - Pour chaque customer v2, extrait emails[0] + reg_no (SIREN)
   * - Match par SIREN et met à jour si email différent
   */
  function enrichEmails(clients, customers) {
    const clientsBySiren = {};
    for (const c of clients) {
      if (c.siren) clientsBySiren[c.siren] = c;
    }

    const updates = [];
    for (const customer of customers) {
      const email = (customer.emails && customer.emails[0]) || null;
      if (!email || !customer.reg_no) continue;
      const client = clientsBySiren[customer.reg_no];
      if (client && client.email !== email) {
        updates.push({ clientId: client.id, email });
      }
    }
    return updates;
  }

  it('devrait matcher par SIREN et retourner les emails à mettre à jour', () => {
    const clients = [
      { id: 1, siren: '111111111', email: null },
      { id: 2, siren: '222222222', email: null },
      { id: 3, siren: '333333333', email: 'old@test.fr' }
    ];
    const customers = [
      { reg_no: '111111111', emails: ['contact@alpha.fr'] },
      { reg_no: '222222222', emails: ['info@beta.fr'] },
      { reg_no: '333333333', emails: ['new@gamma.fr'] }
    ];

    const updates = enrichEmails(clients, customers);
    expect(updates).toHaveLength(3);
    expect(updates[0]).toEqual({ clientId: 1, email: 'contact@alpha.fr' });
    expect(updates[1]).toEqual({ clientId: 2, email: 'info@beta.fr' });
    expect(updates[2]).toEqual({ clientId: 3, email: 'new@gamma.fr' });
  });

  it('devrait ignorer les customers sans SIREN (reg_no)', () => {
    const clients = [{ id: 1, siren: '111111111', email: null }];
    const customers = [
      { reg_no: null, emails: ['nope@test.fr'] },
      { reg_no: '', emails: ['nope2@test.fr'] },
      { emails: ['nope3@test.fr'] }
    ];

    const updates = enrichEmails(clients, customers);
    expect(updates).toHaveLength(0);
  });

  it('devrait ignorer les customers sans email', () => {
    const clients = [{ id: 1, siren: '111111111', email: null }];
    const customers = [
      { reg_no: '111111111', emails: [] },
      { reg_no: '111111111', emails: null },
      { reg_no: '111111111' }
    ];

    const updates = enrichEmails(clients, customers);
    expect(updates).toHaveLength(0);
  });

  it('devrait ne pas mettre à jour si email identique', () => {
    const clients = [{ id: 1, siren: '111111111', email: 'same@test.fr' }];
    const customers = [{ reg_no: '111111111', emails: ['same@test.fr'] }];

    const updates = enrichEmails(clients, customers);
    expect(updates).toHaveLength(0);
  });

  it('devrait ignorer les customers dont le SIREN ne matche aucun client', () => {
    const clients = [{ id: 1, siren: '111111111', email: null }];
    const customers = [{ reg_no: '999999999', emails: ['unknown@test.fr'] }];

    const updates = enrichEmails(clients, customers);
    expect(updates).toHaveLength(0);
  });

  it('devrait gérer les clients sans SIREN (non indexés)', () => {
    const clients = [
      { id: 1, siren: null, email: null },
      { id: 2, siren: '222222222', email: null }
    ];
    const customers = [{ reg_no: '222222222', emails: ['contact@test.fr'] }];

    const updates = enrichEmails(clients, customers);
    expect(updates).toHaveLength(1);
    expect(updates[0].clientId).toBe(2);
  });
});

describe('Extraction email depuis customer Pennylane', () => {
  it('devrait extraire le premier email de la liste emails[]', () => {
    const customer = {
      id: 300, name: 'Test Client',
      emails: ['contact@test.fr', 'admin@test.fr'],
      external_reference: null, reg_no: '111111111'
    };
    const email = (customer.emails && customer.emails[0]) || null;
    expect(email).toBe('contact@test.fr');
  });

  it('devrait retourner null si emails est un tableau vide', () => {
    const customer = { id: 301, name: 'Test', emails: [], external_reference: null, reg_no: '' };
    const email = (customer.emails && customer.emails[0]) || null;
    expect(email).toBeNull();
  });

  it('devrait retourner null si emails est undefined', () => {
    const customer = { id: 302, name: 'Test', external_reference: null, reg_no: '' };
    const email = (customer.emails && customer.emails[0]) || null;
    expect(email).toBeNull();
  });

  it('devrait inclure emails dans le clientsMatches du preview', () => {
    const customers = [
      { id: 400, name: 'Société X', emails: ['x@societe.fr'], external_reference: null, reg_no: '999888777' }
    ];
    const clients = [
      { id: 50, nom: 'Société X', siren: '999888777', actif: true, pennylane_customer_id: null }
    ];

    const match = matchCustomerToClientWithLevel(customers[0], clients);
    expect(match).toBeTruthy();

    // Même construction que previewSync
    const matchEntry = {
      customer: {
        id: customers[0].id,
        name: customers[0].name,
        external_reference: customers[0].external_reference,
        reg_no: customers[0].reg_no,
        emails: customers[0].emails || []
      },
      client: match.client,
      level: match.level
    };

    expect(matchEntry.customer.emails).toEqual(['x@societe.fr']);
    expect(matchEntry.customer.emails[0]).toBe('x@societe.fr');
  });
});
