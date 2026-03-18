import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { isNonNegativeNumber, isPositiveNumber } from "../utils/validators.js";
import {
  CreatePortfolioEntryType,
  ALLOWED_ASSET_TYPES,
  PortfolioSide,
} from "../types/portfolio-types.js";

export const portfolioRouter = Router();

portfolioRouter.use(requireAuth);

function normalizeSide(value: unknown): PortfolioSide {
  return value === "SELL" ? "SELL" : "BUY";
}

async function getNetQuantityForSymbol(params: {
  userId: string;
  symbol: string;
  excludeEntryId?: string;
}): Promise<number> {
  const { userId, symbol, excludeEntryId } = params;
  const result = await pool.query(
    `SELECT
      COALESCE(SUM(CASE WHEN side = 'BUY' THEN quantity::numeric ELSE 0 END), 0) AS buy_qty,
      COALESCE(SUM(CASE WHEN side = 'SELL' THEN quantity::numeric ELSE 0 END), 0) AS sell_qty
     FROM portfolio_entries
     WHERE user_id = $1
       AND symbol = $2
       AND ($3::uuid IS NULL OR id <> $3::uuid)`,
    [userId, symbol.toUpperCase().trim(), excludeEntryId ?? null],
  );
  const buy = Number(result.rows[0]?.buy_qty ?? 0);
  const sell = Number(result.rows[0]?.sell_qty ?? 0);
  if (!Number.isFinite(buy) || !Number.isFinite(sell)) return 0;
  return buy - sell;
}

function formatCryptoQty(value: number, decimals = 6) {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(decimals);
}

