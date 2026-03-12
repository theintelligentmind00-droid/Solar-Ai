import { useDayNightCycle } from "./hooks/useDayNightCycle";
import { useEffect, useRef, useState } from "react";
import { api, BASE_URL, isTauri, type Planet } from "./api/agent";
import { soundManager } from "./sounds/SoundManager";

async function fireBriefingNotification() {
  if (!isTauri) return; // Tauri notifications not available in web mode
  try {
    const { sendNotification } = await import("@tauri-apps/plugin-notification");
    sendNotification({
      title: "Solar AI OS",
      body: "Your daily briefing is ready.",
    });
  } catch {
    // Not in Tauri context or notifications not available
  }
}
import { ControlCenter } from "./components/ControlCenter";
import { MetaphorGuide } from "./components/MetaphorGuide";
import { Onboarding } from "./components/Onboarding";
import { PlanetDetail } from "./components/PlanetDetail";
import { PlanetScene } from "./three/PlanetScene";
import { SettingsPanel } from "./components/SettingsPanel";
import ShootingStars from "./components/ShootingStars";
import { SolarSystemView } from "./components/SolarSystemView";
import "./index.css";

/* ================================================================== */
/*  WARP SPEED TRANSITION                                              */
/* ================================================================== */

function WarpTransition({ active, onComplete, sceneLoaded }: { active: boolean; onComplete: () => void; sceneLoaded: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"idle" | "stretch" | "flash" | "done">("idle");

  useEffect(() => {
    if (!active) { setPhase("idle"); return; }
    setPhase("stretch");
    // Star stretch for 1.6s → flash (holds until scene loaded)
    const t1 = setTimeout(() => setPhase("flash"), 1600);
    return () => { clearTimeout(t1); };
  }, [active]);

  // Flash holds until scene is loaded, then fades out
  useEffect(() => {
    if (phase !== "flash" || !sceneLoaded) return;
    const t = setTimeout(() => { setPhase("done"); onComplete(); }, 500);
    return () => clearTimeout(t);
  }, [phase, sceneLoaded, onComplete]);

  // Draw star-stretch lines on canvas
  useEffect(() => {
    if (phase !== "stretch") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    const cx = w / 2;
    const cy = h / 2;

    // Generate star positions — more stars, varied colors
    const stars: { angle: number; dist: number; speed: number; brightness: number; hue: number }[] = [];
    for (let i = 0; i < 350; i++) {
      stars.push({
        angle: Math.random() * Math.PI * 2,
        dist: 10 + Math.random() * 80,
        speed: 0.4 + Math.random() * 1.8,
        brightness: 0.3 + Math.random() * 0.7,
        hue: Math.random() < 0.15 ? 200 + Math.random() * 60
           : Math.random() < 0.05 ? 30 + Math.random() * 20  // warm gold tint
           : 0,
      });
    }

    let frame = 0;
    let raf: number;
    const draw = () => {
      frame++;
      const progress = Math.min(frame / 96, 1); // ~1.6s at 60fps
      // Accelerating trail fade
      const fadeAlpha = 0.15 + progress * 0.25;
      ctx.fillStyle = `rgba(4, 2, 8, ${fadeAlpha})`;
      ctx.fillRect(0, 0, w, h);

      // Central glow builds up
      if (progress > 0.3) {
        const glowIntensity = (progress - 0.3) / 0.7;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 200);
        gradient.addColorStop(0, `rgba(180, 200, 255, ${glowIntensity * 0.15})`);
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
      }

      for (const star of stars) {
        // Accelerating stretch — slow start, fast end
        const accel = progress * progress;
        const stretchLen = star.dist + accel * 800 * star.speed;
        const endX = cx + Math.cos(star.angle) * stretchLen;
        const endY = cy + Math.sin(star.angle) * stretchLen;
        const startDist = star.dist + accel * 250 * star.speed;
        const startX = cx + Math.cos(star.angle) * startDist;
        const startY = cy + Math.sin(star.angle) * startDist;

        const alpha = star.brightness * (0.2 + progress * 0.8);
        const lineWidth = 1 + accel * 3.0;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        if (star.hue > 0) {
          ctx.strokeStyle = `hsla(${star.hue}, 70%, 80%, ${alpha})`;
        } else {
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        }
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }

      if (progress < 1) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  if (phase === "idle" || phase === "done") return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50, pointerEvents: "none",
    }}>
      {phase === "stretch" && (
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      )}
      {phase === "flash" && (
        <div style={{
          position: "absolute", inset: 0,
          background: "white",
          animation: "warpFlash 0.6s ease-out forwards",
        }} />
      )}
    </div>
  );
}

