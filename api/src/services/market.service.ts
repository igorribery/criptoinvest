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

export type SpotPricesBrlResult = {
  prices: Record<string, number | null>;
  /** URL do ícone (CoinGecko), por símbolo em maiúsculas */
  images: Record<string, string | null>;
};

/**
 * Preço spot em BRL + URL do ícone por símbolo (uma chamada /coins/markets).
 */
export async function fetchSpotPricesBrl(symbols: string[]): Promise<SpotPricesBrlResult> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (!unique.length) return { prices: {}, images: {} };

  const symbolToId: Record<string, string> = {};
  for (const sym of unique) {
    const id = await resolveCoinGeckoId(sym);
    if (id) symbolToId[sym] = id;
  }

  const ids = [...new Set(Object.values(symbolToId))];
  const emptyPrices = Object.fromEntries(unique.map((s) => [s, null])) as Record<string, number | null>;
  const emptyImages = Object.fromEntries(unique.map((s) => [s, null])) as Record<string, string | null>;

  if (!ids.length) {
    return { prices: emptyPrices, images: emptyImages };
  }

  const url = new URL(`${env.coingeckoApiBaseUrl}/coins/markets`);
  url.searchParams.set("vs_currency", "brl");
  url.searchParams.set("ids", ids.join(","));
  url.searchParams.set("order", "market_cap_desc");
  url.searchParams.set("per_page", "250");
  url.searchParams.set("page", "1");
  url.searchParams.set("sparkline", "false");

  const response = await fetch(url.toString(), { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`CoinGecko coins/markets: ${response.status}`);
  }

  const data = (await response.json()) as Array<{
    id: string;
    current_price: number | null;
    image?: string;
  }>;

  const idToRow = new Map(data.map((row) => [row.id, row]));

  const prices: Record<string, number | null> = {};
  const images: Record<string, string | null> = {};
  for (const sym of unique) {
    const id = symbolToId[sym];
    const row = id ? idToRow.get(id) : undefined;
    const p = row?.current_price;
    prices[sym] = typeof p === "number" && Number.isFinite(p) ? p : null;
    const img = row?.image?.trim();
    images[sym] = img || null;
  }

  return { prices, images };
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
