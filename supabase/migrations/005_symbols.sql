-- Enable trigram extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Table: symbols
-- Cached directory of stocks, ETFs, commodities, and crypto for asset search.
-- Populated by the populate-symbols Netlify function from Twelve Data and CoinGecko.
CREATE TABLE IF NOT EXISTS public.symbols (
  id serial PRIMARY KEY,
  symbol text NOT NULL,
  name text NOT NULL,
  asset_type text NOT NULL CHECK (asset_type IN ('stock', 'etf', 'commodity', 'crypto')),
  exchange text,
  UNIQUE(symbol, asset_type)
);

-- Trigram indexes for fast ILIKE search on symbol and name
CREATE INDEX idx_symbols_symbol_trgm ON public.symbols USING gin (symbol gin_trgm_ops);
CREATE INDEX idx_symbols_name_trgm ON public.symbols USING gin (name gin_trgm_ops);

-- No RLS needed for public reference data, but enable with a permissive read policy
ALTER TABLE public.symbols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON public.symbols FOR SELECT USING (true);

-- Smart search function with relevance ranking
CREATE OR REPLACE FUNCTION search_symbols(q text, lim int DEFAULT 20)
RETURNS TABLE(symbol text, name text, asset_type text, exchange text) AS $$
BEGIN
  RETURN QUERY
  SELECT s.symbol, s.name, s.asset_type, s.exchange
  FROM public.symbols s
  WHERE s.symbol ILIKE '%' || q || '%' OR s.name ILIKE '%' || q || '%'
  ORDER BY
    CASE
      WHEN lower(s.symbol) = lower(q) THEN 0
      WHEN lower(s.symbol) LIKE lower(q) || '%' THEN 1
      WHEN lower(s.name) LIKE lower(q) || '%' THEN 2
      ELSE 3
    END,
    s.symbol
  LIMIT lim;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON TABLE public.symbols IS 'Cached directory of financial symbols (stocks, ETFs, commodities, crypto). Populated from Twelve Data and CoinGecko APIs.';
