-- Add theme preference column to user_preferences
-- Allowed values: 'light', 'dark', 'system' (follows OS preference)
-- Default: 'system'
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'system'
  CHECK (theme IN ('light', 'dark', 'system'));

COMMENT ON COLUMN public.user_preferences.theme IS 'UI theme preference: light, dark, or system (follows OS).';
