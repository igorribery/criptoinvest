import { randomBytes, randomInt } from "node:crypto";
import { Router } from "express";
import { env, isGoogleAuthEnabled } from "../config/env.js";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { sendPasswordResetEmail, sendRegisterCodeEmail } from "../services/email.service.js";
import { uploadAvatar } from "../services/storage.service.js";
import { hashPassword, signToken, verifyPassword } from "../utils/crypto.js";
import { isValidEmail } from "../utils/validators.js";
import { DbUser, PendingUser, PendingEmailChange, PendingPasswordReset, GoogleProfile, ResetPassword, CodeVerification, pendingChangeOwner, Login } from "../types/auth-types.js";
import { SignToken } from "../types/cripto-types.js";


function sanitizeUser(user: DbUser, extras?: { avatarUrl?: string }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.created_at,
    avatarUrl: user.avatar_url ?? extras?.avatarUrl,
  };
}

export const authRouter = Router();

function generateVerificationCode() {
  return randomInt(100000, 1000000).toString();
}

function generateResetToken() {
  return randomBytes(32).toString("hex");
}

async function findExistingUserByEmail(email: string) {
  return pool.query("SELECT id, name, email, password_hash, avatar_url, google_id, created_at FROM users WHERE email = $1", [
    email,
  ]);
}

async function findUserById(userId: string) {
  return pool.query("SELECT id, name, email, password_hash, avatar_url, google_id, created_at FROM users WHERE id = $1", [userId]);
}

authRouter.post("/register/start", async (req, res) => {
  const { name, email, password } = req.body as {
    name?: string;
    email?: string;
    password?: string;
  };

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Nome, e-mail e senha são obrigatórios." });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "E-mail inválido." });
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
        ? "Este e-mail já está cadastrado pelo Google. Entre com o Google para continuar."
        : "E-mail já cadastrado.";

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
    message: "Código de confirmação enviado para o seu e-mail.",
    email: normalizedEmail,
    expiresInMinutes: env.registerCodeExpiresMinutes,
  });
});

