"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import {
  clearAuthSession,
  consumeAuthError,
  getAuthSession,
  getRememberedLoginEmail,
  saveAuthSession,
  setRememberedLoginEmail,
} from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  CircleStackIcon,
  EyeIcon,
  EyeOffIcon,
  HomeIcon,
  ListIcon,
  LogoutIcon,
  PlusIcon,
  BellIcon,
  SettingsIcon,
  XIcon,
} from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { AuthUser } from "@/app/types/auth-types";

type Mode = "login" | "register" | "forgotPassword";
type RegisterStep = "form" | "verify";
type TransactionType = "buy" | "sell";
type PortfolioEditEntry = {
  id: string;
  side?: "BUY" | "SELL" | string;
  symbol: string;
  asset_name: string;
  purchase_date: string;
  quantity: string;
  unit_price_brl: string;
  other_costs_brl?: string;
};

type AuthResponse = {
  token: string;
  user: AuthUser;
};

type RegisterStartResponse = {
  message: string;
  email: string;
  expiresInMinutes: number;
};

type PasswordForgotResponse = {
  message: string;
};

type CryptoOption = {
  name: string;
  symbol: string;
};

type AddCryptoForm = {
  assetQuery: string;
  transactionDate: string;
  quantity: string;
  unitPriceBrl: string;
  otherCostsBrl: string;
};

const TOP_CRYPTO_OPTIONS: CryptoOption[] = [
  { name: "Bitcoin", symbol: "BTC" },
  { name: "Ethereum", symbol: "ETH" },
  { name: "Tether", symbol: "USDT" },
  { name: "BNB", symbol: "BNB" },
  { name: "XRP", symbol: "XRP" },
  { name: "USDC", symbol: "USDC" },
  { name: "Solana", symbol: "SOL" },
  { name: "TRON", symbol: "TRX" },
  { name: "Dogecoin", symbol: "DOGE" },
  { name: "Cardano", symbol: "ADA" },
];

const initialAddCryptoForm: AddCryptoForm = {
  assetQuery: "",
  transactionDate: "",
  quantity: "1",
  unitPriceBrl: "",
  otherCostsBrl: "0",
};

/** Resolve nome + símbolo a partir do texto do campo ou da lista top. */
function resolveAssetFromQuery(query: string): { assetName: string; symbol: string } | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const paren = trimmed.match(/^(.+?)\s*\(([A-Za-z0-9]+)\)\s*$/);
  if (paren) {
    const name = paren[1].trim();
    const sym = paren[2].toUpperCase();
    if (name.length >= 1 && sym.length >= 2) return { assetName: name, symbol: sym };
  }

  const lower = trimmed.toLowerCase();
  const exact = TOP_CRYPTO_OPTIONS.find(
    (c) => c.name.toLowerCase() === lower || c.symbol.toLowerCase() === lower,
  );
  if (exact) return { assetName: exact.name, symbol: exact.symbol };

  const partial = TOP_CRYPTO_OPTIONS.find(
    (c) =>
      c.name.toLowerCase().includes(lower) ||
      (lower.length >= 2 && lower.includes(c.name.toLowerCase().slice(0, 4))),
  );
  if (partial) return { assetName: partial.name, symbol: partial.symbol };

  const compact = trimmed.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (compact.length >= 2 && compact.length <= 12) {
    return { assetName: trimmed, symbol: compact };
  }
  if (trimmed.length >= 2) {
    return {
      assetName: trimmed,
      symbol: trimmed.slice(0, 10).toUpperCase().replace(/\s/g, "") || "ATIVO",
    };
  }
  return null;
}

function getUserInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "CI";
}

