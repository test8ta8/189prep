import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function introspect() {
  const { data: tests } = await supabase.from('test_sessions').select('*').limit(1);
  console.log("test_sessions columns:", tests && tests.length > 0 ? Object.keys(tests[0]) : "No test_sessions found");
}
introspect();
