-- Drop the existing check constraint on onboarding_step
ALTER TABLE public.billie_users DROP CONSTRAINT IF EXISTS billie_users_onboarding_step_check;

-- Add new constraint allowing steps 0-8 (0-7 onboarding + 8 for completed/post-onboarding)
ALTER TABLE public.billie_users ADD CONSTRAINT billie_users_onboarding_step_check CHECK (onboarding_step >= 0 AND onboarding_step <= 10);