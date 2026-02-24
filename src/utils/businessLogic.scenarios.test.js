import { describe, it, expect } from 'vitest';
import {
  getChefsOf,
  getEquipeOf,
  getAccessibleClients,
  canEditCharge,
  getVisibleCharges
} from './businessLogic';

/**
 * Tests de scénarios métier réalistes
 * Simule des cas d'usage réels du cabinet comptable
 */

// ============================================
// DONNÉES DE TEST - CABINET COMPTABLE ZERAH
// ============================================

/** @type {import('../types.js').Collaborateur[]} */
const cabinet = {
  // Direction
  admin: { id: 1, nom: 'Zerah', prenom: 'David', email: 'david@zerah.com', actif: true, is_admin: true, est_chef_mission: false },

  // Chefs de mission
  chefAudit: { id: 2, nom: 'Martin', prenom: 'Sophie', email: 'sophie@zerah.com', actif: true, is_admin: false, est_chef_mission: true },
  chefCompta: { id: 3, nom: 'Dubois', prenom: 'Pierre', email: 'pierre@zerah.com', actif: true, is_admin: false, est_chef_mission: true },
  chefInactif: { id: 4, nom: 'Ancien', prenom: 'Chef', email: 'ancien@zerah.com', actif: false, is_admin: false, est_chef_mission: true },

  // Collaborateurs équipe Audit
  collabAudit1: { id: 5, nom: 'Petit', prenom: 'Marie', email: 'marie@zerah.com', actif: true, is_admin: false, est_chef_mission: false },
  collabAudit2: { id: 6, nom: 'Grand', prenom: 'Jean', email: 'jean@zerah.com', actif: true, is_admin: false, est_chef_mission: false },

  // Collaborateurs équipe Compta
  collabCompta1: { id: 7, nom: 'Roux', prenom: 'Lucie', email: 'lucie@zerah.com', actif: true, is_admin: false, est_chef_mission: false },
  collabCompta2: { id: 8, nom: 'Blanc', prenom: 'Paul', email: 'paul@zerah.com', actif: true, is_admin: false, est_chef_mission: false },

  // Collaborateur multi-équipes (travaille pour 2 chefs)
  collabMulti: { id: 9, nom: 'Dupont', prenom: 'Claire', email: 'claire@zerah.com', actif: true, is_admin: false, est_chef_mission: false },

  // Stagiaire (sans chef assigné)
  stagiaire: { id: 10, nom: 'Nouveau', prenom: 'Tom', email: 'tom@zerah.com', actif: true, is_admin: false, est_chef_mission: false },
};

const allCollaborateurs = Object.values(cabinet);

/** @type {import('../types.js').CollaborateurChef[]} */
const liaisons = [
  // Équipe Audit sous Sophie
  { id: 1, collaborateur_id: 5, chef_id: 2 }, // Marie → Sophie
  { id: 2, collaborateur_id: 6, chef_id: 2 }, // Jean → Sophie

  // Équipe Compta sous Pierre
  { id: 3, collaborateur_id: 7, chef_id: 3 }, // Lucie → Pierre
  { id: 4, collaborateur_id: 8, chef_id: 3 }, // Paul → Pierre

  // Claire travaille pour les deux
  { id: 5, collaborateur_id: 9, chef_id: 2 }, // Claire → Sophie
  { id: 6, collaborateur_id: 9, chef_id: 3 }, // Claire → Pierre
];

/** @type {import('../types.js').Client[]} */
const clients = [
  // Clients Audit (Sophie)
  { id: 1, nom: 'TechCorp SA', actif: true, chef_mission_id: 2 },
  { id: 2, nom: 'StartUp Innovation', actif: true, chef_mission_id: 2 },

  // Clients Compta (Pierre)
  { id: 3, nom: 'Restaurant Le Gourmet', actif: true, chef_mission_id: 3 },
  { id: 4, nom: 'Boulangerie Martin', actif: true, chef_mission_id: 3 },

  // Clients sans chef assigné (accessibles à tous)
  { id: 5, nom: 'Nouveau Client', actif: true, chef_mission_id: null },
  { id: 6, nom: 'Prospect en cours', actif: true, chef_mission_id: null },

  // Client inactif (ne doit jamais apparaître)
  { id: 7, nom: 'Ancien Client Fermé', actif: false, chef_mission_id: 2 },

  // Client de l'ancien chef (inactif)
  { id: 8, nom: 'Client Orphelin', actif: true, chef_mission_id: 4 },
];

