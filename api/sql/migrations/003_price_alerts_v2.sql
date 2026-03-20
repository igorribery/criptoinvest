DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_type') THEN
    CREATE TYPE alert_type AS ENUM ('PERIODIC', 'TARGET_ONCE');
  END IF;
END
$$;

ALTER TABLE price_alerts
  ADD COLUMN IF NOT EXISTS alert_type alert_type NOT NULL DEFAULT 'TARGET_ONCE';

ALTER TABLE price_alerts
  ADD COLUMN IF NOT EXISTS direction alert_direction;

ALTER TABLE price_alerts
  ADD COLUMN IF NOT EXISTS target_price_brl NUMERIC(20,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'price_alerts_target_price_positive'
  ) THEN
    ALTER TABLE price_alerts
      ADD CONSTRAINT price_alerts_target_price_positive
      CHECK (target_price_brl IS NULL OR target_price_brl > 0);
  END IF;
END
$$;

ALTER TABLE price_alerts
  ADD COLUMN IF NOT EXISTS period_hours INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'price_alerts_period_hours_allowed'
  ) THEN
    ALTER TABLE price_alerts
      ADD CONSTRAINT price_alerts_period_hours_allowed
      CHECK (period_hours IS NULL OR period_hours IN (4, 12, 24));
  END IF;
END
$$;

ALTER TABLE price_alerts
  ADD COLUMN IF NOT EXISTS notify_email BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE price_alerts
  ADD COLUMN IF NOT EXISTS notify_sms BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE price_alerts
  ADD COLUMN IF NOT EXISTS sms_phone_number TEXT;

ALTER TABLE price_alerts
  ADD COLUMN IF NOT EXISTS activated_price_brl NUMERIC(20,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'price_alerts_activated_price_positive'
  ) THEN
    ALTER TABLE price_alerts
      ADD CONSTRAINT price_alerts_activated_price_positive
      CHECK (activated_price_brl IS NULL OR activated_price_brl > 0);
  END IF;
END
$$;

ALTER TABLE price_alerts
  ADD COLUMN IF NOT EXISTS triggered_at TIMESTAMPTZ;

-- Migração de dados: alerts antigos viram TARGET_ONCE com target_price_brl existente.
UPDATE price_alerts
SET alert_type = 'TARGET_ONCE'
WHERE alert_type IS NULL;

