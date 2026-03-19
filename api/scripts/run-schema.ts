/**
 * Roda api/sql/schema.sql no banco definido em DATABASE_URL (api/.env).
 * Use quando não tiver psql instalado (ex.: rodar schema no RDS).
 *
 * Exemplo: cd api && npx tsx scripts/run-schema.ts
 */
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function getDatabaseHost(connectionString: string): string | null {
  try {
    const normalized = connectionString.replace(/^postgres(ql)?:/i, "http:");
    return new URL(normalized).hostname || null;
  } catch {
    return null;
  }
}

function isRds(host: string | null): boolean {
  if (!host) return false;
  return host.endsWith(".rds.amazonaws.com") || host.includes(".rds.amazonaws.com");
}

function stripSslParams(url: string): string {
  let out = url.replace(/[?&]sslmode=[^&]*/gi, "");
  out = out.replace(/[?&]ssl=[^&]*/gi, "");
  out = out.replace(/[?&]sslcert=[^&]*/gi, "");
  out = out.replace(/[?&]sslkey=[^&]*/gi, "");
  out = out.replace(/[?&]sslrootcert=[^&]*/gi, "");
  out = out.replace(/\?&/g, "?").replace(/&+/g, "&").replace(/\?$/, "");
  if (out.endsWith("?")) out = out.slice(0, -1);
  return out;
}

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    console.error("Defina DATABASE_URL no api/.env");
    process.exit(1);
  }

  const host = getDatabaseHost(connectionString);
  const useSsl = isRds(host);
  const cleanUrl = useSsl ? stripSslParams(connectionString) : connectionString;

  const schemaPath = join(__dirname, "..", "sql", "schema.sql");
  const sql = readFileSync(schemaPath, "utf-8");

  const migrationPath = join(__dirname, "..", "sql", "migrations", "003_price_alerts_v2.sql");
  const migrationSql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf-8") : "";

  const migration4Path = join(__dirname, "..", "sql", "migrations", "004_price_alerts_relax_legacy.sql");
  const migration4Sql = existsSync(migration4Path) ? readFileSync(migration4Path, "utf-8") : "";

  const client = new pg.Client({
    connectionString: cleanUrl,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  try {
    await client.connect();
    console.log("Conectado. Executando schema.sql...");
    await client.query(sql);
    if (migrationSql.trim()) {
      console.log("Executando migration 003_price_alerts_v2.sql...");
      await client.query(migrationSql);
    }
    if (migration4Sql.trim()) {
      console.log("Executando migration 004_price_alerts_relax_legacy.sql...");
      await client.query(migration4Sql);
    }
    console.log("Schema aplicado com sucesso.");
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
