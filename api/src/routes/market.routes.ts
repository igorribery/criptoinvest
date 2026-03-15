import { Router } from "express";
import { fetchTop10MarketData } from "../services/market.service.js";

export const marketRouter = Router();

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
