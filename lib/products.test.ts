import { describe, expect, it } from "vitest";
import { formatPrice, getProduct, products } from "./products";

describe("product catalogue", () => {
  it("loads each supplied product by its stable slug", () => {
    for (const product of products) expect(getProduct(product.slug)).toEqual(product);
  });

  it("keeps physical print dimensions separate from preview pixels", () => {
    for (const product of products) {
      expect(product.printArea.widthMm).toBeGreaterThan(0);
      expect(product.printArea.heightMm).toBeGreaterThan(0);
      expect(["cylinder", "tapered-cylinder", "fabric"]).toContain(product.printArea.surface);
      if (product.printArea.surface.includes("cylinder")) expect(product.printArea.diameterMm).toBeGreaterThan(0);
    }
  });

  it("formats prices as Indian rupees", () => {
    expect(formatPrice(649)).toContain("649");
    expect(formatPrice(649)).toMatch(/₹|INR/);
  });
});
