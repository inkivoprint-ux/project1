import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { hasSupabaseConfiguration, publicSupabaseKey } from "./supabase/config";
import { parseStoredProduct, sortProducts } from "./productCatalog";
import { products, type Product } from "./products";

export function publicCatalogueClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = publicSupabaseKey();
  if (!url || !key) throw new Error("The shared catalogue is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export const getSharedCatalogue = cache(async (): Promise<Product[]> => {
  if (!hasSupabaseConfiguration()) return products;
  const { data, error } = await publicCatalogueClient().from("products").select("name, slug, description, base_price, offer_price, storefront_config").eq("is_active", true);
  if (error) throw new Error("The catalogue is temporarily unavailable.");
  return sortProducts((data ?? []).map((row) => {
    const baseline = row.storefront_config ?? products.find((product) => product.slug === row.slug);
    const product = parseStoredProduct({ ...baseline, name: row.name, slug: row.slug, description: row.description ?? "", price: Number(row.offer_price ?? row.base_price), compareAt: row.offer_price !== null ? Number(row.base_price) : undefined });
    if (!product) throw new Error("A catalogue record needs administrator configuration.");
    return product;
  }));
});
export async function getSharedProduct(slug: string) { return (await getSharedCatalogue()).find((product) => product.slug === slug); }
