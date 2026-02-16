-- eToro integration: user credentials (server-side only) and trading mode preference

-- Table: user_etoro_settings (secrets; never returned to client)
CREATE TABLE IF NOT EXISTS public.user_etoro_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key text NOT NULL,
  user_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_etoro_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own etoro settings"
  ON public.user_etoro_settings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own etoro settings"
  ON public.user_etoro_settings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own etoro settings"
  ON public.user_etoro_settings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.user_etoro_settings IS 'eToro API credentials (x-api-key, x-user-key). Server-side only.';

-- Add trading mode to user_preferences (demo vs real)
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS etoro_trading_mode text NOT NULL DEFAULT 'demo'
  CHECK (etoro_trading_mode IN ('demo', 'real'));

COMMENT ON COLUMN public.user_preferences.etoro_trading_mode IS 'eToro trading account: demo or real.';
