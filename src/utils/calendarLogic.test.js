import { describe, it, expect } from 'vitest';
import {
  getChargesForDate,
  getTotalHoursForDate,
  getAggregatedByClient,
  getVisibleCollaborateurs,
  hasBudgetForDate,
  hasTempsReelsForDate,
  isJourOuvre,
  getWeekDays,
  getWeekTotal,
  countAlerts,
} from './businessLogic';
import { formatDateToYMD } from './dateUtils';

// ============================================
// DONNÉES DE TEST
// ============================================

const mockCollaborateurs = [
  { id: 1, nom: 'Admin', prenom: 'David', actif: true, is_admin: true, est_chef_mission: false },
  { id: 2, nom: 'Chef', prenom: 'Sophie', actif: true, is_admin: false, est_chef_mission: true },
  { id: 3, nom: 'Chef2', prenom: 'Marc', actif: true, is_admin: false, est_chef_mission: true },
  { id: 4, nom: 'Collab', prenom: 'Julie', actif: true, is_admin: false, est_chef_mission: false },
  { id: 5, nom: 'Collab2', prenom: 'Pierre', actif: true, is_admin: false, est_chef_mission: false },
  { id: 6, nom: 'Inactif', prenom: 'Jean', actif: false, is_admin: false, est_chef_mission: false },
];

const activeCollaborateurs = mockCollaborateurs.filter(c => c.actif);

const mockLiaisons = [
  { collaborateur_id: 4, chef_id: 2 }, // Julie -> Sophie
  { collaborateur_id: 5, chef_id: 2 }, // Pierre -> Sophie
  { collaborateur_id: 5, chef_id: 3 }, // Pierre -> Marc aussi
];

const mockClients = [
  { id: 1, nom: 'TechCorp SA', actif: true },
  { id: 2, nom: 'Boutique Mode', actif: true },
  { id: 3, nom: 'Restaurant Gourmet', actif: true },
];

const mockCharges = [
  { id: 1, collaborateur_id: 2, client_id: 1, date_charge: '2026-01-15', heures: 4, type: 'budgété' },
  { id: 2, collaborateur_id: 2, client_id: 2, date_charge: '2026-01-15', heures: 3, type: 'budgété' },
  { id: 3, collaborateur_id: 2, client_id: 1, date_charge: '2026-01-16', heures: 8, type: 'budgété' },
  { id: 4, collaborateur_id: 4, client_id: 1, date_charge: '2026-01-15', heures: 6, type: 'budgété' },
  { id: 5, collaborateur_id: 4, client_id: 3, date_charge: '2026-01-15', heures: 2, type: 'budgété' },
  { id: 6, collaborateur_id: 5, client_id: 2, date_charge: '2026-01-19', heures: 7, type: 'budgété' },
  { id: 7, collaborateur_id: 5, client_id: 2, date_charge: '2026-01-20', heures: 5, type: 'budgété' },
  { id: 8, collaborateur_id: 5, client_id: 2, date_charge: '2026-01-21', heures: 6, type: 'budgété' },
];

const mockTempsReels = [
  { id: 1, collaborateur_id: 2, date: '2026-01-15', heures: 7.5, client_id: 1 },
  { id: 2, collaborateur_id: 4, date: '2026-01-15', heures: 8, client_id: 1 },
  { id: 3, collaborateur_id: 5, date: '2026-01-15', heures: 0, client_id: 2 }, // 0 heures = pas de saisie
];

// ============================================
// TESTS FONCTIONS DE CALCUL
// ============================================

describe('getChargesForDate', () => {
  it('retourne les charges pour un collaborateur et une date', () => {
    const charges = getChargesForDate(mockCharges, 2, '2026-01-15');
    expect(charges).toHaveLength(2);
    expect(charges[0].client_id).toBe(1);
    expect(charges[1].client_id).toBe(2);
  });

  it('retourne tableau vide si aucune charge', () => {
    const charges = getChargesForDate(mockCharges, 2, '2026-01-01');
    expect(charges).toHaveLength(0);
  });

  it('ne retourne pas les charges d\'autres collaborateurs', () => {
    const charges = getChargesForDate(mockCharges, 4, '2026-01-15');
    expect(charges).toHaveLength(2);
    expect(charges.every(c => c.collaborateur_id === 4)).toBe(true);
  });
});

