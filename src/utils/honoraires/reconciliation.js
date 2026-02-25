// @ts-check

/**
 * @file Service de réconciliation Pennylane ↔ Base locale
 * Compare les données live de l'API Pennylane avec la base Supabase
 * pour identifier les écarts et garantir l'intégrité des données.
 */

import { fetchAllDataForSync, setCompanyId } from './pennylaneCustomersApi.js';

/**
 * Détecte si un customer Pennylane est un client France Formalités (pas d'abonnement honoraires)
 * @param {string} name - Nom du customer PL
 * @returns {boolean}
 */
function isFranceFormalites(name) {
  if (!name) return false;
  const n = name.trim().toUpperCase();
  // Noms se terminant par " FF" ou contenant "FRANCE FORMAL"
  return n.endsWith(' FF') || n.includes('FRANCE FORMAL');
}

// ============================================================
// MATCHING STRICT : SIREN (prioritaire) + UUID (fallback)
// La réconciliation est un outil de vérification, pas de découverte.
// Seuls les matchings fiables (SIREN, UUID Pennylane) sont utilisés.
// Le matching par nom (exact, partiel) est volontairement exclu
// car il génère des faux positifs (VA-PARIS→KAYASAN, etc.).
//
// SIREN est prioritaire car c'est un identifiant officiel (INSEE),
// alors que le pennylane_customer_id peut être mal assigné en base
// suite à un faux positif de la sync initiale (matching par nom).
// La déduplication empêche un client local d'être matché 2 fois
// par des customers PL différents (ex: IB HOLDING ↔ GD & FILS).
// ============================================================

const MATCH_LEVEL_LABELS = {
  uuid: 'UUID',
  siren: 'SIREN'
};

/**
 * Matche un customer PL vers un client local (SIREN first, UUID fallback).
 * @param {Object} customer - Customer Pennylane
 * @param {Array} clients - Clients locaux
 * @param {Set} [matchedClientIds] - IDs des clients déjà matchés (dédup)
 * @returns {{ client: Object, level: string } | null}
 */
function matchCustomerToClient(customer, clients, matchedClientIds = new Set()) {
  // 1. SIREN (prioritaire — identifiant officiel INSEE, 9 chiffres)
  if (customer.reg_no) {
    const sirenClean = customer.reg_no.replace(/\s/g, '').trim();
    if (sirenClean && /^\d{9}$/.test(sirenClean)) {
      const candidates = clients.filter(c => c.siren && c.siren === sirenClean && !matchedClientIds.has(c.id));
      if (candidates.length === 1) {
        // SIREN unique → match direct
        return { client: candidates[0], level: 'siren' };
      }
      if (candidates.length > 1 && customer.external_reference) {
        // SIREN ambigu (plusieurs établissements, ex: RELAIS CHRISTINE / SAINT JAMES)
        // → utiliser l'UUID Pennylane pour désambiguïser parmi les candidats SIREN
        const uuidMatch = candidates.find(c => c.pennylane_customer_id === customer.external_reference);
        if (uuidMatch) return { client: uuidMatch, level: 'siren' };
      }
    }
  }
  // 2. UUID Pennylane (fallback — peut être mal assigné en base)
  if (customer.external_reference) {
    const match = clients.find(c => c.pennylane_customer_id && c.pennylane_customer_id === customer.external_reference && !matchedClientIds.has(c.id));
    if (match) return { client: match, level: 'uuid' };
  }
  return null;
}

// ============================================================
// RECONCILIATION PRINCIPALE
// ============================================================

