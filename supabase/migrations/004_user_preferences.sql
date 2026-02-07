-- Table: user_preferences
-- Stores per-user preferences (locale, etc.). Separate from LLM settings so users can set
-- preferences without needing an API key.
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'es')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: enable
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: users can read their own preferences
CREATE POLICY "Users can select own preferences"
  ON public.user_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: users can insert their own preferences
CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: users can update their own preferences
CREATE POLICY "Users can update own preferences"
  ON public.user_preferences
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.user_preferences IS 'Per-user preferences: locale and future settings. Readable by the user directly.';
