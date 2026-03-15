import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ProtectedRoute } from "@/components/protected-route";
import { ArrowLeftIcon } from "@/components/ui/icons";

export default function LancamentosPage() {
  return (
    <ProtectedRoute>
      <main className="min-h-screen px-4 pb-14 pt-28 text-slate-100 sm:px-6 sm:pt-32">
        <div className="mx-auto max-w-5xl">
          <Card className="p-8">
            <div className="flex items-center gap-3">
              <Link
                className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-500/40 bg-slate-950/80 text-cyan-300 transition hover:border-cyan-300 hover:bg-slate-900"
                href="/"
              >
                <ArrowLeftIcon />
              </Link>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Movimentacoes</p>
            </div>

            <h1 className="mt-4 text-4xl font-bold">Lancamentos</h1>
            <p className="mt-4 max-w-2xl text-slate-300">
              Esta pagina vai listar compras e vendas registradas pelo usuario. O modal de adicionar
              transacao ja ficou preparado para alimentar essa tela no proximo passo.
            </p>

            <CardContent className="mt-8 rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-8 text-center">
              <p className="text-lg font-medium">Nenhum lancamento registrado ainda</p>
              <p className="mt-2 text-slate-400">
                Use o menu do perfil para abrir "Adicionar criptos" e criar a primeira compra ou venda.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </ProtectedRoute>
  );
}
