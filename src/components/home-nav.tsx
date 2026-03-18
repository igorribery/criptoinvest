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

  if (!loggedIn) {
    return null;
  }

  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-8 rounded-3xl p-2">
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
  );
}

