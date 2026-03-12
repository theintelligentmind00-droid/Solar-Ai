import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { PlanetCreationAnimation } from "./PlanetCreationAnimation";

// Mock soundManager
vi.mock("../sounds/SoundManager", () => ({
  soundManager: {
    play: vi.fn(() => true),
    stop: vi.fn(),
    fadeIn: vi.fn(),
    fadeOut: vi.fn(),
  },
}));

describe("PlanetCreationAnimation", () => {
  it("renders without crashing", () => {
    const onComplete = vi.fn();
    const { container } = render(
      <svg>
        <PlanetCreationAnimation
          targetX={400}
          targetY={300}
          onComplete={onComplete}
        />
      </svg>
    );
    // Should render <g> group element
    const gElement = container.querySelector("g");
    expect(gElement).not.toBeNull();
  });

  it("renders the glow filter", () => {
    const { container } = render(
      <svg>
        <PlanetCreationAnimation
          targetX={400}
          targetY={300}
          onComplete={vi.fn()}
        />
      </svg>
    );
    const filter = container.querySelector("#creation-glow");
    expect(filter).not.toBeNull();
  });

  it("accepts optional planetType and onReveal props", () => {
    const onComplete = vi.fn();
    const onReveal = vi.fn();
    const { container } = render(
      <svg>
        <PlanetCreationAnimation
          targetX={400}
          targetY={300}
          planetType="forge"
          onComplete={onComplete}
          onReveal={onReveal}
        />
      </svg>
    );
    expect(container.querySelector("g")).not.toBeNull();
  });

  it("renders with each planet type without crashing", () => {
    const types = ["terra", "forge", "oasis", "nexus", "citadel", "gaia", "void"];
    for (const planetType of types) {
      const { container } = render(
        <svg>
          <PlanetCreationAnimation
            targetX={400}
            targetY={300}
            planetType={planetType}
            onComplete={vi.fn()}
          />
        </svg>
      );
      expect(container.querySelector("g")).not.toBeNull();
    }
  });
});
