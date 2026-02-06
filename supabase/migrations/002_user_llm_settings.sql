-- Table: user_llm_settings
-- Stores per-user LLM provider choice and API key (backend reads with service role; client never sees key).
CREATE TABLE IF NOT EXISTS public.user_llm_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('openai', 'claude', 'gemini')),
  api_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: enable
ALTER TABLE public.user_llm_settings ENABLE ROW LEVEL SECURITY;

-- Policy: users can only INSERT their own row (user_id = auth.uid())
CREATE POLICY "Users can insert own llm settings"
  ON public.user_llm_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: users can only UPDATE their own row
CREATE POLICY "Users can update own llm settings"
  ON public.user_llm_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- No SELECT policy for authenticated: client cannot read api_key.
-- Backend uses service_role which bypasses RLS to read provider + api_key.

COMMENT ON TABLE public.user_llm_settings IS 'Per-user LLM provider (openai/claude/gemini) and API key; read only via backend with service role.';
