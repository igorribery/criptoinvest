"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthGoogleCallbackInfo } from "@/components/auth-controls";
import { api } from "@/lib/api";
import { AuthUser, saveAuthSession } from "@/lib/auth";

type AuthResponse = {
  token: string;
  user: AuthUser;
};

export default function GoogleCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");

    if (!code) {
      setError("Google não retornou um código de autenticação.");
      return;
    }

    api
      .post<AuthResponse>("/auth/google/exchange", { code })
      .then((payload) => {
        saveAuthSession(payload);
        router.replace("/");
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Erro no login com Google.");
      });
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-slate-200">
        <div className="rounded-lg border border-rose-700 bg-slate-900/80 p-6">
          <h1 className="text-2xl font-semibold text-rose-300">Falha no login com Google</h1>
          <p className="mt-2 text-slate-300">{error}</p>
        </div>
      </div>
    );
  }

  return <AuthGoogleCallbackInfo />;
}
