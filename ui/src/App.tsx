import { useEffect, useState } from "react";
import { api, type Planet } from "./api/agent";
import { PlanetDetail } from "./components/PlanetDetail";
import { SettingsPanel } from "./components/SettingsPanel";
import { SolarSystemView } from "./components/SolarSystemView";
import "./index.css";

type View = "home" | "planet";

export default function App() {
  const [view, setView] = useState<View>("home");
  const [selectedPlanet, setSelectedPlanet] = useState<Planet | null>(null);
  const [serviceOnline, setServiceOnline] = useState<boolean | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    api.health()
      .then(() => setServiceOnline(true))
      .catch(() => setServiceOnline(false));
  }, []);

  const openPlanet = (planet: Planet) => {
    setSelectedPlanet(planet);
    setView("planet");
  };

  const goHome = () => {
    setView("home");
    setSelectedPlanet(null);
  };

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      {serviceOnline === false && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-red-900/90 text-red-200 text-xs text-center py-2 border-b border-red-700">
          Agent service offline — run:{" "}
          <code className="font-mono bg-red-800 px-1 rounded">
            cd agent-service && .venv\Scripts\uvicorn main:app --reload
          </code>
        </div>
      )}

      {view === "home" && (
        <SolarSystemView
          onSelectPlanet={openPlanet}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}
      {view === "planet" && selectedPlanet && (
        <PlanetDetail planet={selectedPlanet} onBack={goHome} />
      )}

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
