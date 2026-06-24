/**
 * Fonction serverless de notification liée aux tâches (via Brevo).
 *
 * Types gérés :
 * - 'tache_supprimee' : une tâche non terminée a été supprimée → on prévient son auteur.
 * - 'tache_faite'     : le destinataire a terminé la tâche → on prévient le demandeur.
 * - 'date_modifiee'   : le destinataire a changé l'échéance → on prévient le demandeur.
 */

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = 'michael@zerah.fr';
const SENDER_NAME = 'Calendrier Audit UP';
const APP_URL = 'https://calendrier-zerah.vercel.app';

/**
 * Envoie un email via l'API Brevo.
 */
async function sendEmail(to, toName, subject, htmlContent) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: to, name: toName }],
      subject,
      htmlContent,
    }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Brevo API error: ${error}`);
  }
  return response.json();
}

/** Formate une date ISO (YYYY-MM-DD) en JJ/MM/AAAA. */
function formaterDateFr(iso) {
  if (!iso || typeof iso !== 'string') return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

/**
 * Gabarit HTML simple et sobre (thème clair, comme les rappels existants).
 */
function gabarit(titreEmail, corpsHtml) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,sans-serif;background:#f3f4f6;">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" style="width:100%;max-width:560px;border-collapse:collapse;">
        <tr><td style="background:#5b21b6;border-radius:14px 14px 0 0;padding:28px 28px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600;">${titreEmail}</h1>
        </td></tr>
        <tr><td style="background:#fff;padding:28px;color:#374151;font-size:15px;line-height:1.6;">
          ${corpsHtml}
          <div style="margin-top:24px;">
            <a href="${APP_URL}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;">Ouvrir le calendrier</a>
          </div>
        </td></tr>
        <tr><td style="background:#1e293b;border-radius:0 0 14px 14px;padding:18px;text-align:center;">
          <p style="margin:0;color:#e2e8f0;font-size:14px;font-weight:600;">AUDIT UP</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!BREVO_API_KEY) return res.status(500).json({ error: 'BREVO_API_KEY not configured' });

  try {
    const { type, destinataireEmail, destinataireNom, titre, client, parQui, nouvelleDate } = req.body || {};

    if (!destinataireEmail || !titre) {
      return res.status(400).json({ error: 'destinataireEmail et titre requis' });
    }

    const clientLigne = client ? ` (client ${client})` : '';
    const prenom = destinataireNom ? destinataireNom.split(' ')[0] : '';

    if (type === 'tache_faite') {
      const corps = `
        <p>Bonjour ${prenom},</p>
        <p><strong>${parQui || 'Le collaborateur'}</strong> a terminé une tâche que vous aviez confiée&nbsp;:</p>
        <p style="background:#f0fdf4;border-left:3px solid #16a34a;padding:10px 14px;margin:16px 0;">
          <strong>${titre}</strong>${clientLigne}
        </p>
      `;
      await sendEmail(destinataireEmail, destinataireNom || '', `Tâche terminée : ${titre}`, gabarit('Tâche terminée', corps));
      return res.status(200).json({ success: true });
    }

    if (type === 'date_modifiee') {
      const dateFr = formaterDateFr(nouvelleDate);
      const corps = `
        <p>Bonjour ${prenom},</p>
        <p><strong>${parQui || 'Le collaborateur'}</strong> a modifié l'échéance d'une tâche que vous aviez confiée&nbsp;:</p>
        <p style="background:#f9fafb;border-left:3px solid #7c3aed;padding:10px 14px;margin:16px 0;">
          <strong>${titre}</strong>${clientLigne}<br>
          Nouvelle échéance&nbsp;: <strong>${dateFr || 'aucune'}</strong>
        </p>
      `;
      await sendEmail(destinataireEmail, destinataireNom || '', `Échéance modifiée : ${titre}`, gabarit('Échéance modifiée', corps));
      return res.status(200).json({ success: true });
    }

    if (type === 'tache_supprimee') {
      const corps = `
        <p>Bonjour ${prenom},</p>
        <p><strong>${parQui || 'Un collaborateur'}</strong> a supprimé une tâche que vous aviez créée&nbsp;:</p>
        <p style="background:#f9fafb;border-left:3px solid #7c3aed;padding:10px 14px;margin:16px 0;">
          <strong>${titre}</strong>${clientLigne}
        </p>
        <p>Cette tâche n'était pas encore marquée comme faite.</p>
      `;
      await sendEmail(
        destinataireEmail,
        destinataireNom || '',
        `Tâche supprimée : ${titre}`,
        gabarit('Tâche supprimée', corps)
      );
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: `Type inconnu: ${type}` });
  } catch (err) {
    console.error('Erreur notify-task:', err);
    return res.status(500).json({ error: err.message });
  }
}
