/**
 * Proxy API pour les appels Pennylane côté client
 * Cette fonction serverless permet d'éviter les problèmes CORS
 * lors des appels API Pennylane depuis le navigateur
 */

const API_BASE = 'https://app.pennylane.com/api/external/v2';

export default async function handler(req, res) {
  // Autoriser CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Pennylane-Api-Key, X-Company-Id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Récupérer la clé API depuis les headers
  const apiKey = req.headers['x-pennylane-api-key'];

  if (!apiKey) {
    return res.status(400).json({
      error: 'Clé API manquante (header X-Pennylane-Api-Key)'
    });
  }

  // Récupérer l'endpoint depuis les query params
  const { endpoint, ...queryParams } = req.query;

  if (!endpoint) {
    return res.status(400).json({
      error: 'Endpoint manquant (query param endpoint)'
    });
  }

  // Construire l'URL Pennylane
  const url = new URL(`${API_BASE}${endpoint}`);

  // Ajouter les paramètres de requête (sauf endpoint)
  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });

  console.log(`[Pennylane Proxy] ${req.method} ${url.toString()}`);

  try {
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    // Transférer le Company ID (requis par l'API Pennylane v2)
    const companyId = req.headers['x-company-id'];
    if (companyId) {
      headers['X-Company-Id'] = companyId;
    }

    const fetchOptions = {
      method: req.method,
      headers
    };

    // Ajouter le body pour les requêtes POST, PUT, PATCH
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(url.toString(), fetchOptions);

    // 204 No Content (typique pour DELETE)
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
