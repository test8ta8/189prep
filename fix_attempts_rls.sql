-- Enable RLS if not enabled
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid errors)
DROP POLICY IF EXISTS "Users can insert their own attempts" ON public.attempts;
DROP POLICY IF EXISTS "Users can view their own attempts" ON public.attempts;
DROP POLICY IF EXISTS "Users can update their own attempts" ON public.attempts;

-- Create policies
CREATE POLICY "Users can insert their own attempts" ON public.attempts
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own attempts" ON public.attempts
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own attempts" ON public.attempts
FOR UPDATE USING (auth.uid() = user_id);
