"use client";

import { printPrice } from "@/lib/printPricing";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CircleAlert, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useId, useState } from "react";
import { cartEntryKey, type CartEntry } from "@/lib/cart";
import { isTShirtCategory, T_SHIRT_SIZES, type TShirtSize } from "@/lib/productSizes";
import { buildWhatsAppOrderMessage, loadDesignDraft, submitCartOrder, type OrderRecord } from "@/lib/orders";
import { OrderSupport } from "./OrderSupport";
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
  const [savedOrder, setSavedOrder] = useState<OrderRecord | null>(null);
  const [designFiles, setDesignFiles] = useState<Record<string, string[]>>({});
  const [designConfigurations, setDesignConfigurations] = useState<Record<string, Record<string, unknown>>>({});
  const dialogRef = useDialog(open, onClose);
  const lines = cart.flatMap((entry) => {
    const product = products.find((item) => item.id === entry.productId);
    return product ? [{ ...entry, product }] : [];
  });
  const subtotal = lines.reduce((total, line) => total + printPrice(line.product, designConfigurations[line.designId ?? ""]) * line.quantity, 0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all(cart.filter((entry) => entry.designId).map(async (entry) => {
      const draft = await loadDesignDraft(entry.designId);
      return { id: entry.designId!, files: draft?.assets.map((asset) => asset.fileName) ?? [], configuration: draft?.configuration ?? {} };
    })).then((entries) => { if (!cancelled) { setDesignFiles(Object.fromEntries(entries.map((entry) => [entry.id, entry.files]))); setDesignConfigurations(Object.fromEntries(entries.map((entry) => [entry.id, entry.configuration]))); } })
      .catch(() => { if (!cancelled) setDesignFiles({}); });
    return () => { cancelled = true; };
  }, [cart, open]);

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (cart.some((entry) => !entry.designId)) { setError("Customize every product before checkout. Remove or customize old items without a saved design."); return; }
    setSubmitting(true);
    setError("");
    try {
      const order = await submitCartOrder({ cart, products, customerName, phone, address });
      setSavedOrder(order);
      setSubmitting(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The order files could not be saved. Please try again.");
      setSubmitting(false);
    }
  };

  return <div ref={dialogRef} className={`cart-layer ${open ? "is-open" : ""}`} aria-hidden={!open} inert={!open}>
    <button className="cart-scrim" tabIndex={-1} aria-label={directPurchase ? "Close checkout" : "Close cart"} onClick={onClose} />
    <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header><div><span>{directPurchase ? "Only this product · your cart stays unchanged" : "Your selections"}</span><h2 id={titleId}>{directPurchase ? "Buy now" : "Shopping cart"}</h2></div><button data-dialog-focus className="icon-button" onClick={onClose} aria-label={directPurchase ? "Close checkout" : "Close cart"}><X /></button></header>
      {savedOrder ? <div className="checkout-receipt" role="status">
        <h3>{savedOrder.storageMode === "local" ? "Order prepared on this device" : "Order saved successfully"}</h3>
        <p>Order number: <strong>{savedOrder.orderNumber}</strong></p>
        <p>Take a screenshot or save this order number for future queries. {savedOrder.storageMode === "local" ? "Send the details to us on WhatsApp to place your order." : "Send your order on WhatsApp to confirm it with our team."}</p>
        <a className="button" href={`${contact.whatsapp}?text=${encodeURIComponent(buildWhatsAppOrderMessage(savedOrder))}`} target="_blank" rel="noopener noreferrer">Send order on WhatsApp <ArrowRight /></a>
        <p>No online payment has been taken.</p>
        <OrderSupport />
      </div> : lines.length ? <>
        <div className="cart-lines">
          {lines.map(({ product, quantity, designId, size }) => <article className="cart-line" key={cartEntryKey({ productId: product.id, designId, size })}>
            <div className="cart-line-image"><Image src={product.image} alt="" width={90} height={110} unoptimized={product.image.startsWith("data:")} /></div>
            <div className="cart-line-copy"><small>{product.category}</small><h3>{product.name}</h3><span>{product.finish}</span><strong>{formatPrice(printPrice(product, designConfigurations[designId ?? ""]) * quantity)}</strong>
              {!designId && <Link href={`/customize/${product.slug}?quantity=${quantity}`}>Customize this product before checkout</Link>}
              <span className="cart-design-label">{designId ? `Customized design · ${designId.slice(-8)}` : "Customization required"}</span>
              {isTShirtCategory(product.category) && <label className="cart-size-field"><span>{size ? `Size ${size}` : "Choose T-shirt size"}</span><select required disabled={submitting} aria-label={`Size for ${product.name}${size ? `, current ${size}` : ""}${designId ? `, design ${designId.slice(-8)}` : ""}`} value={size ?? ""} onChange={(event) => { try { onSize(product.id, event.target.value as TShirtSize, designId, size); setError(""); } catch (failure) { setError(failure instanceof Error ? failure.message : "The size could not be updated."); } }}><option value="" disabled>Select size</option>{T_SHIRT_SIZES.map((option) => <option value={option} key={option} disabled={product.sizeStock?.[option] === 0}>{option}{product.sizeStock?.[option] === 0 ? " · Out of stock" : ""}</option>)}</select></label>}
              {designId && designFiles[designId]?.length > 0 && <details className="checkout-design-files"><summary>Prepared order files ({designFiles[designId].length})</summary><ul>{designFiles[designId].map((fileName) => <li key={fileName}>{fileName}</li>)}</ul></details>}
              <div className="cart-line-actions"><div><button disabled={submitting || (directPurchase && quantity <= 1)} onClick={() => onQuantity(product.id, quantity - 1, designId, size)} aria-label={`Decrease ${product.name}${size ? ` size ${size}` : ""} quantity`}><Minus /></button><span>{quantity}</span><button disabled={submitting || quantity >= 99} onClick={() => onQuantity(product.id, quantity + 1, designId, size)} aria-label={`Increase ${product.name}${size ? ` size ${size}` : ""} quantity`}><Plus /></button></div>{(!directPurchase || lines.length > 1) && <button disabled={submitting} onClick={() => onRemove(product.id, designId, size)} aria-label={`Remove ${product.name}${size ? ` size ${size}` : ""}${designId ? " design" : ""}`}><Trash2 /> Remove</button>}</div>
            </div>
          </article>)}
        </div>
        <footer><div className="cart-subtotal"><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div><OrderSupport />
          {error && <p className="cart-error" role="alert"><CircleAlert /> {error}</p>}
          {checkoutOpen ? <form className="cart-checkout-fields" onSubmit={submitOrder} aria-busy={submitting}>
            <label><span>Name</span><input required maxLength={160} value={customerName} onChange={(event) => setCustomerName(event.target.value)} autoComplete="name" /></label>
            <label><span>WhatsApp number</span><input required type="tel" maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" /></label>
            <label><span>Delivery address</span><textarea required maxLength={2000} value={address} onChange={(event) => setAddress(event.target.value)} autoComplete="street-address" /></label>
            {submitting && <p className="checkout-saving-message" role="status" aria-live="polite">Please wait a moment while we save your order and artwork files. Your order number will appear when everything is ready.</p>}
            <button type="submit" disabled={submitting || cart.some((entry) => !entry.designId)}>{submitting ? "Saving… Please wait" : <>Save order & continue to WhatsApp <ArrowRight /></>}</button>
          </form> : <button className="cart-whatsapp-button" onClick={() => setCheckoutOpen(true)}>Order on WhatsApp <ArrowRight /></button>}
          <button onClick={onClose}>Continue shopping</button></footer>
      </> : <div className="cart-empty"><ShoppingBag /><h3>Your cart is empty</h3><p>Add a product and it will appear here.</p><button onClick={onClose}>Continue shopping</button></div>}
    </aside>
  </div>;
}
