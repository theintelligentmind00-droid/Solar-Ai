import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDayNightCycle } from "./useDayNightCycle";

describe("useDayNightCycle", () => {
  let setPropertySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setPropertySpy = vi.spyOn(document.documentElement.style, "setProperty");
  });

  afterEach(() => {
    setPropertySpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("returns a state object with period and progress", () => {
    const { result } = renderHook(() => useDayNightCycle());
    expect(result.current).toHaveProperty("period");
    expect(result.current).toHaveProperty("progress");
    expect(["dawn", "day", "dusk", "night"]).toContain(result.current.period);
    expect(result.current.progress).toBeGreaterThanOrEqual(0);
    expect(result.current.progress).toBeLessThanOrEqual(1);
  });

  it("sets CSS custom properties on the document root", () => {
    renderHook(() => useDayNightCycle());
    const propertyNames = setPropertySpy.mock.calls.map(
      (call: [string, string]) => call[0]
    );
    expect(propertyNames).toContain("--space-bg-tint");
    expect(propertyNames).toContain("--star-opacity");
    expect(propertyNames).toContain("--sun-color-primary");
    expect(propertyNames).toContain("--sun-glow-intensity");
    expect(propertyNames).toContain("--ambient-warmth");
  });

  it("returns 'day' period when system time is midday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 11, 12, 0, 0)); // noon
    const { result } = renderHook(() => useDayNightCycle());
    expect(result.current.period).toBe("day");
    vi.useRealTimers();
  });

  it("returns 'night' period when system time is midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 11, 0, 0, 0)); // midnight
    const { result } = renderHook(() => useDayNightCycle());
    expect(result.current.period).toBe("night");
    vi.useRealTimers();
  });

  it("returns 'dawn' period at 6am", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 11, 6, 0, 0));
    const { result } = renderHook(() => useDayNightCycle());
    expect(result.current.period).toBe("dawn");
    vi.useRealTimers();
  });

  it("returns 'dusk' period at 6pm", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 11, 18, 0, 0));
    const { result } = renderHook(() => useDayNightCycle());
    expect(result.current.period).toBe("dusk");
    vi.useRealTimers();
  });
});
