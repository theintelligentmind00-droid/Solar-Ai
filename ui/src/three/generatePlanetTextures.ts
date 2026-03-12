import { createNoise3D, type NoiseFunction3D } from 'simplex-noise';

/* ── Seeded PRNG ──────────────────────────────────────────────────── */

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return h;
}

function mulberry32(a: number): () => number {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Types ─────────────────────────────────────────────────────────── */

export interface ColorStop { threshold: number; color: number[]; }

export interface PlanetConfig {
  octaves: number; persistence: number; lacunarity: number; scale: number; seaLevel: number;
  colorStops: ColorStop[];
  cloudOpacity: number; cloudSpeed: number;
  hasOcean: boolean; hasLava: boolean; hasNeon: boolean; hasEnergy: boolean;
  nightColor: number[]; nightBrightness: number;
}

export interface GeneratedTextures {
  colorMap: ImageData; heightMap: ImageData; normalMap: ImageData; nightLightsMap: ImageData;
}

/* ── Noise ─────────────────────────────────────────────────────────── */

function fbm(
  n: NoiseFunction3D, x: number, y: number, z: number,
  oct: number, pers: number, lac: number, sc: number,
): number {
  let v = 0, a = 1, f = sc, m = 0;
  for (let i = 0; i < oct; i++) {
    v += n(x*f, y*f, z*f) * a; m += a; a *= pers; f *= lac;
  }
  return (v / m + 1) / 2;
}

// Quintic smoothstep — smoother than cubic, reduces banding
function smootherstep(t: number): number {
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * t * (t * (t * 6 - 15) + 10);
}

// S-curve: sharpens contrast around 0.5 — pushes values toward 0 or 1
// strength controls how aggressive the push is (1.0 = gentle, 3.0 = sharp)
function scurve(t: number, strength: number): number {
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  // Attempt a sigmoid-like curve centered at 0.5
  const s = (t - 0.5) * strength;
  return 1.0 / (1.0 + Math.exp(-s));
}

function heightToColor(h: number, stops: ColorStop[]): [number, number, number] {
  if (!stops.length) return [0, 0, 0];
  if (h <= stops[0].threshold) return [stops[0].color[0], stops[0].color[1], stops[0].color[2]];
  for (let i = 1; i < stops.length; i++) {
    if (h <= stops[i].threshold) {
      const p = stops[i - 1], c = stops[i];
      const r = c.threshold - p.threshold;
      if (r <= 0) return [c.color[0], c.color[1], c.color[2]];
      const s = smootherstep((h - p.threshold) / r);
      return [
        p.color[0] + (c.color[0] - p.color[0]) * s,
        p.color[1] + (c.color[1] - p.color[1]) * s,
        p.color[2] + (c.color[2] - p.color[2]) * s,
      ];
    }
  }
  const l = stops[stops.length - 1].color;
  return [l[0], l[1], l[2]];
}

function c255(v: number): number { return v < 0 ? 0 : v > 255 ? 255 : Math.floor(v); }
function c01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v; }

/* ── Soft blur pass (box blur approximation) ──────────────────────── */

function softBlur(data: Uint8ClampedArray, w: number, h: number, radius: number): void {
  const tmp = new Uint8ClampedArray(data.length);

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0, count = 0;
      for (let dx = -radius; dx <= radius; dx++) {
        const sx = (x + dx + w) % w;
        const idx = (y * w + sx) * 4;
        r += data[idx]; g += data[idx+1]; b += data[idx+2]; a += data[idx+3];
        count++;
      }
      const idx = (y * w + x) * 4;
      tmp[idx] = r / count; tmp[idx+1] = g / count; tmp[idx+2] = b / count; tmp[idx+3] = a / count;
    }
  }

  // Vertical pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0, count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const sy = (y + dy + h) % h;
        const idx = (sy * w + x) * 4;
        r += tmp[idx]; g += tmp[idx+1]; b += tmp[idx+2]; a += tmp[idx+3];
        count++;
      }
      const idx = (y * w + x) * 4;
      data[idx] = r / count; data[idx+1] = g / count; data[idx+2] = b / count; data[idx+3] = a / count;
    }
  }
}

/* ── Main generator ───────────────────────────────────────────────── */

