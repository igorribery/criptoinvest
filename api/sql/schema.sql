CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  avatar_url TEXT,
  google_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_password_or_google_check'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_password_or_google_check CHECK (
      password_hash IS NOT NULL OR google_id IS NOT NULL
    );
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique ON users(google_id) WHERE google_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS pending_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  verification_code_hash TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_users_email ON pending_users(email);
CREATE INDEX IF NOT EXISTS idx_pending_users_expires_at ON pending_users(expires_at);

CREATE TABLE IF NOT EXISTS pending_email_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_email TEXT UNIQUE NOT NULL,
  verification_code_hash TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_email_changes_user_id
  ON pending_email_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_email_changes_new_email
  ON pending_email_changes(new_email);

CREATE TABLE IF NOT EXISTS pending_password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_password_resets_user_id
  ON pending_password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_password_resets_expires_at
  ON pending_password_resets(expires_at);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_type') THEN
    CREATE TYPE asset_type AS ENUM ('CRYPTO', 'STOCK', 'ETF');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_direction') THEN
    CREATE TYPE alert_direction AS ENUM ('ABOVE', 'BELOW');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_type') THEN
    CREATE TYPE alert_type AS ENUM ('PERIODIC', 'TARGET_ONCE');
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
  side TEXT NOT NULL DEFAULT 'BUY' CHECK (side IN ('BUY', 'SELL')),
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
  alert_type alert_type NOT NULL DEFAULT 'TARGET_ONCE',
  -- TARGET_ONCE: direction + target_price_brl
  direction alert_direction,
  target_price_brl NUMERIC(20,2) CHECK (target_price_brl > 0),
  -- PERIODIC: period_hours (4/12/24)
  period_hours INTEGER CHECK (period_hours IN (4, 12, 24)),
  -- Canais
  notify_email BOOLEAN NOT NULL DEFAULT true,
  notify_sms BOOLEAN NOT NULL DEFAULT false,
  sms_phone_number TEXT,
  -- Preço de ativação (baseline inicial para variação percentual)
  activated_price_brl NUMERIC(20,2) CHECK (activated_price_brl > 0),
  -- TARGET_ONCE: marca quando disparou
  triggered_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_entries_user_id ON portfolio_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_user_id ON price_alerts(user_id);
