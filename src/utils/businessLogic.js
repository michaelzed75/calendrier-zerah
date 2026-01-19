// @ts-check

/**
 * @file Fonctions de logique métier (permissions, filtres, etc.)
 */

/**
 * @typedef {import('../types.js').Collaborateur} Collaborateur
 * @typedef {import('../types.js').CollaborateurChef} CollaborateurChef
 * @typedef {import('../types.js').Client} Client
 */

/**
 * Obtient les chefs de mission d'un collaborateur
 * @param {number} collaborateurId - ID du collaborateur
 * @param {CollaborateurChef[]} collaborateurChefs - Liste des liaisons collaborateur-chef
 * @param {Collaborateur[]} collaborateurs - Liste des collaborateurs
 * @returns {Collaborateur[]} Liste des chefs de mission
 */
export const getChefsOf = (collaborateurId, collaborateurChefs, collaborateurs) => {
  const chefIds = collaborateurChefs
    .filter(cc => cc.collaborateur_id === collaborateurId)
    .map(cc => cc.chef_id);
  return collaborateurs.filter(c => chefIds.includes(c.id));
};

/**
 * Obtient l'équipe d'un chef de mission
 * @param {number} chefId - ID du chef de mission
 * @param {CollaborateurChef[]} collaborateurChefs - Liste des liaisons collaborateur-chef
 * @param {Collaborateur[]} collaborateurs - Liste des collaborateurs
 * @returns {Collaborateur[]} Liste des membres de l'équipe
 */
export const getEquipeOf = (chefId, collaborateurChefs, collaborateurs) => {
  const membreIds = collaborateurChefs
    .filter(cc => cc.chef_id === chefId)
    .map(cc => cc.collaborateur_id);
  return collaborateurs.filter(c => membreIds.includes(c.id));
};

/**
 * Obtient les clients accessibles pour un collaborateur
 * @param {Collaborateur|null} collaborateur - Le collaborateur
 * @param {Client[]} clients - Liste de tous les clients
 * @param {CollaborateurChef[]} collaborateurChefs - Liste des liaisons collaborateur-chef
 * @param {Collaborateur[]} collaborateurs - Liste des collaborateurs
 * @returns {Client[]} Liste des clients accessibles
 */
export const getAccessibleClients = (collaborateur, clients, collaborateurChefs, collaborateurs) => {
  // Clients actifs seulement
  const activeClients = clients.filter(c => c.actif);

  if (!collaborateur) {
    return activeClients;
  }

  // Admin voit tous les clients actifs
  if (collaborateur.is_admin) {
    return activeClients;
  }

  // Chef de mission voit ses propres clients
  if (collaborateur.est_chef_mission) {
    return activeClients.filter(c =>
      c.chef_mission_id === collaborateur.id || !c.chef_mission_id
    );
  }

  // Collaborateur voit les clients de ses chefs + clients sans chef assigné
  const chefs = getChefsOf(collaborateur.id, collaborateurChefs, collaborateurs);
  const chefIds = chefs.map(c => c.id);
  return activeClients.filter(c =>
    !c.chef_mission_id || chefIds.includes(c.chef_mission_id)
  );
};

/**
 * Vérifie si un collaborateur peut modifier une charge
 * @param {Collaborateur|null} userCollaborateur - Le collaborateur connecté
 * @param {number} chargeCollaborateurId - ID du collaborateur de la charge
 * @param {CollaborateurChef[]} collaborateurChefs - Liste des liaisons
 * @param {Collaborateur[]} collaborateurs - Liste des collaborateurs
 * @returns {boolean} True si le collaborateur peut modifier
 */
export const canEditCharge = (userCollaborateur, chargeCollaborateurId, collaborateurChefs, collaborateurs) => {
  if (!userCollaborateur) return false;

  // Admin peut tout modifier
  if (userCollaborateur.is_admin) return true;

  // On peut modifier ses propres charges
  if (userCollaborateur.id === chargeCollaborateurId) return true;

  // Chef de mission peut modifier les charges de son équipe
  if (userCollaborateur.est_chef_mission) {
    const equipe = getEquipeOf(userCollaborateur.id, collaborateurChefs, collaborateurs);
    return equipe.some(c => c.id === chargeCollaborateurId);
  }

  return false;
};

/**
 * Filtre les charges visibles pour un collaborateur
 * @param {Collaborateur|null} userCollaborateur - Le collaborateur connecté
 * @param {import('../types.js').Charge[]} charges - Liste des charges
 * @param {CollaborateurChef[]} collaborateurChefs - Liste des liaisons
 * @param {Collaborateur[]} collaborateurs - Liste des collaborateurs
 * @returns {import('../types.js').Charge[]} Liste des charges visibles
 */
