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

type DailyNotificationItem = {
  symbol: string;
  name: string;
  change24hPct: number;
  direction: "up" | "down" | "flat";
  message: string;
};

let dailyNotificationsCache:
  | {
      generatedAt: string;
      items: DailyNotificationItem[];
      cachedAtMs: number;
    }
  | undefined;

const DAY_MS = 24 * 60 * 60 * 1000;

function formatPctPtBr(value: number) {
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return `${formatted}%`;
}

function buildDailyMessage(symbol: string, pct: number) {
  if (!Number.isFinite(pct)) return `${symbol} sem variação disponível nas últimas 24h`;
  if (pct > 0) return `${symbol} subiu +${formatPctPtBr(pct)} nas últimas 24h`;
  if (pct < 0) return `${symbol} caiu ${formatPctPtBr(pct)} nas últimas 24h`;
  return `${symbol} ficou estável (0,00%) nas últimas 24h`;
}

/**
 * Notificações diárias (cache 24h) baseadas no Top 10 da CoinGecko.
 * Retorna mensagens simples do tipo: "BTC subiu +1,23% nas últimas 24h".
 */
marketRouter.get("/daily-notifications", async (_req, res) => {
  const now = Date.now();
  if (dailyNotificationsCache && now - dailyNotificationsCache.cachedAtMs < DAY_MS) {
    return res.json({
      generatedAt: dailyNotificationsCache.generatedAt,
      items: dailyNotificationsCache.items,
      cached: true,
    });
  }

  try {
    const items = await fetchTop10MarketData("brl");
    const out: DailyNotificationItem[] = items
      .map((it) => {
        const pct = Number(it.change24hPct);
        const direction: DailyNotificationItem["direction"] =
          Number.isFinite(pct) && pct > 0 ? "up" : Number.isFinite(pct) && pct < 0 ? "down" : "flat";
        return {
          symbol: it.symbol,
          name: it.name,
          change24hPct: Number.isFinite(pct) ? pct : 0,
          direction,
          message: buildDailyMessage(it.symbol, pct),
        };
      })
      .slice(0, 10);

    const generatedAt = new Date().toISOString();
    dailyNotificationsCache = { generatedAt, items: out, cachedAtMs: now };
    return res.json({ generatedAt, items: out, cached: false });
  } catch (error) {
    console.error(error);
    return res.status(502).json({ message: "Não foi possível buscar as notificações agora." });
  }
});
