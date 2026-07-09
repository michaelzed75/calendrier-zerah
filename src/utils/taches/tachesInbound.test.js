// @ts-check
import { describe, it, expect } from 'vitest';
import {
  normalizeEmail,
  parseRecipients,
  parseSubject,
  toIsoDate,
  matchCollaborateurByEmail,
  detectClient,
  parseInboundEmail,
} from './tachesInbound.js';

const COLLABS = [
  { id: 1, nom: 'Michael Zerah', email: 'michael@zerah.fr', actif: true, is_admin: true, est_chef_mission: true },
  { id: 2, nom: 'Jean Dupont', email: 'jean@zerah.fr', actif: true },
  { id: 3, nom: 'Lucie Martin', email: 'lucie@zerah.fr', actif: true, est_chef_mission: true },
  { id: 4, nom: 'Paul Ancien', email: 'paul@zerah.fr', actif: false },
];

const CLIENTS = [
  { id: 10, nom: 'DUPONT SARL' },
  { id: 11, nom: 'CAFÉ DE PARIS' },
  { id: 12, nom: 'HÔTEL ÉTOILE' },
];

const INBOX = 'taches@inbox.zerah.fr';

describe('normalizeEmail', () => {
  it('extrait l\'email du format "Nom <email>"', () => {
    expect(normalizeEmail('Jean Dupont <Jean@Zerah.fr>')).toBe('jean@zerah.fr');
  });
  it('normalise un email brut', () => {
    expect(normalizeEmail('  LUCIE@zerah.fr ')).toBe('lucie@zerah.fr');
  });
  it('renvoie "" pour une chaîne invalide', () => {
    expect(normalizeEmail('pas un email')).toBe('');
    expect(normalizeEmail('')).toBe('');
    expect(normalizeEmail(null)).toBe('');
  });
});

describe('parseRecipients', () => {
  it('découpe une liste séparée par des virgules', () => {
    expect(parseRecipients('a@x.fr, B@x.fr')).toEqual(['a@x.fr', 'b@x.fr']);
  });
  it('accepte un tableau', () => {
    expect(parseRecipients(['Jean <jean@zerah.fr>', 'taches@inbox.zerah.fr'])).toEqual([
      'jean@zerah.fr',
      'taches@inbox.zerah.fr',
    ]);
  });
  it('filtre les entrées invalides', () => {
    expect(parseRecipients('jean@zerah.fr, , bidon')).toEqual(['jean@zerah.fr']);
  });
  it('renvoie [] pour vide', () => {
    expect(parseRecipients(null)).toEqual([]);
  });
});

describe('toIsoDate', () => {
  it('convertit une année sur 2 chiffres', () => {
    expect(toIsoDate('15', '01', '27')).toBe('2027-01-15');
  });
  it('convertit une année sur 4 chiffres', () => {
    expect(toIsoDate('5', '3', '2026')).toBe('2026-03-05');
  });
  it('rejette une date incohérente (31/02)', () => {
    expect(toIsoDate('31', '02', '27')).toBeNull();
  });
  it('rejette un mois invalide', () => {
    expect(toIsoDate('15', '13', '27')).toBeNull();
  });
});

describe('parseSubject', () => {
  it('extrait une échéance JJ/MM/AA et nettoie le titre', () => {
    const r = parseSubject('Faire la TVA de juin 15/01/27');
    expect(r.titre).toBe('Faire la TVA de juin');
    expect(r.dateEcheance).toBe('2027-01-15');
    expect(r.priorite).toBe('normale');
  });
  it('détecte la priorité [URGENT]', () => {
    const r = parseSubject('[URGENT] Relancer le client');
    expect(r.priorite).toBe('urgente');
    expect(r.titre).toBe('Relancer le client');
  });
  it('détecte la priorité via !', () => {
    const r = parseSubject('Bilan à boucler !');
    expect(r.priorite).toBe('urgente');
    expect(r.titre).toBe('Bilan à boucler');
  });
  it('gère échéance + urgence ensemble', () => {
    const r = parseSubject('[URGENT] Déclaration DAS2 12/02/27');
    expect(r.priorite).toBe('urgente');
    expect(r.dateEcheance).toBe('2027-02-12');
    expect(r.titre).toBe('Déclaration DAS2');
  });
  it('sans date ni urgence', () => {
    const r = parseSubject('Préparer le bilan');
    expect(r).toEqual({ titre: 'Préparer le bilan', dateEcheance: null, priorite: 'normale' });
  });
  it('accepte les séparateurs . et -', () => {
    expect(parseSubject('TVA 15.01.27').dateEcheance).toBe('2027-01-15');
    expect(parseSubject('TVA 15-01-2027').dateEcheance).toBe('2027-01-15');
  });
});

describe('matchCollaborateurByEmail', () => {
  it('matche un collaborateur actif', () => {
    expect(matchCollaborateurByEmail('jean@zerah.fr', COLLABS)?.id).toBe(2);
  });
  it('est insensible à la casse', () => {
    expect(matchCollaborateurByEmail('JEAN@ZERAH.FR', COLLABS)?.id).toBe(2);
  });
  it('ignore les collaborateurs inactifs', () => {
    expect(matchCollaborateurByEmail('paul@zerah.fr', COLLABS)).toBeNull();
  });
  it('renvoie null si non trouvé', () => {
    expect(matchCollaborateurByEmail('inconnu@x.fr', COLLABS)).toBeNull();
  });
});