describe('getTotalHoursForDate', () => {
  it('calcule le total des heures pour une date', () => {
    const total = getTotalHoursForDate(mockCharges, 2, '2026-01-15');
    expect(total).toBe(7); // 4 + 3
  });

  it('retourne 0 si aucune charge', () => {
    const total = getTotalHoursForDate(mockCharges, 2, '2026-01-01');
    expect(total).toBe(0);
  });

  it('calcule correctement pour un seul client', () => {
    const total = getTotalHoursForDate(mockCharges, 2, '2026-01-16');
    expect(total).toBe(8);
  });
});

describe('getAggregatedByClient', () => {
  it('agrège les heures par client', () => {
    const aggregated = getAggregatedByClient(mockCharges, mockClients, 2, '2026-01-15');
    expect(aggregated).toHaveLength(2);

    const techCorp = aggregated.find(a => a.client === 'TechCorp SA');
    const boutique = aggregated.find(a => a.client === 'Boutique Mode');

    expect(techCorp.heures).toBe(4);
    expect(boutique.heures).toBe(3);
  });

  it('retourne tableau vide si aucune charge', () => {
    const aggregated = getAggregatedByClient(mockCharges, mockClients, 2, '2026-01-01');
    expect(aggregated).toHaveLength(0);
  });

  it('gère les clients inconnus', () => {
    const chargesAvecClientInconnu = [
      { id: 99, collaborateur_id: 2, client_id: 999, date_charge: '2026-01-20', heures: 5, type: 'budgété' }
    ];
    const aggregated = getAggregatedByClient(chargesAvecClientInconnu, mockClients, 2, '2026-01-20');
    expect(aggregated).toHaveLength(1);
    expect(aggregated[0].client).toBe('Inconnu');
  });
});

// ============================================
// TESTS VISIBILITÉ COLLABORATEURS
// ============================================

describe('getVisibleCollaborateurs', () => {
  it('admin voit tous les collaborateurs actifs', () => {
    const admin = mockCollaborateurs.find(c => c.is_admin);
    const visible = getVisibleCollaborateurs(admin, activeCollaborateurs, mockLiaisons);
    expect(visible).toHaveLength(5); // tous sauf l'inactif
  });

  it('chef de mission voit son équipe', () => {
    const chef = mockCollaborateurs.find(c => c.id === 2); // Sophie
    const visible = getVisibleCollaborateurs(chef, activeCollaborateurs, mockLiaisons);

    // Sophie voit: elle-même (2), Julie (4), Pierre (5), et Marc (3) car Pierre est aussi sous Marc
    const visibleIds = visible.map(c => c.id);
    expect(visibleIds).toContain(2); // Sophie elle-même
    expect(visibleIds).toContain(4); // Julie
    expect(visibleIds).toContain(5); // Pierre
  });

  it('collaborateur voit ses chefs et collègues', () => {
    const julie = mockCollaborateurs.find(c => c.id === 4);
    const visible = getVisibleCollaborateurs(julie, activeCollaborateurs, mockLiaisons);

    const visibleIds = visible.map(c => c.id);
    expect(visibleIds).toContain(4); // Julie elle-même
    expect(visibleIds).toContain(2); // Sophie (son chef)
    expect(visibleIds).toContain(5); // Pierre (collègue sous Sophie)
  });

  it('collaborateur avec plusieurs chefs voit toutes les équipes', () => {
    const pierre = mockCollaborateurs.find(c => c.id === 5);
    const visible = getVisibleCollaborateurs(pierre, activeCollaborateurs, mockLiaisons);

    const visibleIds = visible.map(c => c.id);
    expect(visibleIds).toContain(5); // Pierre lui-même
    expect(visibleIds).toContain(2); // Sophie
    expect(visibleIds).toContain(3); // Marc
    expect(visibleIds).toContain(4); // Julie (collègue sous Sophie)
  });

  it('retourne tableau vide si pas d\'utilisateur', () => {
    const visible = getVisibleCollaborateurs(null, activeCollaborateurs, mockLiaisons);
    expect(visible).toHaveLength(0);
  });
});

