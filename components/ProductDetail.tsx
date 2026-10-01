"use client";

import { showSuccess } from "@/lib/notifications";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ShoppingBag, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { addCartEntries, cartItemCount, loadCart, removeCartItem, subscribeToCart, updateCartItem, updateCartItemSize, type CartEntry } from "@/lib/cart";
import { loadAllProducts, subscribeToProductCatalog } from "@/lib/productCatalog";
import { formatPrice, type Product } from "@/lib/products";
import { createProductPurchaseEntries } from "@/lib/purchase";
import { emptySizeQuantities, isTShirtCategory, serializeSizeQuantities, totalSizeQuantity } from "@/lib/productSizes";
import { SizeQuantitySelector } from "./SizeQuantitySelector";
import { BrandLogo } from "./BrandLogo";
import { BuyNowCheckout } from "./BuyNowCheckout";
import { CartDrawer } from "./CartDrawer";
import { QuantitySelector } from "./QuantitySelector";
import { hasSupabaseConfiguration } from "@/lib/supabase/config";
import { refreshSharedProducts } from "@/lib/sharedCatalog";
import { OrderSupport } from "./OrderSupport";

export function ProductDetail({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);
  const [sizeQuantities, setSizeQuantities] = useState(emptySizeQuantities);
  const isTShirt = isTShirtCategory(product.category);
  const selectedQuantity = isTShirt ? totalSizeQuantity(sizeQuantities) : quantity;
  const [personalised, setPersonalised] = useState(false);
  const [view, setView] = useState("front");
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [catalogue, setCatalogue] = useState<Product[]>([product]);
  const [cartOpen, setCartOpen] = useState(false);
  const [buyNow, setBuyNow] = useState<CartEntry[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const refreshCart = () => setCart(loadCart());
    const refreshProducts = () => setCatalogue(loadAllProducts());
    const timer = window.setTimeout(() => { refreshCart(); if (hasSupabaseConfiguration()) refreshSharedProducts().then(refreshProducts).catch(() => setError("The catalogue could not be refreshed. Reload before ordering.")); else refreshProducts(); }, 0);
    const unsubscribeCart = subscribeToCart(refreshCart);
    const unsubscribeProducts = subscribeToProductCatalog(refreshProducts);
    return () => { window.clearTimeout(timer); unsubscribeCart(); unsubscribeProducts(); };
  }, []);

  const image = product.views?.find((item) => item.id === view)?.image ?? product.image;
  const customizerUrl = `/customize/${product.slug}?quantity=${selectedQuantity}&personalise=1&view=${view}${isTShirt ? `&sizes=${encodeURIComponent(serializeSizeQuantities(sizeQuantities))}` : ""}`;
  function addToCart() {
    try { setCart(addCartEntries(createProductPurchaseEntries(product, quantity, sizeQuantities))); setCartOpen(true); setError(""); showSuccess("Added to cart successfully."); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Your cart could not be saved. Please allow browser storage and try again."); }
  }

  return <div className="product-detail-shell">
    <header className="product-detail-header container">
      <Link href="/#shop" className="product-detail-back" aria-label="All products"><ArrowLeft size={18} /><span>All products</span></Link>
      <BrandLogo />
      <button className="product-detail-cart" aria-label={`Open cart, ${cartItemCount(cart)} items`} onClick={() => setCartOpen(true)}><ShoppingBag size={20} /><span>{cartItemCount(cart)}</span></button>
    </header>
    <main id="main-content" className="container product-detail-layout">
      <section className="product-detail-gallery" aria-label="Product images">
        <div className="product-detail-image">{product.badge && <span className="product-badge">{product.badge}</span>}<Image src={image} alt={`${product.name}${product.views ? ` · ${view}` : ""}`} fill sizes="(max-width: 900px) 90vw, 50vw" preload unoptimized={image.startsWith("data:")} /></div>
        {product.views && <div className="view-switch">{product.views.map((item) => <button key={item.id} aria-pressed={view === item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>{item.label}</button>)}</div>}
      </section>
      <section className="product-detail-copy" aria-label="Product details">
        <span className="eyebrow">{product.category}</span><h1>{product.name}</h1><p className="product-detail-finish">{product.finish}</p>
        <p className="product-stock-status">{product.stockQuantity == null ? "" : product.stockQuantity === 0 ? "Out of stock" : `${product.stockQuantity} units in stock`}</p><div className="product-detail-price"><strong>{formatPrice(product.price)}</strong>{product.compareAt && <del>{formatPrice(product.compareAt)}</del>}<small>per item</small></div>
        <div className="product-description"><h2>About this product</h2><p>{product.description || "Contact the Inkivo team for more information about this product."}</p></div>
        <dl className="product-detail-specs"><div><dt>Finish / specification</dt><dd>{product.finish}</dd></div><div><dt>Personalisation area</dt><dd>{product.printArea.widthMm} × {product.printArea.heightMm} mm</dd></div>{product.views && <div><dt>Available previews</dt><dd>{product.views.map((item) => item.label).join(" / ")}</dd></div>}</dl>
        <fieldset className="purchase-options"><legend>Make it yours</legend>
          <label className={!personalised ? "selected" : ""}><input type="radio" name="personalisation" checked={!personalised} onChange={() => setPersonalised(false)} /><span>Without personalisation<small>Order the product as shown</small></span></label>
          <label className={personalised ? "selected" : ""}><input type="radio" name="personalisation" checked={personalised} onChange={() => setPersonalised(true)} /><span>With personalisation<small>Add your photo, name or text in the editor</small></span><Sparkles size={18} /></label>
        </fieldset>
        {isTShirt ? <SizeQuantitySelector quantities={sizeQuantities} onChange={setSizeQuantities} /> : <QuantitySelector quantity={quantity} onChange={setQuantity} />}
        <div className="purchase-total"><span>Item total</span><strong>{formatPrice(product.price * selectedQuantity)}</strong></div>
        <div className="purchase-buttons">{personalised && selectedQuantity > 0 ? <>
          <Link className="button purchase-secondary" href={`${customizerUrl}&intent=cart`}><ShoppingBag size={18} /> Personalise & add to cart</Link>
          <Link className="button" href={`${customizerUrl}&intent=buy-now`}>Personalise & buy now <ArrowRight size={18} /></Link>
        </> : <>
          <button className="button purchase-secondary" disabled={!selectedQuantity} onClick={addToCart}><ShoppingBag size={18} /> {personalised ? "Personalise & add to cart" : "Add to cart"}</button>
          <button className="button" disabled={!selectedQuantity} onClick={() => setBuyNow(createProductPurchaseEntries(product, quantity, sizeQuantities))}>{personalised ? "Personalise & buy now" : "Buy now"} <ArrowRight size={18} /></button>
        </>}</div>
        <p className="purchase-note">{personalised ? "Create and preview your design first. Your selected quantity carries into the editor." : "Buy now checks out only this product; your shopping cart is not changed."} Final order details are confirmed on WhatsApp.</p>
        <OrderSupport />
        {error && <p className="purchase-error" role="alert">{error}</p>}
        <Link href="/#contact" className="text-link">Questions about this product? Talk to us <ArrowRight size={16} /></Link>
      </section>
    </main>
    <CartDrawer open={cartOpen} cart={cart} products={catalogue} onClose={() => setCartOpen(false)} onQuantity={(id, amount, designId, size) => setCart(updateCartItem(id, amount, designId, size))} onRemove={(id, designId, size) => setCart(removeCartItem(id, designId, size))} onSize={(id, size, designId, previousSize) => setCart(updateCartItemSize(id, size, designId, previousSize))} />
    {buyNow && <BuyNowCheckout entries={buyNow} product={product} onClose={() => setBuyNow(null)} />}
  </div>;
}