export const getVisibleCharges = (userCollaborateur, charges, collaborateurChefs, collaborateurs) => {
  if (!userCollaborateur) return [];

  // Admin voit tout
  if (userCollaborateur.is_admin) return charges;

  // Chef de mission voit ses charges + celles de son équipe
  if (userCollaborateur.est_chef_mission) {
    const equipe = getEquipeOf(userCollaborateur.id, collaborateurChefs, collaborateurs);
    const equipeIds = [userCollaborateur.id, ...equipe.map(c => c.id)];
    return charges.filter(ch => equipeIds.includes(ch.collaborateur_id));
  }

  // Collaborateur ne voit que ses propres charges
  return charges.filter(ch => ch.collaborateur_id === userCollaborateur.id);
};

// ============================================
// FONCTIONS CALENDRIER
// ============================================

/**
 * Filtre les charges pour un collaborateur et une date donnée
 * @param {import('../types.js').Charge[]} charges - Liste des charges
 * @param {number} collaborateurId - ID du collaborateur
 * @param {string} dateStr - Date au format YYYY-MM-DD
 * @returns {import('../types.js').Charge[]} Charges filtrées
 */
export const getChargesForDate = (charges, collaborateurId, dateStr) => {
  return charges.filter(c => c.collaborateur_id === collaborateurId && c.date_charge === dateStr);
};

/**
 * Calcule le total d'heures pour un collaborateur et une date
 * @param {import('../types.js').Charge[]} charges - Liste des charges
 * @param {number} collaborateurId - ID du collaborateur
 * @param {string} dateStr - Date au format YYYY-MM-DD
 * @returns {number} Total des heures
 */
export const getTotalHoursForDate = (charges, collaborateurId, dateStr) => {
  return getChargesForDate(charges, collaborateurId, dateStr)
    .reduce((sum, c) => sum + parseFloat(c.heures), 0);
};

/**
 * Agrège les heures par client pour un collaborateur et une date
 * @param {import('../types.js').Charge[]} charges - Liste des charges
 * @param {Client[]} clients - Liste des clients
 * @param {number} collaborateurId - ID du collaborateur
 * @param {string} dateStr - Date au format YYYY-MM-DD
 * @returns {Array<{client: string, heures: number}>} Heures agrégées par client
 */
export const getAggregatedByClient = (charges, clients, collaborateurId, dateStr) => {
  const dayCharges = getChargesForDate(charges, collaborateurId, dateStr);
  const aggregated = {};
  dayCharges.forEach(charge => {
    const clientName = clients.find(c => c.id === charge.client_id)?.nom || 'Inconnu';
    if (!aggregated[clientName]) {
      aggregated[clientName] = 0;
    }
    aggregated[clientName] += parseFloat(charge.heures);
  });
  return Object.entries(aggregated).map(([client, heures]) => ({ client, heures }));
};

/**
 * Calcule les collaborateurs visibles selon les droits d'un utilisateur
 * @param {Collaborateur|null} userCollaborateur - Utilisateur connecté
 * @param {Collaborateur[]} activeCollaborateurs - Collaborateurs actifs
 * @param {CollaborateurChef[]} collaborateurChefs - Liaisons collaborateur-chef
 * @returns {Collaborateur[]} Collaborateurs visibles
 */
export const getVisibleCollaborateurs = (userCollaborateur, activeCollaborateurs, collaborateurChefs) => {
  if (!userCollaborateur) return [];

  // Admin voit tout le monde
  if (userCollaborateur.is_admin) {
    return activeCollaborateurs;
  }

  const visibleIds = new Set();

  // L'utilisateur se voit toujours lui-même
  visibleIds.add(userCollaborateur.id);

  // Si c'est un chef de mission, il voit son équipe
  if (userCollaborateur.est_chef_mission) {
    const equipe = getEquipeOf(userCollaborateur.id, collaborateurChefs, activeCollaborateurs);
    equipe.forEach(membre => visibleIds.add(membre.id));
  }

  // Tout collaborateur voit ses chefs
  const chefs = getChefsOf(userCollaborateur.id, collaborateurChefs, activeCollaborateurs);
  chefs.forEach(chef => visibleIds.add(chef.id));

  // Et les membres de l'équipe de ses chefs (ses collègues)
  chefs.forEach(chef => {
    const equipeDuChef = getEquipeOf(chef.id, collaborateurChefs, activeCollaborateurs);
    equipeDuChef.forEach(membre => visibleIds.add(membre.id));
  });

  return activeCollaborateurs.filter(c => visibleIds.has(c.id));
};

