import { describe, expect, it } from "vitest";
import { createDefaultTemplate } from "./customization";
import { products } from "./products";
import { DEFAULT_TEXT_DEFORMATION, getTextStyle, getTextSurfaceOverrides, type TextFont } from "./textCustomization";

describe("customer text controls", () => {
  it("preserves existing font defaults and supports independent bold and italic", () => {
    expect(getTextStyle("classic", null, null)).toEqual({ weight: 600, italic: false });
    expect(getTextStyle("playful", null, null)).toEqual({ weight: 700, italic: true });
    for (const font of ["classic", "clean", "playful", "malayalam"] as TextFont[]) {
      expect(getTextStyle(font, false, false)).toEqual({ weight: 400, italic: false });
      expect(getTextStyle(font, true, true)).toEqual({ weight: 700, italic: true });
    }
  });

  it("offers all text surfaces without changing any product template", () => {
    for (const product of products) {
      const area = createDefaultTemplate(product).area;
      const original = structuredClone(area);
      expect(getTextSurfaceOverrides("product", area)).toEqual({});
      expect(getTextSurfaceOverrides("normal", area)).toMatchObject({ surface: "flat", curvature: 0, perspective: 0, surfaceShading: false });
      expect(getTextSurfaceOverrides("wrinkled", area)).toMatchObject({ surface: "fabric", precisionWrap: false });
      expect(getTextSurfaceOverrides("cylindrical", area)).toMatchObject({ surface: "cylinder", precisionWrap: true });
      expect(area).toEqual(original);
    }
  });

  it("retains fabric maps and physical cylinder calibration where applicable", () => {
    const fabric = createDefaultTemplate(products.find((item) => item.slug === "classic-cotton-tshirt")!).area;
    fabric.surfaceMap = "actual-product-map.png";
    expect(getTextSurfaceOverrides("wrinkled", fabric).surfaceMap).toBe(fabric.surfaceMap);
    const cylinder = createDefaultTemplate(products.find((item) => item.slug === "loop-steel-bottle")!).area;
    expect(getTextSurfaceOverrides("cylindrical", cylinder).wrapAngle).toBe(cylinder.wrapAngle);
    expect(getTextSurfaceOverrides("wrinkled", cylinder).surfaceMap).toBeUndefined();
  });
});

describe("adjustable text deformation", () => {
  const area = createDefaultTemplate(products[0]).area;
  it("renders both effects flat at zero regardless of product mapping", () => {
    for (const surface of ["wrinkled", "cylindrical"] as const) {
      const result = getTextSurfaceOverrides(surface, area, { ...DEFAULT_TEXT_DEFORMATION, wrinkleIntensity: 0, cylindricalIntensity: 0 });
      expect(result).toMatchObject({ surface: "flat", curvature: 0, perspective: 0, surfaceShading: false, precisionWrap: false });
    }
  });
  it("progressively deforms wrinkles using the actual product map without mutating it", () => {
    const mapped = { ...area, surfaceMap: "fold-map.png" };
    const original = structuredClone(mapped);
    const gentle = getTextSurfaceOverrides("wrinkled", mapped, { ...DEFAULT_TEXT_DEFORMATION, wrinkleIntensity: 25 });
    const strong = getTextSurfaceOverrides("wrinkled", mapped, { ...DEFAULT_TEXT_DEFORMATION, wrinkleIntensity: 100 });
    expect(gentle.surfaceMap).toBe(mapped.surfaceMap);
    expect(strong.displacementStrength).toBe(100);
    expect(gentle.displacementStrength).toBe(25);
    expect(strong.fabricBlendStrength).toBeGreaterThan(gentle.fabricBlendStrength!);
    expect(mapped).toEqual(original);
  });
  it("keeps horizontal, vertical and perspective controls independent", () => {
    const settings = { ...DEFAULT_TEXT_DEFORMATION, cylindricalIntensity: 50, horizontalCurvature: 80, verticalDeformation: 60, perspective: -20 };
    const result = getTextSurfaceOverrides("cylindrical", area, settings);
    expect(result).toMatchObject({ wrapAngle: 136, deformationIntensity: 0.5, verticalDeformation: 30, perspective: -10 });
    const horizontal = getTextSurfaceOverrides("cylindrical", area, { ...settings, horizontalCurvature: 0 });
    expect(horizontal.wrapAngle).toBe(0);
    expect(horizontal.verticalDeformation).toBe(result.verticalDeformation);
    expect(horizontal.perspective).toBe(result.perspective);
  });
  it("leaves normal text and product defaults independent of text effect settings", () => {
    expect(getTextSurfaceOverrides("product", area, DEFAULT_TEXT_DEFORMATION)).toEqual({});
    expect(getTextSurfaceOverrides("normal", area, DEFAULT_TEXT_DEFORMATION)).toEqual(getTextSurfaceOverrides("normal", area));
  });
});
