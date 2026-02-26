import { describe, it, expect } from 'vitest';
import {
  AXE_DEFINITIONS, AXE_KEYS, classifierLigne,
  detectModeFacturationSocial, classifierToutesLesLignes,
  getMultiplicateurAccessoire
} from './classificationAxes.js';

// ============================================================
// Tests AXE_DEFINITIONS
// ============================================================

describe('AXE_DEFINITIONS', () => {
  it('contient 8 axes', () => {
    expect(AXE_KEYS).toHaveLength(8);
  });

  it('chaque axe configurable a un label, description, color et modes', () => {
    for (const key of AXE_KEYS) {
      const def = AXE_DEFINITIONS[key];
      expect(def.key).toBe(key);
      expect(def.label).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.color).toBeTruthy();
      expect(def.modes).toBeInstanceOf(Array);
      if (!def.suiviBulletin) {
        expect(def.modes.length).toBeGreaterThan(0);
        expect(def.defaultMode).toBeTruthy();
      }
    }
  });

  it('social_bulletin supporte les modes pourcentage et montant', () => {
    expect(AXE_DEFINITIONS.social_bulletin.modes).toEqual(['pourcentage', 'montant']);
  });

  it('accessoires_social suit le bulletin (suiviBulletin: true, pas de modes)', () => {
    expect(AXE_DEFINITIONS.accessoires_social.suiviBulletin).toBe(true);
    expect(AXE_DEFINITIONS.accessoires_social.modes).toEqual([]);
  });
});

// ============================================================
// Tests classifierLigne
// ============================================================

