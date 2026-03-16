import { AuthUser } from "./auth-types";

export type Mode = "login" | "register" | "forgotPassword";
export type RegisterStep = "form" | "verify";
export type TransactionType = "buy" | "sell";

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type RegisterStartResponse = {
  message: string;
  email: string;
  expiresInMinutes: number;
};

export type PasswordForgotResponse = {
  message: string;
};

export type CryptoOption = {
  name: string;
  symbol: string;
};

export type AddCryptoForm = {
  assetQuery: string;
  transactionDate: string;
  quantity: string;
  unitPriceBrl: string;
  otherCostsBrl: string;
};