import { env } from "../config/env.js";
import { CoinGeckoMarketItem } from "../types/market-types.js";

/** Símbolo (maiúsculo) → id CoinGecko para /simple/price */
const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
  BNB: "binancecoin",
  SOL: "solana",
  USDC: "usd-coin",
  XRP: "ripple",
  TRX: "tron",
  DOGE: "dogecoin",
  ADA: "cardano",
  AVAX: "avalanche-2",
  SHIB: "shiba-inu",
  DOT: "polkadot",
  LINK: "chainlink",
  MATIC: "matic-network",
  POL: "matic-network",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  ATOM: "cosmos",
  UNI: "uniswap",
  XLM: "stellar",
  NEAR: "near",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  FIL: "filecoin",
  ICP: "internet-computer",
  INJ: "injective-protocol",
  TON: "the-open-network",
  PEPE: "pepe",
  FLOKI: "floki",
  WIF: "dogwifcoin",
  BONK: "bonk",
  SUI: "sui",
  SEI: "sei-network",
  TIA: "celestia",
  RENDER: "render-token",
  FET: "fetch-ai",
};

const resolvedIdCache = new Map<string, string>();

async function resolveCoinGeckoId(symbolUpper: string): Promise<string | null> {
  if (SYMBOL_TO_COINGECKO_ID[symbolUpper]) {
    return SYMBOL_TO_COINGECKO_ID[symbolUpper];
  }
  const cached = resolvedIdCache.get(symbolUpper);
  if (cached) return cached;

  const url = new URL(`${env.coingeckoApiBaseUrl}/search`);
  url.searchParams.set("query", symbolUpper);
  const response = await fetch(url.toString(), { headers: { accept: "application/json" } });
  if (!response.ok) return null;
  const data = (await response.json()) as { coins?: Array<{ id: string; symbol: string }> };
  const hit = data.coins?.find((c) => c.symbol.toUpperCase() === symbolUpper);
  if (hit?.id) {
    resolvedIdCache.set(symbolUpper, hit.id);
    return hit.id;
  }
  return null;
}

/**
 * Preço spot em BRL por símbolo (ex.: BTC → bitcoin). Símbolos desconhecidos tentam busca CoinGecko.
 */
export async function fetchSpotPricesBrl(symbols: string[]): Promise<Record<string, number | null>> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (!unique.length) return {};

  const symbolToId: Record<string, string> = {};
  for (const sym of unique) {
    const id = await resolveCoinGeckoId(sym);
    if (id) symbolToId[sym] = id;
  }

  const ids = [...new Set(Object.values(symbolToId))];
  if (!ids.length) {
    return Object.fromEntries(unique.map((s) => [s, null]));
  }

  const url = new URL(`${env.coingeckoApiBaseUrl}/simple/price`);
  url.searchParams.set("ids", ids.join(","));
  url.searchParams.set("vs_currencies", "brl");
  url.searchParams.set("precision", "full");

  const response = await fetch(url.toString(), { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`CoinGecko simple/price: ${response.status}`);
  }

  const payload = (await response.json()) as Record<string, { brl?: number }>;
  const out: Record<string, number | null> = {};
  for (const sym of unique) {
    const id = symbolToId[sym];
    const brl = id ? payload[id]?.brl : undefined;
    out[sym] = typeof brl === "number" && Number.isFinite(brl) ? brl : null;
  }
  return out;
}

export async function fetchTop10MarketData(vsCurrency = "brl") {
  const url = new URL(`${env.coingeckoApiBaseUrl}/coins/markets`);
  url.searchParams.set("vs_currency", vsCurrency);
  url.searchParams.set("order", "market_cap_desc");
  url.searchParams.set("per_page", "10");
  url.searchParams.set("page", "1");
  url.searchParams.set("sparkline", "false");
  url.searchParams.set("price_change_percentage", "24h,7d,30d");

  const response = await fetch(url.toString(), {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar CoinGecko: ${response.status}`);
  }

  const data = (await response.json()) as CoinGeckoMarketItem[];

  return data.map((item) => ({
    externalId: item.id,
    symbol: item.symbol.toUpperCase(),
    name: item.name,
    currentPrice: item.current_price,
    marketCap: item.market_cap,
    volume24h: item.total_volume,
    change24hPct: item.price_change_percentage_24h,
    change7dPct: item.price_change_percentage_7d_in_currency,
    change30dPct: item.price_change_percentage_30d_in_currency,
  }));
}
