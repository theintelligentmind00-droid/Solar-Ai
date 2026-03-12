/**
 * SoundManager - Singleton audio engine for Solar AI OS
 *
 * All UI / notification / transition / ambient sounds are synthesized via
 * Web Audio API so zero external audio files are required.
 * A shared AudioContext is created lazily on the first user interaction
 * to comply with browser autoplay policy.
 */

type SoundCategory = "ui" | "ambient" | "transitions" | "notifications";

type SoundId =
  | "ui_click"
  | "ui_hover"
  | "ui_panel_open"
  | "ui_panel_close"
  | "ui_toggle"
  | "creation_rumble"
  | "creation_boom"
  | "creation_settle"
  | "notif_comet"
  | "notif_gentle"
  | "notif_urgent"
  | "ship_engine_loop"
  | "ship_engine_start"
  | "ship_land"
  | "zoom_launch"
  | "zoom_arrival"
  | "ambient_space"
  | "ambient_planet_terra"
  | "ambient_planet_forge";

interface ActiveSound {
  stop: () => void;
  gain: GainNode;
}

type SoundSynthesizer = (ctx: AudioContext, master: GainNode) => ActiveSound;
const STORAGE_KEY_VOLUME = "solar_sound_volume";
const STORAGE_KEY_MUTED = "solar_sound_muted";
const STORAGE_KEY_CATEGORIES = "solar_sound_categories";

function readLocalFloat(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v !== null) return parseFloat(v);
  } catch { /* noop */ }
  return fallback;
}

function readLocalBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === "true") return true;
    if (v === "false") return false;
  } catch { /* noop */ }
  return fallback;
}

function readLocalJson<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    if (v !== null) return JSON.parse(v) as T;
  } catch { /* noop */ }
  return fallback;
}

function safeWrite(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* quota exceeded */ }
}

function createReverb(ctx: AudioContext, duration: number, decay: number): ConvolverNode {
  const rate = ctx.sampleRate;
  const length = rate * duration;
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = impulse;
  return conv;
}

function categoryFor(id: SoundId): SoundCategory {
  if (id.startsWith("ui_") || id.startsWith("creation_") || id.startsWith("ship_")) return "ui";
  if (id.startsWith("ambient_")) return "ambient";
  if (id.startsWith("zoom_")) return "transitions";
  if (id.startsWith("notif_")) return "notifications";
  return "ui";
}

function stopSafe(node: OscillatorNode | AudioBufferSourceNode): void {
  try { node.stop(); } catch { /* already stopped */ }
}
// ---------------------------------------------------------------------------
// Synthesizers
// ---------------------------------------------------------------------------