// ============================================
// TESTS BUDGET ET TEMPS RÉELS
// ============================================

describe('hasBudgetForDate', () => {
  it('retourne true si budget existe', () => {
    expect(hasBudgetForDate(mockCharges, 2, '2026-01-15')).toBe(true);
  });

  it('retourne false si pas de budget', () => {
    expect(hasBudgetForDate(mockCharges, 2, '2026-01-01')).toBe(false);
  });

  it('vérifie le bon collaborateur', () => {
    expect(hasBudgetForDate(mockCharges, 4, '2026-01-15')).toBe(true);
    expect(hasBudgetForDate(mockCharges, 4, '2026-01-16')).toBe(false);
  });
});

describe('hasTempsReelsForDate', () => {
  it('retourne true si temps réels > 0', () => {
    expect(hasTempsReelsForDate(mockTempsReels, 2, '2026-01-15')).toBe(true);
  });

  it('retourne false si temps = 0', () => {
    expect(hasTempsReelsForDate(mockTempsReels, 5, '2026-01-15')).toBe(false);
  });

  it('retourne false si aucune entrée', () => {
    expect(hasTempsReelsForDate(mockTempsReels, 3, '2026-01-15')).toBe(false);
  });
});

// ============================================
// TESTS JOURS OUVRÉS
// ============================================

describe('isJourOuvre', () => {
  it('lundi est un jour ouvré', () => {
    const lundi = new Date(2026, 0, 19); // 19 janvier 2026 = lundi
    expect(isJourOuvre(lundi)).toBe(true);
  });

  it('vendredi est un jour ouvré', () => {
    const vendredi = new Date(2026, 0, 23); // 23 janvier 2026 = vendredi
    expect(isJourOuvre(vendredi)).toBe(true);
  });

  it('samedi n\'est pas un jour ouvré', () => {
    const samedi = new Date(2026, 0, 17); // 17 janvier 2026 = samedi
    expect(isJourOuvre(samedi)).toBe(false);
  });

  it('dimanche n\'est pas un jour ouvré', () => {
    const dimanche = new Date(2026, 0, 18); // 18 janvier 2026 = dimanche
    expect(isJourOuvre(dimanche)).toBe(false);
  });
});

// ============================================
// TESTS NAVIGATION SEMAINE
// ============================================

