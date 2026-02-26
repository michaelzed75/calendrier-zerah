// @ts-check

/**
 * @file Service de gestion des tarifs de référence
 *
 * Persiste les prix unitaires HT par client × produit après validation
 * des augmentations. Sert de source de vérité pour :
 * - La génération des Excel d'import Pennylane (brouillons variables)
 * - La mise à jour des abonnements fixes
 * - L'historique des tarifs
 */

/**
 * @typedef {Object} TarifReference
 * @property {number} client_id
 * @property {string} label - Label du produit
 * @property {string} axe - Axe d'augmentation (compta_mensuelle, social_bulletin, etc.)
 * @property {'fixe'|'variable'} type_recurrence
 * @property {number} pu_ht - Prix unitaire HT
 * @property {number} quantite - Quantité actuelle
 * @property {string} frequence - 'monthly' | 'yearly'
 * @property {number} intervalle - Intervalle de fréquence
 * @property {number} tva_rate
 * @property {string} cabinet
 * @property {string} date_effet - Date d'effet (YYYY-MM-DD)
 * @property {string} source - 'augmentation_2026' | 'import' | 'manuel'
 * @property {number} [abonnement_ligne_id] - ID de la ligne source
 * @property {number} [produit_pennylane_id] - Lien vers produits_pennylane
 */

/**
 * Détermine le type de récurrence d'une ligne selon son axe.
 * @param {string} axe
 * @returns {'fixe'|'variable'}
 */
function getTypeRecurrence(axe) {
  const variables = ['social_bulletin', 'accessoires_social'];
  return variables.includes(axe) ? 'variable' : 'fixe';
}

/**
 * Sauvegarde les tarifs de référence en BDD.
 * Prend les résultats de l'AugmentationPanel (après verrouillage) et persiste
 * chaque ligne avec son nouveau prix unitaire HT.
 *
 * @param {import('../../supabaseClient').SupabaseClient} supabase
 * @param {import('./calculsAugmentation').ResultatClient[]} resultats - Résultats de l'augmentation
 * @param {string} dateEffet - Date d'effet au format YYYY-MM-DD
 * @param {string} source - Source de l'augmentation (ex: 'augmentation_2026')
 * @param {Function} [onProgress] - Callback de progression
 * @returns {Promise<{inserted: number, updated: number, errors: string[]}>}
 */
export async function sauvegarderTarifsReference(supabase, resultats, dateEffet, source = 'augmentation_2026', onProgress) {
  let inserted = 0;
  let updated = 0;
  const errors = [];
  const total = resultats.reduce((acc, c) => acc + c.lignes.length, 0);
  let processed = 0;

  for (const client of resultats) {
    if (client.exclu) continue;

    for (const ligne of client.lignes) {
      // Ne sauvegarder que les lignes avec un axe (classifiées)
      if (!ligne.axe) continue;

      const tarif = {
        client_id: client.client_id,
        label: ligne.label,
        axe: ligne.axe,
        type_recurrence: getTypeRecurrence(ligne.axe),
        pu_ht: ligne.nouveau_prix_unitaire_ht,
        quantite: ligne.quantite,
        frequence: ligne.frequence || 'monthly',
        intervalle: ligne.intervalle || 1,
        tva_rate: 0.20,
        cabinet: client.client_cabinet,
        date_effet: dateEffet,
        source,
        abonnement_ligne_id: ligne.ligne_id || null,
        updated_at: new Date().toISOString()
      };

      // Upsert : si le tarif existe déjà pour ce client+label+date_effet, on le met à jour
      const { error } = await supabase
        .from('tarifs_reference')
        .upsert(tarif, {
          onConflict: 'client_id,label,date_effet'
        });

      if (error) {
        errors.push(`${client.client_nom} / ${ligne.label}: ${error.message}`);
      } else {
        // On ne peut pas distinguer insert/update avec upsert, on compte tout comme "traité"
        inserted++;
      }

      processed++;
      if (onProgress && processed % 20 === 0) {
        onProgress({ processed, total, percent: Math.round((processed / total) * 100) });
      }
    }
  }

  if (onProgress) {
    onProgress({ processed: total, total, percent: 100 });
  }

  return { inserted, updated, errors };
}

/**
 * Charge les tarifs de référence depuis la BDD.
 *
 * @param {import('../../supabaseClient').SupabaseClient} supabase
 * @param {Object} [options]
 * @param {string} [options.cabinet] - Filtrer par cabinet
 * @param {'fixe'|'variable'} [options.type_recurrence] - Filtrer par type
 * @param {string} [options.dateEffet] - Filtrer par date d'effet exacte
 * @returns {Promise<TarifReference[]>}
 */
export async function chargerTarifsReference(supabase, options = {}) {
  let query = supabase
    .from('tarifs_reference')
    .select('*, clients(nom, siren, cabinet, actif)')
    .order('client_id')
    .order('label');

  if (options.cabinet && options.cabinet !== 'tous') {
    query = query.eq('cabinet', options.cabinet);
  }
  if (options.type_recurrence) {
    query = query.eq('type_recurrence', options.type_recurrence);
  }
  if (options.dateEffet) {
    query = query.eq('date_effet', options.dateEffet);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Erreur chargement tarifs: ${error.message}`);
  return data || [];
}

/**
 * Récupère les dates d'effet distinctes (pour le sélecteur de période).
 *
 * @param {import('../../supabaseClient').SupabaseClient} supabase
 * @returns {Promise<string[]>}
 */
export async function getDatesEffetDisponibles(supabase) {
  const { data, error } = await supabase
    .from('tarifs_reference')
    .select('date_effet')
    .order('date_effet', { ascending: false });

  if (error) throw new Error(`Erreur chargement dates: ${error.message}`);

  // Dédupliquer
  const dates = [...new Set((data || []).map(d => d.date_effet))];
  return dates;
}

/**
 * Charge le mapping produits Pennylane pour un cabinet.
 *
 * @param {import('../../supabaseClient').SupabaseClient} supabase
 * @param {string} cabinet
 * @returns {Promise<Object[]>}
 */
export async function chargerProduitsPennylane(supabase, cabinet) {
  let query = supabase
    .from('produits_pennylane')
    .select('*')
    .eq('actif', true)
    .order('type_recurrence')
    .order('denomination');

  if (cabinet && cabinet !== 'tous') {
    query = query.eq('cabinet', cabinet);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Erreur chargement produits: ${error.message}`);
  return data || [];
}

/**
 * Supprime les tarifs de référence pour une date d'effet donnée.
 * Utile pour recommencer une sauvegarde proprement.
 *
 * @param {import('../../supabaseClient').SupabaseClient} supabase
 * @param {string} dateEffet
 * @returns {Promise<number>} Nombre de lignes supprimées
 */
export async function supprimerTarifsReference(supabase, dateEffet) {
  const { data, error } = await supabase
    .from('tarifs_reference')
    .delete()
    .eq('date_effet', dateEffet)
    .select('id');

  if (error) throw new Error(`Erreur suppression tarifs: ${error.message}`);
  return (data || []).length;
}
