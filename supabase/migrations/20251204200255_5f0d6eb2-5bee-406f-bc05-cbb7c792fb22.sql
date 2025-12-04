-- Add subscription tracking to billie_users
ALTER TABLE public.billie_users 
ADD COLUMN subscription_status text DEFAULT 'none',
ADD COLUMN stripe_customer_id text,
ADD COLUMN subscription_end timestamp with time zone;