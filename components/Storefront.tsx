"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Gift, Heart, Mail, Phone, RotateCcw, SearchX, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cartItemCount, loadCart, removeCartItem, subscribeToCart, updateCartItem, updateCartItemSize, type CartEntry } from "@/lib/cart";
import { filterProducts, loadAllProducts, subscribeToProductCatalog } from "@/lib/productCatalog";
import { formatPrice, products, type Product } from "@/lib/products";
import { Header } from "./Header";
import { BrandLogo } from "./BrandLogo";
import { CartDrawer } from "./CartDrawer";
import { contact } from "@/lib/siteConfig";
import { hasSupabaseConfiguration } from "@/lib/supabase/config";
import { refreshSharedProducts } from "@/lib/sharedCatalog";
import { isProductAvailable } from "@/lib/productAvailability";

export function Storefront({ initialProducts = products }: { initialProducts?: Product[] }) {
  const productGridRef = useRef<HTMLDivElement>(null);
  const slideProducts = (direction: number) => { const grid = productGridRef.current; if (grid) grid.scrollBy({ left: direction * grid.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); };
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [category, setCategory] = useState("All gifts");
  const [searchQuery, setSearchQuery] = useState("");
  const [catalogue, setCatalogue] = useState<Product[]>(initialProducts);
  const [catalogueError, setCatalogueError] = useState("");
  const categories = useMemo(() => ["All gifts", ...Array.from(new Set(catalogue.filter(isProductAvailable).map((product) => product.category)))], [catalogue]);

  useEffect(() => {
    const refresh = () => setCatalogue(loadAllProducts());
    if (hasSupabaseConfiguration()) refreshSharedProducts().catch(() => setCatalogueError("The products could not be refreshed. Please reload before ordering."));
    else refresh();
    return subscribeToProductCatalog(refresh);
  }, []);

  useEffect(() => {
    const refresh = () => setCart(loadCart());
    const timer = window.setTimeout(() => {
      refresh();
      if (new URLSearchParams(window.location.search).get("cart") === "open") setCartOpen(true);
    }, 0);
    const unsubscribe = subscribeToCart(refresh);
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, []);

  const visibleProducts = useMemo(() => {
    const matches = filterProducts(catalogue.filter(isProductAvailable), searchQuery);
    return category === "All gifts" ? matches : matches.filter((product) => product.category === category);
  }, [catalogue, category, searchQuery]);
  const searching = Boolean(searchQuery.trim());

  const showSearchResults = () => document.querySelector("#shop")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="storefront">
      <Header cartCount={cartItemCount(cart)} searchValue={searchQuery} searchResultsCount={visibleProducts.length} onSearchChange={(value) => { setSearchQuery(value); setCategory("All gifts"); }} onSearchSubmit={showSearchResults} onCartClick={() => setCartOpen(true)} />
      <CartDrawer open={cartOpen} cart={cart} products={catalogue} onClose={() => setCartOpen(false)} onQuantity={(productId, quantity, designId, size) => setCart(updateCartItem(productId, quantity, designId, size))} onRemove={(productId, designId, size) => setCart(removeCartItem(productId, designId, size))} onSize={(id, size, designId, previousSize) => setCart(updateCartItemSize(id, size, designId, previousSize))} />
      <main id="main-content">
      {!searching && <><section className="hero">
        <div className="hero-grain" />
        <div className="container hero-grid">
          <div className="hero-copy reveal">
            <span className="eyebrow light"><Sparkles size={14} /> Customized, beautifully</span>
            <h1>Make it <em>theirs.</em><br />Make it memorable.</h1>
            <p>Turn everyday essentials into keepsakes with photos, names, and artwork that mean something.</p>
            <div className="hero-actions">
              <a className="button button--cream" href="#shop">Create your gift <ArrowRight size={18} /></a>
            </div>
            <div className="hero-details"><span><Check size={16} /> Live design preview</span><span><Check size={16} /> Personal support</span></div>
          </div>
          <div className="hero-visual">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="hero-badge"><span>your memory</span><strong>here</strong></div>
            <Image src="/products/cork-base-bottle.png" alt="Customized black bottle with cork base" width={1024} height={1536} sizes="(max-width: 900px) 260px, 380px" preload className="hero-product" />
            <div className="floating-note"><span className="note-icon">♡</span><span><strong>Made for them</strong><small>Designed by you</small></span></div>
          </div>
        </div>
        <div className="hero-bottom-wave" />
      </section>

      <section className="trust-strip" aria-label="Store benefits">
        <div className="container trust-grid">
          <div><Truck /><span><strong>Delivery support</strong><small>Confirmed with your order</small></span></div>
          <div><ShieldCheck /><span><strong>Print quality promise</strong><small>Made to last</small></span></div>
          <div><RotateCcw /><span><strong>Easy assistance</strong><small>Real people, ready to help</small></span></div>
          <div><Gift /><span><strong>Gift-ready packing</strong><small>Thoughtful from the start</small></span></div>
        </div>
      </section></>}

      <section className={`shop-section ${searching ? "search-results-mode" : ""}`} id="shop">
        <div className="container">
          {catalogueError && <p role="alert">{catalogueError}</p>}
          {!searching && <><div className="section-heading">
            <div><span className="eyebrow">Start with a favourite</span><h2>Gifts they’ll use.<br /><em>Memories they’ll keep.</em></h2></div>
            <p>Pick a product, make it personal, and preview your design before placing the order.</p>
          </div>
          <div className="category-pills" role="group" aria-label="Product categories">
            {categories.map((item) => <button key={item} aria-pressed={category === item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}
          </div></>}
          {searching && <div className="shop-search-summary" role="status" aria-live="polite"><span><strong>{visibleProducts.length}</strong> {visibleProducts.length === 1 ? "product" : "products"} matching “{searchQuery}”</span><button onClick={() => setSearchQuery("")}>Clear search</button></div>}
          {visibleProducts.length > 4 && <div className="product-slider-controls"><span>Swipe to browse more gifts</span><button type="button" aria-label="Previous products" onClick={() => slideProducts(-1)}><ArrowLeft size={18} /></button><button type="button" aria-label="Next products" onClick={() => slideProducts(1)}><ArrowRight size={18} /></button></div>}
          <div ref={productGridRef} key={`${category}:${searchQuery}`} className={`product-grid${visibleProducts.length > 4 ? " product-grid-slider" : ""}`}>
            {visibleProducts.map((product) => (
              <article className="product-card" key={product.id}>
                <Link href={`/products/${product.slug}`} className="product-card-link" aria-label={`View ${product.name} details`}>
                  <div className="product-image-wrap">
                    <Image src={product.image} alt={product.name} width={1024} height={1536} sizes="(max-width: 600px) 45vw, (max-width: 900px) 30vw, 25vw" className="product-image" unoptimized={product.image.startsWith("data:")} />
                  </div>
                  <div className="product-meta">
                    <div className="product-title-row"><h3 title={product.name}>{product.name.split(/\s+/).slice(0, 4).join(" ")}{product.name.split(/\s+/).length > 4 ? "…" : ""}</h3></div>
                    <div className="price-row"><strong><span className="sr-only">Selling price </span>{formatPrice(product.price)}</strong>{product.compareAt !== undefined && product.compareAt > product.price && <del><span className="sr-only">Compare-at price </span>{formatPrice(product.compareAt)}</del>}</div>
                  </div>
                </Link>
              </article>
            ))}
            {visibleProducts.length === 0 && <div className="product-search-empty"><SearchX size={30} /><h3>No matching products</h3><p>Try a different product name, category, or finish.</p><button onClick={() => { setSearchQuery(""); setCategory("All gifts"); }}>Show all products</button></div>}
          </div>
        </div>
      </section>

      <section className="story-section" id="about">
        <div className="container story-grid">
          <div className="story-copy"><span className="eyebrow">The meaning is in the making</span><h2>Not just a product.<br /><em>A little piece of someone.</em></h2><p>Inkivo began with one simple belief: the best gifts aren’t the most expensive. They’re the ones that feel seen, known, and chosen.</p><p>Every order is prepared with care, checked by a real person, and made to bring a very particular smile.</p><a href="#shop" className="text-link">Find their perfect gift <ArrowRight size={17} /></a></div>
          <div className="story-collage">
            <div className="story-card story-card-one"><Image src="/products/bamboo-travel-mug.png" alt="Bamboo mug" fill sizes="360px" /></div>
            <div className="story-card story-card-two"><span>made with</span><strong>care</strong><i>♥</i></div>
            <div className="story-stamp">PERSONAL<br />IS POWERFUL</div>
          </div>
        </div>
      </section>

      <section className="gifting-cta" id="gifting">
        <Heart className="gifting-heart" aria-hidden="true" strokeWidth={1} />
        <div className="container gifting-inner">
          <div><span className="eyebrow light">Gifting for teams & celebrations</span><h2>Many people.<br /><em>One thoughtful gesture.</em></h2><p>Customized gifting for teams, weddings, events, and everyone on your list.</p></div>
          <a className="button button--cream" href={`${contact.whatsapp}?text=Hello%20Inkivo%2C%20I%27d%20like%20to%20discuss%20a%20bulk%20gifting%20order.`} target="_blank" rel="noopener noreferrer">Plan a bulk order <ArrowRight size={18} /></a>
        </div>
      </section>

      <section className="contact-section" id="contact"><div className="container contact-grid"><div><span className="eyebrow">Here to help</span><h2>Let’s make it personal.</h2><p>Need help with artwork, delivery, or a bulk order? Talk to the Inkivo team before you order.</p></div><address><a href={contact.telephone}><Phone size={20} /><span><small>Call us</small>{contact.phone}</span></a><a href={contact.emailLink}><Mail size={20} /><span><small>Email us</small>{contact.email}</span></a><a className="button" href={contact.whatsapp} target="_blank" rel="noopener noreferrer">Chat on WhatsApp <ArrowRight size={18} /></a></address></div></section>
      </main>

      <footer className="footer">
        <div className="container footer-grid">
          <div><BrandLogo light /><p>Thoughtful things, made personal.<br />Designed by you. Crafted by us.</p><small>Made with care in Kerala, India.</small></div>
          <div><h3>Explore</h3><a href="#shop">All products</a><a href="#gifting">Corporate gifting</a></div>
          <div><h3>Inkivo</h3><a href="#about">Our story</a><a href="#contact">Contact & delivery help</a></div>
          <div><h3>Contact</h3><a href={contact.telephone}>{contact.phone}</a><a href={contact.emailLink}>{contact.email}</a><a href={contact.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp support <ArrowRight size={14} /></a></div>
        </div>
        <div className="container footer-bottom"><span>© {new Date().getFullYear()} Inkivo.in</span><span className="powered-by">Powered by <a href="https://webappzz.com/" target="_blank" rel="noopener noreferrer">Webappzz Technologies</a></span></div>
      </footer>
    </div>
  );
}
