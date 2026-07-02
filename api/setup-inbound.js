/**
 * Enregistre (une seule fois) le webhook Brevo Inbound Parsing qui envoie les
 * emails reçus sur *@inbox.zerah.fr vers /api/inbound-task.
 *
 * Sécurisé par le jeton INBOUND_TASK_TOKEN (à passer en ?token=...).
 * Idempotent : si un webhook inbound pointe déjà vers notre URL, on ne recrée pas.
 * À utiliser une fois, puis on peut supprimer ce fichier.
 */

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const TOKEN = process.env.INBOUND_TASK_TOKEN;
const DOMAIN = process.env.TASK_INBOX_DOMAIN || 'inbox.zerah.fr';
const APP_URL = 'https://calendrier-zerah.vercel.app';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!BREVO_API_KEY) return res.status(500).json({ error: 'BREVO_API_KEY manquant' });
  if (!TOKEN) return res.status(500).json({ error: 'INBOUND_TASK_TOKEN manquant dans Vercel' });
  if (req.query?.token !== TOKEN) return res.status(401).json({ error: 'token invalide' });

  const webhookUrl = `${APP_URL}/api/inbound-task?token=${TOKEN}`;

  try {
    // 1. Vérifie s'il existe déjà un webhook inbound vers notre URL
    const listRes = await fetch('https://api.brevo.com/v3/webhooks?type=inbound', {
      headers: { 'api-key': BREVO_API_KEY, accept: 'application/json' },
    });
    const list = await listRes.json();
    const existant = Array.isArray(list?.webhooks)
      ? list.webhooks.find(w => w.url === webhookUrl)
      : null;
    if (existant) {
      return res.status(200).json({ ok: true, deja: true, webhook: existant });
    }

    // 2. Crée le webhook inbound
    const createRes = await fetch('https://api.brevo.com/v3/webhooks', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'inbound',
        events: ['inboundEmailProcessed'],
        url: webhookUrl,
        domain: DOMAIN,
        description: 'Réception des tâches par email (calendrier)',
      }),
    });
    const body = await createRes.text();
    return res.status(200).json({
      ok: createRes.ok,
      statutHttp: createRes.status,
      domain: DOMAIN,
      webhookUrl,
      reponseBrevo: body.slice(0, 600),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
