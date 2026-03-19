import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { Client as PgClient } from "pg";

// Tipo local para evitar dependência de @types/aws-lambda durante build/lint.
// O runtime envia eventos diferentes, mas no nosso handler não dependemos do formato exato.
type ScheduledEvent = Record<string, unknown>;

type Env = {
  AWS_REGION: string;
  DDB_TABLE_ALERT_STATE: string;
  DATABASE_URL_SECRET_ID?: string;
  DATABASE_URL?: string;
  SES_FROM_EMAIL: string;
  COINGECKO_API_BASE_URL?: string;
  SMS_ENABLED?: string;
};

type PriceAlertRow = {
  id: string;
  user_id: string;
  symbol: string;
  alert_type: "PERIODIC" | "TARGET_ONCE";
  direction: "ABOVE" | "BELOW" | null;
  target_price_brl: string | null;
  period_hours: number | null;
  notify_email: boolean;
  notify_sms: boolean;
  sms_phone_number: string | null;
  activated_price_brl: string | null;
  triggered_at: string | null;
  is_active: boolean;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
};

const env = process.env as unknown as Env;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: env.AWS_REGION }));
const ses = new SESv2Client({ region: env.AWS_REGION });
const sns = new SNSClient({ region: env.AWS_REGION });
const secrets = new SecretsManagerClient({ region: env.AWS_REGION });

async function getDatabaseUrl(): Promise<string> {
  if (env.DATABASE_URL?.trim()) return env.DATABASE_URL.trim();
  if (!env.DATABASE_URL_SECRET_ID?.trim()) {
    throw new Error("Defina DATABASE_URL ou DATABASE_URL_SECRET_ID.");
  }

  const res = await secrets.send(
    new GetSecretValueCommand({ SecretId: env.DATABASE_URL_SECRET_ID.trim() }),
  );
  const secretString = res.SecretString?.trim();
  if (!secretString) throw new Error("Secret DATABASE_URL está vazio.");
  return secretString;
}

function coingeckoBaseUrl(): string {
  return (env.COINGECKO_API_BASE_URL?.trim() || "https://api.coingecko.com/api/v3").replace(/\/+$/, "");
}

/** Host do Postgres a partir da connection string (postgres:// ou postgresql://). */
function getDatabaseHost(connectionString: string): string | null {
  try {
    const normalized = connectionString.replace(/^postgres(ql)?:/i, "http:");
    return new URL(normalized).hostname || null;
  } catch {
    return null;
  }
}

function isAwsRdsHost(host: string | null): boolean {
  if (!host) return false;
  return host.endsWith(".rds.amazonaws.com") || host.includes(".rds.amazonaws.com");
}

/**
 * Remove parâmetros SSL da URL. O driver `pg` interpreta `sslmode=require` de forma
 * que o Node ainda valida a cadeia e pode dar "self-signed certificate in certificate chain".
 * Para RDS, usamos só `ssl: { rejectUnauthorized }` no Client (sem sslmode na URL).
 */
function stripSslParamsFromConnectionString(url: string): string {
  let out = url.replace(/[?&]sslmode=[^&]*/gi, "");
  out = out.replace(/[?&]ssl=[^&]*/gi, "");
  out = out.replace(/[?&]sslcert=[^&]*/gi, "");
  out = out.replace(/[?&]sslkey=[^&]*/gi, "");
  out = out.replace(/[?&]sslrootcert=[^&]*/gi, "");
  out = out.replace(/\?&/g, "?");
  out = out.replace(/&+/g, "&");
  out = out.replace(/\?$/, "");
  if (out.endsWith("?")) out = out.slice(0, -1);
  return out;
}

function parseBoolEnv(name: string, defaultValue: boolean): boolean {
  const raw = (env as Record<string, string | undefined>)[name];
  if (!raw) return defaultValue;
  return raw.toLowerCase() === "true";
}

