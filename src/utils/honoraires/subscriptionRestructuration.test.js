// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyserClient, calculerStatistiques } from './subscriptionRestructuration.js';

// === Mock Supabase ===

function createMockSupabase({ client, abonnements, tarifs }) {
  const fromMock = (table) => {
    if (table === 'clients') {
      return {
        select: () => ({
          eq: (col, val) => ({
            single: async () => ({ data: client, error: null })
          })
        })
      };
    }
    if (table === 'abonnements') {
      return {
        select: () => ({
          eq: (col, val) => ({
            in: (col2, vals) => Promise.resolve({ data: abonnements, error: null })
          })
        })
      };
    }
    if (table === 'tarifs_reference') {
      return {
        select: () => ({
          eq: function (col, val) {
            // Chain multiple .eq() calls
            const self = this;
            return {
              eq: (col2, val2) => Promise.resolve({ data: tarifs, error: null })
            };
          }
        })
      };
    }
    return { select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) };
  };

  return { from: fromMock };
}

// === Test data ===

const clientHFC = {
  id: 45,
  nom: 'HFC INVEST',
  cabinet: 'Audit Up',
  siren: '838444347',
  pennylane_customer_id: 'C1BKRUNGIS',
  actif: true
};

const abonnementsHFC = [
  {
    id: 100,
    label: 'BK RUNGIS HFC INVEST',
    status: 'in_progress',
    frequence: 'monthly',
    intervalle: 1,
    jour_facturation: 31,
    mode_finalisation: 'awaiting_validation',
    conditions_paiement: 'upon_receipt',
    moyen_paiement: 'offline',
    date_debut: '2024-01-01',
    total_ht: 2250,
    total_ttc: 2700,
    pennylane_subscription_id: 2307848,
    abonnements_lignes: [
      { id: 8830, label: 'Etablissement du P&L', quantite: 1, montant_ht: 205, montant_ttc: 246, taux_tva: 'FR_200', famille: 'comptabilite', description: '' },
      { id: 8832, label: 'Mission comptable', quantite: 1, montant_ht: 1790, montant_ttc: 2148, taux_tva: 'FR_200', famille: 'comptabilite', description: '' },
      { id: 8835, label: 'Mise à disposition de logiciel', quantite: 1, montant_ht: 255, montant_ttc: 306, taux_tva: 'FR_200', famille: 'support', description: '' }
    ]
  },
  {
    id: 101,
    label: 'BK RUNGIS HFC INVEST',
    status: 'not_started',
    frequence: 'yearly',
    intervalle: 1,
    jour_facturation: 31,
    mode_finalisation: 'awaiting_validation',
    conditions_paiement: 'upon_receipt',
    moyen_paiement: 'offline',
    date_debut: '2024-01-01',
    total_ht: 1,
    total_ttc: 1.2,
    pennylane_subscription_id: 2307851,
    abonnements_lignes: [
      { id: 8831, label: 'Etablissement du secrétariat juridique', quantite: 1, montant_ht: 1, montant_ttc: 1.2, taux_tva: 'FR_200', famille: 'juridique', description: '' }
    ]
  },
  {
    id: 102,
    label: 'BK RUNGIS HFC INVEST',
    status: 'not_started',
    frequence: 'yearly',
    intervalle: 1,
    jour_facturation: 31,
    mode_finalisation: 'awaiting_validation',
    conditions_paiement: 'upon_receipt',
    moyen_paiement: 'offline',
    date_debut: '2024-01-01',
    total_ht: 1,
    total_ttc: 1.2,
    pennylane_subscription_id: 2307850,
    abonnements_lignes: [
      { id: 8833, label: 'Etablissement du Bilan', quantite: 1, montant_ht: 1, montant_ttc: 1.2, taux_tva: 'FR_200', famille: 'comptabilite', description: '' }
    ]
  },
  {
    id: 103,
    label: 'BK RUNGIS HFC INVEST',
    status: 'in_progress',
    frequence: 'monthly',
    intervalle: 1,
    jour_facturation: 31,
    mode_finalisation: 'awaiting_validation',
    conditions_paiement: 'upon_receipt',
    moyen_paiement: 'offline',
    date_debut: '2024-01-01',
    total_ht: 82.5,
    total_ttc: 99,
    pennylane_subscription_id: 2307849,
    abonnements_lignes: [
      { id: 8840, label: 'Dépôt coffre-fort numérique', quantite: 1, montant_ht: 1, montant_ttc: 1.2, taux_tva: 'FR_200', famille: 'social', description: '' },
      { id: 8841, label: 'Modification de bulletin de salaires sur votre demande', quantite: 1, montant_ht: 15.8, montant_ttc: 18.96, taux_tva: 'FR_200', famille: 'social', description: '' },
      { id: 8842, label: 'Enregistrement de sortie de salariés', quantite: 1, montant_ht: 31.6, montant_ttc: 37.92, taux_tva: 'FR_200', famille: 'social', description: '' },
      { id: 8843, label: 'Bulletins envoyés par publi-postage', quantite: 1, montant_ht: 2.5, montant_ttc: 3, taux_tva: 'FR_200', famille: 'social', description: '' },
      { id: 8844, label: "Enregistrement d'entrée de salariés", quantite: 1, montant_ht: 15.8, montant_ttc: 18.96, taux_tva: 'FR_200', famille: 'social', description: '' },
      { id: 8845, label: 'Etablissement du bulletin de salaire', quantite: 1, montant_ht: 15.8, montant_ttc: 18.96, taux_tva: 'FR_200', famille: 'social', description: '' }
    ]
  }
];

