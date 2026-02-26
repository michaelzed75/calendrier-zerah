// @ts-check

/**
 * @file Service de restructuration des abonnements Pennylane
 *
 * Phase 2 du plan Honoraires 2026 :
 * - Analyse les abonnements existants (BDD locale) d'un ou plusieurs clients
 * - Sépare les lignes FIXE (restent en abonnement PL) des VARIABLE (à supprimer de PL)
 * - Applique les nouveaux tarifs 2026 (depuis tarifs_reference)
 * - Génère un plan de restructuration : nouvelles souscriptions FIXE + liste des produits VARIABLE à supprimer
 *
 * L'objectif est de ne garder dans Pennylane que les produits à montant fixe
 * (compta, bilan, juridique, etc.) et de basculer les produits variables
 * (bulletins, accessoires social) vers un import mensuel Excel.
 */

/**
 * @typedef {Object} LigneRestructuree
 * @property {number} ligne_id - ID abonnements_lignes
 * @property {string} label
 * @property {string} axe
 * @property {'fixe'|'variable'} type_recurrence
 * @property {number} ancien_pu_ht - Prix unitaire HT 2025 (actuel PL)
 * @property {number} nouveau_pu_ht - Prix unitaire HT 2026 (tarifs_reference)
 * @property {number} quantite
 * @property {string} famille
 * @property {string} [description]
 * @property {'garder'|'supprimer'} action - Garder en abonnement PL ou supprimer
 */

/**
 * @typedef {Object} AbonnementRestructure
 * @property {number} abonnement_id - ID local (abonnements.id)
 * @property {number} pennylane_subscription_id - ID Pennylane
 * @property {string} label - Label de l'abonnement
 * @property {string} status
 * @property {string} frequence
 * @property {number} intervalle
 * @property {number} jour_facturation
 * @property {string} mode_finalisation
 * @property {string} conditions_paiement
 * @property {string} moyen_paiement
 * @property {string} date_debut
 * @property {LigneRestructuree[]} lignes_fixes - Lignes à garder (type_recurrence = fixe)
 * @property {LigneRestructuree[]} lignes_variables - Lignes à supprimer (type_recurrence = variable)
 * @property {'inchange'|'a_modifier'|'a_supprimer'} decision
 *   - 'inchange' : aucune ligne variable → juste mettre à jour les prix fixe
 *   - 'a_modifier' : mix fixe/variable → garder fixe, supprimer variable
 *   - 'a_supprimer' : que du variable → supprimer tout l'abonnement
 */

/**
 * @typedef {Object} PlanRestructurationClient
 * @property {number} client_id
 * @property {string} client_nom
 * @property {string} cabinet
 * @property {string} siren
 * @property {string} pennylane_customer_id
 * @property {AbonnementRestructure[]} abonnements
 * @property {number} total_ht_actuel - Total HT actuel (toutes lignes)
 * @property {number} total_ht_fixe_2026 - Total HT fixe après augmentation 2026
 * @property {number} total_ht_variable_actuel - Total HT variable actuel (sera supprimé)
 * @property {number} nb_lignes_fixes
 * @property {number} nb_lignes_variables
 */

/**
 * Détermine le type de récurrence d'une ligne selon son axe.
 * Cohérent avec tarifsReferenceService.getTypeRecurrence.
 * @param {string} axe
 * @returns {'fixe'|'variable'}
 */
function getTypeRecurrence(axe) {
  const variables = ['social_bulletin', 'accessoires_social'];
  return variables.includes(axe) ? 'variable' : 'fixe';
}

/**
 * Analyse les abonnements d'un client et génère un plan de restructuration.
 *
 * @param {Object} params
 * @param {number} params.clientId - ID du client en base
 * @param {Object} params.supabase - Client Supabase
 * @returns {Promise<PlanRestructurationClient>}
 */
