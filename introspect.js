import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function introspect() {
  const { data: tests } = await supabase.from('mock_tests').select('*').limit(1);
  console.log("mock_tests columns:", tests && tests.length > 0 ? Object.keys(tests[0]) : "No tests found");

  const { data: attempts } = await supabase.from('attempts').select('*').limit(1);
  console.log("attempts columns:", attempts && attempts.length > 0 ? Object.keys(attempts[0]) : "No attempts found");

  const { data: results } = await supabase.from('mock_test_results').select('*').limit(1);
  console.log("mock_test_results columns:", results && results.length > 0 ? Object.keys(results[0]) : "No results found");
}
introspect();
