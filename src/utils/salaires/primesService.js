// @ts-check
/**
 * Service de gestion des primes et exceptionnels
 * ACCES ADMIN UNIQUEMENT (protégé par RLS Supabase)
 */

/**
 * @typedef {Object} Prime
 * @property {number} id
 * @property {number} collaborateur_id
 * @property {number} annee
 * @property {number|null} mois
 * @property {string|null} date_versement
 * @property {string} type_prime
 * @property {string} libelle
 * @property {number} montant_brut
 * @property {number} charges_patronales
 * @property {string} [notes]
 * @property {string} created_at
 * @property {string} updated_at
 * @property {number} [created_by]
 */

/**
 * @typedef {Object} PrimeAvecCollaborateur
 * @property {number} id
 * @property {number} collaborateur_id
 * @property {number} annee
 * @property {number|null} mois
 * @property {string|null} date_versement
 * @property {string} type_prime
 * @property {string} libelle
 * @property {number} montant_brut
 * @property {number} charges_patronales
 * @property {string} [notes]
 * @property {{id: number, nom: string}} collaborateur
 */

/** Types de primes disponibles */
export const TYPES_PRIMES = [
  { value: 'prime_exceptionnelle', label: 'Prime exceptionnelle' },
  { value: 'prime_objectifs', label: 'Prime sur objectifs' },
  { value: '13eme_mois', label: '13ème mois' },
  { value: 'participation', label: 'Participation' },
  { value: 'interessement', label: 'Intéressement' },
  { value: 'prime_anciennete', label: 'Prime d\'ancienneté' },
  { value: 'prime_vacances', label: 'Prime de vacances' },
  { value: 'autre', label: 'Autre' }
];

/**
 * Récupère toutes les primes (avec filtre optionnel par année)
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} [annee]
 * @returns {Promise<PrimeAvecCollaborateur[]>}
 */
export async function getPrimes(supabase, annee) {
  let query = supabase
    .from('salaires_primes')
    .select(`
      *,
      collaborateur:collaborateurs!collaborateur_id (
        id,
        nom
      )
    `)
    .order('date_versement', { ascending: false, nullsFirst: false })
    .order('annee', { ascending: false })
    .order('mois', { ascending: false, nullsFirst: true });

  if (annee) {
    query = query.eq('annee', annee);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erreur getPrimes:', error);
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Récupère les primes d'un collaborateur
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} collaborateurId
 * @param {number} [annee]
 * @returns {Promise<Prime[]>}
 */
export async function getPrimesCollaborateur(supabase, collaborateurId, annee) {
  let query = supabase
    .from('salaires_primes')
    .select('*')
    .eq('collaborateur_id', collaborateurId)
    .order('annee', { ascending: false })
    .order('mois', { ascending: false, nullsFirst: true });

  if (annee) {
    query = query.eq('annee', annee);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erreur getPrimesCollaborateur:', error);
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Récupère les primes d'une année
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} annee
 * @returns {Promise<PrimeAvecCollaborateur[]>}
 */
export async function getPrimesAnnee(supabase, annee) {
  return getPrimes(supabase, annee);
}

/**
 * Crée une nouvelle prime
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Omit<Prime, 'id' | 'created_at' | 'updated_at'>} prime
 * @returns {Promise<Prime>}
 */
export async function createPrime(supabase, prime) {
  const { data, error } = await supabase
    .from('salaires_primes')
    .insert(prime)
    .select()
    .single();

  if (error) {
    console.error('Erreur createPrime:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Met à jour une prime
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} id
 * @param {Partial<Prime>} updates
 * @returns {Promise<Prime>}
 */
export async function updatePrime(supabase, id, updates) {
  const { data, error } = await supabase
    .from('salaires_primes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erreur updatePrime:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Supprime une prime
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deletePrime(supabase, id) {
  const { error } = await supabase
    .from('salaires_primes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erreur deletePrime:', error);
    throw new Error(error.message);
  }
}
