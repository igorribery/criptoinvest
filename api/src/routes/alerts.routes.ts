import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { isPositiveNumber } from "../utils/validators.js";
import { CreateAlertType, UpdateAlertType } from "../types/alerts.routes-types.js";
import { ALLOWED_ALERT_TYPE, ALLOWED_DIRECTION, ALLOWED_PERIOD_HOURS } from "../types/alerts.routes-types.js";

export const alertsRouter = Router();

alertsRouter.use(requireAuth);

async function getUserAveragePriceForSymbol(params: {
  userId: string;
  symbol: string;
}): Promise<number | null> {
  const { userId, symbol } = params;
  const result = await pool.query(
    `SELECT
      COALESCE(SUM(CASE WHEN side = 'BUY' THEN quantity::numeric ELSE 0 END), 0) AS buy_qty,
      COALESCE(SUM(CASE WHEN side = 'BUY' THEN total_value_brl::numeric ELSE 0 END), 0) AS buy_val,
      COALESCE(SUM(CASE WHEN side = 'SELL' THEN quantity::numeric ELSE 0 END), 0) AS sell_qty
     FROM portfolio_entries
     WHERE user_id = $1
       AND symbol = $2`,
    [userId, symbol.toUpperCase().trim()],
  );

  const buyQty = Number(result.rows[0]?.buy_qty ?? 0);
  const buyVal = Number(result.rows[0]?.buy_val ?? 0);
  const sellQty = Number(result.rows[0]?.sell_qty ?? 0);
  if (!Number.isFinite(buyQty) || !Number.isFinite(buyVal) || !Number.isFinite(sellQty)) return null;

  const netQty = buyQty - sellQty;
  if (netQty <= 1e-10) return null;

  const avgBuyUnit = buyQty > 0 ? buyVal / buyQty : 0;
  const bookValue = Math.max(0, buyVal - sellQty * avgBuyUnit);
  const avgPrice = netQty > 0 ? bookValue / netQty : 0;
  if (!Number.isFinite(avgPrice) || avgPrice <= 0) return null;
  return avgPrice;
}

