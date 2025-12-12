-- Fix the OTP codes RLS policy to target correct roles
DROP POLICY IF EXISTS "Deny all client access" ON public.email_otp_codes;

CREATE POLICY "Deny all client access" ON public.email_otp_codes
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);