function formatCurrencyBrl(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function Field({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

export function AuthControls() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mode, setMode] = useState<Mode>("login");
  const [registerStep, setRegisterStep] = useState<RegisterStep>("form");
  const [isOpen, setIsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAddCryptoOpen, setIsAddCryptoOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<TransactionType>("buy");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [rememberLoginEmail, setRememberLoginEmail] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addCryptoMessage, setAddCryptoMessage] = useState<string | null>(null);
  const [addCryptoIsError, setAddCryptoIsError] = useState(false);
  const [isSavingCrypto, setIsSavingCrypto] = useState(false);
  const [addCryptoForm, setAddCryptoForm] = useState<AddCryptoForm>(initialAddCryptoForm);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [isAssetAutocompleteOpen, setIsAssetAutocompleteOpen] = useState(false);
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);
  const [notifDrawerAnimIn, setNotifDrawerAnimIn] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Array<{ message: string; direction: "up" | "down" | "flat" }>>(
    [],
  );
  const menuRef = useRef<HTMLDivElement | null>(null);
  const assetAutocompleteRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sync = () => {
      setUser(getAuthSession()?.user ?? null);
    };

    sync();
    window.addEventListener("auth:changed", sync);
    return () => window.removeEventListener("auth:changed", sync);
  }, []);

  useEffect(() => {
    function onEditEntry(event: Event) {
      const custom = event as CustomEvent<PortfolioEditEntry>;
      const entry = custom.detail;
      if (!entry?.id) return;

      setAddCryptoMessage(null);
      setAddCryptoIsError(false);
      setEditingEntryId(entry.id);

      const side = entry.side === "SELL" ? "sell" : "buy";
      setTransactionType(side);

      setAddCryptoForm({
        assetQuery: `${entry.asset_name} (${entry.symbol})`,
        transactionDate: String(entry.purchase_date).slice(0, 10),
        quantity: String(entry.quantity),
        unitPriceBrl: String(entry.unit_price_brl),
        otherCostsBrl: String((entry as any).other_costs_brl ?? "0"),
      });

      setIsAddCryptoOpen(true);
    }

    window.addEventListener("portfolio:edit-entry", onEditEntry as EventListener);
    return () => window.removeEventListener("portfolio:edit-entry", onEditEntry as EventListener);
  }, []);

  useEffect(() => {
    function onOpenAddEntry() {
      openAddCryptoModal();
    }

    window.addEventListener("portfolio:add-entry", onOpenAddEntry);
    return () => window.removeEventListener("portfolio:add-entry", onOpenAddEntry);
  }, []);

  useEffect(() => {
    const applyPendingAuthError = () => {
      const pendingError = consumeAuthError();

      if (!pendingError) return;

      setMode("login");
      setRegisterStep("form");
      setError(pendingError.message);
      setEmail(pendingError.email ?? "");
      setPassword("");
      setConfirmPassword("");
      setForgotPasswordEmail(pendingError.email ?? "");
      setForgotPasswordMessage(null);
      setVerificationCode("");
      setVerificationEmail("");
      setVerificationMessage(null);
      setIsPasswordVisible(false);
      setIsOpen(true);
    };

    applyPendingAuthError();
    window.addEventListener("auth:error", applyPendingAuthError);

    return () => window.removeEventListener("auth:error", applyPendingAuthError);
  }, []);

  useEffect(() => {
    setAddCryptoForm((current) =>
      current.transactionDate
        ? current
        : { ...current, transactionDate: new Date().toISOString().slice(0, 10) },
    );
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;

    function handleOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isNotifDrawerOpen) {
      setNotifDrawerAnimIn(false);
      return;
    }
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setNotifDrawerAnimIn(true)));
    return () => cancelAnimationFrame(id);
  }, [isNotifDrawerOpen]);

  useEffect(() => {
    if (!user) setIsNotifDrawerOpen(false);
  }, [user]);

  useEffect(() => {
    if (!isNotifDrawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isNotifDrawerOpen]);

  useEffect(() => {
    if (!isNotifDrawerOpen) return;
    if (notifications.length) return;

    let cancelled = false;
    setNotifLoading(true);
    setNotifError(null);

    api
      .get<{
        items: Array<{ message: string; direction: "up" | "down" | "flat" }>;
        generatedAt: string;
      }>("/market/daily-notifications")
      .then((res) => {
        if (cancelled) return;
        setNotifications(res.items ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setNotifError("Não foi possível carregar as notificações agora.");
        setNotifications([]);
      })
      .finally(() => {
        if (!cancelled) setNotifLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isNotifDrawerOpen, notifications.length]);

  useEffect(() => {
    if (!isNotifDrawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setNotifDrawerAnimIn(false);
        window.setTimeout(() => setIsNotifDrawerOpen(false), 280);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isNotifDrawerOpen]);

  useEffect(() => {
    if (!isAssetAutocompleteOpen) return;

    function handleOutsideClick(event: MouseEvent) {
      if (!assetAutocompleteRef.current?.contains(event.target as Node)) {
        setIsAssetAutocompleteOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isAssetAutocompleteOpen]);

  const title = useMemo(() => {
    if (mode === "login") return "Entrar";
    if (mode === "forgotPassword") return "Recuperar senha";
    if (registerStep === "verify") return "Confirmar cadastro";
    return "Criar conta";
  }, [mode, registerStep]);

  const filteredCryptoOptions = useMemo(() => {
    const query = addCryptoForm.assetQuery.trim().toLowerCase();

    if (!query) return TOP_CRYPTO_OPTIONS;

    return TOP_CRYPTO_OPTIONS.filter((crypto) =>
      `${crypto.name} ${crypto.symbol}`.toLowerCase().includes(query),
    );
  }, [addCryptoForm.assetQuery]);

  const totalValuePreview = useMemo(() => {
    const quantity = Number(addCryptoForm.quantity.replace(",", "."));
    const unitPriceBrl = Number(addCryptoForm.unitPriceBrl.replace(",", "."));
    const otherCostsBrl = Number(addCryptoForm.otherCostsBrl.replace(",", "."));

    if (Number.isNaN(quantity) || Number.isNaN(unitPriceBrl) || Number.isNaN(otherCostsBrl)) {
      return "R$ 0,00";
    }

    const gross = quantity * unitPriceBrl;
    const total = transactionType === "buy" ? gross + otherCostsBrl : gross - otherCostsBrl;
    return formatCurrencyBrl(Math.max(total, 0));
  }, [
    addCryptoForm.otherCostsBrl,
    addCryptoForm.quantity,
    addCryptoForm.unitPriceBrl,
    transactionType,
  ]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setForgotPasswordMessage(null);

    if (mode === "register" && registerStep === "form" && password !== confirmPassword) {
      setError("As senhas precisam ser iguais.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "forgotPassword") {
        const payload = await api.post<PasswordForgotResponse>("/auth/password/forgot", {
          email: forgotPasswordEmail,
        });
        setForgotPasswordMessage(payload.message);
        return;
      }

      if (mode === "login") {
        const payload = await api.post<AuthResponse>("/auth/login", { email, password });
        saveAuthSession(payload);
        if (rememberLoginEmail) {
          setRememberedLoginEmail(email.trim());
        } else {
          setRememberedLoginEmail(null);
        }
        setIsOpen(false);
        setPassword("");
        setConfirmPassword("");
        setForgotPasswordEmail("");
        setForgotPasswordMessage(null);
        setVerificationCode("");
        setVerificationEmail("");
        setVerificationMessage(null);
        setIsPasswordVisible(false);
        return;
      }

      if (registerStep === "form") {
        const payload = await api.post<RegisterStartResponse>("/auth/register/start", {
          name,
          email,
          password,
        });

        setRegisterStep("verify");
        setVerificationEmail(payload.email);
        setVerificationMessage(payload.message);
        setVerificationCode("");
        setPassword("");
        setConfirmPassword("");
        return;
      }

      const payload = await api.post<AuthResponse>("/auth/register/confirm", {
        email: verificationEmail || email,
        code: verificationCode,
      });

      saveAuthSession(payload);
      setIsOpen(false);
      setPassword("");
      setConfirmPassword("");
      setForgotPasswordEmail("");
      setForgotPasswordMessage(null);
      setVerificationCode("");
      setVerificationEmail("");
      setVerificationMessage(null);
      setIsPasswordVisible(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha na autenticação.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendCode() {
    setError(null);
    setIsSubmitting(true);

    try {
      const payload = await api.post<RegisterStartResponse>("/auth/register/resend", {
        email: verificationEmail || email,
      });
      setVerificationEmail(payload.email);
      setVerificationMessage(payload.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao reenviar o código.");
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

  function closeAuthModal() {
    setIsOpen(false);
    setError(null);
    setRegisterStep("form");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setForgotPasswordEmail("");
    setForgotPasswordMessage(null);
    setVerificationCode("");
    setVerificationEmail("");
    setVerificationMessage(null);
    setName("");
    setIsPasswordVisible(false);
  }

  function backToRegisterForm() {
    setError(null);
    setMode("login");
    setRegisterStep("form");
    setForgotPasswordEmail("");
    setForgotPasswordMessage(null);
    setVerificationCode("");
    setVerificationEmail("");
    setVerificationMessage(null);
  }

  function logout() {
    clearAuthSession();
    setUser(null);
    setIsMenuOpen(false);
    setIsNotifDrawerOpen(false);
    setNotifDrawerAnimIn(false);
  }

  function openNotifDrawer() {
    setIsMenuOpen(false);
    setIsNotifDrawerOpen(true);
  }

  function closeNotifDrawer() {
    setNotifDrawerAnimIn(false);
    window.setTimeout(() => setIsNotifDrawerOpen(false), 280);
  }

  function openAddCryptoModal() {
    setAddCryptoMessage(null);
    setAddCryptoIsError(false);
    setEditingEntryId(null);
    setTransactionType("buy");
    setAddCryptoForm((current) => ({
      ...initialAddCryptoForm,
      transactionDate: current.transactionDate || new Date().toISOString().slice(0, 10),
    }));
    setIsMenuOpen(false);
    setIsAddCryptoOpen(true);
  }

  async function handleAddCryptoSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddCryptoMessage(null);
    setAddCryptoIsError(false);

    const session = getAuthSession();
    if (!session?.token) {
      setAddCryptoIsError(true);
      setAddCryptoMessage("Faça login novamente para salvar a transação.");
      return;
    }

    const resolved = resolveAssetFromQuery(addCryptoForm.assetQuery);
    if (!resolved) {
      setAddCryptoIsError(true);
      setAddCryptoMessage("Selecione um ativo da lista ou digite nome e símbolo, ex.: Bitcoin (BTC).");
      return;
    }

    const quantity = Number(String(addCryptoForm.quantity).replace(",", "."));
    const unitPriceBrl = Number(String(addCryptoForm.unitPriceBrl).replace(",", "."));
    const otherCostsBrl = Number(String(addCryptoForm.otherCostsBrl).replace(",", "."));

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setAddCryptoIsError(true);
      setAddCryptoMessage("Informe uma quantidade válida maior que zero.");
      return;
    }
    if (!Number.isFinite(unitPriceBrl) || unitPriceBrl <= 0) {
      setAddCryptoIsError(true);
      setAddCryptoMessage("Informe um preço unitário em R$ válido.");
      return;
    }
    if (!Number.isFinite(otherCostsBrl) || otherCostsBrl < 0) {
      setAddCryptoIsError(true);
      setAddCryptoMessage("Outros custos não podem ser negativos.");
      return;
    }

    if (transactionType === "sell") {
      const net = quantity * unitPriceBrl - otherCostsBrl;
      if (net <= 0) {
        setAddCryptoIsError(true);
        setAddCryptoMessage(
          "Na venda, o valor bruto (quantidade × preço) precisa ser maior que os custos.",
        );
        return;
      }
    }

    setIsSavingCrypto(true);
    try {
      const path = editingEntryId ? `/portfolio/entries/${editingEntryId}` : "/portfolio/entries";
      const request = editingEntryId ? api.patch : api.post;
      await request(
        path,
        {
          assetType: "CRYPTO",
          symbol: resolved.symbol,
          assetName: resolved.assetName,
          purchaseDate: addCryptoForm.transactionDate,
          side: transactionType === "buy" ? "BUY" : "SELL",
          quantity,
          unitPriceBrl,
          otherCostsBrl,
        },
        { Authorization: `Bearer ${session.token}` },
      );
      setIsAddCryptoOpen(false);
      setEditingEntryId(null);
      setAddCryptoForm({
        ...initialAddCryptoForm,
        transactionDate: new Date().toISOString().slice(0, 10),
      });
      window.dispatchEvent(new Event("portfolio:changed"));
    } catch (err) {
      setAddCryptoIsError(true);
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Não foi possível salvar. Tente novamente.";
      setAddCryptoMessage(msg);
    } finally {
      setIsSavingCrypto(false);
    }
  }

  function selectCryptoOption(option: CryptoOption) {
    setAddCryptoForm((current) => ({
      ...current,
      assetQuery: `${option.name} (${option.symbol})`,
    }));
    setIsAssetAutocompleteOpen(false);
  }

  const transactionDateLabel = transactionType === "buy" ? "Data da compra" : "Data da venda";
  const totalValueLabel =
    transactionType === "buy" ? "Valor total da compra" : "Valor total da venda";
  const isRegisterMode = mode === "register";
  const isForgotPasswordMode = mode === "forgotPassword";
  const isVerifyStep = isRegisterMode && registerStep === "verify";
  const hasStartedConfirmingPassword =
    isRegisterMode && registerStep === "form" && password.length > 0 && confirmPassword.length > 0;
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const passwordsDoNotMatch =
    hasStartedConfirmingPassword && password !== confirmPassword;

  return (
    <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
      {user ? (
        <>
        <div className="relative" ref={menuRef}>
          <Button
            className="gap-3 rounded-full border-cyan-500/40 bg-slate-950/85 px-3 py-2 shadow-lg shadow-cyan-950/20"
            onClick={() => setIsMenuOpen((open) => !open)}
            variant="outline"
          >
            <Avatar>
              {user.avatarUrl ? (
                <AvatarImage alt={`Foto de ${user.name}`} src={user.avatarUrl} />
              ) : (
                <AvatarFallback>{getUserInitials(user.name)}</AvatarFallback>
              )}
            </Avatar>
            <div className="hidden text-left sm:block">
              <p className="max-w-40 truncate text-sm font-semibold text-cyan-400">{user.name}</p>
              <p className="text-xs text-slate-400">Minha conta</p>
            </div>
            <ChevronDownIcon className="text-slate-400" />
          </Button>

          {isMenuOpen ? (
            <div className="absolute right-0 mt-3 w-72 overflow-hidden rounded-3xl border border-slate-700 bg-slate-950/95 shadow-2xl shadow-cyan-950/20 backdrop-blur">
              <div className="border-b border-slate-800 bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(15,23,42,0.05))] px-5 py-4">
                <p className="truncate text-base font-semibold text-cyan-400">{user.name}</p>
                <p className="mt-1 truncate text-sm text-slate-400">{user.email}</p>
              </div>

              <div className="p-2">
                <Link
                  className="flex items-center justify-between rounded-2xl px-4 py-3 text-slate-100 transition hover:bg-slate-900"
                  href="/"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span>Página inicial</span>
                  <HomeIcon className="text-cyan-400" />
                </Link>

                <Link
                  className="flex items-center justify-between rounded-2xl px-4 py-3 text-slate-100 transition hover:bg-slate-900"
                  href="/minhas-criptos"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span>Minhas criptos</span>
                  <CircleStackIcon className="text-cyan-400" />
                </Link>

                <button
                  className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-slate-100 transition hover:bg-slate-900"
                  onClick={openAddCryptoModal}
                  type="button"
                >
                  <span>Adicionar criptos</span>
                  <PlusIcon className="text-cyan-400" />
                </button>

                <Link
                  className="flex items-center justify-between rounded-2xl px-4 py-3 text-slate-100 transition hover:bg-slate-900"
                  href="/lancamentos"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span>Lançamentos</span>
                  <ListIcon className="text-cyan-400" />
                </Link>

                <Link
                  className="flex items-center justify-between rounded-2xl px-4 py-3 text-slate-100 transition hover:bg-slate-900"
                  href="/configuracoes"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span>Configurações</span>
                  <SettingsIcon className="text-cyan-400" />
                </Link>

                <button
                  className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-slate-100 transition hover:bg-slate-900"
                  onClick={openNotifDrawer}
                  type="button"
                >
                  <span className="flex items-center gap-2">
                    Notificações
                    {notifications.length ? (
                      <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs text-cyan-200">
                        {notifications.length}
                      </span>
                    ) : null}
                  </span>
                  <BellIcon className="text-cyan-400" />
                </button>

                <button
                  className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-rose-200 transition hover:bg-rose-500/10"
                  onClick={logout}
                  type="button"
                >
                  <span>Sair</span>
                  <LogoutIcon />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {isNotifDrawerOpen ? (
          <div className="fixed inset-0 z-[200] flex justify-end">
            <button
              aria-label="Fechar notificações"
              className={cn(
                "absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300",
                notifDrawerAnimIn ? "opacity-100" : "opacity-0",
              )}
              onClick={closeNotifDrawer}
              type="button"
            />
            <aside
              className={cn(
                "relative z-10 flex h-full w-full max-w-md flex-col border-l border-slate-700 bg-[linear-gradient(180deg,rgba(15,23,42,0.99),rgba(2,6,23,0.99))] shadow-2xl shadow-cyan-950/30 transition-transform duration-300 ease-out",
                notifDrawerAnimIn ? "translate-x-0" : "translate-x-full",
              )}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">Notificações</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Variação nas últimas 24h • Top 10 (CoinGecko)</p>
                </div>
                <Button onClick={closeNotifDrawer} size="icon" type="button" variant="ghost">
                  <XIcon />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {notifLoading ? (
                  <p className="text-sm text-slate-500">Carregando…</p>
                ) : notifError ? (
                  <p className="text-sm text-rose-300">{notifError}</p>
                ) : notifications.length ? (
                  <ul className="space-y-0 divide-y divide-slate-800/80">
                    {notifications.map((n, idx) => (
                      <li className="flex gap-3 py-4 text-sm text-slate-200 first:pt-0" key={`${idx}-${n.message.slice(0, 20)}`}>
                        <span
                          className={cn(
                            "mt-0.5 shrink-0 tabular-nums",
                            n.direction === "up"
                              ? "text-emerald-400"
                              : n.direction === "down"
                                ? "text-rose-400"
                                : "text-slate-400",
                          )}
                        >
                          {n.direction === "up" ? "▲" : n.direction === "down" ? "▼" : "•"}
                        </span>
                        <span className="leading-snug">{n.message}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">Sem notificações por enquanto.</p>
                )}
              </div>
            </aside>
          </div>
        ) : null}
        </>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setError(null);
              setEmail("");
              setPassword("");
              setConfirmPassword("");
              setForgotPasswordEmail("");
              setForgotPasswordMessage(null);
              setVerificationCode("");
              setVerificationEmail("");
              setVerificationMessage(null);
              setName("");
              setRegisterStep("form");
              setIsPasswordVisible(false);
              setMode("register");
              setIsOpen(true);
            }}
          >
            Cadastrar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setError(null);
              setEmail(getRememberedLoginEmail() ?? "");
              setPassword("");
              setConfirmPassword("");
              setForgotPasswordEmail("");
              setForgotPasswordMessage(null);
              setVerificationCode("");
              setVerificationEmail("");
              setVerificationMessage(null);
              setName("");
              setRegisterStep("form");
              setIsPasswordVisible(false);
              setRememberLoginEmail(true);
              setMode("login");
              setIsOpen(true);
            }}
          >
            Login
          </Button>
        </div>
      )}

      <Dialog open={isOpen}>
        <DialogContent className="max-w-md rounded-xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isVerifyStep || isForgotPasswordMode ? (
                <Button onClick={backToRegisterForm} size="icon" variant="ghost">
                  <ArrowLeftIcon />
                </Button>
              ) : null}
              <h3 className="text-xl font-semibold text-slate-100">{title}</h3>
            </div>
            <Button onClick={closeAuthModal} size="icon" variant="ghost">
              <XIcon />
            </Button>
          </div>

          <form className="space-y-3" onSubmit={handleSubmit}>
            {mode === "register" && registerStep === "form" ? (
              <Input onChange={(event) => setName(event.target.value)} placeholder="Nome" required value={name} />
            ) : null}

            <Input
              autoComplete={
                isForgotPasswordMode
                  ? "email"
                  : isVerifyStep
                    ? "off"
                    : mode === "login"
                      ? "username"
                      : "email"
              }
              name={isForgotPasswordMode ? "forgot-email" : isVerifyStep ? "verify-email" : mode === "login" ? "email" : "email"}
              onChange={(event) =>
                isForgotPasswordMode ? setForgotPasswordEmail(event.target.value) : setEmail(event.target.value)
              }
              placeholder="E-mail"
              required
              readOnly={isVerifyStep}
              type="email"
              value={isForgotPasswordMode ? forgotPasswordEmail : isVerifyStep ? verificationEmail || email : email}
            />

            {isForgotPasswordMode ? (
              <>
                {forgotPasswordMessage ? (
                  <p className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
                    {forgotPasswordMessage}
                  </p>
                ) : null}

                {!forgotPasswordMessage && !error ? (
                  <p className="text-sm text-slate-400">
                    Informe seu e-mail e enviaremos um link para criar uma nova senha.
                  </p>
                ) : null}
              </>
            ) : isVerifyStep ? (
              <>
                {verificationMessage ? (
                  <p className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
                    {verificationMessage}
                  </p>
                ) : null}

                <Input
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Código de 6 dígitos"
                  required
                  value={verificationCode}
                />

                <p className="text-sm text-slate-400">
                  Digite o código que enviamos para o seu e-mail para concluir o cadastro.
                </p>
              </>
            ) : (
              <>
                <div className="relative">
                  <Input
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className={cn(
                      "pr-12",
                      passwordsMatch ? "border-emerald-500 focus:border-emerald-400" : "",
                      passwordsDoNotMatch ? "border-rose-500 focus:border-rose-400" : "",
                    )}
                    minLength={6}
                    name={mode === "login" ? "password" : "new-password"}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Senha"
                    required
                    type={isPasswordVisible ? "text" : "password"}
                    value={password}
                  />
                  <button
                    aria-label={isPasswordVisible ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-cyan-300"
                    onClick={() => setIsPasswordVisible((current) => !current)}
                    type="button"
                  >
                    {isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>

                {mode === "register" ? (
                  <>
                    <div className="relative">
                      <Input
                        className={cn(
                          "pr-12",
                          passwordsMatch ? "border-emerald-500 focus:border-emerald-400" : "",
                          passwordsDoNotMatch ? "border-rose-500 focus:border-rose-400" : "",
                        )}
                        minLength={6}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Confirmar senha"
                        required
                        type={isPasswordVisible ? "text" : "password"}
                        value={confirmPassword}
                      />
                      <button
                        aria-label={isPasswordVisible ? "Ocultar senha" : "Mostrar senha"}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-cyan-300"
                        onClick={() => setIsPasswordVisible((current) => !current)}
                        type="button"
                      >
                        {isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>

                    {hasStartedConfirmingPassword ? (
                      <p
                        className={cn(
                          "text-sm",
                          passwordsMatch ? "text-emerald-300" : "text-rose-300",
                        )}
                      >
                        {passwordsMatch ? "As senhas estão iguais." : "As senhas precisam ser iguais."}
                      </p>
                    ) : null}
                  </>
                ) : null}

                {mode === "login" ? (
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400">
                    <input
                      checked={rememberLoginEmail}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                      onChange={(e) => setRememberLoginEmail(e.target.checked)}
                      type="checkbox"
                    />
                    Lembrar meu e-mail
                  </label>
                ) : null}
              </>
            )}

            {error ? <p className="text-sm text-rose-300">{error}</p> : null}

            <Button
              className="w-full rounded-md"
              disabled={
                isSubmitting ||
                (mode === "register" && registerStep === "form" && !passwordsMatch)
              }
              type="submit"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                  <span>
                    {isVerifyStep
                      ? "Confirmando código..."
                      : isForgotPasswordMode
                        ? "Enviando instruções..."
                        : "Validando acesso..."}
                  </span>
                </span>
              ) : mode === "login" ? (
                "Entrar"
              ) : mode === "forgotPassword" ? (
                "Enviar link de recuperação"
              ) : isVerifyStep ? (
                "Confirmar código"
              ) : (
                "Criar conta"
              )}
            </Button>

            {isSubmitting ? (
              <div className="space-y-2 rounded-md border border-cyan-500/20 bg-cyan-500/10 px-3 py-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-cyan-400" />
                </div>
                <p className="text-center text-xs text-cyan-100">
                  Estamos verificando suas credenciais com segurança.
                </p>
              </div>
            ) : null}

            {isVerifyStep ? (
              <Button className="w-full rounded-md" disabled={isSubmitting} onClick={handleResendCode} type="button" variant="outline">
                Reenviar código
              </Button>
            ) : null}

            {mode === "login" ? (
              <button
                className="text-sm text-cyan-300 transition hover:text-cyan-200"
                onClick={() => {
                  setError(null);
                  setPassword("");
                  setConfirmPassword("");
                  setForgotPasswordEmail(email);
                  setForgotPasswordMessage(null);
                  setVerificationCode("");
                  setVerificationEmail("");
                  setVerificationMessage(null);
                  setIsPasswordVisible(false);
                  setMode("forgotPassword");
                }}
                type="button"
              >
                Esqueceu a senha?
              </button>
            ) : null}
          </form>

          {!isVerifyStep && !isForgotPasswordMode ? <Separator className="my-4" /> : null}

          {!isVerifyStep && !isForgotPasswordMode ? (
            <Button
              className="w-full rounded-md"
              disabled={isSubmitting}
              onClick={handleGoogleLogin}
              type="button"
              variant="outline"
            >
              Entrar com o Google
            </Button>
          ) : null}

          {!isVerifyStep && !isForgotPasswordMode ? (
            <p className="mt-3 text-center text-sm text-slate-400">
              {mode === "login" ? "Não tem conta?" : "Já tem conta?"}{" "}
              <button
                className="text-cyan-300 hover:text-cyan-200"
                onClick={() => {
                  setError(null);
                  if (mode === "login") {
                    setEmail("");
                    setRememberLoginEmail(true);
                  } else {
                    setEmail(getRememberedLoginEmail() ?? "");
                    setRememberLoginEmail(true);
                  }
                  setPassword("");
                  setConfirmPassword("");
                  setForgotPasswordEmail("");
                  setForgotPasswordMessage(null);
                  setVerificationCode("");
                  setVerificationEmail("");
                  setVerificationMessage(null);
                  setName("");
                  setRegisterStep("form");
                  setIsPasswordVisible(false);
                  setMode(mode === "login" ? "register" : "login");
                }}
                type="button"
              >
                {mode === "login" ? "Cadastre-se" : "Entrar"}
              </button>
            </p>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isAddCryptoOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div>
              <DialogDescription>Carteira</DialogDescription>
              <DialogTitle>Adicionar transação</DialogTitle>
            </div>
            <Button onClick={() => setIsAddCryptoOpen(false)} size="icon" variant="outline">
              <XIcon />
            </Button>
          </DialogHeader>

          <form className="space-y-5" onSubmit={handleAddCryptoSubmit}>
            <div className="grid grid-cols-2 gap-1 rounded-full border border-slate-800 bg-slate-950 p-1">
              <Button
                className="rounded-full"
                onClick={() => setTransactionType("buy")}
                type="button"
                variant={transactionType === "buy" ? "default" : "outline"}
              >
                COMPRA ↑
              </Button>
              <Button
                className="rounded-full"
                onClick={() => setTransactionType("sell")}
                type="button"
                variant={transactionType === "sell" ? "default" : "outline"}
              >
                VENDA ↓
              </Button>
            </div>

            <Field>
              <Label>Ativo</Label>
              <div className="relative" ref={assetAutocompleteRef}>
                <Input
                  onChange={(event) => {
                    setAddCryptoForm((current) => ({ ...current, assetQuery: event.target.value }));
                    setIsAssetAutocompleteOpen(true);
                  }}
                  onFocus={() => setIsAssetAutocompleteOpen(true)}
                  placeholder="Digite o nome da cripto"
                  required
                  value={addCryptoForm.assetQuery}
                />
                <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />

                {isAssetAutocompleteOpen ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-10 max-h-64 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950/95 p-2 shadow-2xl shadow-black/40">
                    {filteredCryptoOptions.length ? (
                      filteredCryptoOptions.map((option) => (
                        <button
                          className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition hover:bg-slate-900"
                          key={option.symbol}
                          onClick={() => selectCryptoOption(option)}
                          type="button"
                        >
                          <span className="text-slate-100">{option.name}</span>
                          <span className="text-sm text-cyan-300">{option.symbol}</span>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-xl px-3 py-3 text-sm text-slate-400">
                        Nenhuma cripto encontrada nas top 10 atuais.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <Label>{transactionDateLabel}</Label>
                <Input
                  onChange={(event) =>
                    setAddCryptoForm((current) => ({ ...current, transactionDate: event.target.value }))
                  }
                  required
                  type="date"
                  value={addCryptoForm.transactionDate}
                />
              </Field>

              <Field>
                <Label>Quantidade</Label>
                <Input
                  onChange={(event) =>
                    setAddCryptoForm((current) => ({ ...current, quantity: event.target.value }))
                  }
                  placeholder="1"
                  required
                  step="any"
                  type="number"
                  value={addCryptoForm.quantity}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <Label>Preço em R$</Label>
                <Input
                  onChange={(event) =>
                    setAddCryptoForm((current) => ({ ...current, unitPriceBrl: event.target.value }))
                  }
                  placeholder="350000"
                  required
                  step="any"
                  type="number"
                  value={addCryptoForm.unitPriceBrl}
                />
              </Field>

              <Field>
                <Label>Outros custos</Label>
                <Input
                  onChange={(event) =>
                    setAddCryptoForm((current) => ({ ...current, otherCostsBrl: event.target.value }))
                  }
                  placeholder="0"
                  required
                  step="any"
                  type="number"
                  value={addCryptoForm.otherCostsBrl}
                />
              </Field>
            </div>

            <div className="rounded-[1.75rem] border border-slate-700 bg-slate-950/80 px-5 py-4">
              <p className="text-sm text-slate-400">{totalValueLabel}</p>
              <p className="mt-1 text-3xl font-semibold text-cyan-300">{totalValuePreview}</p>
            </div>

            {addCryptoMessage ? (
              <p
                className={cn(
                  "rounded-2xl border px-4 py-3 text-sm",
                  addCryptoIsError
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
                    : "border-cyan-500/20 bg-cyan-500/10 text-cyan-100",
                )}
              >
                {addCryptoMessage}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
              <Button
                disabled={isSavingCrypto}
                onClick={() => setIsAddCryptoOpen(false)}
                type="button"
                variant="outline"
              >
                Cancelar
              </Button>
              <Button disabled={isSavingCrypto} type="submit">
                {isSavingCrypto ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AuthGoogleCallbackInfo() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center text-slate-200">
      <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-6">
        <h1 className="text-2xl font-semibold">Conectando sua conta Google...</h1>
        <p className="mt-2 text-slate-300">Se demorar muito, você voltará para a tela inicial.</p>
      </div>
    </div>
  );
}
