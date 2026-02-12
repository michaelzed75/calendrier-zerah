// @ts-check
/**
 * Service de gestion des simulations d'augmentation
 * ACCES ADMIN UNIQUEMENT (protégé par RLS Supabase)
 */

/**
 * @typedef {Object} Simulation
 * @property {number} id
 * @property {string} nom_simulation
 * @property {number} annee_cible
 * @property {string|null} date_effet_prevue
 * @property {string} statut - 'brouillon' | 'valide' | 'applique'
 * @property {string} [notes]
 * @property {string} created_at
 * @property {string} updated_at
 * @property {number} [created_by]
 * @property {string} [validated_at]
 * @property {number} [validated_by]
 */

/**
 * @typedef {Object} LigneSimulation
 * @property {number} id
 * @property {number} simulation_id
 * @property {number} collaborateur_id
 * @property {number} salaire_actuel_brut
 * @property {number} charges_actuelles
 * @property {string} type_augmentation - 'montant' | 'pourcentage'
 * @property {number} valeur_augmentation
 * @property {number} nouveau_salaire_brut
 * @property {number} nouvelles_charges
 * @property {string} [notes]
 */

/**
 * @typedef {Object} LigneSimulationAvecCollaborateur
 * @property {number} id
 * @property {number} simulation_id
 * @property {number} collaborateur_id
 * @property {number} salaire_actuel_brut
 * @property {number} charges_actuelles
 * @property {string} type_augmentation
 * @property {number} valeur_augmentation
 * @property {number} nouveau_salaire_brut
 * @property {number} nouvelles_charges
 * @property {string} [notes]
 * @property {{id: number, nom: string, actif: boolean}} collaborateur
 */

/**
 * Récupère toutes les simulations
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} [statut] - Filtrer par statut
 * @returns {Promise<Simulation[]>}
 */
export async function getSimulations(supabase, statut) {
  let query = supabase
    .from('salaires_simulations')
    .select('*')
    .order('created_at', { ascending: false });

  if (statut) {
    query = query.eq('statut', statut);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erreur getSimulations:', error);
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Récupère une simulation avec ses lignes
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} simulationId
 * @returns {Promise<{simulation: Simulation, lignes: LigneSimulationAvecCollaborateur[]}>}
 */
export async function getSimulation(supabase, simulationId) {
  // Récupérer la simulation
  const { data: simulation, error: errSim } = await supabase
    .from('salaires_simulations')
    .select('*')
    .eq('id', simulationId)
    .single();

  if (errSim) {
    console.error('Erreur getSimulation:', errSim);
    throw new Error(errSim.message);
  }

  // Récupérer les lignes
  const { data: lignes, error: errLignes } = await supabase
    .from('salaires_simulations_lignes')
    .select(`
      *,
      collaborateur:collaborateurs!collaborateur_id (
        id,
        nom,
        actif
      )
    `)
    .eq('simulation_id', simulationId)
    .order('collaborateur_id');

  if (errLignes) {
    console.error('Erreur getSimulation lignes:', errLignes);
    throw new Error(errLignes.message);
  }

  return { simulation, lignes: lignes || [] };
}

/**
 * Crée une nouvelle simulation
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Omit<Simulation, 'id' | 'created_at' | 'updated_at' | 'validated_at' | 'validated_by'>} simulation
 * @returns {Promise<Simulation>}
 */
export async function createSimulation(supabase, simulation) {
  const { data, error } = await supabase
    .from('salaires_simulations')
    .insert(simulation)
    .select()
    .single();

  if (error) {
    console.error('Erreur createSimulation:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Met à jour une simulation
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} id
 * @param {Partial<Simulation>} updates
 * @returns {Promise<Simulation>}
 */
export async function updateSimulation(supabase, id, updates) {
  const { data, error } = await supabase
    .from('salaires_simulations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erreur updateSimulation:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Supprime une simulation et ses lignes
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteSimulation(supabase, id) {
  // Les lignes sont supprimées automatiquement par ON DELETE CASCADE
  const { error } = await supabase
    .from('salaires_simulations')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erreur deleteSimulation:', error);
    throw new Error(error.message);
  }
}

/**
 * Applique une simulation : crée les nouveaux salaires
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} simulationId
 * @param {number} validatedBy - ID du collaborateur qui valide
 * @returns {Promise<void>}
 */
export async function appliquerSimulation(supabase, simulationId, validatedBy) {
  // Récupérer la simulation et ses lignes
  const { simulation, lignes } = await getSimulation(supabase, simulationId);

  if (simulation.statut === 'applique') {
    throw new Error('Cette simulation a déjà été appliquée');
  }

  if (lignes.length === 0) {
    throw new Error('Aucune ligne dans cette simulation');
  }

  // Créer les nouveaux salaires
  const nouveauxSalaires = lignes
    .filter(l => l.nouveau_salaire_brut > 0)
    .map(ligne => ({
      collaborateur_id: ligne.collaborateur_id,
      annee: simulation.annee_cible,
      date_effet: simulation.date_effet_prevue || `${simulation.annee_cible}-01-01`,
      salaire_brut_annuel: ligne.nouveau_salaire_brut,
      charges_patronales_annuel: ligne.nouvelles_charges || 0,
      motif_modification: `Simulation: ${simulation.nom_simulation}`,
      created_by: validatedBy
    }));

  if (nouveauxSalaires.length > 0) {
    const { error: errInsert } = await supabase
      .from('salaires_collaborateurs')
      .insert(nouveauxSalaires);

    if (errInsert) {
      console.error('Erreur appliquerSimulation insert:', errInsert);
      throw new Error(errInsert.message);
    }
  }

  // Marquer la simulation comme appliquée
  const { error: errUpdate } = await supabase
    .from('salaires_simulations')
    .update({
      statut: 'applique',
      validated_at: new Date().toISOString(),
      validated_by: validatedBy
    })
    .eq('id', simulationId);

  if (errUpdate) {
    console.error('Erreur appliquerSimulation update:', errUpdate);
    throw new Error(errUpdate.message);
  }
}

/**
 * Récupère les lignes d'une simulation
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} simulationId
 * @returns {Promise<LigneSimulationAvecCollaborateur[]>}
 */
export async function getLignesSimulation(supabase, simulationId) {
  const { data, error } = await supabase
    .from('salaires_simulations_lignes')
    .select(`
      *,
      collaborateur:collaborateurs!collaborateur_id (
        id,
        nom,
        actif
      )
    `)
    .eq('simulation_id', simulationId)
    .order('collaborateur_id');

  if (error) {
    console.error('Erreur getLignesSimulation:', error);
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Crée ou met à jour une ligne de simulation
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Omit<LigneSimulation, 'id'>} ligne
 * @returns {Promise<LigneSimulation>}
 */
export async function upsertLigneSimulation(supabase, ligne) {
  const { data, error } = await supabase
    .from('salaires_simulations_lignes')
    .upsert(ligne, {
      onConflict: 'simulation_id,collaborateur_id'
    })
    .select()
    .single();

  if (error) {
    console.error('Erreur upsertLigneSimulation:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Supprime une ligne de simulation
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteLigneSimulation(supabase, id) {
  const { error } = await supabase
    .from('salaires_simulations_lignes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erreur deleteLigneSimulation:', error);
    throw new Error(error.message);
  }
}
