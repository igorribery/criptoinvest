/**
 * Cliente para comunicação com a API backend.
 * Configure API_URL no .env.local (ex: http://localhost:4000)
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  const payload = (await response.json().catch(() => ({}))) as { message?: string } & T;

  if (!response.ok) {
    throw new Error(payload.message ?? `Erro HTTP ${response.status}`);
  }

  return payload;
}

export const api = {
  get: <T>(path: string, headers?: HeadersInit) => request<T>(path, { headers }),
  post: <T>(path: string, body: unknown, headers?: HeadersInit) =>
    request<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
};

export { API_URL };
