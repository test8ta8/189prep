import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const PAPERS_DIR = 'C:\\Users\\MSI\\Desktop\\papers';

async function uploadPapers() {
  console.log('Starting A-Level Paper Uploads...');
  const files = fs.readdirSync(PAPERS_DIR);
  
  const qpFiles = files.filter(f => f.includes('_qp_') && f.endsWith('.pdf'));

  let sqlOutput = ``;

  for (const file of qpFiles) {
    console.log(`\nProcessing ${file}...`);
    
    const match = file.match(/_qp_(\d)\d/);
    if (!match) continue;
    const paperNum = parseInt(match[1]);

    const filePath = path.join(PAPERS_DIR, file);
    const fileBuffer = fs.readFileSync(filePath);

    const fileName = `test-pdfs/auto-${Date.now()}-${file}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('question-images')
      .upload(fileName, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      console.error(`Failed to upload ${file}:`, uploadError);
      continue;
    }

    const { data: { publicUrl } } = supabase.storage.from('question-images').getPublicUrl(fileName);
    console.log(`Uploaded! URL: ${publicUrl}`);

    const p_id = `gen_random_uuid()`;
    
    sqlOutput += `
DO $$
DECLARE
  new_test_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.mock_tests (id, title, subject, duration_minutes, question_count, is_premium, exam_system, paper_number, pdf_url)
  VALUES (new_test_id, 'A-Level Math (9709) - Paper ${paperNum}', 'A-Level Mathematics', 120, 10, false, 'alevel', ${paperNum}, '${publicUrl}');

  -- Insert 5 blank written questions for this paper so the user has inputs to write on
  FOR i IN 1..5 LOOP
    INSERT INTO public.questions (test_id, text, question_type, difficulty, order_num, status)
    VALUES (new_test_id, '', 'written', 'medium', i, 'published');
  END LOOP;
END $$;
`;
  }

  fs.writeFileSync('insert_papers.sql', sqlOutput);
  console.log('\n✅ Upload complete! Generated insert_papers.sql');
}

uploadPapers();
