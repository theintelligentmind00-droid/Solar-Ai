import { ArrowLeft } from "lucide-react";
import { type Planet } from "../api/agent";
import { SunChat } from "./SunChat";

interface Props {
  planet: Planet;
  onBack: () => void;
}

export function PlanetDetail({ planet, onBack }: Props) {
  const isSun = planet.id === "sun";

  return (
    <div className="flex flex-col h-screen" style={{ background: "var(--panel-bg)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700">
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-700"
        >
          <ArrowLeft size={18} />
        </button>
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ background: isSun ? "#FFD700" : planet.color, boxShadow: `0 0 8px ${isSun ? "#FFD700" : planet.color}` }}
        />
        <div>
          <h2 className="text-white font-semibold text-sm leading-tight">{planet.name}</h2>
          <p className="text-slate-500 text-xs">{isSun ? "Main agent" : `Project · ${planet.status}`}</p>
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-hidden">
        <SunChat planetId={planet.id} planetName={planet.name} />
      </div>
    </div>
  );
}
