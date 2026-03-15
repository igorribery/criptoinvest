import { randomBytes, randomInt } from "node:crypto";
import { Router } from "express";
import { env, isGoogleAuthEnabled } from "../config/env.js";
import { pool } from "../db/pool.js";
import { sendRegisterCodeEmail } from "../services/email.service.js";
import { hashPassword, signToken, verifyPassword } from "../utils/crypto.js";
import { isValidEmail } from "../utils/validators.js";

type DbUser = {
  id: string;
  name: string;
  email: string;
  password_hash: string | null;
  google_id: string | null;
  created_at: string;
};

type PendingUser = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  verification_code_hash: string;
  attempt_count: number;
  expires_at: string;
  created_at: string;
};

function sanitizeUser(user: DbUser, extras?: { avatarUrl?: string }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.created_at,
    avatarUrl: extras?.avatarUrl,
  };
}

export const authRouter = Router();

function generateVerificationCode() {
  return randomInt(100000, 1000000).toString();
}

async function findExistingUserByEmail(email: string) {
  return pool.query("SELECT id, name, email, password_hash, google_id, created_at FROM users WHERE email = $1", [
    email,
  ]);
}

authRouter.post("/register/start", async (req, res) => {
  const { name, email, password } = req.body as {
    name?: string;
    email?: string;
    password?: string;
  };

  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email e password sao obrigatorios." });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Email invalido." });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "Senha deve ter ao menos 6 caracteres." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await findExistingUserByEmail(normalizedEmail);

  if (existingUser.rowCount) {
    const user = existingUser.rows[0] as DbUser;
    const message =
      user.google_id && !user.password_hash
        ? "Este email ja esta cadastrado pelo Google. Entre com o Google para continuar."
        : "Email ja cadastrado.";

    return res.status(409).json({ message });
  }

  const code = generateVerificationCode();
  const passwordHash = hashPassword(password);
  const codeHash = hashPassword(code);
  const expiresAt = new Date(Date.now() + env.registerCodeExpiresMinutes * 60 * 1000).toISOString();

  await pool.query(
    `INSERT INTO pending_users (name, email, password_hash, verification_code_hash, expires_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (email) DO UPDATE
     SET name = EXCLUDED.name,
         password_hash = EXCLUDED.password_hash,
         verification_code_hash = EXCLUDED.verification_code_hash,
         expires_at = EXCLUDED.expires_at,
         attempt_count = 0,
         updated_at = NOW()`,
    [name.trim(), normalizedEmail, passwordHash, codeHash, expiresAt],
  );

  await sendRegisterCodeEmail(normalizedEmail, name.trim(), code);

  return res.status(202).json({
    message: "Codigo de confirmacao enviado para o seu email.",
    email: normalizedEmail,
    expiresInMinutes: env.registerCodeExpiresMinutes,
  });
});

