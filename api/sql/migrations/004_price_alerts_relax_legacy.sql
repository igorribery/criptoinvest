-- Relaxa constraints/NOT NULL do schema antigo para permitir alertas PERIODIC.
-- A tabela original tinha direction/target_price_brl/frequency NOT NULL.

ALTER TABLE price_alerts
  ALTER COLUMN direction DROP NOT NULL;

ALTER TABLE price_alerts
  ALTER COLUMN target_price_brl DROP NOT NULL;

-- Coluna legada (do schema antigo). Mantemos por compatibilidade, mas não usamos mais.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'price_alerts'
      AND column_name = 'frequency'
  ) THEN
    ALTER TABLE price_alerts
      ALTER COLUMN frequency DROP NOT NULL;
  END IF;
END
$$;

