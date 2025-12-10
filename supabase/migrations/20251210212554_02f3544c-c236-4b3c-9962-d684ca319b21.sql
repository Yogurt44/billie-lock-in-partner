-- Fix RLS policies: RESTRICTIVE policies don't block access without PERMISSIVE policies
-- Replace with PERMISSIVE policies that explicitly deny all access
-- Edge functions use service_role_key which bypasses RLS

-- Drop existing RESTRICTIVE policies for billie_users
DROP POLICY IF EXISTS "Deny anon access" ON public.billie_users;
DROP POLICY IF EXISTS "Deny authenticated access" ON public.billie_users;

-- Drop existing RESTRICTIVE policies for billie_messages
DROP POLICY IF EXISTS "Deny anon access" ON public.billie_messages;
DROP POLICY IF EXISTS "Deny authenticated access" ON public.billie_messages;

-- Drop existing RESTRICTIVE policies for billie_goals
DROP POLICY IF EXISTS "Deny anon access" ON public.billie_goals;
DROP POLICY IF EXISTS "Deny authenticated access" ON public.billie_goals;

-- Drop existing RESTRICTIVE policies for billie_photo_proofs
DROP POLICY IF EXISTS "Deny anon access" ON public.billie_photo_proofs;
DROP POLICY IF EXISTS "Deny authenticated access" ON public.billie_photo_proofs;

-- Create PERMISSIVE policies that deny all client access
-- These use (SELECT false) pattern which is more explicit than just false

-- billie_users: Contains PII (phone, stripe_customer_id, push_token)
CREATE POLICY "Deny all client access"
ON public.billie_users
FOR ALL
TO anon, authenticated
USING ((SELECT false))
WITH CHECK ((SELECT false));

-- billie_messages: Contains conversation history
CREATE POLICY "Deny all client access"
ON public.billie_messages
FOR ALL
TO anon, authenticated
USING ((SELECT false))
WITH CHECK ((SELECT false));

-- billie_goals: Contains user goals
CREATE POLICY "Deny all client access"
ON public.billie_goals
FOR ALL
TO anon, authenticated
USING ((SELECT false))
WITH CHECK ((SELECT false));

-- billie_photo_proofs: Contains photo proof references
CREATE POLICY "Deny all client access"
ON public.billie_photo_proofs
FOR ALL
TO anon, authenticated
USING ((SELECT false))
WITH CHECK ((SELECT false));