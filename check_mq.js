import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, count, error } = await supabase.from('mock_questions').select('id', { count: 'exact' }).limit(1);
  console.log("Count:", count, "Error:", error, "Data length:", data?.length);
}
check();
