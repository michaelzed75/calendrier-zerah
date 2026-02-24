// @ts-check

/**
 * @file Service de synchronisation des honoraires
 * Synchronise les customers et abonnements Pennylane avec la base Supabase.
 *
 * Processus de matching :
 * 1. Récupère les customers Pennylane
 * 2. Match avec les clients existants par pennylane_customer_id (UUID) ou nom
 * 3. Met à jour pennylane_customer_id (= external_reference UUID de Pennylane)
 * 4. Récupère les abonnements et leurs lignes
 * 5. Insère/met à jour dans les tables abonnements et abonnements_lignes
 *
 * Note: pennylane_customer_id stocke l'UUID (external_reference de l'API Pennylane),
 * pas l'ID numérique interne de Pennylane.
 */

import { fetchAllDataForSync, getSubscriptionInvoiceLines } from './pennylaneCustomersApi.js';

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
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/[^a-z0-9]/g, '') // Garde uniquement lettres et chiffres
    .trim();
}

/**
 * @typedef {Object} SyncResult
 * @property {number} customersMatched - Nombre de customers matchés (avec abonnements)
 * @property {number} customersNotMatched - Nombre de customers non matchés (avec abonnements)
 * @property {number} customersWithoutSubscription - Nombre de customers sans abonnement (ignorés)
 * @property {number} abonnementsCreated - Nombre d'abonnements créés
 * @property {number} abonnementsUpdated - Nombre d'abonnements mis à jour
 * @property {number} lignesCreated - Nombre de lignes créées
 * @property {Object[]} unmatchedCustomers - Liste des customers non matchés (avec abonnements)
 * @property {Object[]} customersNoSubscription - Liste des customers sans abonnement
 * @property {string[]} errors - Liste des erreurs
 */

/**
 * @typedef {Object} Client
 * @property {number} id
 * @property {string} nom
 * @property {string} [pennylane_customer_id] - UUID Pennylane (external_reference de l'API)
 * @property {string} [code_silae]
 */

/**
 * Supprime les suffixes juridiques courants d'un nom
 * @param {string} name - Nom à nettoyer (déjà normalisé, sans espaces)
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
    // Supprimer le suffixe s'il est à la fin (avec ou sans espace)
    result = result.replace(new RegExp(`\\s*${suffix}$`, 'g'), '');
    // Supprimer le suffixe s'il est au début (avec ou sans espace)
    result = result.replace(new RegExp(`^${suffix}\\s*`, 'g'), '');
  }
  return result.trim();
}

/**
 * Match un customer Pennylane avec un client local
 * Stratégie de matching (SIREN = clé universelle prioritaire) :
 * 1. Par pennylane_customer_id existant (= external_reference UUID)
 * 2. Par SIREN (reg_no Pennylane = siren client) — CLÉ UNIVERSELLE
 * 3. Par nom normalisé (exact)
 * 4. Par nom sans suffixes juridiques (exact)
 * 5. Par nom normalisé (contient)
 * 6. Par nom sans suffixes (contient)
 *
 * @param {Object} customer - Customer Pennylane (avec reg_no = SIREN)
 * @param {Client[]} clients - Liste des clients locaux
 * @returns {Client|null} Client matché ou null
 */
