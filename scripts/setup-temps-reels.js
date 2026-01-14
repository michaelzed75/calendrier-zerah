import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Erreur: SUPABASE_URL ou SUPABASE_SERVICE_KEY non définie dans .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createTables() {
  console.log('Création des tables pour les temps réels...\n');

  // Test si les tables existent déjà
  const { data: existingTempsReels, error: testError } = await supabase
    .from('temps_reels')
    .select('id')
    .limit(1);

  if (!testError) {
    console.log('✓ Table temps_reels existe déjà');
  } else if (testError.code === '42P01') {
    console.log('Table temps_reels n\'existe pas, création nécessaire via SQL Editor de Supabase');
  } else {
    console.log('Erreur test temps_reels:', testError.message);
  }

  const { data: existingMappings, error: testError2 } = await supabase
    .from('mappings_pennylane')
    .select('id')
    .limit(1);

  if (!testError2) {
    console.log('✓ Table mappings_pennylane existe déjà');
  } else if (testError2.code === '42P01') {
    console.log('Table mappings_pennylane n\'existe pas, création nécessaire via SQL Editor de Supabase');
  } else {
    console.log('Erreur test mappings_pennylane:', testError2.message);
  }

  const { data: existingJournal, error: testError3 } = await supabase
    .from('journal_imports')
    .select('id')
    .limit(1);

  if (!testError3) {
    console.log('✓ Table journal_imports existe déjà');
  } else if (testError3.code === '42P01') {
    console.log('Table journal_imports n\'existe pas, création nécessaire via SQL Editor de Supabase');
  } else {
    console.log('Erreur test journal_imports:', testError3.message);
  }

  console.log('\n-------------------------------------------');
  console.log('Si les tables n\'existent pas, exécutez le SQL suivant');
  console.log('dans le SQL Editor de Supabase (https://supabase.com/dashboard):');
  console.log('-------------------------------------------\n');
  console.log('Fichier SQL: scripts/create-temps-reels-tables.sql');
}

createTables();
