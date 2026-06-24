/**
 * Digest hebdomadaire des tâches (lundi matin) via Brevo.
 *
 * Pour chaque collaborateur, un seul mail regroupant :
 *  - En retard        : échéance dépassée, non faite
 *  - Échéance proche  : échéance dans ≤ 2 jours
 *  - Sans date        : tâches qui lui sont assignées sans échéance (à dater)
 *  - À dater (confiées): tâches qu'IL a créées pour un autre, sans échéance
 *  - Équipe en retard : (chefs/admin) retards des membres de son équipe
 *
 * Le mail n'est envoyé que si le collaborateur a au moins un élément à signaler.
 * Paramètre optionnel { onlyEmail } : n'envoie qu'au destinataire correspondant (test).
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = 'michael@zerah.fr';
const SENDER_NAME = 'Calendrier Audit UP';
const APP_URL = 'https://calendrier-zerah.vercel.app';
const SEUIL_PROCHE = 2;

function todayParis() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
}

function diffJours(aIso, bIso) {
  return Math.round((Date.parse(`${bIso}T00:00:00Z`) - Date.parse(`${aIso}T00:00:00Z`)) / 86400000);
}

function formaterDateFr(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

async function sendEmail(to, toName, subject, htmlContent) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { accept: 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: to, name: toName }],
      subject,
      htmlContent,
    }),
  });
  if (!response.ok) throw new Error(`Brevo API error: ${await response.text()}`);
  return response.json();
}

function ligne(t, clientsById, avecAssigne, collabsById) {
  const client = t.client_id && clientsById.get(t.client_id);
  const clientTxt = client ? ` <span style="color:#0e7490;">(${client.nom})</span>` : '';
  const ech = t.date_echeance ? ` — échéance ${formaterDateFr(t.date_echeance)}` : '';
  const urg = t.priorite === 'urgente' ? ' <strong style="color:#dc2626;">URGENT</strong>' : '';
  const qui = avecAssigne && t.collaborateur_id && collabsById.get(t.collaborateur_id)
    ? ` <span style="color:#6b7280;">→ ${collabsById.get(t.collaborateur_id).nom}</span>` : '';
  return `<li style="margin:4px 0;">${t.titre}${clientTxt}${ech}${urg}${qui}</li>`;
}

function section(titre, couleur, items) {
  if (!items.length) return '';
  return `
    <p style="margin:18px 0 6px;font-weight:600;color:${couleur};">${titre}</p>
    <ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;">${items.join('')}</ul>`;
}

function gabarit(prenom, contenu) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,sans-serif;background:#f3f4f6;">
  <table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;">
      <tr><td style="background:#5b21b6;border-radius:14px 14px 0 0;padding:26px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600;">Vos tâches de la semaine</h1>
      </td></tr>
      <tr><td style="background:#fff;padding:26px;color:#374151;font-size:15px;line-height:1.5;">
        <p style="margin:0 0 8px;">Bonjour ${prenom},</p>
        ${contenu}
        <div style="margin-top:22px;"><a href="${APP_URL}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;">Ouvrir mes tâches</a></div>
      </td></tr>
      <tr><td style="background:#1e293b;border-radius:0 0 14px 14px;padding:16px;text-align:center;">
        <p style="margin:0;color:#e2e8f0;font-size:14px;font-weight:600;">AUDIT UP</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!BREVO_API_KEY) return res.status(500).json({ error: 'BREVO_API_KEY not configured' });

  try {
    const onlyEmail = (req.body && req.body.onlyEmail) || (req.query && req.query.onlyEmail) || null;
    const today = todayParis();

    const [{ data: taches }, { data: collaborateurs }, { data: liaisons }, { data: clients }] = await Promise.all([
      supabase.from('taches').select('id, collaborateur_id, created_by, titre, client_id, date_echeance, priorite, statut').neq('statut', 'faite'),
      supabase.from('collaborateurs').select('id, nom, email, actif, est_chef_mission, is_admin'),
      supabase.from('collaborateur_chefs').select('chef_id, collaborateur_id'),
      supabase.from('clients').select('id, nom'),
    ]);

    const collabsById = new Map((collaborateurs || []).map(c => [c.id, c]));
    const clientsById = new Map((clients || []).map(c => [c.id, c]));

    const estRetard = t => t.date_echeance && diffJours(t.date_echeance, today) > 0;
    const estProche = t => t.date_echeance && diffJours(today, t.date_echeance) >= 0 && diffJours(today, t.date_echeance) <= SEUIL_PROCHE;
    const sansDate = t => !t.date_echeance;

    const equipeDe = (c) => {
      if (c.is_admin) return (collaborateurs || []).map(x => x.id).filter(id => id !== c.id);
      if (c.est_chef_mission) return (liaisons || []).filter(l => l.chef_id === c.id).map(l => l.collaborateur_id);
      return [];
    };

    const results = { envoyes: 0, details: [] };

    for (const c of collaborateurs || []) {
      if (!c.actif || !c.email) continue;
      if (onlyEmail && c.email.toLowerCase() !== String(onlyEmail).toLowerCase()) continue;

      const mes = (taches || []).filter(t => t.collaborateur_id === c.id);
      const mesEnRetard = mes.filter(estRetard).sort((a, b) => (a.date_echeance || '').localeCompare(b.date_echeance || ''));
      const mesProche = mes.filter(estProche);
      const mesSansDate = mes.filter(sansDate);

      const aDater = (taches || []).filter(t => t.created_by === c.id && t.collaborateur_id !== c.id && sansDate(t));

      const teamIds = new Set(equipeDe(c));
      const equipeRetard = (taches || []).filter(t => teamIds.has(t.collaborateur_id) && estRetard(t))
        .sort((a, b) => (a.date_echeance || '').localeCompare(b.date_echeance || ''));

      const blocs = [
        section('⚠️ En retard', '#dc2626', mesEnRetard.map(t => ligne(t, clientsById))),
        section('À venir (≤ 2 jours)', '#d97706', mesProche.map(t => ligne(t, clientsById))),
        section('Sans date — à planifier', '#6b7280', mesSansDate.map(t => ligne(t, clientsById))),
        section('Tâches que vous avez confiées, sans date', '#6b7280', aDater.map(t => ligne(t, clientsById, true, collabsById))),
        section('Équipe — en retard', '#dc2626', equipeRetard.map(t => ligne(t, clientsById, true, collabsById))),
      ].join('');

      if (!blocs.trim()) continue;

      try {
        await sendEmail(c.email, c.nom, 'Vos tâches de la semaine', gabarit(c.nom.split(' ')[0], blocs));
        results.envoyes++;
        results.details.push({ collab: c.nom, status: 'sent' });
      } catch (e) {
        results.details.push({ collab: c.nom, status: 'error', error: e.message });
      }
    }

    return res.status(200).json({ ok: true, today, ...results });
  } catch (err) {
    console.error('Erreur relance-taches:', err);
    return res.status(500).json({ error: err.message });
  }
}