function synthUiClick(ctx: AudioContext, master: GainNode): ActiveSound {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  g.gain.setValueAtTime(0.3, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
  osc.connect(g).connect(master);
  osc.start();
  osc.stop(ctx.currentTime + 0.05);
  return { stop: () => stopSafe(osc), gain: g };
}

function synthUiHover(ctx: AudioContext, master: GainNode): ActiveSound {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(2000, ctx.currentTime);
  g.gain.setValueAtTime(0.06, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);
  osc.connect(g).connect(master);
  osc.start();
  osc.stop(ctx.currentTime + 0.02);
  return { stop: () => stopSafe(osc), gain: g };
}

function synthUiPanelOpen(ctx: AudioContext, master: GainNode): ActiveSound {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const reverb = createReverb(ctx, 0.4, 2);
  osc.type = "sine";
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.3);
  g.gain.setValueAtTime(0.15, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
  osc.connect(g).connect(reverb).connect(master);
  osc.start();
  osc.stop(ctx.currentTime + 0.35);
  return { stop: () => stopSafe(osc), gain: g };
}

function synthUiPanelClose(ctx: AudioContext, master: GainNode): ActiveSound {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const reverb = createReverb(ctx, 0.4, 2);
  osc.type = "sine";
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.3);
  g.gain.setValueAtTime(0.15, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
  osc.connect(g).connect(reverb).connect(master);
  osc.start();
  osc.stop(ctx.currentTime + 0.35);
  return { stop: () => stopSafe(osc), gain: g };
}

function synthUiToggle(ctx: AudioContext, master: GainNode): ActiveSound {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(1000, ctx.currentTime);
  g.gain.setValueAtTime(0.12, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
  osc.connect(g).connect(master);
  osc.start();
  osc.stop(ctx.currentTime + 0.08);
  return { stop: () => stopSafe(osc), gain: g };
}
function synthCreationRumble(ctx: AudioContext, master: GainNode): ActiveSound {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(30, t);
  osc.frequency.linearRampToValueAtTime(80, t + 2.5);
  g.gain.setValueAtTime(0.25, t);
  g.gain.linearRampToValueAtTime(0, t + 2.5);
  osc.connect(g).connect(master);
  osc.start(t); osc.stop(t + 2.5);
  const bufSize = ctx.sampleRate * 3;
  const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuf;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(100, t);
  lp.frequency.linearRampToValueAtTime(200, t + 2.5);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.15, t);
  ng.gain.linearRampToValueAtTime(0, t + 2.5);
  noiseSrc.connect(lp).connect(ng).connect(master);
  noiseSrc.start(t); noiseSrc.stop(t + 2.5);
  return { stop: () => { stopSafe(osc); stopSafe(noiseSrc); }, gain: g };
}

function synthCreationBoom(ctx: AudioContext, master: GainNode): ActiveSound {
  const t = ctx.currentTime;
  const bassOsc = ctx.createOscillator();
  const bassG = ctx.createGain();
  bassOsc.type = "sine"; bassOsc.frequency.setValueAtTime(60, t);
  bassG.gain.setValueAtTime(0.4, t);
  bassG.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  bassOsc.connect(bassG).connect(master);
  bassOsc.start(t); bassOsc.stop(t + 0.25);
  const reverb = createReverb(ctx, 2.5, 3);
  const chordG = ctx.createGain();
  chordG.gain.setValueAtTime(0.15, t);
  chordG.gain.exponentialRampToValueAtTime(0.001, t + 2);
  chordG.connect(reverb).connect(master);
  const chordOscs: OscillatorNode[] = [];
  for (const freq of [130.81, 196.0, 261.63]) {
    const o = ctx.createOscillator();
    o.type = "sine"; o.frequency.setValueAtTime(freq, t);
    o.connect(chordG); o.start(t); o.stop(t + 2.1);
    chordOscs.push(o);
  }
  const bufSize = ctx.sampleRate;
  const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) nd[i] = Math.random() * 2 - 1;
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.setValueAtTime(400, t); bp.Q.setValueAtTime(2, t);
  const noiseG = ctx.createGain();
  noiseG.gain.setValueAtTime(0.2, t);
  noiseG.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  noiseSrc.connect(bp).connect(noiseG).connect(master);
  noiseSrc.start(t); noiseSrc.stop(t + 0.6);
  return { stop: () => { stopSafe(bassOsc); chordOscs.forEach((o) => stopSafe(o)); stopSafe(noiseSrc); }, gain: bassG };
}

function synthCreationSettle(ctx: AudioContext, master: GainNode): ActiveSound {
  const t = ctx.currentTime;
  const reverb = createReverb(ctx, 1.5, 2.5);
  const reverbG = ctx.createGain();
  reverbG.gain.setValueAtTime(1, t);
  reverbG.connect(reverb).connect(master);
  const oscs: OscillatorNode[] = [];
  [261.63, 329.63, 392.0, 523.25].forEach((freq, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(freq, t);
    const start = t + i * 0.15;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.7);
    o.connect(g).connect(reverbG);
    o.start(start); o.stop(start + 0.75);
    oscs.push(o);
  });
  return { stop: () => { oscs.forEach((o) => stopSafe(o)); }, gain: reverbG };
}
function synthNotifComet(ctx: AudioContext, master: GainNode): ActiveSound {
  const t = ctx.currentTime;
  const sweep = ctx.createOscillator();
  const sg = ctx.createGain();
  sweep.type = "sine";
  sweep.frequency.setValueAtTime(500, t);
  sweep.frequency.exponentialRampToValueAtTime(2000, t + 0.5);
  sg.gain.setValueAtTime(0.15, t);
  sg.gain.linearRampToValueAtTime(0, t + 0.5);
  sweep.connect(sg).connect(master);
  sweep.start(t); sweep.stop(t + 0.55);
  const bell = ctx.createOscillator();
  const bg = ctx.createGain();
  bell.type = "sine"; bell.frequency.setValueAtTime(1800, t + 0.45);
  bg.gain.setValueAtTime(0, t);
  bg.gain.linearRampToValueAtTime(0.2, t + 0.45);
  bg.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
  bell.connect(bg).connect(master);
  bell.start(t + 0.45); bell.stop(t + 1.05);
  return { stop: () => { stopSafe(sweep); stopSafe(bell); }, gain: sg };
}

