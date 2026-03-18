import { AUTH_ERROR_STORAGE_KEY, AUTH_STORAGE_KEY, AuthSession, AuthUser, PendingAuthError } from "@/app/types/auth-types";

export type { AuthSession, AuthUser, PendingAuthError };


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

