import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/crypto.js";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token ausente." });
  }

  const token = authorization.replace("Bearer ", "").trim();
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ message: "Token inválido ou expirado." });
  }

  req.authUser = {
    id: payload.sub,
    email: payload.email,
  };

  return next();
}
