import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

const TOKEN_HEADER = { alg: "HS256", typ: "JWT" };

function toBase64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, originalHash] = storedHash.split(":");
  if (!salt || !originalHash) return false;

  const hash = scryptSync(password, salt, 64).toString("hex");
  return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(originalHash, "hex"));
}

type TokenPayload = {
  sub: string;
  email: string;
  exp: number;
};

export function signToken(userId: string, email: string) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    sub: userId,
    email,
    exp: nowInSeconds + env.tokenExpiresInHours * 3600,
  };

  const encodedHeader = toBase64Url(JSON.stringify(TOKEN_HEADER));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const content = `${encodedHeader}.${encodedPayload}`;

  const signature = createHmac("sha256", env.jwtSecret)
    .update(content)
    .digest("base64url");

  return `${content}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;

  const content = `${header}.${payload}`;
  const expectedSignature = createHmac("sha256", env.jwtSecret)
    .update(content)
    .digest("base64url");

  if (signature !== expectedSignature) return null;

  try {
    const parsedPayload = JSON.parse(fromBase64Url(payload)) as TokenPayload;
    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (!parsedPayload.exp || parsedPayload.exp < nowInSeconds) {
      return null;
    }
    return parsedPayload;
  } catch {
    return null;
  }
}
