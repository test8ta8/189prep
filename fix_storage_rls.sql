-- 1. Avval eski xato siyosatlar (agar bo'lsa) xalaqit bermasligi uchun tekshiramiz yoki to'g'ridan-to'g'ri yangisini qo'shamiz
CREATE POLICY "Allow authenticated users to upload files" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'question-images');

CREATE POLICY "Allow authenticated users to update files" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'question-images');

CREATE POLICY "Allow anyone to read files" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'question-images');
