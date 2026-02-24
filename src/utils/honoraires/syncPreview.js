// @ts-check

/**
 * @file Service de prévisualisation et validation de la synchronisation Pennylane
 * Permet de comparer les données Pennylane avec la base locale AVANT d'écrire,
 * puis de valider ou rejeter les changements.
 */

import { fetchAllDataForSync, getSubscriptionInvoiceLines } from './pennylaneCustomersApi.js';
import {
  normalizeString,
  removeJuridicalSuffixes,
  getFamilleFromLabel
} from './syncHonoraires.js';

// ============================================================
// MATCHING AVEC NIVEAU
// ============================================================

/**
 * Match un customer Pennylane avec un client local et retourne le niveau de matching.
 * Reprend la même logique que matchCustomerToClient mais expose le niveau.
 *
 * @param {Object} customer - Customer Pennylane
 * @param {Object[]} clients - Clients locaux
 * @returns {{ client: Object, level: string } | null}
 */
function matchCustomerToClientWithLevel(customer, clients) {
  // 1. Par UUID (pennylane_customer_id = external_reference)
  if (customer.external_reference) {
    const match = clients.find(
      c => c.pennylane_customer_id && c.pennylane_customer_id === customer.external_reference
    );
    if (match) return { client: match, level: 'uuid' };
  }

  // 2. Par SIREN (clé universelle)
  if (customer.reg_no) {
    const sirenClean = customer.reg_no.replace(/\s/g, '').trim();
    if (sirenClean && /^\d{9}$/.test(sirenClean)) {
      const match = clients.find(c => c.siren && c.siren === sirenClean);
      if (match) return { client: match, level: 'siren' };
    }
  }

  // 3. Nom normalisé (exact)
  const customerNameNorm = normalizeString(customer.name);
  const match3 = clients.find(c => normalizeString(c.nom) === customerNameNorm);
  if (match3) return { client: match3, level: 'name_exact' };

  // 4. Nom sans suffixes juridiques (exact)
  const customerNameClean = removeJuridicalSuffixes(normalizeString(customer.name));
  const match4 = clients.find(
    c => removeJuridicalSuffixes(normalizeString(c.nom)) === customerNameClean
  );
  if (match4) return { client: match4, level: 'name_clean' };

  // 5. Nom normalisé (partiel)
  const match5 = clients.find(c => {
    const n = normalizeString(c.nom);
    return n.includes(customerNameNorm) || customerNameNorm.includes(n);
  });
  if (match5) return { client: match5, level: 'name_partial' };

  // 6. Nom sans suffixes (partiel)
  const match6 = clients.find(c => {
    const cn = removeJuridicalSuffixes(normalizeString(c.nom));
    return cn.includes(customerNameClean) || customerNameClean.includes(cn);
  });
  if (match6) return { client: match6, level: 'name_clean_partial' };

  return null;
}

/**
 * Label lisible pour le niveau de matching
 */
const MATCH_LEVEL_LABELS = {
  uuid: 'UUID Pennylane',
  siren: 'SIREN',
  name_exact: 'Nom exact',
  name_clean: 'Nom (sans forme jur.)',
  name_partial: 'Nom partiel',
  name_clean_partial: 'Nom partiel (sans forme jur.)'
};

// ============================================================
// PREVIEW SYNC (dry run — lecture seule)
// ============================================================

/**
 * Effectue une prévisualisation de la synchronisation Pennylane.
 * Compare les données Pennylane avec la base locale et produit un rapport détaillé.
 * NE MODIFIE PAS LA BASE.
 *
 * @param {Object} supabase - Client Supabase
 * @param {string} apiKey - Clé API Pennylane
 * @param {string} cabinet - Cabinet ('Zerah Fiduciaire' | 'Audit Up')
 * @param {function} [onProgress] - Callback de progression
 * @returns {Promise<Object>} SyncPreviewReport
 */
