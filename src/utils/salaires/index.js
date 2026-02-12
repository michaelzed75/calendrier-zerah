// @ts-check
/**
 * Module Salaires - Export centralisé
 * ACCES ADMIN UNIQUEMENT (protégé par RLS Supabase)
 */

export {
  getSalairesActuels,
  getHistoriqueSalaires,
  getSalaireCollaborateur,
  createSalaire,
  updateSalaire,
  deleteSalaire
} from './salairesService.js';

export {
  getPrimes,
  getPrimesCollaborateur,
  getPrimesAnnee,
  createPrime,
  updatePrime,
  deletePrime,
  TYPES_PRIMES
} from './primesService.js';

export {
  getSimulations,
  getSimulation,
  createSimulation,
  updateSimulation,
  deleteSimulation,
  appliquerSimulation,
  getLignesSimulation,
  upsertLigneSimulation,
  deleteLigneSimulation
} from './simulationsService.js';

export {
  calculerCoutTotal,
  calculerTauxHoraireBrut,
  calculerTauxHoraireCharge,
  calculerAugmentation,
  calculerMasseSalariale,
  estimerChargesPatronales,
  formatMontant,
  formatTauxHoraire,
  calculerEvolution,
  HEURES_ANNUELLES_LEGALES
} from './calculsSalaires.js';
