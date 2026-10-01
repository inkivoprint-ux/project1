import { describe, expect, it } from "vitest";
import { calculateRenderSize, calculateInteractiveRenderSize, containImageSize, estimatedPrintDpi } from "./renderQuality";

describe("high-quality preview rendering", () => {
  it("renders at least two physical pixels per CSS pixel while preserving the print-area ratio", () => {
    expect(calculateRenderSize(420, 630, 1)).toEqual({ width: 840, height: 1260 });
  });

  it("caps very large canvases without changing their aspect ratio", () => {
    const size = calculateRenderSize(2000, 3000, 3);
    expect(size.width * size.height).toBeLessThanOrEqual(1_800_000);
    expect(size.width / size.height).toBeCloseTo(2 / 3, 2);
  });

  it("fits portrait and landscape uploads without stretching", () => {
    expect(containImageSize(4000, 3000, 800, 1200)).toEqual({ width: 800, height: 600 });
    expect(containImageSize(3000, 4000, 800, 1200)).toEqual({ width: 800, height: 1066.6666666666667 });
  });

  it("reports the limiting print resolution", () => {
    expect(estimatedPrintDpi(3000, 4000, 254, 254)).toBe(300);
  });
});

describe("touch interaction render budget", () => {
  it("bounds expensive high-DPI previews while preserving their aspect ratio", () => {
    const size = calculateInteractiveRenderSize({ width: 1200, height: 1800 });
    expect(size.width * size.height).toBeLessThanOrEqual(160_000);
    expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(600);
    expect(size.width / size.height).toBeCloseTo(2 / 3, 2);
  });
  it("does not enlarge an already small preview", () => {
    expect(calculateInteractiveRenderSize({ width: 120, height: 200 })).toEqual({ width: 120, height: 200 });
  });
});
