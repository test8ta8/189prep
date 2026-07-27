CREATE TABLE IF NOT EXISTS public.login_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    email text,
    ip_address text,
    device_info text,
    country text,
    status text, -- 'success', 'failed'
    failed_reason text,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage login logs" ON public.login_logs FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.ip_blacklist (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address text UNIQUE NOT NULL,
    reason text,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz
);
ALTER TABLE public.ip_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_blacklist FORCE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage ip blacklist" ON public.ip_blacklist FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Public read ip blacklist" ON public.ip_blacklist FOR SELECT USING (true);

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'admin_audit_logs' AND column_name = 'ip_address') THEN 
        ALTER TABLE public.admin_audit_logs ADD COLUMN ip_address text;
    END IF; 
END $$;
