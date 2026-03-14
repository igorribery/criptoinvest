export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-20 text-center">
      <span className="mb-6 rounded-full border border-cyan-300/40 bg-cyan-300/10 px-4 py-1 text-xs uppercase tracking-[0.25em] text-cyan-300">
        Stack configurada
      </span>

      <h1 className="text-4xl font-bold leading-tight sm:text-6xl">
        CriptoInvest com <span className="text-cyan-300">Next.js + TypeScript</span>
      </h1>

      <p className="mt-6 max-w-2xl text-base text-slate-300 sm:text-lg">
        Projeto inicial pronto com Node.js, Next.js (App Router), TypeScript,
        Tailwind CSS e ESLint para começar a construir sua plataforma cripto.
      </p>
    </main>
  );
}
