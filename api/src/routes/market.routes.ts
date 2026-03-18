import { Router } from "express";
import { fetchSpotPricesBrl, fetchTop10MarketData } from "../services/market.service.js";

export const marketRouter = Router();

/** Preços atuais em BRL: ?symbols=BTC,ETH,BNB */
marketRouter.get("/spot-prices", async (req, res) => {
  const raw = String(req.query.symbols ?? "");
  const symbols = raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40);

  if (!symbols.length) {
    return res.status(400).json({ message: "Informe symbols (ex.: BTC,ETH)." });
  }

  try {
    const prices = await fetchSpotPricesBrl(symbols);
    return res.json({ currency: "brl", prices });
  } catch (error) {
    console.error(error);
    return res.status(502).json({ message: "Não foi possível buscar cotações agora." });
  }
});

marketRouter.get("/top-10", async (req, res) => {
  const currency = String(req.query.currency ?? "brl").toLowerCase();

  try {
    const items = await fetchTop10MarketData(currency);
    return res.json({ currency, items });
  } catch (error) {
    console.error(error);
    return res.status(502).json({ message: "Não foi possível consultar os preços agora." });
  }
});
