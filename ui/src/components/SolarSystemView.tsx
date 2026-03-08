import { Plus, Radio, Settings } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { api, type Planet } from "../api/agent";

interface Props {
  onSelectPlanet: (planet: Planet) => void;
  onOpenSettings: () => void;
  onOpenControlCenter: () => void;
  activePlanetId: string | null;
}

const ORBIT_SPEEDS  = [90, 130, 170, 220, 260];
const MOON_SPEEDS   = [8, 11, 9, 13, 10];   // seconds per moon revolution
const MOON_RADIUS   = 24;                     // px from planet center
const PLANET_COLORS = ["#6366f1", "#ec4899", "#14b8a6", "#f97316", "#8b5cf6"];
const ORBIT_BASE    = 130;
const ORBIT_GAP     = 85;
const CX = 500;
const CY = 350;

// Fixed twinkling stars (SVG circles with CSS twinkle animation)
const TWINKLE_STARS = [
  { cx: 80,  cy: 60,  r: 1.5, delay: "0s",    dur: "8.5s"  },
  { cx: 920, cy: 120, r: 1.2, delay: "3.2s",  dur: "11s"   },
  { cx: 150, cy: 580, r: 1.8, delay: "6.5s",  dur: "9.5s"  },
  { cx: 840, cy: 500, r: 1.3, delay: "1.4s",  dur: "13s"   },
  { cx: 300, cy: 80,  r: 1.0, delay: "9.0s",  dur: "10.5s" },
  { cx: 700, cy: 620, r: 1.6, delay: "4.8s",  dur: "12s"   },
  { cx: 950, cy: 340, r: 1.1, delay: "7.2s",  dur: "9s"    },
  { cx: 50,  cy: 400, r: 1.4, delay: "2.1s",  dur: "14s"   },
  { cx: 430, cy: 30,  r: 1.0, delay: "5.5s",  dur: "11.5s" },
  { cx: 600, cy: 670, r: 1.3, delay: "0.8s",  dur: "10s"   },
];

