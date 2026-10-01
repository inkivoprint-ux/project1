import type { Product } from "./products";

export function isProductAvailable(product: Pick<Product, "stockQuantity">) {
  return product.stockQuantity == null || product.stockQuantity > 0;
}
