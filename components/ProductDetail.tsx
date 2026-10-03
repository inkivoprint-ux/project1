"use client";



import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { cartItemCount, loadCart, removeCartItem, subscribeToCart, updateCartItem, updateCartItemSize, type CartEntry } from "@/lib/cart";
import { loadAllProducts, subscribeToProductCatalog } from "@/lib/productCatalog";
import { formatPrice, type Product } from "@/lib/products";

import { emptySizeQuantities, isTShirtCategory, serializeSizeQuantities, totalSizeQuantity } from "@/lib/productSizes";
import { SizeQuantitySelector } from "./SizeQuantitySelector";
import { BrandLogo } from "./BrandLogo";

import { CartDrawer } from "./CartDrawer";
import { QuantitySelector } from "./QuantitySelector";
import { hasSupabaseConfiguration } from "@/lib/supabase/config";
import { refreshSharedProducts } from "@/lib/sharedCatalog";
import { OrderSupport } from "./OrderSupport";
import { stockLevel } from "@/lib/productAvailability";

export function ProductDetail({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);
  const [sizeQuantities, setSizeQuantities] = useState(emptySizeQuantities);
  const isTShirt = isTShirtCategory(product.category);
  const selectedQuantity = isTShirt ? totalSizeQuantity(sizeQuantities) : quantity;
  const [view, setView] = useState("front");
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [catalogue, setCatalogue] = useState<Product[]>([product]);
  const [cartOpen, setCartOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const refreshCart = () => setCart(loadCart());
    const refreshProducts = () => setCatalogue(loadAllProducts());
    const timer = window.setTimeout(() => { refreshCart(); if (hasSupabaseConfiguration()) refreshSharedProducts().then(refreshProducts).catch(() => setError("The catalogue could not be refreshed. Reload before ordering.")); else refreshProducts(); }, 0);
    const unsubscribeCart = subscribeToCart(refreshCart);
    const unsubscribeProducts = subscribeToProductCatalog(refreshProducts);
    return () => { window.clearTimeout(timer); unsubscribeCart(); unsubscribeProducts(); };
  }, []);

  const frontImage = product.views?.find((entry) => entry.id === "front")?.image ?? product.image;
  const views = [...(product.views ?? [{ id: "front" as const, label: "Front", image: product.image }]), ...(isTShirt && !product.views?.some((entry) => entry.id === "back") ? [{ id: "back" as const, label: "Back", image: frontImage }] : [])].map((entry) => isTShirt && entry.id === "back" ? { ...entry, label: "Back", image: frontImage } : entry);
  const image = views.find((item) => item.id === view)?.image ?? product.image;
  const customizerUrl = `/customize/${product.slug}?quantity=${selectedQuantity}&personalise=1&view=${view}${isTShirt ? `&sizes=${encodeURIComponent(serializeSizeQuantities(sizeQuantities))}` : ""}`;

  return <div className="product-detail-shell">
    <header className="product-detail-header container">
      <Link href="/#shop" className="product-detail-back" aria-label="All products"><ArrowLeft size={18} /><span>All products</span></Link>
      <BrandLogo />
      <button className="product-detail-cart" aria-label={`Open cart, ${cartItemCount(cart)} items`} onClick={() => setCartOpen(true)}><ShoppingBag size={20} /><span>{cartItemCount(cart)}</span></button>
    </header>
    <main id="main-content" className="container product-detail-layout">
      <section className="product-detail-gallery" aria-label="Product images">
        <div className="product-detail-image">{product.badge && <span className="product-badge">{product.badge}</span>}<Image src={image} alt={`${product.name}${product.views ? ` · ${view}` : ""}`} fill sizes="(max-width: 900px) 90vw, 50vw" preload unoptimized={image.startsWith("data:")} /></div>
        {views.length > 1 && <div className="view-switch">{views.map((item) => <button key={item.id} aria-pressed={view === item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>{item.label}</button>)}</div>}
      </section>
      <section className="product-detail-copy" aria-label="Product details">
        <span className="eyebrow">{product.category}</span><h1>{product.name}</h1><p className="product-detail-finish">{product.finish}</p>
        <p className={`product-stock-status ${product.stockQuantity == null ? "" : `stock-${stockLevel(product.stockQuantity)}`}`}>{product.stockQuantity == null ? "" : product.stockQuantity === 0 ? "Out of stock" : `${product.stockQuantity} units in stock`}</p><div className="product-detail-price"><strong>{formatPrice(product.price)}</strong>{product.compareAt && <del>{formatPrice(product.compareAt)}</del>}<small>per item</small></div>{isTShirtCategory(product.category) && product.frontBackPrice && <p>Front only: {formatPrice(product.price)} · Front + back: {formatPrice(product.frontBackPrice)}</p>}
        <div className="product-description"><h2>About this product</h2><p>{product.description || "Contact the Inkivo team for more information about this product."}</p></div>
        <dl className="product-detail-specs"><div><dt>Finish / specification</dt><dd>{product.finish}</dd></div><div><dt>Customization area</dt><dd>{product.printArea.widthMm} × {product.printArea.heightMm} mm</dd></div>{product.views && <div><dt>Available previews</dt><dd>{product.views.map((item) => item.label).join(" / ")}</dd></div>}</dl>
        <p>Add your photo, logo or text in the customization editor before ordering.</p>
        {isTShirt ? <SizeQuantitySelector stock={product.sizeStock} quantities={sizeQuantities} onChange={setSizeQuantities} /> : <QuantitySelector quantity={quantity} onChange={setQuantity} />}
        <div className="purchase-total"><span>Item total</span><strong>{formatPrice(product.price * selectedQuantity)}</strong></div>
        <div className="purchase-buttons">{selectedQuantity > 0 ? <>
          <Link className="button purchase-secondary" href={`${customizerUrl}&intent=cart`}><ShoppingBag size={18} /> Customize & add to cart</Link>
          <Link className="button" href={`${customizerUrl}&intent=buy-now`}>Customize & buy now <ArrowRight size={18} /></Link>
        </> : <button className="button" disabled>Choose a size and quantity to customize</button>}</div>
        <p className="purchase-note">Create and preview your design first. Your selected quantity carries into the editor. Final order details are confirmed on WhatsApp.</p>
        <OrderSupport />
        {error && <p className="purchase-error" role="alert">{error}</p>}
        <Link href="/#contact" className="text-link">Questions about this product? Talk to us <ArrowRight size={16} /></Link>
      </section>
    </main>
    <CartDrawer open={cartOpen} cart={cart} products={catalogue} onClose={() => setCartOpen(false)} onQuantity={(id, amount, designId, size) => setCart(updateCartItem(id, amount, designId, size))} onRemove={(id, designId, size) => setCart(removeCartItem(id, designId, size))} onSize={(id, size, designId, previousSize) => setCart(updateCartItemSize(id, size, designId, previousSize))} />
  </div>;
}
