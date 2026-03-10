// In dev, Vite proxies /api → http://localhost:8000 (stripping the prefix).
// In the packaged Tauri app there is no Vite proxy, so call the sidecar directly.
export const BASE_URL = import.meta.env.DEV ? "/api" : "http://localhost:8000";

function getApiKey(): string {
  return sessionStorage.getItem("solar_api_key") ?? "";
}

export function authHeaders(): Record<string, string> {
  const key = getApiKey();
  return key ? { "X-Api-Key": key } : {};
}

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
  id: string;
  name: string;
  enabled: boolean;
  scopes: string | null;
  updated_at: string;
}

export interface Memory {
  id: string;
  planet_id: string | null;
  key: string;
  value: string;
  type: string;
  importance: number;
  created_at: string;
}

export interface Task {
  id: string;
  planet_id: string;
  title: string;
  description: string | null;
  status: "todo" | "doing" | "done";
  priority: "low" | "medium" | "high";
  created_at: string;
  completed_at: string | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...authHeaders() },
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

  getMemories: (planetId?: string) =>
    planetId
      ? request<Memory[]>(`/memories/${planetId}`)
      : request<Memory[]>("/memories"),

  deleteMemory: (id: string) =>
    request<void>(`/memories/${id}`, { method: "DELETE" }),

  getIntegrations: () => request<Integration[]>("/integrations"),

  setIntegration: (name: string, enabled: boolean) =>
    request<Integration>(`/integrations/${name}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }),

  getGreeting: (planetId: string) =>
    request<{ greeting: string | null; planet_id: string }>(
      `/greeting/${planetId}`
    ),

  getTasks: async (planetId: string): Promise<Task[]> => {
    const r = await fetch(`${BASE_URL}/tasks/${planetId}`, { headers: authHeaders() });
    if (!r.ok) throw new Error("Failed to fetch tasks");
    return r.json() as Promise<Task[]>;
  },

  createTask: async (planetId: string, title: string, description?: string, priority?: string): Promise<Task> => {
    const r = await fetch(`${BASE_URL}/tasks/${planetId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ title, description: description ?? null, priority: priority ?? "medium" }),
    });
    if (!r.ok) throw new Error("Failed to create task");
    return r.json() as Promise<Task>;
  },

  updateTask: async (taskId: string, patch: { status?: string; title?: string; description?: string; priority?: string }): Promise<Task> => {
    const r = await fetch(`${BASE_URL}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(patch),
    });
    if (!r.ok) throw new Error("Failed to update task");
    return r.json() as Promise<Task>;
  },

  deleteTask: async (taskId: string): Promise<void> => {
    const r = await fetch(`${BASE_URL}/tasks/${taskId}`, { method: "DELETE", headers: authHeaders() });
    if (!r.ok) throw new Error("Failed to delete task");
  },

  getBriefing: async (planetId: string): Promise<{ planet_id: string; planet_name: string; briefing: string }> => {
    const r = await fetch(`${BASE_URL}/briefing/${planetId}`, { headers: authHeaders() });
    if (!r.ok) throw new Error("Failed to fetch briefing");
    return r.json() as Promise<{ planet_id: string; planet_name: string; briefing: string }>;
  },

  getDailyBriefing: () =>
    request<{ briefing: string; generated_at: string }>("/briefing/daily"),

  getBriefingSchedule: () =>
    request<{ hour: number; minute: number; enabled: boolean }>("/briefing/schedule"),

  setBriefingSchedule: (hour: number, minute: number, enabled = true) =>
    request<{ ok: boolean; hour: number; minute: number; enabled: boolean }>("/briefing/schedule", {
      method: "POST",
      body: JSON.stringify({ hour, minute, enabled }),
    }),

  getGmailStatus: () =>
    request<{ configured: boolean; connected: boolean; redirect_uri: string }>(
      "/gmail/status"
    ),

  getGmailSummary: async (): Promise<{ summary: string; count: number }> => {
    const r = await fetch(`${BASE_URL}/gmail/summary`, { headers: authHeaders() });
    if (!r.ok) throw new Error("Failed to fetch Gmail summary");
    return r.json() as Promise<{ summary: string; count: number }>;
  },

  configureGmail: (clientId: string, clientSecret: string) =>
    request<{ ok: boolean; message: string }>("/gmail/configure", {
      method: "POST",
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
    }),

  getGmailAuthUrl: () =>
    request<{ url: string }>("/gmail/auth-url"),

  disconnectGmail: () =>
    request<{ ok: string }>("/gmail/disconnect", { method: "DELETE" }),

  saveApiKey: (apiKey: string) =>
    request<{ ok: boolean }>("/setup/api-key", {
      method: "POST",
      body: JSON.stringify({ api_key: apiKey }),
    }),

  getApiKeyStatus: () =>
    request<{ configured: boolean }>("/setup/api-key/status"),

  deleteApiKey: () =>
    request<{ ok: boolean }>("/setup/api-key", { method: "DELETE" }),

  getUserProfile: () =>
    request<{ profile: Record<string, string> }>("/setup/profile"),

  getCalendarStatus: () =>
    request<{ configured: boolean; connected: boolean; redirect_uri: string }>(
      "/calendar/status"
    ),

  getCalendarAuthUrl: () =>
    request<{ url: string }>("/calendar/auth-url", { method: "POST" }),

  disconnectCalendar: () =>
    request<{ ok: string }>("/calendar/disconnect", { method: "DELETE" }),

  runShellCommand: (command: string, workingDir?: string) =>
    request<{ output: string; exit_code: number; blocked: boolean }>("/shell/run", {
      method: "POST",
      body: JSON.stringify({ command, working_dir: workingDir }),
    }),

  getShellHistory: () =>
    request<Array<{ summary: string; created_at: string }>>("/shell/history"),
};
