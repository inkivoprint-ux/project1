"use client";

import { ArrowRight, Gift, HeartHandshake, Menu, MessageCircle, Search, ShoppingBag, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { BrandLogo } from "./BrandLogo";
import { useDialog } from "@/lib/useDialog";
import { contact } from "@/lib/siteConfig";

type HeaderProps = {
  cartCount?: number;
  searchValue?: string;
  searchResultsCount?: number;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: () => void;
  onCartClick?: () => void;
};

export function Header({ cartCount = 0, searchValue = "", searchResultsCount, onSearchChange, onSearchSubmit, onCartClick }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const menuRef = useDialog(menuOpen, () => setMenuOpen(false));

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    onSearchSubmit?.();
  };

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="announcement">Made personal. Made with care in India.</div>
      <header className="site-header">
        <div className="container header-inner">
          <button className="icon-button mobile-menu" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
          <BrandLogo />
          <nav className="desktop-nav" aria-label="Main navigation">
            <a href="#shop">Shop</a>
            <a href="#gifting">Gifting</a>
            <a href="#about">Our story</a>
            <a href="#contact">Contact</a>
          </nav>
          <div className="header-actions">
            <button className="icon-button hide-mobile" aria-label="Search products" aria-expanded={searchOpen} onClick={() => setSearchOpen(true)}><Search size={20} /></button>
            <button className="icon-button cart-button" aria-label={`Cart with ${cartCount} items`} onClick={onCartClick}>
              <ShoppingBag size={20} />
              {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
            </button>
          </div>
        </div>
      </header>
      <div className={`header-search-panel ${searchOpen ? "is-open" : ""}`} aria-hidden={!searchOpen} inert={!searchOpen} onKeyDown={(event) => { if (event.key === "Escape") setSearchOpen(false); }}>
        <form className="container" role="search" onSubmit={submitSearch}>
          <Search size={21} />
          <label className="sr-only" htmlFor="product-search">Search products</label>
          <input ref={searchInput} id="product-search" type="search" value={searchValue} onChange={(event) => onSearchChange?.(event.target.value)} placeholder="Search bottles, mugs, T-shirts…" />
          {searchValue && typeof searchResultsCount === "number" && <span>{searchResultsCount} {searchResultsCount === 1 ? "product" : "products"}</span>}
          <button type="button" className="icon-button" onClick={() => setSearchOpen(false)} aria-label="Close search"><X size={20} /></button>
        </form>
      </div>
      <div ref={menuRef} className={`mobile-drawer ${menuOpen ? "is-open" : ""}`} role="dialog" aria-modal={menuOpen ? true : undefined} aria-label="Navigation menu" aria-hidden={!menuOpen} inert={!menuOpen}>
        <div className="mobile-drawer-head"><BrandLogo /><button data-dialog-focus className="icon-button" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X /></button></div>
        <div className="mobile-menu-intro"><span>MAKE IT PERSONAL</span><h2>A little thought.<br />A lasting memory.</h2><p>Find a gift, add your story, make their day.</p></div>
        <button className="mobile-search-link" onClick={() => { setMenuOpen(false); setSearchOpen(true); }}><Search size={18} /> Search products <ArrowRight size={16} /></button>
        <nav aria-label="Mobile navigation">
          <a href="#shop" onClick={() => setMenuOpen(false)}><span className="mobile-nav-icon"><ShoppingBag size={20} /></span><span>Shop personalised gifts<small>Everyday favourites, made yours</small></span><ArrowRight size={16} /></a>
          <a href="#gifting" onClick={() => setMenuOpen(false)}><span className="mobile-nav-icon"><Gift size={20} /></span><span>Corporate gifting<small>Thoughtful gifts for your team</small></span><ArrowRight size={16} /></a>
          <a href="#about" onClick={() => setMenuOpen(false)}><span className="mobile-nav-icon"><HeartHandshake size={20} /></span><span>Our story<small>Made with care in Kerala</small></span><ArrowRight size={16} /></a>
          <a href="#contact" onClick={() => setMenuOpen(false)}><span className="mobile-nav-icon"><MessageCircle size={20} /></span><span>Contact<small>We’re here to help</small></span><ArrowRight size={16} /></a>
        </nav>
        <div className="mobile-menu-support"><span>Need a hand with your design?</span><a href={contact.whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /> Chat with Inkivo <ArrowRight size={16} /></a><small>Made personal. Made with care.</small></div>
      </div>
      {menuOpen && <button className="drawer-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}
    </>
  );
}