function synthNotifGentle(ctx: AudioContext, master: GainNode): ActiveSound {
  const t = ctx.currentTime;
  const oscs: OscillatorNode[] = [];
  const outG = ctx.createGain();
  outG.gain.setValueAtTime(1, t); outG.connect(master);
  [523.25, 659.25].forEach((freq, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(freq, t);
    const start = t + i * 0.2;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.1, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
    o.connect(g).connect(outG);
    o.start(start); o.stop(start + 0.45);
    oscs.push(o);
  });
  return { stop: () => { oscs.forEach((o) => stopSafe(o)); }, gain: outG };
}

function synthNotifUrgent(ctx: AudioContext, master: GainNode): ActiveSound {
  const t = ctx.currentTime;
  const oscs: OscillatorNode[] = [];
  const outG = ctx.createGain();
  outG.gain.setValueAtTime(1, t); outG.connect(master);
  [880, 932, 988].forEach((freq, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square"; o.frequency.setValueAtTime(freq, t);
    const start = t + i * 0.12;
    g.gain.setValueAtTime(0.15, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
    o.connect(g).connect(outG);
    o.start(start); o.stop(start + 0.1);
    oscs.push(o);
  });
  return { stop: () => { oscs.forEach((o) => stopSafe(o)); }, gain: outG };
}
function synthShipEngineLoop(ctx: AudioContext, master: GainNode): ActiveSound {
  const t = ctx.currentTime;
  const lfo = ctx.createOscillator();
  const lfoG = ctx.createGain();
  lfo.type = "sine"; lfo.frequency.setValueAtTime(0.5, t);
  lfoG.gain.setValueAtTime(8, t);
  lfo.connect(lfoG); lfo.start(t);
  const outG = ctx.createGain();
  outG.gain.setValueAtTime(0.12, t); outG.connect(master);
  const oscs: OscillatorNode[] = [lfo];
  for (const freq of [80, 160, 240]) {
    const o = ctx.createOscillator();
    o.type = "sine"; o.frequency.setValueAtTime(freq, t);
    lfoG.connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(freq === 80 ? 1 : 0.4, t);
    o.connect(g).connect(outG); o.start(t);
    oscs.push(o);
  }
  return { stop: () => { oscs.forEach((o) => stopSafe(o)); }, gain: outG };
}

function synthShipLand(ctx: AudioContext, master: GainNode): ActiveSound {
  const t = ctx.currentTime;
  const bufSize = Math.round(ctx.sampleRate * 0.3);
  const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) nd[i] = Math.random() * 2 - 1;
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuf;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass"; hp.frequency.setValueAtTime(2000, t);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.15, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  noiseSrc.connect(hp).connect(ng).connect(master);
  noiseSrc.start(t); noiseSrc.stop(t + 0.3);
  const osc = ctx.createOscillator();
  const og = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(80, t + 0.15);
  osc.frequency.exponentialRampToValueAtTime(30, t + 0.45);
  og.gain.setValueAtTime(0, t);
  og.gain.linearRampToValueAtTime(0.3, t + 0.15);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  osc.connect(og).connect(master);
  osc.start(t + 0.1); osc.stop(t + 0.55);
  return { stop: () => { stopSafe(noiseSrc); stopSafe(osc); }, gain: og };
}

function synthZoomLaunch(ctx: AudioContext, master: GainNode): ActiveSound {
  const t = ctx.currentTime;
  const bufSize = ctx.sampleRate * 3;
  const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) nd[i] = Math.random() * 2 - 1;
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(200, t);
  bp.frequency.exponentialRampToValueAtTime(4000, t + 2);
  bp.Q.setValueAtTime(1, t);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.05, t);
  ng.gain.linearRampToValueAtTime(0.2, t + 1.8);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 2.1);
  noiseSrc.connect(bp).connect(ng).connect(master);
  noiseSrc.start(t); noiseSrc.stop(t + 2.2);
  const osc = ctx.createOscillator();
  const og = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(200, t);
  osc.frequency.exponentialRampToValueAtTime(1500, t + 2);
  og.gain.setValueAtTime(0.05, t);
  og.gain.linearRampToValueAtTime(0.15, t + 1.8);
  og.gain.exponentialRampToValueAtTime(0.001, t + 2.1);
  osc.connect(og).connect(master);
  osc.start(t); osc.stop(t + 2.2);
  return { stop: () => { stopSafe(noiseSrc); stopSafe(osc); }, gain: og };
}

