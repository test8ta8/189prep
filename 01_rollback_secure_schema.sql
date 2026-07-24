BEGIN;

-- ==============================================================================
-- 1. DROP AUDIT LOG TRIGGERS
-- ==============================================================================
DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
DROP TRIGGER IF EXISTS trg_audit_mock_tests ON public.mock_tests;
DROP FUNCTION IF EXISTS public.log_admin_action();

-- ==============================================================================
-- 2. DROP NEW FUNCTIONS & RPCs
-- ==============================================================================
DROP FUNCTION IF EXISTS public.create_exam_session(uuid);
DROP FUNCTION IF EXISTS public.get_exam_questions(uuid);
DROP FUNCTION IF EXISTS public.get_practice_questions(uuid);
DROP FUNCTION IF EXISTS public.get_question_metadata(uuid[]);
DROP FUNCTION IF EXISTS public.create_practice_session(uuid[]);
DROP FUNCTION IF EXISTS public.check_practice_answer(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.update_my_profile(text, text, text, text, timestamptz);
DROP FUNCTION IF EXISTS public.update_my_profile(text, text, text, text);

-- ==============================================================================
-- 3. DROP NEW TABLES
-- ==============================================================================
DROP TABLE IF EXISTS public.session_questions CASCADE;
DROP TABLE IF EXISTS public.admin_audit_logs CASCADE;

-- ==============================================================================
-- 4. REVERT test_sessions COLUMNS & INDEXES
-- ==============================================================================
DROP INDEX IF EXISTS public.idx_one_active_exam;
DROP INDEX IF EXISTS public.idx_test_sessions_user_id_status;
DROP INDEX IF EXISTS public.idx_test_sessions_test_id;
DROP INDEX IF EXISTS public.idx_sq_session_id;
DROP INDEX IF EXISTS public.idx_attempts_user_id_test_id;
DROP INDEX IF EXISTS public.idx_transactions_user_id_status;
DROP INDEX IF EXISTS public.idx_notifications_user_id_is_read;
DROP INDEX IF EXISTS public.idx_audit_admin_id;
DROP INDEX IF EXISTS public.idx_audit_table_record;

ALTER TABLE public.test_sessions 
DROP COLUMN IF EXISTS status,
DROP COLUMN IF EXISTS started_at,
DROP COLUMN IF EXISTS expires_at,
DROP COLUMN IF EXISTS session_type;

-- ==============================================================================
-- 5. REVERT is_admin() TO ORIGINAL
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE v_role text;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN coalesce(v_role = 'admin', false);
END;
$$;
-- Note: Original is_admin didn't use SECURITY DEFINER or SET search_path. This restores the old state.

-- ==============================================================================
-- 6. DROP ISOLATION POLICIES & RESTORE LEGACY RLS
-- ==============================================================================
DO $$ 
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- Restore simple legacy RLS from emergency_security_patch
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Mock tests are viewable by everyone" ON public.mock_tests FOR SELECT USING (true);
CREATE POLICY "Questions are viewable by everyone" ON public.questions FOR SELECT USING (true);

CREATE POLICY "Users can insert their own attempts" ON public.attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own attempts" ON public.attempts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own test sessions" ON public.test_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own test sessions" ON public.test_sessions FOR SELECT USING (auth.uid() = user_id);

COMMIT;
