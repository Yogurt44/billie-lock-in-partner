-- Add email column to billie_users for verified users
ALTER TABLE public.billie_users 
ADD COLUMN IF NOT EXISTS email text UNIQUE;

-- Create index for email lookup
CREATE INDEX IF NOT EXISTS idx_billie_users_email ON public.billie_users(email);