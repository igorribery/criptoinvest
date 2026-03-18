"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAuthSession } from "@/lib/auth";
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

  useEffect(() => {
    if (!loggedIn) {
      document.body.style.paddingTop = "";
      return;
    }
    document.body.style.paddingTop =
      "calc(6.5rem + max(0px, env(safe-area-inset-top, 0px)))";
    return () => {
      document.body.style.paddingTop = "";
    };
  }, [loggedIn]);

  if (!loggedIn) {
    return null;
  }

  return (
    <nav
      aria-label="Navegação principal"
      className="pointer-events-none fixed left-0 right-0 top-0 z-30 flex justify-center px-4 pt-[max(2rem,env(safe-area-inset-top,0px))]"
    >
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-8 rounded-3xl p-2">
      <Link href="/">
        <Button className="h-10 gap-2 rounded-full px-4" type="button" variant="outline">
          <HomeIcon className="text-cyan-300" />
          Resumo
        </Button>
      </Link>
      <Link href="/minhas-criptos">
        <Button className="h-10 gap-2 rounded-full px-4" type="button" variant="outline">
          <CircleStackIcon className="text-cyan-300" />
          Minhas criptos
        </Button>
      </Link>
      <Button
        className="h-10 gap-2 rounded-full px-4"
        onClick={() => window.dispatchEvent(new Event("portfolio:add-entry"))}
        type="button"
        variant="outline"
      >
        <PlusIcon className="text-cyan-300" />
        Incluir lançamento
      </Button>
      <Link href="/lancamentos">
        <Button className="h-10 gap-2 rounded-full px-4" type="button" variant="outline">
          <ListIcon className="text-cyan-300" />
          Lançamentos
        </Button>
      </Link>
      <Link href="/configuracoes">
        <Button className="h-10 gap-2 rounded-full px-4" type="button" variant="outline">
          <SettingsIcon className="text-cyan-300" />
          Configurações
        </Button>
      </Link>
      </div>
    </nav>
  );
}

