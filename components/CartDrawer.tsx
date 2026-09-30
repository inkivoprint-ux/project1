"use client";

import Image from "next/image";
import { ArrowRight, CircleAlert, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useId, useState } from "react";
import { cartEntryKey, type CartEntry } from "@/lib/cart";
import { isTShirtCategory, T_SHIRT_SIZES, type TShirtSize } from "@/lib/productSizes";
import { buildWhatsAppOrderMessage, loadDesignDraft, submitCartOrder } from "@/lib/orders";
import { formatPrice, type Product } from "@/lib/products";
import { contact } from "@/lib/siteConfig";
import { useDialog } from "@/lib/useDialog";

type Props = {
  mode?: "cart" | "buy-now";
  open: boolean;
  cart: CartEntry[];
  products: Product[];
  onClose: () => void;
  onQuantity: (productId: string, quantity: number, designId?: string, size?: TShirtSize) => void;
  onRemove: (productId: string, designId?: string, size?: TShirtSize) => void;
  onSize: (productId: string, size: TShirtSize, designId?: string, previousSize?: TShirtSize) => void;
};

export function CartDrawer({ open, cart, products, onClose, onQuantity, onRemove, onSize, mode = "cart" }: Props) {
  const directPurchase = mode === "buy-now";
  const titleId = useId();
  const [checkoutOpen, setCheckoutOpen] = useState(directPurchase);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [designFiles, setDesignFiles] = useState<Record<string, string[]>>({});
  const dialogRef = useDialog(open, onClose);
  const lines = cart.flatMap((entry) => {
    const product = products.find((item) => item.id === entry.productId);
    return product ? [{ ...entry, product }] : [];
  });
  const subtotal = lines.reduce((total, line) => total + line.product.price * line.quantity, 0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all(cart.filter((entry) => entry.designId).map(async (entry) => {
      const draft = await loadDesignDraft(entry.designId);
      return [entry.designId!, draft?.assets.map((asset) => asset.fileName) ?? []] as const;
    })).then((entries) => { if (!cancelled) setDesignFiles(Object.fromEntries(entries)); })
      .catch(() => { if (!cancelled) setDesignFiles({}); });
    return () => { cancelled = true; };
  }, [cart, open]);

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const order = await submitCartOrder({ cart, products, customerName, phone, address });
      // This is the external WhatsApp handoff, not internal Next.js navigation.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`${contact.whatsapp}?text=${encodeURIComponent(buildWhatsAppOrderMessage(order))}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The order files could not be saved. Please try again.");
      setSubmitting(false);
    }
  };

  return <div ref={dialogRef} className={`cart-layer ${open ? "is-open" : ""}`} aria-hidden={!open} inert={!open}>
    <button className="cart-scrim" tabIndex={-1} aria-label={directPurchase ? "Close checkout" : "Close cart"} onClick={onClose} />
    <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header><div><span>{directPurchase ? "Only this product · your cart stays unchanged" : "Your selections"}</span><h2 id={titleId}>{directPurchase ? "Buy now" : "Shopping cart"}</h2></div><button data-dialog-focus className="icon-button" onClick={onClose} aria-label={directPurchase ? "Close checkout" : "Close cart"}><X /></button></header>
      {lines.length ? <>
        <div className="cart-lines">
          {lines.map(({ product, quantity, designId, size }) => <article className="cart-line" key={cartEntryKey({ productId: product.id, designId, size })}>
            <div className="cart-line-image"><Image src={product.image} alt="" width={90} height={110} unoptimized={product.image.startsWith("data:")} /></div>
            <div className="cart-line-copy"><small>{product.category}</small><h3>{product.name}</h3><span>{product.finish}</span><strong>{formatPrice(product.price * quantity)}</strong>
              <span className="cart-design-label">{designId ? `Personalised design · ${designId.slice(-8)}` : "Without personalisation"}</span>
              {isTShirtCategory(product.category) && <label className="cart-size-field"><span>{size ? `Size ${size}` : "Choose T-shirt size"}</span><select required disabled={submitting} aria-label={`Size for ${product.name}${size ? `, current ${size}` : ""}${designId ? `, design ${designId.slice(-8)}` : ""}`} value={size ?? ""} onChange={(event) => { try { onSize(product.id, event.target.value as TShirtSize, designId, size); setError(""); } catch (failure) { setError(failure instanceof Error ? failure.message : "The size could not be updated."); } }}><option value="" disabled>Select size</option>{T_SHIRT_SIZES.map((option) => <option value={option} key={option}>{option}</option>)}</select></label>}
              {designId && designFiles[designId]?.length > 0 && <details className="checkout-design-files"><summary>Prepared order files ({designFiles[designId].length})</summary><ul>{designFiles[designId].map((fileName) => <li key={fileName}>{fileName}</li>)}</ul></details>}
              <div className="cart-line-actions"><div><button disabled={submitting || (directPurchase && quantity <= 1)} onClick={() => onQuantity(product.id, quantity - 1, designId, size)} aria-label={`Decrease ${product.name}${size ? ` size ${size}` : ""} quantity`}><Minus /></button><span>{quantity}</span><button disabled={submitting || quantity >= 99} onClick={() => onQuantity(product.id, quantity + 1, designId, size)} aria-label={`Increase ${product.name}${size ? ` size ${size}` : ""} quantity`}><Plus /></button></div>{(!directPurchase || lines.length > 1) && <button disabled={submitting} onClick={() => onRemove(product.id, designId, size)} aria-label={`Remove ${product.name}${size ? ` size ${size}` : ""}${designId ? " design" : ""}`}><Trash2 /> Remove</button>}</div>
            </div>
          </article>)}
        </div>
        <footer><div><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div><small>Shipping is calculated when your order is confirmed.</small>
          {error && <p className="cart-error" role="alert"><CircleAlert /> {error}</p>}
          {checkoutOpen ? <form className="cart-checkout-fields" onSubmit={submitOrder}>
            <label><span>Name</span><input required maxLength={160} value={customerName} onChange={(event) => setCustomerName(event.target.value)} autoComplete="name" /></label>
            <label><span>WhatsApp number</span><input required type="tel" maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" /></label>
            <label><span>Delivery address</span><textarea required maxLength={2000} value={address} onChange={(event) => setAddress(event.target.value)} autoComplete="street-address" /></label>
            <button type="submit" disabled={submitting}>{submitting ? "Saving order files…" : <>Save order & open WhatsApp <ArrowRight /></>}</button>
          </form> : <button className="cart-whatsapp-button" onClick={() => setCheckoutOpen(true)}>Order on WhatsApp <ArrowRight /></button>}
          <button onClick={onClose}>Continue shopping</button></footer>
      </> : <div className="cart-empty"><ShoppingBag /><h3>Your cart is empty</h3><p>Add a product and it will appear here.</p><button onClick={onClose}>Continue shopping</button></div>}
    </aside>
  </div>;
}