function synthZoomArrival(ctx: AudioContext, master: GainNode): ActiveSound {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine"; osc.frequency.setValueAtTime(440, t + 0.2);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.08, t + 1.0);
  g.gain.linearRampToValueAtTime(0, t + 2.0);
  osc.connect(g).connect(master);
  osc.start(t + 0.2); osc.stop(t + 2.1);
  return { stop: () => stopSafe(osc), gain: g };
}
function synthAmbientSpace(ctx: AudioContext, master: GainNode): ActiveSound {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lfoG = ctx.createGain();
  lfo.type = "sine"; lfo.frequency.setValueAtTime(0.1, t);
  lfoG.gain.setValueAtTime(3, t);
  lfo.connect(lfoG); lfoG.connect(osc.frequency);
  osc.type = "sine"; osc.frequency.setValueAtTime(40, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.06, t);
  osc.connect(g).connect(master);
  osc.start(t); lfo.start(t);
  return { stop: () => { stopSafe(osc); stopSafe(lfo); }, gain: g };
}

function synthAmbientPlanetTerra(ctx: AudioContext, master: GainNode): ActiveSound {
  const t = ctx.currentTime;
  const oscs: OscillatorNode[] = [];
  const outG = ctx.createGain();
  outG.gain.setValueAtTime(0.05, t); outG.connect(master);
  [220, 330, 277.18].forEach((freq, i) => {
    const o = ctx.createOscillator();
    o.type = "sine"; o.frequency.setValueAtTime(freq, t);
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.type = "sine"; lfo.frequency.setValueAtTime(0.15 + i * 0.07, t);
    lfoG.gain.setValueAtTime(0.3, t);
    lfo.connect(lfoG);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    lfoG.connect(g.gain);
    o.connect(g).connect(outG);
    o.start(t); lfo.start(t);
    oscs.push(o, lfo);
  });
  return { stop: () => { oscs.forEach((o) => stopSafe(o)); }, gain: outG };
}

function synthAmbientPlanetForge(ctx: AudioContext, master: GainNode): ActiveSound {
  const t = ctx.currentTime;
  const outG = ctx.createGain();
  outG.gain.setValueAtTime(0.06, t); outG.connect(master);
  const oscs: OscillatorNode[] = [];
  const bass = ctx.createOscillator();
  bass.type = "sawtooth"; bass.frequency.setValueAtTime(55, t);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.setValueAtTime(120, t);
  bass.connect(lp).connect(outG); bass.start(t);
  oscs.push(bass);
  const metal = ctx.createOscillator();
  metal.type = "square"; metal.frequency.setValueAtTime(440, t);
  const metalG = ctx.createGain();
  metalG.gain.setValueAtTime(0.08, t);
  const metalLfo = ctx.createOscillator();
  metalLfo.type = "sine"; metalLfo.frequency.setValueAtTime(0.3, t);
  const metalLfoG = ctx.createGain();
  metalLfoG.gain.setValueAtTime(0.04, t);
  metalLfo.connect(metalLfoG); metalLfoG.connect(metalG.gain);
  metal.connect(metalG).connect(outG);
  metal.start(t); metalLfo.start(t);
  oscs.push(metal, metalLfo);
  return { stop: () => { oscs.forEach((o) => stopSafe(o)); }, gain: outG };
}
// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const SYNTH_REGISTRY: Record<SoundId, SoundSynthesizer> = {
  ui_click: synthUiClick,
  ui_hover: synthUiHover,
  ui_panel_open: synthUiPanelOpen,
  ui_panel_close: synthUiPanelClose,
  ui_toggle: synthUiToggle,
  creation_rumble: synthCreationRumble,
  creation_boom: synthCreationBoom,
  creation_settle: synthCreationSettle,
  notif_comet: synthNotifComet,
  notif_gentle: synthNotifGentle,
  notif_urgent: synthNotifUrgent,
  ship_engine_loop: synthShipEngineLoop,
  ship_engine_start: synthShipEngineLoop,
  ship_land: synthShipLand,
  zoom_launch: synthZoomLaunch,
  zoom_arrival: synthZoomArrival,
  ambient_space: synthAmbientSpace,
  ambient_planet_terra: synthAmbientPlanetTerra,
  ambient_planet_forge: synthAmbientPlanetForge,
};

