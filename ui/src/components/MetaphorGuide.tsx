import { X } from "lucide-react";

interface Props {
  onClose: () => void;
}

interface MetaphorEntry {
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  glow: string;
}

const entries: MetaphorEntry[] = [
  {
    icon: "☀",
    title: "The Sun",
    subtitle: "YOUR AI BRAIN",
    description:
      "The Sun is your personal AI — always at the center, always radiating intelligence outward. Every conversation, every decision, every insight pulses from here. Its gravity holds your entire life in orbit.",
    color: "#f59e0b",
    glow: "rgba(245,158,11,0.35)",
  },
  {
    icon: "🌍",
    title: "Planets",
    subtitle: "LIFE AREAS & PROJECTS",
    description:
      "Each planet is a domain of your life — a project, a goal, a responsibility. Planets orbit the Sun constantly, growing in civilization as you engage with them. Click one to open its mission briefing and start a conversation.",
    color: "#60a5fa",
    glow: "rgba(96,165,250,0.3)",
  },
  {
    icon: "🌑",
    title: "Moons",
    subtitle: "TASK HUBS",
    description:
      "Moons orbit planets, tethered to them by gravity. Each moon is a task hub — a cluster of to-dos, reminders, and action items tied to its parent planet. Zoom in to see them clearly.",
    color: "#94a3b8",
    glow: "rgba(148,163,184,0.3)",
  },
  {
    icon: "🛰",
    title: "Satellites",
    subtitle: "INTEGRATION RELAYS",
    description:
      "Satellites are your data conduits — Gmail, Calendar, Notion, Slack. They orbit planets as silent sentinels, beaming real-world signals into your AI brain. Three types exist: Integration Relays, Orbital Sensors, and Signal Beacons.",
    color: "#a78bfa",
    glow: "rgba(167,139,250,0.3)",
  },
  {
    icon: "🛰",
    title: "Space Stations",
    subtitle: "SUBAGENT HUBS",
    description:
      "Space Stations are orbital command platforms hosting specialized AI subagents. While the Sun is your central intelligence, Space Stations run focused autonomous missions — research, monitoring, analysis, or automation. Deploy one when a project needs a dedicated AI crew working in parallel.",
    color: "#22d3ee",
    glow: "rgba(34,211,238,0.3)",
  },
  {
    icon: "🪨",
    title: "Asteroids",
    subtitle: "THE NOISE",
    description:
      "The asteroid belt drifts between the inner and outer planets — fragments of things that never became anything. Interruptions, distractions, half-formed ideas. Your AI helps you deflect them or mine them for value.",
    color: "#78716c",
    glow: "rgba(120,113,108,0.25)",
  },
];

const civLevels = [
  { level: 0, name: "OUTPOST",    age: "< 1 hour",   icon: "⛺", desc: "A fresh claim. Just you and the raw terrain." },
  { level: 1, name: "SETTLEMENT", age: "1–24 hours",  icon: "🏕", desc: "First structures. A community taking shape." },
  { level: 2, name: "COLONY",     age: "1–7 days",    icon: "🏘", desc: "A town with purpose. Buildings light the night." },
  { level: 3, name: "METROPOLIS", age: "7+ days",     icon: "🌆", desc: "A thriving city. Zoom in to see the skyline glow." },
];