function matchCustomerToClient(customer, clients) {
  // 1. Match par pennylane_customer_id existant (= external_reference UUID)
  if (customer.external_reference) {
    const matchByUUID = clients.find(
      c => c.pennylane_customer_id && c.pennylane_customer_id === customer.external_reference
    );
    if (matchByUUID) return matchByUUID;
  }

  // 2. Match par SIREN (CLÉ UNIVERSELLE) — reg_no de Pennylane = SIREN du client
  if (customer.reg_no) {
    const sirenClean = customer.reg_no.replace(/\s/g, '').trim();
    if (sirenClean && /^\d{9}$/.test(sirenClean)) {
      const matchBySiren = clients.find(
        c => c.siren && c.siren === sirenClean
      );
      if (matchBySiren) return matchBySiren;
    }
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

  // 5. Match par nom normalisé (le client contient le nom du customer ou inversement)
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
 * @returns {string} Famille ('comptabilite', 'social', 'juridique', 'support')
 */
function getFamilleFromLabel(label, produitsFacturation) {
  if (!label) return 'support';

  // Chercher dans la table produits_facturation
  const produit = produitsFacturation.find(
    p => normalizeString(p.label) === normalizeString(label)
  );
  if (produit) return produit.famille;

  // Fallback : détection par mots-clés
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

/**
 * Synchronise les customers Pennylane avec les clients locaux
 * @param {Object} supabase - Client Supabase
 * @param {string} apiKey - Clé API Pennylane
 * @param {string} [cabinet] - Cabinet associé à cette clé API (met à jour le cabinet des clients matchés)
 * @param {function} [onProgress] - Callback de progression
 * @returns {Promise<SyncResult>} Résultat de la synchronisation
 */
export async function syncCustomersAndSubscriptions(supabase, apiKey, cabinet = null, onProgress = null) {
  const result = {
    customersMatched: 0,
    customersNotMatched: 0,
    customersWithoutSubscription: 0,
    abonnementsCreated: 0,
    abonnementsUpdated: 0,
    lignesCreated: 0,
    unmatchedCustomers: [],
    customersNoSubscription: [],
    errors: []
  };

  const report = (step, message, current = 0, total = 0) => {
    if (onProgress) {
      onProgress({ step, message, current, total });
    }
  };

  try {
    // 1. Récupérer les clients locaux
    report('init', 'Récupération des clients locaux...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, nom, pennylane_customer_id, code_silae, cabinet, siren')
      .eq('actif', true);

    if (clientsError) {
      throw new Error(`Erreur récupération clients: ${clientsError.message}`);
    }

    // 2. Récupérer les produits de facturation pour le mapping famille
    const { data: produitsFacturation } = await supabase
      .from('produits_facturation')
      .select('label, famille');

    // 3. Récupérer les données Pennylane
    const { customers, subscriptions } = await fetchAllDataForSync(apiKey, onProgress);

    // 4. Identifier les customers qui ont au moins un abonnement
    // On ne matche que ceux-là pour éviter les doublons sans activité
    const customerIdsWithSubscription = new Set(
      subscriptions.map(sub => sub.customer?.id).filter(Boolean)
    );

    report('matching', `${customerIdsWithSubscription.size} customers avec abonnements sur ${customers.length} total`);

    // 5. Matcher et mettre à jour les clients (uniquement ceux avec abonnements)
    report('matching', 'Matching des customers avec les clients...');
    const customerToClientMap = new Map(); // customer.id (numérique) -> client.id

    for (const customer of customers) {
      // Vérifier si ce customer a au moins un abonnement
      if (!customerIdsWithSubscription.has(customer.id)) {
        // Customer sans abonnement : on l'ignore mais on le note
        result.customersWithoutSubscription++;
        result.customersNoSubscription.push({
          id: customer.id,
          name: customer.name,
          external_reference: customer.external_reference
        });
        continue;
      }

      const matchedClient = matchCustomerToClient(customer, clients);

      if (matchedClient) {
        // On garde la map avec l'ID numérique pour le matching des abonnements
        customerToClientMap.set(customer.id, matchedClient.id);
        result.customersMatched++;

        // Mettre à jour le client avec l'UUID Pennylane (external_reference)
        const updateData = {
          pennylane_customer_id: customer.external_reference || null
        };
        // Si un cabinet est spécifié, mettre à jour le cabinet du client
        if (cabinet) {
          updateData.cabinet = cabinet;
        }
        const { error: updateError } = await supabase
          .from('clients')
          .update(updateData)
          .eq('id', matchedClient.id);

        if (updateError) {
          result.errors.push(`Erreur update client ${matchedClient.nom}: ${updateError.message}`);
        }
      } else {
        result.customersNotMatched++;
        result.unmatchedCustomers.push({
          id: customer.id,
          name: customer.name,
          external_reference: customer.external_reference
        });
      }
    }

    report('matching', `Matching terminé: ${result.customersMatched} matchés, ${result.customersNotMatched} non matchés, ${result.customersWithoutSubscription} ignorés (sans abonnement)`);

    // 5. Synchroniser les abonnements
    report('subscriptions', 'Synchronisation des abonnements...');
    let subsProcessed = 0;

    for (const sub of subscriptions) {
      subsProcessed++;
      report('subscriptions', `Traitement abonnement ${subsProcessed}/${subscriptions.length}...`, subsProcessed, subscriptions.length);

      const clientId = customerToClientMap.get(sub.customer?.id);

      if (!clientId) {
        // Customer non matché, on skip cet abonnement
        continue;
      }

      // Préparer les données de l'abonnement
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
        // Update
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
        // Insert
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

      // 6. Récupérer et insérer les lignes de facturation
      try {
        const lines = await getSubscriptionInvoiceLines(apiKey, sub.id);

        // Supprimer les anciennes lignes
        await supabase
          .from('abonnements_lignes')
          .delete()
          .eq('abonnement_id', abonnementId);

        // Insérer les nouvelles lignes
        for (const line of lines) {
          const ligneData = {
            abonnement_id: abonnementId,
            pennylane_line_id: line.id || null,
            label: line.label,
            famille: getFamilleFromLabel(line.label, produitsFacturation || []),
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
      } catch (lineError) {
        result.errors.push(`Erreur récupération lignes abonnement ${sub.id}: ${lineError.message}`);
      }

      // Petite pause pour éviter le rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    report('done', 'Synchronisation terminée !');

  } catch (error) {
    result.errors.push(`Erreur générale: ${error.message}`);
    report('error', `Erreur: ${error.message}`);
  }

  return result;
}

/**
 * Récupère un résumé des honoraires par client
 * @param {Object} supabase - Client Supabase
 * @param {number} [clientId] - ID client optionnel (tous si non spécifié)
 * @param {Object} [options] - Options de filtrage
 * @param {boolean} [options.includesStopped=false] - Inclure les abonnements stopped/finished
 * @returns {Promise<Object[]>} Résumé des honoraires
 */
export async function getHonorairesResume(supabase, clientId = null, options = {}) {
  const { includeStopped = false } = options;

  let query = supabase
    .from('abonnements')
    .select(`
      id,
      pennylane_subscription_id,
      label,
      status,
      frequence,
      intervalle,
      jour_facturation,
      date_debut,
      mode_finalisation,
      conditions_paiement,
      moyen_paiement,
      total_ttc,
      total_ht,
      client_id,
      clients (id, nom, cabinet, mode_facturation_social, pennylane_customer_id),
      abonnements_lignes (
        id,
        label,
        famille,
        quantite,
        montant_ttc,
        montant_ht,
        taux_tva,
        description
      )
    `);

  // Par défaut, exclure les abonnements stopped/finished pour éviter de gonfler les totaux.
  // Les stopped sont d'anciens abonnements remplacés — les compter double le CA.
  if (!includeStopped) {
    query = query.in('status', ['in_progress', 'not_started']);
  }

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erreur récupération honoraires: ${error.message}`);
  }

  // Calculer les totaux par famille pour chaque abonnement
  return data.map(abo => {
    const totauxParFamille = {
      comptabilite: 0,
      social: 0,
      juridique: 0,
      support: 0
    };

    (abo.abonnements_lignes || []).forEach(ligne => {
      if (ligne.famille && totauxParFamille[ligne.famille] !== undefined) {
        totauxParFamille[ligne.famille] += ligne.montant_ht || 0;
      }
    });

    return {
      ...abo,
      totaux_par_famille: totauxParFamille,
      // Calcul du montant mensuel (si annuel, diviser par 12)
      montant_mensuel_ht: abo.frequence === 'yearly'
        ? abo.total_ht / (abo.intervalle || 1) / 12
        : abo.total_ht / (abo.intervalle || 1)
    };
  });
}