async function fetchSpotPricesBrl(symbols: string[]): Promise<Record<string, number | null>> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (!unique.length) return {};

  // Minimal: resolve IDs via /search para cada símbolo (para produção, faça cache/whitelist como no backend)
  const symbolToId: Record<string, string> = {};
  for (const sym of unique) {
    const url = new URL(`${coingeckoBaseUrl()}/search`);
    url.searchParams.set("query", sym);
    const r = await fetch(url.toString(), { headers: { accept: "application/json" } });
    if (!r.ok) continue;
    const data = (await r.json()) as { coins?: Array<{ id: string; symbol: string }> };
    const hit = data.coins?.find((c) => c.symbol.toUpperCase() === sym);
    if (hit?.id) symbolToId[sym] = hit.id;
  }

  const ids = [...new Set(Object.values(symbolToId))];
  if (!ids.length) return Object.fromEntries(unique.map((s) => [s, null]));

  const url = new URL(`${coingeckoBaseUrl()}/simple/price`);
  url.searchParams.set("ids", ids.join(","));
  url.searchParams.set("vs_currencies", "brl");
  const r = await fetch(url.toString(), { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`CoinGecko simple/price: ${r.status}`);
  const data = (await r.json()) as Record<string, { brl?: number }>;

  const prices: Record<string, number | null> = {};
  for (const sym of unique) {
    const id = symbolToId[sym];
    const p = id ? data?.[id]?.brl : undefined;
    prices[sym] = typeof p === "number" && Number.isFinite(p) ? p : null;
  }
  return prices;
}

function alertStateKey(alertId: string) {
  // Modelo simples: 1 item por alerta
  return { pk: `ALERT#${alertId}`, sk: "STATE" };
}

async function canTriggerAndUpdateState(alertId: string, nowIso: string, cooldownSeconds: number) {
  const key = alertStateKey(alertId);
  const existing = await ddb.send(
    new GetCommand({ TableName: env.DDB_TABLE_ALERT_STATE, Key: key }),
  );
  const lastTriggeredAt = (existing.Item?.lastTriggeredAt as string | undefined) ?? null;
  if (lastTriggeredAt) {
    const last = Date.parse(lastTriggeredAt);
    if (Number.isFinite(last)) {
      const diffSec = (Date.now() - last) / 1000;
      if (diffSec < cooldownSeconds) return false;
    }
  }

  // Atualiza com condição otimista para reduzir duplicidade em caso de retry/concorrrência.
  // Se duas execuções correrem juntas, uma pode sobrescrever a outra, mas ambas teriam passado no "cooldown".
  // Para produção, dá para reforçar com ConditionExpression por lastTriggeredAt.
  await ddb.send(
    new UpdateCommand({
      TableName: env.DDB_TABLE_ALERT_STATE,
      Key: key,
      UpdateExpression: "SET lastTriggeredAt = :now, updatedAt = :now",
      ExpressionAttributeValues: { ":now": nowIso },
    }),
  );
  return true;
}

async function sendEmail(to: string, subject: string, textBody: string, htmlBody?: string) {
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: env.SES_FROM_EMAIL,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Charset: "UTF-8", Data: subject },
          Body: {
            Text: { Charset: "UTF-8", Data: textBody },
            ...(htmlBody ? { Html: { Charset: "UTF-8", Data: htmlBody } } : {}),
          },
        },
      },
    }),
  );
}

async function sendSmsE164(phoneNumber: string, message: string) {
  if ((env.SMS_ENABLED ?? "false").toLowerCase() !== "true") return;
  await sns.send(
    new PublishCommand({
      PhoneNumber: phoneNumber,
      Message: message,
    }),
  );
}

function formatPctPtBr(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return `${sign}${formatted}%`;
}

function hoursToMs(hours: number) {
  return hours * 60 * 60 * 1000;
}

type AlertStateItem = {
  nextDueAtMs?: number;
  lastNotifiedPriceBrl?: number;
  updatedAt?: string;
};

async function getAlertState(alertId: string): Promise<AlertStateItem | null> {
  const key = alertStateKey(alertId);
  const res = await ddb.send(new GetCommand({ TableName: env.DDB_TABLE_ALERT_STATE, Key: key }));
  return (res.Item as AlertStateItem | undefined) ?? null;
}

