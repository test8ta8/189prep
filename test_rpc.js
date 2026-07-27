import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function test() {
  const { data, error } = await supabase.rpc('get_exam_questions', { p_session_id: '00000000-0000-0000-0000-000000000000' });
  console.log(error);
}
test();
