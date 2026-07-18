-- Wait, since we need the test_id for questions, let's just use specific UUIDs.
DO $$
DECLARE
  p1_id UUID := gen_random_uuid();
  p4_id UUID := gen_random_uuid();
BEGIN
  -- Insert Paper 1
  INSERT INTO public.mock_tests (id, title, subject, duration_minutes, question_count, is_premium, exam_system, paper_number)
  VALUES (p1_id, 'A-Level Mathematics (9709) - Paper 1', 'A-Level Mathematics', 110, 2, false, 'alevel', 1);

  -- Insert Paper 4
  INSERT INTO public.mock_tests (id, title, subject, duration_minutes, question_count, is_premium, exam_system, paper_number)
  VALUES (p4_id, 'A-Level Mathematics (9709) - Paper 4', 'A-Level Mathematics', 75, 2, false, 'alevel', 4);

  -- Insert Questions for Paper 1
  INSERT INTO public.questions (test_id, text, question_type, correct_answer_text, difficulty, order_num, status)
  VALUES (p1_id, 'Find the coefficient of x^3 in the expansion of (2 + x)^5.', 'written', '80', 'medium', 1, 'published');

  INSERT INTO public.questions (test_id, text, question_type, options, correct_option_index, difficulty, order_num, status)
  VALUES (p1_id, 'A curve has equation y = 3x^2 - 4x + 1. Find the coordinates of the minimum point.', 'mcq', ARRAY['(2/3, -1/3)', '(1, 0)', '(-2/3, 5)', '(0, 1)'], 0, 'medium', 2, 'published');

  -- Insert Questions for Paper 4
  INSERT INTO public.questions (test_id, text, question_type, correct_answer_text, difficulty, order_num, status)
  VALUES (p4_id, 'A particle P of mass 0.6 kg is dropped from a height of 5 m above horizontal ground. Find the speed of P immediately before it hits the ground. (Take g = 10)', 'written', '10', 'easy', 1, 'published');

  INSERT INTO public.questions (test_id, text, question_type, options, correct_option_index, difficulty, order_num, status)
  VALUES (p4_id, 'A car of mass 1200 kg travels along a straight horizontal road. The resistance to motion is constant and equal to 400 N. The car accelerates from rest to 20 m/s in 15 seconds. Find the driving force.', 'mcq', ARRAY['1600 N', '2000 N', '1200 N', '2400 N'], 1, 'medium', 2, 'published');

END $$;
