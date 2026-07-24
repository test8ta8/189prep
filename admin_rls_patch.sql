-- 1. Create a secure function to check admin role without infinite loops
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
DECLARE
  is_adm boolean;
BEGIN
  SELECT role = 'admin' INTO is_adm
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN coalesce(is_adm, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Grant Admins FULL access to all important tables
CREATE POLICY "Admins can do everything on profiles" ON public.profiles FOR ALL USING (public.is_admin());
CREATE POLICY "Admins can do everything on mock_tests" ON public.mock_tests FOR ALL USING (public.is_admin());
CREATE POLICY "Admins can do everything on test_sessions" ON public.test_sessions FOR ALL USING (public.is_admin());
CREATE POLICY "Admins can do everything on attempts" ON public.attempts FOR ALL USING (public.is_admin());
CREATE POLICY "Admins can do everything on transactions" ON public.transactions FOR ALL USING (public.is_admin());
CREATE POLICY "Admins can do everything on error_reports" ON public.error_reports FOR ALL USING (public.is_admin());
CREATE POLICY "Admins can do everything on exam_integrity_events" ON public.exam_integrity_events FOR ALL USING (public.is_admin());
