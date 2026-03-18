"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { getAuthSession } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { PortfolioAllocationChart } from "@/components/portfolio-allocation-chart";

type SummaryAsset = {
  asset_type: string;
  symbol: string;
  asset_name: string;
  total_quantity: string;
  total_invested_brl: string;
  average_price_brl: string;
};

type PortfolioSummary = {
  totalInvestedBrl: string;
  assets: SummaryAsset[];
};

type PortfolioEntry = {
  id: string;
  side?: string;
  symbol: string;
  asset_name: string;
  purchase_date: string;
  quantity: string;
  unit_price_brl: string;
  total_value_brl: string;
};

type SpotPricesResponse = {
  currency: string;
  prices: Record<string, number | null>;
  images?: Record<string, string | null>;
};

function formatBrl(value: string | number) {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function formatDate(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function formatVariationPct(avgPrice: number, currentPrice: number): string {
  if (!Number.isFinite(avgPrice) || avgPrice <= 0 || !Number.isFinite(currentPrice)) return "—";
  const pct = ((currentPrice - avgPrice) / avgPrice) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function formatCryptoQty6(value: number, fallback: string) {
  if (!Number.isFinite(value)) return fallback;
  return value.toFixed(6);
}

export function MinhasCriptosDashboard() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spotPrices, setSpotPrices] = useState<Record<string, number | null>>({});
  const [coinImages, setCoinImages] = useState<Record<string, string | null>>({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesError, setPricesError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const session = getAuthSession();
    if (!session?.token) return;

    setError(null);
    try {
      const headers = { Authorization: `Bearer ${session.token}` };
      const [sum, list] = await Promise.all([
        api.get<PortfolioSummary>("/portfolio/summary", headers),
        api.get<{ items: PortfolioEntry[] }>("/portfolio/entries", headers),
      ]);
      setSummary(sum);
      setEntries(list.items ?? []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível carregar a carteira.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function onPortfolioChanged() {
      setLoading(true);
      load();
    }
    window.addEventListener("portfolio:changed", onPortfolioChanged);
    return () => window.removeEventListener("portfolio:changed", onPortfolioChanged);
  }, [load]);

  const assetSymbols = useMemo(() => {
    if (!summary?.assets?.length) return "";
    return [...new Set(summary.assets.map((a) => a.symbol.toUpperCase()))].join(",");
  }, [summary?.assets]);

  useEffect(() => {
    if (!assetSymbols) {
      setSpotPrices({});
      setCoinImages({});
      setPricesError(null);
      return;
    }

    let cancelled = false;
    setPricesLoading(true);
    setPricesError(null);

    api
      .get<SpotPricesResponse>(`/market/spot-prices?symbols=${encodeURIComponent(assetSymbols)}`)
      .then((res) => {
        if (!cancelled) {
          setSpotPrices(res.prices ?? {});
          setCoinImages(res.images ?? {});
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSpotPrices({});
          setCoinImages({});
          setPricesError("Cotações indisponíveis no momento.");
        }
      })
      .finally(() => {
        if (!cancelled) setPricesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [assetSymbols]);

  const marketTotals = useMemo(() => {
    if (!summary?.assets?.length) {
      return { totalMercado: 0, hasAnyPrice: false };
    }
    let totalMercado = 0;
    let hasAnyPrice = false;
    for (const a of summary.assets) {
      const qty = Number(a.total_quantity);
      const sym = a.symbol.toUpperCase();
      const p = spotPrices[sym];
      if (typeof p === "number" && Number.isFinite(p) && Number.isFinite(qty)) {
        totalMercado += qty * p;
        hasAnyPrice = true;
      }
    }
    return { totalMercado, hasAnyPrice };
  }, [summary?.assets, spotPrices]);

  const allocationSlices = useMemo(() => {
    const assets = summary?.assets ?? [];
    return assets
      .map((a) => {
        const value = Number(a.total_invested_brl);
        return {
          label: a.asset_name,
          symbol: a.symbol,
          value: Number.isFinite(value) ? value : 0,
        };
      })
      .filter((s) => s.value > 0);
  }, [summary?.assets]);

  if (loading && !summary && !entries.length) {
    return (
      <div className="mt-10 rounded-2xl border border-slate-700 bg-slate-950/50 px-6 py-10 text-center text-slate-400">
        Carregando sua carteira…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-10 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-6 py-6 text-rose-100">
        {error}
      </div>
    );
  }

  const assetCount = summary?.assets?.length ?? 0;
  const totalInvested = Number(summary?.totalInvestedBrl ?? 0);
  const { totalMercado, hasAnyPrice } = marketTotals;
  const variacaoCarteira =
    hasAnyPrice && totalInvested > 0
      ? ((totalMercado - totalInvested) / totalInvested) * 100
      : null;

  return (
    <>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl bg-slate-950/70 p-5">
          <p className="text-sm text-slate-400">Ativos na carteira</p>
          <p className="mt-2 text-3xl font-semibold text-cyan-300">{assetCount}</p>
        </Card>
        <Card className="rounded-2xl bg-slate-950/70 p-5">
          <p className="text-sm text-slate-400">Valor aplicado</p>
          <p className="mt-2 text-3xl font-semibold text-slate-100">{formatBrl(totalInvested)}</p>
        </Card>
        <Card className="rounded-2xl bg-slate-950/70 p-5">
          <p className="text-sm text-slate-400">Saldo bruto</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-300">
            {pricesLoading ? "…" : hasAnyPrice ? formatBrl(totalMercado) : "—"}
          </p>
          {variacaoCarteira !== null && !pricesLoading ? (
            <p
              className={
                variacaoCarteira >= 0 ? "mt-1 text-sm text-emerald-400" : "mt-1 text-sm text-rose-400"
              }
            >
              {variacaoCarteira >= 0 ? "▲" : "▼"} {variacaoCarteira >= 0 ? "+" : ""}
              {variacaoCarteira.toFixed(2)}% vs. valor aplicado
            </p>
          ) : null}
        </Card>
      </div>

      {pricesError ? (
        <p className="mt-3 text-sm text-amber-400/90">{pricesError}</p>
      ) : null}

      {allocationSlices.length ? (
        <div className="mt-8">
          <PortfolioAllocationChart slices={allocationSlices} />
        </div>
      ) : null}

      {assetCount > 0 ? (
        <Card className="mt-8 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/50 p-0">
          <p className="border-b border-slate-800 px-6 py-2 text-xs text-slate-500">
            Preço atual, saldo e variação usam cotações em tempo real da{" "}
            <span className="text-slate-400">CoinGecko</span> (BRL).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/80 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Ativo</th>
                  <th className="px-3 py-3 font-medium text-right">Qtd.</th>
                  <th className="px-3 py-3 font-medium text-right">Preço médio</th>
                  <th className="px-3 py-3 font-medium text-right">Preço atual</th>
                  <th className="px-3 py-3 font-medium text-right">Variação</th>
                  <th className="px-3 py-3 font-medium text-right">Saldo</th>
                  <th className="px-4 py-3 font-medium text-right">Valor aplicado</th>
                </tr>
              </thead>
              <tbody>
                {summary!.assets.map((a) => {
                  const qty = Number(a.total_quantity);
                  const avg = Number(a.average_price_brl);
                  const aplicado = Number(a.total_invested_brl);
                  const sym = a.symbol.toUpperCase();
                  const cur = spotPrices[sym];
                  const hasPrice = typeof cur === "number" && Number.isFinite(cur);
                  const saldo = hasPrice && Number.isFinite(qty) ? qty * cur! : null;
                  const varStr = hasPrice ? formatVariationPct(avg, cur!) : "—";
                  const varNum =
                    hasPrice && avg > 0 ? ((cur! - avg) / avg) * 100 : null;

                  return (
                    <tr
                      className="border-b border-slate-800/80 last:border-0 hover:bg-slate-900/30"
                      key={`${a.symbol}-${a.asset_name}`}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-600/60 bg-white p-0.5 shadow-sm">
                            {coinImages[sym] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={coinImages[sym]!}
                                alt=""
                                width={32}
                                height={32}
                                className="h-8 w-8 rounded-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold uppercase text-slate-600"
                                aria-hidden
                              >
                                {sym.slice(0, 3)}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-cyan-400">{a.symbol}</span>
                            <span className="ml-2 text-slate-300">{a.asset_name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-right tabular-nums text-slate-200">
                        {formatCryptoQty6(qty, a.total_quantity)}
                      </td>
                      <td className="px-3 py-4 text-right tabular-nums text-slate-300">
                        {formatBrl(avg)}
                      </td>
                      <td className="px-3 py-4 text-right tabular-nums text-slate-200">
                        {pricesLoading ? (
                          <span className="text-slate-500">…</span>
                        ) : hasPrice ? (
                          formatBrl(cur!)
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-3 py-4 text-right">
                        {pricesLoading ? (
                          <span className="text-slate-500">…</span>
                        ) : varNum === null ? (
                          <span className="text-slate-500">—</span>
                        ) : (
                          <span
                            className={
                              varNum >= 0
                                ? "font-medium text-emerald-400"
                                : "font-medium text-rose-400"
                            }
                          >
                            {varNum >= 0 ? "↑ " : "↓ "}
                            {varStr}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-4 text-right font-medium tabular-nums text-slate-100">
                        {pricesLoading ? (
                          <span className="text-slate-500">…</span>
                        ) : saldo !== null ? (
                          formatBrl(saldo)
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right font-medium tabular-nums text-cyan-300/95">
                        {formatBrl(aplicado)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </>
  );
}
