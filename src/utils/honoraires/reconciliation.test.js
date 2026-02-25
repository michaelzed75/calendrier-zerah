// @ts-check
import { describe, it, expect } from 'vitest';

/**
 * Tests pour le module de réconciliation Pennylane ↔ Base locale
 *
 * La réconciliation utilise un matching STRICT (SIREN + UUID uniquement),
 * contrairement à la sync qui utilise aussi le matching par nom.
 * Ces tests vérifient que seuls les matchings fiables sont utilisés.
 */

// ============================================================================
// FONCTIONS EXTRAITES POUR TEST (identiques à reconciliation.js)
// ============================================================================

function isFranceFormalites(name) {
  if (!name) return false;
  const n = name.trim().toUpperCase();
  return n.endsWith(' FF') || n.includes('FRANCE FORMAL');
}

const MATCH_LEVEL_LABELS = {
  uuid: 'UUID',
  siren: 'SIREN'
};

function matchCustomerToClient(customer, clients, matchedClientIds = new Set()) {
  // 1. SIREN (prioritaire)
  if (customer.reg_no) {
    const sirenClean = customer.reg_no.replace(/\s/g, '').trim();
    if (sirenClean && /^\d{9}$/.test(sirenClean)) {
      const candidates = clients.filter(c => c.siren && c.siren === sirenClean && !matchedClientIds.has(c.id));
      if (candidates.length === 1) {
        return { client: candidates[0], level: 'siren' };
      }
      if (candidates.length > 1 && customer.external_reference) {
        const uuidMatch = candidates.find(c => c.pennylane_customer_id === customer.external_reference);
        if (uuidMatch) return { client: uuidMatch, level: 'siren' };
      }
    }
  }
  // 2. UUID (fallback)
  if (customer.external_reference) {
    const match = clients.find(c => c.pennylane_customer_id && c.pennylane_customer_id === customer.external_reference && !matchedClientIds.has(c.id));
    if (match) return { client: match, level: 'uuid' };
  }
  return null;
}

// ============================================================================
// TESTS — FRANCE FORMALITÉS
// ============================================================================

describe('isFranceFormalites — exclusion des customers France Formalités', () => {
  it('devrait détecter les noms finissant par " FF"', () => {
    expect(isFranceFormalites('KAYASAN FF')).toBe(true);
    expect(isFranceFormalites('VA-PARIS FF')).toBe(true);
    expect(isFranceFormalites('SOCIETE QUELCONQUE FF')).toBe(true);
  });

  it('devrait détecter les noms contenant "FRANCE FORMAL"', () => {
    expect(isFranceFormalites('FRANCE FORMALITES')).toBe(true);
    expect(isFranceFormalites('SAS FRANCE FORMALITES')).toBe(true);
    expect(isFranceFormalites('france formalités')).toBe(true); // insensible casse
  });

  it('NE devrait PAS exclure les clients normaux', () => {
    expect(isFranceFormalites('KAYASAN')).toBe(false);
    expect(isFranceFormalites('VA-PARIS')).toBe(false);
    expect(isFranceFormalites('BDV SARL')).toBe(false);
    expect(isFranceFormalites('SNC CHRISTINE')).toBe(false);
  });

  it('devrait gérer les cas edge', () => {
    expect(isFranceFormalites('')).toBe(false);
    expect(isFranceFormalites(null)).toBe(false);
    expect(isFranceFormalites(undefined)).toBe(false);
    expect(isFranceFormalites('  FF  ')).toBe(false); // " FF " avec trailing space
    expect(isFranceFormalites('PFFF')).toBe(false); // FF pas en suffixe séparé
  });

  it('devrait détecter " FF" avec espaces', () => {
    expect(isFranceFormalites('  KAYASAN FF  ')).toBe(true); // trim
    expect(isFranceFormalites('TEST  FF')).toBe(true); // double espace
  });
});

