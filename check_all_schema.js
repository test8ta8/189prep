import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function check() {
  const tables = [
    'profiles', 'mock_tests', 'questions', 'attempts', 'test_sessions', 
    'transactions', 'bookmarks', 'error_reports', 'exam_integrity_events', 'notifications'
  ];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table ${table}: ERROR`, error.message);
    } else {
      console.log(`Table ${table}: OK`);
    }
  }
}
check();
