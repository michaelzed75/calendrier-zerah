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
