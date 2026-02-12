// @ts-check
/**
 * Service de gestion des salaires collaborateurs
 * ACCES ADMIN UNIQUEMENT (protégé par RLS Supabase)
 */

/**
 * @typedef {Object} Salaire
 * @property {number} id
 * @property {number} collaborateur_id
 * @property {number} annee
 * @property {string} date_effet
 * @property {number} salaire_brut_annuel
 * @property {number} charges_patronales_annuel
 * @property {number} heures_annuelles
 * @property {string} [motif_modification]
 * @property {string} [notes]
 * @property {string} created_at
 * @property {string} updated_at
 * @property {number} [created_by]
 */

/**
 * @typedef {Object} SalaireAvecCollaborateur
 * @property {number} id
 * @property {number} collaborateur_id
 * @property {number} annee
 * @property {string} date_effet
 * @property {number} salaire_brut_annuel
 * @property {number} charges_patronales_annuel
 * @property {number} heures_annuelles
 * @property {string} [motif_modification]
 * @property {string} [notes]
 * @property {{id: number, nom: string, email: string, actif: boolean}} collaborateur
 */

/**
 * Récupère les salaires actuels de tous les collaborateurs actifs
 * (le salaire le plus récent par date_effet pour chaque collaborateur)
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<SalaireAvecCollaborateur[]>}
 */
export async function getSalairesActuels(supabase) {
  // Récupérer tous les salaires avec les infos collaborateur
  const { data, error } = await supabase
    .from('salaires_collaborateurs')
    .select(`
      *,
      collaborateur:collaborateurs!collaborateur_id (
        id,
        nom,
        email,
        actif
      )
    `)
    .order('date_effet', { ascending: false });

  if (error) {
    console.error('Erreur getSalairesActuels:', error);
    throw new Error(error.message);
  }

  if (!data) return [];

  // Garder uniquement le salaire le plus récent par collaborateur
  const salairesParCollaborateur = new Map();
  for (const salaire of data) {
    if (!salairesParCollaborateur.has(salaire.collaborateur_id)) {
      salairesParCollaborateur.set(salaire.collaborateur_id, salaire);
    }
  }

  return Array.from(salairesParCollaborateur.values());
}

/**
 * Récupère l'historique complet des salaires d'un collaborateur
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} collaborateurId
 * @returns {Promise<Salaire[]>}
 */
export async function getHistoriqueSalaires(supabase, collaborateurId) {
  const { data, error } = await supabase
    .from('salaires_collaborateurs')
    .select('*')
    .eq('collaborateur_id', collaborateurId)
    .order('date_effet', { ascending: false });

  if (error) {
    console.error('Erreur getHistoriqueSalaires:', error);
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Récupère le salaire actuel d'un collaborateur
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} collaborateurId
 * @returns {Promise<Salaire|null>}
 */
export async function getSalaireCollaborateur(supabase, collaborateurId) {
  const { data, error } = await supabase
    .from('salaires_collaborateurs')
    .select('*')
    .eq('collaborateur_id', collaborateurId)
    .order('date_effet', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Erreur getSalaireCollaborateur:', error);
    throw new Error(error.message);
  }

  return data || null;
}

/**
 * Crée un nouveau salaire (nouvelle entrée dans l'historique)
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Omit<Salaire, 'id' | 'created_at' | 'updated_at'>} salaire
 * @returns {Promise<Salaire>}
 */
export async function createSalaire(supabase, salaire) {
  const { data, error } = await supabase
    .from('salaires_collaborateurs')
    .insert(salaire)
    .select()
    .single();

  if (error) {
    console.error('Erreur createSalaire:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Met à jour un salaire existant
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} id
 * @param {Partial<Salaire>} updates
 * @returns {Promise<Salaire>}
 */
export async function updateSalaire(supabase, id, updates) {
  const { data, error } = await supabase
    .from('salaires_collaborateurs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erreur updateSalaire:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Supprime un salaire
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteSalaire(supabase, id) {
  const { error } = await supabase
    .from('salaires_collaborateurs')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erreur deleteSalaire:', error);
    throw new Error(error.message);
  }
}
