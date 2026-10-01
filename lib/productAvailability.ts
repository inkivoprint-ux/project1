import type { Product } from "./products";

export function isProductAvailable(product: Pick<Product, "stockQuantity">) {
  return product.stockQuantity == null || product.stockQuantity > 0;
}

export function stockLevel(quantity: number) {
  return quantity < 4 ? "low" : quantity <= 7 ? "medium" : "high";
}
