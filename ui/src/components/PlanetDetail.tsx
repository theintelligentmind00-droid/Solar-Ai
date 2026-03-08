import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type LogEntry, type Memory, type Planet, type Task } from "../api/agent";
import { SunChat } from "./SunChat";

interface Props {
  planet: Planet;
  onBack: () => void;
}

type Tab = "chat" | "mission" | "activity" | "tasks" | "memory";

const AMBER = "#f59e0b";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

// ── Mission tab ───────────────────────────────────────────────────────────────

function MissionTab({ planet, accentColor }: { planet: Planet; accentColor: string }) {
  const [briefing, setBriefing]           = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  const fetchBriefing = async () => {
    setBriefingLoading(true);
    try {
      const result = await api.getBriefing(planet.id);
      setBriefing(result.briefing);
    } catch {
      setBriefing("Unable to generate briefing — is the agent service running?");
    } finally {
      setBriefingLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: "24px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        overflowY: "auto",
        flex: 1,
      }}
    >
      {/* Glowing orb */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          style={{
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 35%, ${accentColor}dd, ${accentColor}66)`,
            boxShadow: `0 0 24px ${accentColor}99, 0 0 48px ${accentColor}44, 0 0 80px ${accentColor}22`,
          }}
        />
      </div>

      {/* Name + status */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: "18px",
            fontWeight: "600",
            color: "white",
            letterSpacing: "0.04em",
          }}
        >
          {planet.name}
        </div>
        <div style={{ marginTop: "8px" }}>
          <span
            style={{
              display: "inline-block",
              fontSize: "10px",
              letterSpacing: "0.15em",
              padding: "3px 10px",
              borderRadius: "4px",
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.3)",
              color: "#4ade80",
            }}
          >
            {planet.status.toUpperCase()}
          </span>
        </div>
        <div
          style={{
            marginTop: "6px",
            fontSize: "11px",
            color: "var(--text-dim)",
            letterSpacing: "0.06em",
          }}
        >
          {formatDate(planet.created_at)}
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid rgba(167,139,250,0.1)" }} />

      {/* HUD readouts */}
      <div
        style={{
          fontFamily: "monospace",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {([
          ["// ORBIT INDEX", planet.id.slice(0, 8).toUpperCase()],
          ["// STATUS", planet.status.toUpperCase()],
          ["// ESTABLISHED", formatDate(planet.created_at)],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span
              style={{
                fontSize: "9px",
                color: AMBER,
                letterSpacing: "0.15em",
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontSize: "12px",
                color: "rgba(255,255,255,0.75)",
                letterSpacing: "0.06em",
              }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Mission briefing */}
      <div
        style={{
          borderLeft: `3px solid ${AMBER}66`,
          background: `${AMBER}08`,
          borderRadius: "0 6px 6px 0",
          padding: "12px 12px 12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              fontSize: "10px",
              letterSpacing: "0.12em",
              color: AMBER,
            }}
          >
            MISSION BRIEF
          </div>
          <button
            onClick={fetchBriefing}
            disabled={briefingLoading}
            style={{
              background: briefingLoading ? "rgba(245,158,11,0.1)" : "rgba(245,158,11,0.15)",
              border: `1px solid ${AMBER}44`,
              borderRadius: "6px",
              padding: "4px 10px",
              color: briefingLoading ? "rgba(245,158,11,0.5)" : AMBER,
              fontSize: "9px",
              letterSpacing: "0.1em",
              cursor: briefingLoading ? "not-allowed" : "pointer",
              fontFamily: "monospace",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!briefingLoading)
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,158,11,0.25)";
            }}
            onMouseLeave={(e) => {
              if (!briefingLoading)
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,158,11,0.15)";
            }}
          >
            {briefingLoading ? "GENERATING…" : briefing ? "↺ REFRESH" : "↯ GENERATE"}
          </button>
        </div>

        {briefingLoading && (
          <div
            style={{
              fontSize: "11px",
              color: "rgba(245,158,11,0.5)",
              fontFamily: "monospace",
              letterSpacing: "0.08em",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          >
            Solar is reading your project…
          </div>
        )}

        {!briefingLoading && briefing && (
          <div
            style={{
              fontSize: "12px",
              color: "rgba(255,255,255,0.8)",
              lineHeight: "1.65",
            }}
          >
            {briefing}
          </div>
        )}

        {!briefingLoading && !briefing && (
          <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.6" }}>
            Click Generate for a Solar status update on this mission.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Activity tab ──────────────────────────────────────────────────────────────

function ActivityTab() {
  const [logs, setLogs] = useState<LogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getLogs()
      .then(setLogs)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load logs");
        setLogs([]);
      });
  }, []);

  if (logs === null && error === null) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-dim)",
          fontFamily: "monospace",
          fontSize: "12px",
          letterSpacing: "0.1em",
        }}
      >
        LOADING...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            color: "#fca5a5",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: "8px",
            padding: "10px 16px",
            fontFamily: "monospace",
          }}
        >
          {error}
        </div>
      </div>
    );
  }

  const entries = logs ?? [];

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "12px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        fontFamily: "monospace",
      }}
    >
      {entries.length === 0 && (
        <div
          style={{
            marginTop: "40px",
            textAlign: "center",
            color: "var(--text-dim)",
            fontSize: "12px",
            letterSpacing: "0.1em",
          }}
        >
          NO ACTIVITY YET
        </div>
      )}

      {entries.map((log) => (
        <div
          key={log.id}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            padding: "8px 10px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(167,139,250,0.06)",
            borderRadius: "6px",
          }}
        >
          {/* Status dot */}
          <div
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: log.success ? "#22c55e" : "#ef4444",
              boxShadow: log.success
                ? "0 0 6px #22c55e"
                : "0 0 6px #ef4444",
              marginTop: "4px",
              flexShrink: 0,
            }}
          />

          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span
                style={{
                  fontSize: "9px",
                  color: AMBER,
                  letterSpacing: "0.12em",
                  flexShrink: 0,
                }}
              >
                [{log.skill.toUpperCase()}]
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: "rgba(255,255,255,0.7)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {log.summary}
              </span>
            </div>
            <div
              style={{
                fontSize: "9px",
                color: "var(--text-dim)",
                marginTop: "2px",
                letterSpacing: "0.06em",
              }}
            >
              {formatDate(log.created_at)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tasks tab ─────────────────────────────────────────────────────────────────

function TasksTab({ planet, accentColor }: { planet: Planet; accentColor: string }) {
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [loading, setLoading]   = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding]     = useState(false);

  const loadTasks = () => {
    setLoading(true);
    api.getTasks(planet.id)
      .then(setTasks)
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTasks(); }, [planet.id]);

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle("");
    setAdding(false);
    const created = await api.createTask(planet.id, title);
    setTasks((prev) => [...prev, created]);
  };

  const cycleStatus = async (task: Task) => {
    const next: Record<Task["status"], Task["status"]> = {
      todo: "doing", doing: "done", done: "todo",
    };
    const updated = await api.updateTask(task.id, { status: next[task.status] });
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
  };

  const handleDelete = async (taskId: string) => {
    await api.deleteTask(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const statusIcon: Record<Task["status"], string> = {
    todo: "○", doing: "◑", done: "●",
  };
  const statusColor: Record<Task["status"], string> = {
    todo: "rgba(255,255,255,0.3)", doing: accentColor, done: "#22c55e",
  };
  const priorityColor: Record<Task["priority"], string> = {
    high: "#ef4444", medium: "#f59e0b", low: "rgba(255,255,255,0.25)",
  };

  const todo  = tasks.filter((t) => t.status === "todo");
  const doing = tasks.filter((t) => t.status === "doing");
  const done  = tasks.filter((t) => t.status === "done");

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--text-dim)", fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.1em" }}>
        LOADING...
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Section helper */}
      {[
        { label: "IN PROGRESS", items: doing, color: accentColor },
        { label: "TO DO",       items: todo,  color: "rgba(255,255,255,0.3)" },
        { label: "DONE",        items: done,  color: "#22c55e" },
      ].map(({ label, items, color }) =>
        items.length > 0 ? (
          <div key={label}>
            <div style={{ fontSize: "9px", letterSpacing: "0.15em", color, fontFamily: "monospace",
              marginBottom: "6px", paddingLeft: "2px" }}>
              {label}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              {items.map((task) => (
                <div
                  key={task.id}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: "10px",
                    padding: "10px 12px",
                    background: task.status === "doing"
                      ? `${accentColor}0d`
                      : "rgba(255,255,255,0.02)",
                    border: `1px solid ${task.status === "doing" ? `${accentColor}28` : "rgba(167,139,250,0.07)"}`,
                    borderRadius: "8px",
                    transition: "all 0.15s",
                  }}
                >
                  {/* Status toggle */}
                  <button
                    onClick={() => cycleStatus(task)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: "14px", color: statusColor[task.status],
                      padding: 0, flexShrink: 0, marginTop: "1px",
                      transition: "transform 0.1s",
                    }}
                    title={`Mark as ${task.status === "todo" ? "in progress" : task.status === "doing" ? "done" : "todo"}`}
                  >
                    {statusIcon[task.status]}
                  </button>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: "13px", color: task.status === "done" ? "var(--text-dim)" : "rgba(255,255,255,0.85)",
                      textDecoration: task.status === "done" ? "line-through" : "none",
                      lineHeight: "1.4",
                    }}>
                      {task.title}
                    </div>
                    {task.description && (
                      <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "3px", lineHeight: "1.4" }}>
                        {task.description}
                      </div>
                    )}
                  </div>

                  {/* Priority dot */}
                  <div style={{
                    width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0,
                    background: priorityColor[task.priority],
                    boxShadow: task.priority === "high" ? "0 0 6px #ef4444" : "none",
                    marginTop: "5px",
                  }} title={`${task.priority} priority`} />

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(task.id)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: "12px", color: "rgba(255,255,255,0.15)",
                      padding: 0, flexShrink: 0,
                      transition: "color 0.15s",
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#ef4444")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.15)")}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null
      )}

      {/* Empty state */}
      {tasks.length === 0 && (
        <div style={{ textAlign: "center", paddingTop: "30px", color: "var(--text-dim)", fontSize: "12px", letterSpacing: "0.08em" }}>
          No tasks yet
        </div>
      )}

      {/* Add task */}
      {adding ? (
        <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="Task title…"
            style={{
              flex: 1, background: "rgba(255,255,255,0.04)", border: `1px solid ${accentColor}44`,
              borderRadius: "8px", padding: "8px 12px", color: "white", fontSize: "13px",
              outline: "none", fontFamily: "inherit",
            }}
          />
          <button onClick={handleAdd} style={{
            background: accentColor, border: "none", borderRadius: "8px",
            padding: "8px 14px", color: "#0a0508", fontWeight: 600, fontSize: "12px",
            cursor: "pointer", fontFamily: "inherit",
          }}>Add</button>
          <button onClick={() => setAdding(false)} style={{
            background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px",
            padding: "8px 12px", color: "var(--text-muted)", fontSize: "12px",
            cursor: "pointer", fontFamily: "inherit",
          }}>Cancel</button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(167,139,250,0.2)",
            borderRadius: "8px", padding: "10px 14px", color: "var(--text-muted)",
            fontSize: "12px", cursor: "pointer", fontFamily: "inherit",
            width: "100%", transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.borderColor = `${accentColor}55`;
            b.style.color = "white";
          }}
          onMouseLeave={(e) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.borderColor = "rgba(167,139,250,0.2)";
            b.style.color = "var(--text-muted)";
          }}
        >
          + Add task
        </button>
      )}
    </div>
  );
}

// ── Memory tab ────────────────────────────────────────────────────────────────

function MemoryTab({ planet }: { planet: Planet }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    api.getMemories(planet.id)
      .then(setMemories)
      .catch(() => setMemories([]))
      .finally(() => setLoading(false));
  }, [planet.id]);

  const handleDelete = async (id: string) => {
    await api.deleteMemory(id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--text-dim)", fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.1em" }}>
        LOADING...
      </div>
    );
  }

  const global   = memories.filter((m) => !m.planet_id);
  const local    = memories.filter((m) => m.planet_id);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
      {memories.length === 0 && (
        <div style={{ paddingTop: "30px", textAlign: "center", color: "var(--text-dim)", fontSize: "12px", letterSpacing: "0.08em" }}>
          Solar hasn't learned anything yet. Chat to build memory.
        </div>
      )}

      {local.length > 0 && (
        <>
          <div style={{ fontSize: "9px", letterSpacing: "0.15em", color: "var(--sun-color)", fontFamily: "monospace", paddingLeft: "2px", marginBottom: "2px" }}>
            PROJECT MEMORIES
          </div>
          {local.map((mem) => (
            <MemoryRow key={mem.id} mem={mem} onDelete={handleDelete} />
          ))}
        </>
      )}

      {global.length > 0 && (
        <>
          <div style={{ fontSize: "9px", letterSpacing: "0.15em", color: "var(--violet, #a78bfa)", fontFamily: "monospace", paddingLeft: "2px", marginBottom: "2px", marginTop: local.length > 0 ? "10px" : 0 }}>
            GLOBAL MEMORIES
          </div>
          {global.map((mem) => (
            <MemoryRow key={mem.id} mem={mem} onDelete={handleDelete} />
          ))}
        </>
      )}
    </div>
  );
}

function MemoryRow({ mem, onDelete }: { mem: Memory; onDelete: (id: string) => void }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start", gap: "10px",
        padding: "9px 12px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(167,139,250,0.07)",
        borderRadius: "8px",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "9px", color: "var(--sun-color)", letterSpacing: "0.12em", fontFamily: "monospace", marginBottom: "3px" }}>
          {mem.key.toUpperCase()}
        </div>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", lineHeight: "1.5" }}>
          {mem.value}
        </div>
      </div>
      <button
        onClick={() => onDelete(mem.id)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: "13px", color: "rgba(255,255,255,0.15)",
          padding: 0, flexShrink: 0, transition: "color 0.15s",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#ef4444")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.15)")}
        title="Forget this memory"
      >
        ×
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PlanetDetail({ planet, onBack }: Props) {
  const [tab, setTab] = useState<Tab>("chat");

  const isSun = planet.id === "sun";
  const accentColor = isSun ? "#FFD700" : planet.color;

  const tabs: { id: Tab; label: string }[] = [
    { id: "chat",     label: "☀ CHAT"    },
    { id: "tasks",    label: "✓ TASKS"   },
    { id: "memory",   label: "◈ MEMORY"  },
    { id: "mission",  label: "◎ MISSION" },
    { id: "activity", label: "· LOG"     },
  ];

  return (
    <div
      className="flex flex-col h-full"
      style={{
        background: "rgba(5, 3, 14, 0.75)",
        backdropFilter: "blur(32px)",
        WebkitBackdropFilter: "blur(32px)",
        borderLeft: "1px solid rgba(167, 139, 250, 0.1)",
        boxShadow: "-12px 0 60px rgba(0,0,0,0.5)",
      }}
    >
      {/* ── Header ──────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "16px 20px",
          borderBottom: "1px solid rgba(167,139,250,0.08)",
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg transition-colors shrink-0"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color = "white")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color =
              "var(--text-muted)")
          }
        >
          <ArrowLeft size={16} />
        </button>

        <div
          style={{
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            background: accentColor,
            boxShadow: `0 0 8px ${accentColor}, 0 0 20px ${accentColor}50`,
            flexShrink: 0,
          }}
        />

        <div style={{ minWidth: 0, flex: 1 }}>
          <h2
            className="text-white font-medium text-sm leading-tight truncate"
            style={{ letterSpacing: "0.03em" }}
          >
            {planet.name}
          </h2>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}
          >
            {isSun
              ? "MAIN AGENT  ·  ACTIVE"
              : `PROJECT  ·  ${planet.status.toUpperCase()}`}
          </p>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid rgba(167,139,250,0.08)",
          flexShrink: 0,
          overflowX: "auto",
        }}
      >
        {tabs.map(({ id, label }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                flex: 1,
                padding: "10px 4px",
                background: "transparent",
                border: "none",
                borderBottom: active
                  ? `2px solid ${AMBER}`
                  : "2px solid transparent",
                color: active ? AMBER : "var(--text-muted)",
                fontSize: "10px",
                letterSpacing: "0.1em",
                fontWeight: active ? "600" : "400",
                cursor: "pointer",
                transition: "all 0.15s",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                if (!active)
                  (e.currentTarget as HTMLButtonElement).style.color =
                    "var(--text)";
              }}
              onMouseLeave={(e) => {
                if (!active)
                  (e.currentTarget as HTMLButtonElement).style.color =
                    "var(--text-muted)";
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ─────────────────────────────── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {tab === "chat" && (
          <SunChat planetId={planet.id} planetName={planet.name} />
        )}
        {tab === "tasks"    && <TasksTab planet={planet} accentColor={accentColor} />}
        {tab === "memory"   && <MemoryTab planet={planet} />}
        {tab === "mission" && (
          <MissionTab planet={planet} accentColor={accentColor} />
        )}
        {tab === "activity" && <ActivityTab />}
      </div>
    </div>
  );
}
