import { AUTH_ERROR_STORAGE_KEY, AUTH_STORAGE_KEY, AuthSession, AuthUser, PendingAuthError } from "@/app/types/auth-types";

export type { AuthSession, AuthUser, PendingAuthError };

const REMEMBERED_LOGIN_EMAIL_KEY = "criptoinvest.rememberedEmail";

/** E-mail salvo para preencher o login (opcional “lembrar”). Não armazene senha aqui. */
export function getRememberedLoginEmail(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(REMEMBERED_LOGIN_EMAIL_KEY);
  const trimmed = raw?.trim();
  return trimmed || null;
}

export function setRememberedLoginEmail(email: string | null) {
  if (typeof window === "undefined") return;
  if (email?.trim()) {
    localStorage.setItem(REMEMBERED_LOGIN_EMAIL_KEY, email.trim());
  } else {
    localStorage.removeItem(REMEMBERED_LOGIN_EMAIL_KEY);
  }
}


export function saveAuthSession(session: AuthSession) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event("auth:changed"));
}

export function getAuthSession(): AuthSession | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new Event("auth:changed"));
}

export function updateAuthUser(user: AuthUser, token?: string) {
  const current = getAuthSession();
  if (!current && !token) return;

  saveAuthSession({
    token: token ?? current!.token,
    user,
  });
}

export function saveAuthError(message: string, email?: string) {
  const payload: PendingAuthError = { message, email };
  sessionStorage.setItem(AUTH_ERROR_STORAGE_KEY, JSON.stringify(payload));

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth:error"));
  }
}

export function consumeAuthError() {
  const raw = sessionStorage.getItem(AUTH_ERROR_STORAGE_KEY);

  if (raw) {
    sessionStorage.removeItem(AUTH_ERROR_STORAGE_KEY);
  }

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PendingAuthError;
  } catch {
    return { message: raw };
  }
}

