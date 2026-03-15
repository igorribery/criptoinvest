"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import {
  AuthUser,
  clearAuthSession,
  consumeAuthError,
  getAuthSession,
  saveAuthSession,
} from "@/lib/auth";

type Mode = "login" | "register";

type AuthResponse = {
  token: string;
  user: AuthUser;
};

export function AuthControls() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mode, setMode] = useState<Mode>("login");
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setUser(getAuthSession()?.user ?? null);
    };

    sync();
    window.addEventListener("auth:changed", sync);
    return () => window.removeEventListener("auth:changed", sync);
  }, []);

  useEffect(() => {
    const pendingError = consumeAuthError();

    if (!pendingError) {
      return;
    }

    setMode("login");
    setError(pendingError);
    setIsOpen(true);
  }, []);

  const title = useMemo(() => (mode === "login" ? "Entrar" : "Criar conta"), [mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const payload =
        mode === "login"
          ? await api.post<AuthResponse>("/auth/login", { email, password })
          : await api.post<AuthResponse>("/auth/register", { name, email, password });

      saveAuthSession(payload);
      setIsOpen(false);
      setPassword("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha no login.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    setIsSubmitting(true);

    try {
      const payload = await api.get<{ authUrl: string }>("/auth/google/url");
      window.location.href = payload.authUrl;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha no login Google.");
      setIsSubmitting(false);
    }
  }

  function logout() {
    clearAuthSession();
    setUser(null);
  }

  return (
    <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
      {user ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm">
          <span className="max-w-32 truncate text-slate-200">Ola, {user.name}</span>
          <button
            className="rounded-md border border-slate-600 px-2 py-1 text-slate-300 hover:bg-slate-800"
            onClick={logout}
            type="button"
          >
            Sair
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-800"
            onClick={() => {
              setError(null);
              setMode("register");
              setIsOpen(true);
            }}
            type="button"
          >
            Cadastrar
          </button>
          <button
            className="rounded-md bg-cyan-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
            onClick={() => {
              setError(null);
              setMode("login");
              setIsOpen(true);
            }}
            type="button"
          >
            Login
          </button>
        </div>
      )}

      {isOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-100">{title}</h3>
              <button
                className="text-slate-300 hover:text-white"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                x
              </button>
            </div>

            <form className="space-y-3" onSubmit={handleSubmit}>
              {mode === "register" ? (
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nome"
                  required
                  value={name}
                />
              ) : null}

              <input
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                required
                type="email"
                value={email}
              />

              <input
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Senha"
                required
                type="password"
                value={password}
              />

              {error ? <p className="text-sm text-rose-300">{error}</p> : null}

              <button
                className="w-full rounded-md bg-cyan-500 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-wait disabled:opacity-70"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-3">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                    <span>Validando acesso...</span>
                  </span>
                ) : (
                  title
                )}
              </button>

              {isSubmitting ? (
                <div className="space-y-2 rounded-md border border-cyan-500/20 bg-cyan-500/10 px-3 py-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-cyan-400" />
                  </div>
                  <p className="text-center text-xs text-cyan-100">
                    Estamos verificando suas credenciais com seguranca.
                  </p>
                </div>
              ) : null}
            </form>

            <div className="my-4 h-px bg-slate-700" />

            <button
              className="w-full rounded-md border border-slate-600 py-2 text-slate-100 hover:bg-slate-800 disabled:opacity-60"
              disabled={isSubmitting}
              onClick={handleGoogleLogin}
              type="button"
            >
              Entrar com o Google
            </button>

            <p className="mt-3 text-center text-sm text-slate-400">
              {mode === "login" ? "Nao tem conta?" : "Ja tem conta?"}{" "}
              <button
                className="text-cyan-300 hover:text-cyan-200"
                onClick={() => {
                  setError(null);
                  setMode(mode === "login" ? "register" : "login");
                }}
                type="button"
              >
                {mode === "login" ? "Cadastre-se" : "Entrar"}
              </button>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AuthGoogleCallbackInfo() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center text-slate-200">
      <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-6">
        <h1 className="text-2xl font-semibold">Conectando sua conta Google...</h1>
        <p className="mt-2 text-slate-300">Se demorar muito, voce voltara para a tela inicial.</p>
      </div>
    </div>
  );
}
