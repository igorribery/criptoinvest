"use client";

import { useMemo } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";

type Slice = {
  label: string;
  value: number;
  symbol?: string;
};

const COLORS = ["#22d3ee", "#38bdf8", "#a78bfa", "#34d399", "#f59e0b", "#fb7185", "#60a5fa", "#f472b6", "#c084fc"];

function formatPct(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatBrl(value: number) {
  if (!Number.isFinite(value)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function PortfolioAllocationChart({
  title = "Alocação por valor aplicado",
  slices,
}: {
  title?: string;
  slices: Slice[];
}) {
  const { data, total } = useMemo(() => {
    const cleaned = slices
      .map((s) => ({ ...s, value: Number(s.value) }))
      .filter((s) => Number.isFinite(s.value) && s.value > 0);
    const t = cleaned.reduce((acc, s) => acc + s.value, 0);
    return { data: cleaned, total: t };
  }, [slices]);

  return (
    <Card className="rounded-2xl bg-slate-950/50 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-100">{title}</p>
          <p className="mt-1 text-xs text-slate-400">Base: soma do valor aplicado por ativo</p>
        </div>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-[240px_1fr]">
        <div className="h-[220px] w-full">
          {data.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={2}
                  stroke="rgba(15,23,42,0.35)"
                >
                  {data.map((_, index) => (
                    <Cell key={`slice-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: unknown, name: unknown) => {
                    const v = Number(value);
                    const pct = total > 0 ? (v / total) * 100 : 0;
                    return [formatBrl(v), `${String(name)} · ${formatPct(pct)}`];
                  }}
                  contentStyle={{
                    background: "rgba(2,6,23,0.95)",
                    border: "1px solid rgba(148,163,184,0.25)",
                    borderRadius: 16,
                    color: "white",
                  }}
                  itemStyle={{ color: "rgba(226,232,240,0.92)" }}
                  labelStyle={{ color: "rgba(148,163,184,0.9)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/30 text-sm text-slate-500">
              Sem dados para exibir
            </div>
          )}
        </div>

        <div className="grid content-start gap-2">
          {data
            .slice()
            .sort((a, b) => b.value - a.value)
            .map((s, idx) => {
              const pct = total > 0 ? (s.value / total) * 100 : 0;
              return (
                <div className="flex items-center justify-between gap-3" key={`${s.label}-${idx}`}>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: COLORS[idx % COLORS.length] }}
                    />
                    <div
                      className={
                        s.symbol
                          ? "grid min-w-0 flex-1 grid-cols-[3.5rem_1fr] items-baseline gap-x-2"
                          : "min-w-0 flex-1"
                      }
                    >
                      {s.symbol ? (
                        <span className="truncate text-right text-sm font-medium tabular-nums text-cyan-400">
                          {s.symbol}
                        </span>
                      ) : null}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-100">
                          {s.symbol ? <span className="text-slate-500">· </span> : null}
                          {s.label}
                        </p>
                        <p className="text-xs text-slate-400">{formatPct(pct)}</p>
                      </div>
                    </div>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-slate-200">{formatBrl(s.value)}</p>
                </div>
              );
            })}
        </div>
      </div>
    </Card>
  );
}

