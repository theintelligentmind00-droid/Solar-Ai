import { HelpCircle, Plus, Radio, Settings } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { api, type Integration, type Planet } from "../api/agent";
import { soundManager } from "../sounds/SoundManager";
import { PlanetCreationAnimation } from "./PlanetCreationAnimation";
import { SpaceshipAnimation } from "./SpaceshipAnimation";
import { CometNotificationLayer } from "./CometNotification";

interface Props {
  onSelectPlanet: (planet: Planet) => void;
  onOpenSettings: () => void;
  onOpenControlCenter: () => void;
  onOpenMetaphorGuide: () => void;
  activePlanetId: string | null;
  refreshKey?: number;
}

// ── Constants ─────────────────────────────────────────────────
const ORBIT_SPEEDS = [95, 142, 188, 240, 285];
const MOON_SPEEDS  = [6.5, 9, 7.5, 11, 8.5];
const ORBIT_BASE   = 80;
const ORBIT_GAP    = 42;
const CX = 500;
const CY = 350;
const SUN_R = 46;

// ── Planet types — unified with PlanetScene 3D colors ────────
const PLANET_TYPE_CYCLE = ["terra", "forge", "oasis", "nexus", "citadel", "gaia", "void"];

// Civilization: time-based from created_at
// < 1 hr → OUTPOST, < 1 day → SETTLEMENT, < 7 days → COLONY, 7+ days → METROPOLIS
const CIV_NAMES   = ["OUTPOST", "SETTLEMENT", "COLONY", "METROPOLIS"] as const;
const CIV_GLOW    = ["rgba(255,200,100,0.14)", "rgba(255,190,80,0.22)", "rgba(255,175,60,0.32)", "rgba(255,220,120,0.42)"];
const CIV_DOT     = ["rgba(255,210,120,0.9)", "rgba(255,195,90,0.92)", "rgba(255,185,70,0.95)", "rgba(255,230,140,1)"];

function getCivLevel(planet: Planet): number {
  if (!planet.created_at) return 0;
  const ageMs = Date.now() - new Date(planet.created_at).getTime();
  const ageHr = ageMs / 3_600_000;
  if (ageHr < 1)   return 0;
  if (ageHr < 24)  return 1;
  if (ageHr < 168) return 2;
  return 3;
}

function getActivityLevel(lastActivityAt?: string | null): 'hot' | 'warm' | 'cold' {
  if (!lastActivityAt) return 'cold';
  const diff = Date.now() - new Date(lastActivityAt).getTime();
  if (diff < 60 * 60 * 1000) return 'hot';      // < 1 hour
  if (diff < 24 * 60 * 60 * 1000) return 'warm'; // < 24 hours
  return 'cold';
}

interface TCfg {
  hi: string; mid: string; lo: string;
  atmo: string; glow: string;
  rings: "none" | "saturn" | "ice";
  ringA: string; ringB: string;
  moonBase: string; moonMid: string;
  label: string; r: number;
}

// Keyed by planet_type — matches PlanetScene 3D atmosphere colors
const TC: Record<string, TCfg> = {
  terra:   { hi:"#c5eafe", mid:"#4da6ff", lo:"#1a3a5c", atmo:"rgba(100,180,255,0.40)", glow:"#4da6ff", rings:"none",   ringA:"", ringB:"", moonBase:"#c4cdd6", moonMid:"#9aa5b0", label:"TERRESTRIAL",  r:16 },
  forge:   { hi:"#ffcc88", mid:"#e06420", lo:"#5a1800", atmo:"rgba(255,115,20,0.35)",  glow:"#ff7315", rings:"saturn", ringA:"rgba(200,80,20,0.50)", ringB:"rgba(180,65,12,0.30)", moonBase:"#bfb09a", moonMid:"#998070", label:"FORGE WORLD",  r:15 },
  oasis:   { hi:"#a0fff0", mid:"#2ee8d8", lo:"#003830", atmo:"rgba(46,240,225,0.35)",  glow:"#2ee8d8", rings:"ice",    ringA:"rgba(90,230,215,0.45)", ringB:"rgba(60,200,190,0.28)", moonBase:"#b0e0d8", moonMid:"#80beb5", label:"OASIS WORLD",  r:16 },
  nexus:   { hi:"#b8e0ff", mid:"#1ec0ff", lo:"#0a2840", atmo:"rgba(30,192,255,0.40)",  glow:"#1ec0ff", rings:"none",   ringA:"", ringB:"", moonBase:"#c0d5e5", moonMid:"#90b5cc", label:"NEXUS WORLD",  r:14 },
  citadel: { hi:"#ffe8a0", mid:"#ffc030", lo:"#5a3800", atmo:"rgba(255,192,48,0.32)",  glow:"#ffc030", rings:"saturn", ringA:"rgba(255,200,90,0.55)", ringB:"rgba(220,170,60,0.30)", moonBase:"#d0c8a8", moonMid:"#b0a880", label:"CITADEL",      r:17 },
  gaia:    { hi:"#a0ffb0", mid:"#4cf268", lo:"#0a3818", atmo:"rgba(76,242,104,0.35)",  glow:"#4cf268", rings:"none",   ringA:"", ringB:"", moonBase:"#b0d8b8", moonMid:"#88b890", label:"GAIA WORLD",   r:16 },
  void:    { hi:"#d8a0ff", mid:"#a630ff", lo:"#1a0040", atmo:"rgba(166,48,255,0.38)",  glow:"#a630ff", rings:"saturn", ringA:"rgba(150,55,235,0.55)", ringB:"rgba(120,40,200,0.30)", moonBase:"#c0b0d8", moonMid:"#a090c0", label:"VOID WORLD",   r:20 },
};
const TC_DEFAULT = TC.terra;

// ── Stars ─────────────────────────────────────────────────────
// Single gradient star field: star size grows with distance from center.
// No rectangular boundary → seamless at any zoom level.
function _h(n: number): number { const x = Math.sin(n) * 43758.5453123; return x - Math.floor(x); }

const STAR_FIELD = (() => {
  const out: { x: number; y: number; r: number; op: number }[] = [];
  const TOTAL = 6000;
  for (let i = 0; i < TOTAL; i++) {
    const x = _h(i * 1.1) * 18000 - 8000;   // -8000 → +10000
    const y = _h(i * 2.3) * 14000 - 6500;   // -6500 → +7500
    // Elliptical distance from solar system center (matches orbital layout)
    const dx = (x - CX) / 1.4, dy = y - CY;
    const d = Math.sqrt(dx * dx + dy * dy);
    // t: 0 near center → 1 at d=4000 (seamless gradient)
    const t = Math.min(d / 4000, 1);
    // Radius: small near center, large far out (seamless transition)
    const r = (0.35 + t * 4.65) + _h(i * 3.7) * (0.5 + t * 2.0);
    // Opacity: brighter near center (makes close-up look rich), dim far out
    const opBase = 0.22 - t * 0.18;   // 0.22 → 0.04
    const op = opBase + _h(i * 5.1) * (0.20 - t * 0.16);
    out.push({ x, y, r, op });
  }
  return out;
})();

const TWINKLERS = [
  { x:76,  y:48,  r:2.2, c:"#ffd9b3", d:"0s",    t:"8.5s" }, { x:942, y:84,  r:1.9, c:"#c8d8ff", d:"2.5s", t:"10s" },
  { x:132, y:590, r:2.4, c:"#ffecd2", d:"6s",    t:"9s"   }, { x:870, y:520, r:1.8, c:"#d4f5ff", d:"1.3s", t:"13s" },
  { x:312, y:58,  r:2.1, c:"#ffe0e0", d:"4s",    t:"11s"  }, { x:728, y:645, r:2.3, c:"#e8d5ff", d:"7.5s", t:"12s" },
  { x:40,  y:298, r:1.6, c:"#fffde0", d:"3.2s",  t:"10s"  }, { x:968, y:412, r:1.9, c:"#d0f0ff", d:"5.8s", t:"9.5s"},
  { x:555, y:25,  r:1.6, c:"#fff0d4", d:"9.1s",  t:"8s"   }, { x:408, y:678, r:1.8, c:"#dde8ff", d:"0.5s", t:"11.5s"},
  { x:182, y:38,  r:1.5, c:"#ffddaa", d:"7s",    t:"14s"  }, { x:782, y:85,  r:1.7, c:"#ccf0ff", d:"3.8s", t:"9.2s" },
];

const NEBULAS = [
  { cx:155, cy:132, rx:168, ry:80, fill:"rgba(125,45,245,0.046)" },
  { cx:838, cy:200, rx:152, ry:66, fill:"rgba(245,158,11,0.040)" },
  { cx:182, cy:538, rx:138, ry:64, fill:"rgba(50,150,255,0.046)" },
  { cx:848, cy:598, rx:168, ry:70, fill:"rgba(125,85,255,0.034)" },
];

const BELT_MID = 226;
const ASTEROIDS = Array.from({ length: 105 }, (_, i) => {
  const a = (i / 105) * Math.PI * 2 + Math.sin(i * 7.31) * 0.07;
  const r = BELT_MID + Math.abs(Math.sin(i * 13.7)) * 32 - 16;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) * 0.55, s: 0.48 + (i % 6) * 0.15, op: 0.14 + (i % 9) * 0.04 };
});

