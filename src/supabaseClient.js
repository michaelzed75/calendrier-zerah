import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://anrvvsfvejnmdouxjfxj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_BxHx7EG9PQ-TDT3BmHFfWg_BZz77c8k';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
