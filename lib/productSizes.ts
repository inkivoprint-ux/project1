export const T_SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;
export type TShirtSize = typeof T_SHIRT_SIZES[number];
export type SizeQuantities = Record<TShirtSize, number>;
export const isTShirtSize = (value: unknown): value is TShirtSize => T_SHIRT_SIZES.some((size) => size === value);
export function isTShirtCategory(category: string) {
  return /\bt[\s-]?shirts?\b/i.test(category);
}
export function assertProductSize(size: unknown, category: string, name: string) {
  if (isTShirtCategory(category)) {
    if (!isTShirtSize(size)) throw new Error(`Choose a T-shirt size (XS, S, M, L, XL or XXL) for ${name}.`);
  } else if (size !== undefined) throw new Error(`A T-shirt size cannot be applied to ${name}.`);
}
export const emptySizeQuantities = (): SizeQuantities => ({ XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 });
export const totalSizeQuantity = (quantities: SizeQuantities) => T_SHIRT_SIZES.reduce((total, size) => total + quantities[size], 0);
export function normalizeSizeQuantity(value: string | number) {
  const quantity = Number(value);
  return Number.isFinite(quantity) ? Math.max(0, Math.min(99, Math.floor(quantity))) : 0;
}
export function serializeSizeQuantities(quantities: SizeQuantities) {
  return T_SHIRT_SIZES.filter((size) => quantities[size] > 0).map((size) => `${size}:${quantities[size]}`).join(",");
}
export function parseSizeQuantities(value: string | null): SizeQuantities {
  const quantities = emptySizeQuantities();
  if (!value) return quantities;
  const seen = new Set<string>();
  for (const pair of value.split(",")) {
    const [size, raw] = pair.split(":");
    if (!isTShirtSize(size) || !/^\d{1,2}$/.test(raw ?? "") || seen.has(size) || pair.split(":").length !== 2) return emptySizeQuantities();
    seen.add(size); quantities[size] = Number(raw);
  }
  return quantities;
}
