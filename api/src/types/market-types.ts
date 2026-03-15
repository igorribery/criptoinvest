export type CoinGeckoMarketItem = {
    id: string;
    symbol: string;
    name: string;
    current_price: number;
    market_cap: number;
    total_volume: number;
    price_change_percentage_24h: number | null;
    price_change_percentage_7d_in_currency: number | null;
    price_change_percentage_30d_in_currency: number | null;
  };