const tarifsHFC = [
  { label: 'Mise à disposition de logiciel', axe: 'support', type_recurrence: 'fixe', pu_ht: 260, quantite: 1, abonnement_ligne_id: 8835 },
  { label: 'Etablissement du P&L', axe: 'pl', type_recurrence: 'fixe', pu_ht: 210.12, quantite: 1, abonnement_ligne_id: 8830 },
  { label: 'Etablissement du secrétariat juridique', axe: 'juridique', type_recurrence: 'fixe', pu_ht: 1.02, quantite: 1, abonnement_ligne_id: 8831 },
  { label: 'Mission comptable', axe: 'compta_mensuelle', type_recurrence: 'fixe', pu_ht: 1835, quantite: 1, abonnement_ligne_id: 8832 },
  { label: 'Etablissement du Bilan', axe: 'bilan', type_recurrence: 'fixe', pu_ht: 1.02, quantite: 1, abonnement_ligne_id: 8833 },
  { label: 'Enregistrement de sortie de salariés', axe: 'accessoires_social', type_recurrence: 'variable', pu_ht: 32.4, quantite: 1, abonnement_ligne_id: 8842 },
  { label: 'Etablissement du bulletin de salaire', axe: 'social_bulletin', type_recurrence: 'variable', pu_ht: 16.2, quantite: 1, abonnement_ligne_id: 8845 },
  { label: 'Dépôt coffre-fort numérique', axe: 'accessoires_social', type_recurrence: 'variable', pu_ht: 1, quantite: 1, abonnement_ligne_id: 8840 },
  { label: 'Bulletins envoyés par publi-postage', axe: 'accessoires_social', type_recurrence: 'variable', pu_ht: 2.55, quantite: 1, abonnement_ligne_id: 8843 },
  { label: 'Modification de bulletin de salaires sur votre demande', axe: 'accessoires_social', type_recurrence: 'variable', pu_ht: 16.2, quantite: 1, abonnement_ligne_id: 8841 },
  { label: "Enregistrement d'entrée de salariés", axe: 'accessoires_social', type_recurrence: 'variable', pu_ht: 16.2, quantite: 1, abonnement_ligne_id: 8844 }
];

// === Tests ===

