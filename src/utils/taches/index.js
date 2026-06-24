// @ts-check

/**
 * @file Export centralisé du module taches.
 */

export {
  normalizeEmail,
  parseRecipients,
  parseSubject,
  toIsoDate,
  matchCollaborateurByEmail,
  detectClient,
  normalizeText,
  parseInboundEmail,
} from './tachesInbound.js';

export {
  todayIso,
  diffJours,
  classifyTache,
  estEnRetard,
  tachesASignaler,
} from './tachesStatus.js';

export {
  getVisibleCollaborateurIds,
  getTaches,
  createTache,
  planifierTache,
  marquerFaite,
  rouvrirTache,
  updateTache,
  deleteTache,
} from './tachesService.js';
