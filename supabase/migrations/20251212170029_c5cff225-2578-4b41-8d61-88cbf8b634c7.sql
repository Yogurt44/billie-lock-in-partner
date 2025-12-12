-- Create table for storing OTP codes
CREATE TABLE public.email_otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_otp_codes ENABLE ROW LEVEL SECURITY;

-- No select/insert policies for users - only service role can access
-- This keeps the codes secure

-- Create index for faster lookups
CREATE INDEX idx_email_otp_codes_email ON public.email_otp_codes(email);
CREATE INDEX idx_email_otp_codes_expires_at ON public.email_otp_codes(expires_at);