async function setAlertState(alertId: string, patch: AlertStateItem) {
  const key = alertStateKey(alertId);
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = { ":updatedAt": new Date().toISOString() };
  const sets: string[] = ["updatedAt = :updatedAt"];

  if (typeof patch.nextDueAtMs === "number") {
    values[":nextDueAtMs"] = patch.nextDueAtMs;
    sets.push("nextDueAtMs = :nextDueAtMs");
  }
  if (typeof patch.lastNotifiedPriceBrl === "number") {
    values[":lastNotifiedPriceBrl"] = patch.lastNotifiedPriceBrl;
    sets.push("lastNotifiedPriceBrl = :lastNotifiedPriceBrl");
  }

  await ddb.send(
    new UpdateCommand({
      TableName: env.DDB_TABLE_ALERT_STATE,
      Key: key,
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
      ExpressionAttributeValues: values,
    }),
  );
}

export const handler = async (_event: ScheduledEvent) => {
  if (!env.AWS_REGION || !env.DDB_TABLE_ALERT_STATE || !env.SES_FROM_EMAIL) {
    throw new Error("Env obrigatórias: AWS_REGION, DDB_TABLE_ALERT_STATE, SES_FROM_EMAIL.");
  }

  const databaseUrl = await getDatabaseUrl();
  const host = getDatabaseHost(databaseUrl);
  const isRds = isAwsRdsHost(host);
  // RDS exige TLS; sem SSL o erro é "no encryption". URL limpa + ssl explícito evita
  // conflito com sslmode=require e o erro "self-signed certificate in certificate chain".
  const connectionString = isRds ? stripSslParamsFromConnectionString(databaseUrl) : databaseUrl;
  const rejectUnauthorized = parseBoolEnv("RDS_SSL_REJECT_UNAUTHORIZED", false);
  const useSsl = isRds || /[?&]sslmode=/i.test(databaseUrl) || /[?&]ssl=true/i.test(databaseUrl);

  const pg = new PgClient({
    connectionString,
    statement_timeout: 25_000,
    ...(useSsl ? { ssl: { rejectUnauthorized } } : {}),
  });
  await pg.connect();

  try {
    const alertsRes = await (pg as any).query(
      `SELECT id, user_id, symbol, alert_type, direction, target_price_brl, period_hours,
              notify_email, notify_sms, sms_phone_number, activated_price_brl, triggered_at,
              is_active
       FROM price_alerts
       WHERE is_active = true`,
    );
    const alerts: PriceAlertRow[] = alertsRes.rows ?? [];
    if (!alerts.length) return { ok: true, checked: 0, triggered: 0 };

    const symbols: string[] = [...new Set(alerts.map((a) => a.symbol.toUpperCase()))];
    const prices = await fetchSpotPricesBrl(symbols);
    const nowIso = new Date().toISOString();

    let triggered = 0;

    // Cache de users para evitar n queries
    const userIds: string[] = [...new Set(alerts.map((a) => a.user_id))];
    const usersRes = await (pg as any).query(
      `SELECT id, email, name FROM users WHERE id = ANY($1::uuid[])`,
      [userIds],
    );
    const users: UserRow[] = usersRes.rows ?? [];
    const usersById: Map<string, UserRow> = new Map(users.map((u) => [u.id, u]));

    for (const alert of alerts) {
      const sym = alert.symbol.toUpperCase();
      const p = prices[sym];
      if (typeof p !== "number" || !Number.isFinite(p)) continue;

      const user: UserRow | undefined = usersById.get(alert.user_id);
      if (!user?.email) continue;

      // PERIODIC: a cada 4/12/24h manda preço + variação vs último envio (ou activated_price na primeira vez).
      if (alert.alert_type === "PERIODIC") {
        const hours = Number(alert.period_hours);
        if (![4, 12, 24].includes(hours)) continue;

        const state = await getAlertState(alert.id);
        const nowMs = Date.now();
        const nextDueAtMs = state?.nextDueAtMs ?? 0;
        if (nextDueAtMs && nowMs < nextDueAtMs) {
          continue;
        }

        // Primeira execução do alerta periódico: NÃO envia.
        // Só inicializa o baseline e agenda o próximo envio para daqui X horas.
        if (!state?.nextDueAtMs) {
          const next = nowMs + hoursToMs(hours);
          const activated = Number(alert.activated_price_brl);
          const baseline =
            Number.isFinite(activated) && activated > 0
              ? activated
              : p;

          await setAlertState(alert.id, { nextDueAtMs: next, lastNotifiedPriceBrl: baseline });

          if (!Number.isFinite(activated) || activated <= 0) {
            await (pg as any).query(
              `UPDATE price_alerts SET activated_price_brl = $1, updated_at = NOW()
               WHERE id = $2 AND user_id = $3`,
              [baseline, alert.id, alert.user_id],
            );
          }

          continue;
        }

        const activated = Number(alert.activated_price_brl);
        const baseline =
          typeof state?.lastNotifiedPriceBrl === "number"
            ? state.lastNotifiedPriceBrl
            : Number.isFinite(activated) && activated > 0
              ? activated
              : p;

        const pct = baseline > 0 ? ((p - baseline) / baseline) * 100 : 0;
        const subject = `CriptoInvest: ${sym} nas últimas ${hours}h`;
        const text = [
          `Olá, ${user.name || "investidor"}!`,
          "",
          `${sym} ${pct >= 0 ? "subiu" : "caiu"} ${formatPctPtBr(pct)} nas últimas ${hours}h.`,
          `Preço atual: R$ ${p.toFixed(2)}`,
          "",
          "Você pode ajustar ou desativar este alerta no CriptoInvest.",
        ].join("\n");

        if (alert.notify_email) {
          await sendEmail(user.email, subject, text);
        }
        if (alert.notify_sms && alert.sms_phone_number?.trim()) {
          await sendSmsE164(
            alert.sms_phone_number.trim(),
            `${sym}: ${pct >= 0 ? "↑" : "↓"} ${formatPctPtBr(pct)} em ${hours}h. Preço: R$ ${p.toFixed(2)}`,
          );
        }

        // Atualiza estado no DDB e grava preço de ativação no Postgres (1ª vez).
        const next = nowMs + hoursToMs(hours);
        await setAlertState(alert.id, { nextDueAtMs: next, lastNotifiedPriceBrl: p });
        if (!Number.isFinite(activated) || activated <= 0) {
          await (pg as any).query(
            `UPDATE price_alerts SET activated_price_brl = $1, updated_at = NOW()
             WHERE id = $2 AND user_id = $3`,
            [p, alert.id, alert.user_id],
          );
        }

        triggered += 1;
        continue;
      }

      // TARGET_ONCE: dispara 1x quando bater o alvo e desativa.
      if (alert.alert_type === "TARGET_ONCE") {
        const direction = alert.direction;
        const target = Number(alert.target_price_brl);
        if (!direction) continue;
        if (!Number.isFinite(target) || target <= 0) continue;

        const shouldTrigger = direction === "ABOVE" ? p >= target : p <= target;
        if (!shouldTrigger) continue;

        const activated = Number(alert.activated_price_brl);
        const baseline = Number.isFinite(activated) && activated > 0 ? activated : p;
        const pct = baseline > 0 ? ((p - baseline) / baseline) * 100 : 0;

        const subject = `Alerta CriptoInvest: ${sym} ${direction === "ABOVE" ? "≥" : "≤"} R$ ${target.toFixed(2)}`;
        const text = [
          `Olá, ${user.name || "investidor"}!`,
          "",
          `Seu alerta foi atingido para ${sym}.`,
          `Preço atual: R$ ${p.toFixed(2)}`,
          `Variação desde a ativação: ${formatPctPtBr(pct)}`,
          "",
          "Este alerta será desativado automaticamente.",
        ].join("\n");

        if (alert.notify_email) {
          await sendEmail(user.email, subject, text);
        }
        if (alert.notify_sms && alert.sms_phone_number?.trim()) {
          await sendSmsE164(
            alert.sms_phone_number.trim(),
            `${sym} atingiu ${direction === "ABOVE" ? "≥" : "≤"} R$ ${target.toFixed(2)}. Agora: R$ ${p.toFixed(2)} (${formatPctPtBr(pct)}).`,
          );
        }

        // Marca como disparado e desativa
        await (pg as any).query(
          `UPDATE price_alerts
           SET is_active = false, triggered_at = NOW(), updated_at = NOW(), activated_price_brl = COALESCE(activated_price_brl, $1)
           WHERE id = $2 AND user_id = $3`,
          [p, alert.id, alert.user_id],
        );

        triggered += 1;
      }
    }

    return { ok: true, checked: alerts.length, triggered };
  } finally {
    await pg.end().catch(() => {});
  }
};
