-- Market Health Checklist: initial schema (Supabase / plain Postgres)
-- Run in Supabase SQL Editor or: psql $DATABASE_URL -f 001_initial_schema.sql

-- users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'America/Santo_Domingo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- indicators (metadata; seeded from registry)
CREATE TABLE IF NOT EXISTS indicators (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  poll_interval_sec INT NOT NULL DEFAULT 3600,
  enabled BOOLEAN NOT NULL DEFAULT true
);

-- indicator_points_raw (PK includes ts for compatibility)
CREATE TABLE IF NOT EXISTS indicator_points_raw (
  id UUID DEFAULT gen_random_uuid(),
  indicator_key TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  value DECIMAL(20, 8) NOT NULL,
  source TEXT NOT NULL DEFAULT 'unknown',
  raw_json JSONB,
  PRIMARY KEY (id, ts)
);
CREATE INDEX IF NOT EXISTS idx_indicator_points_raw_key_ts ON indicator_points_raw (indicator_key, ts DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_indicator_points_raw_key_ts ON indicator_points_raw (indicator_key, ts);

-- indicator_points
CREATE TABLE IF NOT EXISTS indicator_points (
  id UUID DEFAULT gen_random_uuid(),
  indicator_key TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  value DECIMAL(20, 8) NOT NULL,
  granularity TEXT NOT NULL,
  quality_flag TEXT NOT NULL DEFAULT 'ok',
  PRIMARY KEY (id, ts)
);
CREATE INDEX IF NOT EXISTS idx_indicator_points_key_ts ON indicator_points (indicator_key, ts DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_indicator_points_key_ts ON indicator_points (indicator_key, ts);

-- derived_metrics
CREATE TABLE IF NOT EXISTS derived_metrics (
  id UUID DEFAULT gen_random_uuid(),
  indicator_key TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  pct_1d DECIMAL(20, 8),
  pct_7d DECIMAL(20, 8),
  pct_14d DECIMAL(20, 8),
  pct_21d DECIMAL(20, 8),
  slope_14d DECIMAL(20, 10),
  slope_21d DECIMAL(20, 10),
  ma_21d DECIMAL(20, 8),
  PRIMARY KEY (id, ts)
);
CREATE INDEX IF NOT EXISTS idx_derived_metrics_key_ts ON derived_metrics (indicator_key, ts DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_derived_metrics_key_ts ON derived_metrics (indicator_key, ts);

-- status_snapshots
CREATE TABLE IF NOT EXISTS status_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ NOT NULL,
  indicator_key TEXT NOT NULL,
  status TEXT NOT NULL,
  trend TEXT NOT NULL,
  explanation TEXT,
  meta JSONB
);
CREATE INDEX IF NOT EXISTS idx_status_snapshots_key_ts ON status_snapshots (indicator_key, ts DESC);

-- weekly_scores
CREATE TABLE IF NOT EXISTS weekly_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL,
  user_id UUID REFERENCES users(id),
  score INT NOT NULL,
  delta_score INT,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_weekly_scores_week ON weekly_scores (week_start_date DESC);

-- alert_rules
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  json_rule JSONB NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true
);

-- alerts_fired
CREATE TABLE IF NOT EXISTS alerts_fired (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL,
  payload JSONB,
  dedupe_key TEXT
);
CREATE INDEX IF NOT EXISTS idx_alerts_fired_rule_ts ON alerts_fired (rule_id, ts DESC);

-- notification_deliveries
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES alerts_fired(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_msg_id TEXT,
  ts TIMESTAMPTZ NOT NULL
);

-- Seed indicator rows (keys only; full config in registry)
INSERT INTO indicators (key, name, category, unit, poll_interval_sec, enabled) VALUES
  ('macro.us10y', 'US 10Y Yield', 'macro', '%', 3600, true),
  ('macro.dxy', 'DXY', 'macro', 'index', 3600, true),
  ('eq.nasdaq', 'Nasdaq', 'equities', 'index', 900, true),
  ('eq.leaders', 'Mega-cap Leaders', 'equities', 'score', 900, true),
  ('crypto.btc', 'BTC Spot', 'crypto', 'USD', 300, true),
  ('sent.fng', 'Fear & Greed', 'sentiment', 'index', 3600, true),
  ('crypto.etf_flows', 'ETF Flows', 'crypto', 'USD', 86400, false),
  ('crypto.liquidations', 'Liquidations', 'crypto', 'USD', 900, false),
  ('crypto.oi', 'Open Interest', 'crypto', 'USD', 900, false)
ON CONFLICT (key) DO NOTHING;
