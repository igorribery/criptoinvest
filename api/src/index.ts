import "dotenv/config";
import express from "express";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { requireAuth } from "./middleware/auth.js";
import { alertsRouter } from "./routes/alerts.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { marketRouter } from "./routes/market.routes.js";
import { portfolioRouter } from "./routes/portfolio.routes.js";

const app = express();

app.use(express.json({ limit: "3mb" }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", env.frontendUrl);
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    return res.json({ status: "ok", database: "connected" });
  } catch {
    return res.status(503).json({ status: "error", database: "disconnected" });
  }
});

app.use("/auth", authRouter);
app.use("/market", marketRouter);
app.use("/portfolio", portfolioRouter);
app.use("/alerts", alertsRouter);

app.get("/me", requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT id, name, email, avatar_url AS "avatarUrl", created_at AS "createdAt"
     FROM users
     WHERE id = $1`,
    [req.authUser!.id],
  );

  if (!result.rowCount) {
    return res.status(404).json({ message: "Usuário não encontrado." });
  }

  return res.json({ user: result.rows[0] });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  return res.status(500).json({ message: "Erro interno do servidor." });
});

app.listen(env.port, () => {
  console.log(`API rodando em http://localhost:${env.port}`);
});
