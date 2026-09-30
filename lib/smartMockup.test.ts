import { describe, expect, it } from "vitest";
import { detectForegroundBounds, suggestSmartArea } from "./smartMockup";

function transparentImage(width: number, height: number, object: { x: number; y: number; width: number; height: number }) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = object.y; y < object.y + object.height; y += 1) {
    for (let x = object.x; x < object.x + object.width; x += 1) {
      const index = (y * width + x) * 4;
      data[index] = 40;
      data[index + 1] = 60;
      data[index + 2] = 80;
      data[index + 3] = 255;
    }
  }
  return { width, height, data };
}

describe("smart mockup detection", () => {
  it("finds a visible product on a transparent mockup", () => {
    const image = transparentImage(100, 120, { x: 20, y: 10, width: 60, height: 100 });
    expect(detectForegroundBounds(image)).toEqual({ x: 20, y: 10, width: 60, height: 100 });
  });

  it("suggests a centered fabric print area and fabric effects", () => {
    const image = transparentImage(100, 120, { x: 10, y: 5, width: 80, height: 110 });
    const suggestion = suggestSmartArea(image, "fabric", 600, 720);
    expect(suggestion.surface).toBe("fabric");
    expect(suggestion.blendMode).toBe("normal");
    expect(suggestion.curvature).toBeGreaterThan(0);
    expect(suggestion.x + suggestion.width / 2).toBeCloseTo(50, 0);
    expect(suggestion.confidence).toBeGreaterThan(60);
  });
});