describe('classifierLigne', () => {
  const ligne = (label, famille = '', quantite = 1) => ({ label, famille, quantite });

  // Compta mensuelle
  it('classifie "Mission comptable" en compta_mensuelle', () => {
    expect(classifierLigne(ligne('Mission comptable', 'comptabilite'), 'forfait')).toBe('compta_mensuelle');
  });

  it('classifie "Mission de surveillance" en compta_mensuelle', () => {
    expect(classifierLigne(ligne('Mission de surveillance', 'comptabilite'), 'forfait')).toBe('compta_mensuelle');
  });

  // Bilan
  it('classifie "Etablissement du Bilan" en bilan', () => {
    expect(classifierLigne(ligne('Etablissement du Bilan', 'comptabilite'), 'forfait')).toBe('bilan');
  });

  // P&L
  it('classifie "Etablissement du P&L" en pl', () => {
    expect(classifierLigne(ligne('Etablissement du P&L', 'comptabilite'), 'forfait')).toBe('pl');
  });

  it('classifie "Etat de gestion" en pl', () => {
    expect(classifierLigne(ligne('Etat de gestion mensuel', 'comptabilite'), 'forfait')).toBe('pl');
  });

  // Bilan a priorité sur compta (le mot "comptab" n'est pas dans "Bilan")
  it('Bilan ne contient pas "comptab" donc pas de collision', () => {
    expect(classifierLigne(ligne('Etablissement du Bilan', 'comptabilite'), 'forfait')).toBe('bilan');
  });

  // Accessoires social — AVANT social
  it('classifie "Dépôt coffre-fort numérique" en accessoires_social', () => {
    expect(classifierLigne(ligne('Dépôt coffre-fort numérique', 'social'), 'forfait')).toBe('accessoires_social');
  });

  it('classifie "Bulletins envoyés par publi-postage" en accessoires_social', () => {
    expect(classifierLigne(ligne('Bulletins envoyés par publi-postage', 'social'), 'forfait')).toBe('accessoires_social');
  });

  it('classifie "Enregistrement d\'entrée de salariés" en accessoires_social', () => {
    expect(classifierLigne(ligne("Enregistrement d'entrée de salariés", 'social'), 'forfait')).toBe('accessoires_social');
  });

  it('classifie "Enregistrement de sortie de salariés" en accessoires_social', () => {
    expect(classifierLigne(ligne('Enregistrement de sortie de salariés', 'social'), 'forfait')).toBe('accessoires_social');
  });

  it('classifie "Enregistrement d\'entrée / sortie d\'un extra" en accessoires_social', () => {
    expect(classifierLigne(ligne("Enregistrement d'entrée / sortie d'un extra", 'social'), 'forfait')).toBe('accessoires_social');
  });

  it('classifie "Modification de bulletin de salaires" en accessoires_social', () => {
    expect(classifierLigne(ligne('Modification de bulletin de salaires sur votre demande', 'social'), 'forfait')).toBe('accessoires_social');
  });

  // Social forfait
  it('classifie "Mission du social" en social_forfait', () => {
    expect(classifierLigne(ligne('Mission du social', 'social'), 'forfait')).toBe('social_forfait');
  });

  // Social au bulletin — détection par label (contient "bulletin")
  it('classifie "Etablissement du bulletin de salaire" avec quantité > 1 en social_bulletin', () => {
    expect(classifierLigne(ligne('Etablissement du bulletin de salaire', 'social', 5), 'forfait')).toBe('social_bulletin');
  });

  it('classifie "Etablissement du bulletin de salaire" avec quantité = 1 en social_bulletin (label contient "bulletin")', () => {
    // Fix: avant, qty=1 + mode forfait → social_forfait (FAUX).
    // Maintenant, le label "bulletin" suffit → social_bulletin (CORRECT).
    expect(classifierLigne(ligne('Etablissement du bulletin de salaire', 'social', 1), 'forfait')).toBe('social_bulletin');
  });

  it('classifie bulletin avec mode reel même si quantité = 1', () => {
    // Le label "bulletin" suffit, indépendamment du mode client
    expect(classifierLigne(ligne('Etablissement du bulletin de salaire', 'social', 1), 'reel')).toBe('social_bulletin');
  });

  // Social au bulletin — détection par prix unitaire
  it('classifie une ligne social sans mot-clé avec prix < 30€ en social_bulletin', () => {
    const l = { label: 'Paie mensuelle', famille: 'social', quantite: 1, montant_ht: 15.40 };
    expect(classifierLigne(l, 'forfait')).toBe('social_bulletin');
  });

  // Social forfait — détection par label
  it('classifie "Forfait social" en social_forfait', () => {
    expect(classifierLigne(ligne('Forfait social', 'social', 1), 'forfait')).toBe('social_forfait');
  });

  // Juridique
  it('classifie "Etablissement du secrétariat juridique" en juridique', () => {
    expect(classifierLigne(ligne('Etablissement du secrétariat juridique', 'juridique'), 'forfait')).toBe('juridique');
  });

  // Support / Logiciels
  it('classifie "Mise à disposition de logiciel" en support', () => {
    expect(classifierLigne(ligne('Mise à disposition de logiciel', 'support'), 'forfait')).toBe('support');
  });

  // Non classifiable
  it('retourne null pour une ligne sans correspondance', () => {
    expect(classifierLigne(ligne('Quelque chose inconnu', ''), 'forfait')).toBeNull();
  });
});

// ============================================================
// Tests getMultiplicateurAccessoire
// ============================================================

describe('getMultiplicateurAccessoire', () => {
  it('modification de bulletin = ×1', () => {
    expect(getMultiplicateurAccessoire('Modification de bulletin de salaires sur votre demande')).toBe(1);
  });

  it('enregistrement d\'entrée = ×1', () => {
    expect(getMultiplicateurAccessoire("Enregistrement d'entrée de salariés")).toBe(1);
  });

  it('enregistrement de sortie = ×2', () => {
    expect(getMultiplicateurAccessoire('Enregistrement de sortie de salariés')).toBe(2);
  });

  it('entrée / sortie d\'un extra = ×1 (pas ×2)', () => {
    expect(getMultiplicateurAccessoire("Enregistrement d'entrée / sortie d'un extra")).toBe(1);
  });

  it('coffre-fort = ×1', () => {
    expect(getMultiplicateurAccessoire('Dépôt coffre-fort numérique')).toBe(1);
  });

  it('publi-postage = ×1', () => {
    expect(getMultiplicateurAccessoire('Bulletins envoyés par publi-postage')).toBe(1);
  });
});

