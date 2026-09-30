import { describe, expect, it } from "vitest";
import { filterProducts, placeProduct, slugifyProductName, sortProducts } from "./productCatalog";
import { products } from "./products";

describe("product catalogue helpers", () => {
  it("creates stable URL-safe product slugs", () => {
    expect(slugifyProductName("  My New Bottle 750 ml ")).toBe("my-new-bottle-750-ml");
  });

  it("searches product name, category, finish, and description", () => {
    expect(filterProducts(products, "cork black").map((product) => product.slug)).toEqual(["cork-base-bottle"]);
    expect(filterProducts(products, "cotton").map((product) => product.slug)).toContain("classic-cotton-tshirt");
    expect(filterProducts(products, "no matching product")).toEqual([]);
  });

  it("moves a product into a numbered position and shifts the others", () => {
    const result = placeProduct(products, { ...products[3], badge: "Bestseller" }, 1);
    expect(result.map((product) => product.id)).toEqual([products[3].id, products[0].id, products[1].id, products[2].id]);
    expect(result.map((product) => product.displayOrder)).toEqual([1, 2, 3, 4]);
    expect(result[0].badge).toBe("Bestseller");
    expect(products[3].displayOrder).toBeUndefined();
    expect(sortProducts([...result].reverse()).map((product) => product.id)).toEqual(result.map((product) => product.id));
  });

  it("preserves legacy order and supports new products without duplicate positions", () => {
    expect(sortProducts(products)).toEqual(products);
    const newProduct = { ...products[0], id: "unit-new", slug: "unit-new", badge: undefined };
    const result = placeProduct(products, newProduct, 3);
    expect(result).toHaveLength(5);
    expect(result[2].id).toBe(newProduct.id);
    expect(result.map((product) => product.displayOrder)).toEqual([1, 2, 3, 4, 5]);
  });
});
