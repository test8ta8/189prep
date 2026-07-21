import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkFKs() {
  const { data, error } = await supabase.rpc('get_fks');
  if (error) {
    console.log("Cannot use RPC. Will try to query directly.");
    // We can't query information_schema directly via postgrest.
  }
}
checkFKs();
