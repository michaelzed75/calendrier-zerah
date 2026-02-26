// @ts-check

/**
 * @file Audit des abonnements honoraires
 * Vérifie la cohérence des données abonnements après nettoyage des doublons clients.
 *
 * 5 vérifications :
 * 1. Abonnements orphelins (client_id inexistant ou inactif)
 * 2. Clients actifs sans abonnement
 * 3. Cohérence CA (total HT entre 2M et 2.5M€)
 * 4. Matching complet (abonnements sans client local)
 * 5. Prix social suspects (bulletin ↔ forfait : prix incohérent avec la classification)
 */

import { classifierLigne, detectModeFacturationSocial } from './classificationAxes.js';

/**
 * @typedef {Object} AuditResult
 * @property {Object} orphelins - Abonnements pointant vers un client inexistant ou inactif
 * @property {number} orphelins.count
 * @property {Object[]} orphelins.details
 * @property {Object} clientsSansAbo - Clients actifs Pennylane sans abonnement
 * @property {number} clientsSansAbo.plSansAbo - Liés à Pennylane mais sans abonnement
 * @property {number} clientsSansAbo.pasDansPl - Pas liés à Pennylane du tout
 * @property {Object[]} clientsSansAbo.details
 * @property {Object} coherenceCA - Vérification du CA total
 * @property {number} coherenceCA.totalHT
 * @property {number} coherenceCA.totalMensuelHT
 * @property {number} coherenceCA.nbAbonnements
 * @property {number} coherenceCA.nbClients
 * @property {boolean} coherenceCA.dansPlage - true si entre 2M et 2.5M€
 * @property {Object} coherenceCA.parCabinet
 * @property {Object} coherenceCA.parStatut
 * @property {Object} matching - Vérification du matching abonnements ↔ clients
 * @property {number} matching.abonnementsTotal
 * @property {number} matching.abonnementsAvecClient
 * @property {number} matching.clientsAvecAbo
 * @property {Object[]} matching.clientsInactifsAvecAbo - Clients inactifs qui ont encore des abonnements
 * @property {string} timestamp
 */

/**
 * Lance l'audit complet des abonnements honoraires
 * @param {Object} supabase - Client Supabase
 * @returns {Promise<AuditResult>}
 */
export async function auditAbonnements(supabase) {
  const [orphelins, clientsSansAbo, coherenceCA, matching, prixSuspects] = await Promise.all([
    checkOrphelins(supabase),
    checkClientsSansAbonnement(supabase),
    checkCoherenceCA(supabase),
    checkMatching(supabase),
    checkSuspiciousSocialPrices(supabase)
  ]);

  return {
    orphelins,
    clientsSansAbo,
    coherenceCA,
    matching,
    prixSuspects,
    timestamp: new Date().toISOString()
  };
}

/**
 * 1. Vérifie les abonnements orphelins
 * Un abonnement est orphelin si son client_id pointe vers un client inexistant ou inactif
 * @param {Object} supabase
 */
async function checkOrphelins(supabase) {
  // Récupérer tous les abonnements avec leur client
  const { data: abonnements, error } = await supabase
    .from('abonnements')
    .select('id, pennylane_subscription_id, label, status, total_ht, client_id, clients(id, nom, actif)');

  if (error) throw new Error(`Erreur récupération abonnements: ${error.message}`);

  const orphelins = [];
  const clientsInactifs = [];

  for (const abo of abonnements || []) {
    if (!abo.clients) {
      // client_id pointe vers un client qui n'existe plus
      orphelins.push({
        abonnement_id: abo.id,
        pennylane_subscription_id: abo.pennylane_subscription_id,
        label: abo.label,
        status: abo.status,
        total_ht: abo.total_ht,
        client_id: abo.client_id,
        raison: 'Client inexistant'
      });
    } else if (!abo.clients.actif) {
      // client existe mais est inactif
      clientsInactifs.push({
        abonnement_id: abo.id,
        pennylane_subscription_id: abo.pennylane_subscription_id,
        label: abo.label,
        status: abo.status,
        total_ht: abo.total_ht,
        client_id: abo.client_id,
        client_nom: abo.clients.nom,
        raison: 'Client inactif'
      });
    }
  }

  return {
    count: orphelins.length,
    countInactifs: clientsInactifs.length,
    details: orphelins,
    detailsInactifs: clientsInactifs
  };
}

