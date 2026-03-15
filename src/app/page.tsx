export const revalidate = 60;

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-14 sm:px-6">
      <h1 className="text-center text-4xl font-bold leading-tight sm:text-6xl">
        Criptomoedas com <span className="text-cyan-300">CriptoInvest</span>
      </h1>

      <h2 className="mx-auto mt-6 max-w-3xl text-center text-base text-slate-300 sm:text-lg">
        Top 10 preços das criptomoedas por capitalização de mercado
      </h2>

      <Card className="mt-10 rounded-xl bg-slate-900/50 p-3 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100 sm:text-xl">Top 10 Criptomoedas</h3>
          <span className="text-xs text-slate-400 sm:text-sm">Moeda: BRL</span>
        </div>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>#</TableHead>
                  <TableHead>Moeda</TableHead>
                  <TableHead>Preco</TableHead>
                  <TableHead>1h</TableHead>
                  <TableHead>24h</TableHead>
                  <TableHead>7d</TableHead>
                  <TableHead>Volume 24h</TableHead>
                  <TableHead>Market Cap</TableHead>
                  <TableHead className="w-24">Ultimos 7 dias</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prices.map((coin) => {
                  const percCell = (value: number | null) => {
                    const isPositive = (value ?? 0) >= 0;
                    return (
                      <TableCell className={isPositive ? "font-medium text-emerald-400" : "font-medium text-rose-400"}>
                        {formatPercentage(value)}
                      </TableCell>
                    );
                  };

                  return (
                    <TableRow key={coin.id}>
                      <TableCell className="text-slate-200">{coin.marketCapRank ?? "-"}</TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell className="font-semibold text-slate-100">
                        {formatCurrencyBrl(coin.currentPriceBrl)}
                      </TableCell>
                      {percCell(coin.priceChangePercentage1h)}
                      {percCell(coin.priceChangePercentage24h)}
                      {percCell(coin.priceChangePercentage7d)}
                      <TableCell className="font-semibold text-slate-100">
                        {formatCurrencyBrl(coin.totalVolumeBrl)}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-100">
                        {formatCurrencyBrl(coin.marketCapBrl)}
                      </TableCell>
                      <TableCell className="align-middle">
                        <Sparkline
                          data={coin.sparkline7d}
                          id={coin.id}
                          positive={
                            coin.sparkline7d.length >= 2
                              ? coin.sparkline7d[coin.sparkline7d.length - 1] >= coin.sparkline7d[0]
                              : (coin.priceChangePercentage7d ?? 0) >= 0
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        {errorMessage ? <p className="mt-4 text-sm text-rose-300">{errorMessage}</p> : null}

        {lastUpdatedAt ? (
          <p className="mt-4 text-sm text-slate-400">
            Última atualização: {new Date(lastUpdatedAt).toLocaleString("pt-BR")}
          </p>
        ) : null}
      </Card>
    </main>
  );
}
