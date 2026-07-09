// @ts-check

/**
 * @file Parsing des emails entrants pour création de tâches.
 *
 * Flux : le demandeur écrit au collaborateur et met en CC une adresse dédiée
 * (ex. taches@inbox.zerah.fr). Brevo Inbound POST le mail sur api/inbound-task.js,
 * qui appelle parseInboundEmail() pour transformer le mail en tâche(s).
 *
 * Règles métier :
 * - L'objet du mail = titre de la tâche. Le corps = détail.
 * - Une date JJ/MM/AA (ou JJ/MM/AAAA) dans l'objet = date d'échéance (retirée du titre).
 * - [URGENT] ou ! dans l'objet = priorité urgente (retiré du titre).
 * - Destinataire(s) = adresses To+Cc (hors adresse dédiée) matchées sur collaborateurs.email.
 * - Garde-fou : l'expéditeur (From) DOIT être un collaborateur connu, sinon la tâche est rejetée.
 * - Assignation ouverte : n'importe quel collaborateur peut assigner à n'importe quel autre.
 */

/**
 * @typedef {import('../../types.js').Collaborateur} Collaborateur
 * @typedef {import('../../types.js').Client} Client
 */

/**
 * Extrait l'adresse email d'une chaîne au format "Nom <email>" ou "email".
 * @param {string} raw
 * @returns {string} email en minuscules, ou '' si non trouvé
 */
export function normalizeEmail(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const match = raw.match(/<([^>]+)>/);
  const email = (match ? match[1] : raw).trim().toLowerCase();
  // Validation basique : doit contenir un @ et un point après
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : '';
}

/**
 * Découpe une liste de destinataires (string "a@x, b@y" ou tableau) en emails normalisés.
 * @param {string|string[]|undefined|null} field
 * @returns {string[]}
 */
export function parseRecipients(field) {
  if (!field) return [];
  const parts = Array.isArray(field) ? field : String(field).split(',');
  return parts.map(normalizeEmail).filter(Boolean);
}

/**
 * Parse l'objet du mail : extrait l'échéance (JJ/MM/AA), la priorité ([URGENT] / !),
 * et renvoie le titre nettoyé.
 * @param {string} subject
 * @returns {{ titre: string, dateEcheance: string|null, priorite: 'normale'|'urgente' }}
 */
export function parseSubject(subject) {
  let titre = (subject || '').trim();
  let priorite = /** @type {'normale'|'urgente'} */ ('normale');

  // Priorité : [URGENT] (insensible à la casse) ou ! isolé / en fin
  if (/\[urgent\]/i.test(titre)) {
    priorite = 'urgente';
    titre = titre.replace(/\[urgent\]/gi, ' ');
  }
  if (/(^|\s)!+(\s|$)/.test(titre)) {
    priorite = 'urgente';
    titre = titre.replace(/(^|\s)!+(\s|$)/g, ' ');
  }

  // Échéance : JJ/MM/AA ou JJ/MM/AAAA (séparateurs / . ou -)
  let dateEcheance = null;
  const dateMatch = titre.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/);
  if (dateMatch) {
    const iso = toIsoDate(dateMatch[1], dateMatch[2], dateMatch[3]);
    if (iso) {
      dateEcheance = iso;
      titre = titre.replace(dateMatch[0], ' ');
    }
  }

  // Nettoyage des espaces résiduels
  titre = titre.replace(/\s{2,}/g, ' ').trim();

  return { titre, dateEcheance, priorite };
}

/**
 * Convertit jour/mois/année (année sur 2 ou 4 chiffres) en date ISO YYYY-MM-DD.
 * Renvoie null si la date est invalide.
 * @param {string} d
 * @param {string} m
 * @param {string} y
 * @returns {string|null}
 */
export function toIsoDate(d, m, y) {
  const day = parseInt(d, 10);
  const month = parseInt(m, 10);
  let year = parseInt(y, 10);
  if (y.length === 2) year += 2000;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  // Vérifie la cohérence (ex. 31/02 -> invalide)
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCDate() !== day || dt.getUTCMonth() !== month - 1) return null;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Extrait les identifiants de message (<...@...>) d'une chaîne d'en-tête.
 * @param {string|null|undefined} str
 * @returns {string[]}
 */
export function extractMessageIds(str) {
  if (!str) return [];
  return String(str).match(/<[^<>\s]+>/g) || [];
}

/**
 * Extrait les identifiants du fil de discussion d'un item Brevo (In-Reply-To + References).
 * Sert à détecter qu'un mail est une RÉPONSE à un message qui a déjà créé une tâche
 * (Répondre à tous garde l'adresse dédiée en copie → sans ce filtre, chaque réponse
 * recréerait une tâche).
 * @param {Object} item - Item du payload Brevo Inbound
 * @returns {string[]} message-ids du fil (parent immédiat + ancêtres)
 */
export function extractThreadIds(item) {
  if (!item) return [];
  const headers = item.Headers || item.headers || {};
  const header = (name) => {
    const k = Object.keys(headers).find(h => h.toLowerCase() === name);
    return k ? headers[k] : null;
  };
  const raw = [
    item.InReplyTo, item.inReplyTo,
    header('in-reply-to'), header('references'),
  ].filter(Boolean).join(' ');
  return [...new Set(extractMessageIds(raw))];
}

