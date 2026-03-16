export const COINGECKO_BASE_URL = process.env.COINGECKO_BASE_URL ?? "https://api.coingecko.com/api/v3";
export const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
export const COINGECKO_API_KEY_HEADER = process.env.COINGECKO_API_KEY_HEADER ?? "x-cg-pro-api-key";

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

export type CoinGeckoMarketsResponse = Array<{
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