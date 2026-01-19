import { describe, it, expect, beforeEach } from 'vitest';
import {
  getChefsOf,
  getEquipeOf,
  getAccessibleClients,
  canEditCharge,
  getVisibleCharges
} from './businessLogic';

// Données de test
/** @type {import('../types.js').Collaborateur[]} */
const mockCollaborateurs = [
  { id: 1, nom: 'Admin', prenom: 'User', email: 'admin@test.com', actif: true, is_admin: true, est_chef_mission: false },
  { id: 2, nom: 'Chef', prenom: 'Mission', email: 'chef@test.com', actif: true, is_admin: false, est_chef_mission: true },
  { id: 3, nom: 'Collab', prenom: 'Un', email: 'collab1@test.com', actif: true, is_admin: false, est_chef_mission: false },
  { id: 4, nom: 'Collab', prenom: 'Deux', email: 'collab2@test.com', actif: true, is_admin: false, est_chef_mission: false },
  { id: 5, nom: 'Chef', prenom: 'Deux', email: 'chef2@test.com', actif: true, is_admin: false, est_chef_mission: true },
];

/** @type {import('../types.js').CollaborateurChef[]} */
const mockCollaborateurChefs = [
  { id: 1, collaborateur_id: 3, chef_id: 2 }, // Collab Un → Chef Mission
  { id: 2, collaborateur_id: 4, chef_id: 2 }, // Collab Deux → Chef Mission
  { id: 3, collaborateur_id: 3, chef_id: 5 }, // Collab Un → Chef Deux (2 chefs)
];

/** @type {import('../types.js').Client[]} */
const mockClients = [
  { id: 1, nom: 'Client A', actif: true, chef_mission_id: 2 },
  { id: 2, nom: 'Client B', actif: true, chef_mission_id: 5 },
  { id: 3, nom: 'Client C', actif: true, chef_mission_id: null },
  { id: 4, nom: 'Client Inactif', actif: false, chef_mission_id: 2 },
];

/** @type {import('../types.js').Charge[]} */
const mockCharges = [
  { id: 1, collaborateur_id: 2, client_id: 1, date: '2025-01-15', duree: 2 },
  { id: 2, collaborateur_id: 3, client_id: 1, date: '2025-01-15', duree: 3 },
  { id: 3, collaborateur_id: 4, client_id: 2, date: '2025-01-16', duree: 1 },
  { id: 4, collaborateur_id: 1, client_id: 3, date: '2025-01-17', duree: 4 },
];

