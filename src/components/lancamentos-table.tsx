"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { getAuthSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CardContent } from "@/components/ui/card";
import { PlusIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

type PortfolioEntry = {
  id: string;
  asset_type?: string;
  side?: "BUY" | "SELL" | string;
  symbol: string;
  asset_name: string;
  purchase_date: string;
  quantity: string;
  unit_price_brl: string;
  total_value_brl: string;
};

type EntriesResponse = {
  items: PortfolioEntry[];
  total: number;
  limit: number;
  offset: number;
};

type SideFilter = "ALL" | "BUY" | "SELL";

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

function clampPage(page: number, maxPage: number) {
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(page, Math.max(1, maxPage));
}

export function LancamentosTable() {
  const PAGE_SIZE = 10;

  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [sideFilter, setSideFilter] = useState<SideFilter>("ALL");
  const [data, setData] = useState<EntriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PortfolioEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    const session = getAuthSession();
    if (!session?.token) return;

    setError(null);
    setLoading(true);

    try {
      const offset = (page - 1) * PAGE_SIZE;
      const headers = { Authorization: `Bearer ${session.token}` };
      const payload = await api.get<EntriesResponse>(
        `/portfolio/entries?limit=${PAGE_SIZE}&offset=${offset}`,
        headers,
      );
      setData(payload);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível carregar os lançamentos.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function onPortfolioChanged() {
      setPage(1);
      load();
    }
    window.addEventListener("portfolio:changed", onPortfolioChanged);
    return () => window.removeEventListener("portfolio:changed", onPortfolioChanged);
  }, [load]);

  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    const q = query.trim().toLowerCase();
    return items.filter((row) => {
      const side = row.side === "SELL" ? "SELL" : "BUY";
      if (sideFilter !== "ALL" && side !== sideFilter) return false;
      if (!q) return true;
      return `${row.asset_name} ${row.symbol}`.toLowerCase().includes(q);
    });
  }, [data?.items, query, sideFilter]);

  const handleEdit = useCallback((row: PortfolioEntry) => {
    window.dispatchEvent(new CustomEvent("portfolio:edit-entry", { detail: row }));
  }, []);

  const handleDelete = useCallback(
    async (row: PortfolioEntry) => {
      setError(null);
      setPendingDelete(row);
    },
    [],
  );

  const confirmDelete = useCallback(async () => {
    const row = pendingDelete;
    if (!row) return;
    const session = getAuthSession();
    if (!session?.token) return;

    setIsDeleting(true);
    setError(null);
    try {
      await api.delete(`/portfolio/entries/${row.id}`, { Authorization: `Bearer ${session.token}` });
      setPendingDelete(null);
      window.dispatchEvent(new Event("portfolio:changed"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível excluir o lançamento.");
    } finally {
      setIsDeleting(false);
    }
  }, [pendingDelete]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    setPage((p) => clampPage(p, totalPages));
  }, [totalPages]);

  const pageNumbers = useMemo(() => {
    const maxButtons = 7;
    const pages: Array<number | "..."> = [];
    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    const left = Math.max(1, page - 1);
    const right = Math.min(totalPages, page + 1);
    pages.push(1);
    if (left > 2) pages.push("...");
    for (let i = left; i <= right; i++) {
      if (i !== 1 && i !== totalPages) pages.push(i);
    }
    if (right < totalPages - 1) pages.push("...");
    pages.push(totalPages);
    return pages;
  }, [page, totalPages]);

  return (
    <>
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <Input
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar ativo (ex.: BTC, Ethereum)"
            value={query}
          />
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          {/* <Button
            className="h-11 gap-2 rounded-full px-4"
            onClick={() => window.dispatchEvent(new Event("portfolio:add-entry"))}
            type="button"
            variant="outline"
          >
            <PlusIcon className="h-4 w-4 text-cyan-300" />
            Incluir lançamento
          </Button> */}
          <div className="grid grid-cols-3 rounded-full border border-slate-800 bg-slate-950 p-1">
            <Button
              className="h-9 rounded-full px-4 text-xs"
              onClick={() => setSideFilter("ALL")}
              type="button"
              variant={sideFilter === "ALL" ? "default" : "outline"}
            >
              TODOS
            </Button>
            <Button
              className="h-9 rounded-full px-4 text-xs"
              onClick={() => setSideFilter("BUY")}
              type="button"
              variant={sideFilter === "BUY" ? "default" : "outline"}
            >
              COMPRA
            </Button>
            <Button
              className="h-9 rounded-full px-4 text-xs"
              onClick={() => setSideFilter("SELL")}
              type="button"
              variant={sideFilter === "SELL" ? "default" : "outline"}
            >
              VENDA
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/40 px-5 py-10 text-center text-sm text-slate-400">
          Carregando lançamentos…
        </div>
      ) : null}

      {!loading && !error && !filteredItems.length ? (
        <CardContent className="mt-6 rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-8 text-center">
          <p className="text-lg font-medium">Nenhum lançamento encontrado</p>
          <p className="mt-2 text-slate-400">
            Ajuste os filtros ou use o menu do perfil para adicionar uma compra/venda.
          </p>
        </CardContent>
      ) : null}

      {!loading && !error && filteredItems.length ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/40">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Ativo</th>
                  <th className="px-4 py-3 font-medium">Ordem</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium text-right">Quantidade</th>
                  <th className="px-4 py-3 font-medium text-right">Preço unitário</th>
                  <th className="px-4 py-3 font-medium text-right">Valor total</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredItems.map((row) => {
                  const side = row.side === "SELL" ? "SELL" : "BUY";
                  return (
                    <tr className="hover:bg-slate-900/30" key={row.id}>
                      <td className="px-4 py-4 text-slate-300">Criptomoedas</td>
                      <td className="px-4 py-4">
                        <span className="font-semibold text-cyan-400">{row.symbol}</span>
                        <span className="ml-2 text-slate-300">{row.asset_name}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            side === "BUY"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-rose-500/15 text-rose-300",
                          )}
                        >
                          {side === "BUY" ? "Compra" : "Venda"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-300">{formatDate(row.purchase_date)}</td>
                      <td className="px-4 py-4 text-right tabular-nums text-slate-200">
                        {Number(row.quantity).toFixed(7)}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums text-slate-200">
                        {formatBrl(row.unit_price_brl)}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-100">
                        {formatBrl(row.total_value_brl)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            className="h-9 px-3 text-xs"
                            onClick={() => handleEdit(row)}
                            type="button"
                            variant="outline"
                          >
                            Editar
                          </Button>
                          <Button
                            className="h-9 px-3 text-xs"
                            onClick={() => handleDelete(row)}
                            type="button"
                            variant="danger"
                          >
                            Excluir
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-800 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Página <span className="text-slate-300">{page}</span> de{" "}
              <span className="text-slate-300">{totalPages}</span> · Mostrando{" "}
              <span className="text-slate-300">{data?.items?.length ?? 0}</span> de{" "}
              <span className="text-slate-300">{total}</span>
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
              <Button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                size="sm"
                variant="outline"
              >
                Anterior
              </Button>

              {pageNumbers.map((p, idx) =>
                p === "..." ? (
                  <span className="px-2 text-sm text-slate-500" key={`ellipsis-${idx}`}>
                    …
                  </span>
                ) : (
                  <Button
                    className="min-w-10"
                    key={`page-${p}`}
                    onClick={() => setPage(p)}
                    size="sm"
                    variant={p === page ? "default" : "outline"}
                  >
                    {p}
                  </Button>
                ),
              )}

              <Button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                size="sm"
                variant="outline"
              >
                Próximo
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={Boolean(pendingDelete)}>
        <DialogContent className="max-w-lg">

          <div className="space-y-2">
            <p className="text-slate-200">
              Tem certeza que deseja excluir este lançamento?
            </p>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end">
            <Button
              disabled={isDeleting}
              onClick={() => setPendingDelete(null)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              disabled={isDeleting}
              onClick={confirmDelete}
              type="button"
              variant="danger"
            >
              {isDeleting ? "Excluindo…" : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