describe('detectClient', () => {
  it('détecte un client nommé dans le texte', () => {
    expect(detectClient('Faire la TVA de DUPONT SARL svp', CLIENTS)?.id).toBe(10);
  });
  it('est insensible aux accents et à la casse', () => {
    expect(detectClient('relance cafe de paris', CLIENTS)?.id).toBe(11);
  });
  it('renvoie null si aucun client mentionné', () => {
    expect(detectClient('Faire un truc générique', CLIENTS)).toBeNull();
  });
  it('choisit le nom le plus long en cas de chevauchement', () => {
    const clients = [{ id: 1, nom: 'PARIS' }, { id: 2, nom: 'CAFÉ DE PARIS' }];
    expect(detectClient('relance cafe de paris', clients)?.id).toBe(2);
  });
});

describe('parseInboundEmail', () => {
  const ctx = { collaborateurs: COLLABS, clients: CLIENTS, inboxAddress: INBOX };

  it('crée une tâche depuis un mail valide (CC adresse dédiée)', () => {
    const res = parseInboundEmail(
      {
        subject: 'Faire la TVA de juin 15/01/27',
        text: 'Merci de boucler la TVA de DUPONT SARL.',
        from: 'Michael <michael@zerah.fr>',
        to: 'jean@zerah.fr',
        cc: 'taches@inbox.zerah.fr',
        messageId: '<abc@mail>',
      },
      ctx
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.taches).toHaveLength(1);
    const t = res.taches[0];
    expect(t.collaborateur_id).toBe(2);
    expect(t.created_by).toBe(1);
    expect(t.titre).toBe('Faire la TVA de juin');
    expect(t.date_echeance).toBe('2027-01-15');
    expect(t.client_id).toBe(10);
    expect(t.source).toBe('email');
    expect(t.email_message_id).toBe('<abc@mail>');
    expect(t.email_from).toBe('michael@zerah.fr');
    expect(t.statut).toBe('a_faire');
  });

  it('refuse un expéditeur inconnu (garde-fou)', () => {
    const res = parseInboundEmail(
      { subject: 'Tâche', from: 'client@externe.com', to: 'jean@zerah.fr', cc: INBOX },
      ctx
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('unknown_sender');
  });

  it('refuse si aucun destinataire collaborateur', () => {
    const res = parseInboundEmail(
      { subject: 'Tâche', from: 'michael@zerah.fr', to: INBOX, cc: '' },
      ctx
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('no_assignee');
  });

  it('crée une tâche par destinataire (peer-to-peer multiple)', () => {
    const res = parseInboundEmail(
      {
        subject: 'Réunion à préparer',
        from: 'lucie@zerah.fr',
        to: 'jean@zerah.fr, michael@zerah.fr',
        cc: INBOX,
      },
      ctx
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.taches.map(t => t.collaborateur_id).sort()).toEqual([1, 2]);
    expect(res.taches.every(t => t.created_by === 3)).toBe(true);
  });

  it('exclut l\'adresse dédiée et l\'expéditeur inactif des destinataires', () => {
    const res = parseInboundEmail(
      { subject: 'X', from: 'michael@zerah.fr', to: 'paul@zerah.fr', cc: INBOX },
      ctx
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('no_assignee');
  });

  it('refuse un objet vide', () => {
    const res = parseInboundEmail(
      { subject: '   ', from: 'michael@zerah.fr', to: 'jean@zerah.fr', cc: INBOX },
      ctx
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('empty_subject');
  });

  it('n\'assigne PAS aux collaborateurs en simple copie (Cc) quand le To contient un collaborateur', () => {
    // Cas réel : mail À Dany, Cc Thérèse + adresse dédiée → tâche pour Dany UNIQUEMENT
    const res = parseInboundEmail(
      {
        subject: 'Faire le bilan',
        from: 'michael@zerah.fr',
        to: 'jean@zerah.fr',
        cc: `lucie@zerah.fr, ${INBOX}`,
      },
      ctx
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.taches).toHaveLength(1);
    expect(res.taches[0].collaborateur_id).toBe(2); // Jean (To), pas Lucie (Cc)
  });

  it('repli sur le Cc si le To ne contient aucun collaborateur (réponse à un client externe)', () => {
    const res = parseInboundEmail(
      {
        subject: 'RE: question du client',
        from: 'michael@zerah.fr',
        to: 'client@externe.com',
        cc: `jean@zerah.fr, ${INBOX}`,
      },
      ctx
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.taches).toHaveLength(1);
    expect(res.taches[0].collaborateur_id).toBe(2); // Jean via le Cc (repli)
  });

  it('dédoublonne un destinataire présent dans To et Cc', () => {
    const res = parseInboundEmail(
      { subject: 'Tâche', from: 'michael@zerah.fr', to: 'jean@zerah.fr', cc: `jean@zerah.fr, ${INBOX}` },
      ctx
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.taches).toHaveLength(1);
  });
});