describe('businessLogic', () => {
  describe('getChefsOf', () => {
    it('retourne les chefs d\'un collaborateur', () => {
      const chefs = getChefsOf(3, mockCollaborateurChefs, mockCollaborateurs);
      expect(chefs).toHaveLength(2);
      expect(chefs.map(c => c.id)).toContain(2);
      expect(chefs.map(c => c.id)).toContain(5);
    });

    it('retourne un tableau vide si pas de chef', () => {
      const chefs = getChefsOf(1, mockCollaborateurChefs, mockCollaborateurs);
      expect(chefs).toHaveLength(0);
    });

    it('retourne un seul chef si un seul assigné', () => {
      const chefs = getChefsOf(4, mockCollaborateurChefs, mockCollaborateurs);
      expect(chefs).toHaveLength(1);
      expect(chefs[0].id).toBe(2);
    });
  });

  describe('getEquipeOf', () => {
    it('retourne l\'équipe d\'un chef de mission', () => {
      const equipe = getEquipeOf(2, mockCollaborateurChefs, mockCollaborateurs);
      expect(equipe).toHaveLength(2);
      expect(equipe.map(c => c.id)).toContain(3);
      expect(equipe.map(c => c.id)).toContain(4);
    });

    it('retourne un tableau vide si pas d\'équipe', () => {
      const equipe = getEquipeOf(1, mockCollaborateurChefs, mockCollaborateurs);
      expect(equipe).toHaveLength(0);
    });

    it('retourne une équipe partielle pour Chef Deux', () => {
      const equipe = getEquipeOf(5, mockCollaborateurChefs, mockCollaborateurs);
      expect(equipe).toHaveLength(1);
      expect(equipe[0].id).toBe(3);
    });
  });

  describe('getAccessibleClients', () => {
    it('admin voit tous les clients actifs', () => {
      const admin = mockCollaborateurs[0];
      const clients = getAccessibleClients(admin, mockClients, mockCollaborateurChefs, mockCollaborateurs);
      expect(clients).toHaveLength(3); // 3 actifs
      expect(clients.every(c => c.actif)).toBe(true);
    });

    it('chef de mission voit ses clients + clients sans chef', () => {
      const chef = mockCollaborateurs[1]; // Chef Mission (id: 2)
      const clients = getAccessibleClients(chef, mockClients, mockCollaborateurChefs, mockCollaborateurs);
      expect(clients).toHaveLength(2); // Client A (chef 2) + Client C (sans chef)
      expect(clients.map(c => c.nom)).toContain('Client A');
      expect(clients.map(c => c.nom)).toContain('Client C');
    });

    it('collaborateur voit les clients de ses chefs + clients sans chef', () => {
      const collab = mockCollaborateurs[2]; // Collab Un (id: 3, chefs: 2 et 5)
      const clients = getAccessibleClients(collab, mockClients, mockCollaborateurChefs, mockCollaborateurs);
      expect(clients).toHaveLength(3); // Client A (chef 2) + Client B (chef 5) + Client C (sans chef)
    });

    it('collaborateur avec un seul chef voit moins de clients', () => {
      const collab = mockCollaborateurs[3]; // Collab Deux (id: 4, chef: 2 seulement)
      const clients = getAccessibleClients(collab, mockClients, mockCollaborateurChefs, mockCollaborateurs);
      expect(clients).toHaveLength(2); // Client A (chef 2) + Client C (sans chef)
      expect(clients.map(c => c.nom)).not.toContain('Client B');
    });

    it('retourne tous les clients actifs si collaborateur null', () => {
      const clients = getAccessibleClients(null, mockClients, mockCollaborateurChefs, mockCollaborateurs);
      expect(clients).toHaveLength(3);
    });

    it('n\'inclut jamais les clients inactifs', () => {
      const admin = mockCollaborateurs[0];
      const clients = getAccessibleClients(admin, mockClients, mockCollaborateurChefs, mockCollaborateurs);
      expect(clients.find(c => c.nom === 'Client Inactif')).toBeUndefined();
    });
  });

  describe('canEditCharge', () => {
    it('admin peut modifier toute charge', () => {
      const admin = mockCollaborateurs[0];
      expect(canEditCharge(admin, 2, mockCollaborateurChefs, mockCollaborateurs)).toBe(true);
      expect(canEditCharge(admin, 3, mockCollaborateurChefs, mockCollaborateurs)).toBe(true);
    });

    it('collaborateur peut modifier ses propres charges', () => {
      const collab = mockCollaborateurs[2]; // id: 3
      expect(canEditCharge(collab, 3, mockCollaborateurChefs, mockCollaborateurs)).toBe(true);
    });

    it('collaborateur ne peut pas modifier les charges des autres', () => {
      const collab = mockCollaborateurs[2]; // id: 3
      expect(canEditCharge(collab, 4, mockCollaborateurChefs, mockCollaborateurs)).toBe(false);
    });

    it('chef de mission peut modifier les charges de son équipe', () => {
      const chef = mockCollaborateurs[1]; // id: 2, équipe: 3 et 4
      expect(canEditCharge(chef, 3, mockCollaborateurChefs, mockCollaborateurs)).toBe(true);
      expect(canEditCharge(chef, 4, mockCollaborateurChefs, mockCollaborateurs)).toBe(true);
    });

    it('chef de mission ne peut pas modifier les charges hors équipe', () => {
      const chef = mockCollaborateurs[1]; // id: 2
      expect(canEditCharge(chef, 1, mockCollaborateurChefs, mockCollaborateurs)).toBe(false); // Admin
    });

    it('retourne false si collaborateur null', () => {
      expect(canEditCharge(null, 3, mockCollaborateurChefs, mockCollaborateurs)).toBe(false);
    });
  });

  describe('getVisibleCharges', () => {
    it('admin voit toutes les charges', () => {
      const admin = mockCollaborateurs[0];
      const charges = getVisibleCharges(admin, mockCharges, mockCollaborateurChefs, mockCollaborateurs);
      expect(charges).toHaveLength(4);
    });

    it('chef de mission voit ses charges + celles de son équipe', () => {
      const chef = mockCollaborateurs[1]; // id: 2, équipe: 3 et 4
      const charges = getVisibleCharges(chef, mockCharges, mockCollaborateurChefs, mockCollaborateurs);
      expect(charges).toHaveLength(3); // charges des id 2, 3, 4
      expect(charges.map(c => c.collaborateur_id)).toContain(2);
      expect(charges.map(c => c.collaborateur_id)).toContain(3);
      expect(charges.map(c => c.collaborateur_id)).toContain(4);
    });

    it('collaborateur ne voit que ses propres charges', () => {
      const collab = mockCollaborateurs[2]; // id: 3
      const charges = getVisibleCharges(collab, mockCharges, mockCollaborateurChefs, mockCollaborateurs);
      expect(charges).toHaveLength(1);
      expect(charges[0].collaborateur_id).toBe(3);
    });

    it('retourne tableau vide si collaborateur null', () => {
      const charges = getVisibleCharges(null, mockCharges, mockCollaborateurChefs, mockCollaborateurs);
      expect(charges).toHaveLength(0);
    });
  });
});