alertsRouter.post("/", async (req, res) => {
  const body = req.body as CreateAlertType;
  const alertType = (body as any)?.alertType as string | undefined;
  const symbol = (body as any)?.symbol as string | undefined;
  const notifyEmail = typeof (body as any)?.notifyEmail === "boolean" ? (body as any).notifyEmail : true;
  const notifySms = typeof (body as any)?.notifySms === "boolean" ? (body as any).notifySms : false;
  const smsPhoneNumber = (body as any)?.smsPhoneNumber as string | undefined;
  const smsNormalized = notifySms ? smsPhoneNumber?.trim() ?? null : null;

  if (!alertType || !ALLOWED_ALERT_TYPE.includes(alertType as (typeof ALLOWED_ALERT_TYPE)[number])) {
    return res.status(400).json({ message: `alertType inválido. Use ${ALLOWED_ALERT_TYPE.join(" ou ")}.` });
  }

  if (!symbol?.trim()) {
    return res.status(400).json({ message: "symbol é obrigatório." });
  }

  if (!notifyEmail && !notifySms) {
    return res.status(400).json({ message: "Selecione ao menos um canal (email ou SMS)." });
  }

  if (notifySms && !smsPhoneNumber?.trim()) {
    return res.status(400).json({ message: "smsPhoneNumber é obrigatório quando notifySms=true." });
  }

  if (alertType === "PERIODIC") {
    const periodHours = (body as any)?.periodHours as number | undefined;
    if (!ALLOWED_PERIOD_HOURS.includes(periodHours as (typeof ALLOWED_PERIOD_HOURS)[number])) {
      return res.status(400).json({ message: `periodHours inválido. Use ${ALLOWED_PERIOD_HOURS.join(", ")}.` });
    }

    const dup = await pool.query(
      `SELECT id
       FROM price_alerts
       WHERE user_id = $1
         AND symbol = $2
         AND alert_type = 'PERIODIC'
         AND period_hours = $3
         AND notify_email = $4
         AND notify_sms = $5
         AND COALESCE(sms_phone_number, '') = COALESCE($6, '')
       LIMIT 1`,
      [req.authUser!.id, symbol.toUpperCase(), periodHours, notifyEmail, notifySms, smsNormalized],
    );
    if (dup.rowCount) {
      return res.status(409).json({ message: "Você já tem um alerta idêntico para esse ativo." });
    }

    const created = await pool.query(
      `INSERT INTO price_alerts
        (user_id, symbol, alert_type, period_hours, notify_email, notify_sms, sms_phone_number)
       VALUES ($1,$2,'PERIODIC',$3,$4,$5,$6)
       RETURNING *`,
      [req.authUser!.id, symbol.toUpperCase(), periodHours, notifyEmail, notifySms, smsNormalized],
    );

    return res.status(201).json({ alert: created.rows[0] });
  }

  // TARGET_ONCE
  let direction = (body as any)?.direction as string | undefined;
  const targetPriceBrl = (body as any)?.targetPriceBrl as number | undefined;

  if (!isPositiveNumber(targetPriceBrl)) {
    return res.status(400).json({ message: "targetPriceBrl deve ser número positivo." });
  }

  // Se não veio direction, inferimos pelo preço médio da carteira:
  // - target >= preço médio => ABOVE (espera subir)
  // - target < preço médio  => BELOW (espera cair)
  if (!direction) {
    const avgPrice = await getUserAveragePriceForSymbol({
      userId: req.authUser!.id,
      symbol: symbol.toUpperCase(),
    });
    if (typeof avgPrice === "number" && Number.isFinite(avgPrice)) {
      direction = targetPriceBrl >= avgPrice ? "ABOVE" : "BELOW";
    }
  }

  if (!direction || !ALLOWED_DIRECTION.includes(direction as (typeof ALLOWED_DIRECTION)[number])) {
    return res.status(400).json({
      message:
        `direction inválido (não foi possível inferir automaticamente pelo seu preço médio cadastrado). Use ${ALLOWED_DIRECTION.join(" ou ")}.`,
    });
  }

  const dup = await pool.query(
    `SELECT id
     FROM price_alerts
     WHERE user_id = $1
       AND symbol = $2
       AND alert_type = 'TARGET_ONCE'
       AND direction = $3
       AND target_price_brl = $4
       AND notify_email = $5
       AND notify_sms = $6
       AND COALESCE(sms_phone_number, '') = COALESCE($7, '')
     LIMIT 1`,
    [
      req.authUser!.id,
      symbol.toUpperCase(),
      direction,
      targetPriceBrl,
      notifyEmail,
      notifySms,
      smsNormalized,
    ],
  );
  if (dup.rowCount) {
    return res.status(409).json({ message: "Você já tem um alerta idêntico para esse ativo." });
  }

  const created = await pool.query(
    `INSERT INTO price_alerts
      (user_id, symbol, alert_type, direction, target_price_brl, notify_email, notify_sms, sms_phone_number)
     VALUES ($1,$2,'TARGET_ONCE',$3,$4,$5,$6,$7)
     RETURNING *`,
    [req.authUser!.id, symbol.toUpperCase(), direction, targetPriceBrl, notifyEmail, notifySms, smsNormalized],
  );

  return res.status(201).json({ alert: created.rows[0] });
});

alertsRouter.get("/", async (req, res) => {
  const symbol = String(req.query.symbol ?? "").trim().toUpperCase();
  const limitRaw = Number(req.query.limit ?? 20);
  const offsetRaw = Number(req.query.offset ?? 0);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.trunc(limitRaw))) : 20;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.trunc(offsetRaw)) : 0;

  const whereSql = symbol ? "user_id = $1 AND symbol = $2" : "user_id = $1";
  const whereParams = symbol ? [req.authUser!.id, symbol] : [req.authUser!.id];

  const [items, total] = await Promise.all([
    pool.query(
      `SELECT * FROM price_alerts
       WHERE ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${whereParams.length + 1} OFFSET $${whereParams.length + 2}`,
      [...whereParams, limit, offset],
    ),
    pool.query(`SELECT COUNT(*)::int AS total FROM price_alerts WHERE ${whereSql}`, whereParams),
  ]);

  return res.json({ items: items.rows, total: total.rows[0]?.total ?? 0, limit, offset });
});

alertsRouter.patch("/:id", async (req, res) => {
  const { isActive } = req.body as UpdateAlertType;

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
