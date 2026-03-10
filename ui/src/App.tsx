import { useEffect, useRef, useState } from "react";
import { api, BASE_URL, type Planet } from "./api/agent";
import { ControlCenter } from "./components/ControlCenter";
import { MetaphorGuide } from "./components/MetaphorGuide";
import { Onboarding } from "./components/Onboarding";
import { PlanetDetail } from "./components/PlanetDetail";
import { SettingsPanel } from "./components/SettingsPanel";
import ShootingStars from "./components/ShootingStars";
import { SolarSystemView } from "./components/SolarSystemView";
import "./index.css";

export default function App() {
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
              <div style={{ fontSize: "2rem", marginBottom: "8px", filter: "drop-shadow(0 0 14px rgba(245,158,11,0.6))" }}>☀</div>
              <div style={{ fontSize: "14px", color: "white", fontWeight: 600, letterSpacing: "0.04em" }}>Solar AI OS</div>
              <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "4px", letterSpacing: "0.06em" }}>Enter your access key to continue</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input
                autoFocus
                type="password"
                placeholder="Access key…"
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
                  Invalid key — check your SOLAR_API_KEY setting
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
                {checkingKey ? "Checking…" : "Enter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Persistent shooting stars ───────────────── */}
      <ShootingStars />

      {/* ── Starting indicator (null = still polling) ── */}
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
          Starting Solar AI…
        </div>
      )}

      {/* ── Offline banner (false = confirmed unreachable after all retries) ── */}
      {serviceOnline === false && (
        <div
          className="absolute top-0 left-0 right-0 z-50 text-xs text-center py-2"
          style={{
            background: "rgba(120,20,20,0.9)",
            color: "#fecaca",
            borderBottom: "1px solid rgba(239,68,68,0.25)",
          }}
        >
          Solar AI is starting up — please wait a moment…
        </div>
      )}

      {/* ── Solar system — always mounted & animating ─ */}
      <SolarSystemView
        onSelectPlanet={setSelectedPlanet}
        onOpenSettings={() => setShowSettings(true)}
        onOpenControlCenter={() => setShowControlCenter(true)}
        onOpenMetaphorGuide={() => setShowMetaphorGuide(true)}
        activePlanetId={selectedPlanet?.id ?? null}
        refreshKey={planetRefreshKey}
      />

      {/* ── Soft dim when panel is open ─────────────── */}
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

      {/* ── Chat side panel — slides in from right ───── */}
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
            onBack={() => setSelectedPlanet(null)}
            onDeleted={() => {
              setSelectedPlanet(null);
              setPlanetRefreshKey((k) => k + 1);
            }}
          />
        )}
      </div>

      {/* ── Mission Control overlay ──────────────────── */}
      {showControlCenter && (
        <ControlCenter onClose={() => setShowControlCenter(false)} />
      )}

      {/* ── Settings overlay ────────────────────────── */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      {/* ── Metaphor Guide overlay ───────────────────── */}
      {showMetaphorGuide && <MetaphorGuide onClose={() => setShowMetaphorGuide(false)} />}
    </div>
  );
}
