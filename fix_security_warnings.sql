-- 1. Xabarnomalar (notifications) jadvali uchun RLS ni yoqish
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 2. mock_tests_with_unique_users view'sini xavfsizlik talablariga moslash (Security Invoker)
CREATE OR REPLACE VIEW public.mock_tests_with_unique_users WITH (security_invoker = true) AS
SELECT 
  t.id AS test_id,
  COUNT(DISTINCT s.user_id) AS unique_users_count
FROM mock_tests t
LEFT JOIN test_sessions s ON t.id = s.test_id
GROUP BY t.id;

-- 3. Ruxsatlarni berish (hamma o'qiy olishi uchun)
GRANT SELECT ON public.mock_tests_with_unique_users TO anon, authenticated;
