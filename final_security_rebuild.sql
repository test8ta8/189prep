-- ==============================================================================
-- FINAL SECURITY REBUILD - ZERO TRUST ARCHITECTURE
-- ==============================================================================

-- 1. DROP ALL EXISTING POLICIES TO PREVENT CONFLICTS AND BYPASSES
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 2. ENABLE RLS ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_integrity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3. SECURE is_admin() FUNCTION
-- Prevents infinite recursion by bypassing RLS
-- Explicitly sets search_path to prevent hijacking
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN coalesce(v_role = 'admin', false);
END;
$$;

-- 4. SECURE PROFILE UPDATE RPC
-- Completely revokes direct UPDATE access from frontend.
-- Validates inputs and updates only safe fields.
CREATE OR REPLACE FUNCTION public.update_my_profile(
    p_full_name text,
    p_phone text,
    p_target_score text,
    p_target_university text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Input Validation
    IF length(p_full_name) > 100 THEN
        RAISE EXCEPTION 'Full name is too long';
    END IF;
    IF length(p_phone) > 20 THEN
        RAISE EXCEPTION 'Phone number is too long';
    END IF;
    IF length(p_target_university) > 150 THEN
        RAISE EXCEPTION 'University name is too long';
    END IF;

    -- Secure Update
    UPDATE public.profiles
    SET 
        full_name = p_full_name,
        phone = p_phone,
        target_score = p_target_score,
        target_university = p_target_university,
        updated_at = now()
    WHERE id = auth.uid();
END;
$$;

-- Grant EXECUTE to authenticated users
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text, text, text) TO authenticated;

-- 4.5 SECURE GET QUESTIONS RPC (Hides correct answers from frontend)
CREATE OR REPLACE FUNCTION public.get_exam_questions(p_test_id uuid)
RETURNS TABLE (
    id uuid,
    test_id uuid,
    text text,
    options jsonb,
    image_url text,
    order_num integer,
    subject text,
    topic text,
    difficulty text,
    points numeric,
    question_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.id,
        q.test_id,
        q.text,
        q.options,
        q.image_url,
        q.order_num,
        q.subject,
        q.topic,
        q.difficulty,
        q.points,
        q.question_type
    FROM public.questions q
    WHERE q.test_id = p_test_id AND q.status = 'approved'
    ORDER BY q.order_num ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_exam_questions(uuid) TO authenticated;

-- 5. LEAST-PRIVILEGE RLS POLICIES

-- ==========================================
-- PROFILES
-- ==========================================
-- Ordinary users can view their own profile. Admins can view all.
CREATE POLICY "Users can view own profile or admins view all" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id OR public.is_admin());

-- Users can insert their profile during Auth signup (Trigger/Supabase handles this, but just in case)
CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- ONLY Admins can UPDATE profiles. Ordinary users MUST use update_my_profile() RPC.
CREATE POLICY "Admins can update all profiles" 
ON public.profiles FOR UPDATE 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

-- ONLY Admins can DELETE profiles.
CREATE POLICY "Admins can delete all profiles" 
ON public.profiles FOR DELETE 
USING (public.is_admin());

-- ==========================================
-- MOCK TESTS & QUESTIONS
-- ==========================================
-- Everyone can read tests.
CREATE POLICY "Anyone can view mock tests" ON public.mock_tests FOR SELECT USING (true);

-- We revoke SELECT on questions for ordinary users so they MUST use the RPC to fetch without answers!
-- Only Admins get direct SELECT access to the questions table (to see correct answers).
CREATE POLICY "Admins can view questions" ON public.questions FOR SELECT USING (public.is_admin());

-- ONLY Admins can insert/update/delete tests and questions.
CREATE POLICY "Admins manage mock tests" ON public.mock_tests FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins manage questions" ON public.questions FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ==========================================
-- TEST SESSIONS & ATTEMPTS
-- ==========================================
-- Users can view their own history. Admins can view all history.
CREATE POLICY "View own sessions" ON public.test_sessions FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "View own attempts" ON public.attempts FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- NO INSERT OR UPDATE policies for users on test_sessions/attempts!
-- They must go through the Node.js backend `/api/submit-exam` (which uses service role key)
CREATE POLICY "Admins manage sessions" ON public.test_sessions FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins manage attempts" ON public.attempts FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ==========================================
-- TRANSACTIONS
-- ==========================================
-- Users view own transactions. Admins view all.
CREATE POLICY "View own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- NO INSERT for ordinary users. Admin handles transactions, or an admin assigns plans manually.
CREATE POLICY "Admins manage transactions" ON public.transactions FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ==========================================
-- BOOKMARKS
-- ==========================================
CREATE POLICY "Manage own bookmarks" ON public.bookmarks FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- ERROR REPORTS & INTEGRITY EVENTS
-- ==========================================
CREATE POLICY "Insert own error reports" ON public.error_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view/manage error reports" ON public.error_reports FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Insert own integrity events" ON public.exam_integrity_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view integrity events" ON public.exam_integrity_events FOR SELECT USING (public.is_admin());

-- ==========================================
-- NOTIFICATIONS
-- ==========================================
CREATE POLICY "View own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Mark own notifications as read" ON public.notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage notifications" ON public.notifications FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
