import { useEffect, useState } from "react";
import { api, type Planet } from "./api/agent";
import { ControlCenter } from "./components/ControlCenter";
import { PlanetDetail } from "./components/PlanetDetail";
import { SettingsPanel } from "./components/SettingsPanel";
import ShootingStars from "./components/ShootingStars";
import { SolarSystemView } from "./components/SolarSystemView";
import "./index.css";

export default function App() {
  const [selectedPlanet, setSelectedPlanet]     = useState<Planet | null>(null);
  const [serviceOnline, setServiceOnline]       = useState<boolean | null>(null);
  const [showSettings, setShowSettings]         = useState(false);
  const [showControlCenter, setShowControlCenter] = useState(false);

  useEffect(() => {
    api.health()
      .then(() => setServiceOnline(true))
      .catch(() => setServiceOnline(false));
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden relative">

      {/* ── Persistent shooting stars ───────────────── */}
      <ShootingStars />

      {/* ── Offline banner ──────────────────────────── */}
      {serviceOnline === false && (
        <div
          className="absolute top-0 left-0 right-0 z-50 text-xs text-center py-2"
          style={{
            background: "rgba(120,20,20,0.9)",
            color: "#fecaca",
            borderBottom: "1px solid rgba(239,68,68,0.25)",
          }}
        >
          Agent service offline —{" "}
          <code className="font-mono px-1 rounded" style={{ background: "rgba(185,28,28,0.5)" }}>
            uvicorn main:app --reload
          </code>
        </div>
      )}

      {/* ── Solar system — always mounted & animating ─ */}
      <SolarSystemView
        onSelectPlanet={setSelectedPlanet}
        onOpenSettings={() => setShowSettings(true)}
        onOpenControlCenter={() => setShowControlCenter(true)}
        activePlanetId={selectedPlanet?.id ?? null}
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
          width: "420px",
          transform: selectedPlanet ? "translateX(0)" : "translateX(105%)",
          transition: "transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 30,
          pointerEvents: selectedPlanet ? "auto" : "none",
        }}
      >
        {selectedPlanet && (
          <PlanetDetail
            planet={selectedPlanet}
            onBack={() => setSelectedPlanet(null)}
          />
        )}
      </div>

      {/* ── Mission Control overlay ──────────────────── */}
      {showControlCenter && (
        <ControlCenter onClose={() => setShowControlCenter(false)} />
      )}

      {/* ── Settings overlay ────────────────────────── */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
