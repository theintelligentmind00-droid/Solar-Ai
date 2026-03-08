import { Plus, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, type Planet } from "../api/agent";

interface Props {
  onSelectPlanet: (planet: Planet) => void;
  onOpenSettings: () => void;
}

const ORBIT_SPEEDS = [80, 120, 160, 200, 240]; // seconds per revolution
const PLANET_COLORS = ["#6366f1", "#ec4899", "#14b8a6", "#f97316", "#8b5cf6"];

export function SolarSystemView({ onSelectPlanet, onOpenSettings }: Props) {
  const [planets, setPlanets] = useState<Planet[]>([]);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

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

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const color = PLANET_COLORS[planets.length % PLANET_COLORS.length];
    const planet = await api.createPlanet(newName.trim(), color);
    setPlanets((prev) => [...prev, planet]);
    setNewName("");
    setAdding(false);
    // Reload to get full planet data
    load();
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await api.deletePlanet(id);
    setPlanets((prev) => prev.filter((p) => p.id !== id));
  };

  const cx = 500; // SVG center x
  const cy = 350; // SVG center y

  return (
    <div className="relative w-full h-screen flex flex-col items-center">
      {/* Header */}
      <div className="absolute top-4 left-6 z-10">
        <h1 className="text-2xl font-bold text-yellow-400 tracking-wide">☀ Solar AI OS</h1>
        <p className="text-slate-400 text-sm">Your personal AI solar system</p>
      </div>

      {/* Settings button */}
      <button
        onClick={onOpenSettings}
        className="absolute top-4 right-6 z-10 text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800/60 transition-colors"
        title="Settings & Permissions"
      >
        <Settings size={18} />
      </button>

      {/* Error banner */}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-red-900/80 border border-red-500 text-red-200 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Solar System SVG */}
      <svg
        ref={svgRef}
        viewBox="0 0 1000 700"
        className="w-full h-full"
        style={{ position: "relative", zIndex: 1 }}
      >
        {/* Orbit rings */}
        {planets.map((planet, i) => {
          const r = 130 + i * 80;
          return (
            <circle
              key={`orbit-${planet.id}`}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
          );
        })}

        {/* Sun */}
        <g className="sun-glow" style={{ cursor: "pointer" }} onClick={() => onSelectPlanet({ id: "sun", name: "Sun — Main Agent", status: "active", orbit_radius: 0, color: "#FFD700", created_at: "" })}>
          <circle cx={cx} cy={cy} r={40} fill="#FFD700" opacity={0.15} />
          <circle cx={cx} cy={cy} r={28} fill="#FFD700" opacity={0.4} />
          <circle cx={cx} cy={cy} r={18} fill="#FFD700" />
          <text x={cx} y={cy + 52} textAnchor="middle" fill="#FFD700" fontSize="11" opacity={0.8}>
            Solar
          </text>
        </g>

        {/* Planets */}
        {planets.map((planet, i) => {
          const orbitR = 130 + i * 80;
          const speed = ORBIT_SPEEDS[i % ORBIT_SPEEDS.length];
          // Static angle for initial position (spread evenly)
          const angle = (i * 137.5 * Math.PI) / 180; // golden angle spread
          const px = cx + orbitR * Math.cos(angle);
          const py = cy + orbitR * Math.sin(angle);

          return (
            <g
              key={planet.id}
              style={{ cursor: "pointer" }}
              onClick={() => onSelectPlanet(planet)}
            >
              {/* Animated planet dot */}
              <animateTransform
                attributeName="transform"
                attributeType="XML"
                type="rotate"
                from={`0 ${cx} ${cy}`}
                to={`360 ${cx} ${cy}`}
                dur={`${speed}s`}
                repeatCount="indefinite"
              />
              <circle cx={px} cy={py} r={14} fill={planet.color} opacity={0.25} />
              <circle cx={px} cy={py} r={10} fill={planet.color} />
              <text x={px} y={py + 22} textAnchor="middle" fill="white" fontSize="9" opacity={0.8}>
                {planet.name.length > 12 ? planet.name.slice(0, 11) + "…" : planet.name}
              </text>
              {/* Delete button */}
              <circle
                cx={px + 12} cy={py - 12} r={7}
                fill="rgba(239,68,68,0.8)"
                onClick={(e) => handleDelete(e, planet.id)}
              />
              <text x={px + 12} y={py - 9} textAnchor="middle" fill="white" fontSize="9" style={{ pointerEvents: "none" }}>×</text>
            </g>
          );
        })}

        {/* Loading state */}
        {loading && (
          <text x={cx} y={cy + 80} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="13">
            Loading…
          </text>
        )}

        {/* Empty state */}
        {!loading && planets.length === 0 && !error && (
          <text x={cx} y={cy + 80} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="13">
            No planets yet — create your first project ↓
          </text>
        )}
      </svg>

      {/* Add planet panel */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
        {adding ? (
          <>
            <input
              autoFocus
              className="bg-slate-800 border border-slate-600 text-white rounded-lg px-4 py-2 text-sm w-56 focus:outline-none focus:border-yellow-400"
              placeholder="Project name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setAdding(false);
              }}
            />
            <button
              onClick={handleCreate}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold rounded-lg px-4 py-2 text-sm"
            >
              Create
            </button>
            <button
              onClick={() => setAdding(false)}
              className="text-slate-400 hover:text-white text-sm px-2"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded-full px-5 py-2 text-sm transition-colors"
          >
            <Plus size={14} /> New planet / project
          </button>
        )}
      </div>
    </div>
  );
}