export default function App() {
  useDayNightCycle();
  const [onboarded, setOnboarded] = useState<boolean>(
    () => localStorage.getItem("solar_onboarded") === "true" || !!sessionStorage.getItem("solar_api_key")
  );
  const [selectedPlanet, setSelectedPlanet]     = useState<Planet | null>(null);
  const [serviceOnline, setServiceOnline]       = useState<boolean | null>(null);
  const [showSettings, setShowSettings]         = useState(false);
  const [showControlCenter, setShowControlCenter] = useState(false);
  const [showMetaphorGuide, setShowMetaphorGuide] = useState(false);
  const [planetRefreshKey, setPlanetRefreshKey] = useState(0);
  const [apiKey, setApiKey] = useState<string>(sessionStorage.getItem("solar_api_key") ?? "");
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState(false);
  const [checkingKey, setCheckingKey] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);
  const [panelWidth, setPanelWidth] = useState(420);
  const isResizing = useRef(false);
  // 3D planet view state
  const [planetView3D, setPlanetView3D] = useState<Planet | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [warpActive, setWarpActive] = useState(false);
  const warpTargetRef = useRef<Planet | null>(null);
  const currentAmbientRef = useRef<string | null>(null);

  const startResize = (e: React.MouseEvent) => {
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = panelWidth;
    const onMove = (mv: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(320, Math.min(760, startWidth + (startX - mv.clientX)));
      setPanelWidth(newWidth);
    };
    const onUp = () => {
      isResizing.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      for (let i = 0; i < 30; i++) {
        if (cancelled) return;
        try {
          await api.health();
          if (!cancelled) setServiceOnline(true);
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      if (!cancelled) setServiceOnline(false);
    };
    poll();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (apiKey) return; // already have a key
    fetch(`${BASE_URL}/health`).then((r) => {
      if (r.status === 401) setNeedsKey(true);
    }).catch(() => {});
  }, [apiKey]);

  // Poll daily briefing every 5 minutes; fire a notification when notification_pending is true
  useEffect(() => {
    if (!serviceOnline) return;
    let lastGeneratedAt: string | null = null;
    const check = async () => {
      try {
        const res = await api.getDailyBriefing() as { briefing: string; generated_at: string; notification_pending?: boolean };
        if (res.notification_pending && res.generated_at !== lastGeneratedAt) {
          lastGeneratedAt = res.generated_at;
          void fireBriefingNotification();
        }
      } catch {
        // ignore â€" service may not be ready
      }
    };
    void check();
    const id = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [serviceOnline]);

  // Ambient soundscape â€" crossfade based on view context
  useEffect(() => {
    // Determine which ambient to play
    let targetAmbient: string;
    if (planetView3D && !transitioning) {
      const ptype = planetView3D.planet_type ?? "terra";
      if (ptype === "forge" || ptype === "citadel" || ptype === "void") {
        targetAmbient = "ambient_planet_forge";
      } else {
        targetAmbient = "ambient_planet_terra";
      }
    } else {
      targetAmbient = "ambient_space";
    }

    if (currentAmbientRef.current === targetAmbient) return;

    // Crossfade: fade out old, fade in new
    if (currentAmbientRef.current) {
      soundManager.fadeOut(currentAmbientRef.current, 800);
    }
    currentAmbientRef.current = targetAmbient;
    soundManager.fadeIn(targetAmbient, 1200);
    // Fade out ambient after 4 seconds (single timer — no duplicate)
    const fadeTimer = setTimeout(() => {
      soundManager.fadeOut(targetAmbient, 3000);
    }, 4000);

    return () => {
      clearTimeout(fadeTimer);
      if (currentAmbientRef.current) {
        soundManager.stop(currentAmbientRef.current);
        currentAmbientRef.current = null;
      }
    };
  }, [planetView3D, transitioning]);

  // Warp complete — warp has fully faded, clean up
  const handleWarpComplete = useRef(() => {
    setWarpActive(false);
  }).current;

  // When scene is ready, reveal it behind the warp (no gap when warp fades)
  useEffect(() => {
    if (sceneReady && transitioning && warpActive) {
      setTransitioning(false);
    }
  }, [sceneReady, transitioning, warpActive]);

  // Handle planet selection: open chat panel + trigger warp → 3D view
  const handlePlanetSelect = (planet: Planet) => {
    // Sun click — just open chat, no 3D
    if (planet.id === "sun") {
      setSelectedPlanet(planet);
      return;
    }
    setSelectedPlanet(planet);
    // Start warp + immediately start loading planet scene (behind the warp)
    warpTargetRef.current = planet;
    setWarpActive(true);
    setTransitioning(true);
    setPlanetView3D(planet);
    setSceneReady(false);
    soundManager.play("zoom_launch");
  };

  const handleBack3D = () => {
    setTransitioning(true);
    setSelectedPlanet(null);
    soundManager.play("ui_panel_close");
    setTimeout(() => {
      setPlanetView3D(null);
      setSceneReady(false);
      setTransitioning(false);
    }, 500);
  };

  const submitKey = async () => {
    const key = keyInput.trim();
    if (!key) return;
    setCheckingKey(true);
    setKeyError(false);
    try {
      const r = await fetch(`${BASE_URL}/health`, { headers: { "X-Api-Key": key } });
      if (r.ok) {
        sessionStorage.setItem("solar_api_key", key);
        setApiKey(key);
      } else {
        setKeyError(true);
      }
    } catch {
      setKeyError(true);
    } finally {
      setCheckingKey(false);
    }
  };

  if (!onboarded) {
    return <Onboarding onComplete={() => setOnboarded(true)} />;
  }

  return (
    <div className="w-screen h-screen overflow-hidden relative">

      {needsKey && !apiKey && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(7,7,15,0.98)",
          backdropFilter: "blur(20px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: "340px",
            background: "rgba(12,10,24,0.9)",
            border: "1px solid rgba(167,139,250,0.15)",
            borderRadius: "16px",
            padding: "32px",
            display: "flex", flexDirection: "column", gap: "20px",
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: "8px", filter: "drop-shadow(0 0 14px rgba(245,158,11,0.6))" }}>â˜€</div>
              <div style={{ fontSize: "14px", color: "white", fontWeight: 600, letterSpacing: "0.04em" }}>Solar AI OS</div>
              <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "4px", letterSpacing: "0.06em" }}>Enter your access key to continue</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input
                autoFocus
                type="password"
                placeholder="Access keyâ€¦"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitKey()}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${keyError ? "rgba(239,68,68,0.5)" : "rgba(167,139,250,0.2)"}`,
                  borderRadius: "10px", padding: "10px 14px",
                  color: "white", fontSize: "14px", outline: "none", fontFamily: "inherit",
                }}
              />
              {keyError && (
                <div style={{ fontSize: "11px", color: "#fca5a5", letterSpacing: "0.04em" }}>
                  Invalid key â€" check your SOLAR_API_KEY setting
                </div>
              )}
              <button
                onClick={submitKey}
                disabled={checkingKey || !keyInput.trim()}
                style={{
                  background: checkingKey ? "rgba(245,158,11,0.3)" : "var(--sun-color)",
                  border: "none", borderRadius: "10px", padding: "10px",
                  color: "#0a0508", fontWeight: 600, fontSize: "13px",
                  cursor: checkingKey ? "not-allowed" : "pointer",
                  fontFamily: "inherit", transition: "all 0.15s",
                }}
              >
                {checkingKey ? "Checkingâ€¦" : "Enter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* â"€â"€ Persistent shooting stars â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <ShootingStars />

      {/* â"€â"€ Starting indicator (null = still polling) â"€â"€ */}
      {serviceOnline === null && (
        <div
          className="absolute top-0 left-0 right-0 z-50 text-xs text-center py-2"
          style={{
            background: "rgba(20,16,40,0.75)",
            color: "rgba(167,139,250,0.7)",
            borderBottom: "1px solid rgba(167,139,250,0.12)",
            animation: "pulse 2s ease-in-out infinite",
          }}
        >
          Starting Solar AIâ€¦
        </div>
      )}

      {/* â"€â"€ Offline banner (false = confirmed unreachable after all retries) â"€â"€ */}
      {serviceOnline === false && (
        <div
          className="absolute top-0 left-0 right-0 z-50 text-xs text-center py-2"
          style={{
            background: "rgba(120,20,20,0.9)",
            color: "#fecaca",
            borderBottom: "1px solid rgba(239,68,68,0.25)",
          }}
        >
          Solar AI is starting up â€" please wait a momentâ€¦
        </div>
      )}

      {/* â"€â"€ Solar system â€" always mounted & animating â"€ */}
      <SolarSystemView
        onSelectPlanet={handlePlanetSelect}
        onOpenSettings={() => setShowSettings(true)}
        onOpenControlCenter={() => setShowControlCenter(true)}
        onOpenMetaphorGuide={() => setShowMetaphorGuide(true)}
        activePlanetId={selectedPlanet?.id ?? null}
        refreshKey={planetRefreshKey}
      />

      {/* ── Warp speed transition ──────────────── */}
      <WarpTransition active={warpActive} onComplete={handleWarpComplete} sceneLoaded={sceneReady} />

      {/* ── 3D Planet View (zoomed in) ──────────── */}
      {planetView3D && planetView3D.id !== "sun" && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 15,
          opacity: transitioning ? 0 : 1,
          transform: transitioning ? "scale(0.85)" : "scale(1)",
          transition: "opacity 0.8s cubic-bezier(0.4,0,0.2,1), transform 0.8s cubic-bezier(0.4,0,0.2,1)",
          pointerEvents: transitioning ? "none" : "auto",
        }}>
          <PlanetScene
            planetType={planetView3D.planet_type ?? "terra"}
            planetId={planetView3D.id}
            visible
            onReady={() => { setSceneReady(true); soundManager.play("zoom_arrival"); }}
          />
          {/* Back to orbit button */}
          <button
            onClick={handleBack3D}
            style={{
              position: "absolute",
              top: 20,
              left: 20,
              zIndex: 20,
              padding: "8px 16px",
              borderRadius: "10px",
              background: "rgba(12,10,24,0.85)",
              border: "1px solid rgba(167,139,250,0.2)",
              color: "var(--text)",
              fontSize: "12px",
              fontFamily: "inherit",
              letterSpacing: "0.06em",
              cursor: "pointer",
              backdropFilter: "blur(8px)",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(245,158,11,0.4)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--sun-color)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(167,139,250,0.2)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text)";
            }}
          >
            â† Return to orbit
          </button>
          {/* ── Sci-Fi HUD Overlay ── */}
          <div style={{
            position: "absolute", inset: 0, zIndex: 18,
            pointerEvents: "none",
            opacity: sceneReady && !transitioning ? 1 : 0,
            transition: "opacity 1.0s ease 0.5s",
          }}>
            {/* Top-left corner bracket */}
            <div style={{
              position: "absolute", top: 20, left: 20,
              width: 80, height: 80,
              borderTop: "1px solid rgba(245, 158, 11, 0.35)",
              borderLeft: "1px solid rgba(245, 158, 11, 0.35)",
            }} />
            {/* Top-right corner bracket */}
            <div style={{
              position: "absolute", top: 20, right: 20,
              width: 80, height: 80,
              borderTop: "1px solid rgba(245, 158, 11, 0.35)",
              borderRight: "1px solid rgba(245, 158, 11, 0.35)",
            }} />
            {/* Bottom-left corner bracket */}
            <div style={{
              position: "absolute", bottom: 20, left: 20,
              width: 80, height: 80,
              borderBottom: "1px solid rgba(245, 158, 11, 0.35)",
              borderLeft: "1px solid rgba(245, 158, 11, 0.35)",
            }} />
            {/* Bottom-right corner bracket */}
            <div style={{
              position: "absolute", bottom: 20, right: 20,
              width: 80, height: 80,
              borderBottom: "1px solid rgba(245, 158, 11, 0.35)",
              borderRight: "1px solid rgba(245, 158, 11, 0.35)",
            }} />
            {/* Top-center planet designation */}
            <div style={{
              position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)",
              fontFamily: "'Space Grotesk', monospace",
              fontSize: "10px", letterSpacing: "0.25em",
              color: "rgba(245, 158, 11, 0.55)",
              textTransform: "uppercase",
            }}>
              {(planetView3D.planet_type ?? "terra").toUpperCase()} WORLD // SECTOR {String(planetView3D.id).slice(-2).toUpperCase().padStart(2, "0")}
            </div>
            {/* Left data readout */}
            <div style={{
              position: "absolute", top: 110, left: 28,
              fontFamily: "'Space Grotesk', monospace",
              fontSize: "9px", letterSpacing: "0.12em",
              color: "rgba(245, 158, 11, 0.40)",
              lineHeight: "1.8",
            }}>
              <div>STATUS: ACTIVE</div>
              <div>ORBIT: STABLE</div>
              <div>SIGNAL: NOMINAL</div>
            </div>
            {/* Thin horizontal scan line at bottom */}
            <div style={{
              position: "absolute", bottom: 108, left: 28, right: 28,
              height: "1px",
              background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.2) 20%, rgba(245,158,11,0.2) 80%, transparent)",
            }} />
            {/* Bottom center — planet name */}
            <div style={{
              position: "absolute", bottom: 30, left: "50%", transform: "translateX(-50%)",
              textAlign: "center",
            }}>
              <div style={{
                fontSize: "10px", letterSpacing: "0.2em",
                color: "rgba(245, 158, 11, 0.50)",
                marginBottom: "4px",
                fontFamily: "'Space Grotesk', monospace",
              }}>
                {(planetView3D.planet_type ?? "terra").toUpperCase()} WORLD
              </div>
              <div style={{
                fontSize: "20px", fontWeight: 600,
                color: "var(--text)",
                letterSpacing: "0.10em",
                textShadow: "0 0 24px rgba(245,158,11,0.25), 0 0 60px rgba(167,139,250,0.15)",
              }}>
                {planetView3D.name}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* â"€â"€ Soft dim when panel is open â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.3)",
          opacity: selectedPlanet ? 1 : 0,
          pointerEvents: "none",
          transition: "opacity 0.3s ease",
          zIndex: 20,
        }}
      />

      {/* â"€â"€ Chat side panel â€" slides in from right â"€â"€â"€â"€â"€ */}
      <div
        style={{
          position: "fixed",
          right: 0,
          top: 0,
          height: "100vh",
          width: `${panelWidth}px`,
          transform: selectedPlanet ? "translateX(0)" : "translateX(105%)",
          transition: isResizing.current ? "none" : "transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 30,
          pointerEvents: selectedPlanet ? "auto" : "none",
        }}
      >
        {/* Drag handle on left edge */}
        {selectedPlanet && (
          <div
            onMouseDown={startResize}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "5px",
              height: "100%",
              cursor: "ew-resize",
              zIndex: 10,
              background: "transparent",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(167,139,250,0.25)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
          />
        )}
        {selectedPlanet && (
          <PlanetDetail
            planet={selectedPlanet}
            onBack={() => {
              setSelectedPlanet(null);
              if (planetView3D) handleBack3D();
            }}
            onDeleted={() => {
              setSelectedPlanet(null);
              setPlanetView3D(null);
              setSceneReady(false);
              setPlanetRefreshKey((k) => k + 1);
            }}
          />
        )}
      </div>

      {/* â"€â"€ Mission Control overlay â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      {showControlCenter && (
        <ControlCenter onClose={() => setShowControlCenter(false)} />
      )}

      {/* â"€â"€ Settings overlay â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      {/* â"€â"€ Metaphor Guide overlay â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      {showMetaphorGuide && <MetaphorGuide onClose={() => setShowMetaphorGuide(false)} />}
    </div>
  );
}


