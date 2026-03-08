import { Shield, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, type Integration, type LogEntry, type Memory } from "../api/agent";

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
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        enabled ? "bg-green-500" : "bg-slate-600"
      }`}
      aria-pressed={enabled}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

type GmailStatus = { configured: boolean; connected: boolean; redirect_uri: string };

function GmailConnectCard() {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [connecting, setConnecting] = useState(false);
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
    try {
      const { url } = await api.getGmailAuthUrl();
      window.open(url, "_blank", "width=500,height=620");
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
    } catch {
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

  if (loading) {
    return (
      <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-500 text-sm">
        Loading Gmail status…
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between p-4">
        <div className="flex-1 min-w-0 mr-4">
          <p className="text-white text-sm font-medium">Gmail</p>
          <p className="text-slate-400 text-xs mt-0.5">Read emails and draft replies</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status?.connected ? (
            <>
              <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-900/50 text-green-400">
                connected
              </span>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-xs px-2 py-1 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors disabled:opacity-50"
              >
                {disconnecting ? "…" : "Disconnect"}
              </button>
            </>
          ) : status?.configured ? (
            <>
              <span className="text-xs px-2 py-1 rounded-full font-medium bg-yellow-900/40 text-yellow-400">
                not connected
              </span>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="text-xs px-3 py-1 rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-medium transition-colors disabled:opacity-50"
              >
                {polling ? "Waiting…" : connecting ? "Opening…" : "Authorize"}
              </button>
            </>
          ) : (
            <>
              <span className="text-xs px-2 py-1 rounded-full font-medium bg-slate-700 text-slate-400">
                not set up
              </span>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-xs px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
              >
                {expanded ? "Cancel" : "Set up"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Setup form */}
      {expanded && !status?.configured && (
        <div className="border-t border-slate-700 p-4 space-y-3">
          <p className="text-slate-400 text-xs leading-relaxed">
            <span className="text-yellow-400 font-medium">3 steps:</span>{" "}
            Go to{" "}
            <span className="text-violet-400 font-mono text-xs">console.cloud.google.com</span>
            {" → "}Create/select a project → Enable Gmail API → APIs &amp; Services → Credentials →
            Create OAuth 2.0 Client ID (Desktop app) → paste the values below.
          </p>
          <p className="text-slate-500 text-xs">
            Add this as an authorized redirect URI in Google Cloud:{" "}
            <span className="font-mono text-slate-300">
              {status?.redirect_uri ?? "http://localhost:8000/gmail/callback"}
            </span>
          </p>
          <div className="space-y-2">
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
            <p className="text-red-400 text-xs">{saveError}</p>
          )}
          <button
            onClick={handleSaveCredentials}
            disabled={saving || !clientId.trim() || !clientSecret.trim()}
            className="w-full py-2 rounded-lg bg-violet-700 hover:bg-violet-600 text-white text-sm font-medium transition-colors disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save & continue"}
          </button>
        </div>
      )}

      {/* Connected detail */}
      {status?.connected && (
        <div className="border-t border-slate-700 px-4 py-2">
          <p className="text-green-400 text-xs">
            ✓ Gmail is connected. Solar can read your emails and generate summaries.
          </p>
        </div>
      )}

      {/* Configured but not connected — show Authorize button hint */}
      {status?.configured && !status.connected && !expanded && (
        <div className="border-t border-slate-700 px-4 py-2">
          <p className="text-yellow-400 text-xs">
            Credentials saved. Click Authorize to complete the sign-in.
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

  // Logs state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    if (tab === "permissions") {
      setIntegrationsLoading(true);
      api
        .getIntegrations()
        .then(setIntegrations)
        .catch(() => setIntegrations([]))
        .finally(() => setIntegrationsLoading(false));
    } else if (tab === "memories") {
      setMemoriesLoading(true);
      api
        .getMemories()
        .then(setMemories)
        .catch(() => setMemories([]))
        .finally(() => setMemoriesLoading(false));
    } else if (tab === "logs") {
      setLogsLoading(true);
      api
        .getLogs()
        .then(setLogs)
        .catch(() => setLogs([]))
        .finally(() => setLogsLoading(false));
    }
  }, [tab]);

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

  const TAB_LABELS: Record<Tab, string> = {
    permissions: "🔐 Permissions",
    memories: "🧠 Memories",
    logs: "📋 Action Log",
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl overflow-hidden"
        style={{ background: "var(--panel-bg)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-yellow-400" />
            <h2 className="text-white font-semibold">Settings & Permissions</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          {(["permissions", "memories", "logs"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === t
                  ? "text-yellow-400 border-b-2 border-yellow-400"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Permissions tab */}
        {tab === "permissions" && (
          <div className="p-6 space-y-4">
            <p className="text-slate-400 text-xs">
              Solar will ask for your approval before using any integration. Toggle to pre-approve.
            </p>
            {integrationsLoading ? (
              <div className="text-center text-slate-500 text-sm py-8">Loading…</div>
            ) : integrations.length === 0 ? (
              <div className="text-center text-slate-500 text-sm py-8">
                No integrations available.
              </div>
            ) : (
              integrations.map((integration) => {
                if (integration.name === "gmail") {
                  return <GmailConnectCard key="gmail" />;
                }
                const meta = INTEGRATION_META[integration.name] ?? {
                  label: integration.name,
                  description: "",
                };
                return (
                  <div
                    key={integration.name}
                    className="flex items-center justify-between p-4 rounded-xl bg-slate-800/60 border border-slate-700"
                  >
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-white text-sm font-medium">{meta.label}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{meta.description}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          integration.enabled
                            ? "bg-green-900/50 text-green-400"
                            : "bg-slate-700 text-slate-400"
                        }`}
                      >
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
            <div className="mt-4 p-3 bg-slate-800/40 rounded-lg border border-slate-700">
              <p className="text-slate-400 text-xs leading-relaxed">
                <span className="text-yellow-400 font-medium">Security note:</span>{" "}
                All integrations use minimum required permissions. Solar logs every action.
              </p>
            </div>
          </div>
        )}

        {/* Memories tab */}
        {tab === "memories" && (
          <div className="p-4 max-h-80 overflow-y-auto">
            {memoriesLoading ? (
              <div className="text-center text-slate-500 text-sm py-8">Loading…</div>
            ) : (
              <>
                {memories.length > 0 && (
                  <p className="text-slate-500 text-xs mb-3">
                    {memories.length} {memories.length === 1 ? "memory" : "memories"} stored
                  </p>
                )}
                {memories.length === 0 ? (
                  <div className="text-center text-slate-500 text-sm py-8">
                    No memories saved yet. Say{" "}
                    <span className="font-mono text-slate-400">'remember:'</span> in any chat
                    to save something.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {memories.map((memory) => (
                      <div
                        key={memory.id}
                        className="flex items-start justify-between gap-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-bold truncate">{memory.key}</p>
                          <p className="text-slate-400 text-xs mt-0.5 break-words">
                            {memory.value}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteMemory(memory.id)}
                          className="shrink-0 text-red-400 hover:text-red-300 hover:bg-slate-700 rounded px-1.5 py-0.5 text-sm font-bold transition-colors"
                          aria-label={`Delete memory: ${memory.key}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Action Log tab */}
        {tab === "logs" && (
          <div className="p-4 max-h-80 overflow-y-auto">
            {logsLoading ? (
              <div className="text-center text-slate-500 text-sm py-8">Loading…</div>
            ) : logs.length === 0 ? (
              <div className="text-center text-slate-500 text-sm py-8">
                No actions logged yet.
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700"
                  >
                    <span
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        log.success ? "bg-green-400" : "bg-red-400"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{log.summary}</p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {log.skill} · {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
