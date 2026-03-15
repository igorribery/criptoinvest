export const revalidate = 60 * 60 * 24;

import { getHomePrices } from "@/lib/coingecko";

function formatPriceBrl(value: number | null) {
  if (value === null) {
    return "Indisponível";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function Home() {
  let prices = [] as Awaited<ReturnType<typeof getHomePrices>>["prices"];
  let lastUpdatedAt: string | null = null;
  let errorMessage: string | null = null;

  try {
    const response = await getHomePrices();
    prices = response.prices;
    lastUpdatedAt = response.lastUpdatedAt;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Falha inesperada ao buscar preços.";
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-20">
      <h1 className="text-center text-4xl font-bold leading-tight sm:text-6xl">
        CriptoInvest com <span className="text-cyan-300">CoinGecko</span>
      </h1>

      <h2 className="mx-auto mt-6 max-w-2xl text-center text-base text-slate-300 sm:text-lg">
        Preços iniciais em Real (BRL), usando cache de 24h para economizar chamadas da API.
      </h2>

      <section className="mt-12 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <h3 className="text-xl font-semibold text-slate-100">Cotações (BRL)</h3>

        <ul className="mt-4 space-y-3">
          {prices.map((coin) => (
            <li
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3"
              key={coin.id}
            >
              <div>
                <p className="font-medium text-slate-100">{coin.name}</p>
                <p className="text-sm text-slate-400">{coin.symbol}</p>
              </div>
              <p className="text-lg font-semibold text-cyan-300">{formatPriceBrl(coin.priceBrl)}</p>
            </li>
          ))}
        </ul>

        {errorMessage ? (
          <p className="mt-4 text-sm text-rose-300">{errorMessage}</p>
        ) : null}

        {lastUpdatedAt ? (
          <p className="mt-4 text-sm text-slate-400">
            Última atualização do cache: {new Date(lastUpdatedAt).toLocaleString("pt-BR")}.
          </p>
        ) : null}
      </section>
    </main>
  );
}
