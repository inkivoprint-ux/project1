import type { Product } from "./products";
import { isTShirtCategory } from "./productSizes";

export function hasBothPrintSides(configuration?: Record<string, unknown>): boolean {
  const sides = configuration?.sides;
  return Boolean(sides && typeof sides === "object" && "front" in sides && sides.front && "back" in sides && sides.back);
}

export function printPrice(product: Pick<Product, "price" | "frontBackPrice" | "category">, configuration?: Record<string, unknown>): number {
  return isTShirtCategory(product.category) && hasBothPrintSides(configuration) ? product.frontBackPrice ?? product.price : product.price;
}
