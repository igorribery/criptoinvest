import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ProtectedRoute } from "@/components/protected-route";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { LancamentosTable } from "@/components/lancamentos-table";
import { LancamentosHeaderActions } from "@/components/lancamentos-header-actions";

export default function LancamentosPage() {
  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] px-4 pb-14 pt-8 text-slate-100 sm:px-6 sm:pt-10">
        <div className="mx-auto max-w-5xl">
          <Card className="p-8">
            <div className="flex items-center gap-3">
              <Link
                className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-500/40 bg-slate-950/80 text-cyan-300 transition hover:border-cyan-300 hover:bg-slate-900"
                href="/"
              >
                <ArrowLeftIcon />
              </Link>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Movimentações</p>
            </div>

            <h1 className="mt-4 text-4xl font-bold">Lançamentos</h1>
            <p className="mt-4 max-w-2xl text-slate-300">
              Aqui ficam todas as suas compras e vendas, com paginação e busca por ativo.
            </p>

            <div className="flex justify-end">
              <LancamentosHeaderActions />
            </div>

            <LancamentosTable />
          </Card>
        </div>
      </main>
    </ProtectedRoute>
  );
}
