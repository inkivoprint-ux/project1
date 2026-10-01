import type { CartEntry } from "./cart";
import type { Product } from "./products";
import { isTShirtCategory, isTShirtSize, T_SHIRT_SIZES, type SizeQuantities, type TShirtSize } from "./productSizes";

export function normalizePurchaseQuantity(value: unknown): number {
  if (value === null || value === undefined || value === "") return 1;
  const quantity = Number(value);
  return Number.isFinite(quantity) ? Math.max(1, Math.min(99, Math.floor(quantity))) : 1;
}

// A direct purchase is deliberately independent of the persisted shopping cart.
export function createPurchaseEntry(productId: string, quantity: number, designId?: string, size?: TShirtSize): CartEntry {
  if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new Error("Choose a quantity between 1 and 99.");
  }
  if (size !== undefined && !isTShirtSize(size)) throw new Error("Choose a supported T-shirt size.");
  return { productId, quantity, ...(designId ? { designId } : {}), ...(size ? { size } : {}) };
}

export function createProductPurchaseEntries(product: Pick<Product, "id" | "category" | "stockQuantity" | "sizeStock">, quantity: number, sizes?: SizeQuantities, designId?: string): CartEntry[] {
  if (!isTShirtCategory(product.category)) {
    if (product.stockQuantity != null && quantity > product.stockQuantity) throw new Error(`Only ${product.stockQuantity} units are in stock.`);
    return [createPurchaseEntry(product.id, quantity, designId)];
  }
  if (!sizes || T_SHIRT_SIZES.some((size) => !Number.isInteger(sizes[size]) || sizes[size] < 0 || sizes[size] > 99)) throw new Error("Choose a valid quantity for each T-shirt size.");
  const entries = T_SHIRT_SIZES.filter((size) => sizes[size] > 0).map((size) => createPurchaseEntry(product.id, sizes[size], designId, size));
  if (!entries.length) throw new Error("Choose at least one T-shirt size and quantity.");
  if (product.sizeStock) for (const entry of entries) { const available = product.sizeStock[entry.size!]; if (entry.quantity > available) throw new Error(`Only ${available} units of size ${entry.size} are in stock.`); }
  if (product.stockQuantity != null && entries.reduce((sum, entry) => sum + entry.quantity, 0) > product.stockQuantity) throw new Error(`Only ${product.stockQuantity} units are in stock across all sizes.`);
  return entries;
}
