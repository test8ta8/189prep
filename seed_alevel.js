import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function seed() {
  console.log('Seeding A-Level Mocks...');

  // 1. Insert Paper 1
  const { data: p1, error: e1 } = await supabase.from('mock_tests').insert({
    title: 'A-Level Mathematics (9709) - Paper 1',
    subject: 'A-Level Mathematics',
    duration_minutes: 110,
    question_count: 2,
    is_premium: false,
    exam_system: 'alevel',
    paper_number: 1
  }).select().single();

  if (e1) return console.error('Error P1', e1);

  // 2. Insert Paper 4
  const { data: p4, error: e4 } = await supabase.from('mock_tests').insert({
    title: 'A-Level Mathematics (9709) - Paper 4',
    subject: 'A-Level Mathematics',
    duration_minutes: 75,
    question_count: 2,
    is_premium: false,
    exam_system: 'alevel',
    paper_number: 4
  }).select().single();

  if (e4) return console.error('Error P4', e4);

  // 3. Insert Questions for Paper 1
  const { error: q1 } = await supabase.from('questions').insert([
    {
      test_id: p1.id,
      text: 'Find the coefficient of \\( x^3 \\) in the expansion of \\( (2 + x)^5 \\).',
      question_type: 'written',
      correct_answer_text: '80',
      difficulty: 'medium',
      order_num: 1,
      status: 'published'
    },
    {
      test_id: p1.id,
      text: 'A curve has equation \\( y = 3x^2 - 4x + 1 \\). Find the coordinates of the minimum point.',
      question_type: 'mcq',
      options: ['(2/3, -1/3)', '(1, 0)', '(-2/3, 5)', '(0, 1)'],
      correct_option_index: 0,
      difficulty: 'medium',
      order_num: 2,
      status: 'published'
    }
  ]);

  if (q1) console.error('Error Q1', q1);

  // 4. Insert Questions for Paper 4
  const { error: q4 } = await supabase.from('questions').insert([
    {
      test_id: p4.id,
      text: 'A particle \\( P \\) of mass 0.6 kg is dropped from a height of 5 m above horizontal ground. Find the speed of \\( P \\) immediately before it hits the ground. (Take \\( g = 10 \\))',
      question_type: 'written',
      correct_answer_text: '10',
      difficulty: 'easy',
      order_num: 1,
      status: 'published'
    },
    {
      test_id: p4.id,
      text: 'A car of mass 1200 kg travels along a straight horizontal road. The resistance to motion is constant and equal to 400 N. The car accelerates from rest to 20 m/s in 15 seconds. Find the driving force.',
      question_type: 'mcq',
      options: ['1600 N', '2000 N', '1200 N', '2400 N'],
      correct_option_index: 1,
      difficulty: 'medium',
      order_num: 2,
      status: 'published'
    }
  ]);

  if (q4) console.error('Error Q4', q4);

  console.log('Successfully inserted Paper 1 and Paper 4 with sample questions!');
}

seed();