export async function previewSync(supabase, apiKey, cabinet, onProgress = null) {
  const report = (step, message, current = 0, total = 0) => {
    if (onProgress) onProgress({ step, message, current, total });
  };

  // ---- 1. Charger les données locales ----
  report('init', 'Chargement des données locales...');

  const [
    { data: allLocalClients },
    { data: localAbonnements },
    { data: localLignes },
    { data: produitsFacturation }
  ] = await Promise.all([
    supabase.from('clients').select('id, nom, pennylane_customer_id, code_silae, cabinet, siren, actif'),
    supabase.from('abonnements').select('id, client_id, pennylane_subscription_id, label, status, frequence, intervalle, total_ht, total_ttc, total_tva, synced_at'),
    supabase.from('abonnements_lignes').select('id, abonnement_id, pennylane_line_id, label, famille, quantite, montant_ht, montant_ttc, montant_tva, taux_tva, description'),
    supabase.from('produits_facturation').select('label, famille')
  ]);

  // Séparer actifs et inactifs — seuls les actifs sont matchés pour la sync
  const localClients = (allLocalClients || []).filter(c => c.actif);
  const inactiveClients = (allLocalClients || []).filter(c => !c.actif);

  // Index pour lookup rapide
  const aboByPLId = new Map();
  for (const abo of (localAbonnements || [])) {
    if (abo.pennylane_subscription_id) {
      aboByPLId.set(abo.pennylane_subscription_id, abo);
    }
  }

  const lignesByAboId = new Map();
  for (const ligne of (localLignes || [])) {
    if (!lignesByAboId.has(ligne.abonnement_id)) {
      lignesByAboId.set(ligne.abonnement_id, []);
    }
    lignesByAboId.get(ligne.abonnement_id).push(ligne);
  }

  // ---- 2. Récupérer les données Pennylane ----
  report('fetch', 'Récupération des données Pennylane...');
  const { customers, subscriptions } = await fetchAllDataForSync(apiKey, onProgress);

  // Identifier les customers avec abonnements
  const customerIdsWithSub = new Set(
    subscriptions.map(sub => sub.customer?.id).filter(Boolean)
  );

  // ---- 3. Matching customers → clients locaux ----
  report('matching', 'Matching des customers...');
  const customerToClientMap = new Map(); // customer.id → { client, level }
  const clientsMatches = [];
  const clientsNew = [];
  const clientsNoSubscription = [];

  for (const customer of customers) {
    if (!customerIdsWithSub.has(customer.id)) {
      clientsNoSubscription.push({ id: customer.id, name: customer.name, external_reference: customer.external_reference });
      continue;
    }

    const matchResult = matchCustomerToClientWithLevel(customer, localClients || []);

    if (matchResult) {
      customerToClientMap.set(customer.id, matchResult);
      const cabinetChange = (matchResult.client.cabinet && matchResult.client.cabinet !== cabinet)
        ? { ancien: matchResult.client.cabinet, nouveau: cabinet }
        : null;
      clientsMatches.push({
        customer: { id: customer.id, name: customer.name, external_reference: customer.external_reference, reg_no: customer.reg_no },
        client: matchResult.client,
        level: matchResult.level,
        levelLabel: MATCH_LEVEL_LABELS[matchResult.level] || matchResult.level,
        cabinetChange
      });
    } else {
      clientsNew.push({
        customer: { id: customer.id, name: customer.name, external_reference: customer.external_reference, reg_no: customer.reg_no }
      });
    }
  }

  // Clients locaux actifs du même cabinet qui n'ont aucun match Pennylane
  const matchedClientIds = new Set(clientsMatches.map(m => m.client.id));
  const clientsMissing = (localClients || [])
    .filter(c => c.cabinet === cabinet && !matchedClientIds.has(c.id))
    .map(c => ({ client: c }));

  // ---- 4. Récupérer les lignes de chaque abonnement ----
  report('lines', 'Récupération des lignes de facturation...');
  const linesMap = new Map(); // subscription.id → InvoiceLine[]
  let linesFetched = 0;

  for (const sub of subscriptions) {
    const clientMatch = customerToClientMap.get(sub.customer?.id);
    if (!clientMatch) continue; // pas de client matché = skip

    try {
      const lines = await getSubscriptionInvoiceLines(apiKey, sub.id);
      linesMap.set(sub.id, lines);
    } catch (err) {
      linesMap.set(sub.id, []);
    }

    linesFetched++;
    if (linesFetched % 5 === 0) {
      report('lines', `Récupération des lignes... (${linesFetched}/${subscriptions.length})`, linesFetched, subscriptions.length);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // ---- 5. Comparer les abonnements ----
  report('compare', 'Comparaison des données...');
  const abonnementsNew = [];
  const abonnementsUpdated = [];
  const abonnementsStatusChanged = [];
  const plSubIds = new Set();

  for (const sub of subscriptions) {
    const clientMatch = customerToClientMap.get(sub.customer?.id);
    if (!clientMatch) continue;

    plSubIds.add(sub.id);
    const existing = aboByPLId.get(sub.id);

    const subData = {
      pennylane_subscription_id: sub.id,
      label: sub.label,
      status: sub.status,
      frequence: sub.recurring_rule?.rule_type || null,
      intervalle: sub.recurring_rule?.interval || 1,
      total_ht: parseFloat(sub.customer_invoice_data?.currency_amount_before_tax) || 0,
      total_ttc: parseFloat(sub.customer_invoice_data?.amount) || 0,
      total_tva: parseFloat(sub.customer_invoice_data?.currency_tax) || 0,
      clientName: clientMatch.client.nom
    };

    if (!existing) {
      abonnementsNew.push({ subscription: subData, clientMatch });
    } else {
      // Comparer les champs clés
      const changes = {};
      if (existing.label !== subData.label) changes.label = { old: existing.label, new: subData.label };
      if (existing.status !== subData.status) changes.status = { old: existing.status, new: subData.status };
      if (existing.frequence !== subData.frequence) changes.frequence = { old: existing.frequence, new: subData.frequence };
      if (existing.intervalle !== subData.intervalle) changes.intervalle = { old: existing.intervalle, new: subData.intervalle };

      const oldHT = parseFloat(existing.total_ht) || 0;
      const newHT = subData.total_ht;
      if (Math.abs(oldHT - newHT) > 0.01) {
        changes.total_ht = { old: oldHT, new: newHT, delta: newHT - oldHT };
      }

      if (Object.keys(changes).length > 0) {
        abonnementsUpdated.push({ subscription: subData, existing, changes, clientMatch });
      }

      if (existing.status !== subData.status) {
        abonnementsStatusChanged.push({
          subscription: subData,
          existing,
          oldStatus: existing.status,
          newStatus: subData.status,
          clientMatch
        });
      }
    }
  }

  // Abonnements locaux qui n'existent plus dans Pennylane (pour ce cabinet)
  const matchedClientIdsForCabinet = new Set(
    clientsMatches.map(m => m.client.id)
  );
  const abonnementsDisappeared = (localAbonnements || [])
    .filter(abo => {
      if (!matchedClientIdsForCabinet.has(abo.client_id)) return false;
      if (!abo.pennylane_subscription_id) return false;
      return !plSubIds.has(abo.pennylane_subscription_id);
    })
    .map(abo => {
      const client = (localClients || []).find(c => c.id === abo.client_id);
      return { existing: abo, clientName: client?.nom || 'Inconnu' };
    });

  // ---- 6. Comparer les lignes (prix) ----
  const lignesModified = [];
  const lignesNew = [];
  const lignesRemoved = [];

  for (const sub of subscriptions) {
    const clientMatch = customerToClientMap.get(sub.customer?.id);
    if (!clientMatch) continue;

    const existing = aboByPLId.get(sub.id);
    if (!existing) continue; // abo nouveau, pas de comparaison de lignes

    const plLines = linesMap.get(sub.id) || [];
    const dbLines = lignesByAboId.get(existing.id) || [];

    // Matcher les lignes par label normalisé
    const dbLinesByLabel = new Map();
    for (const dl of dbLines) {
      const key = normalizeString(dl.label);
      if (!dbLinesByLabel.has(key)) {
        dbLinesByLabel.set(key, []);
      }
      dbLinesByLabel.get(key).push(dl);
    }

    const matchedDbLineIds = new Set();

    for (const plLine of plLines) {
      const plLabel = normalizeString(plLine.label);
      const candidates = dbLinesByLabel.get(plLabel) || [];

      // Trouver le meilleur match (par quantité si plusieurs)
      let bestMatch = null;
      for (const candidate of candidates) {
        if (matchedDbLineIds.has(candidate.id)) continue;
        bestMatch = candidate;
        break;
      }

      if (bestMatch) {
        matchedDbLineIds.add(bestMatch.id);
        const oldMontant = parseFloat(bestMatch.montant_ht) || 0;
        const newMontant = parseFloat(plLine.currency_amount_before_tax) || 0;
        const oldQte = parseFloat(bestMatch.quantite) || 1;
        const newQte = parseFloat(plLine.quantity) || 1;

        if (Math.abs(oldMontant - newMontant) > 0.01 || Math.abs(oldQte - newQte) > 0.01) {
          const deltaHT = Math.round((newMontant - oldMontant) * 100) / 100;
          const deltaPct = oldMontant > 0
            ? Math.round(((newMontant - oldMontant) / oldMontant) * 10000) / 100
            : 0;
          lignesModified.push({
            clientName: clientMatch.client.nom,
            clientId: clientMatch.client.id,
            abonnementId: existing.id,
            abonnementLabel: existing.label,
            pennylaneLineId: plLine.id,
            label: plLine.label,
            famille: getFamilleFromLabel(plLine.label, produitsFacturation || []),
            oldMontant,
            newMontant,
            oldQte,
            newQte,
            deltaHT,
            deltaPct
          });
        }
      } else {
        // Nouvelle ligne
        lignesNew.push({
          clientName: clientMatch.client.nom,
          abonnementLabel: existing.label,
          label: plLine.label,
          montant_ht: parseFloat(plLine.currency_amount_before_tax) || 0,
          quantite: parseFloat(plLine.quantity) || 1
        });
      }
    }

    // Lignes DB non matchées = supprimées
    for (const dl of dbLines) {
      if (!matchedDbLineIds.has(dl.id)) {
        lignesRemoved.push({
          clientName: clientMatch.client.nom,
          abonnementLabel: existing.label,
          label: dl.label,
          montant_ht: parseFloat(dl.montant_ht) || 0,
          quantite: parseFloat(dl.quantite) || 1
        });
      }
    }
  }

  // ---- 7. Détecter les anomalies ----
  const anomalies = [];

  // Variations de prix > 20%
  for (const lm of lignesModified) {
    if (Math.abs(lm.deltaPct) > 20) {
      anomalies.push({
        type: 'price_variation_high',
        severity: Math.abs(lm.deltaPct) > 50 ? 'error' : 'warning',
        message: `${lm.clientName} — "${lm.label}" : ${lm.deltaPct > 0 ? '+' : ''}${lm.deltaPct.toFixed(1)}% (${lm.oldMontant.toFixed(2)} -> ${lm.newMontant.toFixed(2)} EUR)`,
        details: lm
      });
    }
  }

  // Changements de cabinet
  for (const cm of clientsMatches) {
    if (cm.cabinetChange) {
      anomalies.push({
        type: 'cabinet_mismatch',
        severity: 'warning',
        message: `${cm.client.nom} : cabinet actuel "${cm.cabinetChange.ancien}" sera remplacé par "${cm.cabinetChange.nouveau}"`,
        details: cm
      });
    }
  }

  // Matchings partiels/faibles
  for (const cm of clientsMatches) {
    if (cm.level === 'name_partial' || cm.level === 'name_clean_partial') {
      anomalies.push({
        type: 'weak_match',
        severity: 'warning',
        message: `Match faible : "${cm.customer.name}" (Pennylane) ↔ "${cm.client.nom}" (local) — niveau : ${cm.levelLabel}`,
        details: cm
      });
    }
  }

  // Régressions de statut
  for (const sc of abonnementsStatusChanged) {
    if (sc.oldStatus === 'in_progress' && (sc.newStatus === 'stopped' || sc.newStatus === 'finished')) {
      anomalies.push({
        type: 'status_regression',
        severity: 'info',
        message: `${sc.clientMatch.client.nom} — "${sc.subscription.label}" : ${sc.oldStatus} -> ${sc.newStatus}`,
        details: sc
      });
    }
  }

  // Abonnements disparus
  if (abonnementsDisappeared.length > 0) {
    anomalies.push({
      type: 'subscriptions_disappeared',
      severity: 'warning',
      message: `${abonnementsDisappeared.length} abonnement(s) local(aux) non retrouvé(s) dans Pennylane`,
      details: abonnementsDisappeared
    });
  }

  // Clients inactifs avec abonnements actifs sur Pennylane
  const inactiveWithSubs = [];
  for (const customer of customers) {
    if (!customerIdsWithSub.has(customer.id)) continue;

    // Chercher un match parmi les clients INACTIFS
    const inactiveMatch = matchCustomerToClientWithLevel(customer, inactiveClients);
    if (inactiveMatch) {
      // Compter les abonnements actifs (in_progress) pour ce customer
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
          subscriptions: activeSubs.map(s => ({ label: s.label, status: s.status, total_ht: parseFloat(s.customer_invoice_data?.currency_amount_before_tax) || 0 }))
        });
      }
    }
  }
  if (inactiveWithSubs.length > 0) {
    anomalies.push({
      type: 'inactive_with_subscriptions',
      severity: 'error',
      message: `${inactiveWithSubs.length} client(s) inactif(s) avec abonnement(s) actif(s) sur Pennylane`,
      details: inactiveWithSubs
    });
  }

  // ---- 8. Résumé ----
  const totalDeltaHT = lignesModified.reduce((sum, l) => sum + l.deltaHT, 0);

  const summary = {
    totalCustomers: customers.length,
    customersWithSub: customerIdsWithSub.size,
    matched: clientsMatches.length,
    unmatched: clientsNew.length,
    noSubscription: clientsNoSubscription.length,
    clientsMissing: clientsMissing.length,
    newSubs: abonnementsNew.length,
    updatedSubs: abonnementsUpdated.length,
    disappearedSubs: abonnementsDisappeared.length,
    statusChanges: abonnementsStatusChanged.length,
    priceChanges: lignesModified.length,
    newLines: lignesNew.length,
    removedLines: lignesRemoved.length,
    totalDeltaHT: Math.round(totalDeltaHT * 100) / 100,
    anomaliesCount: anomalies.length
  };

  report('done', 'Analyse terminée !');

  return {
    // Clients
    clientsMatches,
    clientsNew,
    clientsMissing,
    clientsNoSubscription,
    // Abonnements
    abonnementsNew,
    abonnementsUpdated,
    abonnementsDisappeared,
    abonnementsStatusChanged,
    // Lignes
    lignesModified,
    lignesNew,
    lignesRemoved,
    // Anomalies
    anomalies,
    // Résumé
    summary,
    // Données brutes pour le commit (pas de re-fetch API)
    _rawData: {
      customers,
      subscriptions,
      linesMap,
      customerToClientMap,
      produitsFacturation: produitsFacturation || [],
      localAbonnements: localAbonnements || [],
      localLignes: localLignes || []
    }
  };
}