export function generatePlanetTextures(
  planetId: string, config: PlanetConfig, width = 1024, height = 512,
): GeneratedTextures {
  const seed = hashCode(planetId);
  const tNoise = createNoise3D(mulberry32(seed));
  const wNoise = createNoise3D(mulberry32(seed + 1111));
  const dNoise = createNoise3D(mulberry32(seed + 2222));
  const cNoise = createNoise3D(mulberry32(seed + 3333));
  const fNoise = createNoise3D(mulberry32(seed + 4444));

  const colorData = new Uint8ClampedArray(width * height * 4);
  const heightData = new Uint8ClampedArray(width * height * 4);
  const normalData = new Uint8ClampedArray(width * height * 4);
  const nightData = new Uint8ClampedArray(width * height * 4);
  const heights = new Float32Array(width * height);

  /* Pass 1 — height + color
   *
   * KEY INSIGHT: Real continents come from very low frequency noise with
   * an S-curve applied to create sharp land/ocean boundaries. Detail noise
   * is layered on top for terrain texture but doesn't affect the overall shape.
   *
   * Layer 1: CONTINENTAL BASE — scale ~0.8, 3 octaves, heavy domain warp
   *          → creates 3-5 massive blobs on the sphere
   *          → S-curve sharpens into clear continent/ocean split
   *
   * Layer 2: TERRAIN DETAIL — uses config.scale/octaves/persistence
   *          → mountains, valleys, texture within continents
   *          → blended on top at ~20% influence
   */
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const u = px / width, v = py / height;
      const th = u * Math.PI * 2, ph = v * Math.PI;
      const nx = Math.sin(ph) * Math.cos(th);
      const ny = Math.sin(ph) * Math.sin(th);
      const nz = Math.cos(ph);

      // ── Layer 1: Continental base ──
      // Very low frequency domain warping for organic tectonic shapes
      const cws = 0.55; // strong warp for irregular continent boundaries
      const cwx = wNoise(nx * 0.8, ny * 0.8, nz * 0.8) * cws;
      const cwy = wNoise(nx * 0.8 + 5.2, ny * 0.8 + 1.3, nz * 0.8 + 7.8) * cws;
      const cwz = wNoise(nx * 0.8 + 9.1, ny * 0.8 + 4.7, nz * 0.8 + 2.6) * cws;
      // Second warp for coastline irregularity
      const cws2 = 0.20;
      const cwx2 = dNoise(nx * 1.2 + cwx, ny * 1.2 + cwy, nz * 1.2 + cwz) * cws2;
      const cwy2 = dNoise(nx * 1.2 + 3.1, ny * 1.2 + 7.4, nz * 1.2 + 1.9) * cws2;

      // Continental noise: VERY low frequency (0.8), only 3 octaves, low persistence
      // This creates just 2-4 big blobs on the sphere = continents
      let continent = fbm(tNoise,
        nx + cwx + cwx2, ny + cwy + cwy2, nz + cwz,
        3, 0.30, 2.0, 0.8);

      // S-curve: sharpen into clear land/ocean boundaries
      // Strength 5.0 = pretty sharp coastlines
      continent = scurve(continent, 5.0);

      // ── Layer 2: Terrain detail ──
      // Uses the per-planet config for surface texture character
      const detail = fbm(dNoise, nx * 1.1, ny * 1.1, nz * 1.1,
        config.octaves, config.persistence, config.lacunarity, config.scale);

      // Fine micro-detail for surface texture
      const micro = fNoise(nx * config.scale * 4, ny * config.scale * 4, nz * config.scale * 4);

      // ── Blend: continent shape dominates, detail adds texture ──
      let h = continent * 0.78 + detail * 0.18 + (micro * 0.5 + 0.5) * 0.04;

      heights[py * width + px] = h;

      const idx = (py * width + px) * 4;
      const hByte = c255(h * 255);
      heightData[idx] = hByte; heightData[idx + 1] = hByte; heightData[idx + 2] = hByte;
      heightData[idx + 3] = h >= config.seaLevel ? 180 : 60;

      // Color with organic micro-variation
      const [r, g, b] = heightToColor(h, config.colorStops);
      const cv = cNoise(nx * 4, ny * 4, nz * 4) * 0.03;
      const warmShift = wNoise(nx * 0.8 + 20, ny * 0.8 + 20, nz * 0.8 + 20) * 0.015;
      colorData[idx] = c255((r + cv + warmShift) * 255);
      colorData[idx + 1] = c255((g + cv) * 255);
      colorData[idx + 2] = c255((b + cv - warmShift * 0.5) * 255);
      colorData[idx + 3] = 255;
    }
  }

  /* Pass 2 — blur to soften biome edges */
  softBlur(colorData, width, height, 2);

  /* Pass 3 — neon grid overlay (nexus only) */
  if (config.hasNeon) {
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        if (heights[py * width + px] < config.seaLevel) continue;
        const u = px / width, v = py / height;
        const th = u * Math.PI * 2, ph = v * Math.PI;
        const sx = Math.sin(ph) * Math.cos(th), sy = Math.sin(ph) * Math.sin(th), sz = Math.cos(ph);
        const gs = 22.0;
        const g1 = Math.abs(Math.sin(sx * gs + sy * gs * 0.5));
        const g2 = Math.abs(Math.sin(sy * gs + sz * gs * 0.5));
        const gl = Math.max(g1 < 0.07 ? 1 - g1 / 0.07 : 0, g2 < 0.07 ? 1 - g2 / 0.07 : 0);
        if (gl > 0.1) {
          const idx = (py * width + px) * 4;
          const i = gl * 0.30;
          colorData[idx] = c255(colorData[idx] + i * 25);
          colorData[idx + 1] = c255(colorData[idx + 1] + i * 200);
          colorData[idx + 2] = c255(colorData[idx + 2] + i * 240);
        }
      }
    }
  }

  /* Pass 4 — normals */
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const idx = (py * width + px) * 4;
      const l = heights[py * width + ((px - 1 + width) % width)];
      const r = heights[py * width + ((px + 1) % width)];
      const u = heights[((py - 1 + height) % height) * width + px];
      const d = heights[((py + 1) % height) * width + px];
      const str = 3.5;
      const dx = (r - l) * str, dy = (d - u) * str;
      const len = Math.sqrt(dx * dx + dy * dy + 1.0);
      normalData[idx] = c255(((-dx / len) * 0.5 + 0.5) * 255);
      normalData[idx + 1] = c255(((-dy / len) * 0.5 + 0.5) * 255);
      normalData[idx + 2] = c255(((1.0 / len) * 0.5 + 0.5) * 255);
      normalData[idx + 3] = 255;
    }
  }

  /* Pass 5 — night lights */
  const lRng = mulberry32(seed + 42);
  const [nR, nG, nB] = config.nightColor;

  if (config.hasNeon) {
    // Nexus: dense city coverage
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        if (heights[py * width + px] < config.seaLevel) continue;
        const u = px / width, v = py / height;
        const th = u * Math.PI * 2, ph = v * Math.PI;
        const sx = Math.sin(ph) * Math.cos(th), sy = Math.sin(ph) * Math.sin(th), sz = Math.cos(ph);
        const cd = fbm(fNoise, sx + 50, sy + 50, sz + 50, 3, 0.5, 2.0, 7.0);
        if (cd > 0.4) {
          const br = c01((cd - 0.4) / 0.4) * config.nightBrightness;
          const idx = (py * width + px) * 4;
          const cv = fNoise(sx * 18, sy * 18, sz * 18);
          let cr = nR, cg = nG, cb = nB;
          if (cv > 0.3) { cr = 255; cg = 60; cb = 210; }
          else if (cv < -0.3) { cr = 255; cg = 255; cb = 255; }
          nightData[idx] = c255(cr * br); nightData[idx + 1] = c255(cg * br);
          nightData[idx + 2] = c255(cb * br); nightData[idx + 3] = c255(255 * br);
        }
      }
    }
  } else if (config.hasEnergy) {
    // Void: energy veins
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const u = px / width, v = py / height;
        const th = u * Math.PI * 2, ph = v * Math.PI;
        const sx = Math.sin(ph) * Math.cos(th), sy = Math.sin(ph) * Math.sin(th), sz = Math.cos(ph);
        const sw = fbm(fNoise, sx * 2, sy * 2, sz * 2, 4, 0.6, 2.5, 3.0);
        const veins = Math.abs(Math.sin(sw * 10.0));
        if (veins > 0.82) {
          const br = (veins - 0.82) / 0.18 * config.nightBrightness;
          const idx = (py * width + px) * 4;
          nightData[idx] = c255(nR * br); nightData[idx + 1] = c255(nG * br);
          nightData[idx + 2] = c255(nB * br); nightData[idx + 3] = c255(255 * br);
        }
      }
    }
  } else if (config.hasLava) {
    // Forge: lava glow
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const h = heights[py * width + px];
        if (h >= config.seaLevel) continue;
        const br = c01((config.seaLevel - h) / config.seaLevel) * config.nightBrightness;
        const idx = (py * width + px) * 4;
        nightData[idx] = c255(nR * br); nightData[idx + 1] = c255(nG * br);
        nightData[idx + 2] = c255(nB * br); nightData[idx + 3] = c255(255 * br);
      }
    }
  } else {
    // Normal: city clusters with glow
    const nc = 22 + Math.floor(lRng() * 14);
    for (let c = 0; c < nc; c++) {
      const cx = Math.floor(lRng() * width);
      const cy = Math.floor(lRng() * height * 0.7 + height * 0.15);
      if (heights[cy * width + cx] < config.seaLevel) continue;
      const cs = 10 + Math.floor(lRng() * 16);
      for (let i = 0; i < cs * 10; i++) {
        const sp = cs * 5;
        const lx = Math.max(0, Math.min(width - 1, cx + Math.floor((lRng() - 0.5) * sp)));
        const ly = Math.max(0, Math.min(height - 1, cy + Math.floor((lRng() - 0.5) * sp)));
        if (heights[ly * width + lx] >= config.seaLevel) {
          const br = (0.35 + lRng() * 0.65) * config.nightBrightness;
          const idx = (ly * width + lx) * 4;
          nightData[idx] = Math.min(255, nightData[idx] + Math.floor(nR * br));
          nightData[idx + 1] = Math.min(255, nightData[idx + 1] + Math.floor(nG * br));
          nightData[idx + 2] = Math.min(255, nightData[idx + 2] + Math.floor(nB * br));
          nightData[idx + 3] = Math.min(255, nightData[idx + 3] + Math.floor(255 * br));
          // Glow halo
          const gr = 2 + Math.floor(lRng() * 2);
          for (let gy = -gr; gy <= gr; gy++) for (let gx = -gr; gx <= gr; gx++) {
            if (!gx && !gy) continue;
            const glx = Math.max(0, Math.min(width - 1, lx + gx));
            const gly = Math.max(0, Math.min(height - 1, ly + gy));
            const fo = Math.max(0, 1 - Math.sqrt(gx * gx + gy * gy) / (gr + 1));
            const gb = br * fo * 0.3;
            const gi = (gly * width + glx) * 4;
            nightData[gi] = Math.min(255, nightData[gi] + Math.floor(nR * gb));
            nightData[gi + 1] = Math.min(255, nightData[gi + 1] + Math.floor(nG * gb));
            nightData[gi + 2] = Math.min(255, nightData[gi + 2] + Math.floor(nB * gb));
            nightData[gi + 3] = Math.min(255, nightData[gi + 3] + Math.floor(255 * gb));
          }
        }
      }
    }
  }

  // Soften night lights
  softBlur(nightData, width, height, 1);

  return {
    colorMap: new ImageData(colorData, width, height),
    heightMap: new ImageData(heightData, width, height),
    normalMap: new ImageData(normalData, width, height),
    nightLightsMap: new ImageData(nightData, width, height),
  };
}

