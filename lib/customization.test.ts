import { describe, expect, it } from "vitest";
import { createDefaultTemplate, maskClipPath } from "./customization";
import { products } from "./products";

describe("customization templates", () => {
  it("creates a physical, versioned print area for every product", () => {
    for (const product of products) {
      const template = createDefaultTemplate(product);
      expect(template.productId).toBe(product.id);
      expect(template.version).toBe(1);
      expect(template.area.widthMm).toBe(product.printArea.widthMm);
      expect(template.area.targetDpi).toBe(300);
      expect(template.area.width).toBeGreaterThan(0);
      expect(template.area.height).toBeGreaterThan(0);
      expect(template.area.defaultArtworkScale).toBe(1);
    }
  });

  it("enables image replacement and customer transforms by default", () => {
    const template = createDefaultTemplate(products[0]);
    expect(template.tools).toMatchObject({ images: true, allowMove: true, allowScale: true, allowRotate: true, allowCrop: true });
    expect(template.tools.maxImages).toBe(1);
  });

  it("creates separate front and back fabric areas for two-sided products", () => {
    const tshirt = products.find((product) => product.slug === "classic-cotton-tshirt");
    expect(tshirt).toBeDefined();
    const template = createDefaultTemplate(tshirt!);
    expect(template.area.surface).toBe("fabric");
    expect(template.area.displacementStrength).toBeGreaterThan(0);
    expect(template.area.fabricBlendStrength).toBeGreaterThan(0);
    expect(template.area.fabricTextureStrength).toBeGreaterThan(0);
    expect(template.backArea).toMatchObject({ name: "Back print area", surface: "fabric" });
  });

  it("physically calibrates cylindrical wraps from print width and diameter", () => {
    const bottle = products.find((product) => product.slug === "loop-steel-bottle")!;
    const template = createDefaultTemplate(bottle);
    const expectedAngle = Math.round((bottle.printArea.widthMm / (Math.PI * bottle.printArea.diameterMm!)) * 360);
    expect(template.area.precisionWrap).toBe(true);
    expect(template.area.diameterMm).toBe(bottle.printArea.diameterMm);
    expect(template.area.wrapAngle).toBe(expectedAngle);
    expect(template.area.edgeFade).toBeGreaterThan(0);
  });

  it("creates reusable preset and custom print masks", () => {
    expect(maskClipPath("ellipse")).toContain("ellipse");
    expect(maskClipPath("tapered")).toContain("polygon");
    expect(maskClipPath("custom", [{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 50, y: 90 }])).toBe("polygon(10% 10%, 90% 10%, 50% 90%)");
  });
});
