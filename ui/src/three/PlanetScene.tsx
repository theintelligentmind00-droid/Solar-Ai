import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { generatePlanetTexturesRaw, type PlanetConfig } from './generatePlanetTextures';

/* ================================================================== */
/*  TEXTURE CONFIG                                                      */
/* ================================================================== */

interface TexConfig {
  atmo: [number, number, number];
  ring?: { inner: number; outer: number; color: string; opacity: number };
  clouds?: boolean;
  procGen: PlanetConfig;
}

/* ── Procedural planet configs — vivid, dramatically different ────── */

const CFG: Record<string, TexConfig> = {
  terra: {
    atmo: [0.4, 0.7, 1.0],
    clouds: true,
    procGen: {
      octaves: 6, persistence: 0.55, lacunarity: 2.2, scale: 2.5, seaLevel: 0.48,
      colorStops: [
        { threshold: 0.00, color: [0.05, 0.12, 0.35] },
        { threshold: 0.35, color: [0.08, 0.20, 0.55] },
        { threshold: 0.47, color: [0.10, 0.30, 0.65] },
        { threshold: 0.49, color: [0.76, 0.70, 0.50] },
        { threshold: 0.54, color: [0.30, 0.62, 0.18] },
        { threshold: 0.65, color: [0.20, 0.50, 0.12] },
        { threshold: 0.78, color: [0.45, 0.35, 0.25] },
        { threshold: 0.88, color: [0.60, 0.55, 0.50] },
        { threshold: 1.00, color: [0.95, 0.97, 1.00] },
      ],
      cloudOpacity: 0.4, cloudSpeed: 0.01,
      hasOcean: true, hasLava: false, hasNeon: false, hasEnergy: false,
      nightColor: [255, 200, 80], nightBrightness: 0.9,
    },
  },
  forge: {
    atmo: [1.0, 0.45, 0.08],
    ring: { inner: 6.5, outer: 9.0, color: '#cc4408', opacity: 0.28 },
    procGen: {
      octaves: 5, persistence: 0.6, lacunarity: 2.0, scale: 3.0, seaLevel: 0.40,
      colorStops: [
        { threshold: 0.00, color: [1.0, 0.35, 0.0] },
        { threshold: 0.25, color: [1.0, 0.55, 0.05] },
        { threshold: 0.39, color: [0.90, 0.25, 0.0] },
        { threshold: 0.42, color: [0.15, 0.08, 0.06] },
        { threshold: 0.55, color: [0.22, 0.12, 0.08] },
        { threshold: 0.70, color: [0.35, 0.18, 0.10] },
        { threshold: 0.85, color: [0.25, 0.10, 0.06] },
        { threshold: 1.00, color: [0.18, 0.08, 0.04] },
      ],
      cloudOpacity: 0.15, cloudSpeed: 0.005,
      hasOcean: false, hasLava: true, hasNeon: false, hasEnergy: false,
      nightColor: [255, 120, 20], nightBrightness: 1.0,
    },
  },
  oasis: {
    atmo: [0.18, 0.95, 0.88],
    ring: { inner: 6.8, outer: 9.5, color: '#59e6d9', opacity: 0.30 },
    clouds: true,
    procGen: {
      octaves: 5, persistence: 0.5, lacunarity: 2.1, scale: 2.0, seaLevel: 0.58,
      colorStops: [
        { threshold: 0.00, color: [0.0, 0.25, 0.40] },
        { threshold: 0.30, color: [0.0, 0.45, 0.55] },
        { threshold: 0.55, color: [0.05, 0.60, 0.65] },
        { threshold: 0.58, color: [0.85, 0.82, 0.60] },
        { threshold: 0.63, color: [0.20, 0.75, 0.35] },
        { threshold: 0.72, color: [0.10, 0.60, 0.25] },
        { threshold: 0.85, color: [0.15, 0.50, 0.20] },
        { threshold: 1.00, color: [0.30, 0.70, 0.30] },
      ],
      cloudOpacity: 0.3, cloudSpeed: 0.008,
      hasOcean: true, hasLava: false, hasNeon: false, hasEnergy: false,
      nightColor: [100, 220, 200], nightBrightness: 0.7,
    },
  },
  nexus: {
    atmo: [0.12, 0.75, 1.0],
    procGen: {
      octaves: 4, persistence: 0.45, lacunarity: 2.5, scale: 3.5, seaLevel: 0.35,
      colorStops: [
        { threshold: 0.00, color: [0.02, 0.05, 0.12] },
        { threshold: 0.20, color: [0.05, 0.08, 0.18] },
        { threshold: 0.34, color: [0.03, 0.06, 0.15] },
        { threshold: 0.36, color: [0.12, 0.15, 0.22] },
        { threshold: 0.50, color: [0.18, 0.20, 0.28] },
        { threshold: 0.65, color: [0.22, 0.25, 0.35] },
        { threshold: 0.80, color: [0.28, 0.30, 0.40] },
        { threshold: 1.00, color: [0.35, 0.38, 0.50] },
      ],
      cloudOpacity: 0.05, cloudSpeed: 0.003,
      hasOcean: false, hasLava: false, hasNeon: true, hasEnergy: false,
      nightColor: [50, 200, 255], nightBrightness: 1.0,
    },
  },
  citadel: {
    atmo: [1.0, 0.75, 0.30],
    ring: { inner: 6.5, outer: 10.0, color: '#ffcc59', opacity: 0.38 },
    procGen: {
      octaves: 6, persistence: 0.5, lacunarity: 2.0, scale: 2.8, seaLevel: 0.30,
      colorStops: [
        { threshold: 0.00, color: [0.55, 0.30, 0.10] },
        { threshold: 0.20, color: [0.65, 0.38, 0.12] },
        { threshold: 0.30, color: [0.72, 0.45, 0.15] },
        { threshold: 0.45, color: [0.85, 0.55, 0.18] },
        { threshold: 0.60, color: [0.90, 0.65, 0.25] },
        { threshold: 0.75, color: [0.80, 0.50, 0.20] },
        { threshold: 0.88, color: [0.95, 0.75, 0.35] },
        { threshold: 1.00, color: [1.0, 0.88, 0.55] },
      ],
      cloudOpacity: 0.1, cloudSpeed: 0.004,
      hasOcean: false, hasLava: false, hasNeon: false, hasEnergy: false,
      nightColor: [255, 190, 80], nightBrightness: 0.85,
    },
  },
  gaia: {
    atmo: [0.30, 0.95, 0.45],
    clouds: true,
    procGen: {
      octaves: 6, persistence: 0.55, lacunarity: 2.1, scale: 2.2, seaLevel: 0.45,
      colorStops: [
        { threshold: 0.00, color: [0.05, 0.18, 0.30] },
        { threshold: 0.30, color: [0.08, 0.28, 0.42] },
        { threshold: 0.44, color: [0.10, 0.35, 0.50] },
        { threshold: 0.46, color: [0.50, 0.72, 0.30] },
        { threshold: 0.55, color: [0.25, 0.70, 0.15] },
        { threshold: 0.65, color: [0.18, 0.62, 0.10] },
        { threshold: 0.75, color: [0.35, 0.75, 0.22] },
        { threshold: 0.88, color: [0.55, 0.80, 0.35] },
        { threshold: 1.00, color: [0.40, 0.68, 0.28] },
      ],
      cloudOpacity: 0.35, cloudSpeed: 0.009,
      hasOcean: true, hasLava: false, hasNeon: false, hasEnergy: false,
      nightColor: [180, 255, 120], nightBrightness: 0.75,
    },
  },
  void: {
    atmo: [0.65, 0.15, 1.0],
    ring: { inner: 6.2, outer: 10.5, color: '#9938f2', opacity: 0.45 },
    procGen: {
      octaves: 5, persistence: 0.6, lacunarity: 2.3, scale: 2.5, seaLevel: 0.35,
      colorStops: [
        { threshold: 0.00, color: [0.08, 0.02, 0.18] },
        { threshold: 0.20, color: [0.12, 0.04, 0.28] },
        { threshold: 0.35, color: [0.18, 0.05, 0.38] },
        { threshold: 0.45, color: [0.25, 0.08, 0.50] },
        { threshold: 0.58, color: [0.35, 0.10, 0.62] },
        { threshold: 0.70, color: [0.45, 0.15, 0.75] },
        { threshold: 0.85, color: [0.30, 0.08, 0.55] },
        { threshold: 1.00, color: [0.20, 0.05, 0.40] },
      ],
      cloudOpacity: 0.08, cloudSpeed: 0.006,
      hasOcean: false, hasLava: false, hasNeon: false, hasEnergy: true,
      nightColor: [180, 80, 255], nightBrightness: 0.95,
    },
  },
};

