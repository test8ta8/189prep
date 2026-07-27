import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { sql: "SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('questions', 'test_sessions', 'attempts');" });
  if (error) console.log('RPC error', error);
  else console.log(data);
}
run();