authRouter.post("/register/confirm", async (req, res) => {
  const { email, code } = req.body as { email?: string; code?: string };

  if (!email || !code) {
    return res.status(400).json({ message: "E-mail e código são obrigatórios." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await findExistingUserByEmail(normalizedEmail);

  if (existingUser.rowCount) {
    return res.status(409).json({ message: "E-mail já cadastrado." });
  }

  const pendingResult = await pool.query(
    `SELECT id, name, email, password_hash, verification_code_hash, attempt_count, expires_at, created_at
     FROM pending_users
     WHERE email = $1`,
    [normalizedEmail],
  );

  if (!pendingResult.rowCount) {
    return res.status(404).json({ message: "Cadastro pendente não encontrado. Solicite um novo código." });
  }

  const pendingUser = pendingResult.rows[0] as PendingUser;
  const isExpired = new Date(pendingUser.expires_at).getTime() < Date.now();

  if (isExpired) {
    await pool.query("DELETE FROM pending_users WHERE id = $1", [pendingUser.id]);
    return res.status(410).json({ message: "Código expirado. Solicite um novo envio." });
  }

  if (pendingUser.attempt_count >= env.registerCodeMaxAttempts) {
    await pool.query("DELETE FROM pending_users WHERE id = $1", [pendingUser.id]);
    return res.status(429).json({ message: "Limite de tentativas excedido. Solicite um novo código." });
  }

  const sanitizedCode = code.trim();
  if (!verifyPassword({ password: sanitizedCode, storedHash: pendingUser.verification_code_hash })) {
    await pool.query(
      "UPDATE pending_users SET attempt_count = attempt_count + 1, updated_at = NOW() WHERE id = $1",
      [pendingUser.id],
    );
    return res.status(400).json({ message: "Código inválido." });
  }

  const created = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, password_hash, avatar_url, google_id, created_at`,
    [pendingUser.name, pendingUser.email, pendingUser.password_hash],
  );

  await pool.query("DELETE FROM pending_users WHERE id = $1", [pendingUser.id]);

  const user = created.rows[0] as DbUser;
  const token = signToken({ userId: user.id, email: user.email } as SignToken);

  return res.status(201).json({ user: sanitizeUser(user), token });
});

authRouter.post("/register/resend", async (req, res) => {
  const { email } = req.body as { email?: string };

  if (!email) {
    return res.status(400).json({ message: "E-mail é obrigatório." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await findExistingUserByEmail(normalizedEmail);

  if (existingUser.rowCount) {
    return res.status(409).json({ message: "E-mail já cadastrado." });
  }

  const pendingResult = await pool.query(
    `SELECT id, name, email, password_hash, verification_code_hash, attempt_count, expires_at, created_at
     FROM pending_users
     WHERE email = $1`,
    [normalizedEmail],
  );

  if (!pendingResult.rowCount) {
    return res.status(404).json({ message: "Cadastro pendente não encontrado. Refaça o cadastro." });
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
    message: "Novo código enviado para o seu e-mail.",
    email: normalizedEmail,
    expiresInMinutes: env.registerCodeExpiresMinutes,
  });
});

authRouter.patch("/profile", requireAuth, async (req, res) => {
  const { name } = req.body as { name?: string };

  if (!name?.trim()) {
    return res.status(400).json({ message: "Nome é obrigatório." });
  }

  const updated = await pool.query(
    `UPDATE users
     SET name = $2
     WHERE id = $1
     RETURNING id, name, email, password_hash, avatar_url, google_id, created_at`,
    [req.authUser!.id, name.trim()],
  );

  if (!updated.rowCount) {
    return res.status(404).json({ message: "Usuário não encontrado." });
  }

  const user = updated.rows[0] as DbUser;
  return res.json({ user: sanitizeUser(user) });
});

authRouter.post("/password/change", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Senha atual e nova senha são obrigatórias." });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: "Nova senha deve ter ao menos 6 caracteres." });
  }

  const result = await findUserById(req.authUser!.id);
  if (!result.rowCount) {
    return res.status(404).json({ message: "Usuário não encontrado." });
  }

  const user = result.rows[0] as DbUser;

  if (!user.password_hash) {
    return res.status(403).json({
      message: "Sua conta não possui senha local. Entre pelo Google para continuar.",
    });
  }

  if (!verifyPassword({ password: currentPassword, storedHash: user.password_hash })) {
    return res.status(401).json({ message: "Senha atual inválida." });
  }

  await pool.query("UPDATE users SET password_hash = $2 WHERE id = $1", [
    req.authUser!.id,
    hashPassword(newPassword),
  ]);

  return res.json({ message: "Senha atualizada com sucesso." });
});

authRouter.post("/profile/avatar", requireAuth, async (req, res) => {
  const { imageDataUrl } = req.body as { imageDataUrl?: string };

  if (!imageDataUrl) {
    return res.status(400).json({ message: "Imagem obrigatoria." });
  }

  const avatarUrl = await uploadAvatar(req.authUser!.id, imageDataUrl);
  const updated = await pool.query(
    `UPDATE users
     SET avatar_url = $2
     WHERE id = $1
     RETURNING id, name, email, password_hash, avatar_url, google_id, created_at`,
    [req.authUser!.id, avatarUrl],
  );

  if (!updated.rowCount) {
    return res.status(404).json({ message: "Usuario nao encontrado." });
  }

  return res.json({
    message: "Foto de perfil atualizada com sucesso.",
    user: sanitizeUser(updated.rows[0] as DbUser),
  });
});

authRouter.post("/password/forgot", async (req, res) => {
  const { email } = req.body as { email?: string };

  if (!email) {
    return res.status(400).json({ message: "E-mail obrigatorio." });
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ message: "E-mail invalido." });
  }

  const result = await findExistingUserByEmail(normalizedEmail);

  if (!result.rowCount) {
    return res.status(404).json({
      message: "Nenhuma conta foi encontrada com este e-mail. O link de recuperação nao foi enviado.",
    });
  }

  const user = result.rows[0] as DbUser;

  if (!user.password_hash) {
    return res.status(400).json({
      message: "Esta conta não usa senha local. Entre com o Google para continuar.",
    });
  }

  const resetToken = generateResetToken();
  const tokenHash = hashPassword(resetToken);
  const expiresAt = new Date(Date.now() + env.passwordResetExpiresMinutes * 60 * 1000).toISOString();
  const resetLink = `${env.frontendUrl.replace(/\/$/, "")}/auth/redefinir-senha?token=${encodeURIComponent(resetToken)}`;

  await pool.query(
    `INSERT INTO pending_password_resets (user_id, token_hash, expires_at, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id) DO UPDATE
     SET token_hash = EXCLUDED.token_hash,
         expires_at = EXCLUDED.expires_at,
         updated_at = NOW()`,
    [user.id, tokenHash, expiresAt],
  );

  await sendPasswordResetEmail(normalizedEmail, user.name, resetLink);

  return res.json({
    message: "Enviamos as instruções de recuperação para o seu e-mail.",
  });
});

authRouter.post("/password/reset", async (req, res) => {
  const { token, newPassword } = req.body as ResetPassword

  if (!token || !newPassword) {
    return res.status(400).json({ message: "Token e nova senha são obrigatórios." });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: "Nova senha deve ter ao menos 6 caracteres." });
  }

  const pendingResult = await pool.query(
    `SELECT id, user_id, token_hash, expires_at
     FROM pending_password_resets`,
  );

  if (!pendingResult.rowCount) {
    return res.status(400).json({ message: "Link inválido ou expirado." });
  }

  const pendingResets = pendingResult.rows as PendingPasswordReset[];
  const pendingReset = pendingResets.find((reset) => verifyPassword({ password: token, storedHash: reset.token_hash }));

  if (!pendingReset) {
    return res.status(400).json({ message: "Link inválido ou expirado." });
  }

  if (new Date(pendingReset.expires_at).getTime() < Date.now()) {
    await pool.query("DELETE FROM pending_password_resets WHERE id = $1", [pendingReset.id]);
    return res.status(410).json({ message: "Link expirado. Solicite uma nova recuperação." });
  }

  const userResult = await findUserById(pendingReset.user_id);

  if (!userResult.rowCount) {
    await pool.query("DELETE FROM pending_password_resets WHERE id = $1", [pendingReset.id]);
    return res.status(404).json({ message: "Usuário não encontrado." });
  }

  await pool.query("UPDATE users SET password_hash = $2 WHERE id = $1", [
    pendingReset.user_id,
    hashPassword(newPassword),
  ]);
  await pool.query("DELETE FROM pending_password_resets WHERE user_id = $1", [pendingReset.user_id]);

  return res.json({ message: "Senha redefinida com sucesso." });
});

authRouter.post("/email-change/start", requireAuth, async (req, res) => {
  const { newEmail } = req.body as CodeVerification

  if (!newEmail) {
    return res.status(400).json({ message: "Novo e-mail é obrigatório." });
  }

  const normalizedEmail = newEmail.trim().toLowerCase();

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ message: "E-mail inválido." });
  }

  if (normalizedEmail === req.authUser!.email.toLowerCase()) {
    return res.status(400).json({ message: "Informe um e-mail diferente do atual." });
  }

  const existingUser = await findExistingUserByEmail(normalizedEmail);
  if (existingUser.rowCount) {
    return res.status(409).json({ message: "Este e-mail já está em uso." });
  }

  const existingPendingChange = await pool.query(
    "SELECT id, user_id FROM pending_email_changes WHERE new_email = $1",
    [normalizedEmail],
  );

  if (existingPendingChange.rowCount) {
    const pendingChangeOwner = existingPendingChange.rows[0] as pendingChangeOwner;
    if (pendingChangeOwner.user_id !== req.authUser!.id) {
      return res.status(409).json({ message: "Este e-mail já está reservado em outra confirmação." });
    }
  }

  const userResult = await findUserById(req.authUser!.id);
  if (!userResult.rowCount) {
    return res.status(404).json({ message: "Usuário não encontrado." });
  }

  const currentUser = userResult.rows[0] as DbUser;
  const code = generateVerificationCode();
  const codeHash = hashPassword(code);
  const expiresAt = new Date(Date.now() + env.registerCodeExpiresMinutes * 60 * 1000).toISOString();

  await pool.query(
    `INSERT INTO pending_email_changes (user_id, new_email, verification_code_hash, expires_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id) DO UPDATE
     SET new_email = EXCLUDED.new_email,
         verification_code_hash = EXCLUDED.verification_code_hash,
         expires_at = EXCLUDED.expires_at,
         attempt_count = 0,
         updated_at = NOW()`,
    [req.authUser!.id, normalizedEmail, codeHash, expiresAt],
  );

  await sendRegisterCodeEmail(normalizedEmail, currentUser.name, code);

  return res.status(202).json({
    message: "Código enviado para confirmar o novo e-mail.",
    email: normalizedEmail,
    expiresInMinutes: env.registerCodeExpiresMinutes,
  });
});

authRouter.post("/email-change/resend", requireAuth, async (req, res) => {
  const pendingResult = await pool.query(
    `SELECT id, user_id, new_email, verification_code_hash, attempt_count, expires_at
     FROM pending_email_changes
     WHERE user_id = $1`,
    [req.authUser!.id],
  );

  if (!pendingResult.rowCount) {
    return res.status(404).json({ message: "Nenhuma troca de e-mail pendente encontrada." });
  }

  const pendingChange = pendingResult.rows[0] as PendingEmailChange;
  const userResult = await findUserById(req.authUser!.id);
  if (!userResult.rowCount) {
    return res.status(404).json({ message: "Usuário não encontrado." });
  }

  const currentUser = userResult.rows[0] as DbUser;
  const code = generateVerificationCode();
  const codeHash = hashPassword(code);
  const expiresAt = new Date(Date.now() + env.registerCodeExpiresMinutes * 60 * 1000).toISOString();

  await pool.query(
    `UPDATE pending_email_changes
     SET verification_code_hash = $2,
         expires_at = $3,
         attempt_count = 0,
         updated_at = NOW()
     WHERE id = $1`,
    [pendingChange.id, codeHash, expiresAt],
  );

  await sendRegisterCodeEmail(pendingChange.new_email, currentUser.name, code);

  return res.status(202).json({
    message: "Novo código enviado para o e-mail informado.",
    email: pendingChange.new_email,
    expiresInMinutes: env.registerCodeExpiresMinutes,
  });
});

authRouter.post("/email-change/confirm", requireAuth, async (req, res) => {
  const { code } = req.body as CodeVerification;

  if (!code) {
    return res.status(400).json({ message: "Código é obrigatório." });
  }

  const pendingResult = await pool.query(
    `SELECT id, user_id, new_email, verification_code_hash, attempt_count, expires_at
     FROM pending_email_changes
     WHERE user_id = $1`,
    [req.authUser!.id],
  );

  if (!pendingResult.rowCount) {
    return res.status(404).json({ message: "Nenhuma troca de e-mail pendente encontrada." });
  }

  const pendingChange = pendingResult.rows[0] as PendingEmailChange;
  if (new Date(pendingChange.expires_at).getTime() < Date.now()) {
    await pool.query("DELETE FROM pending_email_changes WHERE id = $1", [pendingChange.id]);
    return res.status(410).json({ message: "Código expirado. Solicite um novo envio." });
  }

  if (pendingChange.attempt_count >= env.registerCodeMaxAttempts) {
    await pool.query("DELETE FROM pending_email_changes WHERE id = $1", [pendingChange.id]);
    return res.status(429).json({ message: "Limite de tentativas excedido. Solicite um novo código." });
  }

  const existingUser = await findExistingUserByEmail(pendingChange.new_email);
  if (existingUser.rowCount) {
    const user = existingUser.rows[0] as DbUser;
    if (user.id !== req.authUser!.id) {
      return res.status(409).json({ message: "Este e-mail já está em uso." });
    }
  }

  if (!verifyPassword({ password: code.trim(), storedHash: pendingChange.verification_code_hash })) {
    await pool.query(
      "UPDATE pending_email_changes SET attempt_count = attempt_count + 1, updated_at = NOW() WHERE id = $1",
      [pendingChange.id],
    );
    return res.status(400).json({ message: "Código inválido." });
  }

  const updated = await pool.query(
    `UPDATE users
     SET email = $2
     WHERE id = $1
     RETURNING id, name, email, password_hash, avatar_url, google_id, created_at`,
    [req.authUser!.id, pendingChange.new_email],
  );

  await pool.query("DELETE FROM pending_email_changes WHERE id = $1", [pendingChange.id]);

  const user = updated.rows[0] as DbUser;
  const token = signToken({ userId: user.id, email: user.email } as SignToken);

  return res.json({
    message: "E-mail atualizado com sucesso.",
    token,
    user: sanitizeUser(user),
  });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body as Login;

  if (!email || !password) {
    return res.status(400).json({ message: "E-mail e senha são obrigatórios." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const result = await findExistingUserByEmail(normalizedEmail);

  if (!result.rowCount) {
    return res.status(401).json({ message: "Credenciais inválidas." });
  }

  const user = result.rows[0] as DbUser;

  if (!user.password_hash && user.google_id) {
    return res.status(403).json({
      message: "Este e-mail foi cadastrado pelo Google. Entre com o Google para continuar.",
    });
  }

  if (!user.password_hash || !verifyPassword({ password: password, storedHash: user.password_hash })) {
    return res.status(401).json({ message: "Credenciais inválidas." });
  }

  const token = signToken({ userId: user.id, email: user.email });

  return res.json({ user: sanitizeUser(user), token });
});

authRouter.get("/google/url", async (_req, res) => {
  if (!isGoogleAuthEnabled) {
    return res.status(503).json({ message: "Login com Google não está configurado no servidor." });
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
    return res.status(503).json({ message: "Login com Google não está configurado no servidor." });
  }

  const { code } = req.body as CodeVerification;

  if (!code) {
    return res.status(400).json({ message: "Código do Google é obrigatório." });
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
    return res.status(401).json({ message: "O Google não retornou o access token." });
  }

  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  if (!profileResponse.ok) {
    return res.status(401).json({ message: "Falha ao obter perfil do Google." });
  }

  const profile = (await profileResponse.json()) as GoogleProfile;

  if (!profile.sub || !profile.email || !profile.email_verified) {
    return res.status(400).json({ message: "Conta do Google sem e-mail verificado." });
  }

  const existingByGoogle = await pool.query(
    "SELECT id, name, email, password_hash, avatar_url, google_id, created_at FROM users WHERE google_id = $1",
    [profile.sub],
  );

  let user: DbUser;

  if (existingByGoogle.rowCount) {
    user = existingByGoogle.rows[0] as DbUser;
  } else {
    const existingByEmail = await pool.query(
      "SELECT id, name, email, password_hash, avatar_url, google_id, created_at FROM users WHERE email = $1",
      [profile.email],
    );

    if (existingByEmail.rowCount) {
      const existingUser = existingByEmail.rows[0] as DbUser;

      if (!existingUser.google_id) {
        return res.status(409).json({
          message:
            "Este e-mail já está cadastrado com senha. Entre com e-mail e senha para continuar.",
          email: profile.email,
        });
      }

      user = existingUser;
    } else {
      const created = await pool.query(
        `INSERT INTO users (name, email, google_id)
         VALUES ($1, $2, $3)
         RETURNING id, name, email, password_hash, avatar_url, google_id, created_at`,
        [profile.name ?? profile.email.split("@")[0], profile.email, profile.sub],
      );
      user = created.rows[0] as DbUser;
    }
  }

  const token = signToken({ userId: user.id, email: user.email });
  return res.json({ user: sanitizeUser(user, { avatarUrl: profile.picture }), token });
});