// ============================================================================
// TESTS — MATCHING STRICT (SIREN + UUID, pas de nom)
// ============================================================================

describe('Matching strict réconciliation — SIREN + UUID uniquement', () => {
  const clients = [
    { id: 1, nom: 'BDV SARL', siren: '123456789', pennylane_customer_id: 'uuid-bdv' },
    { id: 2, nom: 'LM', siren: '849866504', pennylane_customer_id: 'uuid-lm' },
    { id: 3, nom: 'FERIA CAFE GILBERT DELMAS', siren: '492321757', pennylane_customer_id: null },
    { id: 4, nom: 'MARIE - SUZY', siren: '838072353', pennylane_customer_id: 'uuid-mariesuzy' }
  ];

  it('devrait matcher par SIREN', () => {
    const customer = { id: 100, name: 'Nom Quelconque', reg_no: '123456789', external_reference: null };
    const result = matchCustomerToClient(customer, clients);
    expect(result).toBeTruthy();
    expect(result.client.id).toBe(1);
    expect(result.level).toBe('siren');
  });

  it('devrait matcher par UUID en fallback', () => {
    const customer = { id: 101, name: 'Nom Quelconque', reg_no: '', external_reference: 'uuid-lm' };
    const result = matchCustomerToClient(customer, clients);
    expect(result).toBeTruthy();
    expect(result.client.id).toBe(2);
    expect(result.level).toBe('uuid');
  });

  it('NE devrait PAS matcher par nom — LM vs GILBERT DELMAS', () => {
    // En réconciliation, pas de matching par nom !
    // Un customer "LM" sans SIREN ni UUID ne doit PAS matcher FERIA CAFE GILBERT DELMAS
    const customer = { id: 102, name: 'LM', reg_no: '', external_reference: null };
    const result = matchCustomerToClient(customer, clients);
    expect(result).toBeNull();
  });

  it('NE devrait PAS matcher par nom — GILBERT DELMAS vs LM', () => {
    const customer = { id: 103, name: 'GILBERT DELMAS', reg_no: '', external_reference: null };
    const result = matchCustomerToClient(customer, clients);
    expect(result).toBeNull();
  });

  it('NE devrait PAS matcher par nom — même nom exact', () => {
    // Même si le nom est identique, sans SIREN/UUID → pas de match en réconciliation
    const customer = { id: 104, name: 'BDV SARL', reg_no: '', external_reference: null };
    const result = matchCustomerToClient(customer, clients);
    expect(result).toBeNull();
  });

  it('NE devrait PAS matcher par nom partiel', () => {
    const customer = { id: 105, name: 'BDV', reg_no: '', external_reference: null };
    const result = matchCustomerToClient(customer, clients);
    expect(result).toBeNull();
  });
});

// ============================================================================
// TESTS — SIREN AMBIGU (RELAIS CHRISTINE / SAINT JAMES)
// ============================================================================

