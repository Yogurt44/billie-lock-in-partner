-- Create goals table for goal-specific check-ins
CREATE TABLE public.billie_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.billie_users(id) ON DELETE CASCADE,
  goal_number INTEGER NOT NULL,
  goal_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_check_in_date DATE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, goal_number)
);

-- Enable RLS
ALTER TABLE public.billie_goals ENABLE ROW LEVEL SECURITY;

-- Deny direct access (service role only via edge functions)
CREATE POLICY "Deny anon access" ON public.billie_goals AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny authenticated access" ON public.billie_goals AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Create storage bucket for photo proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('photo-proofs', 'photo-proofs', false);

-- Storage policy: Only service role can access (edge functions handle uploads)
CREATE POLICY "Service role only for photo proofs" ON storage.objects FOR ALL USING (bucket_id = 'photo-proofs' AND auth.role() = 'service_role');

-- Create photo proofs tracking table
CREATE TABLE public.billie_photo_proofs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.billie_users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.billie_goals(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  check_in_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Enable RLS for photo proofs
ALTER TABLE public.billie_photo_proofs ENABLE ROW LEVEL SECURITY;

-- Deny direct access (service role only)
CREATE POLICY "Deny anon access" ON public.billie_photo_proofs AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny authenticated access" ON public.billie_photo_proofs AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);