// ---------------------------------------------------------------------------
// SoundManager
// ---------------------------------------------------------------------------

export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume: number;
  private muted: boolean;
  private categories: Record<SoundCategory, boolean>;
  private activeSounds: Map<string, ActiveSound> = new Map();

  constructor() {
    this.volume = readLocalFloat(STORAGE_KEY_VOLUME, 0.7);
    this.muted = readLocalBool(STORAGE_KEY_MUTED, false);
    this.categories = readLocalJson<Record<SoundCategory, boolean>>(
      STORAGE_KEY_CATEGORIES,
      { ui: true, ambient: true, transitions: true, notifications: true },
    );
  }

  private ensureContext(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(
        this.muted ? 0 : this.volume,
        this.ctx.currentTime,
      );
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private getMaster(): GainNode {
    this.ensureContext();
    return this.masterGain!;
  }

  play(id: string): boolean {
    const synthId = id as SoundId;
    const synth = SYNTH_REGISTRY[synthId];
    if (!synth) return false;
    const cat = categoryFor(synthId);
    if (!this.categories[cat]) return false;
    this.stop(id);
    try {
      const active = synth(this.ensureContext(), this.getMaster());
      this.activeSounds.set(id, active);
      return true;
    } catch {
      return false;
    }
  }

  stop(id: string): void {
    const active = this.activeSounds.get(id);
    if (active) {
      active.stop();
      this.activeSounds.delete(id);
    }
  }

  fadeIn(id: string, duration: number): void {
    const synthId = id as SoundId;
    const cat = categoryFor(synthId);
    if (!this.categories[cat]) return;
    if (!this.activeSounds.has(id)) this.play(id);
    const active = this.activeSounds.get(id);
    if (!active) return;
    const ctx = this.ensureContext();
    const sec = duration / 1000;
    active.gain.gain.cancelScheduledValues(ctx.currentTime);
    active.gain.gain.setValueAtTime(0.001, ctx.currentTime);
    active.gain.gain.linearRampToValueAtTime(1, ctx.currentTime + sec);
  }

  fadeOut(id: string, duration: number): void {
    const active = this.activeSounds.get(id);
    if (!active) return;
    const ctx = this.ensureContext();
    const sec = duration / 1000;
    active.gain.gain.cancelScheduledValues(ctx.currentTime);
    active.gain.gain.setValueAtTime(active.gain.gain.value, ctx.currentTime);
    active.gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + sec);
    setTimeout(() => { this.stop(id); }, duration + 50);
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    safeWrite(STORAGE_KEY_VOLUME, String(this.volume));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        this.muted ? 0 : this.volume, this.ctx.currentTime,
      );
    }
  }

  getVolume(): number { return this.volume; }

  setMuted(muted: boolean): void {
    this.muted = muted;
    safeWrite(STORAGE_KEY_MUTED, String(this.muted));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        this.muted ? 0 : this.volume, this.ctx.currentTime,
      );
    }
  }

  isMuted(): boolean { return this.muted; }

  setCategory(category: SoundCategory, enabled: boolean): void {
    this.categories[category] = enabled;
    safeWrite(STORAGE_KEY_CATEGORIES, JSON.stringify(this.categories));
    if (!enabled) {
      for (const [id] of this.activeSounds) {
        if (categoryFor(id as SoundId) === category) this.stop(id);
      }
    }
  }

  isCategoryEnabled(category: SoundCategory): boolean {
    return this.categories[category] ?? true;
  }

  dispose(): void {
    for (const [id] of this.activeSounds) this.stop(id);
    this.activeSounds.clear();
    if (this.ctx && this.ctx.state !== "closed") void this.ctx.close();
    this.ctx = null;
    this.masterGain = null;
  }
}

export const soundManager = new SoundManager();
