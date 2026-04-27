/**
 * Proxy API pour les appels Pennylane côté client.
 *
 * 2 modes d'authentification supportés :
 *
 *   1) Mode Vault (recommandé — utilisé par Tests Comptables) :
 *      Headers :
 *        - Authorization: Bearer <JWT_supabase>
 *        - X-Pennylane-Client-Id: <client.id>
 *        - X-Pennylane-Scope: 'read' (par défaut) ou 'write'
 *      → Le proxy authentifie le user, fetch la clé depuis Vault, appelle Pennylane.
 *      → La clé n'est JAMAIS exposée au navigateur.
 *
 *   2) Mode legacy (clé brute en header — utilisé par Honoraires temporairement) :
 *      Headers :
 *        - X-Pennylane-Api-Key: <clé en clair>
 *        - X-Company-Id: <id> (pour les clés cabinet)
 *      → Le proxy transmet la clé telle quelle.
 *      → À supprimer à terme une fois toute la chaîne migrée vers Vault.
 */

import { createClient } from '@supabase/supabase-js';

const API_BASE = 'https://app.pennylane.com/api/external/v2';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
  : null;

/**
 * Vérifie le JWT et renvoie le user (ou null si invalide).
 */
async function authenticateUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  if (!supabaseAdmin) return null;
  const token = authHeader.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.email) return null;
  return data.user;
}

/**
 * Récupère la clé API d'un client depuis Vault.
 */
async function getVaultClientKey(clientId, scope) {
  if (!supabaseAdmin) {
    throw new Error('Supabase non configuré côté serveur');
  }
  const { data, error } = await supabaseAdmin.rpc('get_pennylane_client_key', {
    p_client_id: clientId,
    p_scope: scope
  });
  if (error) throw new Error(`Erreur lecture Vault: ${error.message}`);
  if (!data) throw new Error(`Aucune clé ${scope.toUpperCase()} configurée pour le client ${clientId}`);
  return data;
}

/**
 * Récupère la clé API d'un cabinet depuis Vault.
 */
async function getVaultCabinetKey(cabinet) {
  if (!supabaseAdmin) {
    throw new Error('Supabase non configuré côté serveur');
  }
  const { data, error } = await supabaseAdmin.rpc('get_pennylane_cabinet_key', {
    p_cabinet: cabinet
  });
  if (error) throw new Error(`Erreur lecture Vault: ${error.message}`);
  if (!data) throw new Error(`Aucune clé configurée dans Vault pour le cabinet "${cabinet}"`);
  return data;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Pennylane-Api-Key, X-Pennylane-Client-Id, X-Pennylane-Scope, X-Company-Id'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ─────────────────────────────────────────────
  // Résoudre la clé API à utiliser
  // 3 modes possibles :
  //   - X-Pennylane-Client-Id (Vault, par client)
  //   - X-Pennylane-Cabinet  (Vault, par cabinet)
  //   - X-Pennylane-Api-Key  (legacy, clé brute)
  // ─────────────────────────────────────────────
  let apiKey = null;
  let usingVault = false;

  const clientIdHeader = req.headers['x-pennylane-client-id'];
  const cabinetHeader = req.headers['x-pennylane-cabinet'];

  if (clientIdHeader) {
    // Mode Vault — clé client
    const user = await authenticateUser(req.headers['authorization']);
    if (!user) {
      return res.status(401).json({
        error: 'Authentification requise (header Authorization: Bearer <JWT>)'
      });
    }

    const clientId = parseInt(clientIdHeader, 10);
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'X-Pennylane-Client-Id doit être un nombre' });
    }

    const scope = req.headers['x-pennylane-scope'] === 'write' ? 'write' : 'read';

    try {
      apiKey = await getVaultClientKey(clientId, scope);
      usingVault = true;
    } catch (err) {
      return res.status(404).json({ error: err.message });
    }
  } else if (cabinetHeader) {
    // Mode Vault — clé cabinet
    const user = await authenticateUser(req.headers['authorization']);
    if (!user) {
      return res.status(401).json({
        error: 'Authentification requise (header Authorization: Bearer <JWT>)'
      });
    }

    try {
      apiKey = await getVaultCabinetKey(cabinetHeader);
      usingVault = true;
    } catch (err) {
      return res.status(404).json({ error: err.message });
    }
  } else {
    // Mode legacy : clé directement dans le header
    apiKey = req.headers['x-pennylane-api-key'];
    if (!apiKey) {
      return res.status(400).json({
        error: 'Clé API manquante. Utilisez X-Pennylane-Client-Id, X-Pennylane-Cabinet (modes Vault) ou X-Pennylane-Api-Key (legacy).'
      });
    }
  }

  // ─────────────────────────────────────────────
  // Construire et exécuter la requête Pennylane
  // ─────────────────────────────────────────────
  const { endpoint, ...queryParams } = req.query;

  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint manquant (query param endpoint)' });
  }

  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });

  console.log(`[Pennylane Proxy] ${req.method} ${url.toString()} ${usingVault ? '(Vault)' : '(legacy)'}`);

  try {
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    const companyId = req.headers['x-company-id'];
    if (companyId) {
      headers['X-Company-Id'] = companyId;
    }

    const fetchOptions = {
      method: req.method,
      headers
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(url.toString(), fetchOptions);

    if (response.status === 204) {
      return res.status(204).end();
    }

    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      const text = await response.text();
      return res.status(response.status).send(text);
    }
  } catch (error) {
    console.error('[Pennylane Proxy] Erreur:', error.message);
    return res.status(500).json({
      error: 'Erreur proxy Pennylane',
      message: error.message
    });
  }
}