// ============================================================
// Tests detectModeFacturationSocial
// ============================================================

describe('detectModeFacturationSocial', () => {
  it('détecte "reel" quand un bulletin a quantité > 1', () => {
    const lignes = [
      { label: 'Mission du social', famille: 'social', quantite: 1, montant_ht: 450 },
      { label: 'Etablissement du bulletin de salaire', famille: 'social', quantite: 5, montant_ht: 77 }
    ];
    expect(detectModeFacturationSocial(lignes)).toBe('reel');
  });

  it('détecte "reel" quand le prix unitaire social est < 30€ (facturation au bulletin)', () => {
    const lignes = [
      { label: 'Mission du social', famille: 'social', quantite: 1, montant_ht: 15.40 }
    ];
    expect(detectModeFacturationSocial(lignes)).toBe('reel');
  });

  it('détecte "forfait" quand le prix unitaire social est >= 30€', () => {
    const lignes = [
      { label: 'Mission du social', famille: 'social', quantite: 1, montant_ht: 450 }
    ];
    expect(detectModeFacturationSocial(lignes)).toBe('forfait');
  });

  it('détecte "reel" quand un label contient "bulletin" même avec quantité = 1', () => {
    // Fix: avant, qty=1 + prix ≥ 30€ → forfait (FAUX car le label dit "bulletin").
    // Maintenant, le label "bulletin" suffit → reel (CORRECT).
    const lignes = [
      { label: 'Mission du social', famille: 'social', quantite: 1, montant_ht: 450 },
      { label: 'Etablissement du bulletin de salaire', famille: 'social', quantite: 1, montant_ht: 450 }
    ];
    expect(detectModeFacturationSocial(lignes)).toBe('reel');
  });

  it('détecte "reel" même si le client a aussi des lignes forfait (client mixte)', () => {
    // Un client peut avoir "Mission du social" (forfait) ET "bulletin de salaire" (bulletin)
    // Le mode client est "reel" dès qu'il y a au moins une ligne bulletin
    // Mais IMPORTANT: la classification de chaque LIGNE est indépendante du mode client
    const lignes = [
      { label: 'Mission du social', famille: 'social', quantite: 1, montant_ht: 525 },
      { label: 'Etablissement du bulletin de salaire', famille: 'social', quantite: 10, montant_ht: 154 }
    ];
    expect(detectModeFacturationSocial(lignes)).toBe('reel');
  });

  it('exclut les accessoires de la détection du mode', () => {
    // Les accessoires (coffre-fort, publi-postage) ne comptent pas pour le mode
    const lignes = [
      { label: 'Dépôt coffre-fort numérique', famille: 'social', quantite: 1, montant_ht: 5 },
      { label: 'Mission du social', famille: 'social', quantite: 1, montant_ht: 450 }
    ];
    expect(detectModeFacturationSocial(lignes)).toBe('forfait');
  });

  it('détecte "forfait" quand pas de ligne social', () => {
    const lignes = [
      { label: 'Mission comptable', quantite: 1 }
    ];
    expect(detectModeFacturationSocial(lignes)).toBe('forfait');
  });

  it('détecte "forfait" pour lignes vides', () => {
    expect(detectModeFacturationSocial([])).toBe('forfait');
  });
});

// ============================================================
// Tests classifierToutesLesLignes
// ============================================================

