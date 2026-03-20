"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type PasswordResetResponse = {
  message: string;
};

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const hasStartedConfirming = newPassword.length > 0 && confirmPassword.length > 0;
  const isTokenMissing = token.length === 0;

  const submitDisabled = useMemo(() => {
    if (isSubmitting || isTokenMissing) return true;
    if (newPassword.length < 6 || confirmPassword.length < 6) return true;
    return !passwordsMatch;
  }, [confirmPassword.length, isSubmitting, isTokenMissing, newPassword.length, passwordsMatch]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (isTokenMissing) {
      setError("Link inválido. Solicite uma nova recuperação de senha.");
      return;
    }

    if (!passwordsMatch) {
      setError("As senhas precisam ser iguais.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = await api.post<PasswordResetResponse>("/auth/password/reset", {
        token,
        newPassword,
      });

      setMessage(payload.message);
      setNewPassword("");
      setConfirmPassword("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível redefinir a senha.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-12 sm:px-6">
      <Card className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-950/80 p-2 shadow-2xl shadow-cyan-950/10">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="space-y-2 text-center">
            <p className="text-sm uppercase tracking-[0.24em] text-cyan-300">CriptoInvest</p>
            <h1 className="text-3xl font-semibold text-white">Definir nova senha</h1>
            <p className="text-sm text-slate-400">
              Escolha uma nova senha para voltar a acessar sua conta.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              minLength={6}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Nova senha"
              required
              type="password"
              value={newPassword}
            />

            <Input
              className={cn(
                passwordsMatch ? "border-emerald-500 focus:border-emerald-400" : "",
                hasStartedConfirming && !passwordsMatch ? "border-rose-500 focus:border-rose-400" : "",
              )}
              minLength={6}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirmar nova senha"
              required
              type="password"
              value={confirmPassword}
            />

            {hasStartedConfirming ? (
              <p className={cn("text-sm", passwordsMatch ? "text-emerald-300" : "text-rose-300")}>
                {passwordsMatch ? "As senhas conferem." : "As senhas precisam ser iguais."}
              </p>
            ) : null}

            {message ? (
              <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {message}
              </p>
            ) : null}

            {error ? (
              <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </p>
            ) : null}

            <Button className="w-full rounded-xl" disabled={submitDisabled} type="submit">
              {isSubmitting ? "Salvando nova senha..." : "Salvar nova senha"}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-400">
            <Link className="text-cyan-300 transition hover:text-cyan-200" href="/">
              Voltar para a página inicial
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