/**
 * Vérifie si un collaborateur a un budget saisi pour une date
 * @param {import('../types.js').Charge[]} charges - Liste des charges
 * @param {number} collaborateurId - ID du collaborateur
 * @param {string} dateStr - Date au format YYYY-MM-DD
 * @returns {boolean} True si budget existe
 */
export const hasBudgetForDate = (charges, collaborateurId, dateStr) => {
  return charges.some(c => c.collaborateur_id === collaborateurId && c.date_charge === dateStr);
};

/**
 * Vérifie si un collaborateur a des temps réels saisis pour une date
 * @param {import('../types.js').TempsReel[]} tempsReels - Liste des temps réels
 * @param {number} collaborateurId - ID du collaborateur
 * @param {string} dateStr - Date au format YYYY-MM-DD
 * @returns {boolean} True si des temps sont saisis
 */
export const hasTempsReelsForDate = (tempsReels, collaborateurId, dateStr) => {
  const temps = tempsReels.filter(t => t.collaborateur_id === collaborateurId && t.date === dateStr);
  return temps.reduce((sum, t) => sum + (t.heures || 0), 0) > 0;
};

/**
 * Vérifie si une date est un jour ouvré (lundi-vendredi)
 * @param {Date} date - Date à vérifier
 * @returns {boolean} True si jour ouvré
 */
export const isJourOuvre = (date) => {
  const dayOfWeek = date.getDay();
  return dayOfWeek !== 0 && dayOfWeek !== 6;
};

/**
 * Calcule les jours d'une semaine à partir d'une date de référence et un offset
 * @param {Date} currentDate - Date de référence
 * @param {number} weekOffset - Décalage en semaines
 * @returns {Date[]} Tableau des 7 jours de la semaine
 */
export const getWeekDays = (currentDate, weekOffset = 0) => {
  const today = new Date(currentDate);
  today.setDate(today.getDate() + weekOffset * 7);
  const first = today.getDate() - today.getDay() + 1;
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(today.getFullYear(), today.getMonth(), first + i);
    weekDays.push(date);
  }
  return weekDays;
};

/**
 * Calcule le total des heures sur une semaine pour un collaborateur
 * @param {import('../types.js').Charge[]} charges - Liste des charges
 * @param {number} collaborateurId - ID du collaborateur
 * @param {Date[]} weekDays - Jours de la semaine
 * @param {function(Date): string} formatDateToYMD - Fonction de formatage
 * @returns {number} Total des heures
 */
export const getWeekTotal = (charges, collaborateurId, weekDays, formatDateToYMD) => {
  return weekDays.reduce((sum, date) => {
    const dateStr = formatDateToYMD(date);
    return sum + getTotalHoursForDate(charges, collaborateurId, dateStr);
  }, 0);
};

/**
 * Compte les alertes (collaborateurs sans budget ou sans temps réels)
 * @param {Collaborateur[]} collaborateurs - Liste des collaborateurs à vérifier
 * @param {import('../types.js').Charge[]} charges - Liste des charges
 * @param {import('../types.js').TempsReel[]} tempsReels - Liste des temps réels
 * @param {number[]} sourdineIds - IDs des collaborateurs en sourdine
 * @param {string} todayStr - Date du jour au format YYYY-MM-DD
 * @param {string} yesterdayStr - Date d'hier au format YYYY-MM-DD
 * @param {boolean} isYesterdayWorkday - Si hier était un jour ouvré
 * @param {boolean} isAfter10am - Si on est après 10h
 * @returns {number} Nombre d'alertes
 */
export const countAlerts = (
  collaborateurs,
  charges,
  tempsReels,
  sourdineIds,
  todayStr,
  yesterdayStr,
  isYesterdayWorkday,
  isAfter10am
) => {
  return collaborateurs.filter(c => {
    // Ignorer les collaborateurs en sourdine
    if (sourdineIds.includes(c.id)) return false;

    // Alerte si pas de budget aujourd'hui
    const hasBudget = hasBudgetForDate(charges, c.id, todayStr);
    if (!hasBudget) return true;

    // Alerte si pas de temps réels hier (après 10h et si jour ouvré)
    if (isAfter10am && isYesterdayWorkday) {
      const hasTemps = hasTempsReelsForDate(tempsReels, c.id, yesterdayStr);
      if (!hasTemps) return true;
    }

    return false;
  }).length;
};