describe('classifierToutesLesLignes', () => {
  const makeHonoraires = (lignes) => [{
    id: 1,
    pennylane_subscription_id: 100,
    client_id: 1,
    clients: { nom: 'Client Test', cabinet: 'Audit Up', mode_facturation_social: null },
    status: 'in_progress',
    frequence: 'monthly',
    intervalle: 1,
    abonnements_lignes: lignes
  }];

  const clients = [{ id: 1, nom: 'Client Test', mode_facturation_social: null }];

  it('classifie et retourne toutes les lignes enrichies', () => {
    const honoraires = makeHonoraires([
      { id: 10, label: 'Mission comptable', famille: 'comptabilite', quantite: 1, montant_ht: 500, montant_ttc: 600 },
      { id: 11, label: 'Etablissement du Bilan', famille: 'comptabilite', quantite: 1, montant_ht: 1200, montant_ttc: 1440 }
    ]);

    const { lignes } = classifierToutesLesLignes(honoraires, clients);

    expect(lignes).toHaveLength(2);
    expect(lignes[0].axe).toBe('compta_mensuelle');
    expect(lignes[1].axe).toBe('bilan');
    expect(lignes[0].client_nom).toBe('Client Test');
  });

  it('détecte automatiquement le mode de facturation', () => {
    const honoraires = makeHonoraires([
      { id: 10, label: 'Etablissement du bulletin de salaire', famille: 'social', quantite: 12, montant_ht: 360, montant_ttc: 432 }
    ]);

    const { lignes, modesDetectes } = classifierToutesLesLignes(honoraires, clients);

    expect(modesDetectes.get(1)).toBe('reel');
    expect(lignes[0].axe).toBe('social_bulletin');
  });

  it('ne redétecte pas si le client a déjà un mode', () => {
    const clientsAvecMode = [{ id: 1, nom: 'Client Test', mode_facturation_social: 'forfait' }];
    const honoraires = makeHonoraires([
      { id: 10, label: 'Mission du social', famille: 'social', quantite: 1, montant_ht: 200, montant_ttc: 240 }
    ]);

    const { modesDetectes } = classifierToutesLesLignes(honoraires, clientsAvecMode);

    expect(modesDetectes.size).toBe(0);
  });

  it('garde toutes les lignes de tous les abonnements sans dédoublonnage', () => {
    // Simule ACF : 2 abonnements, l'un "in_progress", l'autre "stopped"
    // Toutes les lignes doivent être gardées (le diagnostic prévient des doublons)
    const honoraires = [
      {
        id: 1, pennylane_subscription_id: 100, client_id: 1,
        clients: { nom: 'ACF', cabinet: 'Zerah' },
        status: 'in_progress', frequence: 'monthly', intervalle: 1,
        abonnements_lignes: [
          { id: 10, label: 'Mission comptable', famille: 'comptabilite', quantite: 1, montant_ht: 1180, montant_ttc: 1416 },
          { id: 11, label: 'Etablissement du Bilan', famille: 'comptabilite', quantite: 1, montant_ht: 830, montant_ttc: 996 }
        ]
      },
      {
        id: 2, pennylane_subscription_id: 101, client_id: 1,
        clients: { nom: 'ACF', cabinet: 'Zerah' },
        status: 'stopped', frequence: 'quarterly', intervalle: 3,
        abonnements_lignes: [
          { id: 20, label: 'Honoraires trimestriels mission comptable : {{mois}} 2024', famille: 'comptabilite', quantite: 1, montant_ht: 1500, montant_ttc: 1800 },
          { id: 21, label: 'Quote-part Bilan', famille: 'comptabilite', quantite: 1, montant_ht: 810, montant_ttc: 972 }
        ]
      }
    ];

    const { lignes } = classifierToutesLesLignes(honoraires, clients);

    // Toutes les lignes sont gardées (pas de dédoublonnage)
    const comptaLines = lignes.filter(l => l.axe === 'compta_mensuelle');
    const bilanLines = lignes.filter(l => l.axe === 'bilan');

    expect(comptaLines).toHaveLength(2); // les 2 lignes compta des 2 abos
    expect(bilanLines).toHaveLength(2);  // les 2 lignes bilan des 2 abos
    expect(lignes).toHaveLength(4);      // total = toutes les lignes
  });

  it('garde les lignes multi-activité dans le même abonnement (cas BALLU)', () => {
    // Un seul abonnement avec 2 "Mission comptable" (Hôtel + Restaurant)
    const honoraires = [
      {
        id: 1, pennylane_subscription_id: 100, client_id: 1,
        clients: { nom: 'BALLU HOTELIERE', cabinet: 'Audit Up' },
        status: 'in_progress', frequence: 'monthly', intervalle: 1,
        abonnements_lignes: [
          { id: 10, label: 'Mission comptable', famille: 'comptabilite', quantite: 1, montant_ht: 1200, montant_ttc: 1440 },
          { id: 11, label: 'Mission du social', famille: 'social', quantite: 1, montant_ht: 335, montant_ttc: 402 },
          { id: 12, label: 'Mission comptable', famille: 'comptabilite', quantite: 1, montant_ht: 465, montant_ttc: 558 },
          { id: 13, label: 'Mission du social', famille: 'social', quantite: 1, montant_ht: 600, montant_ttc: 720 }
        ]
      }
    ];

    const { lignes } = classifierToutesLesLignes(honoraires, clients);

    // Les 4 lignes doivent toutes être gardées
    expect(lignes).toHaveLength(4);
    const comptaLines = lignes.filter(l => l.axe === 'compta_mensuelle');
    const socialLines = lignes.filter(l => l.axe === 'social_forfait');
    expect(comptaLines).toHaveLength(2); // Hôtel 1200€ + Restaurant 465€
    expect(socialLines).toHaveLength(2); // Hôtel 335€ + Restaurant 600€
  });

  it('classifie correctement un client mixte forfait + bulletin (FIX du bug CA HT)', () => {
    // Cas réel : un client a "Mission du social" (forfait 525€) ET "bulletin de salaire" (15€ × 10)
    // AVANT le fix : detectModeFacturationSocial → 'reel', puis TOUTES les lignes → social_bulletin
    // → La ligne 525€ était multipliée par quantité Silae → CA HT gonflé
    // APRÈS le fix : chaque ligne est classée sur son PROPRE label
    const honoraires = [{
      id: 1, pennylane_subscription_id: 100, client_id: 1,
      clients: { nom: 'Client Mixte', cabinet: 'Zerah', mode_facturation_social: null },
      status: 'in_progress', frequence: 'monthly', intervalle: 3,
      abonnements_lignes: [
        { id: 10, label: 'Mission du social', famille: 'social', quantite: 1, montant_ht: 525, montant_ttc: 630 },
        { id: 11, label: 'Etablissement du bulletin de salaire', famille: 'social', quantite: 10, montant_ht: 154, montant_ttc: 184.80 }
      ]
    }];

    const { lignes } = classifierToutesLesLignes(honoraires, clients);

    expect(lignes).toHaveLength(2);
    // "Mission du social" → social_forfait (PAS social_bulletin !)
    const forfaitLine = lignes.find(l => l.label === 'Mission du social');
    expect(forfaitLine.axe).toBe('social_forfait');
    // "Etablissement du bulletin" → social_bulletin
    const bulletinLine = lignes.find(l => l.label === 'Etablissement du bulletin de salaire');
    expect(bulletinLine.axe).toBe('social_bulletin');
  });

  it('garde plusieurs lignes pour les axes non-uniques (accessoires_social)', () => {
    const honoraires = makeHonoraires([
      { id: 10, label: 'Dépôt coffre-fort numérique', famille: 'social', quantite: 1, montant_ht: 5, montant_ttc: 6 },
      { id: 11, label: 'Bulletins envoyés par publi-postage', famille: 'social', quantite: 1, montant_ht: 3, montant_ttc: 3.6 }
    ]);

    const { lignes } = classifierToutesLesLignes(honoraires, clients);

    const accessoiresLines = lignes.filter(l => l.axe === 'accessoires_social');
    expect(accessoiresLines).toHaveLength(2);
  });
});
