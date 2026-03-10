import { useEffect, useRef, useState } from "react";
import { api, type Planet, type LogEntry, type Memory } from "../api/agent";

interface Props {
  onClose: () => void;
}

const GREEN = "#00ff41";
const AMBER = "#f59e0b";

const hudPanelStyle: React.CSSProperties = {
  position: "relative",
  background: "rgba(0, 10, 3, 0.7)",
  border: `1px solid ${GREEN}33`,
  padding: "16px",
  fontFamily: "monospace",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const style: React.CSSProperties = {
    position: "absolute",
    width: "12px",
    height: "12px",
    borderColor: GREEN,
    borderStyle: "solid",
    borderWidth: 0,
    ...(pos === "tl" && { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 }),
    ...(pos === "tr" && { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 }),
    ...(pos === "bl" && { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 }),
    ...(pos === "br" && { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 }),
  };
  return <div style={style} />;
}

function PanelLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: "10px",
        letterSpacing: "0.2em",
        color: GREEN,
        borderBottom: `1px solid ${GREEN}33`,
        paddingBottom: "6px",
        marginBottom: "4px",
        fontWeight: "bold",
      }}
    >
      // {label}
    </div>
  );
}

function BlinkDot({ color = GREEN }: { color?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 6px ${color}`,
        animation: "blink 1s step-end infinite",
        flexShrink: 0,
      }}
    />
  );
}

function ActiveMissionsPanel({ planets }: { planets: Planet[] | null; loading: boolean; error: string | null }) {
  if (planets === null) {
    return (
      <div style={{ ...hudPanelStyle }}>
        <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
        <PanelLabel label="ACTIVE MISSIONS" />
        <div style={{ color: `${GREEN}66`, fontSize: "11px" }}>SCANNING...</div>
      </div>
    );
  }

  return (
    <div style={{ ...hudPanelStyle }}>
      <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
      <PanelLabel label="ACTIVE MISSIONS" />
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", overflowY: "auto", flex: 1 }}>
        {planets.length === 0 && (
          <div style={{ color: `${GREEN}55`, fontSize: "11px" }}>NO MISSIONS DETECTED</div>
        )}
        {planets.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <BlinkDot color={p.id === "sun" ? AMBER : p.color} />
            <span style={{ color: GREEN, fontSize: "11px", letterSpacing: "0.05em", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.name.toUpperCase()}
            </span>
            <span style={{ color: `${GREEN}88`, fontSize: "9px", letterSpacing: "0.1em" }}>
              {p.status.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SystemStatusPanel() {
  const rows: [string, string, boolean][] = [
    ["CPU", "NOMINAL", true],
    ["MEMORY", "OK", true],
    ["API", "ONLINE", true],
    ["DB", "CONNECTED", true],
    ["AGENT", "RUNNING", true],
    ["SOLAR", "ACTIVE", true],
  ];

  return (
    <div style={{ ...hudPanelStyle }}>
      <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
      <PanelLabel label="SYSTEM STATUS" />
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {rows.map(([key, val, ok]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <BlinkDot color={ok ? GREEN : "#ef4444"} />
            <span style={{ color: `${GREEN}88`, fontSize: "10px", letterSpacing: "0.1em", minWidth: "70px" }}>
              {key}
            </span>
            <span style={{ color: AMBER, fontSize: "10px", letterSpacing: "0.08em" }}>
              {val}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MissionLogPanel({ logs }: { logs: LogEntry[] | null }) {
  if (logs === null) {
    return (
      <div style={{ ...hudPanelStyle }}>
        <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
        <PanelLabel label="MISSION LOG" />
        <div style={{ color: `${GREEN}66`, fontSize: "11px" }}>LOADING TELEMETRY...</div>
      </div>
    );
  }

  const recent = logs.slice(0, 8);

  return (
    <div style={{ ...hudPanelStyle }}>
      <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
      <PanelLabel label="MISSION LOG" />
      <div style={{ display: "flex", flexDirection: "column", gap: "5px", overflowY: "auto", flex: 1 }}>
        {recent.length === 0 && (
          <div style={{ color: `${GREEN}55`, fontSize: "11px" }}>NO LOG ENTRIES</div>
        )}
        {recent.map((log) => (
          <div key={log.id} style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
            <span
              style={{
                display: "inline-block",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: log.success ? GREEN : "#ef4444",
                boxShadow: log.success ? `0 0 4px ${GREEN}` : "0 0 4px #ef4444",
                marginTop: "3px",
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, overflow: "hidden" }}>
              <span style={{ color: AMBER, fontSize: "9px", letterSpacing: "0.1em" }}>
                [{log.skill.toUpperCase()}]
              </span>{" "}
              <span style={{ color: `${GREEN}cc`, fontSize: "10px" }}>
                {log.summary.length > 50 ? log.summary.slice(0, 50) + "…" : log.summary}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SolarIntelligencePanel({ memories }: { memories: Memory[] | null }) {
  if (memories === null) {
    return (
      <div style={{ ...hudPanelStyle }}>
        <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
        <PanelLabel label="SOLAR INTELLIGENCE" />
        <div style={{ color: `${GREEN}66`, fontSize: "11px" }}>ACCESSING MEMORY BANKS...</div>
      </div>
    );
  }

  return (
    <div style={{ ...hudPanelStyle }}>
      <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
      <PanelLabel label="SOLAR INTELLIGENCE" />
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", overflowY: "auto", flex: 1 }}>
        {memories.length === 0 && (
          <div style={{ color: `${GREEN}55`, fontSize: "11px" }}>MEMORY BANKS EMPTY</div>
        )}
        {memories.slice(0, 10).map((mem) => (
          <div key={mem.id} style={{ borderLeft: `2px solid ${GREEN}44`, paddingLeft: "8px" }}>
            <div style={{ color: AMBER, fontSize: "9px", letterSpacing: "0.12em" }}>
              {mem.key.toUpperCase()}
            </div>
            <div style={{ color: `${GREEN}bb`, fontSize: "10px", marginTop: "1px" }}>
              {mem.value.length > 60 ? mem.value.slice(0, 60) + "…" : mem.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Live clock
function useClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return time;
}

// Mini orbit radar canvas
function OrbitRadar({ planets }: { planets: Planet[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef  = useRef<number>(0);
  const anglesRef = useRef<number[]>(planets.map((_, i) => i * 1.3));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;
    const maxR = Math.min(cx, cy) - 8;
    const colors = ["#29b6f6","#f0b050","#e64a19","#80d8ff","#ff4500","#00bcd4","#a78bfa","#00ff41"];

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      // Grid rings
      for (let r = maxR * 0.25; r <= maxR; r += maxR * 0.25) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0,255,65,0.07)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // Cross-hairs
      ctx.strokeStyle = "rgba(0,255,65,0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();

      // Sun
      const sunGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 6);
      sunGrad.addColorStop(0, "#fffbe0");
      sunGrad.addColorStop(1, "rgba(245,158,11,0)");
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#f59e0b"; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.fillStyle = sunGrad; ctx.fill();

      // Planets orbiting
      planets.forEach((_, i) => {
        const orbitR = maxR * (0.18 + i * (0.72 / Math.max(planets.length, 1)));
        const speed  = 0.004 + i * 0.0015;
        anglesRef.current[i] = (anglesRef.current[i] ?? 0) + speed;
        const a = anglesRef.current[i];
        const px = cx + orbitR * Math.cos(a);
        const py = cy + orbitR * Math.sin(a) * 0.55; // tilt
        const col = colors[i % colors.length];

        // Orbit track
        ctx.beginPath();
        ctx.ellipse(cx, cy, orbitR, orbitR * 0.55, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0,255,65,0.09)";
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Planet dot
        ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = col; ctx.fill();
        // Glow
        const g = ctx.createRadialGradient(px, py, 0, px, py, 9);
        g.addColorStop(0, col + "66");
        g.addColorStop(1, col + "00");
        ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
      });

      frameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frameRef.current);
  }, [planets]);

  return <canvas ref={canvasRef} width={200} height={200} style={{ display: "block", opacity: 0.9 }} />;
}

export function ControlCenter({ onClose }: Props) {
  const [planets, setPlanets] = useState<Planet[] | null>(null);
  const [logs, setLogs] = useState<LogEntry[] | null>(null);
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [planetsError, setPlanetsError] = useState<string | null>(null);
  const [planetsLoading, setPlanetsLoading] = useState(true);
  const clock = useClock();

  useEffect(() => {
    api.getPlanets()
      .then((data) => { setPlanets(data); setPlanetsLoading(false); })
      .catch((err: unknown) => {
        setPlanetsError(err instanceof Error ? err.message : "Failed to load");
        setPlanets([]);
        setPlanetsLoading(false);
      });

    api.getLogs()
      .then(setLogs)
      .catch(() => setLogs([]));

    api.getMemories()
      .then(setMemories)
      .catch(() => setMemories([]));
  }, []);

  return (
    <>
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes scanline-move {
          0% { transform: translateY(0); }
          100% { transform: translateY(4px); }
        }
      `}</style>

      {/* Full-screen overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 40,
          background: "rgba(0, 4, 8, 0.96)",
          fontFamily: "monospace",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* CRT scan-line overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 1,
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,65,0.015) 2px, rgba(0,255,65,0.015) 4px)",
          }}
        />

        {/* Green glow vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 1,
            background:
              "radial-gradient(ellipse at center, transparent 40%, rgba(0,4,8,0.7) 100%)",
          }}
        />

        {/* Content sits above overlays */}
        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", height: "100%" }}>

          {/* ── Header ─────────────────────────────────── */}
          <div
            style={{
              padding: "20px 28px 16px",
              borderBottom: `1px solid ${GREEN}33`,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "16px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "22px",
                  fontWeight: "bold",
                  color: GREEN,
                  letterSpacing: "0.25em",
                  textShadow: `0 0 20px ${GREEN}, 0 0 40px ${GREEN}66`,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                SOLAR MISSION CONTROL
                <span
                  style={{
                    display: "inline-block",
                    width: "2px",
                    height: "22px",
                    background: GREEN,
                    animation: "cursor-blink 1s step-end infinite",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: "24px", marginTop: "6px", alignItems: "center" }}>
                <div style={{ fontSize: "11px", color: AMBER, letterSpacing: "0.18em" }}>
                  // HOUSTON WE ARE GO FOR LAUNCH
                </div>
                <div style={{ fontSize: "11px", color: `${GREEN}cc`, letterSpacing: "0.14em", fontVariantNumeric: "tabular-nums" }}>
                  {clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  &nbsp;UTC+{new Date().getTimezoneOffset() / -60 >= 0 ? "+" : ""}{new Date().getTimezoneOffset() / -60}
                </div>
                <div style={{ fontSize: "10px", color: `${GREEN}66`, letterSpacing: "0.12em" }}>
                  {planets !== null ? `${planets.length} ACTIVE ORBIT${planets.length !== 1 ? "S" : ""}` : "SCANNING..."}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: `1px solid ${GREEN}55`,
                color: GREEN,
                fontFamily: "monospace",
                fontSize: "12px",
                letterSpacing: "0.1em",
                padding: "6px 14px",
                cursor: "pointer",
                transition: "all 0.15s",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = `${GREEN}22`;
                (e.currentTarget as HTMLButtonElement).style.borderColor = GREEN;
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 12px ${GREEN}55`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                (e.currentTarget as HTMLButtonElement).style.borderColor = `${GREEN}55`;
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
              }}
            >
              [ CLOSE ]
            </button>
          </div>

          {/* ── Main grid ─────────────────────────────── */}
          <div
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: "220px 1fr 1fr",
              gridTemplateRows: "1fr 1fr",
              gap: "12px",
              padding: "16px 28px",
              overflow: "hidden",
            }}
          >
            {/* Orbit radar — spans both rows */}
            <div style={{ ...hudPanelStyle, gridRow: "1 / 3", alignItems: "center", justifyContent: "space-between" }}>
              <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
              <PanelLabel label="ORBITAL RADAR" />
              <div style={{ display: "flex", justifyContent: "center", flex: 1, alignItems: "center" }}>
                <OrbitRadar planets={planets ?? []} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%", marginTop: "8px" }}>
                {(planets ?? []).map((p, i) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: p.color, flexShrink: 0, boxShadow: `0 0 4px ${p.color}` }} />
                    <span style={{ color: `${GREEN}99`, fontSize: "9px", letterSpacing: "0.1em", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name.toUpperCase()}
                    </span>
                    <span style={{ color: `${GREEN}55`, fontSize: "8px" }}>ORB-{String(i + 1).padStart(2, "0")}</span>
                  </div>
                ))}
              </div>
            </div>

            <ActiveMissionsPanel
              planets={planets}
              loading={planetsLoading}
              error={planetsError}
            />
            <SystemStatusPanel />
            <MissionLogPanel logs={logs} />
            <SolarIntelligencePanel memories={memories} />
          </div>

          {/* ── Footer ─────────────────────────────────── */}
          <div
            style={{
              padding: "12px 28px 20px",
              borderTop: `1px solid ${GREEN}33`,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <button
              onClick={onClose}
              style={{
                background: `${GREEN}18`,
                border: `1px solid ${GREEN}77`,
                color: GREEN,
                fontFamily: "monospace",
                fontSize: "13px",
                letterSpacing: "0.2em",
                padding: "10px 32px",
                cursor: "pointer",
                textShadow: `0 0 10px ${GREEN}`,
                boxShadow: `0 0 20px ${GREEN}22, inset 0 0 20px ${GREEN}0a`,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = `${GREEN}33`;
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 30px ${GREEN}44, inset 0 0 20px ${GREEN}18`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = `${GREEN}18`;
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 20px ${GREEN}22, inset 0 0 20px ${GREEN}0a`;
              }}
            >
              [ LAUNCH NEW MISSION ]
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
