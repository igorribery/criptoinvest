import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { isPositiveNumber } from "../utils/validators.js";

const ALLOWED_DIRECTION = ["ABOVE", "BELOW"] as const;
const ALLOWED_FREQUENCY = ["5m", "15m", "1h", "1d"] as const;

export const alertsRouter = Router();

alertsRouter.use(requireAuth);

alertsRouter.post("/", async (req, res) => {
  const { symbol, direction, targetPriceBrl, frequency } = req.body as {
    symbol?: string;
    direction?: string;
    targetPriceBrl?: number;
    frequency?: string;
  };

  if (!symbol || !direction || !frequency || !isPositiveNumber(targetPriceBrl)) {
    return res.status(400).json({ message: "symbol, direction, targetPriceBrl e frequency são obrigatórios." });
  }

  if (!ALLOWED_DIRECTION.includes(direction as (typeof ALLOWED_DIRECTION)[number])) {
    return res.status(400).json({ message: `direction inválido. Use ${ALLOWED_DIRECTION.join(" ou ")}.` });
  }

  if (!ALLOWED_FREQUENCY.includes(frequency as (typeof ALLOWED_FREQUENCY)[number])) {
    return res.status(400).json({ message: `frequency inválida. Use ${ALLOWED_FREQUENCY.join(", ")}.` });
  }

  const created = await pool.query(
    `INSERT INTO price_alerts (user_id, symbol, direction, target_price_brl, frequency)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [req.authUser!.id, symbol.toUpperCase(), direction, targetPriceBrl, frequency],
  );

  return res.status(201).json({ alert: created.rows[0] });
});

alertsRouter.get("/", async (req, res) => {
  const items = await pool.query(
    "SELECT * FROM price_alerts WHERE user_id = $1 ORDER BY created_at DESC",
    [req.authUser!.id],
  );

  return res.json({ items: items.rows });
});

alertsRouter.patch("/:id", async (req, res) => {
  const { isActive } = req.body as { isActive?: boolean };

  if (typeof isActive !== "boolean") {
    return res.status(400).json({ message: "isActive deve ser boolean." });
  }

  const updated = await pool.query(
    `UPDATE price_alerts
     SET is_active = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [isActive, req.params.id, req.authUser!.id],
  );

  if (!updated.rowCount) {
    return res.status(404).json({ message: "Alerta não encontrado." });
  }

  return res.json({ alert: updated.rows[0] });
});

alertsRouter.delete("/:id", async (req, res) => {
  const deleted = await pool.query(
    "DELETE FROM price_alerts WHERE id = $1 AND user_id = $2 RETURNING id",
    [req.params.id, req.authUser!.id],
  );

  if (!deleted.rowCount) {
    return res.status(404).json({ message: "Alerta não encontrado." });
  }

  return res.status(204).send();
});
