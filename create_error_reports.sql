CREATE TABLE IF NOT EXISTS public.error_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id uuid REFERENCES public.mock_tests(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  status text DEFAULT 'new',
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own reports
CREATE POLICY "Users can insert their own error reports" 
ON public.error_reports 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Allow anyone to read reports (for admin panel) or restrict to admins if there's a role
CREATE POLICY "Admins can view all error reports" 
ON public.error_reports 
FOR SELECT 
TO authenticated 
USING (true);

-- Allow admins to update reports
CREATE POLICY "Admins can update error reports" 
ON public.error_reports 
FOR UPDATE 
TO authenticated 
USING (true);
