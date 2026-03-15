"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthGoogleCallbackInfo } from "@/components/auth-controls";
import { api } from "@/lib/api";
import { AuthUser, saveAuthError, saveAuthSession } from "@/lib/auth";

type AuthResponse = {
  token: string;
  user: AuthUser;
};

export default function GoogleCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [hasRedirectedOnError, setHasRedirectedOnError] = useState(false);

  useEffect(() => {
    const code = searchParams.get("code");

    if (!code) {
      saveAuthError("Google nao retornou um codigo de autenticacao.");
      setHasRedirectedOnError(true);
      router.replace("/");
      return;
    }

    api
      .post<AuthResponse>("/auth/google/exchange", { code })
      .then((payload) => {
        saveAuthSession(payload);
        router.replace("/");
      })
      .catch((requestError) => {
        const message =
          requestError instanceof Error ? requestError.message : "Erro no login com Google.";
        saveAuthError(message);
        setHasRedirectedOnError(true);
        router.replace("/");
      });
  }, [router, searchParams]);

  if (hasRedirectedOnError) {
    return null;
  }

  return <AuthGoogleCallbackInfo />;
}
