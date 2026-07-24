BEGIN;

-- ==============================================================================
-- 1. SCHEMA EXTENSIONS & COLUMN ADDITIONS
-- ==============================================================================
-- Expand test_sessions first so the status column exists for deduplication
ALTER TABLE public.test_sessions 
ADD COLUMN IF NOT EXISTS test_id uuid REFERENCES public.mock_tests(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
ADD COLUMN IF NOT EXISTS started_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS expires_at timestamptz,
ADD COLUMN IF NOT EXISTS session_type text DEFAULT 'exam' CHECK (session_type IN ('exam', 'practice'));

ALTER TABLE public.attempts 
ADD COLUMN IF NOT EXISTS test_id uuid REFERENCES public.mock_tests(id) ON DELETE CASCADE;

ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS test_id uuid REFERENCES public.mock_tests(id) ON DELETE CASCADE;

-- ==============================================================================
-- 2. PRE-MIGRATION DEDUPLICATION (Race Condition Safeguard)
-- ==============================================================================
-- Prevent migration crash by marking duplicate active sessions as abandoned.
-- This leaves only the most recently created 'in_progress' session active per user.
UPDATE public.test_sessions 
SET status = 'abandoned' 
WHERE status = 'in_progress' 
  AND id NOT IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY started_at DESC NULLS LAST, id DESC) as rn
        FROM public.test_sessions
        WHERE status = 'in_progress'
    ) t WHERE rn = 1
  );

-- ==============================================================================
-- 3. NEW TABLES & POLICIES
-- ==============================================================================

-- Admin Audit Logs
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id uuid NOT NULL,
    action_type text NOT NULL,
    table_name text NOT NULL,
    record_id text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit logs" ON public.admin_audit_logs FOR SELECT USING (public.is_admin());

-- Unified Session Questions Table (Practice tracking only)
CREATE TABLE IF NOT EXISTS public.session_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid REFERENCES public.test_sessions(id) ON DELETE CASCADE NOT NULL,
    question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
    is_answered boolean DEFAULT false,
    attempt_count integer DEFAULT 0,
    answered_at timestamptz,
    created_at timestamptz DEFAULT now(),
    UNIQUE(session_id, question_id)
);
ALTER TABLE public.session_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_questions FORCE ROW LEVEL SECURITY;

-- Bookmarks Table
CREATE TABLE IF NOT EXISTS public.bookmarks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, question_id)
);
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks FORCE ROW LEVEL SECURITY;

-- Error Reports Table
CREATE TABLE IF NOT EXISTS public.error_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id uuid REFERENCES public.mock_tests(id) ON DELETE CASCADE,
    question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    message text NOT NULL,
    status text DEFAULT 'new',
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_reports FORCE ROW LEVEL SECURITY;

