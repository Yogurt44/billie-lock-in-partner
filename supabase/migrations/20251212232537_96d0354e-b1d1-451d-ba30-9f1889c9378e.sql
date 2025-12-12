-- Add columns to track notification state for smart check-ins
ALTER TABLE public.billie_users 
ADD COLUMN IF NOT EXISTS last_notification_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS awaiting_response BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS morning_check_in_time TEXT DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS midday_check_in_time TEXT DEFAULT '14:00',
ADD COLUMN IF NOT EXISTS evening_check_in_time TEXT DEFAULT '20:00',
ADD COLUMN IF NOT EXISTS check_in_frequency TEXT DEFAULT 'thrice'; -- 'once', 'twice', 'thrice'