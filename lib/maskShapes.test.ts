import { describe, expect, it } from "vitest";
import { getMaskPolygon, isMaskShape, MASK_PRESETS } from "./maskShapes";
import { createDefaultTemplate, maskClipPath, validateTemplate } from "./customization";
import { products } from "./products";

describe("built-in printable shapes", () => {
  it("provides distinct bounded outlines shared by CSS and canvas rendering", () => {
    expect(MASK_PRESETS).toHaveLength(13);
    for (const shape of MASK_PRESETS) {
      expect(isMaskShape(shape.id)).toBe(true);
      const polygon = getMaskPolygon(shape.id);
      if (shape.id === "rectangle" || shape.id === "ellipse") continue;
      expect(polygon!.length).toBeGreaterThanOrEqual(3);
      expect(polygon!.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 100 && y >= 0 && y <= 100)).toBe(true);
      expect(maskClipPath(shape.id)).toBe(`polygon(${polygon!.map(({ x, y }) => `${x}% ${y}%`).join(", ")})`);
    }
    expect(getMaskPolygon("star")).toHaveLength(10);
    expect(getMaskPolygon("heart")!.length).toBeGreaterThan(24);
  });
  it("retains legacy rectangles, ellipses, tapered masks and drawn polygons", () => {
    expect(maskClipPath("rectangle")).toBeUndefined();
    expect(maskClipPath("ellipse")).toBe("ellipse(50% 50% at 50% 50%)");
    expect(maskClipPath("tapered")).toBe("polygon(0% 0%, 100% 0%, 92% 100%, 8% 100%)");
    expect(getMaskPolygon("custom", [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }])).toHaveLength(3);
  });
  it("validates and round-trips built-in presets on both product sides", () => {
    const template = createDefaultTemplate(products[3]);
    for (const shape of MASK_PRESETS) {
      const captured = JSON.parse(JSON.stringify({ ...template, area: { ...template.area, maskShape: shape.id }, backArea: { ...template.backArea, maskShape: shape.id } }));
      expect(() => validateTemplate(captured)).not.toThrow();
      expect(maskClipPath(captured.area.maskShape)).toBe(maskClipPath(shape.id));
    }
    expect(() => validateTemplate({ ...template, area: { ...template.area, maskShape: "invalid" as never } })).toThrow("supported print mask");
  });
});
