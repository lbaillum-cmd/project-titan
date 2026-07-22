export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function getToken() {
  return typeof window === "undefined" ? null : window.localStorage.getItem("titan_access_token");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error ?? "Something went wrong");
  return body as T;
}

export function saveToken(token: string) {
  window.localStorage.setItem("titan_access_token", token);
}