describe('Réconciliation — SIREN ambigu multi-établissements', () => {
  const clients = [
    { id: 109, nom: 'RELAIS CHRISTINE', siren: '387571789', pennylane_customer_id: 'uuid-relais-au' },
    { id: 203, nom: 'SAINT JAMES', siren: '387571789', pennylane_customer_id: 'uuid-stjames-au' },
    { id: 204, nom: 'RELAIS CHRISTINE', siren: '387571789', pennylane_customer_id: 'uuid-relais-zf' },
    { id: 135, nom: 'SAINT JAMES', siren: '387571789', pennylane_customer_id: 'uuid-stjames-zf' }
  ];

  it('devrait désambiguïser RELAIS CHRISTINE AU par UUID', () => {
    const customer = { id: 200, name: 'CHRISTINE-RELAIS CHRISTINE', reg_no: '387571789', external_reference: 'uuid-relais-au' };
    const result = matchCustomerToClient(customer, clients);
    expect(result).toBeTruthy();
    expect(result.client.id).toBe(109);
    expect(result.level).toBe('siren');
  });

  it('devrait désambiguïser SAINT JAMES ZF par UUID', () => {
    const customer = { id: 201, name: 'CHRISTINE- SAINT JAMES', reg_no: '387571789', external_reference: 'uuid-stjames-zf' };
    const result = matchCustomerToClient(customer, clients);
    expect(result).toBeTruthy();
    expect(result.client.id).toBe(135);
    expect(result.level).toBe('siren');
  });

  it('devrait matcher les 4 établissements sans collision via déduplication', () => {
    const matchedIds = new Set();
    const customers = [
      { id: 200, name: 'RELAIS CHRISTINE', reg_no: '387571789', external_reference: 'uuid-relais-au' },
      { id: 201, name: 'SAINT JAMES', reg_no: '387571789', external_reference: 'uuid-stjames-au' },
      { id: 202, name: 'RELAIS CHRISTINE', reg_no: '387571789', external_reference: 'uuid-relais-zf' },
      { id: 203, name: 'SAINT JAMES', reg_no: '387571789', external_reference: 'uuid-stjames-zf' }
    ];

    const results = [];
    for (const cust of customers) {
      const result = matchCustomerToClient(cust, clients, matchedIds);
      if (result) {
        matchedIds.add(result.client.id);
        results.push(result);
      }
    }

    // Les 4 doivent matcher sans collision
    expect(results).toHaveLength(4);
    const matchedClientIds = results.map(r => r.client.id).sort();
    expect(matchedClientIds).toEqual([109, 135, 203, 204]);
  });

  it('la dédup devrait empêcher un client d être matché 2 fois', () => {
    const matchedIds = new Set();
    // 2 customers PL avec le même UUID
    const cust1 = { id: 300, name: 'Customer A', reg_no: '', external_reference: 'uuid-relais-au' };
    const cust2 = { id: 301, name: 'Customer B', reg_no: '', external_reference: 'uuid-relais-au' };

    const result1 = matchCustomerToClient(cust1, clients, matchedIds);
    expect(result1).toBeTruthy();
    matchedIds.add(result1.client.id);

    const result2 = matchCustomerToClient(cust2, clients, matchedIds);
    // Le client 109 est déjà matché → result2 doit être null
    expect(result2).toBeNull();
  });

  it('devrait retourner null si SIREN ambigu sans UUID pour désambiguïser', () => {
    const customer = { id: 400, name: 'CHRISTINE', reg_no: '387571789', external_reference: null };
    const result = matchCustomerToClient(customer, clients);
    // 4 candidats SIREN, pas d'UUID → impossible de choisir
    expect(result).toBeNull();
  });
});

// ============================================================================
// TESTS — PROTECTION CONTRE LES UUID LEGACY (C1MARIESUZY, C1RELAISCHRISTINE)
// ============================================================================

describe('UUID legacy vs UUID réel', () => {
  it('devrait matcher avec un UUID legacy si identique en base', () => {
    const clients = [
      { id: 14, nom: 'MARIE - SUZY', siren: '838072353', pennylane_customer_id: 'C1MARIESUZY' }
    ];
    const customer = { id: 500, name: 'MARIE SUZY', reg_no: '838072353', external_reference: 'C1MARIESUZY' };
    const result = matchCustomerToClient(customer, clients);
    expect(result).toBeTruthy();
    expect(result.client.id).toBe(14);
    expect(result.level).toBe('siren'); // Matché par SIREN (unique)
  });

  it('devrait matcher par SIREN même si UUID legacy ne correspond plus', () => {
    const clients = [
      { id: 14, nom: 'MARIE - SUZY', siren: '838072353', pennylane_customer_id: 'C1MARIESUZY' }
    ];
    // UUID changé sur PL mais SIREN toujours correct
    const customer = { id: 501, name: 'MARIE SUZY', reg_no: '838072353', external_reference: 'nouveau-uuid-xxx' };
    const result = matchCustomerToClient(customer, clients);
    expect(result).toBeTruthy();
    expect(result.client.id).toBe(14);
    expect(result.level).toBe('siren'); // SIREN prioritaire même si UUID diffère
  });
});

