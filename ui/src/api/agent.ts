// Detect Tauri desktop environment
export const isTauri = !!(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;

// In Tauri desktop: dev uses Vite proxy, production calls sidecar directly.
// In web/hosted mode: use VITE_API_URL env var, or same-origin (empty string for proxy).
export const BASE_URL = isTauri
  ? (import.meta.env.DEV ? "/api" : "http://127.0.0.1:8000")
  : (import.meta.env.VITE_API_URL || "");

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
  last_activity_at?: string | null;
  planet_type?: string;
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

export interface CivilizationData {
  planet_id: string;
  activity_level: "very_active" | "active" | "moderate" | "low" | "dormant";
  activity_score: number;
  prosperity: "thriving" | "steady" | "struggling" | "critical";
  health_score: number;
  civ_stage: "outpost" | "settlement" | "city" | "metropolis" | "wonder";
  age_days: number;
  msg_count_7d: number;
  msg_count_24h: number;
  last_activity: string | null;
  task_counts: { todo: number; doing: number; done: number };
  overdue_count: number;
  memory_count: number;
  milestones: Array<{ id: string; title: string; completed_at: string | null }>;
  settlements: Array<{
    id: string;
    name: string;
    lat: number;
    lon: number;
    size: number;
    has_overdue: boolean;
  }>;
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
  createPlanet: (name: string, color?: string, planetType?: string) =>
    request<Planet>("/planets", {
      method: "POST",
      body: JSON.stringify({ name, color: color ?? "#6366f1", planet_type: planetType ?? "terra" }),
    }),
  deletePlanet: (id: string) =>
    request<void>(`/planets/${id}`, { method: "DELETE" }),

  chat: (planet_id: string, message: string) =>
    request<{ reply: string; planet_id: string }>("/chat", {
      method: "POST",
      body: JSON.stringify({ planet_id, message }),
    }),

  getChatHistory: (planetId: string, limit = 50) =>
    request<Array<{ role: string; content: string; created_at: string }>>(
      `/chat/history/${planetId}?limit=${limit}`
    ),

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

  getCivilization: (planetId: string) =>
    request<CivilizationData>(`/civilization/${planetId}`),
};
