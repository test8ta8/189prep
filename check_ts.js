import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const res = await supabase.from('test_sessions').select('*').limit(1);
  if (res.data && res.data.length > 0) {
    console.log(Object.keys(res.data[0]));
  } else {
    console.log("No data, try error:", res.error);
  }
}
check();