export async function analyserClient(params) {
  const { clientId, supabase } = params;

  // 1. Charger le client
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, nom, cabinet, siren, pennylane_customer_id, actif')
    .eq('id', clientId)
    .single();

  if (clientError || !client) {
    throw new Error(`Client ${clientId} introuvable: ${clientError?.message}`);
  }

  // 2. Charger les abonnements actifs avec leurs lignes
  const { data: abonnements, error: aboError } = await supabase
    .from('abonnements')
    .select(`
      id, label, status, frequence, intervalle, jour_facturation,
      mode_finalisation, conditions_paiement, moyen_paiement, date_debut,
      total_ht, total_ttc, pennylane_subscription_id,
      abonnements_lignes (id, label, quantite, montant_ht, montant_ttc, taux_tva, famille, description)
    `)
    .eq('client_id', clientId)
    .in('status', ['in_progress', 'not_started']);

  if (aboError) {
    throw new Error(`Erreur chargement abonnements: ${aboError.message}`);
  }

  // 3. Charger les tarifs de référence 2026 pour ce client
  const { data: tarifs2026, error: tarifsError } = await supabase
    .from('tarifs_reference')
    .select('label, axe, type_recurrence, pu_ht, quantite, abonnement_ligne_id')
    .eq('client_id', clientId)
    .eq('date_effet', '2026-01-01');

  if (tarifsError) {
    throw new Error(`Erreur chargement tarifs: ${tarifsError.message}`);
  }

  // Index tarifs par ligne_id ET par label (fallback)
  const tarifsByLigneId = new Map();
  const tarifsByLabel = new Map();
  for (const t of (tarifs2026 || [])) {
    if (t.abonnement_ligne_id) {
      tarifsByLigneId.set(t.abonnement_ligne_id, t);
    }
    tarifsByLabel.set(t.label, t);
  }

  // 4. Analyser chaque abonnement
  let totalHtActuel = 0;
  let totalHtFixe2026 = 0;
  let totalHtVariableActuel = 0;
  let nbLignesFixes = 0;
  let nbLignesVariables = 0;

  const abonnementsRestructures = (abonnements || []).map(abo => {
    const lignesFixes = [];
    const lignesVariables = [];

    for (const ligne of (abo.abonnements_lignes || [])) {
      // Trouver le tarif 2026 correspondant
      const tarif = tarifsByLigneId.get(ligne.id) || tarifsByLabel.get(ligne.label);

      const axe = tarif?.axe || null;
      const typeRec = axe ? getTypeRecurrence(axe) : 'fixe'; // Par défaut fixe si pas de tarif
      const ancienPuHt = ligne.quantite > 0
        ? Math.round((ligne.montant_ht / ligne.quantite) * 100) / 100
        : ligne.montant_ht;
      const nouveauPuHt = tarif?.pu_ht || ancienPuHt; // Fallback à l'ancien prix si pas de tarif 2026

      const ligneRestructuree = {
        ligne_id: ligne.id,
        label: ligne.label,
        axe: axe || 'non_classe',
        type_recurrence: typeRec,
        ancien_pu_ht: ancienPuHt,
        nouveau_pu_ht: nouveauPuHt,
        quantite: ligne.quantite || 1,
        famille: ligne.famille || '',
        description: ligne.description || '',
        action: typeRec === 'variable' ? 'supprimer' : 'garder'
      };

      if (typeRec === 'variable') {
        lignesVariables.push(ligneRestructuree);
        totalHtVariableActuel += ligne.montant_ht || 0;
        nbLignesVariables++;
      } else {
        lignesFixes.push(ligneRestructuree);
        totalHtFixe2026 += nouveauPuHt * (ligne.quantite || 1);
        nbLignesFixes++;
      }

      totalHtActuel += ligne.montant_ht || 0;
    }

    // Déterminer la décision pour cet abonnement
    let decision = 'inchange';
    if (lignesVariables.length > 0 && lignesFixes.length > 0) {
      decision = 'a_modifier'; // Mix → garder fixe, supprimer variable
    } else if (lignesVariables.length > 0 && lignesFixes.length === 0) {
      decision = 'a_supprimer'; // 100% variable → supprimer l'abonnement entier
    }
    // Si aucun variable → inchange (juste update prix)

    return {
      abonnement_id: abo.id,
      pennylane_subscription_id: abo.pennylane_subscription_id,
      label: abo.label,
      status: abo.status,
      frequence: abo.frequence || 'monthly',
      intervalle: abo.intervalle || 1,
      jour_facturation: abo.jour_facturation || 31,
      mode_finalisation: abo.mode_finalisation || 'awaiting_validation',
      conditions_paiement: abo.conditions_paiement || 'upon_receipt',
      moyen_paiement: abo.moyen_paiement || 'offline',
      date_debut: abo.date_debut,
      lignes_fixes: lignesFixes,
      lignes_variables: lignesVariables,
      decision
    };
  });

  return {
    client_id: client.id,
    client_nom: client.nom,
    cabinet: client.cabinet,
    siren: client.siren || '',
    pennylane_customer_id: client.pennylane_customer_id || '',
    abonnements: abonnementsRestructures,
    total_ht_actuel: Math.round(totalHtActuel * 100) / 100,
    total_ht_fixe_2026: Math.round(totalHtFixe2026 * 100) / 100,
    total_ht_variable_actuel: Math.round(totalHtVariableActuel * 100) / 100,
    nb_lignes_fixes: nbLignesFixes,
    nb_lignes_variables: nbLignesVariables
  };
}

