-- Add streak tracking columns
ALTER TABLE public.billie_users 
ADD COLUMN current_streak integer NOT NULL DEFAULT 0,
ADD COLUMN longest_streak integer NOT NULL DEFAULT 0,
ADD COLUMN last_check_in_date date;

-- Add scheduling columns
ALTER TABLE public.billie_users 
ADD COLUMN preferred_check_in_time time DEFAULT '09:00:00',
ADD COLUMN timezone text DEFAULT 'America/New_York';

-- Add index for efficient cron queries (find users due for check-in)
CREATE INDEX idx_billie_users_check_in_time ON public.billie_users(preferred_check_in_time, timezone);