/** Worker-safe version that returns raw Uint8ClampedArrays (no ImageData dependency). */
export function generatePlanetTexturesRaw(
  planetId: string, config: PlanetConfig, width = 1024, height = 512,
): { colorData: Uint8ClampedArray; normalData: Uint8ClampedArray; nightData: Uint8ClampedArray; width: number; height: number } {
  const seed = hashCode(planetId);
  const tNoise = createNoise3D(mulberry32(seed));
  const wNoise = createNoise3D(mulberry32(seed + 1111));
  const dNoise = createNoise3D(mulberry32(seed + 2222));
  const cNoise = createNoise3D(mulberry32(seed + 3333));
  const fNoise = createNoise3D(mulberry32(seed + 4444));

  const colorData = new Uint8ClampedArray(width * height * 4);
  const heightData = new Uint8ClampedArray(width * height * 4);
  const normalData = new Uint8ClampedArray(width * height * 4);
  const nightData = new Uint8ClampedArray(width * height * 4);
  const heights = new Float32Array(width * height);

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const u = px / width, v = py / height;
      const th = u * Math.PI * 2, ph = v * Math.PI;
      const nx = Math.sin(ph) * Math.cos(th);
      const ny = Math.sin(ph) * Math.sin(th);
      const nz = Math.cos(ph);

      const cws = 0.55;
      const cwx = wNoise(nx * 0.8, ny * 0.8, nz * 0.8) * cws;
      const cwy = wNoise(nx * 0.8 + 5.2, ny * 0.8 + 1.3, nz * 0.8 + 7.8) * cws;
      const cwz = wNoise(nx * 0.8 + 9.1, ny * 0.8 + 4.7, nz * 0.8 + 2.6) * cws;
      const cws2 = 0.20;
      const cwx2 = dNoise(nx * 1.2 + cwx, ny * 1.2 + cwy, nz * 1.2 + cwz) * cws2;
      const cwy2 = dNoise(nx * 1.2 + 3.1, ny * 1.2 + 7.4, nz * 1.2 + 1.9) * cws2;

      let continent = fbm(tNoise, nx + cwx + cwx2, ny + cwy + cwy2, nz + cwz, 3, 0.30, 2.0, 0.8);
      continent = scurve(continent, 5.0);

      const detail = fbm(dNoise, nx * 1.1, ny * 1.1, nz * 1.1,
        config.octaves, config.persistence, config.lacunarity, config.scale);
      const micro = fNoise(nx * config.scale * 4, ny * config.scale * 4, nz * config.scale * 4);

      const h = continent * 0.78 + detail * 0.18 + (micro * 0.5 + 0.5) * 0.04;
      heights[py * width + px] = h;

      const idx = (py * width + px) * 4;
      const hByte = c255(h * 255);
      heightData[idx] = hByte; heightData[idx + 1] = hByte; heightData[idx + 2] = hByte;
      heightData[idx + 3] = h >= config.seaLevel ? 180 : 60;

      const [r, g, b] = heightToColor(h, config.colorStops);
      const cv = cNoise(nx * 4, ny * 4, nz * 4) * 0.03;
      const warmShift = wNoise(nx * 0.8 + 20, ny * 0.8 + 20, nz * 0.8 + 20) * 0.015;
      colorData[idx] = c255((r + cv + warmShift) * 255);
      colorData[idx + 1] = c255((g + cv) * 255);
      colorData[idx + 2] = c255((b + cv - warmShift * 0.5) * 255);
      colorData[idx + 3] = 255;
    }
  }

  softBlur(colorData, width, height, 2);

  if (config.hasNeon) {
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        if (heights[py * width + px] < config.seaLevel) continue;
        const u = px / width, v = py / height;
        const th2 = u * Math.PI * 2, ph2 = v * Math.PI;
        const sx = Math.sin(ph2) * Math.cos(th2), sy = Math.sin(ph2) * Math.sin(th2), sz = Math.cos(ph2);
        const gs = 22.0;
        const g1 = Math.abs(Math.sin(sx * gs + sy * gs * 0.5));
        const g2 = Math.abs(Math.sin(sy * gs + sz * gs * 0.5));
        const gl = Math.max(g1 < 0.07 ? 1 - g1 / 0.07 : 0, g2 < 0.07 ? 1 - g2 / 0.07 : 0);
        if (gl > 0.1) {
          const idx = (py * width + px) * 4;
          const i = gl * 0.30;
          colorData[idx] = c255(colorData[idx] + i * 25);
          colorData[idx + 1] = c255(colorData[idx + 1] + i * 200);
          colorData[idx + 2] = c255(colorData[idx + 2] + i * 240);
        }
      }
    }
  }

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const idx = (py * width + px) * 4;
      const l = heights[py * width + ((px - 1 + width) % width)];
      const r = heights[py * width + ((px + 1) % width)];
      const u = heights[((py - 1 + height) % height) * width + px];
      const d = heights[((py + 1) % height) * width + px];
      const str = 3.5;
      const ddx = (r - l) * str, ddy = (d - u) * str;
      const len = Math.sqrt(ddx * ddx + ddy * ddy + 1.0);
      normalData[idx] = c255(((-ddx / len) * 0.5 + 0.5) * 255);
      normalData[idx + 1] = c255(((-ddy / len) * 0.5 + 0.5) * 255);
      normalData[idx + 2] = c255(((1.0 / len) * 0.5 + 0.5) * 255);
      normalData[idx + 3] = 255;
    }
  }

  const lRng = mulberry32(seed + 42);
  const [nR, nG, nB] = config.nightColor;

  if (config.hasNeon) {
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        if (heights[py * width + px] < config.seaLevel) continue;
        const u = px / width, v = py / height;
        const th2 = u * Math.PI * 2, ph2 = v * Math.PI;
        const sx = Math.sin(ph2) * Math.cos(th2), sy = Math.sin(ph2) * Math.sin(th2), sz = Math.cos(ph2);
        const cd = fbm(fNoise, sx + 50, sy + 50, sz + 50, 3, 0.5, 2.0, 7.0);
        if (cd > 0.4) {
          const br = c01((cd - 0.4) / 0.4) * config.nightBrightness;
          const idx = (py * width + px) * 4;
          const cv = fNoise(sx * 18, sy * 18, sz * 18);
          let cr = nR, cg = nG, cb = nB;
          if (cv > 0.3) { cr = 255; cg = 60; cb = 210; }
          else if (cv < -0.3) { cr = 255; cg = 255; cb = 255; }
          nightData[idx] = c255(cr * br); nightData[idx + 1] = c255(cg * br);
          nightData[idx + 2] = c255(cb * br); nightData[idx + 3] = c255(255 * br);
        }
      }
    }
  } else if (config.hasEnergy) {
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const u = px / width, v = py / height;
        const th2 = u * Math.PI * 2, ph2 = v * Math.PI;
        const sx = Math.sin(ph2) * Math.cos(th2), sy = Math.sin(ph2) * Math.sin(th2), sz = Math.cos(ph2);
        const sw = fbm(fNoise, sx * 2, sy * 2, sz * 2, 4, 0.6, 2.5, 3.0);
        const veins = Math.abs(Math.sin(sw * 10.0));
        if (veins > 0.82) {
          const br = (veins - 0.82) / 0.18 * config.nightBrightness;
          const idx = (py * width + px) * 4;
          nightData[idx] = c255(nR * br); nightData[idx + 1] = c255(nG * br);
          nightData[idx + 2] = c255(nB * br); nightData[idx + 3] = c255(255 * br);
        }
      }
    }
  } else if (config.hasLava) {
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const h = heights[py * width + px];
        if (h >= config.seaLevel) continue;
        const br = c01((config.seaLevel - h) / config.seaLevel) * config.nightBrightness;
        const idx = (py * width + px) * 4;
        nightData[idx] = c255(nR * br); nightData[idx + 1] = c255(nG * br);
        nightData[idx + 2] = c255(nB * br); nightData[idx + 3] = c255(255 * br);
      }
    }
  } else {
    const nc = 22 + Math.floor(lRng() * 14);
    for (let c = 0; c < nc; c++) {
      const cx = Math.floor(lRng() * width);
      const cy = Math.floor(lRng() * height * 0.7 + height * 0.15);
      if (heights[cy * width + cx] < config.seaLevel) continue;
      const cs = 10 + Math.floor(lRng() * 16);
      for (let i = 0; i < cs * 10; i++) {
        const sp = cs * 5;
        const lx = Math.max(0, Math.min(width - 1, cx + Math.floor((lRng() - 0.5) * sp)));
        const ly = Math.max(0, Math.min(height - 1, cy + Math.floor((lRng() - 0.5) * sp)));
        if (heights[ly * width + lx] >= config.seaLevel) {
          const br = (0.35 + lRng() * 0.65) * config.nightBrightness;
          const idx = (ly * width + lx) * 4;
          nightData[idx] = Math.min(255, nightData[idx] + Math.floor(nR * br));
          nightData[idx + 1] = Math.min(255, nightData[idx + 1] + Math.floor(nG * br));
          nightData[idx + 2] = Math.min(255, nightData[idx + 2] + Math.floor(nB * br));
          nightData[idx + 3] = Math.min(255, nightData[idx + 3] + Math.floor(255 * br));
          const gr = 2 + Math.floor(lRng() * 2);
          for (let gy = -gr; gy <= gr; gy++) for (let gx = -gr; gx <= gr; gx++) {
            if (!gx && !gy) continue;
            const glx = Math.max(0, Math.min(width - 1, lx + gx));
            const gly = Math.max(0, Math.min(height - 1, ly + gy));
            const fo = Math.max(0, 1 - Math.sqrt(gx * gx + gy * gy) / (gr + 1));
            const gb = br * fo * 0.3;
            const gi = (gly * width + glx) * 4;
            nightData[gi] = Math.min(255, nightData[gi] + Math.floor(nR * gb));
            nightData[gi + 1] = Math.min(255, nightData[gi + 1] + Math.floor(nG * gb));
            nightData[gi + 2] = Math.min(255, nightData[gi + 2] + Math.floor(nB * gb));
            nightData[gi + 3] = Math.min(255, nightData[gi + 3] + Math.floor(255 * gb));
          }
        }
      }
    }
  }

  softBlur(nightData, width, height, 1);

  return { colorData, normalData, nightData, width, height };
}