/**
 * 2. Identifie les clients actifs sans abonnement
 * Distingue : liés à Pennylane sans abo / pas liés à Pennylane du tout
 * @param {Object} supabase
 */
async function checkClientsSansAbonnement(supabase) {
  // Tous les clients actifs
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, nom, cabinet, pennylane_customer_id, pennylane_id, siren')
    .eq('actif', true)
    .order('nom');

  if (clientsError) throw new Error(`Erreur récupération clients: ${clientsError.message}`);

  // IDs des clients ayant au moins un abonnement actif (in_progress ou not_started)
  const { data: aboActifs, error: aboError } = await supabase
    .from('abonnements')
    .select('client_id')
    .in('status', ['in_progress', 'not_started']);

  if (aboError) throw new Error(`Erreur récupération abonnements: ${aboError.message}`);

  const clientsAvecAboActif = new Set((aboActifs || []).map(a => a.client_id));

  // Aussi récupérer les clients avec n'importe quel abonnement (y compris stopped)
  const { data: aboTous } = await supabase
    .from('abonnements')
    .select('client_id');

  const clientsAvecAboTous = new Set((aboTous || []).map(a => a.client_id));

  const details = [];
  let plSansAbo = 0;
  let pasDansPl = 0;

  for (const client of clients || []) {
    if (clientsAvecAboActif.has(client.id)) continue;

    const aAboStopped = clientsAvecAboTous.has(client.id);
    const liePennylane = !!client.pennylane_customer_id || !!client.pennylane_id;

    let statut;
    if (aAboStopped) {
      statut = 'Abonnements tous arrêtés';
    } else if (liePennylane) {
      statut = 'PL sans abo';
      plSansAbo++;
    } else {
      statut = 'Pas dans PL';
      pasDansPl++;
    }

    details.push({
      id: client.id,
      nom: client.nom,
      cabinet: client.cabinet,
      siren: client.siren,
      pennylane_customer_id: client.pennylane_customer_id,
      pennylane_id: client.pennylane_id,
      statut,
      a_abo_stopped: aAboStopped
    });
  }

  return {
    total: details.length,
    plSansAbo,
    pasDansPl,
    aboStoppes: details.filter(d => d.a_abo_stopped).length,
    details
  };
}

/**
 * 3. Vérifie la cohérence du CA total
 * Le CA devrait être entre 2M et 2.5M€ (abonnements actifs uniquement)
 * @param {Object} supabase
 */
async function checkCoherenceCA(supabase) {
  // Abonnements actifs (in_progress + not_started) — PAS les stopped/finished
  const { data: abonnements, error } = await supabase
    .from('abonnements')
    .select('id, client_id, label, status, frequence, intervalle, total_ht, total_ttc, clients(id, nom, cabinet)');

  if (error) throw new Error(`Erreur récupération abonnements: ${error.message}`);

  const actifs = (abonnements || []).filter(a => a.status === 'in_progress' || a.status === 'not_started');
  const stopped = (abonnements || []).filter(a => a.status === 'stopped' || a.status === 'finished');

  // Calcul CA annuel des abonnements actifs
  let totalHT = 0;
  let totalMensuelHT = 0;
  const parCabinet = {};
  const parStatut = {};

  for (const abo of actifs) {
    const ht = abo.total_ht || 0;
    totalHT += ht;

    // Mensuel
    const mensuel = abo.frequence === 'yearly'
      ? ht / (abo.intervalle || 1) / 12
      : ht / (abo.intervalle || 1);
    totalMensuelHT += mensuel;

    // Par cabinet
    const cab = abo.clients?.cabinet || 'Inconnu';
    parCabinet[cab] = (parCabinet[cab] || 0) + ht;

    // Par statut
    parStatut[abo.status] = (parStatut[abo.status] || 0) + ht;
  }

  // CA annualisé (mensuel x 12)
  const caAnnualise = totalMensuelHT * 12;

  // Clients uniques avec abonnements actifs
  const clientsUniques = new Set(actifs.map(a => a.client_id));

  return {
    totalHT,
    totalMensuelHT,
    caAnnualise,
    nbAbonnements: actifs.length,
    nbAbonnementsStopped: stopped.length,
    nbClients: clientsUniques.size,
    dansPlage: caAnnualise >= 2_000_000 && caAnnualise <= 2_500_000,
    parCabinet,
    parStatut
  };
}

