const COINGECKO_BASE_URL = process.env.COINGECKO_BASE_URL ?? "https://pro-api.coingecko.com/api/v3";
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_API_KEY_HEADER = process.env.COINGECKO_API_KEY_HEADER ?? "x-cg-pro-api-key";

const HOME_COIN_IDS = ["bitcoin", "ethereum", "solana"] as const;

type HomeCoinId = (typeof HOME_COIN_IDS)[number];

type CoinGeckoSimplePriceResponse = Record<
  HomeCoinId,
  {
    brl?: number;
  }
>;

export type HomePrice = {
  id: HomeCoinId;
  symbol: string;
  name: string;
  priceBrl: number | null;
};

const coinMetadata: Record<HomeCoinId, Omit<HomePrice, "priceBrl">> = {
  bitcoin: { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  ethereum: { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  solana: { id: "solana", symbol: "SOL", name: "Solana" },
};

export async function getHomePrices(): Promise<{ prices: HomePrice[]; lastUpdatedAt: string }> {
  if (!COINGECKO_API_KEY) {
    throw new Error("COINGECKO_API_KEY não configurada.");
  }

  const url = new URL("/simple/price", COINGECKO_BASE_URL);
  url.searchParams.set("ids", HOME_COIN_IDS.join(","));
  url.searchParams.set("vs_currencies", "brl");

  const response = await fetch(url.toString(), {
    headers: {
      [COINGECKO_API_KEY_HEADER]: COINGECKO_API_KEY,
      accept: "application/json",
    },
    cache: "force-cache",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao buscar preços da CoinGecko: ${response.status} ${body}`);
  }

  const data = (await response.json()) as CoinGeckoSimplePriceResponse;

  return {
    prices: HOME_COIN_IDS.map((coinId) => ({
      ...coinMetadata[coinId],
      priceBrl: data[coinId]?.brl ?? null,
    })),
    lastUpdatedAt: new Date().toISOString(),
  };
}
