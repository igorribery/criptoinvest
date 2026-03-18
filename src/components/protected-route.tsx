"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthSession } from "@/lib/auth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    function syncAuthState() {
      const session = getAuthSession();

      if (!session) {
        setIsAuthorized(false);
        window.dispatchEvent(new CustomEvent("auth:open", { detail: { mode: "login" } }));
        router.replace("/");
        return;
      }

      setIsAuthorized(true);
    }

    syncAuthState();
    window.addEventListener("auth:changed", syncAuthState);

    return () => window.removeEventListener("auth:changed", syncAuthState);
  }, [router]);

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="rounded-full border border-cyan-500/20 bg-slate-950/80 px-5 py-3 text-sm text-cyan-100">
          Validando sua sessão...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
