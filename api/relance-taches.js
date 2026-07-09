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

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** Date ISO -> "20 juin" (format court français). */
function formaterJourMois(iso) {
  if (!iso) return '';
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch (e) {
    return iso;
  }
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

/** Une ligne de tâche (style iOS : accent couleur à gauche, date à droite). */
function ligne(t, couleur, clientsById, avecAssigne, collabsById, today) {
  const client = t.client_id && clientsById.get(t.client_id);
  const meta = [];
  if (client) meta.push(escapeHtml(client.nom));
  if (avecAssigne && t.collaborateur_id && collabsById && collabsById.get(t.collaborateur_id)) {
    meta.push('&rarr; ' + escapeHtml(collabsById.get(t.collaborateur_id).nom));
  }
  const urgent = t.priorite === 'urgente'
    ? '<span style="color:#ff3b30;font-weight:700;">URGENT&nbsp;&middot;&nbsp;</span>' : '';
  const dateTxt = t.date_echeance ? formaterJourMois(t.date_echeance) : 'à dater';
  // Couleur de la date selon l'urgence (rouge = en retard, orange = proche), sinon couleur de section
  let dc = couleur;
  if (t.date_echeance && today) {
    if (diffJours(t.date_echeance, today) > 0) dc = '#ff3b30';
    else if (diffJours(today, t.date_echeance) >= 0 && diffJours(today, t.date_echeance) <= SEUIL_PROCHE) dc = '#ff9500';
  }
  const metaHtml = meta.length
    ? `<div style="font-size:13px;color:#8e8e93;margin-top:1px;">${meta.join(' &middot; ')}</div>` : '';
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
    <tr>
      <td width="3" style="background:${couleur};border-radius:2px;font-size:0;line-height:0;">&nbsp;</td>
      <td style="padding:3px 8px 3px 12px;">
        <div style="font-size:15px;color:#1c1c1e;font-weight:500;line-height:1.3;">${urgent}${escapeHtml(t.titre)}</div>
        ${metaHtml}
      </td>
      <td align="right" valign="top" style="padding:3px 0;white-space:nowrap;">
        <span style="color:${dc};font-size:13px;font-weight:600;">${dateTxt}</span>
      </td>
    </tr>
  </table>`;
}

/** Une section (titre coloré en petites majuscules + ses lignes). */
function section(titre, couleur, taches, clientsById, avecAssigne, collabsById, today) {
  if (!taches.length) return '';
  const rows = taches.map(t => ligne(t, couleur, clientsById, avecAssigne, collabsById, today)).join('');
  return `<div style="color:${couleur};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:20px 0 8px;">${escapeHtml(titre)}</div>${rows}`;
}

/** Enveloppe email — style épuré iOS (fond gris clair, carte blanche arrondie). */
function gabarit(prenom, contenu) {
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f2f2f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f7;font-family:${font};">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;">
        <tr><td style="padding:26px 22px 4px;">
          <div style="font-size:22px;font-weight:700;color:#1c1c1e;letter-spacing:-0.3px;">Bonjour ${escapeHtml(prenom)}</div>
          <div style="font-size:14px;color:#8e8e93;margin-top:3px;">Voici vos tâches de la semaine.</div>
        </td></tr>
        <tr><td style="padding:0 22px 6px;">
          ${contenu}
          <div style="margin:24px 0 6px;">
            <a href="${APP_URL}" style="display:block;text-align:center;border:1.5px solid #7c3aed;color:#7c3aed;text-decoration:none;font-size:15px;font-weight:600;padding:12px;border-radius:14px;">Ouvrir mes tâches</a>
          </div>
        </td></tr>
        <tr><td style="padding:14px 22px 24px;text-align:center;">
          <div style="font-size:12px;color:#b0b0b5;">AUDIT UP &middot; Calendrier</div>
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

      // Tâches que J'AI confiées à un autre collègue et encore à faire (quel que soit son rôle/équipe)
      const confiees = (taches || [])
        .filter(t => t.created_by === c.id && t.collaborateur_id !== c.id)
        .sort((a, b) => (a.date_echeance || '9999-99-99').localeCompare(b.date_echeance || '9999-99-99'));

      // Équipe en retard (pour chefs/admin) — hors tâches que j'ai moi-même confiées (déjà listées ci-dessus)
      const teamIds = new Set(equipeDe(c));
      const equipeRetard = (taches || []).filter(t => teamIds.has(t.collaborateur_id) && t.created_by !== c.id && estRetard(t))
        .sort((a, b) => (a.date_echeance || '').localeCompare(b.date_echeance || ''));

      const blocs = [
        section('En retard', '#ff3b30', mesEnRetard, clientsById, false, collabsById, today),
        section('À venir (≤ 2 jours)', '#ff9500', mesProche, clientsById, false, collabsById, today),
        section('Sans date — à planifier', '#8e8e93', mesSansDate, clientsById, false, collabsById, today),
        section('Tâches que vous avez confiées (à suivre)', '#7c3aed', confiees, clientsById, true, collabsById, today),
        section('Équipe — en retard', '#ff3b30', equipeRetard, clientsById, true, collabsById, today),
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