export function SolarSystemView({
  onSelectPlanet,
  onOpenSettings,
  onOpenControlCenter,
  activePlanetId,
}: Props) {
  const [planets, setPlanets]       = useState<Planet[]>([]);
  const [newName, setNewName]       = useState("");
  const [adding, setAdding]         = useState(false);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [hoveredId, setHoveredId]   = useState<string | null>(null);
  const [sunHovered, setSunHovered] = useState(false);
  const [launching, setLaunching]   = useState(false);
  const [zoom, setZoom]             = useState(1);

  const anglesRef    = useRef<Map<string, number>>(new Map());
  const moonsRef     = useRef<Map<string, number>>(new Map());
  const rafRef       = useRef<number>(0);
  const lastTimeRef  = useRef<number>(0);
  const [, setTick]  = useState(0);

  const load = async () => {
    try {
      const data = await api.getPlanets();
      setPlanets(data);
      setError(null);
    } catch {
      setError("Can't reach agent service — is it running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (planets.length === 0) return;

    planets.forEach((planet, i) => {
      if (!anglesRef.current.has(planet.id)) {
        anglesRef.current.set(planet.id, (i * 137.5 * Math.PI) / 180);
      }
      if (!moonsRef.current.has(planet.id)) {
        moonsRef.current.set(planet.id, (i * 72 * Math.PI) / 180);
      }
    });

    const animate = (now: number) => {
      const dt = lastTimeRef.current ? (now - lastTimeRef.current) / 1000 : 0;
      lastTimeRef.current = now;

      planets.forEach((planet, i) => {
        const speed   = ORBIT_SPEEDS[i % ORBIT_SPEEDS.length];
        const current = anglesRef.current.get(planet.id) ?? 0;
        anglesRef.current.set(planet.id, current + (2 * Math.PI / speed) * dt);

        const moonSpeed   = MOON_SPEEDS[i % MOON_SPEEDS.length];
        const moonCurrent = moonsRef.current.get(planet.id) ?? 0;
        moonsRef.current.set(planet.id, moonCurrent + (2 * Math.PI / moonSpeed) * dt);
      });

      setTick((n) => n + 1);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [planets]);

  const handleCreate = async () => {
    if (!newName.trim() || launching) return;
    const name  = newName.trim();
    const color = PLANET_COLORS[planets.length % PLANET_COLORS.length];

    setLaunching(true);
    setAdding(false);
    setNewName("");

    // Speech synthesis countdown
    try {
      window.speechSynthesis.cancel();
      const msg = new SpeechSynthesisUtterance("3... 2... 1... Launch!");
      msg.pitch = 0.7;
      msg.rate  = 0.88;
      window.speechSynthesis.speak(msg);
    } catch { /* not supported */ }

    // Wait for "launch" feel, then create
    setTimeout(async () => {
      try {
        await api.createPlanet(name, color);
        await load();
      } finally {
        setTimeout(() => setLaunching(false), 1500);
      }
    }, 3200);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await api.deletePlanet(id);
    anglesRef.current.delete(id);
    moonsRef.current.delete(id);
    setPlanets((prev) => prev.filter((p) => p.id !== id));
  };

  const timeStr = new Date().toLocaleTimeString([], {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => Math.min(2.8, Math.max(0.35, prev - e.deltaY * 0.0008)));
  };

  return (
    <div
      className="relative w-full h-screen flex flex-col items-center"
      onWheel={handleWheel}
      style={{ userSelect: "none" }}
    >

      {/* ── Header ──────────────────────────────────── */}
      <div className="absolute top-5 left-6 z-10">
        <h1
          className="font-semibold glow-sun"
          style={{ color: "var(--sun-color)", letterSpacing: "0.18em", fontSize: "1.05rem" }}
        >
          ☀ SOLAR AI OS
        </h1>
        <p style={{ color: "var(--text-dim)", letterSpacing: "0.12em", fontSize: "0.67rem", marginTop: "3px" }}>
          {planets.length} OBJECT{planets.length !== 1 ? "S" : ""} IN ORBIT
        </p>
      </div>

      {/* ── Top-right controls ──────────────────────── */}
      <div className="absolute top-5 right-6 z-10 flex items-center gap-2">
        {/* Mission Control */}
        <button
          onClick={onOpenControlCenter}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            color: "#00ff41",
            border: "1px solid rgba(0,255,65,0.25)",
            background: "rgba(0,255,65,0.05)",
            letterSpacing: "0.08em",
            fontFamily: "monospace",
          }}
          onMouseEnter={(e) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.background = "rgba(0,255,65,0.12)";
            b.style.borderColor = "rgba(0,255,65,0.5)";
          }}
          onMouseLeave={(e) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.background = "rgba(0,255,65,0.05)";
            b.style.borderColor = "rgba(0,255,65,0.25)";
          }}
        >
          <Radio size={11} />
          HOUSTON
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg transition-all"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "white"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
          title="Settings"
        >
          <Settings size={15} />
        </button>
      </div>

      {/* ── Error banner ────────────────────────────── */}
      {error && (
        <div
          className="absolute top-5 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-lg text-sm"
          style={{
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#fca5a5",
          }}
        >
          {error}
        </div>
      )}

      {/* ── Launch countdown overlay ─────────────────── */}
      {launching && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
          style={{ animation: "fade-in 0.3s ease" }}
        >
          <div
            className="text-center"
            style={{ fontFamily: "monospace", color: "#f59e0b" }}
          >
            <div style={{ fontSize: "1.4rem", letterSpacing: "0.3em", opacity: 0.9 }}>
              🚀 LAUNCHING MISSION
            </div>
            <div style={{ fontSize: "0.75rem", letterSpacing: "0.2em", marginTop: "8px", color: "rgba(245,158,11,0.5)" }}>
              PREPARING ORBITAL INSERTION…
            </div>
          </div>
        </div>
      )}

      {/* ── Zoom indicator ───────────────────────────── */}
      {zoom !== 1 && (
        <div
          className="absolute bottom-6 right-6 z-10"
          style={{
            fontFamily: "monospace",
            fontSize: "9px",
            letterSpacing: "0.15em",
            color: "rgba(245,158,11,0.45)",
          }}
        >
          {zoom > 1 ? "+" : ""}{Math.round((zoom - 1) * 100)}%  ·  scroll to zoom
        </div>
      )}

      {/* ── Solar System SVG ─────────────────────────── */}
      <svg
        viewBox="0 0 1000 700"
        className="w-full h-full"
        style={{
          zIndex: 1,
          transform: `scale(${zoom})`,
          transformOrigin: "center center",
          transition: "transform 0.12s ease-out",
        }}
      >
        <defs>
          <filter id="sun-filter" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="orbit-glow" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="moon-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <radialGradient id="sun-grad" cx="38%" cy="32%">
            <stop offset="0%"   stopColor="#fff9c4" />
            <stop offset="55%"  stopColor="#FFD700" />
            <stop offset="100%" stopColor="#f97316" />
          </radialGradient>

          {planets.map((planet) => (
            <React.Fragment key={`grads-${planet.id}`}>
              {/* Sphere shading gradient — light from upper-left */}
              <radialGradient id={`grad-${planet.id}`} cx="34%" cy="28%" r="68%">
                <stop offset="0%"   stopColor="#ffffff"      stopOpacity="0.92" />
                <stop offset="15%"  stopColor="#ffffff"      stopOpacity="0.55" />
                <stop offset="38%"  stopColor={planet.color} stopOpacity="0.88" />
                <stop offset="72%"  stopColor={planet.color} stopOpacity="1"    />
                <stop offset="100%" stopColor="#050308"      stopOpacity="0.58" />
              </radialGradient>
              {/* Atmosphere rim — subtle inner glow from edge */}
              <radialGradient id={`atm-${planet.id}`} cx="50%" cy="50%" r="50%">
                <stop offset="55%"  stopColor={planet.color} stopOpacity="0"    />
                <stop offset="100%" stopColor={planet.color} stopOpacity="0.42" />
              </radialGradient>
            </React.Fragment>
          ))}
        </defs>

        {/* ── Twinkling stars ───────────────────────── */}
        {TWINKLE_STARS.map((s, i) => (
          <circle
            key={`twinkle-${i}`}
            cx={s.cx} cy={s.cy} r={s.r}
            fill="white"
            style={{
              animation: `twinkle ${s.dur} ease-in-out ${s.delay} infinite`,
            }}
          />
        ))}

        {/* ── Corner chrome ─────────────────────────── */}
        <g stroke="rgba(245,158,11,0.2)" strokeWidth="1" fill="none">
          <path d="M18,44 L18,18 L44,18" />
          <path d="M956,18 L982,18 L982,44" />
          <path d="M18,656 L18,682 L44,682" />
          <path d="M956,682 L982,682 L982,656" />
        </g>

        {/* ── Orbit rings ───────────────────────────── */}
        {planets.map((_, i) => (
          <circle
            key={`orbit-${i}`}
            cx={CX} cy={CY}
            r={ORBIT_BASE + i * ORBIT_GAP}
            fill="none"
            stroke={`rgba(245,158,11,${Math.max(0.03, 0.09 - i * 0.012)})`}
            strokeWidth="0.8"
            strokeDasharray="4 12"
            filter="url(#orbit-glow)"
          />
        ))}

        {/* ── Sun ───────────────────────────────────── */}
        <g
          data-sun
          style={{ cursor: "pointer" }}
          onClick={() =>
            onSelectPlanet({
              id: "sun", name: "Solar — Main Agent", status: "active",
              orbit_radius: 0, color: "#FFD700", created_at: "",
            })
          }
          onMouseEnter={() => setSunHovered(true)}
          onMouseLeave={() => setSunHovered(false)}
          filter="url(#sun-filter)"
        >
          <circle cx={CX} cy={CY} r={sunHovered ? 62 : 55} fill="#FFD700" opacity={0.04} style={{ transition: "r 0.4s" }} />
          <circle cx={CX} cy={CY} r={sunHovered ? 46 : 41} fill="#FFD700" opacity={0.1}  style={{ transition: "r 0.4s" }} />
          <circle cx={CX} cy={CY} r={sunHovered ? 34 : 30} fill="#f97316" opacity={0.2}  style={{ transition: "r 0.4s" }} />
          <circle cx={CX} cy={CY} r={24} fill="url(#sun-grad)" />
          <text
            x={CX} y={CY + 46}
            textAnchor="middle"
            fill="rgba(245,158,11,0.55)"
            fontSize="8"
            letterSpacing="2.5"
            fontFamily="monospace"
            filter="none"
          >
            SOLAR
          </text>
        </g>

        {/* ── Planets + Moons ───────────────────────── */}
        {planets.map((planet, i) => {
          const orbitR    = ORBIT_BASE + i * ORBIT_GAP;
          const angle     = anglesRef.current.get(planet.id) ?? (i * 137.5 * Math.PI) / 180;
          const px        = CX + orbitR * Math.cos(angle);
          const py        = CY + orbitR * Math.sin(angle);
          const isHovered = hoveredId === planet.id;
          const isActive  = activePlanetId === planet.id;
          const r         = isHovered ? 13 : 10;

          // Moon position
          const moonAngle = moonsRef.current.get(planet.id) ?? 0;
          const mx        = px + MOON_RADIUS * Math.cos(moonAngle);
          const my        = py + MOON_RADIUS * Math.sin(moonAngle);

          return (
            <g key={planet.id}>
              {/* Active selection ring */}
              {isActive && (
                <circle
                  cx={px} cy={py}
                  r={r + 20}
                  fill="none"
                  stroke={planet.color}
                  strokeWidth="0.8"
                  strokeDasharray="3 5"
                  opacity={0.5}
                />
              )}

              {/* Ambient halo */}
              <circle
                cx={px} cy={py}
                r={r + 10}
                fill={planet.color}
                opacity={isActive ? 0.28 : isHovered ? 0.2 : 0.07}
                style={{ transition: "opacity 0.25s" }}
              />

              {/* Planet body */}
              <circle
                cx={px} cy={py}
                r={r}
                fill={`url(#grad-${planet.id})`}
                style={{
                  cursor: "pointer",
                  transition: "r 0.15s",
                  filter: `drop-shadow(0 0 ${isActive ? 14 : isHovered ? 11 : 5}px ${planet.color})`,
                }}
                onClick={() => onSelectPlanet(planet)}
                onMouseEnter={() => setHoveredId(planet.id)}
                onMouseLeave={() => setHoveredId(null)}
              />
              {/* Atmosphere rim overlay */}
              <circle
                cx={px} cy={py}
                r={r}
                fill={`url(#atm-${planet.id})`}
                style={{ pointerEvents: "none", transition: "r 0.15s" }}
              />

              {/* Moon orbit ring (subtle) */}
              <circle
                cx={px} cy={py}
                r={MOON_RADIUS}
                fill="none"
                stroke={`${planet.color}22`}
                strokeWidth="0.5"
              />

              {/* Moon */}
              <circle
                cx={mx} cy={my}
                r={2.5}
                fill="rgba(255,255,255,0.7)"
                filter="url(#moon-glow)"
                style={{ pointerEvents: "none" }}
              />

              {/* Planet label */}
              <text
                x={px} y={py + r + 30}
                textAnchor="middle"
                fill={isHovered || isActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.38)"}
                fontSize={isHovered ? "8.5" : "7.5"}
                letterSpacing="1"
                style={{ pointerEvents: "none", transition: "font-size 0.15s", fontFamily: "monospace" }}
              >
                {(planet.name.length > 12 ? planet.name.slice(0, 11) + "…" : planet.name).toUpperCase()}
              </text>

              {/* Delete button */}
              {isHovered && (
                <g
                  onClick={(e) => handleDelete(e, planet.id)}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredId(planet.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <circle cx={px + 15} cy={py - 15} r={8} fill="rgba(239,68,68,0.85)" />
                  <text x={px + 15} y={py - 12} textAnchor="middle" fill="white" fontSize="11"
                    style={{ pointerEvents: "none" }}>×</text>
                </g>
              )}
            </g>
          );
        })}

        {/* Loading */}
        {loading && (
          <text x={CX} y={CY + 90} textAnchor="middle"
            fill="rgba(245,158,11,0.25)" fontSize="10" letterSpacing="2.5" fontFamily="monospace">
            INITIALIZING…
          </text>
        )}

        {/* Empty state */}
        {!loading && planets.length === 0 && !error && (
          <text x={CX} y={CY + 90} textAnchor="middle"
            fill="rgba(255,255,255,0.16)" fontSize="10" letterSpacing="1.5" fontFamily="monospace">
            NO OBJECTS IN ORBIT  ·  LAUNCH YOUR FIRST MISSION ↓
          </text>
        )}

        {/* Status bar */}
        <text x={982} y={695} textAnchor="end"
          fill="rgba(245,158,11,0.17)" fontSize="7" letterSpacing="1.5" fontFamily="monospace">
          {`SOLAR AI OS  //  ${planets.length} IN ORBIT  //  ${timeStr}`}
        </text>
      </svg>

      {/* ── Add planet / Launch mission ──────────────── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
        {launching ? (
          <div
            className="text-xs px-5 py-2 rounded-full"
            style={{
              color: "var(--sun-color)",
              border: "1px solid rgba(245,158,11,0.4)",
              fontFamily: "monospace",
              letterSpacing: "0.15em",
              animation: "blink 0.8s step-end infinite",
            }}
          >
            ● MISSION LAUNCHING…
          </div>
        ) : adding ? (
          <>
            <input
              autoFocus
              className="text-white rounded-xl px-4 py-2 text-sm w-56 focus:outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(167,139,250,0.3)",
                backdropFilter: "blur(12px)",
              }}
              placeholder="Mission name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setAdding(false);
              }}
            />
            <button
              onClick={handleCreate}
              className="font-semibold rounded-xl px-4 py-2 text-sm text-black transition-opacity hover:opacity-90"
              style={{ background: "var(--sun-color)" }}
            >
              🚀 Launch
            </button>
            <button
              onClick={() => setAdding(false)}
              className="text-sm px-2"
              style={{ color: "var(--text-muted)" }}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 rounded-full px-5 py-2 text-sm transition-all"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(167,139,250,0.18)",
              color: "var(--text-muted)",
              backdropFilter: "blur(8px)",
            }}
            onMouseEnter={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.borderColor = "rgba(245,158,11,0.35)";
              b.style.color = "white";
            }}
            onMouseLeave={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.borderColor = "rgba(167,139,250,0.18)";
              b.style.color = "var(--text-muted)";
            }}
          >
            <Plus size={14} /> Launch new mission
          </button>
        )}
      </div>
    </div>
  );
}
