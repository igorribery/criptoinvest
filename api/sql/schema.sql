CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_type') THEN
    CREATE TYPE asset_type AS ENUM ('CRYPTO', 'STOCK', 'ETF');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_direction') THEN
    CREATE TYPE alert_direction AS ENUM ('ABOVE', 'BELOW');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS portfolio_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_type asset_type NOT NULL DEFAULT 'CRYPTO',
  symbol TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  purchase_date DATE NOT NULL,
  quantity NUMERIC(20,8) NOT NULL CHECK (quantity > 0),
  unit_price_brl NUMERIC(20,2) NOT NULL CHECK (unit_price_brl > 0),
  other_costs_brl NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (other_costs_brl >= 0),
  total_value_brl NUMERIC(20,2) NOT NULL CHECK (total_value_brl > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  direction alert_direction NOT NULL,
  target_price_brl NUMERIC(20,2) NOT NULL CHECK (target_price_brl > 0),
  frequency TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_entries_user_id ON portfolio_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_user_id ON price_alerts(user_id);
