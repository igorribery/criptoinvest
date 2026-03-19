-- Relaxa constraints/NOT NULL do schema antigo para permitir alertas PERIODIC.
-- A tabela original tinha direction/target_price_brl/frequency NOT NULL.

ALTER TABLE price_alerts
  ALTER COLUMN direction DROP NOT NULL;

ALTER TABLE price_alerts
  ALTER COLUMN target_price_brl DROP NOT NULL;

-- Coluna legada (do schema antigo). Mantemos por compatibilidade, mas não usamos mais.
ALTER TABLE price_alerts
  ALTER COLUMN frequency DROP NOT NULL;

