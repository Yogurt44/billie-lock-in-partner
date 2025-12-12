-- Add restrictive RLS policy to email_otp_codes table to prevent unauthorized access
-- The send-otp edge function uses service role key and will bypass RLS
CREATE POLICY "Deny all client access" ON public.email_otp_codes
FOR ALL USING (false) WITH CHECK (false);