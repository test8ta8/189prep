-- Eski qoidalarni (agar bo'lsa) tozalash (xato bermasligi uchun)
DROP POLICY IF EXISTS "Foydalanuvchilar o'z xabarlarini ko'rishi mumkin" ON public.notifications;
DROP POLICY IF EXISTS "Foydalanuvchilar o'z xabarlarini o'zgartirishi mumkin" ON public.notifications;
DROP POLICY IF EXISTS "Adminlar xabar yuborishi mumkin" ON public.notifications;

-- 1. Foydalanuvchilar faqat o'ziga kelgan xabarlarni o'qishi mumkin
CREATE POLICY "Foydalanuvchilar o'z xabarlarini ko'rishi mumkin"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

-- 2. Foydalanuvchilar o'z xabarlarini o'qilgan qilib belgilashi mumkin (UPDATE)
CREATE POLICY "Foydalanuvchilar o'z xabarlarini o'zgartirishi mumkin"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

-- 3. Faqat ADMINlar yangi xabarnoma yarata oladi (INSERT)
CREATE POLICY "Adminlar xabar yuborishi mumkin"
ON public.notifications FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);
