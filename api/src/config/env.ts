import "dotenv/config";

const required = ["DATABASE_URL", "JWT_SECRET"] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Variável obrigatória ausente: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL as string,
  jwtSecret: process.env.JWT_SECRET as string,
  tokenExpiresInHours: Number(process.env.TOKEN_EXPIRES_IN_HOURS ?? 24),
  coingeckoApiBaseUrl:
    process.env.COINGECKO_API_BASE_URL ?? "https://api.coingecko.com/api/v3",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/auth/google/callback",
};

export const isGoogleAuthEnabled = Boolean(env.googleClientId && env.googleClientSecret);
