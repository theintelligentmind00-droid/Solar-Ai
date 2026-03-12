import { describe, it, expect, beforeEach, vi } from "vitest";
import { SoundManager } from "./SoundManager";

// Mock localStorage
const storage = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storage.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    storage.delete(key);
  }),
  clear: vi.fn(() => storage.clear()),
  get length() {
    return storage.size;
  },
  key: vi.fn(() => null),
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

// Minimal AudioContext mock
class MockGainNode {
  gain = {
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
  connect = vi.fn(() => this);
  disconnect = vi.fn();
}

class MockOscillatorNode {
  type = "sine";
  frequency = { setValueAtTime: vi.fn(), value: 440, linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
  connect = vi.fn(() => new MockGainNode());
  start = vi.fn();
  stop = vi.fn();
  disconnect = vi.fn();
}

class MockBiquadFilterNode {
  type = "lowpass";
  frequency = { setValueAtTime: vi.fn(), value: 1000, linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
  Q = { setValueAtTime: vi.fn(), value: 1 };
  connect = vi.fn(() => this);
  disconnect = vi.fn();
}

class MockBufferSourceNode {
  buffer: AudioBuffer | null = null;
  connect = vi.fn(() => new MockGainNode());
  start = vi.fn();
  stop = vi.fn();
  disconnect = vi.fn();
}

class MockAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state: AudioContextState = "running";
  destination = {};

  createGain = vi.fn(() => new MockGainNode());
  createOscillator = vi.fn(() => new MockOscillatorNode());
  createBiquadFilter = vi.fn(() => new MockBiquadFilterNode());
  createBufferSource = vi.fn(() => new MockBufferSourceNode());
  createConvolver = vi.fn(() => ({
    buffer: null,
    connect: vi.fn(() => new MockGainNode()),
  }));
  createBuffer = vi.fn((_channels: number, length: number, _sampleRate: number) => ({
    getChannelData: vi.fn(() => new Float32Array(length)),
    length,
    numberOfChannels: _channels,
    sampleRate: _sampleRate,
    duration: length / _sampleRate,
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  }));
  resume = vi.fn();
  close = vi.fn();
}

// Install mock globally
Object.defineProperty(globalThis, "AudioContext", {
  value: MockAudioContext,
  writable: true,
});

describe("SoundManager", () => {
  let sm: SoundManager;

  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
    sm = new SoundManager();
  });

  it("is a class that can be instantiated", () => {
    expect(sm).toBeInstanceOf(SoundManager);
  });

  it("defaults volume to 0.7", () => {
    expect(sm.getVolume()).toBe(0.7);
  });

  it("defaults muted to false", () => {
    expect(sm.isMuted()).toBe(false);
  });

  it("reads persisted volume from localStorage", () => {
    storage.set("solar_sound_volume", "0.4");
    const sm2 = new SoundManager();
    expect(sm2.getVolume()).toBe(0.4);
  });

  it("reads persisted muted state from localStorage", () => {
    storage.set("solar_sound_muted", "true");
    const sm2 = new SoundManager();
    expect(sm2.isMuted()).toBe(true);
  });

  describe("setVolume", () => {
    it("updates the volume", () => {
      sm.setVolume(0.5);
      expect(sm.getVolume()).toBe(0.5);
    });

    it("clamps volume to [0, 1]", () => {
      sm.setVolume(1.5);
      expect(sm.getVolume()).toBe(1);
      sm.setVolume(-0.3);
      expect(sm.getVolume()).toBe(0);
    });

    it("persists volume to localStorage", () => {
      sm.setVolume(0.3);
      expect(storage.get("solar_sound_volume")).toBe("0.3");
    });
  });

  describe("setMuted", () => {
    it("updates the muted state", () => {
      sm.setMuted(true);
      expect(sm.isMuted()).toBe(true);
      sm.setMuted(false);
      expect(sm.isMuted()).toBe(false);
    });

    it("persists muted state to localStorage", () => {
      sm.setMuted(true);
      expect(storage.get("solar_sound_muted")).toBe("true");
    });
  });

  describe("category controls", () => {
    it("all categories enabled by default", () => {
      expect(sm.isCategoryEnabled("ui")).toBe(true);
      expect(sm.isCategoryEnabled("ambient")).toBe(true);
      expect(sm.isCategoryEnabled("transitions")).toBe(true);
      expect(sm.isCategoryEnabled("notifications")).toBe(true);
    });

    it("can disable a category", () => {
      sm.setCategory("ambient", false);
      expect(sm.isCategoryEnabled("ambient")).toBe(false);
    });

    it("persists category settings to localStorage", () => {
      sm.setCategory("ui", false);
      const saved = JSON.parse(storage.get("solar_sound_categories") ?? "{}");
      expect(saved.ui).toBe(false);
    });
  });

  describe("play", () => {
    it("returns true for a valid sound id", () => {
      expect(sm.play("ui_click")).toBe(true);
    });

    it("returns false for unknown sound id", () => {
      expect(sm.play("nonexistent_sound")).toBe(false);
    });

    it("returns false when category is disabled", () => {
      sm.setCategory("notifications", false);
      expect(sm.play("notif_comet")).toBe(false);
    });
  });

  describe("stop", () => {
    it("does not throw for an id that is not playing", () => {
      expect(() => sm.stop("ui_click")).not.toThrow();
    });
  });

  describe("dispose", () => {
    it("does not throw when called on a fresh manager", () => {
      expect(() => sm.dispose()).not.toThrow();
    });

    it("does not throw when called after playing a sound", () => {
      sm.play("ui_click");
      expect(() => sm.dispose()).not.toThrow();
    });
  });
});
