import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Supabase
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

async function apiCall(endpoint, token, companyId = null) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json'
  };

  if (companyId) {
    headers['X-Company-Id'] = companyId;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, { headers });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error ${response.status}: ${text}`);
  }

  return response.json();
}

async function getAllCompanies(cabinetKey) {
  const cabinet = CABINETS[cabinetKey];
  if (!cabinet) return [];

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

async function listCompanies(cabinetKey) {
  const cabinet = CABINETS[cabinetKey];
  if (!cabinet) {
    console.error(`Cabinet inconnu: ${cabinetKey}`);
    return;
  }

  console.log(`\nDossiers de: ${cabinet.name}`);
  console.log('---');

  try {
    const allCompanies = await getAllCompanies(cabinetKey);

    if (allCompanies.length > 0) {
      const displayData = allCompanies.map(c => ({
        id: c.id,
        name: c.name,
        siren: c.siren || '-',
        code: c.external_id || c.client_code || '-'
      }));

      if (allCompanies.length <= 30) {
        console.table(displayData);
      } else {
        console.table(displayData.slice(0, 20));
        console.log(`... et ${allCompanies.length - 20} autres dossiers`);
      }
      console.log(`\nTotal: ${allCompanies.length} dossier(s)`);
    } else {
      console.log('Aucun dossier trouvé');
    }

    return allCompanies;
  } catch (error) {
    console.error('Erreur:', error.message);
  }
}

async function importAllToSupabase() {
  console.log('\n========================================');
  console.log('IMPORT PENNYLANE → SUPABASE');
  console.log('========================================\n');

  const allDossiers = [];

  // Récupérer les dossiers des deux cabinets
  for (const [key, cabinet] of Object.entries(CABINETS)) {
    console.log(`Récupération de ${cabinet.name}...`);
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
      console.log(`  → ${companies.length} dossiers récupérés`);
    } catch (error) {
      console.error(`  Erreur: ${error.message}`);
    }
  }

  console.log(`\nTotal à importer: ${allDossiers.length} dossiers`);
  console.log('\nImport en cours...\n');

  let imported = 0;
  let updated = 0;
  let errors = 0;

  for (const dossier of allDossiers) {
    try {
      // Vérifier si le dossier existe déjà (par pennylane_id + cabinet)
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('pennylane_id', dossier.pennylane_id)
        .eq('cabinet', dossier.cabinet)
        .single();

      if (existing) {
        // Mettre à jour
        const { error } = await supabase
          .from('clients')
          .update(dossier)
          .eq('id', existing.id);

        if (error) throw error;
        updated++;
      } else {
        // Insérer
        const { error } = await supabase
          .from('clients')
          .insert([dossier]);

        if (error) throw error;
        imported++;
      }
    } catch (error) {
      console.error(`Erreur pour ${dossier.nom}: ${error.message}`);
      errors++;
    }
  }

  console.log('\n========================================');
  console.log('RÉSULTAT');
  console.log('========================================');
  console.log(`✅ Nouveaux imports: ${imported}`);
  console.log(`🔄 Mis à jour: ${updated}`);
  console.log(`❌ Erreurs: ${errors}`);
  console.log(`📊 Total traité: ${allDossiers.length}`);
}

async function syncPennylane() {
  // Alias pour import
  await importAllToSupabase();
}

function showHelp() {
  console.log(`
Usage: node scripts/pennylane.js <commande> [cabinet] [options]

Cabinets disponibles:
  audit-up    - Audit Up
  zerah       - Zerah Fiduciaire

Commandes:
  companies <cabinet>    - Lister les dossiers d'un cabinet
  import                 - Importer TOUS les dossiers des 2 cabinets dans Supabase
  sync                   - Synchroniser (alias de import)

Exemples:
  node scripts/pennylane.js companies audit-up
  node scripts/pennylane.js companies zerah
  node scripts/pennylane.js import
`);
}

const command = process.argv[2];
const cabinetKey = process.argv[3];

async function run() {
  switch (command) {
    case 'companies':
      if (!cabinetKey) {
        console.error('Spécifiez un cabinet: audit-up ou zerah');
        return;
      }
      await listCompanies(cabinetKey);
      break;

    case 'import':
    case 'sync':
      await importAllToSupabase();
      break;

    default:
      showHelp();
  }
}

run();
