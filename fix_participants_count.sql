CREATE OR REPLACE VIEW public.mock_tests_with_unique_users WITH (security_invoker = false) AS
SELECT 
  t.id AS test_id,
  COUNT(DISTINCT s.user_id) AS unique_users_count
FROM mock_tests t
LEFT JOIN test_sessions s ON t.id = s.test_id
GROUP BY t.id;

GRANT SELECT ON public.mock_tests_with_unique_users TO anon, authenticated;