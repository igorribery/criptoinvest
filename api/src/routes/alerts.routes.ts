import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { isPositiveNumber } from "../utils/validators.js";
import { CreateAlertType, UpdateAlertType } from "../types/alerts.routes-types.js";
import { ALLOWED_ALERT_TYPE, ALLOWED_DIRECTION, ALLOWED_PERIOD_HOURS } from "../types/alerts.routes-types.js";
import { fetchSpotPricesBrl } from "../services/market.service.js";

export const alertsRouter = Router();

alertsRouter.use(requireAuth);

alertsRouter.post("/", async (req, res) => {
  const body = req.body as CreateAlertType;
  const alertType = (body as any)?.alertType as string | undefined;
  const symbol = (body as any)?.symbol as string | undefined;
  const notifyEmail = typeof (body as any)?.notifyEmail === "boolean" ? (body as any).notifyEmail : true;
  const notifySms = typeof (body as any)?.notifySms === "boolean" ? (body as any).notifySms : false;
  const smsPhoneNumber = (body as any)?.smsPhoneNumber as string | undefined;

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

    const created = await pool.query(
      `INSERT INTO price_alerts
        (user_id, symbol, alert_type, period_hours, notify_email, notify_sms, sms_phone_number)
       VALUES ($1,$2,'PERIODIC',$3,$4,$5,$6)
       RETURNING *`,
      [req.authUser!.id, symbol.toUpperCase(), periodHours, notifyEmail, notifySms, smsPhoneNumber?.trim() ?? null],
    );

    return res.status(201).json({ alert: created.rows[0] });
  }

  // TARGET_ONCE
  let direction = (body as any)?.direction as string | undefined;
  const targetPriceBrl = (body as any)?.targetPriceBrl as number | undefined;

  if (!isPositiveNumber(targetPriceBrl)) {
    return res.status(400).json({ message: "targetPriceBrl deve ser número positivo." });
  }

  // Se não veio direction, inferimos pelo preço atual:
  // - target >= preço atual => ABOVE (espera subir)
  // - target < preço atual  => BELOW (espera cair)
  if (!direction) {
    try {
      const { prices } = await fetchSpotPricesBrl([symbol.toUpperCase()]);
      const current = prices?.[symbol.toUpperCase()];
      if (typeof current === "number" && Number.isFinite(current)) {
        direction = targetPriceBrl >= current ? "ABOVE" : "BELOW";
      }
    } catch {
      // ignore
    }
  }

  if (!direction || !ALLOWED_DIRECTION.includes(direction as (typeof ALLOWED_DIRECTION)[number])) {
    return res.status(400).json({
      message:
        `direction inválido (não foi possível inferir automaticamente). Use ${ALLOWED_DIRECTION.join(" ou ")}.`,
    });
  }

  const created = await pool.query(
    `INSERT INTO price_alerts
      (user_id, symbol, alert_type, direction, target_price_brl, notify_email, notify_sms, sms_phone_number)
     VALUES ($1,$2,'TARGET_ONCE',$3,$4,$5,$6,$7)
     RETURNING *`,
    [req.authUser!.id, symbol.toUpperCase(), direction, targetPriceBrl, notifyEmail, notifySms, smsPhoneNumber?.trim() ?? null],
  );

  return res.status(201).json({ alert: created.rows[0] });
});

alertsRouter.get("/", async (req, res) => {
  const symbol = String(req.query.symbol ?? "").trim().toUpperCase();
  const items = await pool.query(
    symbol
      ? "SELECT * FROM price_alerts WHERE user_id = $1 AND symbol = $2 ORDER BY created_at DESC"
      : "SELECT * FROM price_alerts WHERE user_id = $1 ORDER BY created_at DESC",
    symbol ? [req.authUser!.id, symbol] : [req.authUser!.id],
  );

  return res.json({ items: items.rows });
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