/**
 * 4. Vérifie le matching complet abonnements ↔ clients
 * @param {Object} supabase
 */
async function checkMatching(supabase) {
  // Tous les abonnements
  const { data: abonnements, error: aboError } = await supabase
    .from('abonnements')
    .select('id, client_id, pennylane_subscription_id, label, status, total_ht, clients(id, nom, actif, cabinet)');

  if (aboError) throw new Error(`Erreur récupération abonnements: ${aboError.message}`);

  // Clients uniques avec abonnements
  const clientIds = new Set();
  let abonnementsAvecClient = 0;
  let abonnementsSansClient = 0;
  const clientsInactifsAvecAbo = [];
  const doublonsSubscriptionId = [];

  // Vérifier les doublons de pennylane_subscription_id
  const subscriptionIdCount = {};
  for (const abo of abonnements || []) {
    const sid = abo.pennylane_subscription_id;
    subscriptionIdCount[sid] = (subscriptionIdCount[sid] || 0) + 1;
  }

  for (const abo of abonnements || []) {
    if (abo.clients) {
      abonnementsAvecClient++;
      clientIds.add(abo.client_id);

      if (!abo.clients.actif) {
        clientsInactifsAvecAbo.push({
          abonnement_id: abo.id,
          label: abo.label,
          status: abo.status,
          total_ht: abo.total_ht,
          client_id: abo.client_id,
          client_nom: abo.clients.nom,
          client_cabinet: abo.clients.cabinet
        });
      }
    } else {
      abonnementsSansClient++;
    }

    // Doublons subscription_id
    if (subscriptionIdCount[abo.pennylane_subscription_id] > 1) {
      doublonsSubscriptionId.push({
        abonnement_id: abo.id,
        pennylane_subscription_id: abo.pennylane_subscription_id,
        label: abo.label,
        status: abo.status,
        client_id: abo.client_id,
        client_nom: abo.clients?.nom
      });
    }
  }

  return {
    abonnementsTotal: (abonnements || []).length,
    abonnementsAvecClient,
    abonnementsSansClient,
    clientsAvecAbo: clientIds.size,
    clientsInactifsAvecAbo,
    doublonsSubscriptionId
  };
}

/**
 * 5. Vérifie les prix social suspects (bulletin ↔ forfait)
 * Détecte les incohérences entre la classification et le prix unitaire :
 * - Bulletin > 30€ → probable forfait classé en bulletin
 * - Bulletin < 1€ → erreur probable (quantité/montant inversés)
 * - Forfait < 30€ → probable bulletin classé en forfait
 * @param {Object} supabase
 */
