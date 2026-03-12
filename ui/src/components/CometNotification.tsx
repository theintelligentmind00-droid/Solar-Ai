/**
 * Comet Notification — SVG animated comet that streaks across the solar system
 * and impacts/orbits the relevant planet.
 *
 * Types: email (blue), calendar (green), task (amber), alert (red)
 */

import { useEffect, useRef, useState } from "react";
import { soundManager } from "../sounds/SoundManager";

type NotificationType = "email" | "calendar" | "task" | "alert";

const COMET_COLORS: Record<NotificationType, string> = {
  email: "#4A9EFF",
  calendar: "#4AFF7F",
  task: "#FFB84A",
  alert: "#FF4A4A",
};

interface CometData {
  id: string;
  type: NotificationType;
  targetX: number;
  targetY: number;
  message?: string;
  urgent?: boolean;
}

interface ActiveComet extends CometData {
  startX: number;
  startY: number;
  controlX: number;
  controlY: number;
  startTime: number;
  phase: "flying" | "orbiting" | "merged";
  orbitAngle: number;
  orbitCount: number;
}

interface Props {
  comets: CometData[];
  onCometArrived?: (id: string) => void;
}

export function CometNotificationLayer({ comets, onCometArrived }: Props) {
  const [activeComets, setActiveComets] = useState<ActiveComet[]>([]);
  const [cometPositions, setCometPositions] = useState<
    Map<string, { x: number; y: number; angle: number; tailLength: number; opacity: number; phase: string }>
  >(new Map());
  const rafRef = useRef(0);
  const processedRef = useRef(new Set<string>());
  const arrivedRef = useRef(new Set<string>());

  const pendingQueueRef = useRef<CometData[]>([]);
  const drainTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Queue new comets with priority ordering (urgent first) and staggered dispatch
  useEffect(() => {
    const newComets = comets.filter(c => !processedRef.current.has(c.id));
    if (newComets.length === 0) return;

    newComets.forEach(c => processedRef.current.add(c.id));

    // Sort: urgent first, then by type priority (alert > email > calendar > task)
    const typePriority: Record<NotificationType, number> = { alert: 0, email: 1, calendar: 2, task: 3 };
    const sorted = [...newComets].sort((a, b) => {
      if (a.urgent && !b.urgent) return -1;
      if (!a.urgent && b.urgent) return 1;
      return typePriority[a.type] - typePriority[b.type];
    });

    pendingQueueRef.current.push(...sorted);
    drainQueue();
  }, [comets]); // eslint-disable-line react-hooks/exhaustive-deps

  const spawnComet = (comet: CometData) => {
    // Random spawn edge
    const edge = Math.floor(Math.random() * 4);
    let startX: number, startY: number;
    if (edge === 0) { startX = Math.random() * 1000; startY = -50; }
    else if (edge === 1) { startX = 1050; startY = Math.random() * 700; }
    else if (edge === 2) { startX = Math.random() * 1000; startY = 750; }
    else { startX = -50; startY = Math.random() * 700; }

    soundManager.play(comet.urgent ? "notif_urgent" : "notif_comet");
    const controlX = (startX + comet.targetX) / 2 + (Math.random() - 0.5) * 60;
    const controlY = (startY + comet.targetY) / 2 + (Math.random() - 0.5) * 60;

    setActiveComets(prev => [...prev, {
      ...comet,
      startX,
      startY,
      controlX,
      controlY,
      startTime: performance.now(),
      phase: "flying" as const,
      orbitAngle: 0,
      orbitCount: 0,
    }]);
  };

  const drainQueue = () => {
    if (drainTimerRef.current) return; // already draining
    const tryDrain = () => {
      if (pendingQueueRef.current.length === 0) {
        drainTimerRef.current = undefined;
        return;
      }
      setActiveComets(prev => {
        const flyingCount = prev.filter(c => c.phase === "flying").length;
        if (flyingCount >= 3) {
          // Retry in 600ms
          drainTimerRef.current = setTimeout(tryDrain, 600);
          return prev;
        }
        const next = pendingQueueRef.current.shift();
        if (next) {
          // Schedule spawn outside setState
          setTimeout(() => spawnComet(next), 0);
        }
        // Schedule next drain
        drainTimerRef.current = setTimeout(tryDrain, 400);
        return prev;
      });
    };
    tryDrain();
  };

  // Cleanup drain timer on unmount
  useEffect(() => {
    return () => { if (drainTimerRef.current) clearTimeout(drainTimerRef.current); };
  }, []);

  // Animation loop
  useEffect(() => {
    if (activeComets.length === 0) return;

    const animate = (now: number) => {
      const newPositions = new Map<string, { x: number; y: number; angle: number; tailLength: number; opacity: number; phase: string }>();
      let needsUpdate = false;

      setActiveComets(prev => {
        const updated: ActiveComet[] = [];
        for (const comet of prev) {
          const elapsed = (now - comet.startTime) / 1000;

          if (comet.phase === "flying") {
            const flyDur = 1.5;
            const t = Math.min(1, elapsed / flyDur);
            // Smooth curve toward target using pre-computed control point
            const { controlX: midX, controlY: midY } = comet;
            const mt = 1 - t;
            const x = mt * mt * comet.startX + 2 * mt * t * midX + t * t * comet.targetX;
            const y = mt * mt * comet.startY + 2 * mt * t * midY + t * t * comet.targetY;

            // Direction angle
            const prevT = Math.max(0, t - 0.02);
            const prevMt = 1 - prevT;
            const prevX = prevMt * prevMt * comet.startX + 2 * prevMt * prevT * midX + prevT * prevT * comet.targetX;
            const prevY = prevMt * prevMt * comet.startY + 2 * prevMt * prevT * midY + prevT * prevT * comet.targetY;
            const angle = Math.atan2(y - prevY, x - prevX) * 180 / Math.PI;

            const speed = Math.sqrt((x - prevX) ** 2 + (y - prevY) ** 2) / 0.02;
            const tailLength = Math.min(40, speed * 2);

            newPositions.set(comet.id, { x, y, angle, tailLength, opacity: 1, phase: "flying" });

            if (t >= 1) {
              // Arrived — transition to orbiting or merged
              if (!arrivedRef.current.has(comet.id)) {
                arrivedRef.current.add(comet.id);
                onCometArrived?.(comet.id);
              }
              if (comet.urgent) {
                updated.push({ ...comet, phase: "orbiting", startTime: now, orbitAngle: 0, orbitCount: 0 });
              } else {
                // Brief flash and merge
                newPositions.set(comet.id, { x: comet.targetX, y: comet.targetY, angle: 0, tailLength: 0, opacity: 0.8, phase: "merged" });
                updated.push({ ...comet, phase: "merged", startTime: now });
              }
              needsUpdate = true;
            } else {
              updated.push(comet);
            }
          } else if (comet.phase === "orbiting") {
            const orbitDur = 2.0;
            const orbitT = (elapsed) / orbitDur;
            if (orbitT >= 1) {
              // Done orbiting — merge
              newPositions.set(comet.id, { x: comet.targetX, y: comet.targetY, angle: 0, tailLength: 0, opacity: 0, phase: "merged" });
              updated.push({ ...comet, phase: "merged", startTime: now });
              needsUpdate = true;
            } else {
              const angle = orbitT * Math.PI * 6; // 3 orbits
              const orbitR = 20 * (1 - orbitT * 0.5);
              const x = comet.targetX + Math.cos(angle) * orbitR;
              const y = comet.targetY + Math.sin(angle) * orbitR * 0.6;
              const dirAngle = Math.atan2(Math.sin(angle) * 0.6, Math.cos(angle)) * 180 / Math.PI + 90;
              newPositions.set(comet.id, { x, y, angle: dirAngle, tailLength: 15, opacity: 1 - orbitT * 0.3, phase: "orbiting" });
              updated.push(comet);
            }
          } else {
            // Merged — fade out
            const fadeT = elapsed;
            if (fadeT > 0.5) continue; // remove
            newPositions.set(comet.id, { x: comet.targetX, y: comet.targetY, angle: 0, tailLength: 0, opacity: Math.max(0, 0.8 - fadeT * 2), phase: "merged" });
            updated.push(comet);
          }
        }
        if (needsUpdate || updated.length !== prev.length) return updated;
        return prev;
      });

      setCometPositions(newPositions);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [activeComets.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <g>
      <defs>
        <filter id="comet-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {Array.from(cometPositions.entries()).map(([id, pos]) => {
        const comet = activeComets.find(c => c.id === id);
        if (!comet) return null;
        const color = COMET_COLORS[comet.type];

        return (
          <g key={id} opacity={pos.opacity}>
            {/* Tail */}
            {pos.tailLength > 0 && (
              <line
                x1={pos.x}
                y1={pos.y}
                x2={pos.x - Math.cos(pos.angle * Math.PI / 180) * pos.tailLength}
                y2={pos.y - Math.sin(pos.angle * Math.PI / 180) * pos.tailLength}
                stroke={color}
                strokeWidth={3}
                strokeLinecap="round"
                opacity={0.4}
                filter="url(#comet-glow)"
              />
            )}

            {/* Head glow */}
            <circle cx={pos.x} cy={pos.y} r={8} fill={color} opacity={0.15} filter="url(#comet-glow)" />

            {/* Head core */}
            <circle cx={pos.x} cy={pos.y} r={3} fill="white" opacity={0.9} />
            <circle cx={pos.x} cy={pos.y} r={4} fill={color} opacity={0.6} />

            {/* Impact flash when merged */}
            {pos.phase === "merged" && pos.opacity > 0.3 && (
              <circle cx={pos.x} cy={pos.y} r={12} fill={color} opacity={pos.opacity * 0.3} filter="url(#comet-glow)" />
            )}
          </g>
        );
      })}
    </g>
  );
}
