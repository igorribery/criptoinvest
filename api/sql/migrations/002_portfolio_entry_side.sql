-- Lançamentos: compra (BUY) ou venda (SELL). Rodar após schema inicial.
ALTER TABLE portfolio_entries
  ADD COLUMN IF NOT EXISTS side TEXT NOT NULL DEFAULT 'BUY';

ALTER TABLE portfolio_entries
  DROP CONSTRAINT IF EXISTS portfolio_entries_side_check;

ALTER TABLE portfolio_entries
  ADD CONSTRAINT portfolio_entries_side_check CHECK (side IN ('BUY', 'SELL'));
