-- Fix billie_users: Drop overly permissive policy and deny anon access
DROP POLICY IF EXISTS "Service role full access" ON billie_users;

-- Deny all access for anonymous users (service role bypasses RLS automatically)
CREATE POLICY "Deny anon access" ON billie_users
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

-- Fix billie_messages: Drop overly permissive policy and deny anon access  
DROP POLICY IF EXISTS "Service role full access" ON billie_messages;

-- Deny all access for anonymous users (service role bypasses RLS automatically)
CREATE POLICY "Deny anon access" ON billie_messages
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);