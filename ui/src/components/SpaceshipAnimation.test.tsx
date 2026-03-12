import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { SpaceshipAnimation, getArrivalMessage } from "./SpaceshipAnimation";

// Mock soundManager
vi.mock("../sounds/SoundManager", () => ({
  soundManager: {
    play: vi.fn(() => true),
    stop: vi.fn(),
    fadeIn: vi.fn(),
    fadeOut: vi.fn(),
  },
}));

describe("SpaceshipAnimation", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <svg>
        <SpaceshipAnimation
          targetX={600}
          targetY={400}
          onComplete={vi.fn()}
        />
      </svg>
    );
    const gElement = container.querySelector("g");
    expect(gElement).not.toBeNull();
  });

  it("renders the ship polygon", () => {
    const { container } = render(
      <svg>
        <SpaceshipAnimation
          targetX={600}
          targetY={400}
          onComplete={vi.fn()}
        />
      </svg>
    );
    const polygon = container.querySelector("polygon");
    expect(polygon).not.toBeNull();
  });

  it("calls onComplete when clicked and skippable", () => {
    const onComplete = vi.fn();
    const { container } = render(
      <svg>
        <SpaceshipAnimation
          targetX={600}
          targetY={400}
          onComplete={onComplete}
          skippable={true}
        />
      </svg>
    );
    // Click the outer g element (the one with onClick)
    const outerG = container.querySelector("g");
    if (outerG) {
      fireEvent.click(outerG);
    }
    expect(onComplete).toHaveBeenCalled();
  });

  it("does not call onComplete on click when not skippable", () => {
    const onComplete = vi.fn();
    const { container } = render(
      <svg>
        <SpaceshipAnimation
          targetX={600}
          targetY={400}
          onComplete={onComplete}
          skippable={false}
        />
      </svg>
    );
    const outerG = container.querySelector("g");
    if (outerG) {
      fireEvent.click(outerG);
    }
    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe("getArrivalMessage", () => {
  it("returns a string containing the planet name", () => {
    const msg = getArrivalMessage("Mars Project");
    expect(msg).toContain("Mars Project");
  });

  it("returns a non-empty string", () => {
    const msg = getArrivalMessage("Test");
    expect(msg.length).toBeGreaterThan(0);
  });
});