// Sun solar prominence paths (curved arcs above surface — no spiky rays)
const PROMINENCES = [
  { d: (r: number) => `M ${CX - r * 0.6},${CY - r * 0.78} Q ${CX - r * 1.4},${CY - r * 1.7} ${CX + r * 0.1},${CY - r * 0.85}`,  delay: "0s",   dur: "3.5s" },
  { d: (r: number) => `M ${CX + r * 0.72},${CY + r * 0.4} Q ${CX + r * 1.65},${CY - r * 0.3} ${CX + r * 0.8},${CY - r * 0.5}`, delay: "1.8s",  dur: "4.2s" },
  { d: (r: number) => `M ${CX - r * 0.4},${CY + r * 0.85} Q ${CX - r * 1.3},${CY + r * 1.6} ${CX + r * 0.3},${CY + r * 0.9}`,  delay: "0.9s",  dur: "3.8s" },
];

// ── Static star layer (never re-renders after mount) ──────────
const StarLayer = React.memo(function StarLayer() {
  return (
    <>
      <g pointerEvents="none" shapeRendering="optimizeSpeed">
        {STAR_FIELD.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="white" opacity={s.op} />
        ))}
      </g>
      <g pointerEvents="none">
        {TWINKLERS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.c} style={{ animation: `twinkle ${s.t} ease-in-out ${s.d} infinite` }} />
        ))}
      </g>
      <g pointerEvents="none">
        {NEBULAS.map((n, i) => (
          <ellipse key={i} cx={n.cx} cy={n.cy} rx={n.rx} ry={n.ry} fill={n.fill} filter="url(#neb-blur)" />
        ))}
      </g>
    </>
  );
});

