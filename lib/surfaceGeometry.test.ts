import { describe, expect, it } from "vitest";
import { curvedSourcePosition, surfaceCurveAngle, surfaceRowScale } from "./surfaceGeometry";

describe("custom mask surface geometry", () => {
  it("has identity mapping at zero curvature even with stale precision-wrap settings", () => {
    const angle = surfaceCurveAngle("custom-mask", 0, true, 150);
    expect(angle).toBe(0);
    for (const position of [-1, -0.5, 0, 0.5, 1]) expect(curvedSourcePosition(position, angle)).toBe(position);
  });

  it("increases the curvature effect while preserving the centre and endpoints", () => {
    const gentle = surfaceCurveAngle("custom-mask", 25, false, 110);
    const strong = surfaceCurveAngle("custom-mask", 100, false, 110);
    expect(curvedSourcePosition(0.5, strong)).toBeLessThan(curvedSourcePosition(0.5, gentle));
    for (const position of [-1, 0, 1]) expect(curvedSourcePosition(position, strong)).toBeCloseTo(position);
    expect(curvedSourcePosition(-0.5, strong)).toBeCloseTo(-curvedSourcePosition(0.5, strong));
  });

  it("applies reversible positive and negative taper without curvature", () => {
    expect(surfaceRowScale("custom-mask", 0, 0)).toBe(1);
    expect(surfaceRowScale("custom-mask", 50, 0)).toBeCloseTo(0.92);
    expect(surfaceRowScale("custom-mask", 50, 1)).toBeCloseTo(1.08);
    expect(surfaceRowScale("custom-mask", -50, 0)).toBeCloseTo(1.08);
    expect(surfaceRowScale("custom-mask", -50, 1)).toBeCloseTo(0.92);
    expect(surfaceRowScale("custom-mask", 50, 0.5)).toBe(1);
  });

  it("retains cylinder wrap geometry and does not leak taper into flat or cylinder modes", () => {
    expect(surfaceCurveAngle("cylinder", 72, true, 120)).toBeCloseTo(Math.PI / 3);
    expect(surfaceRowScale("cylinder", 50, 0)).toBe(1);
    expect(surfaceRowScale("flat", 50, 0)).toBe(1);
    expect(surfaceRowScale("tapered-cylinder", 50, 0)).toBeCloseTo(0.92);
  });

  it("clamps out-of-range saved controls to the editor bounds", () => {
    expect(surfaceCurveAngle("custom-mask", -10, false, 110)).toBe(0);
    expect(surfaceCurveAngle("custom-mask", 200, false, 110)).toBe(1.3);
    expect(surfaceRowScale("custom-mask", 500, 0)).toBeCloseTo(0.92);
  });
});
