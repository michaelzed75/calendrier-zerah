import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CABINETS = {
  'audit-up': {
    name: 'Audit Up',
    token: process.env.PENNYLANE_AUDIT_UP_TOKEN
  },
  'zerah': {
    name: 'Zerah Fiduciaire',
    token: process.env.PENNYLANE_ZERAH_FIDUCIAIRE_TOKEN
  }
};

const FIRM_API_BASE = 'https://app.pennylane.com/api/external/firm/v1';
const V2_API_BASE = 'https://app.pennylane.com/api/external/v2';

async function apiCall(endpoint, token) {
  const response = await fetch(`${FIRM_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error ${response.status}: ${text}`);
  }

  return response.json();
}

/**
 * Appel API Pennylane v2 (customers) — côté serveur, pas besoin de proxy
 */
async function v2ApiCall(endpoint, apiKey, companyId) {
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Accept': 'application/json'
  };
  if (companyId) {
    headers['X-Company-Id'] = companyId;
  }

  const response = await fetch(`${V2_API_BASE}${endpoint}`, { headers });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`V2 API Error ${response.status}: ${text}`);
  }

  return response.json();
}

/**
 * Récupère tous les customers v2 (paginés par curseur)
 */
async function getAllCustomersV2(apiKey, companyId) {
  let allCustomers = [];
  let cursor = null;

  while (true) {
    let endpoint = '/customers?per_page=100';
    if (cursor) {
      endpoint += `&cursor=${cursor}`;
    }
    const result = await v2ApiCall(endpoint, apiKey, companyId);
    const items = result.items || [];
    allCustomers = allCustomers.concat(items);

    if (result.has_more === false || !result.next_cursor) {
      break;
    }
    cursor = result.next_cursor;
  }

  return allCustomers;
}

async function getAllCompanies(cabinetKey) {
  const cabinet = CABINETS[cabinetKey];
  if (!cabinet || !cabinet.token) return [];

  let allCompanies = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await apiCall(`/companies?page=${page}&per_page=100`, cabinet.token);
    const companies = result.items || result.companies || [];
    allCompanies = allCompanies.concat(companies);
    totalPages = result.total_pages || 1;
    page++;
  } while (page <= totalPages);

  return allCompanies;
}

export default async function handler(req, res) {
  // Autoriser CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const allDossiers = [];
    const syncedCabinets = [];

    // === ÉTAPE 1 : Sync firm/v1 (dossiers, SIREN, adresse) ===
    for (const [key, cabinet] of Object.entries(CABINETS)) {
      try {
        const companies = await getAllCompanies(key);
        companies.forEach(c => {
          allDossiers.push({
            nom: c.name,
            code_pennylane: c.external_id || c.client_code || String(c.id),
            pennylane_id: c.id,
            cabinet: cabinet.name,
            siren: c.siren || null,
            adresse: c.address || null,
            ville: c.city || null,
            code_postal: c.postal_code || null,
            actif: true
          });
        });
        syncedCabinets.push(cabinet.name);
      } catch (err) {
        console.error(`Erreur sync firm ${cabinet.name}:`, err.message);
      }
    }

    if (allDossiers.length === 0) {
      return res.status(500).json({
        error: 'Aucun dossier recupere depuis Pennylane. Verifiez les tokens API.'
      });
    }

    let imported = 0;
    let updated = 0;

    // Importer/mettre a jour les dossiers
    for (const dossier of allDossiers) {
      try {
        const { data: existing } = await supabase
          .from('clients')
          .select('id')
          .eq('pennylane_id', dossier.pennylane_id)
          .eq('cabinet', dossier.cabinet)
          .single();

        if (existing) {
          await supabase.from('clients').update(dossier).eq('id', existing.id);
          updated++;
        } else if (dossier.siren) {
          const { data: existingBySiren } = await supabase
            .from('clients')
            .select('id')
            .eq('siren', dossier.siren)
            .eq('actif', true)
            .limit(1)
            .single();

          if (existingBySiren) {
            await supabase.from('clients').update(dossier).eq('id', existingBySiren.id);
            updated++;
          } else {
            await supabase.from('clients').insert([dossier]);
            imported++;
          }
        } else {
          await supabase.from('clients').insert([dossier]);
          imported++;
        }
      } catch (err) {
        console.error(`Erreur pour ${dossier.nom}:`, err.message);
      }
    }

    // === ÉTAPE 2 : Enrichissement emails via API v2/customers (côté serveur) ===
    let emailsUpdated = 0;
    let emailDebug = '';

    try {
      // Lire les clés API v2 depuis pennylane_api_keys
      const { data: apiKeys, error: apiKeysError } = await supabase
        .from('pennylane_api_keys')
        .select('cabinet, api_key, company_id');

      if (apiKeysError) {
        emailDebug = `erreur lecture cles: ${apiKeysError.message}`;
      } else if (!apiKeys || apiKeys.length === 0) {
        emailDebug = 'aucune cle API dans pennylane_api_keys';
      } else {
        // Charger les clients actifs avec SIREN
        const { data: currentClients } = await supabase
          .from('clients')
          .select('id, siren, email')
          .eq('actif', true)
          .not('siren', 'is', null);

        const clientsBySiren = {};
        for (const c of (currentClients || [])) {
          if (c.siren) {
            clientsBySiren[c.siren] = c;
          }
        }

        const debugParts = [];

        for (const keyRow of apiKeys) {
          if (!keyRow.api_key) {
            debugParts.push(`${keyRow.cabinet}: pas de cle`);
            continue;
          }
          try {
            const customers = await getAllCustomersV2(keyRow.api_key, keyRow.company_id);
            let withEmail = 0;
            let withSiren = 0;
            let matched = 0;

            for (const customer of customers) {
              const email = (customer.emails && customer.emails[0]) || null;
              if (email) withEmail++;
              if (customer.reg_no) withSiren++;
              if (!email || !customer.reg_no) continue;

              const client = clientsBySiren[customer.reg_no];
              if (client) {
                matched++;
                if (client.email !== email) {
                  await supabase
                    .from('clients')
                    .update({ email })
                    .eq('id', client.id);
                  emailsUpdated++;
                }
              }
            }
            debugParts.push(`${keyRow.cabinet}: ${customers.length} customers, ${withEmail} emails, ${withSiren} SIREN, ${matched} matches, ${emailsUpdated} maj`);
          } catch (err) {
            debugParts.push(`${keyRow.cabinet}: ERREUR ${err.message}`);
            console.error(`Erreur v2 ${keyRow.cabinet}:`, err.message);
          }
        }
        emailDebug = debugParts.join(' | ');
      }
    } catch (err) {
      emailDebug = `ERREUR: ${err.message}`;
      console.error('Erreur enrichissement emails:', err.message);
    }

    return res.status(200).json({
      success: true,
      imported,
      updated,
      total: allDossiers.length,
      emails_updated: emailsUpdated,
      email_debug: emailDebug,
      cabinets_ok: syncedCabinets
    });

  } catch (err) {
    console.error('Erreur sync:', err);
    return res.status(500).json({ error: err.message });
  }
}
