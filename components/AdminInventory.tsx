"use client";
import { useState } from "react";
import type { Product } from "@/lib/products";
import { isTShirtCategory, T_SHIRT_SIZES, emptySizeQuantities } from "@/lib/productSizes";
import { refreshSharedProducts } from "@/lib/sharedCatalog";
import { showSuccess } from "@/lib/notifications";

export function AdminInventory({ products }: { products: Product[] }) {
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  return <section className="admin-card sales-panel" id="inventory"><h2>Product stock</h2><p>Online and offline orders share stock. Set T-shirt stock separately for XS, S, M, L, XL and XXL. Other products use a single quantity; leave that blank to stop tracking.</p>
    <button type="button" disabled={refreshing} onClick={async () => { setRefreshing(true); setError(""); try { await refreshSharedProducts(); } catch { setError("Stock could not be refreshed."); } finally { setRefreshing(false); } }}>Refresh stock</button>
    {error && <p role="alert">{error}</p>}
    {products.map((product) => <StockRow key={`${product.id}:${product.stockQuantity}:${JSON.stringify(product.sizeStock)}`} product={product} />)}
  </section>;
}
function StockRow({ product }: { product: Product }) {
  const bySize = isTShirtCategory(product.category);
  const [quantity, setQuantity] = useState(product.stockQuantity?.toString() ?? "");
  const [sizes, setSizes] = useState(product.sizeStock ?? emptySizeQuantities());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <form className="inventory-row" onSubmit={async (event) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    try {
      const response = await fetch("/api/inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: product.slug, quantity: quantity.trim() ? Number(quantity) : null, expectedQuantity: product.stockQuantity ?? null, ...(bySize ? { sizeStock: sizes, expectedSizeStock: product.sizeStock ?? null } : {}) }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      await refreshSharedProducts(); showSuccess("Product stock updated successfully.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Stock update failed."); }
    finally { setBusy(false); }
  }}><div><strong>{product.name}</strong><small>{product.stockQuantity == null ? "Stock not tracked" : `${product.stockQuantity} units available`}</small>{bySize && !product.sizeStock && <p>Enter actual counts for every size. Your existing total stays active until you save.</p>}</div>
    {bySize ? <div className="inventory-size-fields">{T_SHIRT_SIZES.map((size) => <label key={size}>Size {size}<input required type="number" min="0" max="1000000" step="1" value={sizes[size]} disabled={busy} onChange={(event) => setSizes({ ...sizes, [size]: Number(event.target.value) })} /></label>)}</div> : <label>Available units<input type="number" min="0" max="1000000" step="1" value={quantity} placeholder="Not tracked" disabled={busy} onChange={(event) => setQuantity(event.target.value)} /></label>}
    <button disabled={busy}>{busy ? "Saving…" : "Save stock"}</button>{error && <p role="alert">{error}</p>}</form>;
}
