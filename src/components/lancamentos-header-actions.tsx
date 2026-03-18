"use client";

import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/icons";

export function LancamentosHeaderActions() {
  return (
    <Button
      className="h-11 gap-2 rounded-full px-4"
      onClick={() => window.dispatchEvent(new Event("portfolio:add-entry"))}
      type="button"
      variant="outline"
    >
      <PlusIcon className="h-4 w-4 text-cyan-300" />
      Incluir lançamento
    </Button>
  );
}

