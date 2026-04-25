// @ts-check
/**
 * Endpoint serverless de gestion des clés API Pennylane par client.
 *
 * Sécurité :
 * - Authentification : JWT Supabase obligatoire (header Authorization: Bearer <token>)
 * - Autorisation : seul un collaborateur avec is_admin=true peut appeler cet endpoint
 * - Les clés transitent UNIQUEMENT dans le body POST (jamais en query string ni log)
 * - Les fonctions Vault sont appelées via service_role (bypass RLS)
 *
 * Actions supportées (POST) :
 *   { action: 'list' }
 *     → retourne la liste des clients ayant au moins une clé (sans les valeurs)
 *
 *   { action: 'has', client_id, scope }
 *     → vérifie si une clé existe (true/false), sans la révéler
 *
 *   { action: 'set', client_id, scope, api_key, label? }
 *     → crée ou met à jour la clé (read ou write) du client
 *
 *   { action: 'delete', client_id, scope }
 *     → supprime la clé du client + scope
 *
 * scope = 'read' | 'write'
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Client privilégié (bypass RLS) — utilisé pour appeler les fonctions Vault
// ET pour vérifier le JWT via auth.getUser(token) qui fonctionne avec service_role
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

/**
 * Vérifie le JWT et renvoie le collaborateur s'il est admin.
 * @param {string|undefined} authHeader - Valeur du header Authorization
 * @returns {Promise<{ ok: boolean, status?: number, error?: string, collaborateur?: any }>}
 */
async function authenticateAdmin(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Token manquant' };
  }
  const token = authHeader.slice(7);

  // Vérifier le JWT et récupérer le user
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user?.email) {
    return { ok: false, status: 401, error: 'Token invalide' };
  }

  // Vérifier le flag is_admin du collaborateur
  const { data: collab, error: collabErr } = await supabaseAdmin
    .from('collaborateurs')
    .select('id, email, is_admin, est_chef_mission, nom')
    .eq('email', userData.user.email)
    .single();

  if (collabErr || !collab) {
    return { ok: false, status: 403, error: 'Collaborateur introuvable' };
  }

  if (!collab.is_admin) {
    return { ok: false, status: 403, error: 'Accès réservé aux administrateurs' };
  }

  return { ok: true, collaborateur: collab };
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1) Authentification + autorisation
  const auth = await authenticateAdmin(req.headers['authorization']);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  // 2) Validation du body
  const { action, client_id, scope, api_key, label } = req.body || {};

  if (!action) {
    return res.status(400).json({ error: 'action requis' });
  }

  if (action !== 'list' && (!client_id || typeof client_id !== 'number')) {
    return res.status(400).json({ error: 'client_id requis (number)' });
  }

  if (['has', 'set', 'delete'].includes(action) && !['read', 'write'].includes(scope)) {
    return res.status(400).json({ error: 'scope doit être "read" ou "write"' });
  }

  try {
    // ─────────────────────────────────────────────
    // LIST : tous les clients ayant au moins 1 clé
    // ─────────────────────────────────────────────
    if (action === 'list') {
      const { data, error } = await supabaseAdmin
        .from('pennylane_client_keys')
        .select('client_id, scope, pennylane_key_label, created_at, updated_at, clients(nom, cabinet)')
        .order('client_id', { ascending: true });

      if (error) throw error;
      return res.status(200).json({ items: data });
    }

    // ─────────────────────────────────────────────
    // HAS : la clé existe-t-elle ? (sans la révéler)
    // ─────────────────────────────────────────────
    if (action === 'has') {
      const { data, error } = await supabaseAdmin
        .from('pennylane_client_keys')
        .select('id, pennylane_key_label, updated_at')
        .eq('client_id', client_id)
        .eq('scope', scope)
        .maybeSingle();

      if (error) throw error;
      return res.status(200).json({
        has: !!data,
        label: data?.pennylane_key_label || null,
        updated_at: data?.updated_at || null
      });
    }

    // ─────────────────────────────────────────────
    // SET : crée ou met à jour
    // ─────────────────────────────────────────────
    if (action === 'set') {
      if (!api_key || typeof api_key !== 'string' || api_key.length < 10) {
        return res.status(400).json({ error: 'api_key requise (string, ≥10 chars)' });
      }

      const { data, error } = await supabaseAdmin.rpc('set_pennylane_client_key', {
        p_client_id: client_id,
        p_scope: scope,
        p_api_key: api_key,
        p_label: label || null
      });

      if (error) throw error;
      return res.status(200).json({
        success: true,
        vault_secret_id: data,
        message: `Clé ${scope} stockée pour client ${client_id}`
      });
    }

    // ─────────────────────────────────────────────
    // DELETE : supprime
    // ─────────────────────────────────────────────
    if (action === 'delete') {
      const { data, error } = await supabaseAdmin.rpc('delete_pennylane_client_key', {
        p_client_id: client_id,
        p_scope: scope
      });

      if (error) throw error;
      return res.status(200).json({
        success: true,
        deleted: data === true
      });
    }

    return res.status(400).json({ error: `action inconnue: ${action}` });

  } catch (err) {
    console.error('[pennylane-key] Erreur:', err);
    return res.status(500).json({ error: err.message || 'Erreur interne' });
  }
}
