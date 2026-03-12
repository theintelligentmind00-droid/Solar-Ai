/**
 * Spaceship Landing Animation — SVG animated spaceship that flies from the Sun
 * to a newly created planet, loops it, and lands.
 *
 * 5 flight path variations, dust cloud on landing, then fades out.
 * Fires immediately after planet creation animation.
 */

import { useEffect, useRef, useState } from "react";
import { soundManager } from "../sounds/SoundManager";

const CX = 500;
const CY = 350;

// Arrival message variations
const ARRIVAL_MESSAGES = [
  (name: string) => `Houston has touched down at ${name}. Systems are online. What are we building?`,
  (name: string) => `Landing confirmed at ${name}. I've set up base camp. Where do we start?`,
  (name: string) => `This is Houston, reporting from the surface of ${name}. Ready for your first orders.`,
  (name: string) => `${name} — I like it here already. I've unpacked the gear. What's the plan?`,
  (name: string) => `Touchdown on ${name}. I've scanned the terrain — lots of potential. What's the mission brief?`,
  (name: string) => `Houston to Sun — I've arrived at ${name}. The view is incredible from down here. Let's get to work.`,
  (name: string) => `Made it to ${name} in one piece. Well, mostly — the landing was a bit bumpy. What do you need?`,
];

export function getArrivalMessage(planetName: string): string {
  const idx = Math.floor(Math.random() * ARRIVAL_MESSAGES.length);
  return ARRIVAL_MESSAGES[idx](planetName);
}

interface Point { x: number; y: number }

// Cubic bezier interpolation between two points with control points
function cubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

// Ease in-out cubic
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

interface FlightPath {
  duration: number;
  getPosition: (t: number, target: Point) => Point;
}

function createPaths(target: Point): FlightPath[] {
  const sun: Point = { x: CX, y: CY };

  return [
    // PATH 1: Direct approach — sun → planet with one loop
    {
      duration: 2.5,
      getPosition: (t: number) => {
        if (t < 0.6) {
          // Fly to planet
          const lt = easeInOut(t / 0.6);
          return cubicBezier(sun, { x: sun.x + (target.x - sun.x) * 0.3, y: sun.y - 40 }, { x: target.x - 30, y: target.y - 50 }, target, lt);
        }
        // Loop around
        const loopT = (t - 0.6) / 0.4;
        const angle = loopT * Math.PI * 2;
        const loopR = 25 * (1 - loopT * 0.6);
        return { x: target.x + Math.cos(angle) * loopR, y: target.y + Math.sin(angle) * loopR * 0.6 };
      },
    },
    // PATH 2: Victory lap — wide arc + two loops
    {
      duration: 3.0,
      getPosition: (t: number) => {
        if (t < 0.4) {
          const lt = easeInOut(t / 0.4);
          const midX = (sun.x + target.x) / 2 + 80;
          const midY = Math.min(sun.y, target.y) - 60;
          return cubicBezier(sun, { x: midX, y: midY }, { x: target.x + 40, y: target.y - 30 }, target, lt);
        }
        // Two loops
        const loopT = (t - 0.4) / 0.6;
        const angle = loopT * Math.PI * 4;
        const loopR = 30 * (1 - loopT * 0.5);
        return { x: target.x + Math.cos(angle) * loopR, y: target.y + Math.sin(angle) * loopR * 0.6 };
      },
    },
    // PATH 3: Scenic route — passes nearby then curves to target
    {
      duration: 3.5,
      getPosition: (t: number) => {
        if (t < 0.5) {
          const lt = easeInOut(t / 0.5);
          // Fly past to a side point
          const waypoint = { x: target.x + 120, y: target.y - 80 };
          return cubicBezier(sun, { x: sun.x + 60, y: sun.y - 30 }, { x: waypoint.x - 40, y: waypoint.y + 20 }, waypoint, lt);
        }
        if (t < 0.8) {
          const lt = easeInOut((t - 0.5) / 0.3);
          const waypoint = { x: target.x + 120, y: target.y - 80 };
          return cubicBezier(waypoint, { x: target.x + 80, y: target.y + 30 }, { x: target.x + 20, y: target.y - 20 }, target, lt);
        }
        const loopT = (t - 0.8) / 0.2;
        const angle = loopT * Math.PI * 2;
        const loopR = 20 * (1 - loopT * 0.7);
        return { x: target.x + Math.cos(angle) * loopR, y: target.y + Math.sin(angle) * loopR * 0.6 };
      },
    },
    // PATH 4: Figure eight
    {
      duration: 3.0,
      getPosition: (t: number) => {
        if (t < 0.3) {
          const lt = easeInOut(t / 0.3);
          return cubicBezier(sun, { x: (sun.x + target.x) / 2, y: sun.y - 40 }, { x: target.x, y: target.y - 40 }, target, lt);
        }
        // Figure eight
        const figT = (t - 0.3) / 0.7;
        const angle = figT * Math.PI * 2;
        const r = 35 * (1 - figT * 0.6);
        return {
          x: target.x + Math.sin(angle * 2) * r,
          y: target.y + Math.sin(angle) * r * 0.5,
        };
      },
    },
    // PATH 5: Comet — from edge of viewport
    {
      duration: 3.0,
      getPosition: (() => {
        const edge = { x: -100, y: Math.random() * 200 + 100 };
        return (t: number) => {
        if (t < 0.5) {
          const lt = easeInOut(t / 0.5);
          return cubicBezier(edge, { x: CX, y: CY - 60 }, { x: target.x + 60, y: target.y - 40 }, target, lt);
        }
        const loopT = (t - 0.5) / 0.5;
        const angle = loopT * Math.PI * 2;
        const loopR = 25 * (1 - loopT * 0.8);
        return { x: target.x + Math.cos(angle) * loopR, y: target.y + Math.sin(angle) * loopR * 0.6 };
        };
      })(),
    },
  ];
}

interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  opacity: number;
  life: number;
}

interface Props {
  targetX: number;
  targetY: number;
  onComplete: () => void;
  /** If true, skip/accelerate on click */
  skippable?: boolean;
}

export function SpaceshipAnimation({ targetX, targetY, onComplete, skippable = true }: Props) {
  const [shipPos, setShipPos] = useState<Point>({ x: CX, y: CY });
  const [shipAngle, setShipAngle] = useState(0);
  const [shipScale, setShipScale] = useState(1);
  const [shipOpacity, setShipOpacity] = useState(1);
  const [engineGlow, setEngineGlow] = useState(1);
  const [dustParticles, setDustParticles] = useState<DustParticle[]>([]);
  const [exhaust, setExhaust] = useState<Array<{ x: number; y: number; opacity: number }>>([]);
  const [landed, setLanded] = useState(false);

  const rafRef = useRef(0);
  const startRef = useRef(0);
  const pathRef = useRef<FlightPath | null>(null);
  const skippedRef = useRef(false);
  const prevPosRef = useRef<Point>({ x: CX, y: CY });
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const target: Point = { x: targetX, y: targetY };

  const landSoundPlayed = useRef(false);

  useEffect(() => {
    const paths = createPaths(target);
    const pathIdx = Math.floor(Math.random() * paths.length);
    pathRef.current = paths[pathIdx];
    startRef.current = performance.now();
    landSoundPlayed.current = false;
    soundManager.play("ship_engine_start");

    const animate = (now: number) => {
      const path = pathRef.current;
      if (!path) return;

      const elapsed = (now - startRef.current) / 1000;
      const totalDur = path.duration + 0.8; // + landing time
      const t = Math.min(1, elapsed / path.duration);

      if (elapsed < path.duration) {
        // Flying phase
        const pos = path.getPosition(t, target);
        setShipPos(pos);

        // Calculate angle from velocity
        const prev = prevPosRef.current;
        const dx = pos.x - prev.x;
        const dy = pos.y - prev.y;
        if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
          setShipAngle(Math.atan2(dy, dx) * 180 / Math.PI);
        }
        prevPosRef.current = pos;

        // Engine glow scales with speed
        const speed = Math.sqrt(dx * dx + dy * dy);
        setEngineGlow(Math.min(1, speed / 8));

        // Exhaust trail
        setExhaust(prev => {
          const next = [...prev, { x: pos.x, y: pos.y, opacity: 0.6 }];
          return next.slice(-12).map((e, i) => ({
            ...e,
            opacity: (i / 12) * 0.3,
          }));
        });
      } else if (elapsed < path.duration + 0.5) {
        // Landing phase
        const landT = (elapsed - path.duration) / 0.5;
        setShipPos(target);
        setShipScale(1 - landT * 0.4); // shrink to 60%
        setEngineGlow(Math.max(0, 1 - landT * 2));

        if (landT > 0.7 && !landed) {
          setLanded(true);
          if (!landSoundPlayed.current) {
            landSoundPlayed.current = true;
            soundManager.play("ship_land");
          }
          // Create dust cloud
          const dust: DustParticle[] = [];
          for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2;
            dust.push({
              x: target.x,
              y: target.y,
              vx: Math.cos(angle) * (2 + Math.random() * 3),
              vy: Math.sin(angle) * (1 + Math.random() * 2) - 1,
              r: 1 + Math.random() * 2,
              opacity: 0.5 + Math.random() * 0.3,
              life: 1,
            });
          }
          setDustParticles(dust);
        }

        // Bounce at end
        if (landT > 0.8) {
          const bounceT = (landT - 0.8) / 0.2;
          const bounce = Math.sin(bounceT * Math.PI) * 2;
          setShipPos({ x: target.x, y: target.y - bounce });
        }
      } else if (elapsed < totalDur) {
        // Fade out
        const fadeT = (elapsed - path.duration - 0.5) / 0.3;
        setShipOpacity(Math.max(0, 1 - fadeT));

        // Update dust
        setDustParticles(prev => prev.map(d => ({
          ...d,
          x: d.x + d.vx * 0.5,
          y: d.y + d.vy * 0.5,
          vy: d.vy + 0.05,
          opacity: d.opacity * 0.92,
          life: d.life - 0.03,
        })).filter(d => d.life > 0));
      } else {
        onCompleteRef.current();
        return;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetX, targetY]);

  // Skip handler
  const handleClick = () => {
    if (skippable && !skippedRef.current) {
      skippedRef.current = true;
      cancelAnimationFrame(rafRef.current);
      setShipPos(target);
      setShipOpacity(0);
      onComplete();
    }
  };

  return (
    <g onClick={handleClick} style={{ cursor: skippable ? "pointer" : "default" }}>
      {/* Exhaust trail */}
      {exhaust.map((e, i) => (
        <circle
          key={`ex${i}`}
          cx={e.x}
          cy={e.y}
          r={1.5 - i * 0.1}
          fill="rgba(100,180,255,0.4)"
          opacity={e.opacity}
        />
      ))}

      {/* Dust particles */}
      {dustParticles.map((d, i) => (
        <circle
          key={`dust${i}`}
          cx={d.x}
          cy={d.y}
          r={d.r}
          fill="rgba(180,160,140,0.6)"
          opacity={d.opacity}
        />
      ))}

      {/* Ship */}
      <g
        transform={`translate(${shipPos.x}, ${shipPos.y}) rotate(${shipAngle}) scale(${shipScale})`}
        opacity={shipOpacity}
      >
        {/* Engine glow */}
        <ellipse
          cx={-8}
          cy={0}
          rx={6 + engineGlow * 8}
          ry={2 + engineGlow * 2}
          fill="rgba(100,180,255,0.5)"
          opacity={engineGlow * 0.8}
        />
        <ellipse
          cx={-5}
          cy={0}
          rx={3 + engineGlow * 4}
          ry={1 + engineGlow * 1}
          fill="rgba(200,230,255,0.8)"
          opacity={engineGlow * 0.9}
        />

        {/* Body — sleek arrow shape */}
        <polygon
          points="12,-4 -4,-6 -8,0 -4,6 12,4"
          fill="#E8E8E8"
          stroke="rgba(200,200,200,0.6)"
          strokeWidth="0.4"
        />
        {/* Accent stripe — sun color */}
        <line
          x1="-2"
          y1="-3"
          x2="10"
          y2="-1.5"
          stroke="rgba(245,158,11,0.6)"
          strokeWidth="1.2"
        />
        {/* Cockpit window */}
        <ellipse cx="6" cy="0" rx="2.5" ry="1.8" fill="rgba(150,220,255,0.4)" />
      </g>
    </g>
  );
}
