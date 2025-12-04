-- Create table for BILLIE users (identified by phone number)
CREATE TABLE public.billie_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  goals TEXT,
  onboarding_step INTEGER NOT NULL DEFAULT 0 CHECK (onboarding_step >= 0 AND onboarding_step <= 2),
  awaiting_check_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.billie_users ENABLE ROW LEVEL SECURITY;

-- Policy: Edge functions can manage all users (using service role)
-- No user-facing policies needed since this is SMS-only (no auth)
CREATE POLICY "Service role full access" 
ON public.billie_users 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_billie_users_updated_at
BEFORE UPDATE ON public.billie_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();