/**
 * Analyse tous les clients ayant des tarifs 2026 et génère les plans de restructuration.
 *
 * @param {Object} params
 * @param {Object} params.supabase - Client Supabase
 * @param {string} [params.cabinet] - Filtrer par cabinet (optionnel)
 * @param {Function} [params.onProgress] - Callback de progression
 * @returns {Promise<PlanRestructurationClient[]>}
 */
export async function analyserTousLesClients({ supabase, cabinet, onProgress }) {
  // 1. Obtenir la liste des clients ayant des tarifs 2026
  let query = supabase
    .from('tarifs_reference')
    .select('client_id')
    .eq('date_effet', '2026-01-01');

  if (cabinet && cabinet !== 'tous') {
    query = query.eq('cabinet', cabinet);
  }

  const { data: rows, error } = await query;
  if (error) throw new Error(`Erreur chargement clients: ${error.message}`);

  const clientIds = [...new Set((rows || []).map(r => r.client_id))];

  if (onProgress) {
    onProgress({ step: 'init', message: `${clientIds.length} clients à analyser`, current: 0, total: clientIds.length });
  }

  // 2. Analyser chaque client
  const plans = [];
  for (let i = 0; i < clientIds.length; i++) {
    try {
      const plan = await analyserClient({ clientId: clientIds[i], supabase });
      plans.push(plan);
    } catch (err) {
      console.warn(`[Restructuration] Erreur client ${clientIds[i]}:`, err.message);
    }

    if (onProgress && (i + 1) % 5 === 0) {
      onProgress({
        step: 'analyse',
        message: `Analyse ${i + 1}/${clientIds.length}...`,
        current: i + 1,
        total: clientIds.length
      });
    }
  }

  if (onProgress) {
    onProgress({ step: 'done', message: 'Analyse terminée', current: clientIds.length, total: clientIds.length });
  }

  return plans;
}

/**
 * Calcule les statistiques globales de restructuration.
 *
 * @param {PlanRestructurationClient[]} plans
 * @returns {Object} Statistiques agrégées
 */
export function calculerStatistiques(plans) {
  let totalClientsAvecVariable = 0;
  let totalClientsFixeOnly = 0;
  let totalAbosASupprimer = 0;
  let totalAbosAModifier = 0;
  let totalAbosInchanges = 0;
  let totalLignesFixes = 0;
  let totalLignesVariables = 0;
  let totalHtActuel = 0;
  let totalHtFixe2026 = 0;
  let totalHtVariableActuel = 0;

  const parCabinet = {};

  for (const plan of plans) {
    const hasVariable = plan.nb_lignes_variables > 0;
    if (hasVariable) totalClientsAvecVariable++;
    else totalClientsFixeOnly++;

    totalLignesFixes += plan.nb_lignes_fixes;
    totalLignesVariables += plan.nb_lignes_variables;
    totalHtActuel += plan.total_ht_actuel;
    totalHtFixe2026 += plan.total_ht_fixe_2026;
    totalHtVariableActuel += plan.total_ht_variable_actuel;

    for (const abo of plan.abonnements) {
      if (abo.decision === 'a_supprimer') totalAbosASupprimer++;
      else if (abo.decision === 'a_modifier') totalAbosAModifier++;
      else totalAbosInchanges++;
    }

    // Par cabinet
    const cab = plan.cabinet;
    if (!parCabinet[cab]) {
      parCabinet[cab] = {
        nbClients: 0, nbAvecVariable: 0,
        lignesFixes: 0, lignesVariables: 0,
        htActuel: 0, htFixe2026: 0, htVariableActuel: 0
      };
    }
    parCabinet[cab].nbClients++;
    if (hasVariable) parCabinet[cab].nbAvecVariable++;
    parCabinet[cab].lignesFixes += plan.nb_lignes_fixes;
    parCabinet[cab].lignesVariables += plan.nb_lignes_variables;
    parCabinet[cab].htActuel += plan.total_ht_actuel;
    parCabinet[cab].htFixe2026 += plan.total_ht_fixe_2026;
    parCabinet[cab].htVariableActuel += plan.total_ht_variable_actuel;
  }

  return {
    totalClients: plans.length,
    totalClientsAvecVariable,
    totalClientsFixeOnly,
    totalAbosASupprimer,
    totalAbosAModifier,
    totalAbosInchanges,
    totalLignesFixes,
    totalLignesVariables,
    totalHtActuel: Math.round(totalHtActuel * 100) / 100,
    totalHtFixe2026: Math.round(totalHtFixe2026 * 100) / 100,
    totalHtVariableActuel: Math.round(totalHtVariableActuel * 100) / 100,
    parCabinet
  };
}
