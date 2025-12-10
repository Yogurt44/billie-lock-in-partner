-- Add push_token column for device push notifications
ALTER TABLE public.billie_users 
ADD COLUMN IF NOT EXISTS push_token TEXT;