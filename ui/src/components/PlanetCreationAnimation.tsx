/**
 * Planet Creation Animation — SVG particle accretion → ignition → reveal
 * Rendered as an overlay inside the SolarSystemView SVG.
 *
 * Timeline:
 *   0.0–0.5s  GATHERING — particles spiral inward from random positions
 *   0.5–1.5s  ACCRETION — particles absorbed, central mass grows
 *   1.5–2.0s  IGNITION  — remaining rush in, flash burst
 *   2.0–2.5s  REVEAL    — planet appears, shockwave ring expands
 *   2.5–3.0s  SETTLE    — orbit ring draws, everything normalises
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { soundManager } from "../sounds/SoundManager";

// ── Planet type → flash color + palette ─────────────────────────
const TYPE_PALETTES: Record<string, { flash: string; particles: string[] }> = {
  terra:   { flash: "#c0e0ff", particles: ["#29b6f6","#66bb6a","#1a3a5c","#c5eafe","#0288d1"] },
  forge:   { flash: "#ffa040", particles: ["#ff5722","#e64a19","#ff9800","#7d3c10","#ff7043"] },
  oasis:   { flash: "#d0a0ff", particles: ["#ce93d8","#ab47bc","#80deea","#4dd0e1","#e1bee7"] },
  nexus:   { flash: "#80e0ff", particles: ["#4fc3f7","#0288d1","#81d4fa","#00acc1","#b3e5fc"] },
  citadel: { flash: "#e0f0ff", particles: ["#90caf9","#b0bec5","#cfd8dc","#78909c","#eceff1"] },
  gaia:    { flash: "#ffe0b0", particles: ["#81c784","#a5d6a7","#ffcc80","#c8e6c9","#dce775"] },
  void:    { flash: "#b080ff", particles: ["#7c4dff","#b388ff","#311b92","#9575cd","#1a237e"] },
};

// fallback
const DEFAULT_PALETTE = TYPE_PALETTES.terra;

interface Particle {
  x: number;
  y: number;
  startAngle: number;
  startRadius: number;
  spiralTightness: number;
  radius: number;
  color: string;
  opacity: number;
  absorbed: boolean;
  speed: number;
}

interface Props {
  /** Center X of the target orbit position in SVG coords */
  targetX: number;
  /** Center Y of the target orbit position in SVG coords */
  targetY: number;
  /** Planet type for color palette */
  planetType?: string;
  /** Called when animation completes */
  onComplete: () => void;
  /** Called after reveal — planet should now be visible at target */
  onReveal?: () => void;
}

