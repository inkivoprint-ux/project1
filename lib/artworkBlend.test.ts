import { applyOverlayStrength, previewBlendMode } from "./artworkBlend";
import { describe, expect, it } from "vitest";
import { canvasBlendOperation } from "./artworkBlend";

describe("preview export blend modes", () => {
  it.each(["multiply", "screen", "overlay"] as const)("maps %s to the matching canvas operation", (mode) => {
    expect(canvasBlendOperation(mode)).toBe(mode);
  });
  it.each(["normal", "", null, undefined, "unsupported"])("falls back safely for %s", (mode) => {
    expect(canvasBlendOperation(mode)).toBe("source-over");
  });
});

describe("adjustable overlay", () => {
  it("keeps artwork and alpha unchanged at zero", () => {
    const pixels = new Uint8ClampedArray([120, 160, 200, 128]);
    applyOverlayStrength(pixels, new Uint8ClampedArray([50, 60, 70, 255]), 0);
    expect([...pixels]).toEqual([120, 160, 200, 128]);
    expect(previewBlendMode("overlay", 0)).toBe("normal");
  });
  it("interpolates between normal artwork and full overlay without fading it", () => {
    const backdrop = new Uint8ClampedArray([64, 128, 192, 255]);
    const full = new Uint8ClampedArray([100, 150, 200, 128]);
    const half = new Uint8ClampedArray(full);
    applyOverlayStrength(full, backdrop, 100);
    applyOverlayStrength(half, backdrop, 50);
    for (let channel = 0; channel < 3; channel++) expect(half[channel]).toBeCloseTo(([100, 150, 200][channel] + full[channel]) / 2, 0);
    expect(half[3]).toBe(128);
    expect(previewBlendMode("overlay", 100)).toBe("overlay");
    expect(previewBlendMode("multiply", 50)).toBe("multiply");
  });
});
