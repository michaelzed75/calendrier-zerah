// @ts-check
import { createClient } from '@supabase/supabase-js';

/**
 * URL du projet Supabase
 * @type {string}
 */
const SUPABASE_URL = 'https://anrvvsfvejnmdouxjfxj.supabase.co';

/**
 * Clé publique (anon) Supabase
 * @type {string}
 */
const SUPABASE_KEY = 'sb_publishable_BxHx7EG9PQ-TDT3BmHFfWg_BZz77c8k';

/**
 * Client Supabase configuré pour l'application
 * @type {import('@supabase/supabase-js').SupabaseClient}
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
