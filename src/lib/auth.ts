export type AuthUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

type AuthSession = {
  token: string;
  user: AuthUser;
};

const AUTH_STORAGE_KEY = "criptoinvest.auth";

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
