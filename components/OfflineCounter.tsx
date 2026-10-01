"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AdminNav } from "./AdminNav";
import { refreshSharedProducts } from "@/lib/sharedCatalog";
import { formatPrice, type Product } from "@/lib/products";
import { isTShirtCategory, T_SHIRT_SIZES } from "@/lib/productSizes";
import { showSuccess } from "@/lib/notifications";
import { isProductAvailable } from "@/lib/productAvailability";
import { Customizer } from "./Customizer";
import { submitCartOrder } from "@/lib/orders";
import type { TShirtSize } from "@/lib/productSizes";

export function OfflineCounter() {
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<Array<{ slug: string; quantity: number; size: string; designId?: string }>>([{ slug: "", quantity: 1, size: "" }]);
  const [editing, setEditing] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("Walk-in customer");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const keys = useRef(new Map<string, string>());
  useEffect(() => { refreshSharedProducts().then(setProducts).catch(() => setError("Counter products could not be loaded.")); }, []);
  const total = lines.reduce((sum, line) => sum + (products.find((product) => product.slug === line.slug)?.price ?? 0) * line.quantity, 0);
  const editingProduct = editing === null ? undefined : products.find((product) => product.slug === lines[editing]?.slug);
  if (editingProduct && editing !== null) return <Customizer product={editingProduct} counterSelection={lines[editing]} onCancel={() => setEditing(null)} onPrepared={(entries) => { setLines((current) => current.flatMap((line, index) => index === editing ? entries.map((entry) => ({ slug: editingProduct.slug, quantity: entry.quantity, size: entry.size ?? "", designId: entry.designId })) : [line])); setEditing(null); }} />;
  return <main className="admin-shell"><AdminNav /><div className="admin-content"><section className="admin-card sales-panel"><h1>Offline counter</h1><p>Record a counter sale without WhatsApp or an online payment gateway. Submitting reduces the same stock used by the website.</p><Link href="/admin#reports">View offline sales reports</Link>
    <form onSubmit={async (event) => {
      event.preventDefault(); if (busy) return; setBusy(true); setError("");
      try {
        if (lines.some((line) => line.designId)) {
          const order = await submitCartOrder({ salesChannel: "offline", customerName, phone, address: address || "Offline counter", products, cart: lines.map((line) => { const product = products.find((product) => product.slug === line.slug); if (!product) throw new Error("Choose every product."); return { productId: product.id, quantity: line.quantity, size: (line.size || undefined) as TShirtSize | undefined, designId: line.designId }; }) });
          setLines([{ slug: "", quantity: 1, size: "" }]); keys.current.clear(); showSuccess(`Offline order ${order.orderNumber} saved. Artwork and stock updated.`); try { setProducts(await refreshSharedProducts()); } catch { setError("Order saved. Refresh to load updated stock."); } return;
        }
        const content = { customerName, phone, address: address || "Offline counter", items: lines.map((line) => { const product = products.find((entry) => entry.slug === line.slug); if (!product) throw new Error("Choose every product."); return { slug: line.slug, quantity: line.quantity, unitPrice: product.price, ...(line.size ? { size: line.size } : {}) }; }) };
        const signature = JSON.stringify(content); if (!keys.current.has(signature)) keys.current.set(signature, crypto.randomUUID());
        const response = await fetch("/api/counter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...content, idempotencyKey: keys.current.get(signature) }) });
        const result = await response.json(); if (!response.ok) throw new Error(result.error);
        keys.current.clear(); setLines([{ slug: "", quantity: 1, size: "" }]); setCustomerName("Walk-in customer"); setPhone(""); setAddress("");
        showSuccess(`Offline order ${result.orderNumber} saved successfully. Stock updated.`);
        try { setProducts(await refreshSharedProducts()); } catch { setError("Order saved successfully. Refresh the counter to load updated stock."); }
      } catch (failure) { setError(failure instanceof Error ? failure.message : "Counter submission failed."); }
      finally { setBusy(false); }
    }}><fieldset disabled={busy} className="counter-fields">
      <label>Customer name<input required maxLength={160} value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label>
      <label>Phone (optional)<input type="tel" maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
      <label>Address / note (optional)<input maxLength={2000} value={address} onChange={(event) => setAddress(event.target.value)} /></label>
      {lines.map((line, index) => { const product = products.find((entry) => entry.slug === line.slug); const update = (patch: Partial<typeof line>) => setLines((current) => current.map((entry, slot) => slot === index ? { ...entry, ...patch } : entry)); return <div className="counter-line" key={index}>
        <label>Product<select required value={line.slug} onChange={(event) => update({ slug: event.target.value, size: "", designId: undefined })}><option value="">Choose product</option>{products.filter(isProductAvailable).map((entry) => <option key={entry.id} value={entry.slug}>{entry.name} · {formatPrice(entry.price)}{entry.stockQuantity == null ? "" : ` · ${entry.stockQuantity} in stock`}</option>)}</select></label>
        {product && <div><button type="button" onClick={() => setEditing(index)}>{line.designId ? "Replace personalisation" : "Personalise product"}</button>{line.designId && <><small>Design saved, including selected sides.</small><button type="button" onClick={() => update({ designId: undefined })}>Remove personalisation</button></>}</div>}
        {product && isTShirtCategory(product.category) && <label>Size<select required value={line.size} onChange={(event) => update({ size: event.target.value })}><option value="">Choose size</option>{T_SHIRT_SIZES.map((size) => <option key={size} disabled={product.sizeStock?.[size] === 0}>{size}{product.sizeStock ? ` · ${product.sizeStock[size]} in stock` : ""}</option>)}</select></label>}
        <label>Quantity<input required type="number" min="1" max="99" step="1" value={line.quantity} onChange={(event) => update({ quantity: Number(event.target.value) })} /></label>
        {lines.length > 1 && <button type="button" onClick={() => setLines((current) => current.filter((_, slot) => slot !== index))}>Remove</button>}
      </div>; })}
      <button type="button" disabled={lines.length >= 99} onClick={() => setLines((current) => [...current, { slug: "", quantity: 1, size: "" }])}>Add another product</button>
      <strong>Total: {formatPrice(total)}</strong><button type="submit">{busy ? "Submitting… Please wait" : "Submit offline order"}</button>
    </fieldset></form>{error && <p role="alert">{error}</p>}
  </section></div></main>;
}