describe('analyserClient', () => {
  it('sépare correctement les lignes fixes et variables pour HFC INVEST', async () => {
    const supabase = createMockSupabase({
      client: clientHFC,
      abonnements: abonnementsHFC,
      tarifs: tarifsHFC
    });

    const plan = await analyserClient({ clientId: 45, supabase });

    expect(plan.client_id).toBe(45);
    expect(plan.client_nom).toBe('HFC INVEST');
    expect(plan.cabinet).toBe('Audit Up');
    expect(plan.siren).toBe('838444347');
    expect(plan.nb_lignes_fixes).toBe(5);
    expect(plan.nb_lignes_variables).toBe(6);
  });

  it('calcule les totaux HT correctement', async () => {
    const supabase = createMockSupabase({
      client: clientHFC,
      abonnements: abonnementsHFC,
      tarifs: tarifsHFC
    });

    const plan = await analyserClient({ clientId: 45, supabase });

    // Total HT actuel = 2250 + 1 + 1 + 82.5 (sum of all montant_ht from lignes)
    expect(plan.total_ht_actuel).toBeGreaterThan(0);
    // Total HT variable = 82.5 (1 + 15.8 + 31.6 + 2.5 + 15.8 + 15.8)
    expect(plan.total_ht_variable_actuel).toBeCloseTo(82.5, 1);
    // Total HT fixe 2026 = 210.12 + 1835 + 260 + 1.02 + 1.02 = 2307.16
    expect(plan.total_ht_fixe_2026).toBeCloseTo(2307.16, 1);
  });

  it('marque les abonnements 100% fixe comme "inchange"', async () => {
    const supabase = createMockSupabase({
      client: clientHFC,
      abonnements: abonnementsHFC,
      tarifs: tarifsHFC
    });

    const plan = await analyserClient({ clientId: 45, supabase });

    // Abo mensuel fixe (id=100) : inchangé
    const aboFixe = plan.abonnements.find(a => a.abonnement_id === 100);
    expect(aboFixe.decision).toBe('inchange');
    expect(aboFixe.lignes_fixes.length).toBe(3);
    expect(aboFixe.lignes_variables.length).toBe(0);
  });

  it('marque les abonnements 100% variable comme "a_supprimer"', async () => {
    const supabase = createMockSupabase({
      client: clientHFC,
      abonnements: abonnementsHFC,
      tarifs: tarifsHFC
    });

    const plan = await analyserClient({ clientId: 45, supabase });

    // Abo mensuel variable (id=103) : à supprimer
    const aboVar = plan.abonnements.find(a => a.abonnement_id === 103);
    expect(aboVar.decision).toBe('a_supprimer');
    expect(aboVar.lignes_fixes.length).toBe(0);
    expect(aboVar.lignes_variables.length).toBe(6);
  });

  it('applique les nouveaux prix 2026 aux lignes fixes', async () => {
    const supabase = createMockSupabase({
      client: clientHFC,
      abonnements: abonnementsHFC,
      tarifs: tarifsHFC
    });

    const plan = await analyserClient({ clientId: 45, supabase });

    const aboFixe = plan.abonnements.find(a => a.abonnement_id === 100);

    // P&L : ancien 205, nouveau 210.12
    const pl = aboFixe.lignes_fixes.find(l => l.label === 'Etablissement du P&L');
    expect(pl.ancien_pu_ht).toBe(205);
    expect(pl.nouveau_pu_ht).toBe(210.12);

    // Mission comptable : ancien 1790, nouveau 1835
    const compta = aboFixe.lignes_fixes.find(l => l.label === 'Mission comptable');
    expect(compta.ancien_pu_ht).toBe(1790);
    expect(compta.nouveau_pu_ht).toBe(1835);

    // Support : ancien 255, nouveau 260
    const support = aboFixe.lignes_fixes.find(l => l.label === 'Mise à disposition de logiciel');
    expect(support.ancien_pu_ht).toBe(255);
    expect(support.nouveau_pu_ht).toBe(260);
  });

  it('marque toutes les lignes variables avec action "supprimer"', async () => {
    const supabase = createMockSupabase({
      client: clientHFC,
      abonnements: abonnementsHFC,
      tarifs: tarifsHFC
    });

    const plan = await analyserClient({ clientId: 45, supabase });

    const aboVar = plan.abonnements.find(a => a.abonnement_id === 103);
    for (const ligne of aboVar.lignes_variables) {
      expect(ligne.action).toBe('supprimer');
      expect(ligne.type_recurrence).toBe('variable');
    }
  });

  it('classifie correctement les axes des lignes variables', async () => {
    const supabase = createMockSupabase({
      client: clientHFC,
      abonnements: abonnementsHFC,
      tarifs: tarifsHFC
    });

    const plan = await analyserClient({ clientId: 45, supabase });

    const aboVar = plan.abonnements.find(a => a.abonnement_id === 103);

    const bulletin = aboVar.lignes_variables.find(l => l.label.includes('bulletin de salaire') && !l.label.includes('Modification'));
    expect(bulletin.axe).toBe('social_bulletin');

    const coffreFort = aboVar.lignes_variables.find(l => l.label.includes('coffre-fort'));
    expect(coffreFort.axe).toBe('accessoires_social');

    const sortie = aboVar.lignes_variables.find(l => l.label.includes('sortie'));
    expect(sortie.axe).toBe('accessoires_social');
  });

  it('gère un client sans abonnements', async () => {
    const supabase = createMockSupabase({
      client: { ...clientHFC, id: 999 },
      abonnements: [],
      tarifs: []
    });

    const plan = await analyserClient({ clientId: 999, supabase });

    expect(plan.abonnements.length).toBe(0);
    expect(plan.nb_lignes_fixes).toBe(0);
    expect(plan.nb_lignes_variables).toBe(0);
    expect(plan.total_ht_actuel).toBe(0);
  });

  it('gère un abonnement mixte (fixe + variable) avec decision "a_modifier"', async () => {
    // Create a mixed abonnement: 1 fixe + 1 variable in the same sub
    const mixedAbonnements = [{
      id: 200,
      label: 'Mixed sub',
      status: 'in_progress',
      frequence: 'monthly',
      intervalle: 1,
      jour_facturation: 31,
      mode_finalisation: 'awaiting_validation',
      conditions_paiement: 'upon_receipt',
      moyen_paiement: 'offline',
      date_debut: '2024-01-01',
      total_ht: 300,
      total_ttc: 360,
      pennylane_subscription_id: 9999,
      abonnements_lignes: [
        { id: 9001, label: 'Mission comptable', quantite: 1, montant_ht: 200, montant_ttc: 240, taux_tva: 'FR_200', famille: 'comptabilite', description: '' },
        { id: 9002, label: 'Etablissement du bulletin de salaire', quantite: 5, montant_ht: 100, montant_ttc: 120, taux_tva: 'FR_200', famille: 'social', description: '' }
      ]
    }];

    const mixedTarifs = [
      { label: 'Mission comptable', axe: 'compta_mensuelle', type_recurrence: 'fixe', pu_ht: 205, quantite: 1, abonnement_ligne_id: 9001 },
      { label: 'Etablissement du bulletin de salaire', axe: 'social_bulletin', type_recurrence: 'variable', pu_ht: 21, quantite: 5, abonnement_ligne_id: 9002 }
    ];

    const supabase = createMockSupabase({
      client: clientHFC,
      abonnements: mixedAbonnements,
      tarifs: mixedTarifs
    });

    const plan = await analyserClient({ clientId: 45, supabase });

    expect(plan.abonnements[0].decision).toBe('a_modifier');
    expect(plan.abonnements[0].lignes_fixes.length).toBe(1);
    expect(plan.abonnements[0].lignes_variables.length).toBe(1);
  });
});

