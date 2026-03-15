import { randomBytes } from "node:crypto";
import { Router } from "express";
import { env, isGoogleAuthEnabled } from "../config/env.js";
import { pool } from "../db/pool.js";
import { hashPassword, signToken, verifyPassword } from "../utils/crypto.js";
import { isValidEmail } from "../utils/validators.js";

type DbUser = {
  id: string;
  name: string;
  email: string;
  password_hash: string | null;
  created_at: string;
};

function sanitizeUser(user: DbUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.created_at,
  };
}

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const { name, email, password } = req.body as {
    name?: string;
    email?: string;
    password?: string;
  };

  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email e password são obrigatórios." });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Email inválido." });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "Senha deve ter ao menos 6 caracteres." });
  }

  const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existingUser.rowCount) {
    return res.status(409).json({ message: "Email já cadastrado." });
  }

  const passwordHash = hashPassword(password);
  const created = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, password_hash, created_at`,
    [name, email, passwordHash],
  );

  const user = created.rows[0] as DbUser;
  const token = signToken(user.id, user.email);

  return res.status(201).json({ user: sanitizeUser(user), token });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ message: "email e password são obrigatórios." });
  }

  const result = await pool.query(
    "SELECT id, name, email, password_hash, created_at FROM users WHERE email = $1",
    [email],
  );

  if (!result.rowCount) {
    return res.status(401).json({ message: "Credenciais inválidas." });
  }

  const user = result.rows[0] as DbUser;

  if (!user.password_hash || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ message: "Credenciais inválidas." });
  }

  const token = signToken(user.id, user.email);

  return res.json({ user: sanitizeUser(user), token });
});

authRouter.get("/google/url", async (_req, res) => {
  if (!isGoogleAuthEnabled) {
    return res
      .status(503)
      .json({ message: "Login com Google não está configurado no servidor." });
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
    return res
      .status(503)
      .json({ message: "Login com Google não está configurado no servidor." });
  }

  const { code } = req.body as { code?: string };

  if (!code) {
    return res.status(400).json({ message: "Code do Google é obrigatório." });
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
    return res.status(401).json({ message: "Google não retornou access token." });
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
  };

  if (!profile.sub || !profile.email || !profile.email_verified) {
    return res.status(400).json({ message: "Conta Google sem e-mail verificado." });
  }

  const existingByGoogle = await pool.query(
    "SELECT id, name, email, password_hash, created_at FROM users WHERE google_id = $1",
    [profile.sub],
  );

  let user: DbUser;

  if (existingByGoogle.rowCount) {
    user = existingByGoogle.rows[0] as DbUser;
  } else {
    const existingByEmail = await pool.query(
      "SELECT id, name, email, password_hash, created_at FROM users WHERE email = $1",
      [profile.email],
    );

    if (existingByEmail.rowCount) {
      const linked = await pool.query(
        `UPDATE users
         SET google_id = $1, name = COALESCE(NULLIF(name, ''), $2)
         WHERE email = $3
         RETURNING id, name, email, password_hash, created_at`,
        [profile.sub, profile.name ?? profile.email.split("@")[0], profile.email],
      );
      user = linked.rows[0] as DbUser;
    } else {
      const created = await pool.query(
        `INSERT INTO users (name, email, google_id)
         VALUES ($1, $2, $3)
         RETURNING id, name, email, password_hash, created_at`,
        [profile.name ?? profile.email.split("@")[0], profile.email, profile.sub],
      );
      user = created.rows[0] as DbUser;
    }
  }

  const token = signToken(user.id, user.email);
  return res.json({ user: sanitizeUser(user), token });
});
