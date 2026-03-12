import { useEffect, useState } from 'react';

type Period = 'dawn' | 'day' | 'dusk' | 'night';

export interface DayNightState {
  period: Period;
  progress: number; // 0-1 within current period
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function getTimeState(): DayNightState {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;

  if (hour >= 5 && hour < 8) {
    return { period: 'dawn', progress: (hour - 5) / 3 };
  } else if (hour >= 8 && hour < 17) {
    return { period: 'day', progress: (hour - 8) / 9 };
  } else if (hour >= 17 && hour < 20) {
    return { period: 'dusk', progress: (hour - 17) / 3 };
  } else {
    // Night: 20:00-05:00 (wraps around midnight)
    const nightHour = hour >= 20 ? hour - 20 : hour + 4;
    return { period: 'night', progress: nightHour / 9 };
  }
}

// Visual config at the START of each period -- we interpolate toward the next
interface PeriodColors {
  bgTintR: number; bgTintG: number; bgTintB: number; bgTintA: number;
  starOpacity: number;
  sunR: number; sunG: number; sunB: number;
  sunGlowIntensity: number;
  warmth: number;
}

const PERIOD_COLORS: Record<Period, PeriodColors> = {
  dawn: {
    bgTintR: 100, bgTintG: 80, bgTintB: 140, bgTintA: 0.03,
    starOpacity: 0.7,
    sunR: 255, sunG: 180, sunB: 100,
    sunGlowIntensity: 0.35,
    warmth: 0.2,
  },
  day: {
    bgTintR: 60, bgTintG: 50, bgTintB: 80, bgTintA: 0.02,
    starOpacity: 0.5,
    sunR: 255, sunG: 220, sunB: 140,
    sunGlowIntensity: 0.45,
    warmth: 0.3,
  },
  dusk: {
    bgTintR: 140, bgTintG: 80, bgTintB: 40, bgTintA: 0.04,
    starOpacity: 0.7,
    sunR: 245, sunG: 158, sunB: 11,
    sunGlowIntensity: 0.55,
    warmth: 0.5,
  },
  night: {
    bgTintR: 0, bgTintG: 0, bgTintB: 0, bgTintA: 0,
    starOpacity: 1.0,
    sunR: 220, sunG: 140, sunB: 50,
    sunGlowIntensity: 0.3,
    warmth: 0.1,
  },
};

const PERIOD_ORDER: Period[] = ['dawn', 'day', 'dusk', 'night'];

function applyColors(state: DayNightState): void {
  const currentIdx = PERIOD_ORDER.indexOf(state.period);
  const nextIdx = (currentIdx + 1) % PERIOD_ORDER.length;
  const cur = PERIOD_COLORS[PERIOD_ORDER[currentIdx]];
  const nxt = PERIOD_COLORS[PERIOD_ORDER[nextIdx]];
  const t = state.progress;

  const root = document.documentElement;

  // Background tint -- interpolate RGBA
  const tR = Math.round(lerp(cur.bgTintR, nxt.bgTintR, t));
  const tG = Math.round(lerp(cur.bgTintG, nxt.bgTintG, t));
  const tB = Math.round(lerp(cur.bgTintB, nxt.bgTintB, t));
  const tA = lerp(cur.bgTintA, nxt.bgTintA, t).toFixed(3);
  root.style.setProperty('--space-bg-tint', `rgba(${tR}, ${tG}, ${tB}, ${tA})`);

  // Star opacity
  root.style.setProperty('--star-opacity', lerp(cur.starOpacity, nxt.starOpacity, t).toFixed(3));

  // Sun color
  const sunR = Math.round(lerp(cur.sunR, nxt.sunR, t));
  const sunG = Math.round(lerp(cur.sunG, nxt.sunG, t));
  const sunB = Math.round(lerp(cur.sunB, nxt.sunB, t));
  root.style.setProperty('--sun-color-primary', `rgb(${sunR}, ${sunG}, ${sunB})`);

  // Sun glow intensity
  root.style.setProperty('--sun-glow-intensity', lerp(cur.sunGlowIntensity, nxt.sunGlowIntensity, t).toFixed(3));

  // Ambient warmth
  root.style.setProperty('--ambient-warmth', lerp(cur.warmth, nxt.warmth, t).toFixed(3));
}

export function useDayNightCycle(): DayNightState {
  const [state, setState] = useState<DayNightState>(getTimeState);

  useEffect(() => {
    // Apply immediately
    const current = getTimeState();
    setState(current);
    applyColors(current);

    // Update every 60 seconds
    const interval = setInterval(() => {
      const s = getTimeState();
      setState(s);
      applyColors(s);
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  return state;
}