portfolioRouter.post("/entries", async (req, res) => {
  const {
    assetType,
    symbol,
    assetName,
    purchaseDate,
    side: sideRaw,
    quantity,
    unitPriceBrl,
    otherCostsBrl,
    totalValueBrl,
  } = req.body as CreatePortfolioEntryType;

  const side = normalizeSide(sideRaw);

  if (!assetType || !symbol || !assetName || !purchaseDate) {
    return res
      .status(400)
      .json({ message: "assetType, symbol, assetName e purchaseDate são obrigatórios." });
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

  const normalizedSymbol = symbol.toUpperCase().trim();
  if (side === "SELL") {
    const netQty = await getNetQuantityForSymbol({
      userId: req.authUser!.id,
      symbol: normalizedSymbol,
    });
    if (quantity > netQty + 1e-12) {
      return res.status(400).json({
        message: `Saldo insuficiente para vender ${quantity}. Você tem ${formatCryptoQty(netQty, 6)} de ${normalizedSymbol}.`,
      });
    }
  }

  const gross = quantity * unitPriceBrl;
  let computedTotal: number;
  if (side === "BUY") {
    computedTotal = Number((gross + otherCosts).toFixed(2));
  } else {
    computedTotal = Number((gross - otherCosts).toFixed(2));
    if (computedTotal <= 0) {
      return res.status(400).json({
        message:
          "Na venda, o valor líquido (quantidade × preço − outros custos) precisa ser maior que zero.",
      });
    }
  }

  const finalTotal = totalValueBrl ?? computedTotal;
  if (!isPositiveNumber(finalTotal)) {
    return res.status(400).json({ message: "totalValueBrl inválido." });
  }

  const created = await pool.query(
    `INSERT INTO portfolio_entries
      (user_id, asset_type, symbol, asset_name, purchase_date, side, quantity, unit_price_brl, other_costs_brl, total_value_brl)
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      req.authUser!.id,
      assetType,
      normalizedSymbol,
      assetName.trim(),
      purchaseDate,
      side,
      quantity,
      unitPriceBrl,
      otherCosts,
      finalTotal,
    ],
  );

  return res.status(201).json({ entry: created.rows[0] });
});

portfolioRouter.patch("/entries/:id", async (req, res) => {
  const entryId = String(req.params.id);
  const {
    symbol,
    assetName,
    purchaseDate,
    side: sideRaw,
    quantity,
    unitPriceBrl,
    otherCostsBrl,
    totalValueBrl,
  } = req.body as Partial<CreatePortfolioEntryType>;

  const existing = await pool.query(
    `SELECT *
     FROM portfolio_entries
     WHERE id = $1 AND user_id = $2`,
    [entryId, req.authUser!.id],
  );

  if (!existing.rowCount) {
    return res.status(404).json({ message: "Lançamento não encontrado." });
  }

  const current = existing.rows[0] as {
    symbol: string;
    asset_name: string;
    purchase_date: string;
    side: PortfolioSide;
    quantity: string | number;
    unit_price_brl: string | number;
    other_costs_brl: string | number;
    total_value_brl: string | number;
  };

  const nextSide = normalizeSide(sideRaw ?? current.side);
  const nextSymbol = String(symbol ?? current.symbol).toUpperCase().trim();
  const nextName = String(assetName ?? current.asset_name).trim();
  const nextDate = String(purchaseDate ?? current.purchase_date).slice(0, 10);
  const nextQty = quantity ?? Number(current.quantity);
  const nextUnit = unitPriceBrl ?? Number(current.unit_price_brl);
  const nextOther = otherCostsBrl ?? Number(current.other_costs_brl);

  if (!nextSymbol || !nextName || !nextDate) {
    return res.status(400).json({ message: "symbol, assetName e purchaseDate são obrigatórios." });
  }
  if (!isPositiveNumber(nextQty) || !isPositiveNumber(nextUnit)) {
    return res.status(400).json({ message: "quantity e unitPriceBrl devem ser maiores que zero." });
  }
  if (!isNonNegativeNumber(nextOther)) {
    return res.status(400).json({ message: "otherCostsBrl deve ser igual ou maior que zero." });
  }

  if (nextSide === "SELL") {
    const netQty = await getNetQuantityForSymbol({
      userId: req.authUser!.id,
      symbol: nextSymbol,
      excludeEntryId: entryId,
    });
    if (nextQty > netQty + 1e-12) {
      return res.status(400).json({
        message: `Saldo insuficiente para vender ${nextQty}. Você tem ${formatCryptoQty(netQty, 6)} de ${nextSymbol}.`,
      });
    }
  }

  const gross = nextQty * nextUnit;
  let computedTotal: number;
  if (nextSide === "BUY") {
    computedTotal = Number((gross + nextOther).toFixed(2));
  } else {
    computedTotal = Number((gross - nextOther).toFixed(2));
    if (computedTotal <= 0) {
      return res.status(400).json({
        message:
          "Na venda, o valor líquido (quantidade × preço − outros custos) precisa ser maior que zero.",
      });
    }
  }

  const finalTotal = totalValueBrl ?? computedTotal;
  if (!isPositiveNumber(finalTotal)) {
    return res.status(400).json({ message: "totalValueBrl inválido." });
  }

  const updated = await pool.query(
    `UPDATE portfolio_entries
     SET symbol = $3,
         asset_name = $4,
         purchase_date = $5,
         side = $6,
         quantity = $7,
         unit_price_brl = $8,
         other_costs_brl = $9,
         total_value_brl = $10,
         updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [
      entryId,
      req.authUser!.id,
      nextSymbol,
      nextName,
      nextDate,
      nextSide,
      nextQty,
      nextUnit,
      nextOther,
      finalTotal,
    ],
  );

  return res.json({ entry: updated.rows[0] });
});

portfolioRouter.get("/entries", async (req, res) => {
  const limitRaw = Number(req.query.limit ?? 1000);
  const offsetRaw = Number(req.query.offset ?? 0);

  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 100) : 10;
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.floor(offsetRaw), 0) : 0;

  const total = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM portfolio_entries
     WHERE user_id = $1`,
    [req.authUser!.id],
  );

  const paginated = await pool.query(
    `SELECT *
      FROM portfolio_entries
      WHERE user_id = $1
      ORDER BY purchase_date DESC, created_at DESC
      LIMIT $2 OFFSET $3`,
    [req.authUser!.id, limit, offset],
  );

  return res.json({
    items: paginated.rows,
    total: total.rows[0]?.total ?? 0,
    limit,
    offset,
  });
});

portfolioRouter.get("/summary", async (req, res) => {
  const raw = await pool.query(
    `SELECT
      asset_type,
      symbol,
      asset_name,
      SUM(CASE WHEN side = 'BUY' THEN quantity::numeric ELSE 0 END) AS buy_qty,
      SUM(CASE WHEN side = 'BUY' THEN total_value_brl::numeric ELSE 0 END) AS buy_val,
      SUM(CASE WHEN side = 'SELL' THEN quantity::numeric ELSE 0 END) AS sell_qty
     FROM portfolio_entries
     WHERE user_id = $1
     GROUP BY asset_type, symbol, asset_name
     ORDER BY asset_type, symbol`,
    [req.authUser!.id],
  );

  const assets: Array<{
    asset_type: string;
    symbol: string;
    asset_name: string;
    total_quantity: string;
    total_invested_brl: string;
    average_price_brl: string;
  }> = [];

  let totalInvestedBrl = 0;

  for (const row of raw.rows) {
    const buyQty = Number(row.buy_qty);
    const buyVal = Number(row.buy_val);
    const sellQty = Number(row.sell_qty);
    const netQty = buyQty - sellQty;
    if (netQty <= 1e-10) continue;

    const avgBuyUnit = buyQty > 0 ? buyVal / buyQty : 0;
    const bookValue = Math.max(0, buyVal - sellQty * avgBuyUnit);
    const avgPrice = netQty > 0 ? bookValue / netQty : 0;

    totalInvestedBrl += bookValue;

    assets.push({
      asset_type: row.asset_type,
      symbol: row.symbol,
      asset_name: row.asset_name,
      total_quantity: netQty.toFixed(8).replace(/\.?0+$/, "") || "0",
      total_invested_brl: bookValue.toFixed(2),
      average_price_brl: avgPrice.toFixed(2),
    });
  }

  return res.json({
    totalInvestedBrl: totalInvestedBrl.toFixed(2),
    assets,
  });
});

portfolioRouter.delete("/entries/:id", async (req, res) => {
  const existing = await pool.query(
    `SELECT id, symbol, side, quantity
     FROM portfolio_entries
     WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.authUser!.id],
  );

  if (!existing.rowCount) {
    return res.status(404).json({ message: "Lançamento não encontrado." });
  }

  const row = existing.rows[0] as { symbol: string; side: PortfolioSide; quantity: string | number };
  const normalizedSymbol = String(row.symbol).toUpperCase().trim();
  const qty = Number(row.quantity);

  // Se apagar uma COMPRA, pode deixar o histórico inconsistente (vendas > compras).
  if (row.side === "BUY") {
    const netAfterDelete = await getNetQuantityForSymbol({
      userId: req.authUser!.id,
      symbol: normalizedSymbol,
      excludeEntryId: String(req.params.id),
    });
    if (netAfterDelete < -1e-12) {
      return res.status(400).json({
        message:
          "Não é possível excluir esta compra porque existem vendas posteriores que ficariam maiores que o saldo. Edite/remova as vendas antes.",
      });
    }
  }

  const deleted = await pool.query(
    "DELETE FROM portfolio_entries WHERE id = $1 AND user_id = $2 RETURNING id",
    [req.params.id, req.authUser!.id],
  );

  if (!deleted.rowCount) {
    return res.status(404).json({ message: "Lançamento não encontrado." });
  }

  return res.status(204).send();
});