export function PlanetCreationAnimation({ targetX, targetY, planetType, onComplete, onReveal }: Props) {
  const canvasRef = useRef<SVGGElement>(null);
  const rafRef = useRef(0);
  const startTimeRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const [centralR, setCentralR] = useState(0);
  const [centralOp, setCentralOp] = useState(0);
  const [flashR, setFlashR] = useState(0);
  const [flashOp, setFlashOp] = useState(0);
  const [shockR, setShockR] = useState(0);
  const [shockOp, setShockOp] = useState(0);
  const [orbitProgress, setOrbitProgress] = useState(0);
  const [particleState, setParticleState] = useState<Array<{ x: number; y: number; r: number; color: string; opacity: number }>>([]);
  const revealedRef = useRef(false);
  const soundsPlayed = useRef({ rumble: false, boom: false, settle: false });

  const palette = TYPE_PALETTES[planetType ?? "terra"] ?? DEFAULT_PALETTE;

  // Spawn variation: random direction bias
  const variationRef = useRef(Math.floor(Math.random() * 4));
  const spiralDir = useRef(Math.random() > 0.5 ? 1 : -1);

  const initParticles = useCallback(() => {
    const ps: Particle[] = [];
    const variation = variationRef.current;
    const count = 60 + Math.floor(Math.random() * 20);

    for (let i = 0; i < count; i++) {
      // Spawn position based on variation
      let angle: number;
      if (variation === 0) angle = (Math.random() * 0.4 + 0.3) * Math.PI * 2; // top/bottom
      else if (variation === 1) angle = (Math.random() * 0.4 + 0.05) * Math.PI * 2; // left/right
      else if (variation === 2) angle = Math.random() * Math.PI * 2; // radial
      else angle = (Math.random() * 0.2) * Math.PI * 2; // directional

      const startRadius = 200 + Math.random() * 300;
      const x = targetX + Math.cos(angle) * startRadius;
      const y = targetY + Math.sin(angle) * startRadius;

      ps.push({
        x,
        y,
        startAngle: angle,
        startRadius,
        spiralTightness: 3 + Math.random() * 5,
        radius: 1.5 + Math.random() * 3.5,
        color: palette.particles[i % palette.particles.length],
        opacity: 0.6 + Math.random() * 0.4,
        absorbed: false,
        speed: 0.6 + Math.random() * 0.6,
      });
    }
    particlesRef.current = ps;
  }, [targetX, targetY, palette]);

  useEffect(() => {
    initParticles();
    startTimeRef.current = performance.now();
    soundsPlayed.current = { rumble: false, boom: false, settle: false };
    // Start rumble immediately
    soundManager.play("creation_rumble");
    soundsPlayed.current.rumble = true;

    const animate = (now: number) => {
      const elapsed = (now - startTimeRef.current) / 1000;

      // Sound triggers at phase transitions
      if (elapsed >= 1.5 && !soundsPlayed.current.boom) {
        soundsPlayed.current.boom = true;
        soundManager.play("creation_boom");
      }
      if (elapsed >= 2.5 && !soundsPlayed.current.settle) {
        soundsPlayed.current.settle = true;
        soundManager.play("creation_settle");
      }
      const dir = spiralDir.current;
      const ps = particlesRef.current;
      const visible: Array<{ x: number; y: number; r: number; color: string; opacity: number }> = [];

      // Phase timing
      const GATHER_END = 0.5;
      const ACCRETE_END = 1.5;
      const IGNITE_END = 2.0;
      const REVEAL_END = 2.5;
      const SETTLE_END = 3.0;

      // Update particles
      for (const p of ps) {
        if (p.absorbed) continue;

        // Calculate progress: how far this particle is through its journey
        const speedMult = elapsed > ACCRETE_END ? 4.0 : elapsed > GATHER_END ? 1.5 : 1.0;
        const t = Math.min(1, (elapsed * p.speed * speedMult) / 2.0);
        const easeT = t * t; // ease-in

        // Spiral toward center
        const currRadius = p.startRadius * (1 - easeT);
        const spiralAngle = p.startAngle + easeT * p.spiralTightness * dir;

        p.x = targetX + currRadius * Math.cos(spiralAngle);
        p.y = targetY + currRadius * Math.sin(spiralAngle);

        // Absorption check
        if (currRadius < 3) {
          p.absorbed = true;
          continue;
        }

        // Shrink as approaching
        const sizeT = Math.max(0, 1 - easeT * 0.7);
        visible.push({
          x: p.x,
          y: p.y,
          r: p.radius * sizeT,
          color: p.color,
          opacity: p.opacity * sizeT,
        });
      }

      setParticleState(visible);

      // Central mass growth
      const absorbedCount = ps.filter(p => p.absorbed).length;
      const growthT = absorbedCount / ps.length;
      setCentralR(3 + growthT * 8);
      setCentralOp(Math.min(1, growthT * 1.5));

      // IGNITION flash (1.5–2.0s)
      if (elapsed > ACCRETE_END && elapsed < IGNITE_END) {
        const flashT = (elapsed - ACCRETE_END) / (IGNITE_END - ACCRETE_END);
        if (flashT < 0.3) {
          setFlashR(10 + flashT * 200);
          setFlashOp(1);
        } else {
          setFlashR(10 + 0.3 * 200 + (flashT - 0.3) * 40);
          setFlashOp(Math.max(0, 1 - (flashT - 0.3) / 0.7));
        }
      } else if (elapsed >= IGNITE_END) {
        setFlashOp(0);
      }

      // REVEAL (2.0–2.5s)
      if (elapsed > IGNITE_END && elapsed < REVEAL_END) {
        if (!revealedRef.current) {
          revealedRef.current = true;
          onReveal?.();
        }
        const revealT = (elapsed - IGNITE_END) / (REVEAL_END - IGNITE_END);
        // Shockwave
        setShockR(20 + revealT * 80);
        setShockOp(Math.max(0, 1 - revealT));
      } else if (elapsed >= REVEAL_END) {
        setShockOp(0);
      }

      // SETTLE (2.5–3.0s)
      if (elapsed > REVEAL_END && elapsed < SETTLE_END) {
        const settleT = (elapsed - REVEAL_END) / (SETTLE_END - REVEAL_END);
        setOrbitProgress(settleT);
      } else if (elapsed >= SETTLE_END) {
        setOrbitProgress(1);
        onComplete();
        return; // stop animation
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [initParticles, onComplete, onReveal, targetX, targetY]);

  return (
    <g ref={canvasRef}>
      {/* Glow filter */}
      <defs>
        <filter id="creation-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* Particles */}
      {particleState.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={p.r}
          fill={p.color}
          opacity={p.opacity}
          filter="url(#creation-glow)"
        />
      ))}

      {/* Central growing mass */}
      {centralOp > 0 && (
        <>
          <circle
            cx={targetX}
            cy={targetY}
            r={centralR * 2}
            fill={palette.flash}
            opacity={centralOp * 0.15}
            filter="url(#creation-glow)"
          />
          <circle
            cx={targetX}
            cy={targetY}
            r={centralR}
            fill="white"
            opacity={centralOp * 0.9}
          />
        </>
      )}

      {/* Ignition flash */}
      {flashOp > 0 && (
        <circle
          cx={targetX}
          cy={targetY}
          r={flashR}
          fill={palette.flash}
          opacity={flashOp * 0.6}
          filter="url(#creation-glow)"
        />
      )}

      {/* Shockwave ring */}
      {shockOp > 0 && (
        <circle
          cx={targetX}
          cy={targetY}
          r={shockR}
          fill="none"
          stroke={palette.flash}
          strokeWidth={2}
          opacity={shockOp * 0.5}
        />
      )}

      {/* Orbit progress ring (draws itself) */}
      {orbitProgress > 0 && orbitProgress < 1 && (
        <circle
          cx={targetX}
          cy={targetY}
          r={30}
          fill="none"
          stroke="rgba(245,158,11,0.15)"
          strokeWidth={0.65}
          strokeDasharray={`${orbitProgress * 188.5} ${188.5}`}
          style={{ pointerEvents: "none" }}
        />
      )}
    </g>
  );
}
