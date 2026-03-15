import { env } from "../config/env.js";
import { CoinGeckoMarketItem } from "../types/market-types.js";

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
