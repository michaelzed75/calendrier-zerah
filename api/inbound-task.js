/**
 * Webhook de réception des emails entrants (Brevo Inbound) → création de tâches.
 *
 * Flux : le demandeur écrit au collaborateur et met taches@inbox.zerah.fr en CC.
 * Brevo parse le mail et POST ce webhook. On transforme le mail en tâche(s) via
 * parseInboundEmail (logique pure, testée), puis on insère en base.
 *
 * Sécurité : token secret dans l'URL (?token=...). Garde-fou applicatif : seul un
 * expéditeur collaborateur connu peut créer une tâche (géré dans parseInboundEmail).
 * Idempotence : (email_message_id, collaborateur_id) — on filtre les doublons de renvoi.
 */

import { createClient } from '@supabase/supabase-js';
import { parseInboundEmail, extractThreadIds } from '../src/utils/taches/tachesInbound.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const INBOX = process.env.TASK_INBOX_ADDRESS || 'taches@inbox.zerah.fr';
const TOKEN = process.env.INBOUND_TASK_TOKEN;

/** Extrait une adresse email d'un champ Brevo ({Address,Name}) ou d'une chaîne. */
function adresse(x) {
  if (!x) return '';
  if (typeof x === 'string') return x;
  return x.Address || x.address || x.email || '';
}

/** Normalise une liste de destinataires Brevo en tableau d'emails. */
function adresses(list) {
  if (!list) return [];
  const arr = Array.isArray(list) ? list : [list];
  return arr.map(adresse).filter(Boolean);
}

export default async function handler(req, res) {
  if (TOKEN && req.query?.token !== TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : Array.isArray(body) ? body : [body];

    // Charge collaborateurs + clients une seule fois
    const [{ data: collaborateurs }, { data: clients }] = await Promise.all([
      supabase.from('collaborateurs').select('id, nom, email, actif'),
      supabase.from('clients').select('id, nom'),
    ]);

    const results = [];

    for (const item of items) {
      if (!item) continue;

      const email = {
        subject: item.Subject || item.subject || '',
        text: item.RawTextBody || item.ExtractedMarkdownMessage || item.text || '',
        from: adresse(item.From || item.from),
        to: adresses(item.To || item.to),
        cc: adresses(item.Cc || item.cc),
        messageId: item.MessageId || item.messageId || item.Uuid || null,
      };

      const parsed = parseInboundEmail(email, {
        collaborateurs: collaborateurs || [],
        clients: clients || [],
        inboxAddress: INBOX,
      });

      if (!parsed.ok) {
        results.push({ skip: parsed.code });
        continue;
      }

      // Anti-doublon de fil : si ce mail est une RÉPONSE à un message qui a déjà
      // créé une tâche (In-Reply-To/References), on n'en recrée pas une.
      // (Répondre à tous garde taches@ en copie → sans ça, chaque réponse dupliquerait.)
      const threadIds = extractThreadIds(item);
      if (threadIds.length > 0) {
        const { data: parents } = await supabase
          .from('taches')
          .select('id')
          .in('email_message_id', threadIds)
          .limit(1);
        if (parents && parents.length > 0) {
          results.push({ skip: 'reply_in_thread' });
          continue;
        }
      }

      // Idempotence : retire les destinataires déjà créés pour ce message_id
      let aInserer = parsed.taches;
      if (email.messageId) {
        const { data: existants } = await supabase
          .from('taches')
          .select('collaborateur_id')
          .eq('email_message_id', email.messageId);
        const dejaIds = new Set((existants || []).map(e => e.collaborateur_id));
        aInserer = aInserer.filter(t => !dejaIds.has(t.collaborateur_id));
      }

      if (aInserer.length === 0) {
        results.push({ skip: 'duplicate' });
        continue;
      }

      const payload = aInserer.map(t => ({ ...t, updated_at: new Date().toISOString() }));
      const { error } = await supabase.from('taches').insert(payload);
      results.push(error ? { error: error.message } : { created: aInserer.length });
    }

    // Toujours 200 pour éviter que Brevo ne renvoie en boucle
    return res.status(200).json({ ok: true, results });
  } catch (err) {
    console.error('Erreur inbound-task:', err);
    return res.status(500).json({ error: err.message });
  }
}
