-- 1. Add exam_system and paper_number to mock_tests
ALTER TABLE public.mock_tests ADD COLUMN IF NOT EXISTS exam_system text DEFAULT 'dtm';
ALTER TABLE public.mock_tests ADD COLUMN IF NOT EXISTS paper_number integer;

-- 2. Add question_type and correct_answer_text to questions
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS question_type text DEFAULT 'multiple_choice';
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS correct_answer_text text;

-- 3. (Optional) Set all existing exams to 'dtm' if they are null
UPDATE public.mock_tests SET exam_system = 'dtm' WHERE exam_system IS NULL;
UPDATE public.questions SET question_type = 'multiple_choice' WHERE question_type IS NULL;
