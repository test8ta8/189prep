import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.rpc('get_triggers');
  if (error) {
    console.log("No RPC get_triggers. Trying direct query if we have permissions...");
    // we can't do direct pg_catalog queries via REST unless we use a function.
    console.log("Will fetch recent profiles to see if any exist.");
    const res = await supabase.from('profiles').select('created_at, id').order('created_at', { ascending: false }).limit(5);
    console.log("Data:", res.data);
    console.log("Error:", res.error);
  } else {
    console.log(data);
  }
}
check();
