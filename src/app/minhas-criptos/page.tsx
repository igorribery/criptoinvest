import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ProtectedRoute } from "@/components/protected-route";
import { ArrowLeftIcon } from "@/components/ui/icons";

export default function MinhasCriptosPage() {
  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] px-4 pb-14 pt-28 text-slate-100 sm:px-6 sm:pt-32">
        <div className="mx-auto max-w-5xl">
          <Card className="p-8">
            <div className="flex items-center gap-3">
              <Link
                className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-500/40 bg-slate-950/80 text-cyan-300 transition hover:border-cyan-300 hover:bg-slate-900"
                href="/"
              >
                <ArrowLeftIcon />
              </Link>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Área do investidor</p>
            </div>

            <h1 className="mt-4 text-4xl font-bold">Minhas criptos</h1>
            <p className="mt-4 max-w-2xl text-slate-300">
              Esta tela vai reunir os ativos cadastrados pelo usuário, com quantidade, preço médio e
              evolução da carteira. Por enquanto, deixei a estrutura pronta para conectarmos os dados no próximo passo.
            </p>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <Card className="rounded-2xl bg-slate-950/70 p-5">
                <p className="text-sm text-slate-400">Ativos cadastrados</p>
                <p className="mt-2 text-3xl font-semibold text-cyan-300">0</p>
              </Card>
              <Card className="rounded-2xl bg-slate-950/70 p-5">
                <p className="text-sm text-slate-400">Valor total</p>
                <p className="mt-2 text-3xl font-semibold text-slate-100">R$ 0,00</p>
              </Card>
              <Card className="rounded-2xl bg-slate-950/70 p-5">
                <p className="text-sm text-slate-400">Status</p>
                <p className="mt-2 text-3xl font-semibold text-amber-300">Em montagem</p>
              </Card>
            </div>

            <CardContent className="mt-8 rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-8 text-center">
              <p className="text-lg font-medium">Nenhuma cripto cadastrada ainda</p>
              <p className="mt-2 text-slate-400">
                Use o menu do perfil para abrir o modal de "Adicionar criptos".
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </ProtectedRoute>
  );
}
