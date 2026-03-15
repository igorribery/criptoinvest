"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProtectedRoute } from "@/components/protected-route";
import { ArrowLeftIcon, PencilIcon, SettingsIcon } from "@/components/ui/icons";
import { api } from "@/lib/api";
import { AuthUser, getAuthSession, updateAuthUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

type MeResponse = {
  user: AuthUser;
};

type AuthResponse = {
  token: string;
  user: AuthUser;
  message?: string;
};

type AvatarUploadResponse = {
  message: string;
  user: AuthUser;
};

type MessageState = {
  type: "success" | "error";
  text: string;
};

function getUserInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "CI";
}

function SectionMessage({ message }: { message: MessageState | null }) {
  if (!message) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm",
        message.type === "success"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          : "border-rose-500/30 bg-rose-500/10 text-rose-200",
      )}
    >
      {message.text}
    </div>
  );
}

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);
  const [token, setToken] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSendingEmailCode, setIsSendingEmailCode] = useState(false);
  const [isConfirmingEmail, setIsConfirmingEmail] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<MessageState | null>(null);
  const [profileMessage, setProfileMessage] = useState<MessageState | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<MessageState | null>(null);
  const [emailMessage, setEmailMessage] = useState<MessageState | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");

  async function fileToDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
      reader.readAsDataURL(file);
    });
  }

  useEffect(() => {
    const session = getAuthSession();

    if (!session) {
      router.replace("/");
      return;
    }

    setToken(session.token);
    setUser(session.user);
    setName(session.user.name);
    setNewEmail(session.user.email);
    setSessionReady(true);

    api
      .get<MeResponse>("/me", { Authorization: `Bearer ${session.token}` })
      .then((payload) => {
        setUser(payload.user);
        setName(payload.user.name);
        setNewEmail(payload.user.email);
        updateAuthUser(payload.user, session.token);
      })
      .catch(() => {
        router.replace("/");
      })
      .finally(() => setIsLoading(false));
  }, [router]);

  useEffect(() => {
    function handleAuthChanged() {
      const session = getAuthSession();

      if (!session) {
        router.replace("/");
        return;
      }

      setToken(session.token);
      setUser(session.user);
      setName(session.user.name);
      setNewEmail((current) => (pendingEmail ? current : session.user.email));
    }

    window.addEventListener("auth:changed", handleAuthChanged);
    return () => window.removeEventListener("auth:changed", handleAuthChanged);
  }, [pendingEmail, router]);

  useEffect(() => {
    if (avatarMessage?.type !== "success") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setAvatarMessage(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [avatarMessage]);

  const passwordsMatch = useMemo(
    () => newPassword.length > 0 && newPassword === confirmNewPassword,
    [confirmNewPassword, newPassword],
  );

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileMessage(null);
    setIsSavingProfile(true);

    try {
      const payload = await api.patch<{ user: AuthUser }>(
        "/auth/profile",
        { name },
        { Authorization: `Bearer ${token}` },
      );

      setUser(payload.user);
      updateAuthUser(payload.user, token);
      setProfileMessage({ type: "success", text: "Nome atualizado com sucesso." });
    } catch (error) {
      setProfileMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Não foi possível atualizar o nome.",
      });
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage(null);

    if (newPassword !== confirmNewPassword) {
      setPasswordMessage({ type: "error", text: "A confirmação da senha não confere." });
      return;
    }

    setIsSavingPassword(true);

    try {
      const payload = await api.post<{ message: string }>(
        "/auth/password/change",
        { currentPassword, newPassword },
        { Authorization: `Bearer ${token}` },
      );

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordMessage({ type: "success", text: payload.message });
    } catch (error) {
      setPasswordMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Não foi possível atualizar a senha.",
      });
    } finally {
      setIsSavingPassword(false);
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setAvatarMessage(null);

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setAvatarMessage({ type: "error", text: "Selecione uma imagem JPG, PNG ou WEBP." });
      return;
    }

    setIsUploadingAvatar(true);

    try {
      const imageDataUrl = await fileToDataUrl(file);
      const payload = await api.post<AvatarUploadResponse>(
        "/auth/profile/avatar",
        { imageDataUrl },
        { Authorization: `Bearer ${token}` },
      );

      setUser(payload.user);
      updateAuthUser(payload.user, token);
      setAvatarMessage({ type: "success", text: payload.message });
    } catch (error) {
      setAvatarMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Nao foi possivel atualizar a foto.",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleEmailStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailMessage(null);
    setIsSendingEmailCode(true);

    try {
      const payload = await api.post<{ message: string; email: string }>(
        "/auth/email-change/start",
        { newEmail },
        { Authorization: `Bearer ${token}` },
      );

      setPendingEmail(payload.email);
      setEmailCode("");
      setEmailMessage({ type: "success", text: payload.message });
    } catch (error) {
      setEmailMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Não foi possível iniciar a troca de e-mail.",
      });
    } finally {
      setIsSendingEmailCode(false);
    }
  }

  async function handleEmailConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailMessage(null);
    setIsConfirmingEmail(true);

    try {
      const payload = await api.post<AuthResponse>(
        "/auth/email-change/confirm",
        { code: emailCode },
        { Authorization: `Bearer ${token}` },
      );

      setToken(payload.token);
      setUser(payload.user);
      setName(payload.user.name);
      setNewEmail(payload.user.email);
      setPendingEmail("");
      setEmailCode("");
      updateAuthUser(payload.user, payload.token);
      setEmailMessage({
        type: "success",
        text: payload.message ?? "E-mail atualizado com sucesso.",
      });
    } catch (error) {
      setEmailMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Não foi possível confirmar o novo e-mail.",
      });
    } finally {
      setIsConfirmingEmail(false);
    }
  }

  async function handleEmailResend() {
    setEmailMessage(null);
    setIsSendingEmailCode(true);

    try {
      const payload = await api.post<{ message: string; email: string }>(
        "/auth/email-change/resend",
        {},
        { Authorization: `Bearer ${token}` },
      );

      setPendingEmail(payload.email);
      setEmailMessage({ type: "success", text: payload.message });
    } catch (error) {
      setEmailMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Não foi possível reenviar o código.",
      });
    } finally {
      setIsSendingEmailCode(false);
    }
  }

  if (!sessionReady || isLoading || !user) {
    return (
      <ProtectedRoute>
        <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-16 sm:px-6">
          <div className="rounded-full border border-cyan-500/20 bg-slate-950/80 px-5 py-3 text-sm text-cyan-100">
            Carregando configurações da conta...
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button className="rounded-2xl" onClick={() => router.push("/")} size="icon" variant="outline">
              <ArrowLeftIcon />
            </Button>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/80">Painel da conta</p>
              <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">Configurações</h1>
            </div>
          </div>

        </div>

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="overflow-hidden bg-[linear-gradient(180deg,rgba(8,47,73,0.92),rgba(2,6,23,0.96))]">
            <CardContent className="p-0">
              <div className="border-b border-cyan-500/10 px-6 py-7">
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/75">Resumo</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Sua identidade</h2>
                <p className="mt-2 text-sm text-slate-300">
                  Edite nome, senha e e-mail com confirmação para manter a conta protegida.
                </p>
              </div>

              <div className="px-6 py-8">
                <div className="rounded-[2rem] border border-cyan-500/15 bg-slate-950/80 p-6">
                  <div className="relative mx-auto h-24 w-24">
                    <Avatar className="h-24 w-24 border border-cyan-500/30 bg-slate-900">
                      {user.avatarUrl ? <AvatarImage alt={`Foto de ${user.name}`} src={user.avatarUrl} /> : null}
                      <AvatarFallback className="bg-transparent text-2xl font-semibold text-cyan-200">
                        {getUserInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <Label
                      className={cn(
                        "absolute -bottom-1 -right-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:scale-105 hover:bg-cyan-300",
                        isUploadingAvatar ? "cursor-wait opacity-70" : "",
                      )}
                      htmlFor="avatar-upload"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </Label>
                    <Input
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={isUploadingAvatar}
                      id="avatar-upload"
                      onChange={handleAvatarChange}
                      type="file"
                    />
                  </div>

                  <div className="mt-5 text-center">
                    <p className="text-lg font-semibold text-white">{user.name}</p>
                    <p className="mt-1 break-all text-sm text-slate-400">{user.email}</p>
                  </div>

                  <div className="mt-5">
                    <SectionMessage message={avatarMessage} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card className="bg-slate-900/70">
              <CardContent className="p-6 sm:p-8">
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">Perfil</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Informações pessoais</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Atualize seu nome de exibição. O avatar continua usando as iniciais por enquanto.
                  </p>
                </div>

                <form className="space-y-5" onSubmit={handleProfileSubmit}>
                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome</Label>
                      <Input id="name" onChange={(event) => setName(event.target.value)} required value={name} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="current-email">E-mail atual</Label>
                      <Input disabled id="current-email" value={user.email} />
                    </div>
                  </div>

                  <SectionMessage message={profileMessage} />

                  <div className="flex justify-end">
                    <Button className="rounded-2xl px-6" disabled={isSavingProfile} type="submit">
                      {isSavingProfile ? "Salvando nome..." : "Salvar perfil"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/70">
              <CardContent className="p-6 sm:p-8">
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">Seguranca</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Trocar senha</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Informe sua senha atual e defina uma nova combinação para continuar protegendo sua conta.
                  </p>
                </div>

                <form className="space-y-5" onSubmit={handlePasswordSubmit}>
                  <div className="grid gap-5 lg:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Senha atual</Label>
                      <Input
                        id="current-password"
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        required
                        type="password"
                        value={currentPassword}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-password">Nova senha</Label>
                      <Input
                        id="new-password"
                        minLength={6}
                        onChange={(event) => setNewPassword(event.target.value)}
                        required
                        type="password"
                        value={newPassword}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-new-password">Confirmar nova senha</Label>
                      <Input
                        className={cn(
                          passwordsMatch ? "border-emerald-500 focus:border-emerald-400" : "",
                          confirmNewPassword.length > 0 && !passwordsMatch
                            ? "border-rose-500 focus:border-rose-400"
                            : "",
                        )}
                        id="confirm-new-password"
                        minLength={6}
                        onChange={(event) => setConfirmNewPassword(event.target.value)}
                        required
                        type="password"
                        value={confirmNewPassword}
                      />
                    </div>
                  </div>

                  {confirmNewPassword.length > 0 ? (
                    <p className={cn("text-sm", passwordsMatch ? "text-emerald-300" : "text-rose-300")}>
                      {passwordsMatch ? "As senhas novas conferem." : "As senhas novas precisam ser iguais."}
                    </p>
                  ) : null}

                  <SectionMessage message={passwordMessage} />

                  <div className="flex justify-end">
                    <Button
                      className="rounded-2xl px-6"
                      disabled={isSavingPassword || !passwordsMatch}
                      type="submit"
                    >
                      {isSavingPassword ? "Atualizando senha..." : "Atualizar senha"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/70">
              <CardContent className="p-6 sm:p-8">
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">E-mail</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Trocar e-mail com confirmação</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Assim que você informar um novo e-mail, enviaremos um código para confirmar a troca.
                  </p>
                </div>

                <form className="space-y-5" onSubmit={handleEmailStart}>
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="space-y-2">
                      <Label htmlFor="new-email">Novo e-mail</Label>
                      <Input
                        id="new-email"
                        onChange={(event) => setNewEmail(event.target.value)}
                        required
                        type="email"
                        value={newEmail}
                      />
                    </div>

                    <div className="flex items-end">
                      <Button
                        className="w-full rounded-2xl"
                        disabled={isSendingEmailCode}
                        type="submit"
                        variant="outline"
                      >
                        {isSendingEmailCode ? "Enviando código..." : "Enviar código"}
                      </Button>
                    </div>
                  </div>
                </form>

                {pendingEmail ? (
                  <form
                    className="mt-6 space-y-5 rounded-[2rem] border border-cyan-500/15 bg-slate-950/70 p-5"
                    onSubmit={handleEmailConfirm}
                  >
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px_180px]">
                      <div className="space-y-2">
                        <Label htmlFor="pending-email">Confirmando o e-mail</Label>
                        <Input disabled id="pending-email" value={pendingEmail} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email-code">Código</Label>
                        <Input
                          id="email-code"
                          inputMode="numeric"
                          maxLength={6}
                          onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="6 digitos"
                          required
                          value={emailCode}
                        />
                      </div>

                      <div className="flex items-end">
                        <Button className="w-full rounded-2xl" disabled={isConfirmingEmail} type="submit">
                          {isConfirmingEmail ? "Confirmando..." : "Confirmar e-mail"}
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-slate-400">
                        O login continuará funcionando normalmente. A sessão será atualizada assim que o código for validado.
                      </p>

                      <Button disabled={isSendingEmailCode} onClick={handleEmailResend} type="button" variant="ghost">
                        Reenviar código
                      </Button>
                    </div>
                  </form>
                ) : null}

                <div className="mt-5">
                  <SectionMessage message={emailMessage} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
