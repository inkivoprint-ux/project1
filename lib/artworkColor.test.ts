import { describe, expect, it } from "vitest";
import { adjustArtworkPixels } from "./artworkColor";
import { createDefaultTemplate, validateTemplate } from "./customization";
import { products } from "./products";

describe("artwork colour adjustments", () => {
  it("preserves existing artwork at default settings, including alpha", () => {
    const pixels = new Uint8ClampedArray([45, 120, 200, 128]);
    adjustArtworkPixels(pixels, {});
    expect([...pixels]).toEqual([45, 120, 200, 128]);
  });
  it("changes brightness and contrast independently without changing opacity", () => {
    const bright = new Uint8ClampedArray([40, 60, 100, 128]);
    adjustArtworkPixels(bright, { brightness: 150 });
    expect([...bright]).toEqual([60, 90, 150, 128]);
    const contrast = new Uint8ClampedArray([40, 150, 200, 128]);
    adjustArtworkPixels(contrast, { contrast: 200 });
    expect([...contrast]).toEqual([0, 172, 255, 128]);
  });
  it("makes zero saturation greyscale and preserves transparent pixels", () => {
    const pixels = new Uint8ClampedArray([255, 0, 0, 255, 255, 0, 0, 0]);
    adjustArtworkPixels(pixels, { saturation: 0 });
    expect([...pixels]).toEqual([54, 54, 54, 255, 255, 0, 0, 0]);
  });
  it("accepts old templates and rejects invalid saved adjustments", () => {
    const template = createDefaultTemplate(products[0]);
    expect(() => validateTemplate(template)).not.toThrow();
    for (const invalid of [-1, 201, NaN]) {
      expect(() => validateTemplate({ ...template, area: { ...template.area, brightness: invalid } })).toThrow("Colour adjustments");
    }
  });
});