/**
 * Trouve le collaborateur (actif) correspondant à un email.
 * @param {string} email
 * @param {Collaborateur[]} collaborateurs
 * @returns {Collaborateur|null}
 */
export function matchCollaborateurByEmail(email, collaborateurs) {
  if (!email) return null;
  const target = email.toLowerCase();
  return collaborateurs.find(
    c => c.actif && c.email && c.email.trim().toLowerCase() === target
  ) || null;
}

/**
 * Détecte un client connu mentionné dans le texte (objet + corps).
 * Best-effort : cherche le nom de client le plus long contenu dans le texte,
 * en exigeant une longueur minimale pour éviter les faux positifs.
 * @param {string} text
 * @param {Client[]} clients
 * @returns {Client|null}
 */
export function detectClient(text, clients) {
  if (!text || !clients || clients.length === 0) return null;
  const haystack = ` ${normalizeText(text)} `;
  let best = null;
  let bestLen = 0;
  for (const client of clients) {
    if (!client.nom) continue;
    const nom = normalizeText(client.nom);
    if (nom.length < 4) continue; // évite les noms trop courts (faux positifs)
    if (haystack.includes(` ${nom} `) || haystack.includes(` ${nom}`)) {
      if (nom.length > bestLen) {
        best = client;
        bestLen = nom.length;
      }
    }
  }
  return best;
}

/**
 * Normalise un texte pour comparaison : minuscules, sans accents, espaces compactés.
 * @param {string} str
 * @returns {string}
 */
export function normalizeText(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Transforme un email entrant en une ou plusieurs tâches (1 par destinataire collaborateur).
 *
 * @param {Object} email - Payload normalisé du mail
 * @param {string} email.subject
 * @param {string} [email.text] - Corps texte
 * @param {string} email.from
 * @param {string|string[]} [email.to]
 * @param {string|string[]} [email.cc]
 * @param {string} [email.messageId]
 * @param {Object} context
 * @param {Collaborateur[]} context.collaborateurs
 * @param {Client[]} [context.clients]
 * @param {string} context.inboxAddress - Adresse dédiée à exclure des destinataires
 * @returns {{ ok: true, taches: Object[] } | { ok: false, error: string, code: string }}
 */
export function parseInboundEmail(email, context) {
  const { collaborateurs, clients = [], inboxAddress } = context;

  // 1. Garde-fou : l'expéditeur doit être un collaborateur connu
  const fromEmail = normalizeEmail(email.from);
  const createur = matchCollaborateurByEmail(fromEmail, collaborateurs);
  if (!createur) {
    return {
      ok: false,
      code: 'unknown_sender',
      error: `Expéditeur inconnu (${fromEmail || email.from}) — création de tâche refusée`,
    };
  }

  // 2. Destinataires : le champ À (To) désigne QUI doit faire la tâche.
  //    Le Cc est "pour info" (il contient l'adresse dédiée + éventuels collègues en copie)
  //    → repli sur le Cc UNIQUEMENT si aucun collaborateur dans le To
  //    (cas : réponse à un client externe avec le collègue en copie).
  const inbox = normalizeEmail(inboxAddress) || (inboxAddress || '').toLowerCase().trim();
  const matchList = (field) => {
    const emails = [...new Set(parseRecipients(field).filter(e => e !== inbox))];
    const found = emails
      .map(e => matchCollaborateurByEmail(e, collaborateurs))
      .filter(/** @returns {c is Collaborateur} */ (c) => Boolean(c));
    // Dédoublonnage par id (au cas où plusieurs alias mènent au même collab)
    return [...new Map(found.map(c => [c.id, c])).values()];
  };

  let uniqueAssignees = matchList(email.to);
  if (uniqueAssignees.length === 0) {
    uniqueAssignees = matchList(email.cc);
  }

  if (uniqueAssignees.length === 0) {
    return {
      ok: false,
      code: 'no_assignee',
      error: 'Aucun destinataire collaborateur identifié (To, puis Cc en repli)',
    };
  }

  // 3. Parsing de l'objet (titre, échéance, priorité)
  const { titre, dateEcheance, priorite } = parseSubject(email.subject);
  if (!titre) {
    return { ok: false, code: 'empty_subject', error: 'Objet du mail vide — pas de titre de tâche' };
  }

  // 4. Détection client (objet + corps)
  const client = detectClient(`${email.subject} ${email.text || ''}`, clients);

  // 5. Construction des tâches
  const taches = uniqueAssignees.map(collab => ({
    collaborateur_id: collab.id,
    client_id: client ? client.id : null,
    titre,
    detail: (email.text || '').trim() || null,
    statut: 'a_faire',
    priorite,
    date_echeance: dateEcheance,
    date_realisation: null,
    source: 'email',
    email_message_id: email.messageId || null,
    email_from: fromEmail,
    created_by: createur.id,
  }));

  return { ok: true, taches };
}
