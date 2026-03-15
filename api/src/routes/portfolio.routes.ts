import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { isNonNegativeNumber, isPositiveNumber } from "../utils/validators.js";

const ALLOWED_ASSET_TYPES = ["CRYPTO", "STOCK", "ETF"] as const;

export const portfolioRouter = Router();

portfolioRouter.use(requireAuth);

portfolioRouter.post("/entries", async (req, res) => {
  const {
    assetType,
    symbol,
    assetName,
    purchaseDate,
    quantity,
    unitPriceBrl,
    otherCostsBrl,
    totalValueBrl,
  } = req.body as {
    assetType?: string;
    symbol?: string;
    assetName?: string;
    purchaseDate?: string;
    quantity?: number;
    unitPriceBrl?: number;
    otherCostsBrl?: number;
    totalValueBrl?: number;
  };

  if (!assetType || !symbol || !assetName || !purchaseDate) {
    return res.status(400).json({ message: "assetType, symbol, assetName e purchaseDate são obrigatórios." });
  }

  if (!ALLOWED_ASSET_TYPES.includes(assetType as (typeof ALLOWED_ASSET_TYPES)[number])) {
    return res.status(400).json({ message: `assetType inválido. Use: ${ALLOWED_ASSET_TYPES.join(", ")}.` });
  }

  if (!isPositiveNumber(quantity) || !isPositiveNumber(unitPriceBrl)) {
    return res.status(400).json({ message: "quantity e unitPriceBrl devem ser maiores que zero." });
  }

  const otherCosts = otherCostsBrl ?? 0;
  if (!isNonNegativeNumber(otherCosts)) {
    return res.status(400).json({ message: "otherCostsBrl deve ser igual ou maior que zero." });
  }

  const computedTotal = Number((quantity * unitPriceBrl + otherCosts).toFixed(2));
  const finalTotal = totalValueBrl ?? computedTotal;

  const created = await pool.query(
    `INSERT INTO portfolio_entries
      (user_id, asset_type, symbol, asset_name, purchase_date, quantity, unit_price_brl, other_costs_brl, total_value_brl)
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      req.authUser!.id,
      assetType,
      symbol.toUpperCase(),
      assetName,
      purchaseDate,
      quantity,
      unitPriceBrl,
      otherCosts,
      finalTotal,
    ],
  );

  return res.status(201).json({ entry: created.rows[0] });
});

portfolioRouter.get("/entries", async (req, res) => {
  const result = await pool.query(
    `SELECT *
      FROM portfolio_entries
      WHERE user_id = $1
      ORDER BY purchase_date DESC, created_at DESC`,
    [req.authUser!.id],
  );

  return res.json({ items: result.rows });
});

portfolioRouter.get("/summary", async (req, res) => {
  const byAsset = await pool.query(
    `SELECT
      asset_type,
      symbol,
      asset_name,
      SUM(quantity)::numeric(20,8) AS total_quantity,
      SUM(total_value_brl)::numeric(20,2) AS total_invested_brl,
      CASE WHEN SUM(quantity) = 0 THEN 0
        ELSE (SUM(total_value_brl) / SUM(quantity))::numeric(20,2)
      END AS average_price_brl
     FROM portfolio_entries
     WHERE user_id = $1
     GROUP BY asset_type, symbol, asset_name
     ORDER BY asset_type, symbol`,
    [req.authUser!.id],
  );

  const total = await pool.query(
    `SELECT COALESCE(SUM(total_value_brl), 0)::numeric(20,2) AS total_invested_brl
     FROM portfolio_entries
     WHERE user_id = $1`,
    [req.authUser!.id],
  );

  return res.json({
    totalInvestedBrl: total.rows[0]?.total_invested_brl ?? 0,
    assets: byAsset.rows,
  });
});

portfolioRouter.delete("/entries/:id", async (req, res) => {
  const deleted = await pool.query(
    "DELETE FROM portfolio_entries WHERE id = $1 AND user_id = $2 RETURNING id",
    [req.params.id, req.authUser!.id],
  );

  if (!deleted.rowCount) {
    return res.status(404).json({ message: "Lançamento não encontrado." });
  }

  return res.status(204).send();
});
