-- Fix Admin RLS for questions table
-- Sometimes SECURITY DEFINER functions in RLS policies can have context issues.
-- This explicit policy uses a direct subquery which always works within the user's context.

DROP POLICY IF EXISTS "Admins can view questions" ON public.questions;
DROP POLICY IF EXISTS "Admins manage questions" ON public.questions;
DROP POLICY IF EXISTS "Admins view questions alternative" ON public.questions;

CREATE POLICY "Admins can view questions" ON public.questions 
FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins manage questions" ON public.questions 
FOR ALL 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
) 
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