describe('calculerStatistiques', () => {
  it('agrège correctement les statistiques pour un plan unique', () => {
    const plans = [{
      client_id: 45,
      client_nom: 'HFC INVEST',
      cabinet: 'Audit Up',
      siren: '838444347',
      pennylane_customer_id: 'C1BKRUNGIS',
      abonnements: [
        { decision: 'inchange', lignes_fixes: [{}, {}, {}], lignes_variables: [] },
        { decision: 'inchange', lignes_fixes: [{}], lignes_variables: [] },
        { decision: 'inchange', lignes_fixes: [{}], lignes_variables: [] },
        { decision: 'a_supprimer', lignes_fixes: [], lignes_variables: [{}, {}, {}, {}, {}, {}] }
      ],
      total_ht_actuel: 2334.5,
      total_ht_fixe_2026: 2307.16,
      total_ht_variable_actuel: 82.5,
      nb_lignes_fixes: 5,
      nb_lignes_variables: 6
    }];

    const stats = calculerStatistiques(plans);

    expect(stats.totalClients).toBe(1);
    expect(stats.totalClientsAvecVariable).toBe(1);
    expect(stats.totalClientsFixeOnly).toBe(0);
    expect(stats.totalAbosASupprimer).toBe(1);
    expect(stats.totalAbosAModifier).toBe(0);
    expect(stats.totalAbosInchanges).toBe(3);
    expect(stats.totalLignesFixes).toBe(5);
    expect(stats.totalLignesVariables).toBe(6);
    expect(stats.totalHtVariableActuel).toBeCloseTo(82.5, 1);
  });

  it('agrège correctement les statistiques par cabinet', () => {
    const plans = [
      {
        client_id: 1, client_nom: 'A', cabinet: 'Audit Up', siren: '', pennylane_customer_id: '',
        abonnements: [{ decision: 'inchange' }],
        total_ht_actuel: 100, total_ht_fixe_2026: 102, total_ht_variable_actuel: 0,
        nb_lignes_fixes: 2, nb_lignes_variables: 0
      },
      {
        client_id: 2, client_nom: 'B', cabinet: 'Zerah Fiduciaire', siren: '', pennylane_customer_id: '',
        abonnements: [{ decision: 'a_supprimer' }],
        total_ht_actuel: 50, total_ht_fixe_2026: 0, total_ht_variable_actuel: 50,
        nb_lignes_fixes: 0, nb_lignes_variables: 3
      }
    ];

    const stats = calculerStatistiques(plans);

    expect(stats.totalClients).toBe(2);
    expect(stats.parCabinet['Audit Up'].nbClients).toBe(1);
    expect(stats.parCabinet['Audit Up'].nbAvecVariable).toBe(0);
    expect(stats.parCabinet['Zerah Fiduciaire'].nbClients).toBe(1);
    expect(stats.parCabinet['Zerah Fiduciaire'].nbAvecVariable).toBe(1);
    expect(stats.parCabinet['Zerah Fiduciaire'].lignesVariables).toBe(3);
  });

  it('retourne des statistiques vides pour un tableau vide', () => {
    const stats = calculerStatistiques([]);

    expect(stats.totalClients).toBe(0);
    expect(stats.totalClientsAvecVariable).toBe(0);
    expect(stats.totalLignesFixes).toBe(0);
    expect(stats.totalLignesVariables).toBe(0);
    expect(stats.totalHtActuel).toBe(0);
    expect(Object.keys(stats.parCabinet).length).toBe(0);
  });
});
