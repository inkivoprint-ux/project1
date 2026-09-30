"use client";

import { useState } from "react";
import { cartEntryKey, changeCartEntrySize, type CartEntry } from "@/lib/cart";
import type { Product } from "@/lib/products";
import { createPurchaseEntry, normalizePurchaseQuantity } from "@/lib/purchase";
import { CartDrawer } from "./CartDrawer";

export function BuyNowCheckout({ entries, product, onClose }: { entries: CartEntry[]; product: Product; onClose: () => void }) {
  const [selection, setSelection] = useState(() => entries.map((entry) => createPurchaseEntry(product.id, entry.quantity, entry.designId, entry.size)));
  return <CartDrawer open mode="buy-now" cart={selection} products={[product]} onClose={onClose}
    onQuantity={(id, quantity, designId, size) => setSelection((current) => current.map((entry) => cartEntryKey(entry) === cartEntryKey({ productId: id, designId, size }) ? createPurchaseEntry(id, normalizePurchaseQuantity(quantity), designId, size) : entry))}
    onSize={(id, size, designId, previousSize) => setSelection(changeCartEntrySize(selection, id, size, designId, previousSize))}
    onRemove={(id, designId, size) => { const next = selection.filter((entry) => cartEntryKey(entry) !== cartEntryKey({ productId: id, designId, size })); if (next.length) setSelection(next); else onClose(); }} />;
}
