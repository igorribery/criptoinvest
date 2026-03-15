export const revalidate = 60;

import { Sparkline } from "@/components/sparkline";
import { getHomePrices } from "@/lib/coingecko";
import { formatCurrencyBrl, formatPercentage } from "@/utils/format";

export default async function Home() {
  let prices = [] as Awaited<ReturnType<typeof getHomePrices>>["prices"];
  let lastUpdatedAt: string | null = null;
  let errorMessage: string | null = null;

  try {
    const response = await getHomePrices();
    prices = response.prices;
    lastUpdatedAt = response.lastUpdatedAt;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Falha inesperada ao buscar top moedas.";
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-14 sm:px-6">
      <h1 className="text-center text-4xl font-bold leading-tight sm:text-6xl">
        Criptomoedas com <span className="text-cyan-300">CriptoInvest</span>
      </h1>

      <h2 className="mx-auto mt-6 max-w-3xl text-center text-base text-slate-300 sm:text-lg">
          Top 10 Preços das criptomoedas por capitalização de mercado
      </h2>

      <section className="mt-10 rounded-xl border border-slate-800 bg-slate-900/50 p-3 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100 sm:text-xl">Top 10 Criptomoedas</h3>
          <span className="text-xs text-slate-400 sm:text-sm">Moeda: BRL</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1000px] w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="border-b border-slate-800 px-3 py-3">#</th>
                <th className="border-b border-slate-800 px-3 py-3">Moeda</th>
                <th className="border-b border-slate-800 px-3 py-3">Preço</th>
                <th className="border-b border-slate-800 px-3 py-3">1h</th>
                <th className="border-b border-slate-800 px-3 py-3">24h</th>
                <th className="border-b border-slate-800 px-3 py-3">7d</th>
                <th className="border-b border-slate-800 px-3 py-3">Volume 24h</th>
                <th className="border-b border-slate-800 px-3 py-3">Market Cap</th>
                <th className="border-b border-slate-800 px-3 py-3 w-24">Últimos 7 dias</th>
              </tr>
            </thead>
            <tbody>
              {prices.map((coin) => {
                const percCell = (value: number | null) => {
                  const isPositive = (value ?? 0) >= 0;
                  return (
                    <td
                      className={`border-b border-slate-800 px-3 py-4 font-medium ${
                        isPositive ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {formatPercentage(value)}
                    </td>
                  );
                };

                return (
                  <tr className="hover:bg-slate-800/40" key={coin.id}>
                    <td className="border-b border-slate-800 px-3 py-4 text-slate-200">
                      {coin.marketCapRank ?? "-"}
                    </td>
                    <td className="border-b border-slate-800 px-3 py-4">
                      <div className="flex items-center gap-3">
                        {coin.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt={`${coin.name} logo`}
                            className="h-7 w-7 rounded-full bg-slate-700"
                            src={coin.image}
                          />
                        ) : null}
                        <div>
                          <p className="font-medium text-slate-100">{coin.name}</p>
                          <p className="text-xs uppercase text-slate-400">{coin.symbol}</p>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-slate-800 px-3 py-4 font-semibold text-slate-100">
                      {formatCurrencyBrl(coin.currentPriceBrl)}
                    </td>
                    {percCell(coin.priceChangePercentage1h)}
                    {percCell(coin.priceChangePercentage24h)}
                    {percCell(coin.priceChangePercentage7d)}
                    <td className="border-b border-slate-800 px-3 py-4 font-semibold text-slate-100">
                      {formatCurrencyBrl(coin.totalVolumeBrl)}
                    </td>
                    <td className="border-b border-slate-800 px-3 py-4 font-semibold text-slate-100">
                      {formatCurrencyBrl(coin.marketCapBrl)}
                    </td>
                    <td className="border-b border-slate-800 px-3 py-4 align-middle">
                      <Sparkline
                        data={coin.sparkline7d}
                        id={coin.id}
                        positive={(coin.priceChangePercentage7d ?? 0) >= 0}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {errorMessage ? <p className="mt-4 text-sm text-rose-300">{errorMessage}</p> : null}

        {lastUpdatedAt ? (
          <p className="mt-4 text-sm text-slate-400">
            Última atualização: {new Date(lastUpdatedAt).toLocaleString("pt-BR")}
          </p>
        ) : null}
      </section>
    </main>
  );
}