// ── Component ─────────────────────────────────────────────────
export function SolarSystemView({ onSelectPlanet, onOpenSettings, onOpenControlCenter, onOpenMetaphorGuide, activePlanetId, refreshKey }: Props) {
  const [planets, setPlanets]         = useState<Planet[]>([]);
  const [newName, setNewName]         = useState("");
  const [adding, setAdding]           = useState(false);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [hoveredId, setHoveredId]     = useState<string | null>(null);
  const [hoveredMoon, setHoveredMoon] = useState<string | null>(null);
  const [sunHovered, setSunHovered]   = useState(false);
  const [launching, setLaunching]     = useState(false);
  // Planet creation animation state
  const [creationTarget, setCreationTarget] = useState<{ x: number; y: number; name: string } | null>(null);
  const [showSpaceship, setShowSpaceship]   = useState(false);
  const [creationPhase, setCreationPhase]   = useState<"idle" | "forming" | "spaceship" | "done">("idle");
  // Comet notifications
  const [cometQueue, _setCometQueue] = useState<Array<{ id: string; type: "email" | "calendar" | "task" | "alert"; targetX: number; targetY: number; urgent?: boolean }>>([]);
  // Sun AI state
  const [sunAiState, _setSunAiState] = useState<"idle" | "processing" | "tool_use" | "success" | "error">("idle");
  const [zoom, setZoom]               = useState(1);
  const [pan, setPan]                 = useState({ x: 0, y: 0 });
  const [notifOpen, setNotifOpen]     = useState(false);
  const [briefings, setBriefings]     = useState<Array<{ planet: Planet; text: string }>>([]);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [gmailConnected, setGmailConnected] = useState(false);

  const anglesRef   = useRef<Map<string, number>>(new Map());
  const moonsRef    = useRef<Map<string, number>>(new Map());
  const rafRef      = useRef<number>(0);
  const lastRef     = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const panRef      = useRef({ x: 0, y: 0 });
  const zoomRef     = useRef(1);
  const dragRef     = useRef({ active: false, moved: false, sx: 0, sy: 0, px: 0, py: 0 });
  const [grabbing, setGrabbing] = useState(false);
  const [, setTick] = useState(0);

  const load = async () => {
    try {
      const data = await api.getPlanets();
      // Auto-diversify: assign a type to any planet missing one or defaulting to "terra"
      // Uses planet index to cycle through all 7 types so every planet looks different
      for (let i = 0; i < data.length; i++) {
        if (!data[i].planet_type || data[i].planet_type === "terra") {
          data[i].planet_type = PLANET_TYPE_CYCLE[i % PLANET_TYPE_CYCLE.length];
        }
      }
      setPlanets(data);
      setError(null);
    }
    catch { setError("Can't reach agent service — is it running?"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [refreshKey]);

  useEffect(() => {
    api.getIntegrations().then(setIntegrations).catch(() => {});
    api.getGmailStatus().then(s => setGmailConnected(s.connected)).catch(() => {});
  }, []);

  useEffect(() => {
    if (planets.length === 0) return;
    planets.forEach((p, i) => {
      if (!anglesRef.current.has(p.id)) anglesRef.current.set(p.id, (i * 137.5 * Math.PI) / 180);
      if (!moonsRef.current.has(p.id))  moonsRef.current.set(p.id,  (i * 72 * Math.PI) / 180);
    });
    const animate = (now: number) => {
      const dt = lastRef.current ? (now - lastRef.current) / 1000 : 0;
      lastRef.current = now;
      planets.forEach((p, i) => {
        anglesRef.current.set(p.id, (anglesRef.current.get(p.id) ?? 0) + (2 * Math.PI / ORBIT_SPEEDS[i % ORBIT_SPEEDS.length]) * dt);
        moonsRef.current.set(p.id,  (moonsRef.current.get(p.id)  ?? 0) + (2 * Math.PI / MOON_SPEEDS[i % MOON_SPEEDS.length]) * dt);
      });
      setTick(n => n + 1);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    // Pause the animation loop when the window is not visible to save CPU/GPU.
    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
        lastRef.current = 0; // reset so dt doesn't spike on resume
      } else {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [planets]);

  // ── Zoom to cursor ────────────────────────────────────────
  const handleWheel = useCallback((e: WheelEvent) => {
    // Don't zoom when scrolling inside the briefings panel
    const briefingsPanel = containerRef.current?.querySelector("[data-briefings-panel]");
    if (briefingsPanel?.contains(e.target as Node)) return;
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ex = (e.clientX - rect.left) / rect.width;   // 0..1
    const ey = (e.clientY - rect.top)  / rect.height;  // 0..1
    const cos20 = Math.cos(20 * Math.PI / 180);

    setZoom(prev => {
      const factor  = Math.exp(-e.deltaY * 0.0012);
      const newZoom = Math.min(8.0, Math.max(0.08, prev * factor));
      zoomRef.current = newZoom;
      setPan(pp => {
        const np = {
          x: pp.x + (ex - 0.5) * 1000 * (1/newZoom - 1/prev),
          y: pp.y + (ey - 0.5) / cos20 * 700 * (1/newZoom - 1/prev),
        };
        panRef.current = np;
        return np;
      });
      return newZoom;
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Keep panRef and zoomRef in sync so drag handlers don't have stale closures
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // ── Drag to pan (no pointer capture — preserves child click events) ───
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let sx = 0, sy = 0, px = 0, py = 0, didDrag = false;

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (!didDrag && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        didDrag = true;
        setGrabbing(true);
      }
      if (didDrag) {
        const rect = containerRef.current?.getBoundingClientRect();
        const cw = rect?.width  ?? 1200;
        const ch = rect?.height ?? 800;
        const z  = zoomRef.current;
        const newPan = { x: px + dx * (1000 / z) / cw, y: py + dy * (700 / z) / ch };
        panRef.current = newPan;
        setPan(newPan);
      }
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      dragRef.current.active = false;
      dragRef.current.moved  = didDrag;
      if (didDrag) {
        setGrabbing(false);
        // One-shot capture-phase listener suppresses the upcoming click on any child
        document.addEventListener("click", (e) => e.stopPropagation(), { once: true, capture: true });
      }
      didDrag = false;
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const tag = (e.target as Element).tagName;
      if (tag === "BUTTON" || tag === "INPUT" || tag === "TEXTAREA") return;
      sx = e.clientX; sy = e.clientY;
      px = panRef.current.x; py = panRef.current.y;
      didDrag = false;
      dragRef.current.active = true;
      dragRef.current.moved  = false;
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup",   onUp, { once: true });
    };

    el.addEventListener("pointerdown", onDown);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointermove", onMove);
    };
  }, []);

  const handleCreate = async () => {
    if (!newName.trim() || launching) return;
    const name = newName.trim();
    setLaunching(true); setAdding(false); setNewName("");

    // Calculate where this planet will orbit
    const idx = planets.length;
    const orbitR = ORBIT_BASE + idx * ORBIT_GAP;
    const angle = (idx * 137.5 * Math.PI) / 180;
    const tx = CX + orbitR * Math.cos(angle);
    const ty = CY + orbitR * Math.sin(angle);

    // Start formation animation
    setCreationTarget({ x: tx, y: ty, name });
    setCreationPhase("forming");

    // Wait for formation animation to complete, then create the planet
    // The animation calls onReveal → we create the planet there
    // and onComplete → we launch the spaceship
  };

  const handleCreationReveal = useCallback(async () => {
    // Planet appears — actually create it in the backend
    const name = creationTarget?.name;
    if (!name) return;
    try {
      const planetType = PLANET_TYPE_CYCLE[planets.length % PLANET_TYPE_CYCLE.length];
      const cfg = TC[planetType] ?? TC_DEFAULT;
      await api.createPlanet(name, cfg.glow, planetType);
      await load();
    } catch { /* creation failed */ }
  }, [creationTarget, planets.length]);

  const handleCreationComplete = useCallback(() => {
    // Formation done — launch spaceship
    setCreationPhase("spaceship");
    setShowSpaceship(true);
  }, []);

  const handleSpaceshipComplete = useCallback(() => {
    // Spaceship landed — all done
    setShowSpaceship(false);
    setCreationPhase("done");
    setCreationTarget(null);
    setLaunching(false);

    // Open the chat panel for the new planet with arrival message
    if (planets.length > 0) {
      const newPlanet = planets[planets.length - 1];
      if (newPlanet) {
        onSelectPlanet(newPlanet);
      }
    }

    setTimeout(() => setCreationPhase("idle"), 500);
  }, [planets, onSelectPlanet]);


  const fetchBriefings = async () => {
    if (briefingLoading || planets.length === 0) return;
    setBriefingLoading(true); setNotifOpen(true);
    try {
      const results = await Promise.all(planets.map(async p => {
        try { return { planet: p, text: (await api.getBriefing(p.id)).briefing }; }
        catch { return { planet: p, text: "Unable to load briefing." }; }
      }));
      setBriefings(results);
    } finally { setBriefingLoading(false); }
  };

  const timeStr = new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", second:"2-digit" });

  return (
    <div
      ref={containerRef}
      style={{ position:"relative", width:"100%", height:"100vh", userSelect:"none", overflow:"hidden", cursor: grabbing ? "grabbing" : "grab", background:"#07070f" }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ position:"absolute", top:"20px", left:"24px", zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ width:"28px", height:"28px", borderRadius:"50%", flexShrink:0, background:"radial-gradient(circle at 36% 30%, #fff9c4, #FFD700 55%, #f97316)", boxShadow:"0 0 22px rgba(245,158,11,0.65), 0 0 50px rgba(245,158,11,0.18)", animation:"sun-pulse 4s ease-in-out infinite" }} />
          <div>
            <h1 style={{ color:"var(--sun-color)", letterSpacing:"0.2em", fontSize:"0.92rem", fontWeight:600, margin:0, textShadow:"0 0 14px rgba(245,158,11,0.7)" }}>SOLAR AI OS</h1>
            <p style={{ color:"var(--text-dim)", letterSpacing:"0.12em", fontSize:"0.60rem", margin:"2px 0 0 0" }}>{planets.length} MISSION{planets.length !== 1 ? "S" : ""} IN ORBIT</p>
          </div>
        </div>
      </div>

      {/* ── Top-right controls ──────────────────────────────── */}
      <div style={{ position:"absolute", top:"18px", right:"22px", zIndex:10, display:"flex", alignItems:"center", gap:"8px" }}>
        {/* Metaphor guide */}
        <button onClick={onOpenMetaphorGuide}
          style={{ padding:"7px", borderRadius:"8px", cursor:"pointer", color:"rgba(167,139,250,0.6)", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(167,139,250,0.1)", transition:"all 0.2s", display:"flex", alignItems:"center" }}
          onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = "var(--violet)"; b.style.borderColor = "rgba(167,139,250,0.35)"; }}
          onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = "rgba(167,139,250,0.6)"; b.style.borderColor = "rgba(167,139,250,0.1)"; }}
          title="Solar System Guide">
          <HelpCircle size={14} />
        </button>
        {/* Briefings */}
        <button onClick={() => notifOpen ? setNotifOpen(false) : fetchBriefings()}
          style={{ display:"flex", alignItems:"center", gap:"6px", padding:"6px 12px", borderRadius:"8px", cursor:"pointer", fontSize:"10px", letterSpacing:"0.08em", fontFamily:"inherit", color: notifOpen ? "var(--sun-color)" : "var(--text-muted)", border:`1px solid ${notifOpen ? "rgba(245,158,11,0.35)" : "rgba(167,139,250,0.15)"}`, background: notifOpen ? "rgba(245,158,11,0.06)" : "rgba(255,255,255,0.02)", transition:"all 0.2s", position:"relative" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(245,158,11,0.4)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--sun-color)"; }}
          onMouseLeave={e => { if (!notifOpen) { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(167,139,250,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; } }}>
          <span style={{ fontSize:"12px" }}>◎</span> BRIEFINGS
          {briefings.length > 0 && !notifOpen && (
            <span style={{ position:"absolute", top:"-5px", right:"-5px", width:"15px", height:"15px", borderRadius:"50%", background:"var(--sun-color)", color:"#0a0508", fontSize:"8px", fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>{briefings.length}</span>
          )}
        </button>
        {/* Mission control */}
        <button onClick={onOpenControlCenter}
          style={{ display:"flex", alignItems:"center", gap:"6px", padding:"6px 12px", borderRadius:"8px", cursor:"pointer", fontSize:"10px", letterSpacing:"0.1em", fontFamily:"monospace", color:"#00ff41", border:"1px solid rgba(0,255,65,0.22)", background:"rgba(0,255,65,0.04)", transition:"all 0.2s" }}
          onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "rgba(0,255,65,0.1)"; b.style.borderColor = "rgba(0,255,65,0.5)"; }}
          onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "rgba(0,255,65,0.04)"; b.style.borderColor = "rgba(0,255,65,0.22)"; }}>
          <Radio size={10} /> HOUSTON
        </button>
        {/* Settings */}
        <button onClick={onOpenSettings}
          style={{ padding:"7px", borderRadius:"8px", cursor:"pointer", color:"var(--text-muted)", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(167,139,250,0.1)", transition:"all 0.2s", display:"flex", alignItems:"center" }}
          onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = "white"; b.style.borderColor = "rgba(167,139,250,0.3)"; }}
          onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = "var(--text-muted)"; b.style.borderColor = "rgba(167,139,250,0.1)"; }}>
          <Settings size={14} />
        </button>
      </div>

      {/* ── Error ───────────────────────────────────────────── */}
      {error && <div style={{ position:"absolute", top:"20px", left:"50%", transform:"translateX(-50%)", zIndex:20, padding:"8px 16px", borderRadius:"10px", fontSize:"12px", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.28)", color:"#fca5a5" }}>{error}</div>}

      {/* ── Launch overlay (text — only during initial forming) ──── */}
      {launching && creationPhase === "forming" && (
        <div style={{ position:"absolute", inset:0, zIndex:40, display:"flex", alignItems:"flex-end", justifyContent:"center", pointerEvents:"none", paddingBottom:"80px" }}>
          <div style={{ textAlign:"center", fontFamily:"monospace", animation:"fade-in 0.3s ease" }}>
            <div style={{ fontSize:"0.72rem", letterSpacing:"0.22em", color:"rgba(245,158,11,0.55)" }}>FORMING NEW WORLD…</div>
          </div>
        </div>
      )}

      {/* ── Briefings panel ─────────────────────────────────── */}
      {notifOpen && (
        <div data-briefings-panel style={{ position:"absolute", top:"55px", right:"6px", zIndex:20, width:"420px", maxHeight:"560px", background:"rgba(5,3,14,0.97)", backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)", border:"1px solid rgba(167,139,250,0.12)", borderRadius:"14px", boxShadow:"0 12px 50px rgba(0,0,0,0.65)", overflow:"hidden", display:"flex", flexDirection:"column" }} onWheel={(e: React.WheelEvent) => e.stopPropagation()}>
          <div style={{ padding:"14px 18px", borderBottom:"1px solid rgba(167,139,250,0.08)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
            <div>
              <span style={{ fontSize:"9px", letterSpacing:"0.18em", color:"var(--sun-color)", fontFamily:"monospace" }}>SOLAR BRIEFINGS</span>
              <p style={{ margin:"2px 0 0", fontSize:"9px", color:"var(--text-dim)", letterSpacing:"0.05em" }}>AI-generated mission intelligence</p>
            </div>
            <button onClick={() => setNotifOpen(false)} style={{ background:"none", border:"none", color:"var(--text-muted)", cursor:"pointer", fontSize:"18px", padding:"0 0 0 8px", lineHeight:1 }}>×</button>
          </div>
          <div style={{ overflowY:"auto", flex:1, padding:"10px" }}>
            {briefingLoading && (
              <div style={{ padding: "24px", display: "flex", gap: "5px", alignItems: "center", justifyContent: "center" }}>
                {[0, 150, 300].map((delay) => (
                  <span key={delay} style={{ width: "5px", height: "5px", borderRadius: "50%", background: "rgba(245,158,11,0.7)", display: "inline-block", animation: `dot-bounce 1.2s ease-in-out ${delay}ms infinite` }} />
                ))}
              </div>
            )}
            {!briefingLoading && briefings.length === 0 && <div style={{ padding:"24px", textAlign:"center", color:"var(--text-dim)", fontSize:"12px" }}>No missions in orbit yet.</div>}
            {!briefingLoading && briefings.map(({ planet, text }) => {
              const cfg = TC[planet.planet_type ?? 'terra'] ?? TC_DEFAULT;
              const civ = getCivLevel(planet);
              // Parse markdown bullets into structured items
              const lines = text.split("\n").filter(l => l.trim());
              return (
                <div key={planet.id} style={{ padding:"12px 14px", marginBottom:"8px", background:"rgba(255,255,255,0.022)", border:"1px solid rgba(167,139,250,0.08)", borderRadius:"12px" }}>
                  {/* Planet header */}
                  <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"10px", paddingBottom:"8px", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ width:"10px", height:"10px", borderRadius:"50%", background:`radial-gradient(circle at 33% 28%, ${cfg.hi}, ${cfg.mid})`, boxShadow:`0 0 8px ${cfg.glow}88`, flexShrink:0 }} />
                    <span style={{ fontSize:"11px", color:"white", fontWeight:600, letterSpacing:"0.04em" }}>{planet.name}</span>
                    <span style={{ fontSize:"8px", color:cfg.glow, fontFamily:"monospace", marginLeft:"auto", opacity:0.75 }}>{cfg.label}</span>
                    <span style={{ fontSize:"8px", color:CIV_DOT[civ], fontFamily:"monospace", opacity:0.85 }}>◈ {CIV_NAMES[civ]}</span>
                  </div>
                  {/* Parsed bullet points */}
                  <div style={{ display:"flex", flexDirection:"column", gap:"7px" }}>
                    {lines.map((line, li) => {
                      const mainM = line.match(/^[-•]\s*\*\*(.+?)\*\*[:\s]*(.*)/);
                      if (mainM) {
                        return (
                          <div key={li} style={{ display:"flex", gap:"8px", alignItems:"flex-start" }}>
                            <span style={{ color:"rgba(245,158,11,0.8)", fontSize:"7px", marginTop:"3px", flexShrink:0 }}>◆</span>
                            <div style={{ lineHeight:"1.55" }}>
                              <span style={{ color:"rgba(255,210,80,0.95)", fontWeight:600, fontSize:"11px" }}>{mainM[1]}: </span>
                              <span style={{ color:"rgba(255,255,255,0.68)", fontSize:"11px" }}>{mainM[2]}</span>
                            </div>
                          </div>
                        );
                      }
                      const subM = line.match(/^\s{2,}[-•]\s*(.*)/);
                      if (subM) {
                        return (
                          <div key={li} style={{ display:"flex", gap:"7px", alignItems:"flex-start", paddingLeft:"14px" }}>
                            <span style={{ color:"rgba(167,139,250,0.5)", fontSize:"7px", marginTop:"3px", flexShrink:0 }}>›</span>
                            <span style={{ color:"rgba(255,255,255,0.52)", fontSize:"10px", lineHeight:"1.5" }}>{subM[1]}</span>
                          </div>
                        );
                      }
                      const plainM = line.match(/^[-•]\s*(.*)/);
                      if (plainM) {
                        return (
                          <div key={li} style={{ display:"flex", gap:"8px", alignItems:"flex-start" }}>
                            <span style={{ color:"rgba(167,139,250,0.6)", fontSize:"7px", marginTop:"3px", flexShrink:0 }}>◆</span>
                            <span style={{ color:"rgba(255,255,255,0.65)", fontSize:"11px", lineHeight:"1.55" }}>{plainM[1].replace(/\*\*/g,"")}</span>
                          </div>
                        );
                      }
                      return line.trim() ? <div key={li} style={{ color:"rgba(255,255,255,0.45)", fontSize:"10px", paddingLeft:"2px" }}>{line.trim()}</div> : null;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Corner chrome — HTML overlay, always at screen edges ──── */}
      <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:2 }} preserveAspectRatio="none">
        <g stroke="rgba(245,158,11,0.22)" strokeWidth="1.2" fill="none">
          <path d="M20,52 L20,20 L52,20" /><path d="M calc(100% - 52px),20 L calc(100% - 20px),20 L calc(100% - 20px),52" />
          <path d="M20,calc(100% - 52px) L20,calc(100% - 20px) L52,calc(100% - 20px)" /><path d="M calc(100% - 52px),calc(100% - 20px) L calc(100% - 20px),calc(100% - 20px) L calc(100% - 20px),calc(100% - 52px)" />
        </g>
      </svg>

      {/* ── Status bar — always at screen bottom-right ──────────── */}
      <div style={{ position:"absolute", bottom:"14px", right:"18px", zIndex:10, fontFamily:"monospace", fontSize:"10px", letterSpacing:"0.14em", color:"rgba(245,158,11,0.55)", pointerEvents:"none", display:"flex", alignItems:"center", gap:"10px" }}>
        <span style={{ opacity:0.6 }}>SOLAR AI OS</span>
        <span style={{ color:"rgba(245,158,11,0.25)" }}>//</span>
        <span>{planets.length} IN ORBIT</span>
        <span style={{ color:"rgba(245,158,11,0.25)" }}>//</span>
        <span style={{ opacity:0.7 }}>{timeStr}</span>
      </div>

      {/* ── Zoom indicator ──────────────────────────────────── */}
      {zoom !== 1 && (
        <div style={{ position:"absolute", bottom:"36px", right:"18px", zIndex:10, fontFamily:"monospace", fontSize:"9px", letterSpacing:"0.15em", color:"rgba(245,158,11,0.35)", pointerEvents:"none" }}>
          {zoom > 1 ? "+" : ""}{Math.round((zoom - 1) * 100)}%  ·  scroll to zoom
        </div>
      )}

      {/* ── SVG ─────────────────────────────────────────────── */}
      <svg
        viewBox={`${CX - pan.x - 500/zoom} ${CY - pan.y - 350/zoom} ${1000/zoom} ${700/zoom}`}
        style={{
          width:"100%", height:"100%", zIndex:1,
          transform:`perspective(1500px) rotateX(20deg)`,
          transformOrigin:"center center",
          willChange:"contents",
        }}
      >
        {/* Infinite-feeling background — fills space beyond viewBox when panning */}
        <rect x="-9000" y="-9000" width="19000" height="19000" fill="#07070f" />
        <ellipse cx="-1000" cy="800" rx="1800" ry="900" fill="rgba(125,45,245,0.028)" filter="url(#neb-blur)" />
        <ellipse cx="2100" cy="-400" rx="1600" ry="700" fill="rgba(245,158,11,0.022)" filter="url(#neb-blur)" />
        <defs>
          {/* Filters */}
          <filter id="sun-glow"   x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="neb-blur"   x="-60%" y="-60%"  width="220%" height="220%"><feGaussianBlur in="SourceGraphic" stdDeviation="30" /></filter>
          <filter id="moon-glow"  x="-80%" y="-80%"  width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="sat-glow"   x="-80%" y="-80%"  width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* Sun: granulation texture via feTurbulence */}
          <filter id="sun-granule" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="turbulence" baseFrequency="0.08 0.065" numOctaves="5" seed="12" result="turb" />
            <feColorMatrix in="turb" type="matrix"
              values="1.4 0 0 0 -0.05
                      0.6 0 0 0  0.05
                      0   0 0 0  0
                      0   0 0 0.40 0"
              result="amber" />
            <feComposite in="amber" in2="SourceGraphic" operator="in" result="masked" />
            <feBlend in="SourceGraphic" in2="masked" mode="soft-light" />
          </filter>

          {/* Sun: outer corona smooth glow */}
          <radialGradient id="sun-corona-grad" cx="50%" cy="50%" r="50%">
            <stop offset="55%"  stopColor="rgba(255,180,30,0)"   />
            <stop offset="80%"  stopColor="rgba(255,150,20,0.15)" />
            <stop offset="100%" stopColor="rgba(255,120,10,0)"   />
          </radialGradient>

          {/* Sun core gradient — 3D sphere, no rays */}
          <radialGradient id="sun-core" cx="34%" cy="28%" r="72%">
            <stop offset="0%"   stopColor="#fffbe0" />
            <stop offset="28%"  stopColor="#FFD700" />
            <stop offset="60%"  stopColor="#f59e0b" />
            <stop offset="82%"  stopColor="#d06010" />
            <stop offset="100%" stopColor="#8a2800" />
          </radialGradient>
          {/* Sun limb-darkening overlay */}
          <radialGradient id="sun-limb" cx="50%" cy="50%" r="50%">
            <stop offset="58%"  stopColor="rgba(0,0,0,0)"   />
            <stop offset="88%"  stopColor="rgba(0,0,0,0.28)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.52)" />
          </radialGradient>
          {/* Sun chromosphere */}
          <radialGradient id="sun-chroma" cx="50%" cy="50%" r="50%">
            <stop offset="78%"  stopColor="rgba(255,100,20,0)"    />
            <stop offset="92%"  stopColor="rgba(255,80,15,0.22)"  />
            <stop offset="100%" stopColor="rgba(200,40,5,0.38)"   />
          </radialGradient>

          {/* Gas giant bands */}
          <linearGradient id="gas-bands" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#2a0e00" stopOpacity="0"    />
            <stop offset="16%"  stopColor="#5c2500" stopOpacity="0.36" />
            <stop offset="30%"  stopColor="#2a0e00" stopOpacity="0"    />
            <stop offset="44%"  stopColor="#6b3010" stopOpacity="0.42" />
            <stop offset="58%"  stopColor="#2a0e00" stopOpacity="0"    />
            <stop offset="72%"  stopColor="#3d1800" stopOpacity="0.30" />
            <stop offset="86%"  stopColor="#2a0e00" stopOpacity="0"    />
            <stop offset="100%" stopColor="#4a2008" stopOpacity="0.24" />
          </linearGradient>
          <linearGradient id="ice-cracks" x1="0.15" y1="0" x2="0.88" y2="1">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.32)" />
            <stop offset="50%"  stopColor="rgba(200,238,255,0.12)" />
            <stop offset="100%" stopColor="rgba(100,185,255,0)"    />
          </linearGradient>

          {/* Moon gradients per type — proper 3D sphere, NOT a crescent */}
          {PLANET_TYPE_CYCLE.map(ptype => {
            const cfg = TC[ptype] ?? TC_DEFAULT;
            return (
              <radialGradient key={`moon-${ptype}`} id={`moon-${ptype}`} cx="32%" cy="28%" r="70%">
                <stop offset="0%"   stopColor="#f0f2f5"   stopOpacity="0.90" />
                <stop offset="18%"  stopColor={cfg.moonBase} stopOpacity="1"   />
                <stop offset="62%"  stopColor={cfg.moonMid}  stopOpacity="1"   />
                <stop offset="86%"  stopColor="#181820"   stopOpacity="0.88" />
                <stop offset="100%" stopColor="#08080f"   stopOpacity="0.95" />
              </radialGradient>
            );
          })}

          {/* Per-planet sphere + atmo gradients */}
          {planets.map((planet) => {
            const cfg = TC[planet.planet_type ?? 'terra'] ?? TC_DEFAULT;
            return (
              <React.Fragment key={`defs-${planet.id}`}>
                <radialGradient id={`sph-${planet.id}`} cx="30%" cy="24%" r="72%">
                  <stop offset="0%"   stopColor="#ffffff"  stopOpacity="0.98" />
                  <stop offset="5%"   stopColor={cfg.hi}   stopOpacity="0.94" />
                  <stop offset="38%"  stopColor={cfg.mid}  stopOpacity="1.00" />
                  <stop offset="75%"  stopColor={cfg.lo}   stopOpacity="1.00" />
                  <stop offset="90%"  stopColor="#020210"  stopOpacity="0.82" />
                  <stop offset="100%" stopColor="#000008"  stopOpacity="0.94" />
                </radialGradient>
                <radialGradient id={`atm-${planet.id}`} cx="50%" cy="50%" r="50%">
                  <stop offset="44%"  stopColor={cfg.hi}  stopOpacity="0"    />
                  <stop offset="80%"  stopColor={cfg.hi}  stopOpacity="0.10" />
                  <stop offset="100%" stopColor={cfg.hi}  stopOpacity="0.55" />
                </radialGradient>
              </React.Fragment>
            );
          })}
        </defs>

        {/* Star field — memoized so it never re-renders during the 60fps animation loop */}
        <StarLayer />

        {/* Corner chrome removed — was in SVG coordinate space and created a visible rectangular border when zoomed out */}

        {/* Asteroid belt label */}
        {zoom > 0.6 && zoom < 3 && (
          <text x={CX + BELT_MID + 24} y={CY - 9} fill="rgba(180,162,132,0.30)" fontSize="6.5" letterSpacing="1.5" fontFamily="monospace">THE NOISE</text>
        )}

        {/* Asteroids */}
        {ASTEROIDS.map((a, i) => <circle key={`ast${i}`} cx={a.x} cy={a.y} r={a.s} fill="rgba(178,162,132,1)" opacity={a.op} />)}

        {/* Orbit rings — activity-encoded colors */}
        {planets.map((planet, i) => {
          const r = ORBIT_BASE + i * ORBIT_GAP;
          const activity = getActivityLevel(planet.last_activity_at);
          // Activity-based orbit styling
          let orbitStroke: string;
          let orbitOpacity: number;
          let orbitWidth: number;
          let orbitDash: string;
          if (activity === "hot") {
            orbitStroke = "rgba(255,215,0,1)"; orbitOpacity = 0.8; orbitWidth = 1.8; orbitDash = "none";
          } else if (activity === "warm") {
            orbitStroke = "rgba(74,158,255,1)"; orbitOpacity = 0.5; orbitWidth = 1.3; orbitDash = "none";
          } else {
            // Check if dormant (>30 days)
            const lastAct = planet.last_activity_at ? Date.now() - new Date(planet.last_activity_at).getTime() : Infinity;
            const dormant = lastAct > 30 * 24 * 60 * 60 * 1000;
            if (dormant) {
              orbitStroke = "rgba(100,90,70,1)"; orbitOpacity = 0.25; orbitWidth = 0.6; orbitDash = "4 8";
            } else {
              orbitStroke = "rgba(200,180,120,1)"; orbitOpacity = 0.35; orbitWidth = 0.8; orbitDash = "3 10";
            }
          }
          return (
            <g key={`orb${i}`}>
              <circle cx={CX} cy={CY} r={r} fill="none"
                stroke={orbitStroke} strokeWidth={orbitWidth} strokeDasharray={orbitDash}
                opacity={orbitOpacity}
                style={{ transition: "all 1s ease" }}
              />
              {/* Pulse ring for hot planets */}
              {activity === "hot" && (
                <circle cx={CX} cy={CY} r={r} fill="none"
                  stroke="rgba(255,215,0,0.3)" strokeWidth={3}
                  opacity={0.3}
                  style={{ animation: "pulse 3s ease-in-out infinite" }}
                />
              )}
            </g>
          );
        })}

        {/* Connection lines */}
        {planets.map((planet, i) => {
          const angle = anglesRef.current.get(planet.id) ?? (i * 137.5 * Math.PI) / 180;
          const r = ORBIT_BASE + i * ORBIT_GAP;
          const cfg = TC[planet.planet_type ?? 'terra'] ?? TC_DEFAULT;
          return <line key={`conn${planet.id}`} x1={CX} y1={CY} x2={CX + r * Math.cos(angle)} y2={CY + r * Math.sin(angle)} stroke={cfg.glow} strokeWidth="0.32" strokeOpacity="0.09" strokeDasharray="2.5 8" />;
        })}

        {/* ── SUN — realistic 3D sphere, no spiky rays ───────── */}
        <g
          data-sun
          style={{ cursor:"pointer" }}
          onClick={() => { soundManager.play("ui_click"); onSelectPlanet({ id:"sun", name:"Solar — Your AI Brain", status:"active", orbit_radius:0, color:"#FFD700", created_at:"" }); }}
          onMouseEnter={() => { soundManager.play("ui_hover"); setSunHovered(true); }}
          onMouseLeave={() => setSunHovered(false)}
        >
          {/* Outer diffuse corona — smooth glow, not rays */}
          <circle cx={CX} cy={CY} r={sunHovered ? 115 : 98} fill="url(#sun-corona-grad)" opacity={0.9} style={{ transition:"r 0.5s" }} />
          <circle cx={CX} cy={CY} r={sunHovered ? 82 : 72} fill="#f59e0b" opacity={0.030} style={{ transition:"r 0.5s" }} filter="url(#sun-glow)" />
          <circle cx={CX} cy={CY} r={sunHovered ? 62 : 56} fill="#FFD700" opacity={0.060} style={{ transition:"r 0.5s" }} filter="url(#sun-glow)" />

          {/* Plasma energy rings — pulse outward like real solar wind */}
          {[0, 1.1, 2.2].map((delay, k) => (
            <circle key={`pulse${k}`} cx={CX} cy={CY} r={SUN_R}
              fill="none" stroke="rgba(255,170,30,0.55)" strokeWidth="2.5"
              style={{ animation:`pulse-ring 3.5s ease-out ${delay}s infinite`, transformOrigin:`${CX}px ${CY}px`, transformBox:"fill-box" }}
            />
          ))}

          {/* Chromosphere (reddish ring just outside surface) */}
          <circle cx={CX} cy={CY} r={SUN_R + 5} fill="none" stroke="rgba(255,80,20,0.25)" strokeWidth="6" />

          {/* Solar prominences — curved plasma arcs at surface edge */}
          {PROMINENCES.map((p, k) => (
            <path key={`prom${k}`} d={p.d(SUN_R)}
              fill="none" stroke="rgba(255,110,25,0.50)" strokeWidth="2.2" strokeLinecap="round"
              style={{ animation:`pulse ${p.dur} ease-in-out ${p.delay} infinite` }}
            />
          ))}

          {/* 3D sphere body with granulation filter */}
          <circle cx={CX} cy={CY} r={SUN_R} fill="url(#sun-core)" filter="url(#sun-granule)" />
          {/* Limb darkening overlay */}
          <circle cx={CX} cy={CY} r={SUN_R} fill="url(#sun-limb)" style={{ pointerEvents:"none" }} />
          {/* Chromosphere atmosphere rim */}
          <circle cx={CX} cy={CY} r={SUN_R} fill="url(#sun-chroma)" style={{ pointerEvents:"none" }} />
          {/* Specular highlight — light source from upper-left */}
          <circle cx={CX - SUN_R * 0.3} cy={CY - SUN_R * 0.35} r={SUN_R * 0.22}
            fill="rgba(255,255,220,0.28)" style={{ pointerEvents:"none", filter:"blur(3px)" }} />
          {/* Sunspots */}
          <circle cx={CX - 14} cy={CY + 10} r={6.5} fill="rgba(140,60,0,0.40)" style={{ pointerEvents:"none" }} />
          <circle cx={CX + 16} cy={CY - 8}  r={4.5} fill="rgba(140,60,0,0.32)" style={{ pointerEvents:"none" }} />
          <circle cx={CX + 6}  cy={CY + 18} r={3.0} fill="rgba(140,60,0,0.28)" style={{ pointerEvents:"none" }} />

          {/* Sun label pill */}
          {(() => {
            const lbl  = sunHovered ? "YOUR AI BRAIN" : "SOLAR";
            const lw   = lbl.length * 7.2 + 22;
            const ly   = CY + SUN_R + 14;
            return (
              <g style={{ pointerEvents:"none" }}>
                <rect x={CX - lw/2} y={ly} width={lw} height={18} rx={9}
                  fill={sunHovered ? "rgba(245,158,11,0.22)" : "rgba(0,0,0,0.55)"}
                  stroke={sunHovered ? "rgba(245,158,11,0.45)" : "rgba(245,158,11,0.18)"}
                  strokeWidth={0.8} />
                <text x={CX} y={ly + 12.5} textAnchor="middle"
                  fill={sunHovered ? "rgba(255,210,80,1)" : "rgba(245,158,11,0.85)"}
                  fontSize="10" letterSpacing="2" fontFamily="monospace" fontWeight="600">
                  {lbl}
                </text>
              </g>
            );
          })()}
        </g>

        {/* ── Integration satellites — orbit the Sun for each connected integration ── */}
        {[
          ...(gmailConnected ? [{ id:"gmail", name:"GMAIL", color:"#a8c4e0", orbitR:80, speed:14 }] : []),
          ...integrations.filter(ig => ig.enabled).map((ig, k) => ({
            id: ig.id, name: ig.name.toUpperCase(),
            color: k === 0 ? "#7dd3fc" : k === 1 ? "#86efac" : "#c4b5fd",
            orbitR: 105 + k * 24, speed: 22 + k * 7,
          })),
        ].map(sat => {
          const satAngle = ((Date.now() / 1000) / sat.speed) * Math.PI * 2;
          const sx = CX + sat.orbitR * Math.cos(satAngle);
          const sy = CY + sat.orbitR * Math.sin(satAngle) * 0.58;
          // Rotate satellite to face direction of travel
          const ux = -Math.sin(satAngle);
          const uy =  Math.cos(satAngle) * 0.58;
          const ang = Math.atan2(uy, ux) * 180 / Math.PI;
          return (
            <g key={sat.id} style={{ pointerEvents:"none" }}>
              {/* Orbit ring */}
              <ellipse cx={CX} cy={CY} rx={sat.orbitR} ry={sat.orbitR * 0.58}
                fill="none" stroke={`${sat.color}1a`} strokeWidth="0.6" strokeDasharray="2 8" />
              {/* Satellite — cross shape: body + two solar wing panels */}
              <g transform={`rotate(${ang}, ${sx}, ${sy})`}>
                {/* Main body box */}
                <rect x={sx - 3.5} y={sy - 2} width={7} height={4} rx={0.8}
                  fill={sat.color} opacity={0.90} />
                {/* Left solar panel */}
                <rect x={sx - 12} y={sy - 1.2} width={7} height={2.4} rx={0.5}
                  fill={sat.color} opacity={0.55} />
                {/* Right solar panel */}
                <rect x={sx + 5}   y={sy - 1.2} width={7} height={2.4} rx={0.5}
                  fill={sat.color} opacity={0.55} />
                {/* Panel dividers (gives it a solar-cell grid look) */}
                <line x1={sx - 9.5} y1={sy - 1.2} x2={sx - 9.5} y2={sy + 1.2}
                  stroke={`${sat.color}60`} strokeWidth="0.5" />
                <line x1={sx + 8.5} y1={sy - 1.2} x2={sx + 8.5} y2={sy + 1.2}
                  stroke={`${sat.color}60`} strokeWidth="0.5" />
                {/* Antenna dish on top of body */}
                <line x1={sx} y1={sy - 2} x2={sx} y2={sy - 5}
                  stroke={sat.color} strokeWidth="0.7" opacity={0.7} />
                <circle cx={sx} cy={sy - 5.5} r={1.2}
                  fill="none" stroke={sat.color} strokeWidth="0.7" opacity={0.7} />
              </g>
              {/* Glow */}
              <circle cx={sx} cy={sy} r={8} fill={sat.color} opacity={0.07} />
              {/* Label */}
              <text x={sx} y={sy - 14} textAnchor="middle"
                fill={sat.color} fontSize="5" letterSpacing="0.8" fontFamily="monospace" opacity={0.7}>
                {sat.name}
              </text>
            </g>
          );
        })}

        {/* ── Planets ───────────────────────────────────────── */}
        {planets.map((planet, i) => {
          const ptype  = planet.planet_type ?? 'terra';
          const cfg    = TC[ptype] ?? TC_DEFAULT;
          const orbitR = ORBIT_BASE + i * ORBIT_GAP;
          const angle  = anglesRef.current.get(planet.id) ?? (i * 137.5 * Math.PI) / 180;
          const px     = CX + orbitR * Math.cos(angle);
          const py     = CY + orbitR * Math.sin(angle);
          const isHov  = hoveredId === planet.id;
          const isAct  = activePlanetId === planet.id;
          const r      = cfg.r * (isHov ? 1.12 : 1);

          // Moon (proper sphere — NOT crescent)
          const moonAngle = moonsRef.current.get(planet.id) ?? 0;
          const moonOrbit = cfg.r * 1.9 + 16;
          const mx        = px + moonOrbit * Math.cos(moonAngle);
          const my        = py + moonOrbit * Math.sin(moonAngle);
          const moonVR    = Math.max(3.2, cfg.r * 0.30);
          const moonHov   = hoveredMoon === planet.id;

          // Rings — void (jupiter) gets wider rings
          const ringRX = cfg.r * (ptype === "void" ? 2.65 : 2.12);
          const ringRY = cfg.r * (ptype === "void" ? 0.46 : 0.36);

          // Civilization (time-based)
          const civ = getCivLevel(planet);

          // Zoom-based opacity for civilization details
          const civGlowAlpha  = Math.min(1, Math.max(0, (zoom - 0.75) / 0.4));
          const civDotAlpha   = Math.min(1, Math.max(0, (zoom - 1.10) / 0.5));
          const civBldgAlpha  = Math.min(1, Math.max(0, (zoom - 1.80) / 0.6));
          const civFineAlpha  = Math.min(1, Math.max(0, (zoom - 3.00) / 0.8));

          // City position (dayside — lower-right of sphere)
          const cbx = px + r * 0.28;
          const cby = py + r * 0.24;
          const sc  = r / 16; // scale relative to base planet r=16

          return (
            <g key={planet.id}>
              {/* Selection rings */}
              {isAct && (
                <>
                  <circle cx={px} cy={py} r={r+26} fill="none" stroke={cfg.glow} strokeWidth="0.5" strokeDasharray="2 5" opacity={0.35} />
                  <circle cx={px} cy={py} r={r+18} fill="none" stroke={cfg.glow} strokeWidth="0.8" strokeDasharray="4 3" opacity={0.22} />
                </>
              )}

              {/* Ambient halo */}
              <circle cx={px} cy={py} r={r+16} fill={cfg.glow}
                opacity={isAct ? 0.18 : isHov ? 0.12 : 0.05}
                style={{ filter:`blur(${isAct ? 7 : 5}px)`, transition:"opacity 0.25s" }}
              />

              {/* Activity glow — based on last_activity_at */}
              {(() => {
                const activity = getActivityLevel(planet.last_activity_at);
                if (activity === 'hot') {
                  return (
                    <circle cx={px} cy={py} r={r + 22} fill={cfg.glow}
                      style={{
                        filter: `blur(8px)`,
                        animation: 'planet-glow-pulse 2s ease-in-out infinite',
                        pointerEvents: 'none',
                      }}
                    />
                  );
                }
                if (activity === 'warm') {
                  return (
                    <circle cx={px} cy={py} r={r + 18} fill={cfg.glow}
                      opacity={0.4}
                      style={{ filter: `blur(6px)`, pointerEvents: 'none' }}
                    />
                  );
                }
                return null;
              })()}

              {/* Inline clip paths */}
              <defs>
                <clipPath id={`cp-${planet.id}`}><circle cx={px} cy={py} r={r} /></clipPath>
                <clipPath id={`moon-cp-${planet.id}`}><circle cx={mx} cy={my} r={moonVR} /></clipPath>
                <clipPath id={`ring-bk-${planet.id}`}><rect x={px - ringRX - 6} y={py - ringRY - 14} width={(ringRX + 6) * 2} height={ringRY + 14} /></clipPath>
                <clipPath id={`ring-ft-${planet.id}`}><rect x={px - ringRX - 6} y={py}               width={(ringRX + 6) * 2} height={ringRY + 14} /></clipPath>
              </defs>

              {/* Ring back half */}
              {cfg.rings !== "none" && (
                <>
                  <ellipse cx={px} cy={py} rx={ringRX} ry={ringRY} fill="none" stroke={cfg.ringA} strokeWidth={ptype === "void" ? 10 : 4} clipPath={`url(#ring-bk-${planet.id})`} />
                  {ptype === "void" && <ellipse cx={px} cy={py} rx={ringRX * 0.80} ry={ringRY * 0.80} fill="none" stroke={cfg.ringB} strokeWidth="5" clipPath={`url(#ring-bk-${planet.id})`} />}
                </>
              )}

              {/* Planet sphere */}
              <circle cx={px} cy={py} r={r} fill={`url(#sph-${planet.id})`}
                style={{ cursor:"pointer", filter:`drop-shadow(0 0 ${isAct ? 18 : isHov ? 13 : 7}px ${cfg.glow}90)`, transition:"r 0.18s" }}
                onClick={() => { soundManager.play("ui_click"); onSelectPlanet(planet); }}
                onMouseEnter={() => { soundManager.play("ui_hover"); setHoveredId(planet.id); }}
                onMouseLeave={() => setHoveredId(null)}
              />

              {/* Surface textures — matched to planet_type */}
              {ptype === "void" && <rect x={px-r} y={py-r} width={r*2} height={r*2} fill="url(#gas-bands)" clipPath={`url(#cp-${planet.id})`} style={{ pointerEvents:"none" }} />}
              {ptype === "oasis" && <rect x={px-r} y={py-r} width={r*2} height={r*2} fill="url(#ice-cracks)" clipPath={`url(#cp-${planet.id})`} style={{ pointerEvents:"none" }} />}
              {ptype === "citadel" && <>
                <circle cx={px - r*0.28} cy={py + r*0.32} r={r*0.24} fill="rgba(255,180,40,0.28)" clipPath={`url(#cp-${planet.id})`} style={{ pointerEvents:"none" }} />
                <circle cx={px + r*0.38} cy={py - r*0.18} r={r*0.18} fill="rgba(255,160,20,0.22)" clipPath={`url(#cp-${planet.id})`} style={{ pointerEvents:"none" }} />
              </>}
              {(ptype === "terra" || ptype === "gaia") && <>
                <circle cx={px - r*0.22} cy={py - r*0.12} r={r*0.32} fill={ptype === "gaia" ? "rgba(40,130,20,0.28)" : "rgba(50,110,25,0.24)"}  clipPath={`url(#cp-${planet.id})`} style={{ pointerEvents:"none" }} />
                <circle cx={px + r*0.28} cy={py + r*0.28} r={r*0.26} fill={ptype === "gaia" ? "rgba(30,120,15,0.22)" : "rgba(35,95,18,0.20)"}   clipPath={`url(#cp-${planet.id})`} style={{ pointerEvents:"none" }} />
                <circle cx={px - r*0.05} cy={py + r*0.18} r={r*0.18} fill={ptype === "gaia" ? "rgba(50,140,25,0.20)" : "rgba(45,100,20,0.18)"}  clipPath={`url(#cp-${planet.id})`} style={{ pointerEvents:"none" }} />
              </>}
              {ptype === "nexus" && <circle cx={px} cy={py - r*0.25} r={r*0.44} fill="rgba(20,120,180,0.22)" clipPath={`url(#cp-${planet.id})`} style={{ pointerEvents:"none" }} />}
              {ptype === "forge" && <>
                <ellipse cx={px + r*0.1} cy={py + r*0.05} rx={r*0.38} ry={r*0.18} fill="rgba(200,80,15,0.25)" clipPath={`url(#cp-${planet.id})`} style={{ pointerEvents:"none" }} />
                <ellipse cx={px - r*0.2} cy={py - r*0.28} rx={r*0.25} ry={r*0.12} fill="rgba(180,60,10,0.20)" clipPath={`url(#cp-${planet.id})`} style={{ pointerEvents:"none" }} />
              </>}

              {/* 3D specular highlight */}
              <circle cx={px - r*0.28} cy={py - r*0.32} r={r*0.20}
                fill="rgba(255,255,255,0.22)" clipPath={`url(#cp-${planet.id})`}
                style={{ pointerEvents:"none", filter:"blur(1.2px)" }} />
              {/* Shadow terminator (dark right-lower limb) */}
              <ellipse cx={px + r*0.38} cy={py + r*0.08} rx={r*0.70} ry={r*1.08}
                fill="rgba(0,0,18,0.40)" clipPath={`url(#cp-${planet.id})`}
                style={{ pointerEvents:"none" }} />

              {/* Atmosphere rim */}
              <circle cx={px} cy={py} r={r} fill={`url(#atm-${planet.id})`} style={{ pointerEvents:"none" }} />

              {/* Ring front half */}
              {cfg.rings !== "none" && (
                <>
                  <ellipse cx={px} cy={py} rx={ringRX} ry={ringRY} fill="none" stroke={cfg.ringA} strokeWidth={ptype === "void" ? 10 : 4} clipPath={`url(#ring-ft-${planet.id})`} />
                  {ptype === "void" && <ellipse cx={px} cy={py} rx={ringRX * 0.80} ry={ringRY * 0.80} fill="none" stroke={cfg.ringB} strokeWidth="5" clipPath={`url(#ring-ft-${planet.id})`} />}
                </>
              )}

              {/* ── Civilization overlay ──────────────────────── */}
              {civ >= 0 && civGlowAlpha > 0.01 && (
                <g clipPath={`url(#cp-${planet.id})`} style={{ pointerEvents:"none" }}>
                  {/* Level 1+: settlement glow */}
                  {civ >= 1 && <circle cx={cbx} cy={cby} r={r * 0.18} fill={CIV_GLOW[civ]} opacity={civGlowAlpha} />}
                  {/* Level 2+: colony second cluster */}
                  {civ >= 2 && <circle cx={cbx - r*0.22} cy={cby + r*0.16} r={r * 0.12} fill={CIV_GLOW[civ]} opacity={civGlowAlpha * 0.7} />}
                  {/* Level 3: metropolis multi-cluster glow */}
                  {civ >= 3 && <>
                    <circle cx={cbx}            cy={cby}            r={r * 0.28} fill={CIV_GLOW[3]} opacity={civGlowAlpha * 0.85} />
                    <circle cx={cbx - r*0.30} cy={cby - r*0.12} r={r * 0.16} fill={CIV_GLOW[3]} opacity={civGlowAlpha * 0.60} />
                    <circle cx={cbx + r*0.15} cy={cby + r*0.22} r={r * 0.12} fill={CIV_GLOW[3]} opacity={civGlowAlpha * 0.50} />
                  </>}

                  {/* Dot clusters (zoom in to see individual lights) */}
                  {civ >= 1 && civDotAlpha > 0.01 && (
                    <g opacity={civDotAlpha}>
                      <circle cx={cbx}            cy={cby}            r={0.85 * sc} fill={CIV_DOT[civ]} />
                      <circle cx={cbx + 2.1 * sc} cy={cby - 1.4 * sc} r={0.70 * sc} fill={CIV_DOT[civ]} />
                      <circle cx={cbx - 1.8 * sc} cy={cby + 1.5 * sc} r={0.75 * sc} fill={CIV_DOT[civ]} />
                    </g>
                  )}
                  {civ >= 2 && civDotAlpha > 0.01 && (
                    <g opacity={civDotAlpha * 0.9}>
                      <circle cx={cbx - 3.2 * sc} cy={cby + 2.8 * sc} r={0.80 * sc} fill={CIV_DOT[civ]} />
                      <circle cx={cbx + 3.8 * sc} cy={cby + 1.4 * sc} r={0.75 * sc} fill={CIV_DOT[civ]} />
                      <circle cx={cbx - 1.5 * sc} cy={cby + 4.2 * sc} r={0.65 * sc} fill={CIV_DOT[civ]} />
                      <circle cx={cbx + 5.0 * sc} cy={cby - 0.5 * sc} r={0.60 * sc} fill={CIV_DOT[civ]} />
                    </g>
                  )}
                  {civ >= 3 && civDotAlpha > 0.01 && (
                    // Dense city light grid
                    <g opacity={civDotAlpha * 0.95}>
                      {Array.from({ length: 20 }, (_, k) => {
                        const gx = cbx + (k % 5 - 2) * 3.0 * sc;
                        const gy = cby + (Math.floor(k / 5) - 2) * 2.6 * sc;
                        return <circle key={k} cx={gx} cy={gy} r={0.72 * sc} fill={CIV_DOT[3]} opacity={0.6 + (k % 4) * 0.1} />;
                      })}
                    </g>
                  )}

                  {/* Building shapes (very high zoom) */}
                  {civ >= 2 && civBldgAlpha > 0.01 && (
                    <g opacity={civBldgAlpha}>
                      <rect x={cbx - 1 * sc}   y={cby - 2.5 * sc} width={1.8 * sc} height={2.2 * sc} fill={CIV_DOT[civ]} opacity={0.65} rx={0.15} />
                      <rect x={cbx + 2.2 * sc}  y={cby - 2.0 * sc} width={1.5 * sc} height={1.8 * sc} fill={CIV_DOT[civ]} opacity={0.60} rx={0.15} />
                      <rect x={cbx - 4.0 * sc}  y={cby + 1.2 * sc} width={1.6 * sc} height={1.6 * sc} fill={CIV_DOT[civ]} opacity={0.60} rx={0.15} />
                    </g>
                  )}
                  {civ >= 3 && civBldgAlpha > 0.01 && (
                    <g opacity={civBldgAlpha}>
                      {Array.from({ length: 8 }, (_, k) => {
                        const bw = (1.2 + (k % 3) * 0.5) * sc;
                        const bh = (1.5 + (k % 4) * 0.7) * sc;
                        const gx = cbx + (k % 4 - 1.5) * 4.2 * sc;
                        const gy = cby + (Math.floor(k / 4) - 0.5) * 3.8 * sc;
                        return <rect key={k} x={gx - bw/2} y={gy - bh/2} width={bw} height={bh} fill={CIV_DOT[3]} opacity={0.68 + (k % 2) * 0.08} rx={0.2} />;
                      })}
                    </g>
                  )}

                  {/* Ultra-fine detail (zoom > 3) */}
                  {civ >= 3 && civFineAlpha > 0.01 && (
                    <g opacity={civFineAlpha}>
                      <line x1={cbx - 8 * sc} y1={cby} x2={cbx + 8 * sc} y2={cby} stroke={CIV_DOT[3]} strokeWidth={0.35 * sc} opacity={0.35} />
                      <line x1={cbx} y1={cby - 6 * sc} x2={cbx} y2={cby + 6 * sc} stroke={CIV_DOT[3]} strokeWidth={0.35 * sc} opacity={0.35} />
                      <line x1={cbx - 8 * sc} y1={cby - 3.8 * sc} x2={cbx + 8 * sc} y2={cby - 3.8 * sc} stroke={CIV_DOT[3]} strokeWidth={0.25 * sc} opacity={0.22} />
                      <line x1={cbx - 8 * sc} y1={cby + 3.8 * sc} x2={cbx + 8 * sc} y2={cby + 3.8 * sc} stroke={CIV_DOT[3]} strokeWidth={0.25 * sc} opacity={0.22} />
                    </g>
                  )}
                </g>
              )}

              {/* Moon orbit ring */}
              <circle cx={px} cy={py} r={moonOrbit} fill="none" stroke={`${cfg.glow}18`} strokeWidth="0.4" />

              {/* Moon — realistic grey sphere with craters */}
              <g
                style={{ cursor:"pointer" }}
                onMouseEnter={() => { soundManager.play("ui_hover"); setHoveredMoon(planet.id); }}
                onMouseLeave={() => setHoveredMoon(null)}
                onClick={() => { soundManager.play("ui_click"); onSelectPlanet(planet); }}
              >
                {/* 3D sphere via gradient — NOT a crescent */}
                <circle cx={mx} cy={my} r={moonVR} fill={`url(#moon-${ptype})`} filter="url(#moon-glow)" />
                {/* Craters (visible at all zoom levels, more at high zoom) */}
                <circle cx={mx - moonVR*0.32} cy={my - moonVR*0.18} r={moonVR*0.26} fill="rgba(0,0,18,0.38)" clipPath={`url(#moon-cp-${planet.id})`} style={{ pointerEvents:"none" }} />
                <circle cx={mx - moonVR*0.32} cy={my - moonVR*0.18} r={moonVR*0.26} fill="none" stroke="rgba(200,210,225,0.20)" strokeWidth="0.5" clipPath={`url(#moon-cp-${planet.id})`} style={{ pointerEvents:"none" }} />
                <circle cx={mx + moonVR*0.35} cy={my + moonVR*0.30} r={moonVR*0.20} fill="rgba(0,0,18,0.32)" clipPath={`url(#moon-cp-${planet.id})`} style={{ pointerEvents:"none" }} />
                <circle cx={mx - moonVR*0.08} cy={my + moonVR*0.40} r={moonVR*0.15} fill="rgba(0,0,18,0.28)" clipPath={`url(#moon-cp-${planet.id})`} style={{ pointerEvents:"none" }} />
                {/* Terminator shadow (same as planets — gives 3D look) */}
                <ellipse cx={mx + moonVR*0.36} cy={my + moonVR*0.06} rx={moonVR*0.72} ry={moonVR*1.06}
                  fill="rgba(0,0,18,0.45)" clipPath={`url(#moon-cp-${planet.id})`}
                  style={{ pointerEvents:"none" }} />
              </g>

              {/* Moon hover label */}
              {moonHov && (
                <text x={mx} y={my - moonVR - 6} textAnchor="middle" fill={cfg.glow} fontSize="6.5" letterSpacing="1.5" fontFamily="monospace" opacity={0.85} style={{ pointerEvents:"none" }}>
                  TASK HUB
                </text>
              )}

              {/* Planet label — pill badge always visible */}
              {(() => {
                const nameStr = (planet.name.length > 16 ? planet.name.slice(0, 15) + "…" : planet.name).toUpperCase();
                const nw  = nameStr.length * 6.6 + 20;
                const ly  = py + r + 12;
                return (
                  <g style={{ pointerEvents:"none" }}>
                    {/* Name pill */}
                    <rect x={px - nw/2} y={ly} width={nw} height={19} rx={9.5}
                      fill={isHov || isAct ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0.52)"}
                      stroke={isHov || isAct ? `${cfg.glow}55` : "rgba(255,255,255,0.09)"}
                      strokeWidth={0.8} />
                    <text x={px} y={ly + 13} textAnchor="middle"
                      fill={isHov || isAct ? "white" : "rgba(255,255,255,0.72)"}
                      fontSize="10" letterSpacing="1" fontFamily="inherit" fontWeight={isHov || isAct ? "600" : "400"}>
                      {nameStr}
                    </text>
                    {/* Type + civ tags — show on hover */}
                    {isHov && (
                      <>
                        <rect x={px - 38} y={ly + 23} width={76} height={15} rx={7.5}
                          fill="rgba(0,0,0,0.6)" stroke={`${cfg.glow}33`} strokeWidth={0.7} />
                        <text x={px} y={ly + 33} textAnchor="middle"
                          fill={cfg.glow} fontSize="8.5" letterSpacing="1" fontFamily="monospace" opacity={0.9}>
                          {cfg.label}
                        </text>
                        <rect x={px - 42} y={ly + 41} width={84} height={15} rx={7.5}
                          fill="rgba(0,0,0,0.6)" stroke={`${CIV_DOT[civ]}33`} strokeWidth={0.7} />
                        <text x={px} y={ly + 51} textAnchor="middle"
                          fill={CIV_DOT[civ]} fontSize="8.5" letterSpacing="1" fontFamily="monospace" opacity={0.9}>
                          ◈ {CIV_NAMES[civ]}
                        </text>
                      </>
                    )}
                  </g>
                );
              })()}

              {/* Delete moved into PlanetDetail chat panel */}
            </g>
          );
        })}

        {/* Loading / empty state */}
        {loading && <text x={CX} y={CY + 100} textAnchor="middle" fill="rgba(245,158,11,0.22)" fontSize="9" letterSpacing="3" fontFamily="monospace">SOLAR SYSTEM INITIALIZING…</text>}
        {!loading && planets.length === 0 && !error && <>
          <text x={CX} y={CY + 95}  textAnchor="middle" fill="rgba(255,255,255,0.11)" fontSize="9" letterSpacing="1.8" fontFamily="monospace">NO MISSIONS IN ORBIT</text>
          <text x={CX} y={CY + 110} textAnchor="middle" fill="rgba(245,158,11,0.20)" fontSize="8" letterSpacing="1.5" fontFamily="monospace">LAUNCH YOUR FIRST MISSION ↓</text>
        </>}

        {/* ── Planet Creation Animation ─────────────────────── */}
        {creationTarget && creationPhase === "forming" && (
          <PlanetCreationAnimation
            targetX={creationTarget.x}
            targetY={creationTarget.y}
            onReveal={handleCreationReveal}
            onComplete={handleCreationComplete}
          />
        )}

        {/* ── Spaceship Landing Animation ──────────────────── */}
        {showSpaceship && creationTarget && (
          <SpaceshipAnimation
            targetX={creationTarget.x}
            targetY={creationTarget.y}
            onComplete={handleSpaceshipComplete}
          />
        )}

        {/* ── Comet Notifications ──────────────────────────── */}
        <CometNotificationLayer comets={cometQueue} />

        {/* ── Sun AI State Indicator ───────────────────────── */}
        {sunAiState !== "idle" && (
          <g style={{ pointerEvents: "none" }}>
            {/* Processing corona flares */}
            {(sunAiState === "processing" || sunAiState === "tool_use") && (
              <>
                {[0, 45, 90, 135].map((angle, k) => {
                  const rad = (angle * Math.PI) / 180;
                  const flareLen = SUN_R * 0.6;
                  const x1 = CX + (SUN_R + 4) * Math.cos(rad);
                  const y1 = CY + (SUN_R + 4) * Math.sin(rad);
                  const x2 = CX + (SUN_R + 4 + flareLen) * Math.cos(rad);
                  const y2 = CY + (SUN_R + 4 + flareLen) * Math.sin(rad);
                  return (
                    <line key={`flare${k}`}
                      x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke="rgba(255,170,30,0.4)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      style={{ animation: `pulse ${1.5 + k * 0.3}s ease-in-out infinite`, transformOrigin: `${CX}px ${CY}px` }}
                    />
                  );
                })}
              </>
            )}
            {/* Success ring */}
            {sunAiState === "success" && (
              <circle cx={CX} cy={CY} r={SUN_R + 10}
                fill="none" stroke="rgba(100,255,100,0.4)" strokeWidth="3"
                style={{ animation: "pulse-ring 1s ease-out forwards" }}
              />
            )}
            {/* Error red tint */}
            {sunAiState === "error" && (
              <circle cx={CX} cy={CY} r={SUN_R + 5}
                fill="rgba(255,50,50,0.15)"
                style={{ animation: "pulse 0.5s ease-in-out" }}
              />
            )}
          </g>
        )}

        {/* Status bar moved to HTML overlay below */}
      </svg>

      {/* ── Launch button ────────────────────────────────────── */}
      <div style={{ position:"absolute", bottom:"22px", left:"50%", transform:"translateX(-50%)", zIndex:10, display:"flex", alignItems:"center", gap:"10px" }}>
        {launching ? (
          <div style={{ fontSize:"11px", padding:"8px 20px", borderRadius:"20px", color:"var(--sun-color)", border:"1px solid rgba(245,158,11,0.38)", fontFamily:"monospace", letterSpacing:"0.16em", animation:"blink 0.8s step-end infinite" }}>● {creationPhase === "spaceship" ? "HOUSTON EN ROUTE…" : creationPhase === "forming" ? "WORLD FORMING…" : "MISSION LAUNCHING…"}</div>
        ) : adding ? (
          <>
            <input autoFocus
              style={{ color:"white", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(167,139,250,0.28)", borderRadius:"12px", padding:"8px 14px", fontSize:"13px", width:"220px", outline:"none", fontFamily:"inherit", backdropFilter:"blur(12px)" }}
              placeholder="Mission name…" value={newName} onChange={e => setNewName(e.target.value)}
              onFocus={e => (e.target.style.borderColor = "rgba(245,158,11,0.4)")}
              onBlur={e  => (e.target.style.borderColor = "rgba(167,139,250,0.28)")}
              onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setAdding(false); }}
            />
            <button onClick={handleCreate} style={{ background:"var(--sun-color)", border:"none", borderRadius:"12px", padding:"8px 16px", fontSize:"13px", fontWeight:600, cursor:"pointer", color:"#0a0508", fontFamily:"inherit" }}>🚀 Launch</button>
            <button onClick={() => setAdding(false)} style={{ background:"none", border:"none", fontSize:"12px", color:"var(--text-muted)", cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
          </>
        ) : (
          <button onClick={() => setAdding(true)}
            style={{ display:"flex", alignItems:"center", gap:"8px", padding:"9px 22px", borderRadius:"22px", fontSize:"12px", background:"rgba(255,255,255,0.025)", border:"1px solid rgba(167,139,250,0.16)", color:"var(--text-muted)", backdropFilter:"blur(10px)", cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s", letterSpacing:"0.05em" }}
            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = "rgba(245,158,11,0.38)"; b.style.color = "white"; b.style.background = "rgba(245,158,11,0.04)"; }}
            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = "rgba(167,139,250,0.16)"; b.style.color = "var(--text-muted)"; b.style.background = "rgba(255,255,255,0.025)"; }}>
            <Plus size={13} /> Launch new mission
          </button>
        )}
      </div>
    </div>
  );
}

