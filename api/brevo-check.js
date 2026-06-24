/**
 * Endpoint de diagnostic temporaire : vérifie la clé Brevo réellement chargée
 * par le site (4 derniers caractères) et teste cette clé sur /v3/account
 * (sans envoyer d'email). À supprimer une fois le problème résolu.
 */

const BREVO_API_KEY = process.env.BREVO_API_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const key = BREVO_API_KEY || '';
  const info = {
    clePresente: !!key,
    longueur: key.length,
    quatreDerniers: key ? key.slice(-4) : null,
  };

  if (!key) {
    return res.status(200).json({ ...info, compte: 'AUCUNE clé configurée' });
  }

  try {
    const r = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': key, accept: 'application/json' },
    });
    const body = await r.text();
    return res.status(200).json({
      ...info,
      statutHttp: r.status,
      reponseBrevo: body.slice(0, 500),
    });
  } catch (e) {
    return res.status(200).json({ ...info, erreur: e.message });
  }
}
