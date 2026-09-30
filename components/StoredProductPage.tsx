"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/products";
import { findStoredProduct, subscribeToProductCatalog } from "@/lib/productCatalog";
import { AdminTemplateEditor } from "./AdminTemplateEditor";
import { Customizer } from "./Customizer";
import { ProductDetail } from "./ProductDetail";
import { hasSupabaseConfiguration } from "@/lib/supabase/config";
import { refreshSharedProducts } from "@/lib/sharedCatalog";

export function StoredProductPage({ slug, mode, initialProduct }: { slug: string; mode: "customize" | "template" | "detail"; initialProduct?: Product }) {
  const [product, setProduct] = useState<Product | null | undefined>(initialProduct);
  const [error, setError] = useState("");

  useEffect(() => {
    const refresh = () => setProduct(findStoredProduct(slug) ?? null);
    const timer = window.setTimeout(() => {
      if (hasSupabaseConfiguration()) refreshSharedProducts().then(refresh).catch(() => setError("The product could not be refreshed. Please reload before ordering."));
      else refresh();
    }, 0);
    const unsubscribe = subscribeToProductCatalog(refresh);
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, [slug]);

  if (error) return <main className="route-state"><p role="alert">{error}</p><Link href="/#shop">Return to products</Link></main>;
  if (product === undefined) return <main className="route-state"><span className="route-spinner" /><p>Loading product…</p></main>;
  if (!product) {
    return <main className="route-state"><h1>Product not found</h1><p>This product is currently unavailable.</p><Link href={mode === "template" ? "/admin" : "/#shop"}>Return to products</Link></main>;
  }
  return mode === "template" ? <AdminTemplateEditor key={product.id} product={product} /> : mode === "detail" ? <ProductDetail key={product.id} product={product} /> : <Customizer key={product.id} product={product} />;
}
