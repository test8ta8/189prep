-- Ushbu skript test_sessions jadvali uchun RLS ruxsatlarini to'g'rilaydi.
-- Buni Supabase SQL Editor orqali ishga tushiring.

-- 1. Insert qilish ruxsati: Foydalanuvchilar o'z natijalarini saqlay olishi uchun
CREATE POLICY "Users can insert their own test sessions" 
ON test_sessions FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- 2. Select qilish ruxsati: Foydalanuvchilar o'z natijalarini ko'ra olishi uchun
CREATE POLICY "Users can select their own test sessions" 
ON test_sessions FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- (Ixtiyoriy) Adminlar hamma natijalarni ko'ra olishi uchun, agar kerak bo'lsa
-- CREATE POLICY "Admin can view all test sessions"
-- ON test_sessions FOR SELECT
-- TO authenticated
-- USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );
