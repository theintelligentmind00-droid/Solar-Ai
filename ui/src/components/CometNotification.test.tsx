import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { CometNotificationLayer } from "./CometNotification";

// Mock soundManager to avoid AudioContext issues
vi.mock("../sounds/SoundManager", () => ({
  soundManager: {
    play: vi.fn(() => true),
    stop: vi.fn(),
    fadeIn: vi.fn(),
    fadeOut: vi.fn(),
  },
}));

// requestAnimationFrame / cancelAnimationFrame already provided by jsdom

describe("CometNotificationLayer", () => {
  it("renders without crashing when comets array is empty", () => {
    const { container } = render(
      <svg>
        <CometNotificationLayer comets={[]} />
      </svg>
    );
    // Should render the <g> group with defs
    const gElement = container.querySelector("g");
    expect(gElement).not.toBeNull();
  });

  it("renders without crashing with comet data", () => {
    const comets = [
      { id: "c1", type: "email" as const, targetX: 300, targetY: 200 },
      { id: "c2", type: "calendar" as const, targetX: 500, targetY: 400, urgent: true },
    ];

    const { container } = render(
      <svg>
        <CometNotificationLayer comets={comets} />
      </svg>
    );
    expect(container.querySelector("g")).not.toBeNull();
  });

  it("renders the glow filter definition", () => {
    const { container } = render(
      <svg>
        <CometNotificationLayer comets={[]} />
      </svg>
    );
    const filter = container.querySelector("#comet-glow");
    expect(filter).not.toBeNull();
  });

  it("calls onCometArrived callback type is a function", () => {
    const onArrived = vi.fn();
    // Just verify it accepts the callback without crashing
    const { container } = render(
      <svg>
        <CometNotificationLayer comets={[]} onCometArrived={onArrived} />
      </svg>
    );
    expect(container.querySelector("g")).not.toBeNull();
  });
});
