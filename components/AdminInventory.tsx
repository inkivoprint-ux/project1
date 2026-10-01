"use client";
import { useState } from "react";
import type { Product } from "@/lib/products";
import { refreshSharedProducts } from "@/lib/sharedCatalog";
import { showSuccess } from "@/lib/notifications";

export function AdminInventory({ products }: { products: Product[] }) {
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  return <section className="admin-card sales-panel" id="inventory"><h2>Product stock</h2><p>Stock is shared by online and offline orders. Quantities cover the whole product, across sizes. Leave blank to stop tracking stock.</p>
    <button type="button" disabled={refreshing} onClick={async () => { setRefreshing(true); setError(""); try { await refreshSharedProducts(); } catch { setError("Stock could not be refreshed."); } finally { setRefreshing(false); } }}>Refresh stock</button>
    {error && <p role="alert">{error}</p>}
    {products.map((product) => <StockRow key={`${product.id}:${product.stockQuantity}`} product={product} />)}
  </section>;
}
function StockRow({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(product.stockQuantity?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <form className="inventory-row" onSubmit={async (event) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    try {
      const response = await fetch("/api/inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: product.slug, quantity: quantity.trim() ? Number(quantity) : null, expectedQuantity: product.stockQuantity ?? null }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      await refreshSharedProducts(); showSuccess("Product stock updated successfully.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Stock update failed."); }
    finally { setBusy(false); }
  }}><div><strong>{product.name}</strong><small>{product.stockQuantity == null ? "Stock not tracked" : `${product.stockQuantity} units available`}</small></div><label>Available units<input type="number" min="0" max="1000000" step="1" value={quantity} placeholder="Not tracked" disabled={busy} onChange={(event) => setQuantity(event.target.value)} /></label><button disabled={busy}>{busy ? "Saving…" : "Save stock"}</button>{error && <p role="alert">{error}</p>}</form>;
}
