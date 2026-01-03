import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://anrvvsfvejnmdouxjfxj.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFucnZ2c2Z2ZWpubWRvdXhqZnhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjgzMjk1OSwiZXhwIjoyMDgyNDA4OTU5fQ.A9Syj-QA7sHEP2x4p-_AeITz0Ma0ZHCCYR93m0LBHg0'
);

const CABINETS = {
  'audit-up': {
    name: 'Audit Up',
    token: process.env.PENNYLANE_AUDIT_UP_TOKEN || 'rCIXOo3ZlcdIWElrFEzNgcKxcyxjZlrIyH0L_yhh5Xw'
  },
  'zerah': {
    name: 'Zerah Fiduciaire',
    token: process.env.PENNYLANE_ZERAH_FIDUCIAIRE_TOKEN || '1lxZekvvVzLwj3KJZiIhjQ2mPD59IVidx4_AzIMIQUI'
  }
};

const API_BASE = 'https://app.pennylane.com/api/external/firm/v1';

async function apiCall(endpoint, token) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
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
    const pennylaneIds = [];

    // Recuperer les dossiers des deux cabinets
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
          pennylaneIds.push({ id: c.id, cabinet: cabinet.name });
        });
      } catch (err) {
        console.error(`Erreur sync ${cabinet.name}:`, err.message);
      }
    }

    // Si aucun dossier recupere, ne pas desactiver
    if (allDossiers.length === 0) {
      return res.status(500).json({
        error: 'Aucun dossier recupere depuis Pennylane. Verifiez les tokens API.'
      });
    }

    let imported = 0;
    let updated = 0;
    let deactivated = 0;

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
        } else {
          await supabase.from('clients').insert([dossier]);
          imported++;
        }
      } catch (err) {
        console.error(`Erreur pour ${dossier.nom}:`, err.message);
      }
    }

    // Soft delete : desactiver les clients qui ne sont plus dans Pennylane
    const { data: clientsWithPennylane } = await supabase
      .from('clients')
      .select('id, pennylane_id, cabinet, actif')
      .not('pennylane_id', 'is', null)
      .not('cabinet', 'is', null);

    for (const client of clientsWithPennylane || []) {
      const stillExists = pennylaneIds.some(
        p => p.id === client.pennylane_id && p.cabinet === client.cabinet
      );
      if (!stillExists && client.actif) {
        await supabase.from('clients').update({ actif: false }).eq('id', client.id);
        deactivated++;
      }
    }

    return res.status(200).json({
      success: true,
      imported,
      updated,
      deactivated,
      total: allDossiers.length
    });

  } catch (err) {
    console.error('Erreur sync:', err);
    return res.status(500).json({ error: err.message });
  }
}