/* Keep exports for SolarSystemView compatibility */
export const PLANET_CONFIGS = CFG;
export type PlanetType = keyof typeof CFG;

/* ================================================================== */
/*  HELPERS                                                              */
/* ================================================================== */


/* ================================================================== */
/*  PLANET SURFACE — procedural textures + meshStandardMaterial         */
/* ================================================================== */

function PlanetSurface({ cfg, planetId }: { cfg: TexConfig; planetId: string }) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Generate textures synchronously — runs once per planet
  const colorTex = useMemo(() => {
    const W = 512, H = 256; // smaller = faster generation
    const raw = generatePlanetTexturesRaw(planetId, cfg.procGen, W, H);

    const tex = new THREE.DataTexture(
      new Uint8Array(raw.colorData.buffer),
      W, H, THREE.RGBAFormat,
    );
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }, [planetId, cfg.procGen]);

  useEffect(() => () => { colorTex.dispose(); }, [colorTex]);

  useFrame((_, dt) => {
    if (meshRef.current) meshRef.current.rotation.y += dt * 0.04;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[5, 128, 64]} />
      <meshBasicMaterial map={colorTex} />
    </mesh>
  );
}

/* ================================================================== */
/*  CLOUD LAYER                                                         */
/* ================================================================== */

function CloudLayer() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y -= dt * 0.02;
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[5.06, 64, 32]} />
      <meshStandardMaterial
        color="#ffffff"
        transparent opacity={0.12}
        depthWrite={false}
        roughness={1} metalness={0}
      />
    </mesh>
  );
}

