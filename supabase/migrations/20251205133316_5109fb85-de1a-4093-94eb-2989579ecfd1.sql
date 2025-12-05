-- Add RLS policies to deny authenticated user access to sensitive PII tables
-- Edge functions using service role key will still have full access

-- Deny authenticated access to billie_users
CREATE POLICY "Deny authenticated access" ON public.billie_users
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

-- Deny authenticated access to billie_messages  
CREATE POLICY "Deny authenticated access" ON public.billie_messages
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);