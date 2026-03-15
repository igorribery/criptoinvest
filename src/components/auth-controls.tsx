"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  AuthUser,
  clearAuthSession,
  consumeAuthError,
  getAuthSession,
  saveAuthSession,
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
  SettingsIcon,
  XIcon,
} from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";
type RegisterStep = "form" | "verify";
type TransactionType = "buy" | "sell";

type AuthResponse = {
  token: string;
  user: AuthUser;
};

type RegisterStartResponse = {
  message: string;
  email: string;
  expiresInMinutes: number;
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
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addCryptoMessage, setAddCryptoMessage] = useState<string | null>(null);
  const [addCryptoForm, setAddCryptoForm] = useState<AddCryptoForm>(initialAddCryptoForm);
  const [isAssetAutocompleteOpen, setIsAssetAutocompleteOpen] = useState(false);
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
    const applyPendingAuthError = () => {
      const pendingError = consumeAuthError();

      if (!pendingError) return;

      setMode("login");
      setRegisterStep("form");
      setError(pendingError.message);
      setEmail(pendingError.email ?? "");
      setPassword("");
      setConfirmPassword("");
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

    if (mode === "register" && registerStep === "form" && password !== confirmPassword) {
      setError("As senhas precisam ser iguais.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "login") {
        const payload = await api.post<AuthResponse>("/auth/login", { email, password });
        saveAuthSession(payload);
        setIsOpen(false);
        setPassword("");
        setConfirmPassword("");
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
      setVerificationCode("");
      setVerificationEmail("");
      setVerificationMessage(null);
      setIsPasswordVisible(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha na autenticacao.");
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
      setError(requestError instanceof Error ? requestError.message : "Falha ao reenviar o codigo.");
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
    setVerificationCode("");
    setVerificationEmail("");
    setVerificationMessage(null);
    setName("");
    setIsPasswordVisible(false);
  }

  function backToRegisterForm() {
    setError(null);
    setRegisterStep("form");
    setVerificationCode("");
    setVerificationEmail("");
    setVerificationMessage(null);
  }

  function logout() {
    clearAuthSession();
    setUser(null);
    setIsMenuOpen(false);
  }

  function openAddCryptoModal() {
    setAddCryptoMessage(null);
    setTransactionType("buy");
    setAddCryptoForm((current) => ({
      ...initialAddCryptoForm,
      transactionDate: current.transactionDate || new Date().toISOString().slice(0, 10),
    }));
    setIsMenuOpen(false);
    setIsAddCryptoOpen(true);
  }

  function handleAddCryptoSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddCryptoMessage(
      "Modal pronto para integrar com a pagina de lancamentos. No proximo passo conectamos ao backend.",
    );
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
  const isVerifyStep = isRegisterMode && registerStep === "verify";
  const hasStartedConfirmingPassword =
    isRegisterMode && registerStep === "form" && password.length > 0 && confirmPassword.length > 0;
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const passwordsDoNotMatch =
    hasStartedConfirmingPassword && password !== confirmPassword;

  return (
    <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
      {user ? (
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
                  <span>Configuracoes</span>
                  <SettingsIcon className="text-cyan-400" />
                </Link>

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
              setEmail("");
              setPassword("");
              setConfirmPassword("");
              setVerificationCode("");
              setVerificationEmail("");
              setVerificationMessage(null);
              setName("");
              setRegisterStep("form");
              setIsPasswordVisible(false);
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
              {isVerifyStep ? (
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
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              required
              readOnly={isVerifyStep}
              type="email"
              value={isVerifyStep ? verificationEmail || email : email}
            />

            {isVerifyStep ? (
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
                  placeholder="Codigo de 6 digitos"
                  required
                  value={verificationCode}
                />

                <p className="text-sm text-slate-400">
                  Digite o codigo que enviamos para o seu email para concluir o cadastro.
                </p>
              </>
            ) : (
              <>
                <div className="relative">
                  <Input
                    className={cn(
                      "pr-12",
                      passwordsMatch ? "border-emerald-500 focus:border-emerald-400" : "",
                      passwordsDoNotMatch ? "border-rose-500 focus:border-rose-400" : "",
                    )}
                    minLength={6}
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
                        {passwordsMatch ? "As senhas estao iguais." : "As senhas precisam ser iguais."}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </>
            )}

            {error ? <p className="text-sm text-rose-300">{error}</p> : null}

            <Button
              className="w-full rounded-md"
              disabled={isSubmitting || (mode === "register" && registerStep === "form" && !passwordsMatch)}
              type="submit"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                  <span>{isVerifyStep ? "Confirmando codigo..." : "Validando acesso..."}</span>
                </span>
              ) : (
                mode === "login"
                  ? "Entrar"
                  : isVerifyStep
                    ? "Confirmar codigo"
                    : "Criar conta"
              )}
            </Button>

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

            {isVerifyStep ? (
              <Button className="w-full rounded-md" disabled={isSubmitting} onClick={handleResendCode} type="button" variant="outline">
                Reenviar codigo
              </Button>
            ) : null}
          </form>

          {!isVerifyStep ? <Separator className="my-4" /> : null}

          {!isVerifyStep ? (
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

          {!isVerifyStep ? (
            <p className="mt-3 text-center text-sm text-slate-400">
              {mode === "login" ? "Nao tem conta?" : "Ja tem conta?"}{" "}
              <button
                className="text-cyan-300 hover:text-cyan-200"
                onClick={() => {
                  setError(null);
                  setEmail("");
                  setPassword("");
                  setConfirmPassword("");
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
              <DialogTitle>Adicionar transacao</DialogTitle>
            </div>
            <Button onClick={() => setIsAddCryptoOpen(false)} size="icon" variant="outline">
              <XIcon />
            </Button>
          </DialogHeader>

          <form className="space-y-5" onSubmit={handleAddCryptoSubmit}>
            <div className="grid grid-cols-2 rounded-full border border-slate-800 bg-slate-950 p-1">
              <Button
                className={cn(
                  "rounded-full",
                  transactionType === "buy" ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300" : "bg-transparent text-slate-300 hover:bg-transparent hover:text-white",
                )}
                onClick={() => setTransactionType("buy")}
                type="button"
              >
                COMPRA ↑
              </Button>
              <Button
                className={cn(
                  "rounded-full",
                  transactionType === "sell" ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300" : "bg-transparent text-slate-300 hover:bg-transparent hover:text-white",
                )}
                onClick={() => setTransactionType("sell")}
                type="button"
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
                <Label>Preco em R$</Label>
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
              <p className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                {addCryptoMessage}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
              <Button onClick={() => setIsAddCryptoOpen(false)} type="button" variant="outline">
                Cancelar
              </Button>
              <Button type="submit">Salvar</Button>
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