/* ================================================================== */
/*  ATMOSPHERE GLOW (shader — no textures, always works)               */
/* ================================================================== */

const ATMO_VS = `
varying vec3 vNormal;
varying vec3 vViewPos;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vViewPos = (modelViewMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

function AtmoLayer({ color, radius, power, intensity, sunDir }: {
  color: [number, number, number]; radius: number; power: number; intensity: number;
  sunDir?: [number, number, number];
}) {
  const sd = sunDir ?? [0.38, 0.23, 0.9];
  const fs = `
    uniform vec3 u_color;
    uniform vec3 u_sun;
    varying vec3 vNormal;
    varying vec3 vViewPos;
    void main() {
      vec3 viewDir = normalize(-vViewPos);
      float NdV = max(0.0, dot(viewDir, vNormal));
      float NdL = dot(vNormal, u_sun);
      float rim = 1.0 - NdV;

      // Base rim glow
      float glow = pow(rim, ${power.toFixed(1)}) * ${intensity.toFixed(2)};

      // Sun-side brightening
      float sunFace = smoothstep(-0.3, 0.5, NdL);
      glow *= mix(0.35, 1.0, sunFace);

      // Backlit corona on dark side (subsurface scattering look)
      float backlit = pow(max(0.0, dot(-viewDir, u_sun)), 2.0) * rim * 0.4;
      glow += backlit * ${intensity.toFixed(2)};

      // Terminator sunset tint
      float terminator = smoothstep(0.85, 1.0, 1.0 - abs(NdL));
      vec3 sunset = mix(u_color, vec3(1.0, 0.55, 0.2), 0.4);
      vec3 col = mix(u_color, sunset, terminator * 0.5);

      // Brighten rim on sun side
      col = mix(col, vec3(1.0, 0.98, 0.92), sunFace * rim * 0.3);

      gl_FragColor = vec4(col, glow);
    }
  `;
  return (
    <mesh>
      <sphereGeometry args={[radius, 48, 24]} />
      <shaderMaterial
        uniforms={{
          u_color: { value: new THREE.Color(...color) },
          u_sun: { value: new THREE.Vector3(...sd).normalize() },
        }}
        vertexShader={ATMO_VS}
        fragmentShader={fs}
        transparent
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ================================================================== */
/*  RING                                                                */
/* ================================================================== */

const RING_VS = `
varying vec2 vUv;
varying vec3 vWorldPos;
void main() {
  vUv = uv;
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const RING_FS = `
uniform vec3 u_color;
uniform float u_opacity;
uniform float u_inner;
uniform float u_outer;
varying vec2 vUv;
varying vec3 vWorldPos;
void main() {
  float r = vUv.x; // 0 = inner edge, 1 = outer edge

  // Multi-band ring structure (like Saturn)
  float b1 = smoothstep(0.00, 0.03, r) * smoothstep(0.22, 0.18, r);
  float b2 = smoothstep(0.25, 0.28, r) * smoothstep(0.48, 0.44, r);
  float b3 = smoothstep(0.52, 0.55, r) * smoothstep(0.70, 0.66, r);
  float b4 = smoothstep(0.73, 0.76, r) * smoothstep(0.88, 0.84, r);
  float b5 = smoothstep(0.91, 0.93, r) * smoothstep(1.00, 0.97, r);
  float bands = b1 * 0.65 + b2 * 1.0 + b3 * 0.8 + b4 * 0.55 + b5 * 0.25;

  // Fine grain detail
  float grain = 0.7 + 0.3 * sin(r * 180.0);
  float grain2 = 0.85 + 0.15 * sin(r * 60.0 + 1.5);

  // Planet shadow on rings (simple: fade near center)
  float dist = length(vWorldPos.xz);
  float planetShadow = smoothstep(4.5, 5.8, dist);

  // Fade edges
  float edgeFade = smoothstep(0.0, 0.05, r) * smoothstep(1.0, 0.95, r);

  float alpha = bands * grain * grain2 * edgeFade * planetShadow * u_opacity;

  // Color variation across bands
  vec3 bright = u_color * 1.5;
  vec3 dim = u_color * 0.5;
  vec3 col = mix(dim, bright, b2 * 0.5 + b3 * 0.3);

  gl_FragColor = vec4(col, alpha);
}`;

function PlanetRing({ ring }: { ring: NonNullable<TexConfig['ring']> }) {
  return (
    <mesh rotation={[Math.PI * 0.42, 0.15, 0]}>
      <ringGeometry args={[ring.inner, ring.outer, 128, 1]} />
      <shaderMaterial
        uniforms={{
          u_color: { value: new THREE.Color(ring.color) },
          u_opacity: { value: ring.opacity },
          u_inner: { value: ring.inner },
          u_outer: { value: ring.outer },
        }}
        vertexShader={RING_VS}
        fragmentShader={RING_FS}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ================================================================== */
/*  STAR FIELD                                                          */
/* ================================================================== */

function StarField() {
  const geo = useMemo(() => {
    const N = 3000;
    const pos = new Float32Array(N * 3);
    const sizes = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const r = 60 + Math.random() * 40;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph);
      sizes[i] = 0.08 + Math.random() * 0.35;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return g;
  }, []);

  return (
    <points geometry={geo}>
      <pointsMaterial size={0.3} sizeAttenuation color="#ffffff" transparent opacity={0.7} />
    </points>
  );
}

/* ================================================================== */
/*  SETTLEMENTS                                                         */
/* ================================================================== */

interface Settlement {
  id: string; name: string; lat: number; lon: number; size: number; has_overdue: boolean;
}

const CIV_TIERS = [
  { label: 'CAMP', color: '#66dd88', emissive: '#44bb66', glowSize: 0.12, dotSize: 0.08, ring: false },
  { label: 'VILLAGE', color: '#88eebb', emissive: '#55cc88', glowSize: 0.2, dotSize: 0.10, ring: false },
  { label: 'TOWN', color: '#ffcc44', emissive: '#ddaa22', glowSize: 0.3, dotSize: 0.12, ring: true },
  { label: 'METROPOLIS', color: '#ff8844', emissive: '#ff6622', glowSize: 0.45, dotSize: 0.15, ring: true },
];

function SettlementMarker({ s }: { s: Settlement }) {
  const ref = useRef<THREE.Mesh>(null);
  const tier = Math.min(s.size - 1, 3);
  const c = CIV_TIERS[tier];
  const latR = (s.lat * Math.PI) / 180, lonR = (s.lon * Math.PI) / 180;
  const R = 5.06;
  const pos = useMemo(() => new THREE.Vector3(
    R * Math.cos(latR) * Math.cos(lonR), R * Math.sin(latR), R * Math.cos(latR) * Math.sin(lonR),
  ), [latR, lonR]);

  const color = s.has_overdue ? '#ff4444' : c.color;
  const emissive = s.has_overdue ? '#ff2222' : c.emissive;

  useFrame(() => {
    if (ref.current && s.has_overdue) {
      const m = ref.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.6 + 0.4 * Math.sin(performance.now() * 0.005);
    }
  });

  return (
    <group position={pos}>
      <mesh>
        <sphereGeometry args={[c.glowSize, 12, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} depthWrite={false} />
      </mesh>
      <mesh ref={ref}>
        <sphereGeometry args={[c.dotSize, 12, 8]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.8} transparent opacity={0.95} />
      </mesh>
      {c.ring && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[c.glowSize * 0.8, c.glowSize, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
      <Html position={[0, c.glowSize + 0.08, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          fontSize: '8px', fontFamily: 'monospace', letterSpacing: '0.12em', whiteSpace: 'nowrap',
          color: s.has_overdue ? '#ff8888' : c.color, textShadow: '0 0 6px rgba(0,0,0,0.8)',
          opacity: 0.85, fontWeight: 600,
        }}>
          {s.name || c.label}
        </div>
      </Html>
    </group>
  );
}

function Settlements({ planetId }: { planetId: string }) {
  const [data, setData] = useState<Settlement[]>([]);
  useEffect(() => {
    const base = import.meta.env.DEV ? '/api' : 'http://localhost:8000';
    fetch(`${base}/civilization/${planetId}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { settlements?: Settlement[] } | null) => { if (d?.settlements) setData(d.settlements); })
      .catch(() => {});
  }, [planetId]);

  if (!data.length) return null;
  return <group>{data.map(s => <SettlementMarker key={s.id} s={s} />)}</group>;
}

/* ================================================================== */
/*  CAMERA FLY-IN                                                       */
/* ================================================================== */

function CameraFlyIn({ onReady }: { onReady?: () => void }) {
  const { camera } = useThree();
  const t = useRef(0);
  const done = useRef(false);

  useEffect(() => { camera.position.set(0, 0, 16); t.current = 0; done.current = false; }, [camera]);

  useFrame((_, dt) => {
    if (done.current) return;
    t.current = Math.min(t.current + dt / 0.8, 1);
    const p = t.current;
    const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    camera.position.z = 16 + (11 - 16) * ease;
    camera.position.y = Math.sin(p * Math.PI) * 0.4;
    if (t.current >= 1) {
      done.current = true;
      camera.position.set(0, 0, 11);
      onReady?.();
    }
  });

  return null;
}

/* ================================================================== */
/*  LOADING FALLBACK                                                    */
/* ================================================================== */

/* ================================================================== */
/*  ASSEMBLED PLANET                                                    */
/* ================================================================== */

function Planet({ planetType, planetId }: { planetType: string; planetId: string }) {
  const cfg = CFG[planetType] ?? CFG.terra;

  return (
    <group>
      {/* Procedurally generated planet surface */}
      <PlanetSurface cfg={cfg} planetId={planetId} />
      {cfg.clouds && <CloudLayer />}

      {/* Atmosphere layers (shader-only, no textures needed) */}
      <AtmoLayer color={cfg.atmo} radius={5.4} power={1.5} intensity={0.6} />
      <AtmoLayer color={cfg.atmo} radius={5.9} power={2.5} intensity={0.4} />
      <AtmoLayer color={cfg.atmo} radius={6.8} power={4.0} intensity={0.25} />

      {/* Ring */}
      {cfg.ring && <PlanetRing ring={cfg.ring} />}

      {/* Settlements */}
      <Settlements planetId={planetId} />

      {/* Lighting — key light + strong fill for PBR materials */}
      <directionalLight position={[5, 3, 10]} intensity={5} />
      <directionalLight position={[-3, -1, -5]} intensity={1.2} />
      <ambientLight intensity={0.8} />
    </group>
  );
}

/* ================================================================== */
/*  MAIN EXPORT                                                         */
/* ================================================================== */

interface PlanetSceneProps {
  planetType: string;
  planetId: string;
  visible: boolean;
  onReady?: () => void;
}

export function PlanetScene({ planetType, planetId, visible, onReady }: PlanetSceneProps) {
  const vt = CFG[planetType] ? planetType : 'terra';
  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 15,
      background: 'radial-gradient(ellipse at center, rgba(8,6,18,0.94), rgba(4,2,8,1))',
    }}>
      <Canvas
        camera={{ position: [0, 0, 22], fov: 45 }}
        gl={{ antialias: true, alpha: false, toneMapping: THREE.NoToneMapping }}
      >
        <Planet planetType={vt} planetId={planetId} />
        <OrbitControls
          enableDamping dampingFactor={0.06} rotateSpeed={0.4}
          minDistance={6} maxDistance={20}
          enablePan={false} autoRotate autoRotateSpeed={0.2}
        />
        <StarField />
        <CameraFlyIn onReady={onReady} />
      </Canvas>
    </div>
  );
}
