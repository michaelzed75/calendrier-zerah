// @ts-check

/**
 * @file Classification de l'état d'avancement d'une tâche.
 *
 * Utilisé à la fois par l'UI (badges sur les cartes) et par le cron de relance
 * (api/send-reminder.js étendu). Fonctions pures, sans dépendance Supabase.
 *
 * États dérivés :
 * - 'faite'          : tâche clôturée.
 * - 'en_retard'      : échéance dépassée (date_echeance < aujourd'hui) et pas faite,
 *                      OU date de réalisation planifiée dépassée et pas faite.
 * - 'echeance_proche': échéance dans les N prochains jours (défaut 2).
 * - 'non_planifiee'  : encore "à faire", sans date de réalisation.
 * - 'a_jour'         : planifiée pour aujourd'hui ou plus tard, rien à signaler.
 */

/**
 * @typedef {Object} Tache
 * @property {string} statut - 'a_faire' | 'planifiee' | 'faite'
 * @property {string|null} [date_echeance] - YYYY-MM-DD
 * @property {string|null} [date_realisation] - YYYY-MM-DD
 */

/**
 * Renvoie la date du jour au format YYYY-MM-DD (UTC), ou passe une date d'ancrage.
 * @param {Date} [now]
 * @returns {string}
 */
export function todayIso(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/**
 * Nombre de jours entre deux dates ISO (b - a), en jours calendaires.
 * @param {string} aIso
 * @param {string} bIso
 * @returns {number}
 */
export function diffJours(aIso, bIso) {
  const a = Date.parse(`${aIso}T00:00:00Z`);
  const b = Date.parse(`${bIso}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

/**
 * Classifie une tâche par rapport à une date de référence.
 * @param {Tache} tache
 * @param {Object} [options]
 * @param {string} [options.today] - Date de référence YYYY-MM-DD (défaut: aujourd'hui)
 * @param {number} [options.seuilProche] - Jours avant échéance pour "echeance_proche" (défaut: 2)
 * @returns {'faite'|'en_retard'|'echeance_proche'|'non_planifiee'|'a_jour'}
 */
export function classifyTache(tache, options = {}) {
  const today = options.today || todayIso();
  const seuilProche = options.seuilProche ?? 2;

  if (tache.statut === 'faite') return 'faite';

  // Retard dur : échéance dépassée
  if (tache.date_echeance && diffJours(tache.date_echeance, today) > 0) {
    return 'en_retard';
  }

  // Retard de planning : le collab avait planifié pour une date passée
  if (tache.date_realisation && diffJours(tache.date_realisation, today) > 0) {
    return 'en_retard';
  }

  // Pas encore planifiée
  if (tache.statut === 'a_faire' && !tache.date_realisation) {
    return 'non_planifiee';
  }

  // Échéance imminente
  if (tache.date_echeance) {
    const restant = diffJours(today, tache.date_echeance);
    if (restant >= 0 && restant <= seuilProche) return 'echeance_proche';
  }

  return 'a_jour';
}

/**
 * Indique si une tâche est en retard (échéance ou planning dépassé, pas faite).
 * @param {Tache} tache
 * @param {string} [today]
 * @returns {boolean}
 */
export function estEnRetard(tache, today) {
  return classifyTache(tache, { today }) === 'en_retard';
}

/**
 * Filtre/agrège les tâches à signaler pour un collaborateur (cron de relance).
 * @param {Tache[]} taches
 * @param {Object} [options]
 * @param {string} [options.today]
 * @param {number} [options.seuilProche]
 * @returns {{ enRetard: Tache[], echeanceProche: Tache[], nonPlanifiee: Tache[] }}
 */
export function tachesASignaler(taches, options = {}) {
  const enRetard = [];
  const echeanceProche = [];
  const nonPlanifiee = [];
  for (const t of taches) {
    const cls = classifyTache(t, options);
    if (cls === 'en_retard') enRetard.push(t);
    else if (cls === 'echeance_proche') echeanceProche.push(t);
    else if (cls === 'non_planifiee') nonPlanifiee.push(t);
  }
  return { enRetard, echeanceProche, nonPlanifiee };
}