/**
 * @typedef {Object} ReconciliationEntry
 * @property {number|null} clientId
 * @property {string} clientNom
 * @property {string|null} clientSiren
 * @property {string} cabinet
 * @property {number|null} customerPLId
 * @property {string} customerPLName
 * @property {string|null} matchLevel
 * @property {string|null} matchLevelLabel
 * @property {number} nbAbosPL
 * @property {number} totalHTPL
 * @property {Array} abosPL
 * @property {number} nbAbosDB
 * @property {number} totalHTDB
 * @property {Array} abosDB
 * @property {number} ecartHT
 * @property {number} ecartPct
 * @property {string} statut - 'iso' | 'ecart' | 'pl_only' | 'db_only' | 'no_sub'
 */

/**
 * Réconcilie les données Pennylane (API live) avec la base locale Supabase.
 * Supporte un ou plusieurs cabinets.
 *
 * @param {Object} supabase - Client Supabase
 * @param {Array<{cabinet: string, apiKey: string, companyId: string}>} cabinets - Liste des cabinets à réconcilier
 * @param {function} [onProgress] - Callback de progression
 * @returns {Promise<ReconciliationEntry[]>}
 */
export async function reconcilierDonnees(supabase, cabinets, onProgress = null) {
  const report = (step, message) => {
    if (onProgress) onProgress({ step, message });
  };

  const allResults = [];

  for (const cab of cabinets) {
    report('fetch', `Récupération Pennylane — ${cab.cabinet}...`);

    // Configurer le company_id pour ce cabinet
    if (cab.companyId) setCompanyId(cab.companyId);

    const { customers, subscriptions } = await fetchAllDataForSync(cab.apiKey, onProgress);

    // Filtrer les abonnements actifs (in_progress + not_started)
    const activeSubs = subscriptions.filter(s => s.status === 'in_progress' || s.status === 'not_started');

    // Grouper les abonnements par customer_id
    const subsByCustomer = new Map();
    for (const sub of activeSubs) {
      const custId = sub.customer?.id;
      if (!custId) continue;
      if (!subsByCustomer.has(custId)) subsByCustomer.set(custId, []);
      subsByCustomer.get(custId).push({
        id: sub.id,
        label: sub.label,
        status: sub.status,
        totalHT: parseFloat(sub.customer_invoice_data?.currency_amount_before_tax) || 0,
        frequence: sub.recurring_rule?.rule_type || null,
        intervalle: sub.recurring_rule?.interval || 1
      });
    }

    // ---- Données locales (Supabase) pour ce cabinet ----
    report('db', `Chargement base locale — ${cab.cabinet}...`);
    const { data: dbClients } = await supabase
      .from('clients')
      .select('id, nom, siren, cabinet, actif, pennylane_customer_id')
      .eq('actif', true)
      .eq('cabinet', cab.cabinet);

    const { data: dbAbos } = await supabase
      .from('abonnements')
      .select('id, client_id, label, status, total_ht, pennylane_subscription_id, frequence, intervalle')
      .in('status', ['in_progress', 'not_started']);

    // Grouper abos DB par client_id (filtrer par les clients du cabinet)
    const dbClientIds = new Set(dbClients.map(c => c.id));
    const dbAbosByClient = new Map();
    for (const abo of (dbAbos || [])) {
      if (!dbClientIds.has(abo.client_id)) continue;
      if (!dbAbosByClient.has(abo.client_id)) dbAbosByClient.set(abo.client_id, []);
      dbAbosByClient.get(abo.client_id).push({
        id: abo.id,
        label: abo.label,
        status: abo.status,
        totalHT: parseFloat(abo.total_ht) || 0,
        pennylane_subscription_id: abo.pennylane_subscription_id,
        frequence: abo.frequence,
        intervalle: abo.intervalle
      });
    }

    // ---- Matching customers → clients ----
    report('match', `Rapprochement — ${cab.cabinet}...`);
    const matchedClientIds = new Set();

    for (const customer of customers) {
      // Exclure les customers France Formalités
      if (isFranceFormalites(customer.name)) continue;

      const plAbos = subsByCustomer.get(customer.id) || [];
      const match = matchCustomerToClient(customer, dbClients, matchedClientIds);

      if (match) {
        matchedClientIds.add(match.client.id);

        const clientAbos = dbAbosByClient.get(match.client.id) || [];
        const totalHTPL = plAbos.reduce((sum, a) => sum + a.totalHT, 0);
        const totalHTDB = clientAbos.reduce((sum, a) => sum + a.totalHT, 0);
        const ecartHT = Math.round((totalHTDB - totalHTPL) * 100) / 100;
        const ecartPct = totalHTPL > 0 ? Math.round((ecartHT / totalHTPL) * 100) : 0;

        let statut;
        if (plAbos.length === 0 && clientAbos.length === 0) {
          statut = 'no_sub';
        } else if (Math.abs(ecartHT) < 1) {
          statut = 'iso';
        } else {
          statut = 'ecart';
        }

        allResults.push({
          clientId: match.client.id,
          clientNom: match.client.nom,
          clientSiren: match.client.siren || null,
          cabinet: cab.cabinet,
          customerPLId: customer.id,
          customerPLName: customer.name,
          matchLevel: match.level,
          matchLevelLabel: MATCH_LEVEL_LABELS[match.level] || match.level,
          nbAbosPL: plAbos.length,
          totalHTPL: Math.round(totalHTPL * 100) / 100,
          abosPL: plAbos,
          nbAbosDB: clientAbos.length,
          totalHTDB: Math.round(totalHTDB * 100) / 100,
          abosDB: clientAbos,
          ecartHT,
          ecartPct,
          statut
        });
      } else if (plAbos.length > 0) {
        // Customer PL avec abonnements mais pas de client local
        const totalHTPL = plAbos.reduce((sum, a) => sum + a.totalHT, 0);
        allResults.push({
          clientId: null,
          clientNom: '—',
          clientSiren: customer.reg_no || null,
          cabinet: cab.cabinet,
          customerPLId: customer.id,
          customerPLName: customer.name,
          matchLevel: null,
          matchLevelLabel: null,
          nbAbosPL: plAbos.length,
          totalHTPL: Math.round(totalHTPL * 100) / 100,
          abosPL: plAbos,
          nbAbosDB: 0,
          totalHTDB: 0,
          abosDB: [],
          ecartHT: Math.round(-totalHTPL * 100) / 100,
          ecartPct: -100,
          statut: 'pl_only'
        });
      }
    }

    // Clients DB avec abonnements mais pas trouvés sur PL
    for (const client of dbClients) {
      if (matchedClientIds.has(client.id)) continue;
      const clientAbos = dbAbosByClient.get(client.id) || [];
      if (clientAbos.length === 0) continue;

      const totalHTDB = clientAbos.reduce((sum, a) => sum + a.totalHT, 0);
      allResults.push({
        clientId: client.id,
        clientNom: client.nom,
        clientSiren: client.siren || null,
        cabinet: cab.cabinet,
        customerPLId: null,
        customerPLName: '—',
        matchLevel: null,
        matchLevelLabel: null,
        nbAbosPL: 0,
        totalHTPL: 0,
        abosPL: [],
        nbAbosDB: clientAbos.length,
        totalHTDB: Math.round(totalHTDB * 100) / 100,
        abosDB: clientAbos,
        ecartHT: Math.round(totalHTDB * 100) / 100,
        ecartPct: 100,
        statut: 'db_only'
      });
    }
  }

  // Tri par statut (erreurs d'abord) puis par écart décroissant
  const statutOrder = { pl_only: 0, db_only: 1, ecart: 2, no_sub: 3, iso: 4 };
  allResults.sort((a, b) => {
    const orderDiff = (statutOrder[a.statut] ?? 5) - (statutOrder[b.statut] ?? 5);
    if (orderDiff !== 0) return orderDiff;
    return Math.abs(b.ecartHT) - Math.abs(a.ecartHT);
  });

  report('done', 'Réconciliation terminée');
  return allResults;
}

export { MATCH_LEVEL_LABELS };
