import { Router } from "express";
import { pool } from "../db/pool.js";
import { hashPassword, signToken, verifyPassword } from "../utils/crypto.js";
import { isValidEmail } from "../utils/validators.js";

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
     RETURNING id, name, email, created_at`,
    [name, email, passwordHash],
  );

  const user = created.rows[0] as { id: string; name: string; email: string; created_at: string };
  const token = signToken(user.id, user.email);

  return res.status(201).json({ user, token });
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

  const user = result.rows[0] as {
    id: string;
    name: string;
    email: string;
    password_hash: string;
    created_at: string;
  };

  if (!verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ message: "Credenciais inválidas." });
  }

  const token = signToken(user.id, user.email);

  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.created_at,
    },
    token,
  });
});