// ============================================================================
// TESTS — ABONNEMENTS RÉASSIGNÉS (ex: FERIA CAFE déplacé de LM vers client 189)
// Quand un abonnement PL est réassigné localement à un autre client_id,
// il doit être exclu du total PL du customer d'origine.
// ============================================================================

/**
 * Simule la logique de séparation des abos PL normaux vs réassignés.
 * Identique à la logique dans reconcilierDonnees().
 * @param {Array} plAbos - Abos PL du customer
 * @param {Map} dbAboByPLSubId - Index pennylane_subscription_id → client_id
 * @param {number} matchedClientId - client_id du client matché
 * @returns {{ normaux: Array, reassignes: Array }}
 */
function separerAbosReassignes(plAbos, dbAboByPLSubId, matchedClientId) {
  const normaux = [];
  const reassignes = [];
  for (const abo of plAbos) {
    const dbClientId = dbAboByPLSubId.get(abo.id);
    if (dbClientId && dbClientId !== matchedClientId) {
      reassignes.push(abo);
    } else {
      normaux.push(abo);
    }
  }
  return { normaux, reassignes };
}

describe('Abonnements réassignés — exclusion du total PL', () => {
  // Cas réel : LM (client 56) a 2 abos PL (SCI LM 810€ + FERIA CAFE 4850€)
  // mais FERIA CAFE (abo id=280) a été réassigné en DB au client 189
  const plAbos = [
    { id: 17, label: 'SCI LM', status: 'in_progress', totalHT: 810 },
    { id: 280, label: 'FERIA CAFE', status: 'in_progress', totalHT: 4850 }
  ];

  it('devrait exclure FERIA CAFE du total PL de LM quand réassigné au client 189', () => {
    const dbAboByPLSubId = new Map();
    dbAboByPLSubId.set(17, 56);   // SCI LM → client 56 (LM) = normal
    dbAboByPLSubId.set(280, 189); // FERIA CAFE → client 189 = réassigné

    const { normaux, reassignes } = separerAbosReassignes(plAbos, dbAboByPLSubId, 56);

    expect(normaux).toHaveLength(1);
    expect(normaux[0].label).toBe('SCI LM');
    expect(normaux[0].totalHT).toBe(810);

    expect(reassignes).toHaveLength(1);
    expect(reassignes[0].label).toBe('FERIA CAFE');
    expect(reassignes[0].totalHT).toBe(4850);

    // Le total PL de LM doit être 810€ et non 5660€
    const totalHTPL = normaux.reduce((sum, a) => sum + a.totalHT, 0);
    expect(totalHTPL).toBe(810);
  });

  it('ne devrait rien exclure si aucun abo n\'est réassigné', () => {
    const dbAboByPLSubId = new Map();
    dbAboByPLSubId.set(17, 56);  // SCI LM → client 56
    dbAboByPLSubId.set(280, 56); // FERIA CAFE → client 56 (même client)

    const { normaux, reassignes } = separerAbosReassignes(plAbos, dbAboByPLSubId, 56);

    expect(normaux).toHaveLength(2);
    expect(reassignes).toHaveLength(0);
  });

  it('ne devrait rien exclure si l\'abo PL n\'existe pas en DB (nouveau)', () => {
    const dbAboByPLSubId = new Map();
    // Aucun abo n'est indexé → tous sont "normaux"

    const { normaux, reassignes } = separerAbosReassignes(plAbos, dbAboByPLSubId, 56);

    expect(normaux).toHaveLength(2);
    expect(reassignes).toHaveLength(0);
  });
});
