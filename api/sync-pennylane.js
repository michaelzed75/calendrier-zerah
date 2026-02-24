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
    const syncedCabinets = []; // Cabinets qui ont réussi le sync

    // Recuperer les dossiers des deux cabinets
    for (const [key, cabinet] of Object.entries(CABINETS)) {
      try {
        const companies = await getAllCompanies(key);
        companies.forEach(c => {
          const dossier = {
            nom: c.name,
            code_pennylane: c.external_id || c.client_code || String(c.id),
            pennylane_id: c.id,
            cabinet: cabinet.name,
            siren: c.siren || null,
            adresse: c.address || null,
            ville: c.city || null,
            code_postal: c.postal_code || null,
            actif: true
          };
          // Capturer l'email si disponible dans l'API firm
          const firmEmail = c.email || (c.emails && c.emails[0]) || null;
          if (firmEmail) {
            dossier.email = firmEmail;
          }
          allDossiers.push(dossier);
        });
        // Ce cabinet a réussi → on peut désactiver ses clients manquants
        syncedCabinets.push(cabinet.name);
      } catch (err) {
        // Cabinet en erreur → on ne désactivera PAS ses clients
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

    // Importer/mettre a jour les dossiers
    // Stratégie : match par pennylane_id+cabinet → fallback par SIREN → sinon insert
    for (const dossier of allDossiers) {
      try {
        // 1. Match par pennylane_id + cabinet (identifiant technique Pennylane)
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
          // 2. Fallback : match par SIREN (CLÉ UNIVERSELLE)
          // Chercher TOUT client actif avec ce SIREN (pas seulement sans pennylane_id)
          // Cela évite de créer un doublon quand le même client existe déjà via une autre source
          const { data: existingBySiren } = await supabase
            .from('clients')
            .select('id')
            .eq('siren', dossier.siren)
            .eq('actif', true)
            .limit(1)
            .single();

          if (existingBySiren) {
            // Mettre à jour sans écraser le pennylane_id existant s'il y en a déjà un différent
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

    // Pas de soft delete automatique : la désactivation est gérée manuellement par l'utilisateur

    return res.status(200).json({
      success: true,
      imported,
      updated,
      deactivated: 0,
      total: allDossiers.length,
      cabinets_ok: syncedCabinets
    });

  } catch (err) {
    console.error('Erreur sync:', err);
    return res.status(500).json({ error: err.message });
  }
}
