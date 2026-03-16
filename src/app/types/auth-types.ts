export type AuthUser = {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    avatarUrl?: string;
  };
  
  export type AuthSession = {
    token: string;
    user: AuthUser;
  };
  
  export const AUTH_STORAGE_KEY = "criptoinvest.auth";
  export const AUTH_ERROR_STORAGE_KEY = "criptoinvest.auth.error";
  
  export type PendingAuthError = {
    message: string;
    email?: string;
  };