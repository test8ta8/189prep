-- Eslatmalar (Notes) funksiyasi uchun bazaga o'zgartirishlar kiritish

-- 1. `bookmarks` jadvaliga yangi `note_text` (matn) ustunini qo'shish
ALTER TABLE public.bookmarks ADD COLUMN IF NOT EXISTS note_text TEXT;

-- 2. Foydalanuvchi faqat o'zining eslatmalarini tahrirlashi uchun RLS (Row Level Security) qoidasini yaratish
-- Diqqat: Insert, Select va Delete qoidalari oldin yaratilgan deb hisoblaymiz, faqat UPDATE qoidasi qo'shilmoqda.
CREATE POLICY "Users can update their own bookmarks" 
ON public.bookmarks 
FOR UPDATE 
USING (user_id = auth.uid());
