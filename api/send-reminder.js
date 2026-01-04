import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://anrvvsfvejnmdouxjfxj.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFucnZ2c2Z2ZWpubWRvdXhqZnhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjgzMjk1OSwiZXhwIjoyMDgyNDA4OTU5fQ.A9Syj-QA7sHEP2x4p-_AeITz0Ma0ZHCCYR93m0LBHg0'
);

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const APP_URL = 'https://calendrier-zerah.vercel.app';
const SENDER_EMAIL = 'michael@zerah.fr';
const SENDER_NAME = 'Calendrier Audit UP';

// Logo Audit UP en base64 ou URL publique
const LOGO_URL = 'https://calendrier-zerah.vercel.app/audit-up-logo.png';

function getWeekDates() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const formatDate = (date) => {
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  };

  return {
    start: formatDate(monday),
    end: formatDate(friday),
    year: monday.getFullYear()
  };
}

function generateEmailHTML(chefName, teamMembers, weekDates) {
  const membersList = teamMembers.map(m => `
    <tr>
      <td style="padding: 8px 16px; border-bottom: 1px solid #e5e7eb;">
        <span style="color: #374151;">${m.nom}</span>
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rappel - Charge de la semaine</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">

          <!-- Header avec dégradé -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f766e 0%, #7c3aed 50%, #db2777 100%); border-radius: 16px 16px 0 0; padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                Calendrier de gestion d'équipe
              </h1>
              <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">
                Semaine du ${weekDates.start} au ${weekDates.end} ${weekDates.year}
              </p>
            </td>
          </tr>

          <!-- Contenu principal -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Bonjour <strong>${chefName}</strong>,
              </p>

              <p style="margin: 0 0 25px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                C'est le moment de planifier la charge de travail de votre équipe pour cette semaine !
              </p>

              <!-- Bouton CTA -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${APP_URL}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Accéder au calendrier
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Liste des membres -->
              <div style="margin-top: 30px;">
                <p style="margin: 0 0 15px 0; color: #6b7280; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                  Votre équipe
                </p>
                <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; overflow: hidden;">
                  ${membersList}
                </table>
              </div>

              <p style="margin: 30px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Merci de renseigner les heures budgétées pour chaque collaborateur et chaque client.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #1e293b; border-radius: 0 0 16px 16px; padding: 30px; text-align: center;">
              <p style="margin: 0 0 5px 0; color: #94a3b8; font-size: 12px;">Powered by</p>
              <p style="margin: 0; color: #e2e8f0; font-size: 16px; font-weight: 600;">AUDIT UP</p>
              <p style="margin: 15px 0 0 0; color: #64748b; font-size: 11px;">
                Cet email a été envoyé automatiquement. Merci de ne pas y répondre.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

async function sendEmail(to, toName, subject, htmlContent) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: to, name: toName }],
      subject: subject,
      htmlContent: htmlContent
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Brevo API error: ${error}`);
  }

  return response.json();
}

export default async function handler(req, res) {
  // Autoriser CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Accepter GET (pour cron Vercel) et POST (pour appels manuels)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!BREVO_API_KEY) {
    return res.status(500).json({ error: 'BREVO_API_KEY not configured' });
  }

  try {
    const { testMode, testEmail } = req.body || {};
    const weekDates = getWeekDates();
    const results = { sent: 0, errors: [], details: [] };

    // Récupérer les chefs de mission avec leurs équipes
    const { data: chefs, error: chefsError } = await supabase
      .from('collaborateurs')
      .select('*')
      .eq('est_chef_mission', true)
      .eq('actif', true)
      .not('email', 'is', null);

    if (chefsError) {
      throw new Error(`Erreur récupération chefs: ${chefsError.message}`);
    }

    // Récupérer les liaisons chef-collaborateurs
    const { data: liaisons, error: liaisonsError } = await supabase
      .from('collaborateur_chefs')
      .select('*');

    if (liaisonsError) {
      throw new Error(`Erreur récupération liaisons: ${liaisonsError.message}`);
    }

    // Récupérer tous les collaborateurs actifs
    const { data: allCollabs, error: collabsError } = await supabase
      .from('collaborateurs')
      .select('*')
      .eq('actif', true);

    if (collabsError) {
      throw new Error(`Erreur récupération collaborateurs: ${collabsError.message}`);
    }

    // Mode test : envoyer seulement à l'adresse de test
    if (testMode && testEmail) {
      // Trouver un chef pour avoir des données d'exemple
      const exampleChef = chefs[0];
      if (!exampleChef) {
        return res.status(400).json({ error: 'Aucun chef de mission trouvé pour le test' });
      }

      // Récupérer l'équipe du chef
      const teamIds = liaisons
        .filter(l => l.chef_id === exampleChef.id)
        .map(l => l.collaborateur_id);

      const teamMembers = allCollabs.filter(c => teamIds.includes(c.id));

      // Ajouter le chef lui-même s'il n'est pas dans la liste
      if (!teamMembers.find(m => m.id === exampleChef.id)) {
        teamMembers.unshift(exampleChef);
      }

      const htmlContent = generateEmailHTML(
        exampleChef.nom.split(' ')[0], // Prénom
        teamMembers,
        weekDates
      );

      await sendEmail(
        testEmail,
        'Test',
        `[TEST] Rappel - Charge de la semaine du ${weekDates.start}`,
        htmlContent
      );

      return res.status(200).json({
        success: true,
        testMode: true,
        message: `Email de test envoyé à ${testEmail}`
      });
    }

    // Mode normal : envoyer à tous les chefs de mission
    for (const chef of chefs) {
      try {
        // Récupérer l'équipe du chef
        const teamIds = liaisons
          .filter(l => l.chef_id === chef.id)
          .map(l => l.collaborateur_id);

        const teamMembers = allCollabs.filter(c => teamIds.includes(c.id));

        // Ajouter le chef lui-même s'il n'est pas dans la liste
        if (!teamMembers.find(m => m.id === chef.id)) {
          teamMembers.unshift(chef);
        }

        const htmlContent = generateEmailHTML(
          chef.nom.split(' ')[0], // Prénom
          teamMembers,
          weekDates
        );

        await sendEmail(
          chef.email,
          chef.nom,
          `Rappel - Charge de la semaine du ${weekDates.start}`,
          htmlContent
        );

        results.sent++;
        results.details.push({ chef: chef.nom, email: chef.email, status: 'sent' });

      } catch (err) {
        results.errors.push({ chef: chef.nom, error: err.message });
        results.details.push({ chef: chef.nom, email: chef.email, status: 'error', error: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      ...results,
      weekDates
    });

  } catch (err) {
    console.error('Erreur send-reminder:', err);
    return res.status(500).json({ error: err.message });
  }
}
