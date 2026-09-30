import { describe, expect, it } from "vitest";
import { createDefaultTemplate } from "./customization";
import { products } from "./products";
import { getTextStyle, getTextSurfaceOverrides, type TextFont } from "./textCustomization";

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
