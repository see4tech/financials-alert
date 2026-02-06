-- Table: user_assets
-- User watchlist: stocks, ETF, commodities, crypto. Used with dashboard indicators for AI recommendations.
CREATE TABLE IF NOT EXISTS public.user_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  asset_type text NOT NULL CHECK (asset_type IN ('stock', 'etf', 'commodity', 'crypto')),
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, symbol, asset_type)
);

CREATE INDEX IF NOT EXISTS idx_user_assets_user_id ON public.user_assets(user_id);

ALTER TABLE public.user_assets ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own assets
CREATE POLICY "Users can select own assets"
  ON public.user_assets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assets"
  ON public.user_assets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own assets"
  ON public.user_assets FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_assets IS 'Per-user watchlist for stocks, ETF, commodities, crypto; used for AI recommendations.';