/** @type {import('../types.js').Charge[]} */
const charges = [
  // Charges équipe Audit
  { id: 1, collaborateur_id: 2, client_id: 1, date: '2025-01-15', duree: 4, commentaire: 'Audit annuel' },
  { id: 2, collaborateur_id: 5, client_id: 1, date: '2025-01-15', duree: 8, commentaire: 'Revue des comptes' },
  { id: 3, collaborateur_id: 6, client_id: 2, date: '2025-01-16', duree: 6, commentaire: 'Mission conseil' },

  // Charges équipe Compta
  { id: 4, collaborateur_id: 3, client_id: 3, date: '2025-01-15', duree: 3, commentaire: 'Bilan annuel' },
  { id: 5, collaborateur_id: 7, client_id: 3, date: '2025-01-15', duree: 8, commentaire: 'Saisie comptable' },
  { id: 6, collaborateur_id: 8, client_id: 4, date: '2025-01-16', duree: 4, commentaire: 'TVA' },

  // Charges Claire (multi-équipes)
  { id: 7, collaborateur_id: 9, client_id: 1, date: '2025-01-17', duree: 4, commentaire: 'Support audit' },
  { id: 8, collaborateur_id: 9, client_id: 3, date: '2025-01-17', duree: 4, commentaire: 'Support compta' },

  // Charge admin
  { id: 9, collaborateur_id: 1, client_id: 5, date: '2025-01-18', duree: 2, commentaire: 'Rendez-vous prospect' },
];

// ============================================
// SCÉNARIOS MÉTIER
// ============================================

