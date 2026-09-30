import { isTShirtSize, type TShirtSize } from "./productSizes";
export type CartEntry = { productId: string; quantity: number; designId?: string; size?: TShirtSize };
export const cartEntryKey = (entry: Pick<CartEntry, "productId" | "designId" | "size">) => JSON.stringify([entry.productId, entry.designId ?? null, entry.size ?? null]);

const CART_KEY = "inkivo:cart";
export const CART_EVENT = "inkivo:cart-changed";

export function normalizeCart(value: unknown): CartEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Partial<CartEntry>;
    if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) return [];
    const quantity = Math.max(1, Math.min(99, Math.floor(Number(item.quantity))));
    return typeof item.productId === "string" && item.productId ? [{ productId: item.productId, quantity, designId: typeof item.designId === "string" ? item.designId : undefined, ...(isTShirtSize(item.size) ? { size: item.size } : {}) }] : [];
  });
}

export function loadCart(): CartEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return normalizeCart(JSON.parse(window.localStorage.getItem(CART_KEY) || "[]"));
  } catch {
    return [];
  }
}

function saveCart(cart: CartEntry[]) {
  window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: cart }));
  return cart;
}

export function addCartItem(productId: string, quantity = 1, designId?: string, size?: TShirtSize) {
  if (!productId || !Number.isFinite(quantity) || quantity <= 0) throw new Error("Choose a valid product and quantity.");
  if (size !== undefined && !isTShirtSize(size)) throw new Error("Choose a supported T-shirt size.");
  const cart = loadCart();
  const existing = cart.find((item) => item.productId === productId && item.designId === designId && item.size === size);
  if (existing) existing.quantity = Math.min(99, existing.quantity + Math.floor(quantity));
  else cart.push({ productId, quantity: Math.min(99, Math.max(1, Math.floor(quantity))), designId, ...(size ? { size } : {}) });
  return saveCart(cart);
}

export function addCartEntries(entries: CartEntry[]) {
  if (!entries.length) throw new Error("Choose a T-shirt size and quantity first.");
  const cart = loadCart();
  for (const entry of entries) {
    if (!entry.productId || !Number.isInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > 99 || (entry.size !== undefined && !isTShirtSize(entry.size))) throw new Error("Choose a valid size and quantity.");
    const existing = cart.find((item) => cartEntryKey(item) === cartEntryKey(entry));
    if (existing) {
      if (existing.quantity + entry.quantity > 99) throw new Error(`Your cart already contains this selection. Each size/design can contain at most 99 items.`);
      existing.quantity += entry.quantity;
    } else cart.push({ ...entry });
  }
  // Save the entire selection together; a failure cannot add only some sizes.
  return saveCart(cart);
}

export function changeCartEntrySize(cart: CartEntry[], productId: string, size: TShirtSize, designId?: string, previousSize?: TShirtSize): CartEntry[] {
  if (!isTShirtSize(size)) throw new Error("Choose a supported T-shirt size.");
  const targetKey = cartEntryKey({ productId, designId, size: previousSize });
  const target = cart.find((item) => cartEntryKey(item) === targetKey);
  if (!target || previousSize === size) return cart;
  const destinationKey = cartEntryKey({ productId, designId, size });
  const existing = cart.find((item) => cartEntryKey(item) === destinationKey);
  if (existing && existing.quantity + target.quantity > 99) throw new Error("That size would exceed 99 items. Reduce the quantity first.");
  return existing
    ? cart.filter((item) => cartEntryKey(item) !== targetKey).map((item) => cartEntryKey(item) === destinationKey ? { ...item, quantity: item.quantity + target.quantity } : item)
    : cart.map((item) => cartEntryKey(item) === targetKey ? { ...item, size } : item);
}

export function updateCartItemSize(productId: string, size: TShirtSize, designId?: string, previousSize?: TShirtSize) {
  return saveCart(changeCartEntrySize(loadCart(), productId, size, designId, previousSize));
}

export function updateCartItem(productId: string, quantity: number, designId?: string, size?: TShirtSize) {
  if (!Number.isFinite(quantity)) throw new Error("Choose a valid quantity.");
  if (quantity <= 0) return removeCartItem(productId, designId, size);
  return saveCart(loadCart().map((item) => item.productId === productId && item.designId === designId && item.size === size ? { ...item, quantity: Math.max(1, Math.min(99, Math.floor(quantity))) } : item));
}

export function removeCartItem(productId: string, designId?: string, size?: TShirtSize) {
  return saveCart(loadCart().filter((item) => !(item.productId === productId && item.designId === designId && item.size === size)));
}

export function cartItemCount(cart: CartEntry[]) {
  return cart.reduce((total, item) => total + item.quantity, 0);
}

export function subscribeToCart(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => { if (event.key === CART_KEY) callback(); };
  window.addEventListener(CART_EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(CART_EVENT, callback); window.removeEventListener("storage", onStorage); };
}
