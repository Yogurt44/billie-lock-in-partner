-- Drop the old constraint and add a new one allowing steps 0-7
ALTER TABLE public.billie_users DROP CONSTRAINT IF EXISTS billie_users_onboarding_step_check;
ALTER TABLE public.billie_users ADD CONSTRAINT billie_users_onboarding_step_check CHECK (onboarding_step >= 0 AND onboarding_step <= 7);