export function MetaphorGuide({ onClose }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(4,2,14,0.97)",
        backdropFilter: "blur(24px)",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Header */}
      <div
        style={{
          width: "100%",
          maxWidth: "860px",
          padding: "48px 32px 0",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "48px",
            right: "32px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "8px",
            color: "var(--text-dim)",
            cursor: "pointer",
            padding: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)";
            (e.currentTarget as HTMLButtonElement).style.color = "white";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-dim)";
          }}
        >
          <X size={18} />
        </button>

        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <div
            style={{
              display: "inline-block",
              fontSize: "11px",
              letterSpacing: "0.18em",
              color: "var(--text-dim)",
              textTransform: "uppercase",
              marginBottom: "14px",
            }}
          >
            Solar AI OS — System Codex
          </div>
          <h1
            style={{
              fontSize: "clamp(24px, 4vw, 40px)",
              fontWeight: 700,
              color: "white",
              margin: 0,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
            }}
          >
            The Universe&nbsp;as&nbsp;Metaphor
          </h1>
          <p
            style={{
              fontSize: "15px",
              color: "var(--text-dim)",
              marginTop: "12px",
              maxWidth: "520px",
              marginLeft: "auto",
              marginRight: "auto",
              lineHeight: 1.65,
            }}
          >
            Every element in this solar system represents a real part of your
            life and work. Understand the map, and the cosmos becomes your
            command center.
          </p>
        </div>

        {/* Divider */}
        <div
          style={{
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(167,139,250,0.2) 40%, rgba(167,139,250,0.2) 60%, transparent)",
            margin: "36px 0",
          }}
        />
      </div>

      {/* Main entries */}
      <div
        style={{
          width: "100%",
          maxWidth: "860px",
          padding: "0 32px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {entries.map((e) => (
          <div
            key={e.title}
            style={{
              display: "flex",
              gap: "24px",
              padding: "28px 28px",
              background: "rgba(255,255,255,0.025)",
              border: `1px solid rgba(255,255,255,0.06)`,
              borderRadius: "16px",
              alignItems: "flex-start",
              boxShadow: `0 0 40px ${e.glow}`,
              transition: "all 0.2s",
            }}
            onMouseEnter={(el) => {
              (el.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)";
              (el.currentTarget as HTMLDivElement).style.borderColor = `${e.color}22`;
            }}
            onMouseLeave={(el) => {
              (el.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.025)";
              (el.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.06)";
            }}
          >
            {/* Icon orb */}
            <div
              style={{
                flexShrink: 0,
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: `radial-gradient(circle at 35% 35%, ${e.color}33, ${e.color}08)`,
                border: `1px solid ${e.color}30`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "28px",
                boxShadow: `0 0 24px ${e.glow}`,
              }}
            >
              {e.icon}
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "white",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {e.title}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    letterSpacing: "0.14em",
                    color: e.color,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    padding: "2px 8px",
                    background: `${e.color}14`,
                    borderRadius: "20px",
                    border: `1px solid ${e.color}25`,
                  }}
                >
                  {e.subtitle}
                </span>
              </div>
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--text-dim)",
                  marginTop: "8px",
                  lineHeight: 1.7,
                  margin: "8px 0 0",
                }}
              >
                {e.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Civilization levels */}
      <div
        style={{
          width: "100%",
          maxWidth: "860px",
          padding: "0 32px",
          marginTop: "48px",
        }}
      >
        <div
          style={{
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(167,139,250,0.2) 40%, rgba(167,139,250,0.2) 60%, transparent)",
            marginBottom: "36px",
          }}
        />

        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              fontSize: "10px",
              letterSpacing: "0.18em",
              color: "var(--text-dim)",
              textTransform: "uppercase",
              marginBottom: "10px",
            }}
          >
            Civilization Progression
          </div>
          <h2
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "white",
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            Planets Evolve Over Time
          </h2>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-dim)",
              marginTop: "8px",
              lineHeight: 1.6,
            }}
          >
            As a planet ages, its civilization grows. Zoom in to see buildings, lights, and city grids appear.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px",
          }}
        >
          {civLevels.map((c) => (
            <div
              key={c.level}
              style={{
                padding: "20px",
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "14px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "28px", marginBottom: "10px" }}>{c.icon}</div>
              <div
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.14em",
                  color: "#a78bfa",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  marginBottom: "4px",
                }}
              >
                {c.name}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "rgba(255,255,255,0.35)",
                  marginBottom: "10px",
                }}
              >
                {c.age}
              </div>
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--text-dim)",
                  lineHeight: 1.55,
                  margin: 0,
                }}
              >
                {c.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          width: "100%",
          maxWidth: "860px",
          padding: "40px 32px 64px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(167,139,250,0.15) 50%, transparent)",
            marginBottom: "28px",
          }}
        />
        <div
          style={{
            fontSize: "12px",
            color: "rgba(255,255,255,0.2)",
            letterSpacing: "0.06em",
            lineHeight: 1.8,
          }}
        >
          Solar AI OS — Your AI, at the center of everything.
          <br />
          The universe is not a map. It is a mirror.
        </div>
      </div>
    </div>
  );
}
