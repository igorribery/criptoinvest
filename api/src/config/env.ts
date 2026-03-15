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
};
