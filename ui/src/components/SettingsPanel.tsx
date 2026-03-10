import { openUrl } from "@tauri-apps/plugin-opener";
import { Shield, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Integration, type LogEntry, type Memory, type Planet } from "../api/agent";

// ── Helpers ──────────────────────────────────────────────────
function relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return "just now";
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const SKILL_BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  gmail:       { bg: "rgba(245,158,11,0.15)",  color: "#fbbf24" },
  shell:       { bg: "rgba(239,68,68,0.14)",   color: "#fca5a5" },
  calendar:    { bg: "rgba(59,130,246,0.14)",  color: "#93c5fd" },
  web_search:  { bg: "rgba(34,197,94,0.14)",   color: "#86efac" },
  file_reader: { bg: "rgba(167,139,250,0.18)", color: "#c4b5fd" },
};
function getSkillBadge(skill: string): { bg: string; color: string } {
  return SKILL_BADGE_COLORS[skill.toLowerCase()] ?? { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" };
}

async function openOAuthUrl(url: string) {
  try {
    await openUrl(url);
  } catch {
    // Fallback for browser dev mode (no Tauri runtime)
    window.open(url, "_blank", "width=500,height=620");
  }
}

interface Props {
  onClose: () => void;
}

type Tab = "permissions" | "memories" | "logs";

const INTEGRATION_META: Record<string, { label: string; description: string }> = {
  gmail: { label: "Gmail", description: "Read emails and draft replies" },
  calendar: { label: "Calendar", description: "Read and create events" },
  files: { label: "Files", description: "Read and write local files" },
};

function ToggleSwitch({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={enabled}
      style={{
        position: "relative",
        display: "inline-flex",
        height: "22px",
        width: "40px",
        alignItems: "center",
        borderRadius: "11px",
        border: "none",
        cursor: "pointer",
        transition: "background 0.2s",
        background: enabled ? "rgba(34,197,94,0.85)" : "rgba(255,255,255,0.1)",
        flexShrink: 0,
        outline: "none",
        padding: 0,
      }}
    >
      <span
        style={{
          display: "inline-block",
          height: "16px",
          width: "16px",
          borderRadius: "50%",
          background: "white",
          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
          transition: "transform 0.2s",
          transform: enabled ? "translateX(20px)" : "translateX(3px)",
        }}
      />
    </button>
  );
}

type OAuthStatus = { configured: boolean; connected: boolean; redirect_uri: string };

function GmailConnectCard() {
  const [status, setStatus] = useState<OAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [polling, setPolling] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await api.getGmailStatus();
      setStatus(s);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleSaveCredentials = async () => {
    if (!clientId.trim() || !clientSecret.trim()) return;
    setSaving(true);
    setSaveError("");
    try {
      await api.configureGmail(clientId.trim(), clientSecret.trim());
      await refresh();
      setExpanded(false);
    } catch {
      setSaveError("Failed to save. Check the values and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError("");
    try {
      const { url } = await api.getGmailAuthUrl();
      await openOAuthUrl(url);
      // Poll for connection
      setPolling(true);
      const start = Date.now();
      const interval = setInterval(async () => {
        if (Date.now() - start > 90_000) {
          clearInterval(interval);
          setPolling(false);
          setConnecting(false);
          return;
        }
        try {
          const s = await api.getGmailStatus();
          setStatus(s);
          if (s.connected) {
            clearInterval(interval);
            setPolling(false);
            setConnecting(false);
          }
        } catch { /* ignore */ }
      }, 2500);
    } catch (e) {
      console.error("Gmail auth error:", e);
      setConnectError(e instanceof Error ? e.message : String(e));
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await api.disconnectGmail();
      await refresh();
    } catch { /* ignore */ } finally {
      setDisconnecting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(167,139,250,0.2)",
    borderRadius: "8px",
    padding: "8px 12px",
    color: "white",
    fontSize: "12px",
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  };

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(167,139,250,0.1)",
    borderRadius: "12px",
    overflow: "hidden",
  };

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
  };

  if (loading) {
    return (
      <div style={{ ...cardStyle, padding: "16px", fontSize: "12px", color: "var(--text-dim)" }}>
        Loading Gmail status…
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      {/* Header row */}
      <div style={rowStyle}>
        <div style={{ flex: 1, minWidth: 0, marginRight: "12px" }}>
          <p style={{ color: "white", fontSize: "13px", fontWeight: 500, margin: 0 }}>Gmail</p>
          <p style={{ color: "var(--text-muted)", fontSize: "11px", margin: "2px 0 0 0" }}>Read emails and draft replies</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          {status?.connected ? (
            <>
              <span style={{
                fontSize: "10px", padding: "3px 8px", borderRadius: "20px", fontWeight: 500,
                background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80",
              }}>
                connected
              </span>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                style={{
                  fontSize: "11px", padding: "4px 10px", borderRadius: "8px", cursor: "pointer",
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                  color: "#fca5a5", fontFamily: "inherit", transition: "all 0.15s",
                  opacity: disconnecting ? 0.5 : 1,
                }}
              >
                {disconnecting ? "…" : "Disconnect"}
              </button>
            </>
          ) : status?.configured ? (
            <>
              <span style={{
                fontSize: "10px", padding: "3px 8px", borderRadius: "20px", fontWeight: 500,
                background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "#fbbf24",
              }}>
                not connected
              </span>
              <button
                onClick={handleConnect}
                disabled={connecting}
                style={{
                  fontSize: "11px", padding: "4px 12px", borderRadius: "8px", cursor: "pointer",
                  background: "rgba(167,139,250,0.18)", border: "1px solid rgba(167,139,250,0.35)",
                  color: "#c4b5fd", fontFamily: "inherit", fontWeight: 500, transition: "all 0.15s",
                  opacity: connecting ? 0.6 : 1,
                }}
              >
                {polling ? "Waiting…" : connecting ? "Opening…" : "Authorize"}
              </button>
            </>
          ) : (
            <>
              <span style={{
                fontSize: "10px", padding: "3px 8px", borderRadius: "20px", fontWeight: 500,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-muted)",
              }}>
                not set up
              </span>
              <button
                onClick={() => setExpanded((v) => !v)}
                style={{
                  fontSize: "11px", padding: "4px 12px", borderRadius: "8px", cursor: "pointer",
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "var(--text)", fontFamily: "inherit", fontWeight: 500, transition: "all 0.15s",
                }}
              >
                {expanded ? "Cancel" : "Set up"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Setup form */}
      {expanded && !status?.configured && (
        <div style={{ borderTop: "1px solid rgba(167,139,250,0.08)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "11px", lineHeight: "1.6", margin: 0 }}>
            <span style={{ color: "#fbbf24", fontWeight: 500 }}>3 steps:</span>{" "}
            Go to <span style={{ color: "#a78bfa", fontFamily: "monospace", fontSize: "11px" }}>console.cloud.google.com</span>{" → "}
            Create/select project → Enable Gmail API → APIs &amp; Services → Credentials → Create OAuth 2.0 Client ID (Desktop app) → paste below.
          </p>
          <p style={{ color: "var(--text-dim)", fontSize: "11px", margin: 0 }}>
            Redirect URI:{" "}
            <span style={{ fontFamily: "monospace", color: "rgba(255,255,255,0.6)", fontSize: "11px" }}>
              {status?.redirect_uri ?? "http://localhost:8000/gmail/callback"}
            </span>
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <input
              style={inputStyle}
              type="text"
              placeholder="Client ID (ends in .apps.googleusercontent.com)"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
            <input
              style={inputStyle}
              type="password"
              placeholder="Client Secret"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
            />
          </div>
          {saveError && (
            <p style={{ color: "#fca5a5", fontSize: "11px", margin: 0 }}>{saveError}</p>
          )}
          <button
            onClick={handleSaveCredentials}
            disabled={saving || !clientId.trim() || !clientSecret.trim()}
            style={{
              width: "100%", padding: "9px", borderRadius: "9px", cursor: "pointer",
              background: "rgba(167,139,250,0.22)", border: "1px solid rgba(167,139,250,0.35)",
              color: "#e9d5ff", fontSize: "13px", fontFamily: "inherit", fontWeight: 500,
              transition: "all 0.15s", opacity: (saving || !clientId.trim() || !clientSecret.trim()) ? 0.4 : 1,
            }}
          >
            {saving ? "Saving…" : "Save & continue"}
          </button>
        </div>
      )}

      {/* Connected detail */}
      {status?.connected && (
        <div style={{ borderTop: "1px solid rgba(167,139,250,0.08)", padding: "8px 16px" }}>
          <p style={{ color: "#4ade80", fontSize: "11px", margin: 0 }}>
            ✓ Gmail is connected. Solar can read your emails and generate summaries.
          </p>
        </div>
      )}

      {/* Configured but not connected */}
      {status?.configured && !status.connected && !expanded && (
        <div style={{ borderTop: "1px solid rgba(167,139,250,0.08)", padding: "8px 16px" }}>
          {connectError ? (
            <p style={{ color: "#fca5a5", fontSize: "11px", margin: 0 }}>
              ✗ {connectError}
            </p>
          ) : (
            <p style={{ color: "#fbbf24", fontSize: "11px", margin: 0 }}>
              Credentials saved. Click Authorize to complete the sign-in.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CalendarConnectCard() {
  const [status, setStatus] = useState<OAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await api.getCalendarStatus();
      setStatus(s);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { url } = await api.getCalendarAuthUrl();
      await openOAuthUrl(url);
      setPolling(true);
      const start = Date.now();
      const interval = setInterval(async () => {
        if (Date.now() - start > 90_000) {
          clearInterval(interval);
          setPolling(false);
          setConnecting(false);
          return;
        }
        try {
          const s = await api.getCalendarStatus();
          setStatus(s);
          if (s.connected) {
            clearInterval(interval);
            setPolling(false);
            setConnecting(false);
          }
        } catch { /* ignore */ }
      }, 2500);
    } catch {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await api.disconnectCalendar();
      await refresh();
    } catch { /* ignore */ } finally {
      setDisconnecting(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(167,139,250,0.1)",
    borderRadius: "12px",
    overflow: "hidden",
  };

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
  };

  if (loading) {
    return (
      <div style={{ ...cardStyle, padding: "16px", fontSize: "12px", color: "var(--text-dim)" }}>
        Loading Calendar status…
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      {/* Header row */}
      <div style={rowStyle}>
        <div style={{ flex: 1, minWidth: 0, marginRight: "12px" }}>
          <p style={{ color: "white", fontSize: "13px", fontWeight: 500, margin: 0 }}>Google Calendar</p>
          <p style={{ color: "var(--text-muted)", fontSize: "11px", margin: "2px 0 0 0" }}>Read and create calendar events</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          {status?.connected ? (
            <>
              <span style={{
                fontSize: "10px", padding: "3px 8px", borderRadius: "20px", fontWeight: 500,
                background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80",
              }}>
                connected
              </span>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                style={{
                  fontSize: "11px", padding: "4px 10px", borderRadius: "8px", cursor: "pointer",
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                  color: "#fca5a5", fontFamily: "inherit", transition: "all 0.15s",
                  opacity: disconnecting ? 0.5 : 1,
                }}
              >
                {disconnecting ? "…" : "Disconnect"}
              </button>
            </>
          ) : (
            <>
              <span style={{
                fontSize: "10px", padding: "3px 8px", borderRadius: "20px", fontWeight: 500,
                background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "#fbbf24",
              }}>
                not connected
              </span>
              <button
                onClick={handleConnect}
                disabled={connecting}
                style={{
                  fontSize: "11px", padding: "4px 12px", borderRadius: "8px", cursor: "pointer",
                  background: "rgba(167,139,250,0.18)", border: "1px solid rgba(167,139,250,0.35)",
                  color: "#c4b5fd", fontFamily: "inherit", fontWeight: 500, transition: "all 0.15s",
                  opacity: connecting ? 0.6 : 1,
                }}
              >
                {polling ? "Waiting…" : connecting ? "Opening…" : "Authorize"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Connected detail */}
      {status?.connected && (
        <div style={{ borderTop: "1px solid rgba(167,139,250,0.08)", padding: "8px 16px" }}>
          <p style={{ color: "#4ade80", fontSize: "11px", margin: 0 }}>
            ✓ Calendar is connected. Solar can read and create events on your behalf.
          </p>
        </div>
      )}

      {/* Not connected hint */}
      {!status?.connected && (
        <div style={{ borderTop: "1px solid rgba(167,139,250,0.08)", padding: "8px 16px" }}>
          <p style={{ color: "#fbbf24", fontSize: "11px", margin: 0 }}>
            {status?.configured
              ? "Credentials ready. Click Authorize to sign in with Google."
              : "Uses the same Google OAuth credentials as Gmail. Connect Gmail first, then authorize Calendar here."}
          </p>
        </div>
      )}
    </div>
  );
}

export function SettingsPanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("permissions");

  // Permissions state
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(false);

  // Memories state
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [planets, setPlanets] = useState<Planet[]>([]);

  // Logs state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadMemories = useCallback(() => {
    setMemoriesLoading(true);
    Promise.all([api.getMemories(), api.getPlanets()])
      .then(([mems, pls]) => { setMemories(mems); setPlanets(pls); })
      .catch(() => {})
      .finally(() => setMemoriesLoading(false));
  }, []);

  const loadLogs = useCallback(() => {
    setLogsLoading(true);
    api.getLogs()
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLogsLoading(false));
  }, []);

  useEffect(() => {
    if (tab === "permissions") {
      setIntegrationsLoading(true);
      api
        .getIntegrations()
        .then(setIntegrations)
        .catch(() => setIntegrations([]))
        .finally(() => setIntegrationsLoading(false));
    } else if (tab === "memories") {
      loadMemories();
    } else if (tab === "logs") {
      loadLogs();
    }
  }, [tab, loadMemories, loadLogs]);

  // Auto-refresh logs every 30s when on that tab
  useEffect(() => {
    if (tab !== "logs") return;
    const id = setInterval(loadLogs, 30_000);
    return () => clearInterval(id);
  }, [tab, loadLogs]);

  function handleToggle(integration: Integration) {
    api
      .setIntegration(integration.name, !integration.enabled)
      .then((updated) => {
        setIntegrations((prev) =>
          prev.map((i) => (i.name === updated.name ? updated : i))
        );
      })
      .catch(() => {
        // refresh to restore ground truth on error
        api.getIntegrations().then(setIntegrations).catch(() => undefined);
      });
  }

  function handleDeleteMemory(id: string) {
    api
      .deleteMemory(id)
      .then(() => {
        setMemories((prev) => prev.filter((m) => m.id !== id));
      })
      .catch(() => undefined);
  }

  // Build planet id → name map for memory grouping
  const planetMap = useMemo(() => {
    const m = new Map<string, string>();
    planets.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [planets]);

  // Group memories by planet_id
  const memoriesByGroup = useMemo(() => {
    const groups = new Map<string | null, Memory[]>();
    memories.forEach((mem) => {
      const key = mem.planet_id ?? null;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(mem);
    });
    // Sort: null (Global) last
    return [...groups.entries()].sort(([a], [b]) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return (planetMap.get(a) ?? a).localeCompare(planetMap.get(b) ?? b);
    });
  }, [memories, planetMap]);

  const TAB_LABELS: Record<Tab, string> = {
    permissions: "Permissions",
    memories: "Memories",
    logs: "Activity Log",
  };

  const TAB_ICONS: Record<Tab, string> = {
    permissions: "🔐",
    memories: "🧠",
    logs: "📋",
  };

  const cardItemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 14px",
    borderRadius: "10px",
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(167,139,250,0.09)",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          borderRadius: "18px",
          border: "1px solid rgba(167,139,250,0.12)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(167,139,250,0.04)",
          overflow: "hidden",
          background: "rgba(8, 6, 20, 0.97)",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 22px 16px",
          borderBottom: "1px solid rgba(167,139,250,0.08)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Shield size={15} style={{ color: "var(--sun-color)" }} />
            <h2 style={{ color: "white", fontWeight: 600, fontSize: "14px", margin: 0, letterSpacing: "0.02em" }}>
              Settings & Permissions
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "8px",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "5px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "white";
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(167,139,250,0.08)" }}>
          {(["permissions", "memories", "logs"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: "11px 6px",
                fontSize: "12px",
                fontWeight: tab === t ? 600 : 400,
                fontFamily: "inherit",
                cursor: "pointer",
                border: "none",
                background: "transparent",
                color: tab === t ? "var(--sun-color)" : "var(--text-muted)",
                borderBottom: tab === t ? "2px solid var(--sun-color)" : "2px solid transparent",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
              }}
            >
              <span>{TAB_ICONS[t]}</span>
              <span>{TAB_LABELS[t]}</span>
            </button>
          ))}
        </div>

        {/* Permissions tab */}
        {tab === "permissions" && (
          <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <p style={{ color: "var(--text-muted)", fontSize: "11px", margin: 0, lineHeight: "1.5" }}>
              Solar asks for approval before using any integration. Toggle to pre-approve.
            </p>
            {integrationsLoading ? (
              <div style={{ textAlign: "center", color: "var(--text-dim)", fontSize: "12px", padding: "24px 0", fontFamily: "monospace", letterSpacing: "0.08em" }}>LOADING…</div>
            ) : integrations.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-dim)", fontSize: "12px", padding: "24px 0" }}>
                No integrations available.
              </div>
            ) : (
              integrations.map((integration) => {
                if (integration.name === "gmail") {
                  return <GmailConnectCard key="gmail" />;
                }
                if (integration.name === "calendar") {
                  return <CalendarConnectCard key="calendar" />;
                }
                const meta = INTEGRATION_META[integration.name] ?? {
                  label: integration.name,
                  description: "",
                };
                return (
                  <div key={integration.name} style={cardItemStyle}>
                    <div style={{ flex: 1, minWidth: 0, marginRight: "12px" }}>
                      <p style={{ color: "white", fontSize: "13px", fontWeight: 500, margin: 0 }}>{meta.label}</p>
                      <p style={{ color: "var(--text-muted)", fontSize: "11px", margin: "2px 0 0 0" }}>{meta.description}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                      <span style={{
                        fontSize: "10px", padding: "3px 8px", borderRadius: "20px", fontWeight: 500,
                        background: integration.enabled ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)",
                        border: `1px solid ${integration.enabled ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
                        color: integration.enabled ? "#4ade80" : "var(--text-dim)",
                      }}>
                        {integration.enabled ? "enabled" : "disabled"}
                      </span>
                      <ToggleSwitch
                        enabled={integration.enabled}
                        onToggle={() => handleToggle(integration)}
                      />
                    </div>
                  </div>
                );
              })
            )}
            <div style={{
              padding: "10px 13px",
              background: "rgba(245,158,11,0.05)",
              border: "1px solid rgba(245,158,11,0.12)",
              borderRadius: "8px",
            }}>
              <p style={{ color: "var(--text-muted)", fontSize: "11px", lineHeight: "1.55", margin: 0 }}>
                <span style={{ color: "var(--sun-color)", fontWeight: 500 }}>Security note:</span>{" "}
                All integrations use minimum required permissions. Solar logs every action.
              </p>
            </div>

            {/* Reset onboarding */}
            <div style={{ marginTop: "4px", borderTop: "1px solid rgba(167,139,250,0.08)", paddingTop: "14px" }}>
              <button
                onClick={() => {
                  localStorage.removeItem("solar_onboarded");
                  localStorage.removeItem("solar_api_key");
                  window.location.reload();
                }}
                style={{
                  width: "100%",
                  padding: "9px 14px",
                  background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.18)",
                  borderRadius: "9px",
                  color: "rgba(239,68,68,0.75)",
                  fontSize: "12px",
                  fontFamily: "inherit",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  const b = e.currentTarget as HTMLButtonElement;
                  b.style.background = "rgba(239,68,68,0.12)";
                  b.style.borderColor = "rgba(239,68,68,0.35)";
                  b.style.color = "#ef4444";
                }}
                onMouseLeave={(e) => {
                  const b = e.currentTarget as HTMLButtonElement;
                  b.style.background = "rgba(239,68,68,0.06)";
                  b.style.borderColor = "rgba(239,68,68,0.18)";
                  b.style.color = "rgba(239,68,68,0.75)";
                }}
              >
                Reset &amp; Re-enter API Key
              </button>
            </div>
          </div>
        )}

        {/* Memories tab */}
        {tab === "memories" && (
          <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", maxHeight: "380px" }}>
            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px 8px", flexShrink: 0 }}>
              <span style={{ color: "var(--text-dim)", fontSize: "11px", fontFamily: "monospace", letterSpacing: "0.06em" }}>
                {memoriesLoading ? "LOADING…" : `${memories.length} ${memories.length === 1 ? "MEMORY" : "MEMORIES"}`}
              </span>
              <button
                onClick={loadMemories}
                disabled={memoriesLoading}
                style={{
                  fontSize: "11px", padding: "4px 10px", borderRadius: "7px", cursor: "pointer",
                  background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)",
                  color: "#c4b5fd", fontFamily: "inherit", opacity: memoriesLoading ? 0.5 : 1,
                }}
              >
                Refresh
              </button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {memoriesLoading ? (
                <div style={{ textAlign: "center", color: "var(--text-dim)", fontSize: "12px", padding: "24px 0", fontFamily: "monospace", letterSpacing: "0.08em" }}>LOADING…</div>
              ) : memories.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "12px", padding: "24px 0", lineHeight: "1.6" }}>
                  No memories saved yet.<br />
                  <span style={{ color: "var(--text-dim)", fontFamily: "monospace", fontSize: "11px" }}>Say "remember: …" in chat to save something.</span>
                </div>
              ) : (
                memoriesByGroup.map(([groupKey, groupMemories]) => {
                  const groupLabel = groupKey === null
                    ? "Global"
                    : (planetMap.get(groupKey) ?? "Unknown Planet");
                  return (
                    <div key={groupKey ?? "__global__"}>
                      <p style={{
                        color: groupKey === null ? "rgba(167,139,250,0.65)" : "var(--sun-color)",
                        fontSize: "10px", fontWeight: 600, margin: "0 0 6px 0",
                        textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace",
                      }}>
                        {groupKey === null ? "◎" : "◆"} {groupLabel}
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {groupMemories.map((memory) => (
                          <div
                            key={memory.id}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              justifyContent: "space-between",
                              gap: "10px",
                              padding: "9px 12px",
                              borderRadius: "9px",
                              background: "rgba(255,255,255,0.022)",
                              border: "1px solid rgba(167,139,250,0.09)",
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "12px", fontWeight: 600 }}>{memory.key}</span>
                              <span style={{ color: "var(--text-muted)", fontSize: "11px", margin: "0 0 0 6px" }}>→</span>
                              <span style={{ color: "rgba(255,255,255,0.65)", fontSize: "12px", margin: "0 0 0 6px", wordBreak: "break-word" }}>{memory.value}</span>
                            </div>
                            <button
                              onClick={() => handleDeleteMemory(memory.id)}
                              aria-label={`Delete memory: ${memory.key}`}
                              style={{
                                flexShrink: 0, background: "none", border: "none",
                                color: "var(--text-dim)", cursor: "pointer",
                                fontSize: "16px", lineHeight: 1, padding: "0 2px", transition: "color 0.15s",
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#fca5a5"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-dim)"; }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Activity Log tab */}
        {tab === "logs" && (
          <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", maxHeight: "380px" }}>
            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px 8px", flexShrink: 0 }}>
              <span style={{ color: "var(--text-dim)", fontSize: "11px", fontFamily: "monospace", letterSpacing: "0.06em" }}>
                {logsLoading ? "LOADING…" : `${logs.length} ${logs.length === 1 ? "ACTION" : "ACTIONS"}`}
              </span>
              <button
                onClick={loadLogs}
                disabled={logsLoading}
                style={{
                  fontSize: "11px", padding: "4px 10px", borderRadius: "7px", cursor: "pointer",
                  background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)",
                  color: "#c4b5fd", fontFamily: "inherit", opacity: logsLoading ? 0.5 : 1,
                }}
              >
                Refresh
              </button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: "5px" }}>
              {logsLoading ? (
                <div style={{ textAlign: "center", color: "var(--text-dim)", fontSize: "12px", padding: "24px 0", fontFamily: "monospace", letterSpacing: "0.08em" }}>LOADING…</div>
              ) : logs.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "12px", padding: "24px 0" }}>
                  No activity yet.
                </div>
              ) : (
                logs.map((log) => {
                  const badge = getSkillBadge(log.skill);
                  return (
                    <div
                      key={log.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr auto",
                        alignItems: "center",
                        gap: "8px",
                        padding: "9px 12px",
                        borderRadius: "9px",
                        background: "rgba(255,255,255,0.022)",
                        border: "1px solid rgba(167,139,250,0.07)",
                      }}
                    >
                      {/* Status dot */}
                      <span
                        style={{
                          width: "7px", height: "7px", borderRadius: "50%", flexShrink: 0,
                          background: log.success ? "#22c55e" : "#ef4444",
                          boxShadow: log.success ? "0 0 5px #22c55e88" : "0 0 5px #ef444488",
                        }}
                        title={log.success ? "Success" : "Failed"}
                      />
                      {/* Summary + skill badge */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontSize: "10px", padding: "2px 7px", borderRadius: "20px", fontWeight: 500,
                              background: badge.bg, color: badge.color, flexShrink: 0,
                              border: `1px solid ${badge.color}30`,
                            }}
                          >
                            {log.skill}
                          </span>
                          <p style={{
                            color: "rgba(255,255,255,0.8)", fontSize: "12px", fontWeight: 500, margin: 0,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {log.summary}
                          </p>
                        </div>
                      </div>
                      {/* Relative time */}
                      <span style={{ color: "var(--text-dim)", fontSize: "10px", fontFamily: "monospace", flexShrink: 0, whiteSpace: "nowrap" }}>
                        {relativeTime(log.created_at)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
