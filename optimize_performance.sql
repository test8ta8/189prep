-- Bismillah
-- Indekslar ma'lumotlar bazasidan qidirish, filtrlash va tartiblash tezligini bir necha barobar oshiradi.

-- 1. ProgressView.jsx dagi "test_sessions" va "natijalar" ni yuklash uchun qilinadigan query ni tezlashtirish
-- Bu index "user_id" bo'yicha filter qilib, "completed_at" bo'yicha tartiblash (ORDER BY) ni juda tezlashtiradi.
CREATE INDEX IF NOT EXISTS idx_test_sessions_user_id_completed_at ON public.test_sessions(user_id, completed_at);

-- 2. "get_exam_questions" RPC si ichida "test_id" bo'yicha qidirib, "order_num" bo'yicha tartiblashni tezlashtirish
CREATE INDEX IF NOT EXISTS idx_questions_test_id_status_order ON public.questions(test_id, status, order_num);

-- 3. Qolgan foreign key lari uchun indekslar (avval yaratilmagan bo'lsa)
CREATE INDEX IF NOT EXISTS idx_questions_test_id ON public.questions(test_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_test_id ON public.test_sessions(test_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_user_id ON public.test_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON public.attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_question_id ON public.attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON public.bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_question_id ON public.bookmarks(question_id);
CREATE INDEX IF NOT EXISTS idx_session_questions_session_id ON public.session_questions(session_id);

-- Eslatma: PostgreSQL da Foreign Key'larga avtomatik tarzda index qo'yilmaydi, 
-- shuning uchun ularni qolda qo'shish SELECT va JOIN'larni ancha tezlashtiradi.
