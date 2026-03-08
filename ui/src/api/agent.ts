const BASE_URL = "http://localhost:8000";

export interface Planet {
  id: string;
  name: string;
  status: string;
  orbit_radius: number;
  color: string;
  created_at: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface LogEntry {
  id: string;
  skill: string;
  summary: string;
  success: number;
  created_at: string;
}

export interface Integration {
  name: string;
  enabled: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status}: ${err}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  getPlanets: () => request<Planet[]>("/planets"),
  createPlanet: (name: string, color?: string) =>
    request<Planet>("/planets", {
      method: "POST",
      body: JSON.stringify({ name, color: color ?? "#6366f1" }),
    }),
  deletePlanet: (id: string) =>
    request<void>(`/planets/${id}`, { method: "DELETE" }),

  chat: (planet_id: string, message: string) =>
    request<{ reply: string; planet_id: string }>("/chat", {
      method: "POST",
      body: JSON.stringify({ planet_id, message }),
    }),

  getLogs: () => request<LogEntry[]>("/logs"),
};
