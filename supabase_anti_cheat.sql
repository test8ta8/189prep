-- Run this snippet in your Supabase SQL Editor to create the Anti-Cheat tracking table

CREATE TABLE IF NOT EXISTS public.exam_integrity_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    test_id UUID REFERENCES public.mock_tests(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- e.g., 'tab_switch', 'window_blur'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.exam_integrity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own integrity events"
    ON public.exam_integrity_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all integrity events"
    ON public.exam_integrity_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );
