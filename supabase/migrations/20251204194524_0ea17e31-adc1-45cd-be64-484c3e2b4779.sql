-- Create conversation history table
CREATE TABLE public.billie_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.billie_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'billie')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups by user
CREATE INDEX idx_billie_messages_user_id ON public.billie_messages(user_id);
CREATE INDEX idx_billie_messages_created_at ON public.billie_messages(created_at);

-- Enable RLS
ALTER TABLE public.billie_messages ENABLE ROW LEVEL SECURITY;

-- Service role full access (for edge function)
CREATE POLICY "Service role full access"
ON public.billie_messages
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);