-- Exam Integrity Events Table
CREATE TABLE IF NOT EXISTS public.exam_integrity_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    test_id uuid REFERENCES public.mock_tests(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.exam_integrity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_integrity_events FORCE ROW LEVEL SECURITY;

-- ==============================================================================
-- 3. COMPREHENSIVE INDEXING
-- ==============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_exam ON public.test_sessions (user_id) WHERE status = 'in_progress' AND session_type = 'exam';
CREATE INDEX IF NOT EXISTS idx_test_sessions_user_id_status ON public.test_sessions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_test_sessions_test_id ON public.test_sessions (test_id);
CREATE INDEX IF NOT EXISTS idx_questions_test_id_status ON public.questions (test_id, status);
CREATE INDEX IF NOT EXISTS idx_sq_session_id ON public.session_questions (session_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_id_test_id ON public.attempts (user_id, test_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id_status ON public.transactions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_is_read ON public.notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_admin_id ON public.admin_audit_logs (admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_table_record ON public.admin_audit_logs (table_name, record_id);

-- ==============================================================================
-- 4. DROP LEGACY POLICIES & ENFORCE RLS
-- ==============================================================================
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.mock_tests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.questions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.test_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.error_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE public.exam_integrity_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;

DO $$ 
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- ==============================================================================
-- 5. SECURE RPCs & FUNCTIONS
-- ==============================================================================

-- 5.1 is_admin()
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text;
BEGIN
    -- SECURITY NOTE: This function is declared SECURITY DEFINER and OWNED BY postgres.
    -- PostgreSQL superusers (postgres) inherently bypass Row Level Security.
    -- Therefore, this SELECT will NOT trigger the RLS policy on public.profiles,
    -- completely eliminating the risk of infinite recursion.
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN coalesce(v_role = 'admin', false);
END;
$$;
ALTER FUNCTION public.is_admin() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 5.2 update_my_profile()
CREATE OR REPLACE FUNCTION public.update_my_profile(
    p_full_name text, p_phone text, p_target_score text, p_target_university text, p_exam_date timestamptz DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    p_full_name := trim(p_full_name);
    p_phone := trim(p_phone);
    p_target_score := trim(p_target_score);
    p_target_university := trim(p_target_university);

    IF length(coalesce(p_full_name, '')) > 100 THEN RAISE EXCEPTION 'Full name is too long'; END IF;
    IF length(coalesce(p_phone, '')) > 20 THEN RAISE EXCEPTION 'Phone number is too long'; END IF;
    IF length(coalesce(p_target_university, '')) > 150 THEN RAISE EXCEPTION 'University name is too long'; END IF;
    IF length(coalesce(p_target_score, '')) > 10 THEN RAISE EXCEPTION 'Target score is too long'; END IF;

    IF p_phone IS NOT NULL AND p_phone !~ '^\+?[0-9]{9,15}$' THEN
        RAISE EXCEPTION 'Invalid phone number format';
    END IF;
    IF p_target_score IS NOT NULL AND p_target_score !~ '^[0-9]+(\.[0-9]+)?$' THEN
        RAISE EXCEPTION 'Invalid target score format';
    END IF;

    UPDATE public.profiles
    SET full_name = p_full_name, phone = p_phone, target_score = p_target_score,
        target_university = p_target_university, exam_date = p_exam_date, updated_at = now()
    WHERE id = auth.uid();
END;
$$;
ALTER FUNCTION public.update_my_profile OWNER TO postgres;
REVOKE ALL ON FUNCTION public.update_my_profile FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile TO authenticated;

-- 5.3 create_exam_session() - Transaction Safe Concurrency Control
CREATE OR REPLACE FUNCTION public.create_exam_session(p_test_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE 
    v_new_session_id uuid;
BEGIN
    -- Transaction-level advisory lock eliminates race conditions across concurrent requests
    PERFORM pg_advisory_xact_lock(hashtext('exam_' || auth.uid()::text));

    -- This physically runs in a single transaction, locking related test_sessions rows sequentially.
    -- Abandon previous active sessions
    UPDATE public.test_sessions 
    SET status = 'abandoned' 
    WHERE user_id = auth.uid() AND status = 'in_progress' AND session_type = 'exam';
    
    -- Create new session
    INSERT INTO public.test_sessions (user_id, test_id, status, session_type, expires_at)
    VALUES (auth.uid(), p_test_id, 'in_progress', 'exam', now() + interval '3 hours')
    RETURNING id INTO v_new_session_id;

    RETURN v_new_session_id;
END;
$$;
ALTER FUNCTION public.create_exam_session OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_exam_session FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_exam_session TO authenticated;

-- 5.4 get_exam_questions (Isolation via test_sessions.test_id)
CREATE OR REPLACE FUNCTION public.get_exam_questions(p_session_id uuid)
RETURNS TABLE (
    id uuid, test_id uuid, order_num integer, text text, image_url text, 
    options jsonb, points numeric, topic text, subtopic text, difficulty text, 
    status text, question_type text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_test_id uuid;
BEGIN
    -- Secure lookup of the session to get the test_id
    SELECT ts.test_id INTO v_test_id 
    FROM public.test_sessions ts 
    WHERE ts.id = p_session_id AND ts.user_id = auth.uid() AND ts.status = 'in_progress' AND ts.session_type = 'exam' AND ts.expires_at > now();

    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or unauthorized exam session'; END IF;

    RETURN QUERY
    SELECT q.id, q.test_id, q.order_num, q.text, q.image_url, q.options, 
           q.points, q.topic, q.subtopic, q.difficulty, q.status, q.question_type
    FROM public.questions q
    WHERE q.test_id = v_test_id AND q.status = 'approved'
    ORDER BY q.order_num ASC;
END;
$$;
ALTER FUNCTION public.get_exam_questions OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_exam_questions FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_exam_questions TO authenticated;

-- 5.5 get_practice_questions
CREATE OR REPLACE FUNCTION public.get_practice_questions(p_session_id uuid)
RETURNS TABLE (
    id uuid, test_id uuid, order_num integer, text text, image_url text, 
    options jsonb, points numeric, topic text, subtopic text, difficulty text, 
    status text, question_type text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.test_sessions 
        WHERE id = p_session_id AND user_id = auth.uid() AND status = 'in_progress' AND session_type = 'practice' AND expires_at > now()
    ) THEN RAISE EXCEPTION 'Invalid or expired practice session'; END IF;

    RETURN QUERY
    SELECT q.id, q.test_id, q.order_num, q.text, q.image_url, q.options, 
           q.points, q.topic, q.subtopic, q.difficulty, q.status, q.question_type
    FROM public.questions q
    JOIN public.session_questions sq ON sq.question_id = q.id
    WHERE sq.session_id = p_session_id
    ORDER BY random();
END;
$$;
ALTER FUNCTION public.get_practice_questions OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_practice_questions FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_practice_questions TO authenticated;

-- 5.6 get_question_metadata (For PracticeSetupView count/filtering)
CREATE OR REPLACE FUNCTION public.get_question_metadata(p_test_ids uuid[])
RETURNS TABLE (
    id uuid, test_id uuid, order_num integer, question_type text, difficulty text, topic text, subtopic text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- Authenticated users can fetch metadata of approved questions for filtering.
    -- No sensitive data (text, options, answers) is exposed here.
    RETURN QUERY
    SELECT q.id, q.test_id, q.order_num, q.question_type, q.difficulty, q.topic, q.subtopic
    FROM public.questions q
    JOIN public.mock_tests mt ON mt.id = q.test_id
    WHERE q.test_id = ANY(p_test_ids) AND q.status = 'approved' AND mt.is_hidden = false;
END;
$$;
ALTER FUNCTION public.get_question_metadata OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_question_metadata FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_question_metadata TO authenticated;

-- 5.7 create_practice_session (Atomic generation of Practice sessions)
CREATE OR REPLACE FUNCTION public.create_practice_session(p_question_ids uuid[]) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE 
    v_new_session_id uuid;
BEGIN
    IF array_length(p_question_ids, 1) > 200 THEN
        RAISE EXCEPTION 'Too many questions (max 200)';
    END IF;
    -- Transaction-level advisory lock prevents double-click TOCTOU duplicate active sessions
    PERFORM pg_advisory_xact_lock(hashtext('practice_' || auth.uid()::text));

    UPDATE public.test_sessions 
    SET status = 'abandoned' 
    WHERE user_id = auth.uid() AND status = 'in_progress' AND session_type = 'practice';
    
    INSERT INTO public.test_sessions (user_id, status, session_type, expires_at)
    VALUES (auth.uid(), 'in_progress', 'practice', now() + interval '24 hours')
    RETURNING id INTO v_new_session_id;

    INSERT INTO public.session_questions (session_id, question_id)
    SELECT v_new_session_id, q_id FROM unnest(p_question_ids) AS q_id;

    RETURN v_new_session_id;
END;
$$;
ALTER FUNCTION public.create_practice_session OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_practice_session FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_practice_session TO authenticated;

-- 5.8 check_practice_answer (Atomic TOCTOU-safe evaluation)
CREATE OR REPLACE FUNCTION public.check_practice_answer(p_session_id uuid, p_question_id uuid, p_user_answer text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_sq_id uuid;
    v_attempt_count integer;
    v_is_answered boolean;
    v_question record;
    v_is_correct boolean := false;
    v_correct_ans text;
    v_correct_opt text;
BEGIN
    IF length(coalesce(p_user_answer, '')) > 2000 THEN
        RAISE EXCEPTION 'Answer is too long';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.test_sessions 
        WHERE id = p_session_id AND user_id = auth.uid() AND status = 'in_progress' AND session_type = 'practice' AND expires_at > now()
    ) THEN
        RAISE EXCEPTION 'Invalid, expired, or unauthorized practice session';
    END IF;

    -- SELECT FOR UPDATE physically locks the specific row to prevent parallel increment attempts
    SELECT id, attempt_count, is_answered INTO v_sq_id, v_attempt_count, v_is_answered
    FROM public.session_questions
    WHERE session_id = p_session_id AND question_id = p_question_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Question not found in session'; END IF;
    IF v_is_answered THEN RAISE EXCEPTION 'Question already answered correctly'; END IF;
    IF v_attempt_count >= 3 THEN RAISE EXCEPTION 'Maximum attempts exceeded'; END IF;

    SELECT correct_answer_text, options, correct_option_index, explanation_uz, explanation_ru, question_type, points 
    INTO v_question
    FROM public.questions WHERE id = p_question_id;

    IF NOT FOUND THEN RAISE EXCEPTION 'Question not found'; END IF;

    IF v_question.question_type != 'written' THEN
        v_correct_ans := trim(coalesce(v_question.correct_answer_text::text, ''));
        IF v_question.options IS NOT NULL AND v_question.correct_option_index IS NOT NULL THEN
            BEGIN
                v_correct_opt := trim(v_question.options->>v_question.correct_option_index);
            EXCEPTION WHEN OTHERS THEN v_correct_opt := ''; END;
        ELSE v_correct_opt := ''; END IF;

        IF trim(p_user_answer) = v_correct_ans OR (v_correct_opt != '' AND trim(p_user_answer) = v_correct_opt) THEN
            v_is_correct := true;
        ELSIF p_user_answer ~ '^[0-9]+$' AND v_question.correct_option_index IS NOT NULL THEN
            IF p_user_answer::integer = v_question.correct_option_index THEN
                v_is_correct := true;
            END IF;
        END IF;
    END IF;

    UPDATE public.session_questions
    SET attempt_count = attempt_count + 1,
        is_answered = v_is_correct,
        answered_at = CASE WHEN v_is_correct THEN now() ELSE answered_at END
    WHERE id = v_sq_id;

    RETURN jsonb_build_object(
        'success', true,
        'isCorrect', v_is_correct,
        'correctAnswer', CASE WHEN v_is_correct THEN coalesce(v_question.correct_answer_text, v_correct_opt) ELSE null END,
        'explanation_uz', CASE WHEN v_is_correct THEN v_question.explanation_uz ELSE null END,
        'explanation_ru', CASE WHEN v_is_correct THEN v_question.explanation_ru ELSE null END
    );
END;
$$;
ALTER FUNCTION public.check_practice_answer OWNER TO postgres;
REVOKE ALL ON FUNCTION public.check_practice_answer FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_practice_answer TO authenticated;

-- ==============================================================================
-- 6. STRICT RLS POLICIES
-- ==============================================================================

-- Profiles: No public update.
CREATE POLICY "Users view own profile, admins view all" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins update profiles" ON public.profiles FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete profiles" ON public.profiles FOR DELETE USING (public.is_admin());

-- Mock Tests: Public read.
CREATE POLICY "Public read mock tests" ON public.mock_tests FOR SELECT USING (true);
CREATE POLICY "Admins manage tests" ON public.mock_tests FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Questions: Hidden from public entirely.
CREATE POLICY "Admins manage questions" ON public.questions FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Users view bookmarked questions" ON public.questions FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.bookmarks b
        WHERE b.question_id = id AND b.user_id = auth.uid()
    ) AND NOT EXISTS (
        SELECT 1 FROM public.test_sessions ts
        LEFT JOIN public.session_questions sq ON sq.session_id = ts.id
        WHERE ts.user_id = auth.uid() 
          AND ts.status = 'in_progress'
          AND (ts.test_id = questions.test_id OR sq.question_id = questions.id)
    )
);

-- Sessions, Attempts & Tracking: Backend managed, user read-only.
CREATE POLICY "Read own sessions" ON public.test_sessions FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Admins manage sessions" ON public.test_sessions FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Read own practice tracking" ON public.session_questions FOR SELECT USING (EXISTS (SELECT 1 FROM public.test_sessions ts WHERE ts.id = session_id AND ts.user_id = auth.uid()));

CREATE POLICY "Read own attempts" ON public.attempts FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Admins manage attempts" ON public.attempts FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Transactions & Notifications
CREATE POLICY "Read own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Admins manage transactions" ON public.transactions FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Read own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Insert notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Admins delete notifications" ON public.notifications FOR DELETE USING (public.is_admin());

-- Bookmarks: Users manage own
CREATE POLICY "Manage own bookmarks" ON public.bookmarks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Error Reports: User inserts own, admin reads/manages all
CREATE POLICY "Insert own error reports" ON public.error_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage error reports" ON public.error_reports FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Exam Integrity Events: User inserts own, admin reads all
CREATE POLICY "Insert own integrity events" ON public.exam_integrity_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage integrity events" ON public.exam_integrity_events FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ==============================================================================
-- 7. AUDIT LOGGING TRIGGERS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.log_admin_action() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF public.is_admin() THEN
        INSERT INTO public.admin_audit_logs (admin_id, action_type, table_name, record_id, old_data, new_data)
        VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, 
                CASE WHEN TG_OP = 'DELETE' THEN OLD.id::text ELSE NEW.id::text END,
                CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
                CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;
ALTER FUNCTION public.log_admin_action OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
DROP TRIGGER IF EXISTS trg_audit_profiles_update ON public.profiles;
DROP TRIGGER IF EXISTS trg_audit_profiles_delete ON public.profiles;

CREATE TRIGGER trg_audit_profiles_update AFTER UPDATE ON public.profiles FOR EACH ROW 
WHEN (OLD.role IS DISTINCT FROM NEW.role OR OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier OR OLD.is_suspended IS DISTINCT FROM NEW.is_suspended)
EXECUTE FUNCTION public.log_admin_action();

CREATE TRIGGER trg_audit_profiles_delete AFTER DELETE ON public.profiles FOR EACH ROW 
EXECUTE FUNCTION public.log_admin_action();

DROP TRIGGER IF EXISTS trg_audit_mock_tests ON public.mock_tests;
CREATE TRIGGER trg_audit_mock_tests AFTER INSERT OR UPDATE OR DELETE ON public.mock_tests FOR EACH ROW EXECUTE FUNCTION public.log_admin_action();

-- ==============================================================================
-- 8. SECURE STORAGE BUCKETS
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'buckets') THEN
        IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'mock-test-pdfs') THEN
            DROP POLICY IF EXISTS "Public Read PDFs" ON storage.objects;
            DROP POLICY IF EXISTS "Admin Insert PDFs" ON storage.objects;
            DROP POLICY IF EXISTS "Admin Update PDFs" ON storage.objects;
            DROP POLICY IF EXISTS "Admin Delete PDFs" ON storage.objects;

            CREATE POLICY "Public Read PDFs" ON storage.objects FOR SELECT USING (bucket_id = 'mock-test-pdfs');
            CREATE POLICY "Admin Insert PDFs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'mock-test-pdfs' AND public.is_admin());
            CREATE POLICY "Admin Update PDFs" ON storage.objects FOR UPDATE USING (bucket_id = 'mock-test-pdfs' AND public.is_admin());
            CREATE POLICY "Admin Delete PDFs" ON storage.objects FOR DELETE USING (bucket_id = 'mock-test-pdfs' AND public.is_admin());
        END IF;
    END IF;
END $$;

COMMIT;