authRouter.post("/register/confirm", async (req, res) => {
  const { email, code } = req.body as { email?: string; code?: string };

  if (!email || !code) {
    return res.status(400).json({ message: "email e codigo sao obrigatorios." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await findExistingUserByEmail(normalizedEmail);

  if (existingUser.rowCount) {
    return res.status(409).json({ message: "Email ja cadastrado." });
  }

  const pendingResult = await pool.query(
    `SELECT id, name, email, password_hash, verification_code_hash, attempt_count, expires_at, created_at
     FROM pending_users
     WHERE email = $1`,
    [normalizedEmail],
  );

  if (!pendingResult.rowCount) {
    return res.status(404).json({ message: "Cadastro pendente nao encontrado. Solicite um novo codigo." });
  }

  const pendingUser = pendingResult.rows[0] as PendingUser;
  const isExpired = new Date(pendingUser.expires_at).getTime() < Date.now();

  if (isExpired) {
    await pool.query("DELETE FROM pending_users WHERE id = $1", [pendingUser.id]);
    return res.status(410).json({ message: "Codigo expirado. Solicite um novo envio." });
  }

  if (pendingUser.attempt_count >= env.registerCodeMaxAttempts) {
    await pool.query("DELETE FROM pending_users WHERE id = $1", [pendingUser.id]);
    return res.status(429).json({ message: "Limite de tentativas excedido. Solicite um novo codigo." });
  }

  const sanitizedCode = code.trim();
  if (!verifyPassword(sanitizedCode, pendingUser.verification_code_hash)) {
    await pool.query(
      "UPDATE pending_users SET attempt_count = attempt_count + 1, updated_at = NOW() WHERE id = $1",
      [pendingUser.id],
    );
    return res.status(400).json({ message: "Codigo invalido." });
  }

  const created = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, password_hash, google_id, created_at`,
    [pendingUser.name, pendingUser.email, pendingUser.password_hash],
  );

  await pool.query("DELETE FROM pending_users WHERE id = $1", [pendingUser.id]);

  const user = created.rows[0] as DbUser;
  const token = signToken(user.id, user.email);

  return res.status(201).json({ user: sanitizeUser(user), token });
});

authRouter.post("/register/resend", async (req, res) => {
  const { email } = req.body as { email?: string };

  if (!email) {
    return res.status(400).json({ message: "email e obrigatorio." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await findExistingUserByEmail(normalizedEmail);

  if (existingUser.rowCount) {
    return res.status(409).json({ message: "Email ja cadastrado." });
  }

  const pendingResult = await pool.query(
    `SELECT id, name, email, password_hash, verification_code_hash, attempt_count, expires_at, created_at
     FROM pending_users
     WHERE email = $1`,
    [normalizedEmail],
  );

  if (!pendingResult.rowCount) {
    return res.status(404).json({ message: "Cadastro pendente nao encontrado. Refaça o cadastro." });
  }

  const pendingUser = pendingResult.rows[0] as PendingUser;
  const code = generateVerificationCode();
  const codeHash = hashPassword(code);
  const expiresAt = new Date(Date.now() + env.registerCodeExpiresMinutes * 60 * 1000).toISOString();

  await pool.query(
    `UPDATE pending_users
     SET verification_code_hash = $2,
         expires_at = $3,
         attempt_count = 0,
         updated_at = NOW()
     WHERE id = $1`,
    [pendingUser.id, codeHash, expiresAt],
  );

  await sendRegisterCodeEmail(normalizedEmail, pendingUser.name, code);

  return res.status(202).json({
    message: "Novo codigo enviado para o seu email.",
    email: normalizedEmail,
    expiresInMinutes: env.registerCodeExpiresMinutes,
  });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ message: "email e password sao obrigatorios." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const result = await findExistingUserByEmail(normalizedEmail);

  if (!result.rowCount) {
    return res.status(401).json({ message: "Credenciais invalidas." });
  }

  const user = result.rows[0] as DbUser;

  if (!user.password_hash && user.google_id) {
    return res.status(403).json({
      message: "Este email foi cadastrado pelo Google. Entre com o Google para continuar.",
    });
  }

  if (!user.password_hash || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ message: "Credenciais invalidas." });
  }

  const token = signToken(user.id, user.email);

  return res.json({ user: sanitizeUser(user), token });
});

authRouter.get("/google/url", async (_req, res) => {
  if (!isGoogleAuthEnabled) {
    return res.status(503).json({ message: "Login com Google nao esta configurado no servidor." });
  }

  const state = randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: env.googleClientId!,
    redirect_uri: env.googleRedirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return res.json({
    authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    state,
  });
});

authRouter.post("/google/exchange", async (req, res) => {
  if (!isGoogleAuthEnabled) {
    return res.status(503).json({ message: "Login com Google nao esta configurado no servidor." });
  }

  const { code } = req.body as { code?: string };

  if (!code) {
    return res.status(400).json({ message: "Code do Google e obrigatorio." });
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId!,
      client_secret: env.googleClientSecret!,
      redirect_uri: env.googleRedirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!tokenResponse.ok) {
    const details = await tokenResponse.text();
    return res.status(401).json({ message: "Falha ao autenticar com Google.", details });
  }

  const tokenData = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    return res.status(401).json({ message: "Google nao retornou access token." });
  }

  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  if (!profileResponse.ok) {
    return res.status(401).json({ message: "Falha ao obter perfil do Google." });
  }

  const profile = (await profileResponse.json()) as {
    sub?: string;
    name?: string;
    email?: string;
    email_verified?: boolean;
    picture?: string;
  };

  if (!profile.sub || !profile.email || !profile.email_verified) {
    return res.status(400).json({ message: "Conta Google sem email verificado." });
  }

  const existingByGoogle = await pool.query(
    "SELECT id, name, email, password_hash, google_id, created_at FROM users WHERE google_id = $1",
    [profile.sub],
  );

  let user: DbUser;

  if (existingByGoogle.rowCount) {
    user = existingByGoogle.rows[0] as DbUser;
  } else {
    const existingByEmail = await pool.query(
      "SELECT id, name, email, password_hash, google_id, created_at FROM users WHERE email = $1",
      [profile.email],
    );

    if (existingByEmail.rowCount) {
      const existingUser = existingByEmail.rows[0] as DbUser;

      if (!existingUser.google_id) {
        return res.status(409).json({
          message:
            "Este email ja esta cadastrado com senha. Entre com email e senha para continuar.",
          email: profile.email,
        });
      }

      user = existingUser;
    } else {
      const created = await pool.query(
        `INSERT INTO users (name, email, google_id)
         VALUES ($1, $2, $3)
         RETURNING id, name, email, password_hash, google_id, created_at`,
        [profile.name ?? profile.email.split("@")[0], profile.email, profile.sub],
      );
      user = created.rows[0] as DbUser;
    }
  }

  const token = signToken(user.id, user.email);
  return res.json({ user: sanitizeUser(user, { avatarUrl: profile.picture }), token });
});
