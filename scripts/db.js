import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Erreur: SUPABASE_URL ou SUPABASE_SERVICE_KEY non définie dans .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const command = process.argv[2];
const table = process.argv[3];
const args = process.argv.slice(4);

function showHelp() {
  console.log(`
Usage: node scripts/db.js <commande> <table> [options]

Commandes disponibles:
  select <table>              - Lister tous les enregistrements
  select <table> <id>         - Obtenir un enregistrement par ID
  insert <table> <json>       - Insérer un enregistrement
  update <table> <id> <json>  - Modifier un enregistrement
  delete <table> <id>         - Supprimer un enregistrement
  count <table>               - Compter les enregistrements
  tables                      - Lister les tables (collaborateurs, clients, charges, collaborateur_chefs)

Exemples:
  node scripts/db.js select collaborateurs
  node scripts/db.js select clients 5
  node scripts/db.js insert clients '{"nom":"Test","actif":true}'
  node scripts/db.js update clients 5 '{"nom":"Nouveau nom"}'
  node scripts/db.js delete clients 5
  node scripts/db.js count charges
`);
}

async function run() {
  try {
    switch (command) {
      case 'tables':
        console.log('Tables disponibles: collaborateurs, clients, charges, collaborateur_chefs');
        break;

      case 'select': {
        if (!table) {
          console.error('Erreur: spécifiez une table');
          return;
        }
        const id = args[0];
        let query = supabase.from(table).select('*');
        if (id) {
          query = query.eq('id', parseInt(id));
        }
        const { data, error } = await query;
        if (error) throw error;
        console.table(data);
        console.log(`\n${data.length} résultat(s)`);
        break;
      }

      case 'count': {
        if (!table) {
          console.error('Erreur: spécifiez une table');
          return;
        }
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (error) throw error;
        console.log(`${table}: ${count} enregistrement(s)`);
        break;
      }

      case 'insert': {
        if (!table || !args[0]) {
          console.error('Erreur: spécifiez une table et les données JSON');
          return;
        }
        const insertData = JSON.parse(args[0]);
        const { data, error } = await supabase.from(table).insert([insertData]).select();
        if (error) throw error;
        console.log('Inséré avec succès:');
        console.table(data);
        break;
      }

      case 'update': {
        if (!table || !args[0] || !args[1]) {
          console.error('Erreur: spécifiez une table, un ID et les données JSON');
          return;
        }
        const updateId = parseInt(args[0]);
        const updateData = JSON.parse(args[1]);
        const { data, error } = await supabase.from(table).update(updateData).eq('id', updateId).select();
        if (error) throw error;
        console.log('Mis à jour avec succès:');
        console.table(data);
        break;
      }

      case 'delete': {
        if (!table || !args[0]) {
          console.error('Erreur: spécifiez une table et un ID');
          return;
        }
        const deleteId = parseInt(args[0]);
        const { error } = await supabase.from(table).delete().eq('id', deleteId);
        if (error) throw error;
        console.log(`Supprimé avec succès: ${table} #${deleteId}`);
        break;
      }

      default:
        showHelp();
    }
  } catch (error) {
    console.error('Erreur:', error.message);
  }
}

run();