async function checkSuspiciousSocialPrices(supabase) {
  // Récupérer les abonnements actifs avec leurs lignes
  const { data: abonnements, error } = await supabase
    .from('abonnements')
    .select(`
      id, client_id, pennylane_subscription_id, label, status, frequence, intervalle,
      clients(id, nom, cabinet, mode_facturation_social),
      abonnements_lignes(id, label, famille, quantite, montant_ht, montant_ttc, description)
    `)
    .in('status', ['in_progress', 'not_started']);

  if (error) throw new Error(`Erreur récupération abonnements: ${error.message}`);

  const alertes = [];

  // Regrouper les lignes par client pour détecter le mode social
  const lignesParClient = new Map();
  for (const abo of abonnements || []) {
    const cid = abo.client_id;
    if (!lignesParClient.has(cid)) lignesParClient.set(cid, []);
    for (const ligne of (abo.abonnements_lignes || [])) {
      lignesParClient.get(cid).push(ligne);
    }
  }

  const clientModes = new Map();
  for (const [clientId, lignes] of lignesParClient) {
    clientModes.set(clientId, detectModeFacturationSocial(lignes));
  }

  // Classifier chaque ligne et vérifier les prix
  for (const abo of abonnements || []) {
    const modeSocial = clientModes.get(abo.client_id) || 'forfait';
    const clientNom = abo.clients?.nom || abo.label || '';
    const clientCabinet = abo.clients?.cabinet || '-';

    for (const ligne of (abo.abonnements_lignes || [])) {
      const axe = classifierLigne(ligne, modeSocial);
      if (axe !== 'social_bulletin' && axe !== 'social_forfait') continue;

      const quantite = ligne.quantite || 1;
      const montantHt = ligne.montant_ht || 0;
      const prixUnitaire = quantite > 0 ? montantHt / quantite : montantHt;

      if (axe === 'social_bulletin') {
        if (prixUnitaire > 0 && prixUnitaire < 1) {
          alertes.push({
            severity: 'warning',
            client_id: abo.client_id,
            client_nom: clientNom,
            client_cabinet: clientCabinet,
            axe,
            label: ligne.label,
            quantite,
            montant_ht: montantHt,
            prix_unitaire: prixUnitaire,
            message: `Prix bulletin anormalement bas (${prixUnitaire.toFixed(2)}€) — vérifier quantité/montant`
          });
        } else if (prixUnitaire > 30) {
          alertes.push({
            severity: 'error',
            client_id: abo.client_id,
            client_nom: clientNom,
            client_cabinet: clientCabinet,
            axe,
            label: ligne.label,
            quantite,
            montant_ht: montantHt,
            prix_unitaire: prixUnitaire,
            message: `Prix bulletin élevé (${prixUnitaire.toFixed(2)}€ > 30€) — probable forfait classé en bulletin`
          });
        }
      }

      if (axe === 'social_forfait') {
        if (prixUnitaire > 0 && prixUnitaire < 30) {
          alertes.push({
            severity: 'warning',
            client_id: abo.client_id,
            client_nom: clientNom,
            client_cabinet: clientCabinet,
            axe,
            label: ligne.label,
            quantite,
            montant_ht: montantHt,
            prix_unitaire: prixUnitaire,
            message: `Prix forfait social bas (${prixUnitaire.toFixed(2)}€ < 30€) — probable bulletin classé en forfait`
          });
        }
      }
    }
  }

  // Détecter les clients mixtes (forfait + bulletin sur le même client)
  // Un client ne devrait normalement avoir qu'un seul mode social
  const clientAxes = new Map(); // client_id → Set<axe>
  for (const abo of abonnements || []) {
    const modeSocial = clientModes.get(abo.client_id) || 'forfait';
    for (const ligne of (abo.abonnements_lignes || [])) {
      const axe = classifierLigne(ligne, modeSocial);
      if (axe !== 'social_bulletin' && axe !== 'social_forfait') continue;
      if (!clientAxes.has(abo.client_id)) {
        clientAxes.set(abo.client_id, {
          axes: new Set(),
          nom: abo.clients?.nom || abo.label || '',
          cabinet: abo.clients?.cabinet || '-',
          lignes: []
        });
      }
      const info = clientAxes.get(abo.client_id);
      info.axes.add(axe);
      info.lignes.push({ label: ligne.label, montant_ht: ligne.montant_ht || 0, axe });
    }
  }

  for (const [clientId, info] of clientAxes) {
    if (info.axes.has('social_forfait') && info.axes.has('social_bulletin')) {
      const forfaitLines = info.lignes.filter(l => l.axe === 'social_forfait');
      const bulletinLines = info.lignes.filter(l => l.axe === 'social_bulletin');
      const detail = [
        ...forfaitLines.map(l => `Forfait: "${l.label}" ${l.montant_ht.toFixed(2)}€`),
        ...bulletinLines.map(l => `Bulletin: "${l.label}" ${l.montant_ht.toFixed(2)}€`)
      ].join(' + ');
      alertes.push({
        severity: 'warning',
        client_id: clientId,
        client_nom: info.nom,
        client_cabinet: info.cabinet,
        axe: 'mixte',
        label: 'Client mixte forfait + bulletin',
        quantite: null,
        montant_ht: null,
        prix_unitaire: null,
        message: `Client mixte forfait + bulletin — vérifier la cohérence : ${detail}`
      });
    }
  }

  return {
    count: alertes.length,
    errors: alertes.filter(a => a.severity === 'error').length,
    warnings: alertes.filter(a => a.severity === 'warning').length,
    details: alertes
  };
}
