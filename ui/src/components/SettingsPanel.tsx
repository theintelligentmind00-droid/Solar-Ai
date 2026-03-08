import { Shield, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type LogEntry } from "../api/agent";

interface Props {
  onClose: () => void;
}

const INTEGRATIONS = [
  { name: "gmail", label: "Gmail", description: "Read emails and draft replies" },
  { name: "calendar", label: "Calendar", description: "Read and create events" },
  { name: "files", label: "Files", description: "Read and write local files" },
];

export function SettingsPanel({ onClose }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tab, setTab] = useState<"permissions" | "logs">("permissions");

  useEffect(() => {
    if (tab === "logs") {
      api.getLogs().then(setLogs).catch(() => setLogs([]));
    }
  }, [tab]);

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
          {(["permissions", "logs"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors capitalize ${
                tab === t
                  ? "text-yellow-400 border-b-2 border-yellow-400"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t === "permissions" ? "🔐 Permissions" : "📋 Action Log"}
            </button>
          ))}
        </div>

        {/* Permissions tab */}
        {tab === "permissions" && (
          <div className="p-6 space-y-4">
            <p className="text-slate-400 text-xs">
              Solar will ask for your approval before using any integration. Toggle to pre-approve.
            </p>
            {INTEGRATIONS.map((integration) => (
              <div
                key={integration.name}
                className="flex items-center justify-between p-4 rounded-xl bg-slate-800/60 border border-slate-700"
              >
                <div>
                  <p className="text-white text-sm font-medium">{integration.label}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{integration.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 bg-slate-700 px-2 py-1 rounded-full">
                    Coming soon
                  </span>
                </div>
              </div>
            ))}
            <div className="mt-4 p-3 bg-slate-800/40 rounded-lg border border-slate-700">
              <p className="text-slate-400 text-xs leading-relaxed">
                <span className="text-yellow-400 font-medium">Security note:</span> All integrations
                run with the minimum required permissions. Solar will always log what it did and ask
                before sending anything on your behalf.
              </p>
            </div>
          </div>
        )}

        {/* Logs tab */}
        {tab === "logs" && (
          <div className="p-4 max-h-80 overflow-y-auto">
            {logs.length === 0 ? (
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