// ============================================================
// COMMIT SYNC (écriture en base)
// ============================================================

/**
 * Applique la synchronisation en base à partir d'un rapport de preview.
 * Utilise les données pré-chargées (pas de re-fetch API).
 * Enregistre aussi l'historique des prix dans historique_prix.
 *
 * @param {Object} supabase - Client Supabase
 * @param {Object} previewReport - Rapport de previewSync()
 * @param {string} cabinet - Cabinet
 * @param {function} [onProgress] - Callback de progression
 * @returns {Promise<Object>} SyncResult
 */
export async function commitSync(supabase, previewReport, cabinet, onProgress = null) {
  const result = {
    customersMatched: 0,
    customersNotMatched: 0,
    customersWithoutSubscription: 0,
    abonnementsCreated: 0,
    abonnementsUpdated: 0,
    lignesCreated: 0,
    historiquePrixCreated: 0,
    unmatchedCustomers: [],
    customersNoSubscription: [],
    errors: []
  };

  const report = (step, message, current = 0, total = 0) => {
    if (onProgress) onProgress({ step, message, current, total });
  };

  const { _rawData, clientsMatches, clientsNew, clientsNoSubscription, lignesModified } = previewReport;
  const { subscriptions, linesMap, customerToClientMap, produitsFacturation } = _rawData;

  try {
    // ---- 1. Mettre à jour les clients ----
    report('clients', 'Mise à jour des clients...');
    for (const match of clientsMatches) {
      const updateData = {
        pennylane_customer_id: match.customer.external_reference || null
      };
      if (cabinet) {
        updateData.cabinet = cabinet;
      }
      const { error: updateError } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', match.client.id);

      if (updateError) {
        result.errors.push(`Erreur update client ${match.client.nom}: ${updateError.message}`);
      }
      result.customersMatched++;
    }

    result.customersNotMatched = clientsNew.length;
    result.unmatchedCustomers = clientsNew.map(c => c.customer);
    result.customersNoSubscription = clientsNoSubscription;
    result.customersWithoutSubscription = clientsNoSubscription.length;

    // ---- 2. Synchroniser les abonnements ----
    report('subscriptions', 'Synchronisation des abonnements...');
    let subsProcessed = 0;

    for (const sub of subscriptions) {
      const matchEntry = customerToClientMap.get(sub.customer?.id);
      if (!matchEntry) continue;

      const clientId = matchEntry.client.id;
      subsProcessed++;
      report('subscriptions', `Traitement abonnement ${subsProcessed}...`, subsProcessed, subscriptions.length);

      const abonnementData = {
        client_id: clientId,
        pennylane_subscription_id: sub.id,
        label: sub.label,
        status: sub.status,
        frequence: sub.recurring_rule?.rule_type || null,
        intervalle: sub.recurring_rule?.interval || 1,
        jour_facturation: sub.recurring_rule?.day_of_month?.[0] === -1 ? 31 : sub.recurring_rule?.day_of_month?.[0],
        date_debut: sub.start || null,
        date_fin: sub.finish || null,
        mode_finalisation: sub.mode || null,
        conditions_paiement: sub.payment_conditions || null,
        moyen_paiement: sub.payment_method || null,
        total_ttc: parseFloat(sub.customer_invoice_data?.amount) || 0,
        total_ht: parseFloat(sub.customer_invoice_data?.currency_amount_before_tax) || 0,
        total_tva: parseFloat(sub.customer_invoice_data?.currency_tax) || 0,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Upsert abonnement
      const { data: existingAbo } = await supabase
        .from('abonnements')
        .select('id')
        .eq('pennylane_subscription_id', sub.id)
        .single();

      let abonnementId;

      if (existingAbo) {
        const { error: updateError } = await supabase
          .from('abonnements')
          .update(abonnementData)
          .eq('id', existingAbo.id);

        if (updateError) {
          result.errors.push(`Erreur update abonnement ${sub.label}: ${updateError.message}`);
          continue;
        }
        abonnementId = existingAbo.id;
        result.abonnementsUpdated++;
      } else {
        abonnementData.created_at = new Date().toISOString();
        const { data: newAbo, error: insertError } = await supabase
          .from('abonnements')
          .insert(abonnementData)
          .select('id')
          .single();

        if (insertError) {
          result.errors.push(`Erreur insert abonnement ${sub.label}: ${insertError.message}`);
          continue;
        }
        abonnementId = newAbo.id;
        result.abonnementsCreated++;
      }

      // ---- 3. Insérer les lignes ----
      const lines = linesMap.get(sub.id);
      if (!lines) continue;

      // Supprimer les anciennes lignes
      await supabase
        .from('abonnements_lignes')
        .delete()
        .eq('abonnement_id', abonnementId);

      // Insérer les nouvelles
      for (const line of lines) {
        const ligneData = {
          abonnement_id: abonnementId,
          pennylane_line_id: line.id || null,
          label: line.label,
          famille: getFamilleFromLabel(line.label, produitsFacturation),
          quantite: parseFloat(line.quantity) || 1,
          montant_ttc: parseFloat(line.amount) || 0,
          montant_ht: parseFloat(line.currency_amount_before_tax) || 0,
          montant_tva: parseFloat(line.currency_tax) || 0,
          taux_tva: line.vat_rate || null,
          description: line.description || null
        };

        const { error: ligneError } = await supabase
          .from('abonnements_lignes')
          .insert(ligneData);

        if (ligneError) {
          result.errors.push(`Erreur insert ligne ${line.label}: ${ligneError.message}`);
        } else {
          result.lignesCreated++;
        }
      }
    }

    // ---- 4. Enregistrer l'historique des prix ----
    if (lignesModified.length > 0) {
      report('history', 'Enregistrement de l\'historique des prix...');

      for (const lm of lignesModified) {
        const historiqueData = {
          client_id: lm.clientId,
          abonnement_id: lm.abonnementId,
          pennylane_line_id: lm.pennylaneLineId,
          label: lm.label,
          famille: lm.famille,
          ancien_montant_ht: lm.oldMontant,
          nouveau_montant_ht: lm.newMontant,
          ancienne_quantite: lm.oldQte,
          nouvelle_quantite: lm.newQte,
          delta_ht: lm.deltaHT,
          delta_pourcentage: lm.deltaPct,
          date_detection: new Date().toISOString(),
          sync_cabinet: cabinet
        };

        const { error: histError } = await supabase
          .from('historique_prix')
          .insert(historiqueData);

        if (histError) {
          result.errors.push(`Erreur historique prix ${lm.label}: ${histError.message}`);
        } else {
          result.historiquePrixCreated++;
        }
      }
    }

    report('done', 'Synchronisation terminée !');

  } catch (error) {
    result.errors.push(`Erreur générale: ${error.message}`);
    report('error', `Erreur: ${error.message}`);
  }

  return result;
}
