/**
 * Cliente para comunicação com a API backend.
 * Configure API_URL no .env.local (ex: http://localhost:4000)
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const api = {
  get: <T>(path: string) => fetch(`${API_URL}${path}`).then((r) => r.json() as Promise<T>),
  post: <T>(path: string, body: unknown) =>
    fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json() as Promise<T>),
};
