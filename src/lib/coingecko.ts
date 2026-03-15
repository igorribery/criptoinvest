const COINGECKO_BASE_URL = process.env.COINGECKO_BASE_URL ?? "https://api.coingecko.com/api/v3";
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_API_KEY_HEADER = process.env.COINGECKO_API_KEY_HEADER ?? "x-cg-pro-api-key";

export type HomeMarketCoin = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  marketCapRank: number | null;
  currentPriceBrl: number | null;
  priceChangePercentage1h: number | null;
  priceChangePercentage24h: number | null;
  priceChangePercentage7d: number | null;
  sparkline7d: number[];
  totalVolumeBrl: number | null;
  marketCapBrl: number | null;
};

type CoinGeckoMarketsResponse = Array<{
  id: string;
  symbol: string;
  name: string;
  image?: string;
  market_cap_rank?: number;
  current_price?: number;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_24h?: number;
  price_change_percentage_7d_in_currency?: number;
  sparkline_in_7d?: { price?: number[] };
  total_volume?: number;
  market_cap?: number;
}>;

export async function getHomePrices(): Promise<{ prices: HomeMarketCoin[]; lastUpdatedAt: string }> {
  const base = COINGECKO_BASE_URL.replace(/\/$/, "");
  const url = new URL(`${base}/coins/markets`);
  url.searchParams.set("vs_currency", "brl");
  url.searchParams.set("order", "market_cap_desc");
  url.searchParams.set("per_page", "10");
  url.searchParams.set("page", "1");
  url.searchParams.set("price_change_percentage", "1h,24h,7d");
  url.searchParams.set("sparkline", "true");

  const headers: HeadersInit = {
    accept: "application/json",
  };

  if (COINGECKO_API_KEY) {
    headers[COINGECKO_API_KEY_HEADER] = COINGECKO_API_KEY;
  }

  const response = await fetch(url.toString(), {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao buscar top moedas na CoinGecko: ${response.status} ${body}`);
  }

  const data = (await response.json()) as CoinGeckoMarketsResponse;

  return {
    prices: data.map((coin) => ({
      id: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      image: coin.image ?? "",
      marketCapRank: coin.market_cap_rank ?? null,
      currentPriceBrl: coin.current_price ?? null,
      priceChangePercentage1h: coin.price_change_percentage_1h_in_currency ?? null,
      priceChangePercentage24h: coin.price_change_percentage_24h ?? null,
      priceChangePercentage7d: coin.price_change_percentage_7d_in_currency ?? null,
      sparkline7d: coin.sparkline_in_7d?.price ?? [],
      totalVolumeBrl: coin.total_volume ?? null,
      marketCapBrl: coin.market_cap ?? null,
    })),
    lastUpdatedAt: new Date().toISOString(),
  };
}
