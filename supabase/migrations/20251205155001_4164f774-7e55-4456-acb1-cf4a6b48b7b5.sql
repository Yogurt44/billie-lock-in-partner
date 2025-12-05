-- Drop the old constraint that only allows steps 0-2
ALTER TABLE public.billie_users DROP CONSTRAINT billie_users_onboarding_step_check;

-- Add new constraint allowing steps 0-5 (full 6-step onboarding flow)
ALTER TABLE public.billie_users ADD CONSTRAINT billie_users_onboarding_step_check 
CHECK (onboarding_step >= 0 AND onboarding_step <= 5);