describe('Scénarios métier - Cabinet comptable', () => {

  describe('Scénario 1: Hiérarchie du cabinet', () => {
    it('Sophie (chef audit) a 3 collaborateurs dans son équipe', () => {
      const equipe = getEquipeOf(cabinet.chefAudit.id, liaisons, allCollaborateurs);
      expect(equipe).toHaveLength(3);
      expect(equipe.map(c => c.prenom)).toContain('Marie');
      expect(equipe.map(c => c.prenom)).toContain('Jean');
      expect(equipe.map(c => c.prenom)).toContain('Claire');
    });

    it('Pierre (chef compta) a 3 collaborateurs dans son équipe', () => {
      const equipe = getEquipeOf(cabinet.chefCompta.id, liaisons, allCollaborateurs);
      expect(equipe).toHaveLength(3);
      expect(equipe.map(c => c.prenom)).toContain('Lucie');
      expect(equipe.map(c => c.prenom)).toContain('Paul');
      expect(equipe.map(c => c.prenom)).toContain('Claire');
    });

    it('Claire (multi-équipes) a 2 chefs de mission', () => {
      const chefs = getChefsOf(cabinet.collabMulti.id, liaisons, allCollaborateurs);
      expect(chefs).toHaveLength(2);
      expect(chefs.map(c => c.prenom)).toContain('Sophie');
      expect(chefs.map(c => c.prenom)).toContain('Pierre');
    });

    it('Le stagiaire Tom n\'a pas de chef assigné', () => {
      const chefs = getChefsOf(cabinet.stagiaire.id, liaisons, allCollaborateurs);
      expect(chefs).toHaveLength(0);
    });

    it('L\'admin David n\'a pas d\'équipe (il n\'est pas chef de mission)', () => {
      const equipe = getEquipeOf(cabinet.admin.id, liaisons, allCollaborateurs);
      expect(equipe).toHaveLength(0);
    });
  });

  describe('Scénario 2: Accès aux clients selon le rôle', () => {
    it('Admin voit tous les clients y compris inactifs (8 clients)', () => {
      const accessibles = getAccessibleClients(cabinet.admin, clients, liaisons, allCollaborateurs);
      // 7 actifs + 1 inactif = 8 total
      expect(accessibles).toHaveLength(8);
      expect(accessibles.find(c => c.nom === 'Ancien Client Fermé')).toBeDefined();
    });

    it('Sophie (chef audit) voit ses clients + clients sans chef + inactifs (5 clients)', () => {
      const accessibles = getAccessibleClients(cabinet.chefAudit, clients, liaisons, allCollaborateurs);
      // Client A (chef 2) + StartUp (chef 2) + Nouveau + Prospect + Ancien Client Fermé (chef 2) = 5
      expect(accessibles).toHaveLength(5);
      expect(accessibles.map(c => c.nom)).toContain('TechCorp SA');
      expect(accessibles.map(c => c.nom)).toContain('StartUp Innovation');
      expect(accessibles.map(c => c.nom)).toContain('Nouveau Client');
      expect(accessibles.map(c => c.nom)).toContain('Prospect en cours');
      expect(accessibles.map(c => c.nom)).toContain('Ancien Client Fermé');
      // Ne voit pas les clients de Pierre
      expect(accessibles.map(c => c.nom)).not.toContain('Restaurant Le Gourmet');
    });

    it('Marie (équipe audit) voit les clients de Sophie + sans chef (5 clients)', () => {
      const accessibles = getAccessibleClients(cabinet.collabAudit1, clients, liaisons, allCollaborateurs);
      // 4 actifs + 1 inactif (chef 2) = 5
      expect(accessibles).toHaveLength(5);
      expect(accessibles.map(c => c.nom)).toContain('TechCorp SA');
      expect(accessibles.map(c => c.nom)).not.toContain('Restaurant Le Gourmet');
    });

    it('Claire (multi-équipes) voit les clients des 2 chefs + sans chef (7 clients)', () => {
      const accessibles = getAccessibleClients(cabinet.collabMulti, clients, liaisons, allCollaborateurs);
      // Voit clients Sophie (2) + clients Pierre (2) + sans chef (2) + inactif (chef 2) = 7
      expect(accessibles).toHaveLength(7);
      expect(accessibles.map(c => c.nom)).toContain('TechCorp SA');
      expect(accessibles.map(c => c.nom)).toContain('Restaurant Le Gourmet');
    });

    it('Tom (stagiaire sans chef) ne voit que les clients sans chef assigné (2 clients)', () => {
      const accessibles = getAccessibleClients(cabinet.stagiaire, clients, liaisons, allCollaborateurs);
      expect(accessibles).toHaveLength(2);
      expect(accessibles.map(c => c.nom)).toContain('Nouveau Client');
      expect(accessibles.map(c => c.nom)).toContain('Prospect en cours');
    });
  });

  describe('Scénario 3: Visibilité des charges', () => {
    it('Admin voit toutes les charges (9)', () => {
      const visibles = getVisibleCharges(cabinet.admin, charges, liaisons, allCollaborateurs);
      expect(visibles).toHaveLength(9);
    });

    it('Sophie (chef audit) voit ses charges + celles de son équipe (5)', () => {
      const visibles = getVisibleCharges(cabinet.chefAudit, charges, liaisons, allCollaborateurs);
      // Sophie (1) + Marie (1) + Jean (1) + Claire audit (1) + Claire compta (1 car elle est dans l'équipe)
      expect(visibles).toHaveLength(5);
      expect(visibles.map(c => c.commentaire)).toContain('Audit annuel');
      expect(visibles.map(c => c.commentaire)).toContain('Revue des comptes');
      expect(visibles.map(c => c.commentaire)).toContain('Mission conseil');
    });

    it('Marie (collaborateur) ne voit que ses propres charges (1)', () => {
      const visibles = getVisibleCharges(cabinet.collabAudit1, charges, liaisons, allCollaborateurs);
      expect(visibles).toHaveLength(1);
      expect(visibles[0].commentaire).toBe('Revue des comptes');
    });

    it('Claire (multi-équipes) ne voit que ses propres charges (2)', () => {
      const visibles = getVisibleCharges(cabinet.collabMulti, charges, liaisons, allCollaborateurs);
      expect(visibles).toHaveLength(2);
      expect(visibles.map(c => c.commentaire)).toContain('Support audit');
      expect(visibles.map(c => c.commentaire)).toContain('Support compta');
    });
  });

  describe('Scénario 4: Droits de modification des charges', () => {
    it('Admin peut modifier toutes les charges', () => {
      expect(canEditCharge(cabinet.admin, 5, liaisons, allCollaborateurs)).toBe(true); // Charge de Marie
      expect(canEditCharge(cabinet.admin, 7, liaisons, allCollaborateurs)).toBe(true); // Charge de Lucie
    });

    it('Sophie peut modifier les charges de son équipe', () => {
      expect(canEditCharge(cabinet.chefAudit, 5, liaisons, allCollaborateurs)).toBe(true); // Marie
      expect(canEditCharge(cabinet.chefAudit, 6, liaisons, allCollaborateurs)).toBe(true); // Jean
      expect(canEditCharge(cabinet.chefAudit, 9, liaisons, allCollaborateurs)).toBe(true); // Claire
    });

    it('Sophie ne peut PAS modifier les charges de l\'équipe Compta', () => {
      expect(canEditCharge(cabinet.chefAudit, 7, liaisons, allCollaborateurs)).toBe(false); // Lucie
      expect(canEditCharge(cabinet.chefAudit, 8, liaisons, allCollaborateurs)).toBe(false); // Paul
    });

    it('Marie peut modifier ses propres charges mais pas celles des autres', () => {
      expect(canEditCharge(cabinet.collabAudit1, 5, liaisons, allCollaborateurs)).toBe(true); // Sa charge
      expect(canEditCharge(cabinet.collabAudit1, 6, liaisons, allCollaborateurs)).toBe(false); // Charge de Jean
      expect(canEditCharge(cabinet.collabAudit1, 2, liaisons, allCollaborateurs)).toBe(false); // Charge de Sophie
    });

    it('Claire peut modifier ses charges mais pas celles de ses chefs', () => {
      expect(canEditCharge(cabinet.collabMulti, 9, liaisons, allCollaborateurs)).toBe(true); // Sa charge
      expect(canEditCharge(cabinet.collabMulti, 2, liaisons, allCollaborateurs)).toBe(false); // Sophie
      expect(canEditCharge(cabinet.collabMulti, 3, liaisons, allCollaborateurs)).toBe(false); // Pierre
    });
  });

  describe('Scénario 5: Cas limites et erreurs', () => {
    it('Collaborateur null ne peut rien voir ni modifier', () => {
      const visibles = getVisibleCharges(null, charges, liaisons, allCollaborateurs);
      expect(visibles).toHaveLength(0);

      expect(canEditCharge(null, 1, liaisons, allCollaborateurs)).toBe(false);
    });

    it('Chef inactif n\'apparaît pas dans les équipes actives', () => {
      // Personne n'a le chef inactif comme chef (les liaisons n'existent pas dans nos données de test)
      const equipe = getEquipeOf(cabinet.chefInactif.id, liaisons, allCollaborateurs);
      expect(equipe).toHaveLength(0);
    });

    it('Client inactif est accessible (pour saisie temps bilans en cours)', () => {
      const adminClients = getAccessibleClients(cabinet.admin, clients, liaisons, allCollaborateurs);
      const ancien = adminClients.find(c => c.nom === 'Ancien Client Fermé');
      expect(ancien).toBeDefined();
      expect(ancien.actif).toBe(false);
    });

    it('Charge avec collaborateur_id inexistant est gérée', () => {
      const chargesAvecErreur = [...charges, { id: 99, collaborateur_id: 999, client_id: 1, date: '2025-01-20', duree: 1 }];
      // Ne doit pas planter
      const visibles = getVisibleCharges(cabinet.admin, chargesAvecErreur, liaisons, allCollaborateurs);
      expect(visibles).toHaveLength(10); // Admin voit tout y compris la charge "orpheline"
    });
  });

  describe('Scénario 6: Cohérence des permissions', () => {
    it('Si on voit une charge, on peut la modifier OU on est simple collaborateur', () => {
      // Pour chaque collaborateur, vérifier que les charges visibles sont soit modifiables, soit les siennes
      const collaborateurs = [cabinet.chefAudit, cabinet.chefCompta, cabinet.collabAudit1, cabinet.collabCompta1];

      collaborateurs.forEach(collab => {
        const visibles = getVisibleCharges(collab, charges, liaisons, allCollaborateurs);
        visibles.forEach(charge => {
          const canEdit = canEditCharge(collab, charge.collaborateur_id, liaisons, allCollaborateurs);
          const isOwnCharge = charge.collaborateur_id === collab.id;

          // Si c'est un chef, il peut modifier. Si c'est un collaborateur, c'est forcément sa charge.
          if (collab.est_chef_mission) {
            expect(canEdit).toBe(true);
          } else {
            expect(isOwnCharge).toBe(true);
          }
        });
      });
    });

    it('Un collaborateur ne peut pas modifier plus de charges qu\'il n\'en voit', () => {
      const collab = cabinet.collabAudit1;
      const visibles = getVisibleCharges(collab, charges, liaisons, allCollaborateurs);

      let modifiables = 0;
      charges.forEach(charge => {
        if (canEditCharge(collab, charge.collaborateur_id, liaisons, allCollaborateurs)) {
          modifiables++;
        }
      });

      expect(modifiables).toBeLessThanOrEqual(visibles.length);
    });
  });
});