describe('getWeekDays', () => {
  it('retourne 7 jours', () => {
    const days = getWeekDays(new Date(2026, 0, 15));
    expect(days).toHaveLength(7);
  });

  it('commence le lundi et finit le dimanche', () => {
    const days = getWeekDays(new Date(2026, 0, 15)); // jeudi 15 janvier
    expect(days[0].getDay()).toBe(1); // lundi
    expect(days[6].getDay()).toBe(0); // dimanche
  });

  it('gère l\'offset de semaine positif', () => {
    const baseDate = new Date(2026, 0, 15);
    const nextWeek = getWeekDays(baseDate, 1);
    const thisWeek = getWeekDays(baseDate, 0);

    // La semaine suivante devrait être 7 jours plus tard
    const diff = (nextWeek[0].getTime() - thisWeek[0].getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBe(7);
  });

  it('gère l\'offset de semaine négatif', () => {
    const baseDate = new Date(2026, 0, 15);
    const prevWeek = getWeekDays(baseDate, -1);
    const thisWeek = getWeekDays(baseDate, 0);

    const diff = (thisWeek[0].getTime() - prevWeek[0].getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBe(7);
  });
});

describe('getWeekTotal', () => {
  it('calcule le total des heures sur la semaine', () => {
    // Pierre a des charges du 19 au 21 janvier 2026
    const weekDays = getWeekDays(new Date(2026, 0, 19), 0); // Semaine du 19 janvier
    const total = getWeekTotal(mockCharges, 5, weekDays, formatDateToYMD);
    // Pierre: 7h (19/01) + 5h (20/01) + 6h (21/01) = 18h
    expect(total).toBe(18);
  });

  it('retourne 0 si aucune charge cette semaine', () => {
    const weekDays = getWeekDays(new Date(2026, 0, 5), 0); // Première semaine de janvier
    const total = getWeekTotal(mockCharges, 5, weekDays, formatDateToYMD);
    expect(total).toBe(0);
  });
});

// ============================================
// TESTS ALERTES
// ============================================

describe('countAlerts', () => {
  const collaborateurs = [
    { id: 1, nom: 'Collab1' },
    { id: 2, nom: 'Collab2' },
    { id: 3, nom: 'Collab3' },
  ];

  const charges = [
    { id: 1, collaborateur_id: 1, date_charge: '2026-01-19', heures: 4 },
    { id: 2, collaborateur_id: 2, date_charge: '2026-01-19', heures: 8 },
    // Collab3 n'a pas de budget
  ];

  const tempsReels = [
    { collaborateur_id: 1, date: '2026-01-16', heures: 8 },
    { collaborateur_id: 2, date: '2026-01-16', heures: 7 },
    // Collab3 n'a pas de temps réels
  ];

  it('compte les collaborateurs sans budget', () => {
    const count = countAlerts(
      collaborateurs,
      charges,
      tempsReels,
      [],
      '2026-01-19',
      '2026-01-16',
      true, // hier était jour ouvré
      true  // après 10h
    );
    // Collab3 n'a pas de budget
    expect(count).toBe(1);
  });

  it('ignore les collaborateurs en sourdine', () => {
    const count = countAlerts(
      collaborateurs,
      charges,
      tempsReels,
      [3], // Collab3 en sourdine
      '2026-01-19',
      '2026-01-16',
      true,
      true
    );
    expect(count).toBe(0);
  });

  it('ne compte pas les alertes temps réels avant 10h', () => {
    const chargesSansBudget = [];
    const tempsVide = [];

    const countAvant10h = countAlerts(
      collaborateurs,
      chargesSansBudget,
      tempsVide,
      [],
      '2026-01-19',
      '2026-01-16',
      true,
      false // avant 10h
    );

    // Tous les 3 n'ont pas de budget
    expect(countAvant10h).toBe(3);
  });

  it('ne compte pas les alertes temps réels le week-end', () => {
    const chargesCompletes = [
      { id: 1, collaborateur_id: 1, date_charge: '2026-01-19', heures: 4 },
      { id: 2, collaborateur_id: 2, date_charge: '2026-01-19', heures: 8 },
      { id: 3, collaborateur_id: 3, date_charge: '2026-01-19', heures: 6 },
    ];
    const tempsVide = [];

    const count = countAlerts(
      collaborateurs,
      chargesCompletes,
      tempsVide,
      [],
      '2026-01-19',
      '2026-01-18', // dimanche
      false, // week-end
      true
    );

    // Tout le monde a un budget et hier était week-end
    expect(count).toBe(0);
  });

  it('compte les alertes pour temps réels manquants', () => {
    const chargesCompletes = [
      { id: 1, collaborateur_id: 1, date_charge: '2026-01-19', heures: 4 },
      { id: 2, collaborateur_id: 2, date_charge: '2026-01-19', heures: 8 },
      { id: 3, collaborateur_id: 3, date_charge: '2026-01-19', heures: 6 },
    ];

    const tempsPartiels = [
      { collaborateur_id: 1, date: '2026-01-16', heures: 8 },
      // Collab2 et Collab3 sans temps réels
    ];

    const count = countAlerts(
      collaborateurs,
      chargesCompletes,
      tempsPartiels,
      [],
      '2026-01-19',
      '2026-01-16',
      true,
      true
    );

    // Collab2 et Collab3 n'ont pas de temps réels hier
    expect(count).toBe(2);
  });
});
