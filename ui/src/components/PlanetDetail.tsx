import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, type LogEntry, type Memory, type Planet, type Task } from "../api/agent";
import { SunChat } from "./SunChat";

interface Props {
  planet: Planet;
  onBack: () => void;
  onDeleted: () => void;
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

function MissionTab({
  planet,
  accentColor,
  onDeleted,
}: {
  planet: Planet;
  accentColor: string;
  onDeleted: () => void;
}) {
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deletePlanet(planet.id);
      onDeleted();
    } catch {
      setDeleting(false);
      setDeleteConfirm(false);
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
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 35%, ${accentColor}ee, ${accentColor}77)`,
            boxShadow: `0 0 28px ${accentColor}aa, 0 0 56px ${accentColor}55, 0 0 96px ${accentColor}28`,
          }}
        />
      </div>

      {/* Name + status */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: "19px",
            fontWeight: "700",
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
              borderRadius: "99px",
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.3)",
              color: "#4ade80",
              fontWeight: 600,
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
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px",
        }}
      >
        {([
          ["ORBIT INDEX", planet.id.slice(0, 8).toUpperCase()],
          ["STATUS", planet.status.toUpperCase()],
          ["ESTABLISHED", formatDate(planet.created_at)],
        ] as [string, string][]).map(([label, value]) => (
          <div
            key={label}
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(167,139,250,0.08)",
              borderRadius: "10px",
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <span
              style={{
                fontSize: "9px",
                color: accentColor,
                letterSpacing: "0.15em",
                fontFamily: "monospace",
                opacity: 0.8,
              }}
            >
              // {label}
            </span>
            <span
              style={{
                fontSize: "12px",
                color: "rgba(255,255,255,0.8)",
                letterSpacing: "0.04em",
                fontWeight: 500,
                fontFamily: "monospace",
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
          borderLeft: `3px solid ${accentColor}66`,
          background: `${accentColor}08`,
          borderRadius: "0 10px 10px 0",
          padding: "14px 14px 14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              fontSize: "10px",
              letterSpacing: "0.14em",
              color: accentColor,
              fontWeight: 700,
              fontFamily: "monospace",
            }}
          >
            MISSION BRIEF
          </div>
          <button
            onClick={fetchBriefing}
            disabled={briefingLoading}
            style={{
              background: briefingLoading ? "rgba(255,255,255,0.04)" : `${accentColor}22`,
              border: `1px solid ${accentColor}44`,
              borderRadius: "6px",
              padding: "4px 10px",
              color: briefingLoading ? `${accentColor}66` : accentColor,
              fontSize: "9px",
              letterSpacing: "0.1em",
              cursor: briefingLoading ? "not-allowed" : "pointer",
              fontFamily: "monospace",
              fontWeight: 600,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!briefingLoading)
                (e.currentTarget as HTMLButtonElement).style.background = `${accentColor}33`;
            }}
            onMouseLeave={(e) => {
              if (!briefingLoading)
                (e.currentTarget as HTMLButtonElement).style.background = `${accentColor}22`;
            }}
          >
            {briefingLoading ? "GENERATING…" : briefing ? "↺ REFRESH" : "↯ GENERATE"}
          </button>
        </div>

        {briefingLoading && (
          <div style={{ display: "flex", gap: "5px", alignItems: "center", padding: "4px 0" }}>
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                style={{
                  width: "5px",
                  height: "5px",
                  borderRadius: "50%",
                  background: accentColor,
                  opacity: 0.6,
                  display: "inline-block",
                  animation: `dot-bounce 1.2s ease-in-out ${delay}ms infinite`,
                }}
              />
            ))}
          </div>
        )}

        {!briefingLoading && briefing && (
          <div
            style={{
              fontSize: "13px",
              color: "rgba(255,255,255,0.82)",
              lineHeight: "1.75",
            }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                ul: ({ children }) => (
                  <ul style={{ margin: 0, paddingLeft: "16px", display: "flex", flexDirection: "column", gap: "6px" }}>{children}</ul>
                ),
                li: ({ children }) => (
                  <li style={{ color: "rgba(255,255,255,0.82)", lineHeight: "1.65", fontSize: "13px" }}>{children}</li>
                ),
                strong: ({ children }) => (
                  <strong style={{ color: "white", fontWeight: 600 }}>{children}</strong>
                ),
                p: ({ children }) => (
                  <p style={{ margin: "4px 0", lineHeight: "1.65" }}>{children}</p>
                ),
              }}
            >
              {briefing}
            </ReactMarkdown>
          </div>
        )}

        {!briefingLoading && !briefing && (
          <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.6" }}>
            Click Generate for a Solar status update on this mission.
          </div>
        )}
      </div>

      {/* Decommission section — only for non-sun planets */}
      {planet.id !== "sun" && (
        <>
          <div style={{ borderTop: "1px solid rgba(239,68,68,0.12)", marginTop: "4px" }} />

          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: "10px",
                padding: "10px 16px",
                color: "rgba(239,68,68,0.7)",
                fontSize: "12px",
                letterSpacing: "0.06em",
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 500,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.background = "rgba(239,68,68,0.12)";
                b.style.borderColor = "rgba(239,68,68,0.4)";
                b.style.color = "#ef4444";
              }}
              onMouseLeave={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.background = "rgba(239,68,68,0.06)";
                b.style.borderColor = "rgba(239,68,68,0.2)";
                b.style.color = "rgba(239,68,68,0.7)";
              }}
            >
              <Trash2 size={13} />
              Decommission Planet
            </button>
          ) : (
            <div
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: "10px",
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color: "#fca5a5",
                  lineHeight: "1.5",
                  fontWeight: 500,
                }}
              >
                Permanently delete <strong style={{ color: "#ef4444" }}>{planet.name}</strong>?
                This cannot be undone. All tasks and memories will be lost.
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    flex: 1,
                    background: deleting ? "rgba(239,68,68,0.4)" : "#ef4444",
                    border: "none",
                    borderRadius: "8px",
                    padding: "9px 14px",
                    color: "white",
                    fontSize: "12px",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    cursor: deleting ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.15s",
                  }}
                >
                  {deleting ? "DELETING…" : "CONFIRM DELETE"}
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  disabled={deleting}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    padding: "9px 14px",
                    color: "var(--text-muted)",
                    fontSize: "12px",
                    cursor: deleting ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.15s",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
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
              boxShadow: log.success ? "0 0 6px #22c55e" : "0 0 6px #ef4444",
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  const loadTasks = () => {
    setLoading(true);
    api
      .getTasks(planet.id)
      .then(setTasks)
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTasks();
  }, [planet.id]);

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle("");
    setAdding(false);
    setTaskError(null);
    try {
      const created = await api.createTask(planet.id, title);
      setTasks((prev) => [...prev, created]);
    } catch {
      setTaskError("Failed to create task. Is the agent service running?");
    }
  };

  const cycleStatus = async (task: Task) => {
    setTaskError(null);
    const next: Record<Task["status"], Task["status"]> = {
      todo: "doing",
      doing: "done",
      done: "todo",
    };
    try {
      const updated = await api.updateTask(task.id, { status: next[task.status] });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch {
      setTaskError("Failed to update task status. Please try again.");
    }
  };

  const handleDelete = async (taskId: string) => {
    setTaskError(null);
    try {
      await api.deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch {
      setTaskError("Failed to delete task. Please try again.");
    }
  };

  const statusIcon: Record<Task["status"], string> = {
    todo: "○",
    doing: "◑",
    done: "●",
  };
  const statusColor: Record<Task["status"], string> = {
    todo: "rgba(255,255,255,0.3)",
    doing: accentColor,
    done: "#22c55e",
  };
  const priorityColor: Record<Task["priority"], string> = {
    high: "#ef4444",
    medium: "#f59e0b",
    low: "rgba(255,255,255,0.25)",
  };

  const todo = tasks.filter((t) => t.status === "todo");
  const doing = tasks.filter((t) => t.status === "doing");
  const done = tasks.filter((t) => t.status === "done");

  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-dim)",
          fontFamily: "monospace",
          fontSize: "11px",
          letterSpacing: "0.1em",
        }}
      >
        LOADING...
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {/* Task error */}
      {taskError && (
        <p style={{ margin: 0, fontSize: "12px", color: "#fca5a5", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", padding: "8px 12px" }}>
          {taskError}
        </p>
      )}

      {/* Section helper */}
      {[
        { label: "IN PROGRESS", items: doing, color: accentColor },
        { label: "TO DO", items: todo, color: "rgba(255,255,255,0.3)" },
        { label: "DONE", items: done, color: "#22c55e" },
      ].map(({ label, items, color }) =>
        items.length > 0 ? (
          <div key={label}>
            <div
              style={{
                fontSize: "9px",
                letterSpacing: "0.15em",
                color,
                fontFamily: "monospace",
                marginBottom: "6px",
                paddingLeft: "2px",
              }}
            >
              {label}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              {items.map((task) => (
                <div
                  key={task.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "10px 12px",
                    background:
                      task.status === "doing" ? `${accentColor}0d` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${
                      task.status === "doing" ? `${accentColor}28` : "rgba(167,139,250,0.07)"
                    }`,
                    borderRadius: "8px",
                    transition: "all 0.15s",
                  }}
                >
                  {/* Status toggle */}
                  <button
                    onClick={() => cycleStatus(task)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "14px",
                      color: statusColor[task.status],
                      padding: 0,
                      flexShrink: 0,
                      marginTop: "1px",
                      transition: "transform 0.1s",
                    }}
                    title={`Mark as ${
                      task.status === "todo"
                        ? "in progress"
                        : task.status === "doing"
                        ? "done"
                        : "todo"
                    }`}
                  >
                    {statusIcon[task.status]}
                  </button>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "13px",
                        color:
                          task.status === "done" ? "var(--text-dim)" : "rgba(255,255,255,0.85)",
                        textDecoration: task.status === "done" ? "line-through" : "none",
                        lineHeight: "1.4",
                      }}
                    >
                      {task.title}
                    </div>
                    {task.description && (
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--text-dim)",
                          marginTop: "3px",
                          lineHeight: "1.4",
                        }}
                      >
                        {task.description}
                      </div>
                    )}
                  </div>

                  {/* Priority dot */}
                  <div
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: priorityColor[task.priority],
                      boxShadow: task.priority === "high" ? "0 0 6px #ef4444" : "none",
                      marginTop: "5px",
                    }}
                    title={`${task.priority} priority`}
                  />

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(task.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.15)",
                      padding: 0,
                      flexShrink: 0,
                      transition: "color 0.15s",
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLButtonElement).style.color = "#ef4444")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.15)")
                    }
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
        <div
          style={{
            textAlign: "center",
            paddingTop: "30px",
            color: "var(--text-dim)",
            fontSize: "12px",
            letterSpacing: "0.08em",
          }}
        >
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
              flex: 1,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${accentColor}44`,
              borderRadius: "8px",
              padding: "8px 12px",
              color: "white",
              fontSize: "13px",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={handleAdd}
            style={{
              background: accentColor,
              border: "none",
              borderRadius: "8px",
              padding: "8px 14px",
              color: "#0a0508",
              fontWeight: 600,
              fontSize: "12px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Add
          </button>
          <button
            onClick={() => setAdding(false)}
            style={{
              background: "none",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              padding: "8px 12px",
              color: "var(--text-muted)",
              fontSize: "12px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "rgba(255,255,255,0.02)",
            border: "1px dashed rgba(167,139,250,0.2)",
            borderRadius: "8px",
            padding: "10px 14px",
            color: "var(--text-muted)",
            fontSize: "12px",
            cursor: "pointer",
            fontFamily: "inherit",
            width: "100%",
            transition: "all 0.15s",
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

const MEMORY_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  fact:       { bg: "rgba(99,102,241,0.15)",  border: "rgba(99,102,241,0.35)",  text: "#a5b4fc" },
  preference: { bg: "rgba(245,158,11,0.13)",  border: "rgba(245,158,11,0.32)",  text: "#fcd34d" },
  goal:       { bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.30)",   text: "#4ade80" },
  person:     { bg: "rgba(236,72,153,0.12)",  border: "rgba(236,72,153,0.30)",  text: "#f9a8d4" },
  pattern:    { bg: "rgba(20,184,166,0.12)",  border: "rgba(20,184,166,0.30)",  text: "#5eead4" },
};

function TypeBadge({ type }: { type: string }) {
  const style = MEMORY_TYPE_COLORS[type] ?? MEMORY_TYPE_COLORS["fact"];
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "8px",
        letterSpacing: "0.12em",
        fontFamily: "monospace",
        fontWeight: 600,
        padding: "2px 7px",
        borderRadius: "99px",
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.text,
        flexShrink: 0,
      }}
    >
      {type.toUpperCase()}
    </span>
  );
}

function MemoryRow({ mem, onDelete }: { mem: Memory; onDelete: (id: string) => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "9px 12px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(167,139,250,0.07)",
        borderRadius: "8px",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginBottom: "4px",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: "9px",
              color: "var(--sun-color)",
              letterSpacing: "0.12em",
              fontFamily: "monospace",
            }}
          >
            {mem.key.toUpperCase()}
          </span>
          <TypeBadge type={mem.type ?? "fact"} />
        </div>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", lineHeight: "1.5" }}>
          {mem.value}
        </div>
      </div>
      <button
        onClick={() => onDelete(mem.id)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "13px",
          color: "rgba(255,255,255,0.15)",
          padding: 0,
          flexShrink: 0,
          transition: "color 0.15s",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#ef4444")}
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.15)")
        }
        title="Forget this memory"
      >
        ×
      </button>
    </div>
  );
}

function MemoryTab({ planet }: { planet: Planet }) {
  const [localMemories, setLocalMemories] = useState<Memory[]>([]);
  const [globalMemories, setGlobalMemories] = useState<Memory[]>([]);
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getMemories(planet.id),
      api.getMemories(),
      api.getUserProfile(),
    ])
      .then(([local, global_, profileRes]) => {
        // local already includes globals from the backend (WHERE planet_id=? OR planet_id IS NULL)
        // so split them out rather than double-fetching
        setLocalMemories(local.filter((m) => m.planet_id !== null));
        setGlobalMemories(global_);
        setProfile(profileRes.profile);
      })
      .catch(() => {
        setLocalMemories([]);
        setGlobalMemories([]);
        setProfile({});
      })
      .finally(() => setLoading(false));
  }, [planet.id]);

  const handleDelete = async (id: string) => {
    try {
      await api.deleteMemory(id);
      setLocalMemories((prev) => prev.filter((m) => m.id !== id));
      setGlobalMemories((prev) => prev.filter((m) => m.id !== id));
    } catch {
      // silently fail — memory may have already been deleted
    }
  };

  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-dim)",
          fontFamily: "monospace",
          fontSize: "11px",
          letterSpacing: "0.1em",
        }}
      >
        LOADING...
      </div>
    );
  }

  const hasAnything = localMemories.length > 0 || globalMemories.length > 0 || Object.keys(profile).length > 0;
  const profileEntries = Object.entries(profile);

  const SectionLabel = ({ label, color }: { label: string; color: string }) => (
    <div
      style={{
        fontSize: "9px",
        letterSpacing: "0.15em",
        color,
        fontFamily: "monospace",
        fontWeight: 700,
        paddingLeft: "2px",
        marginBottom: "4px",
      }}
    >
      {label}
    </div>
  );

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      {!hasAnything && (
        <div
          style={{
            paddingTop: "30px",
            textAlign: "center",
            color: "var(--text-dim)",
            fontSize: "12px",
            letterSpacing: "0.08em",
          }}
        >
          Solar hasn't learned anything yet. Chat to build memory.
        </div>
      )}

      {/* User Profile */}
      {profileEntries.length > 0 && (
        <div style={{ marginBottom: "6px" }}>
          <SectionLabel label="USER PROFILE" color="#a78bfa" />
          <div
            style={{
              background: "rgba(167,139,250,0.04)",
              border: "1px solid rgba(167,139,250,0.12)",
              borderRadius: "10px",
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            {profileEntries.map(([key, value]) => (
              <div key={key} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <span
                  style={{
                    fontSize: "9px",
                    fontFamily: "monospace",
                    color: "#a78bfa",
                    letterSpacing: "0.1em",
                    flexShrink: 0,
                    paddingTop: "2px",
                    minWidth: "100px",
                  }}
                >
                  {key.replace(/_/g, " ").toUpperCase()}
                </span>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", lineHeight: "1.5" }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project memories */}
      {localMemories.length > 0 && (
        <div style={{ marginBottom: "6px" }}>
          <SectionLabel label="PROJECT MEMORIES" color="var(--sun-color)" />
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {localMemories.map((mem) => (
              <MemoryRow key={mem.id} mem={mem} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {/* Global memories */}
      {globalMemories.length > 0 && (
        <div>
          <SectionLabel label="GLOBAL MEMORIES" color="#a78bfa" />
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {globalMemories.map((mem) => (
              <MemoryRow key={mem.id} mem={mem} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PlanetDetail({ planet, onBack, onDeleted }: Props) {
  const [tab, setTab] = useState<Tab>("chat");
  const [chatKey, setChatKey] = useState(0);

  const isSun = planet.id === "sun";
  const accentColor = isSun ? "#FFD700" : planet.color;

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "chat", label: "Chat", icon: "☀" },
    { id: "tasks", label: "Tasks", icon: "✓" },
    { id: "memory", label: "Memory", icon: "◈" },
    { id: "mission", label: "Mission", icon: "◎" },
    { id: "activity", label: "Log", icon: "·" },
  ];

  const handleDeleted = () => {
    onBack();
    onDeleted();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "rgba(5, 3, 14, 0.85)",
        backdropFilter: "blur(32px)",
        WebkitBackdropFilter: "blur(32px)",
        borderLeft: "1px solid rgba(167, 139, 250, 0.1)",
        boxShadow: "-16px 0 60px rgba(0,0,0,0.55)",
      }}
    >
      {/* ── Top accent bar ───────────────────────────── */}
      <div
        style={{
          height: "3px",
          background: `linear-gradient(90deg, ${accentColor}00, ${accentColor}cc 40%, ${accentColor}66 80%, ${accentColor}00)`,
          flexShrink: 0,
        }}
      />

      {/* ── Header ──────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "14px 18px",
          borderBottom: "1px solid rgba(167,139,250,0.08)",
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "8px",
            padding: "6px",
            cursor: "pointer",
            color: "var(--text-muted)",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.color = "white";
            b.style.background = "rgba(255,255,255,0.08)";
          }}
          onMouseLeave={(e) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.color = "var(--text-muted)";
            b.style.background = "rgba(255,255,255,0.04)";
          }}
        >
          <ArrowLeft size={15} />
        </button>

        {/* Planet orb */}
        <div
          style={{
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 35%, ${accentColor}ff, ${accentColor}88)`,
            boxShadow: `0 0 10px ${accentColor}cc, 0 0 24px ${accentColor}66`,
            flexShrink: 0,
          }}
        />

        <div style={{ minWidth: 0, flex: 1 }}>
          <h2
            style={{
              color: "white",
              fontWeight: 700,
              fontSize: "15px",
              lineHeight: "1.3",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              letterSpacing: "0.02em",
            }}
          >
            {planet.name}
          </h2>
          <p
            style={{
              color: "var(--text-dim)",
              fontSize: "10px",
              margin: "3px 0 0 0",
              letterSpacing: "0.1em",
              fontFamily: "monospace",
            }}
          >
            {isSun ? "MAIN AGENT  ·  ACTIVE" : `PROJECT  ·  ${planet.status.toUpperCase()}`}
          </p>
        </div>

        {/* New session button — only on chat tab for non-sun planets */}
        {tab === "chat" && !isSun && (
          <button
            onClick={() => setChatKey((k) => k + 1)}
            title="New session"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "8px",
              padding: "6px",
              cursor: "pointer",
              color: "var(--text-muted)",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.color = accentColor;
              b.style.borderColor = `${accentColor}44`;
              b.style.background = `${accentColor}12`;
            }}
            onMouseLeave={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.color = "var(--text-muted)";
              b.style.borderColor = "rgba(255,255,255,0.07)";
              b.style.background = "rgba(255,255,255,0.04)";
            }}
          >
            <RotateCcw size={14} />
          </button>
        )}
      </div>

      {/* ── Tab bar ─────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          padding: "8px 12px",
          gap: "4px",
          borderBottom: "1px solid rgba(167,139,250,0.08)",
          flexShrink: 0,
          overflowX: "auto",
        }}
      >
        {tabs.map(({ id, label, icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                flex: 1,
                padding: "6px 8px",
                background: active ? `${accentColor}22` : "transparent",
                border: active ? `1px solid ${accentColor}44` : "1px solid transparent",
                borderRadius: "99px",
                color: active ? accentColor : "var(--text-muted)",
                fontSize: "11px",
                letterSpacing: "0.03em",
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  const b = e.currentTarget as HTMLButtonElement;
                  b.style.color = "var(--text)";
                  b.style.background = "rgba(255,255,255,0.04)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  const b = e.currentTarget as HTMLButtonElement;
                  b.style.color = "var(--text-muted)";
                  b.style.background = "transparent";
                }
              }}
            >
              <span style={{ fontSize: "10px", opacity: 0.8 }}>{icon}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab content ─────────────────────────────── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* SunChat stays mounted to preserve conversation — hidden when on other tabs */}
        <div style={{ display: tab === "chat" ? "flex" : "none", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <SunChat key={chatKey} planetId={planet.id} planetName={planet.name} />
        </div>
        {tab === "tasks" && <TasksTab planet={planet} accentColor={accentColor} />}
        {tab === "memory" && <MemoryTab planet={planet} />}
        {tab === "mission" && (
          <MissionTab planet={planet} accentColor={accentColor} onDeleted={handleDeleted} />
        )}
        {tab === "activity" && <ActivityTab />}
      </div>
    </div>
  );
}
