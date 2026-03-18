"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAuthSession } from "@/lib/auth";
import { openAuthModal } from "@/lib/auth-modal";
import { AuthControls } from "@/components/auth-controls";
import { Button } from "@/components/ui/button";
import { CircleStackIcon, HomeIcon, ListIcon, PlusIcon, SettingsIcon } from "@/components/ui/icons";

function syncLoggedIn() {
  return getAuthSession() !== null;
}

export function HomeNav() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(syncLoggedIn());
    const onAuthChanged = () => setLoggedIn(syncLoggedIn());
    window.addEventListener("auth:changed", onAuthChanged);
    return () => window.removeEventListener("auth:changed", onAuthChanged);
  }, []);

  return (
    <nav
      aria-label="Navegação principal"
      className="sticky top-0 z-[100] w-full border-b border-slate-800/80 bg-slate-950/95 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] backdrop-blur-md supports-[backdrop-filter]:bg-slate-950/85"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-3 sm:justify-between sm:gap-4">
        <div className="flex max-w-full flex-wrap items-center justify-center gap-2 sm:gap-3 md:gap-4">
          <Link href="/">
            <Button className="h-10 gap-2 rounded-full px-4" type="button" variant="outline">
              <HomeIcon className="text-cyan-300" />
              Resumo
            </Button>
          </Link>

          {loggedIn ? (
            <Link href="/minhas-criptos">
              <Button className="h-10 gap-2 rounded-full px-4" type="button" variant="outline">
                <CircleStackIcon className="text-cyan-300" />
                Minhas criptos
              </Button>
            </Link>
          ) : (
            <Button
              className="h-10 gap-2 rounded-full px-4"
              onClick={() => openAuthModal("login")}
              type="button"
              variant="outline"
            >
              <CircleStackIcon className="text-cyan-300" />
              Minhas criptos
            </Button>
          )}

          <Button
            className="h-10 gap-2 rounded-full px-4"
            onClick={() => {
              if (syncLoggedIn()) {
                window.dispatchEvent(new Event("portfolio:add-entry"));
              } else {
                openAuthModal("login");
              }
            }}
            type="button"
            variant="outline"
          >
            <PlusIcon className="text-cyan-300" />
            Incluir lançamento
          </Button>

          {loggedIn ? (
            <Link href="/lancamentos">
              <Button className="h-10 gap-2 rounded-full px-4" type="button" variant="outline">
                <ListIcon className="text-cyan-300" />
                Lançamentos
              </Button>
            </Link>
          ) : (
            <Button
              className="h-10 gap-2 rounded-full px-4"
              onClick={() => openAuthModal("login")}
              type="button"
              variant="outline"
            >
              <ListIcon className="text-cyan-300" />
              Lançamentos
            </Button>
          )}

          {loggedIn ? (
            <Link href="/configuracoes">
              <Button className="h-10 gap-2 rounded-full px-4" type="button" variant="outline">
                <SettingsIcon className="text-cyan-300" />
                Configurações
              </Button>
            </Link>
          ) : (
            <Button
              className="h-10 gap-2 rounded-full px-4"
              onClick={() => openAuthModal("login")}
              type="button"
              variant="outline"
            >
              <SettingsIcon className="text-cyan-300" />
              Configurações
            </Button>
          )}
        </div>

        <div className="flex w-full shrink-0 justify-center sm:w-auto sm:justify-end">
          <AuthControls />
        </div>
      </div>
    </nav>
  );
}
