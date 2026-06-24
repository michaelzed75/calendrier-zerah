// @ts-check

/**
 * @file Service CRUD pour les tâches (table taches).
 *
 * Le scoping de visibilité (collab = ses tâches, chef = + son équipe, admin = tout)
 * est calculé côté page via getVisibleCollaborateurIds(), puis passé ici en filtre.
 */

import { getEquipeOf } from '../businessLogic.js';

/**
 * @typedef {import('../../types.js').Collaborateur} Collaborateur
 * @typedef {import('../../types.js').CollaborateurChef} CollaborateurChef
 */

const SELECT_COLS =
  'id, collaborateur_id, client_id, titre, detail, statut, priorite, date_echeance, date_realisation, source, email_message_id, email_from, created_by, date_faite, created_at, updated_at';

/**
 * Calcule la liste des collaborateur_id visibles par l'utilisateur courant.
 * - Admin : null (= tous, pas de filtre)
 * - Chef de mission : lui + son équipe
 * - Collaborateur : lui uniquement
 * @param {Collaborateur|null} user
 * @param {CollaborateurChef[]} collaborateurChefs
 * @param {Collaborateur[]} collaborateurs
 * @returns {number[]|null} null = aucun filtre (admin)
 */
export function getVisibleCollaborateurIds(user, collaborateurChefs, collaborateurs) {
  if (!user) return [];
  if (user.is_admin) return null;
  const ids = new Set([user.id]);
  if (user.est_chef_mission) {
    for (const membre of getEquipeOf(user.id, collaborateurChefs, collaborateurs)) {
      ids.add(membre.id);
    }
  }
  return [...ids];
}

/**
 * Récupère les tâches visibles.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Object} [options]
 * @param {number[]|null} [options.collaborateurIds] - null = toutes (admin), [] = aucune
 * @param {boolean} [options.includeFaites] - inclure les tâches faites (défaut: true)
 * @returns {Promise<Object[]>}
 */
export async function getTaches(supabase, options = {}) {
  const { collaborateurIds = null, includeFaites = true } = options;

  let query = supabase.from('taches').select(SELECT_COLS).order('created_at', { ascending: false });

  if (collaborateurIds !== null) {
    if (collaborateurIds.length === 0) return [];
    query = query.in('collaborateur_id', collaborateurIds);
  }
  if (!includeFaites) {
    query = query.neq('statut', 'faite');
  }

  const { data, error } = await query;
  if (error) throw new Error(`Erreur chargement tâches: ${error.message}`);
  return data || [];
}

/**
 * Crée une tâche manuelle.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Object} tache
 * @returns {Promise<Object>}
 */
export async function createTache(supabase, tache) {
  const payload = {
    statut: 'a_faire',
    priorite: 'normale',
    source: 'manuel',
    ...tache,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('taches').insert(payload).select(SELECT_COLS).single();
  if (error) throw new Error(`Erreur création tâche: ${error.message}`);
  return data;
}

/**
 * Planifie une tâche : pose une date de réalisation et passe en statut 'planifiee'.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} id
 * @param {string} dateRealisation - YYYY-MM-DD
 * @returns {Promise<Object>}
 */
export async function planifierTache(supabase, id, dateRealisation) {
  return updateTache(supabase, id, {
    date_realisation: dateRealisation,
    statut: 'planifiee',
  });
}

/**
 * Marque une tâche comme faite (horodate la clôture).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} id
 * @returns {Promise<Object>}
 */
export async function marquerFaite(supabase, id) {
  return updateTache(supabase, id, {
    statut: 'faite',
    date_faite: new Date().toISOString(),
  });
}

/**
 * Rouvre une tâche faite : revient en 'planifiee' si une date de réalisation existe,
 * sinon en 'a_faire'. Efface l'horodatage de clôture.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Object} tache - la tâche courante (pour connaître date_realisation)
 * @returns {Promise<Object>}
 */
export async function rouvrirTache(supabase, tache) {
  return updateTache(supabase, tache.id, {
    statut: tache.date_realisation ? 'planifiee' : 'a_faire',
    date_faite: null,
  });
}

/**
 * Met à jour une tâche (touche updated_at automatiquement).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} id
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
export async function updateTache(supabase, id, updates) {
  const payload = { ...updates, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from('taches')
    .update(payload)
    .eq('id', id)
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(`Erreur mise à jour tâche: ${error.message}`);
  return data;
}

/**
 * Supprime une tâche.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteTache(supabase, id) {
  const { error } = await supabase.from('taches').delete().eq('id', id);
  if (error) throw new Error(`Erreur suppression tâche: ${error.message}`);
}
