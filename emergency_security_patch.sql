-- ==============================================================================
-- 🚨 EMERGENCY SECURITY PATCH 🚨
-- Run this in your Supabase Dashboard SQL Editor IMMEDIATELY to lock out the hacker.
-- ==============================================================================

-- 1. Enable RLS on all known tables to instantly block unauthorized access
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mock_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.test_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.error_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_integrity_events ENABLE ROW LEVEL SECURITY;

-- 2. Drop any potentially insecure public policies that might exist
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- ==============================================================================
-- 3. Create Secure Policies safely (only if table exists)
-- ==============================================================================

DO $$
BEGIN
    -- PROFILES
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
        CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
        CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;

    -- MOCK TESTS & QUESTIONS (Read-only)
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mock_tests') THEN
        CREATE POLICY "Anyone can view mock tests" ON public.mock_tests FOR SELECT USING (true);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'questions') THEN
        CREATE POLICY "Anyone can view questions" ON public.questions FOR SELECT USING (true);
    END IF;

    -- TEST SESSIONS
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'test_sessions') THEN
        CREATE POLICY "Users can view own sessions" ON public.test_sessions FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users can insert own sessions" ON public.test_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can update own sessions" ON public.test_sessions FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    -- ATTEMPTS
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'attempts') THEN
        CREATE POLICY "Users can view own attempts" ON public.attempts FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users can insert own attempts" ON public.attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    -- BOOKMARKS
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bookmarks') THEN
        CREATE POLICY "Users can manage own bookmarks" ON public.bookmarks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;

    -- TRANSACTIONS
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transactions') THEN
        CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    -- ERROR REPORTS / ANTI-CHEAT
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'error_reports') THEN
        CREATE POLICY "Users can insert error reports" ON public.error_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'exam_integrity_events') THEN
        CREATE POLICY "Users can insert integrity events" ON public.exam_integrity_events FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;
